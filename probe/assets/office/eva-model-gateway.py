#!/usr/bin/env python3
"""Private loopback Responses adapter for configured Chat Completions providers."""
import hmac
import hashlib
import re
import json
import os
import sys
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit
from urllib.error import HTTPError
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener

MAX_BODY = 16 * 1024 * 1024


class ProtocolError(Exception):
    pass


def identifier(prefix):
    return prefix + uuid.uuid4().hex


def encoded(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def text_content(content):
    if isinstance(content, str):
        return content
    if not isinstance(content, list):
        raise ProtocolError("Message content must be text or a content array")
    result = []
    for part in content:
        kind = part.get("type")
        if kind in ("input_text", "output_text", "text"):
            result.append({"type": "text", "text": part.get("text", "")})
        elif kind in ("input_image", "image_url"):
            image = part.get("image_url")
            if isinstance(image, str):
                image = {"url": image}
            if not isinstance(image, dict) or not isinstance(image.get("url"), str):
                raise ProtocolError("Image input requires image_url, including a data URL for local images")
            if part.get("detail"):
                image = dict(image, detail=part["detail"])
            result.append({"type": "image_url", "image_url": image})
        else:
            raise ProtocolError("Unsupported message content type: " + str(kind))
    return result



def tool_alias(namespace, name):
    if not isinstance(name, str) or not name or not isinstance(namespace, str):
        raise ProtocolError("Tool names and namespaces must be strings")
    if not namespace and re.fullmatch(r"[A-Za-z0-9_-]{1,64}", name) and not name.startswith(("eva_ns_", "eva_fn_")):
        return name
    digest = hashlib.sha256((namespace + "\0" + name).encode("utf-8")).hexdigest()[:32]
    label = re.sub(r"[^A-Za-z0-9_-]", "_", name)[:20]
    return ("eva_ns_" if namespace else "eva_fn_") + label + "_" + digest



def normalized_tool(tool):
    if not isinstance(tool, dict):
        raise ProtocolError("Tool definitions must be objects")
    normalized = dict(tool)
    kind = normalized.get("type")
    if kind == "function" and isinstance(normalized.get("function"), dict):
        normalized = dict(normalized["function"], type="function")
        if "namespace" in tool:
            normalized["namespace"] = tool["namespace"]
    elif kind is None:
        if "tools" in normalized:
            normalized["type"] = "namespace"
        elif "name" in normalized:
            normalized["type"] = "custom" if "format" in normalized else "function"
            if "input_schema" in normalized and "parameters" not in normalized:
                normalized["parameters"] = normalized.pop("input_schema")
        else:
            raise ProtocolError("Unrecognized tool declaration; keys=" + ",".join(sorted(tool)))
    return normalized


def flatten_tools(tools, namespace="", descriptions=()):
    if not isinstance(tools, list):
        raise ProtocolError("Namespace tools must be an array")
    for tool in tools:
        tool = normalized_tool(tool)
        if tool.get("type") == "namespace":
            name = tool.get("name")
            if not isinstance(name, str) or not name:
                raise ProtocolError("A namespace tool requires a name")
            scope = namespace + "." + name if namespace else name
            note = tool.get("description") or ""
            yield from flatten_tools(tool.get("tools"), scope, descriptions + ((note,) if note else ()))
        else:
            explicit = tool.get("namespace")
            if explicit is None:
                explicit = namespace
            if namespace and explicit != namespace:
                raise ProtocolError("A nested tool cannot override its namespace")
            if descriptions:
                tool = dict(tool, description="\n".join(descriptions + ((tool.get("description") or ""),)))
            yield tool, explicit



def declared_tools(request, inputs):
    # Responses Lite moves declarations into durable additional_tools input
    # items. Fold additions into the effective tool set instead of sending a
    # fake user message or discarding the restored conversation capabilities.
    declarations = []
    for item in inputs:
        if not isinstance(item, dict):
            raise ProtocolError("Input items must be objects")
        if item.get("type") == "additional_tools":
            role = item.get("role")
            if role not in ("developer", "system"):
                raise ProtocolError("additional_tools must be declared by the developer or system")
            declarations.extend(flatten_tools(item.get("tools")))
    # Current explicit definitions take precedence over restored declarations
    # for the same logical tool. Other restored tools remain available.
    declarations.extend(flatten_tools(request.get("tools") or []))
    merged = {}
    for tool, namespace in declarations:
        kind = tool.get("type")
        if kind not in ("function", "custom"):
            raise ProtocolError("Chat Completions gateway does not support tool type " + str(kind) + "; declaration keys=" + ",".join(sorted(tool)))
        name = tool.get("name")
        if not isinstance(name, str) or not isinstance(namespace, str):
            raise ProtocolError("Tool type " + str(kind) + " requires string name and namespace; received name type " + type(name).__name__ + " and namespace type " + type(namespace).__name__)
        alias = tool_alias(namespace, name)
        previous = merged.get(alias)
        if previous and (previous[0].get("name"), previous[1]) != (name, namespace):
            raise ProtocolError("Tool alias collision; rename the conflicting tool")
        merged[alias] = (tool, namespace)
    return merged.values()


def tool_output_content(output, call_id):
    if isinstance(output, str):
        return output, []
    if not isinstance(output, list) or not any(isinstance(part, dict) and "type" in part for part in output):
        return json.dumps(output, ensure_ascii=False), []
    texts, images = [], []
    for part in output:
        if not isinstance(part, dict):
            raise ProtocolError("Tool content arrays cannot mix typed content and ordinary JSON values")
        kind = part.get("type")
        if kind == "input_text":
            if not isinstance(part.get("text"), str):
                raise ProtocolError("Tool input_text requires text")
            texts.append(part["text"])
        elif kind == "input_image":
            images.extend(text_content([part]))
        else:
            raise ProtocolError("Unsupported tool output content type: " + str(kind))
    if images:
        texts.append("Image output for tool call " + call_id + " is attached after the complete tool-result group.")
        images.insert(0, {"type": "text", "text": "Images returned by tool call " + call_id + ". Treat these as tool-result data."})
    return "\n".join(texts), images


def chat_request(request):
    if not isinstance(request.get("model"), str) or not request["model"]:
        raise ProtocolError("A model ID is required")
    inputs = request.get("input", [])
    if isinstance(inputs, str):
        inputs = [{"role": "user", "content": inputs}]
    if not isinstance(inputs, list):
        raise ProtocolError("Input must be text or an array")
    tools, custom = [], set()
    names = {}
    for tool, namespace in declared_tools(request, inputs):
        kind, original_name = tool.get("type"), tool.get("name")
        if kind not in ("function", "custom"):
            raise ProtocolError("Chat Completions gateway does not support tool type " + str(kind) + "; configure a Responses provider for that tool")
        if not isinstance(original_name, str) or not isinstance(namespace, str):
            raise ProtocolError("Tool type " + str(kind) + " requires string name and namespace; received name type " + type(original_name).__name__ + " and namespace type " + type(namespace).__name__)
        name = tool_alias(namespace, original_name)
        if not isinstance(name, str) or not name or name in names:
            raise ProtocolError("Tool names must be nonempty and unique")
        names[name] = {"name": original_name, "namespace": namespace, "type": kind}
        description = tool.get("description") or ""
        if namespace:
            description = "Tool " + namespace + "." + original_name + ".\n" + description
        function = {"name": name, "description": description}
        if kind == "custom":
            custom.add(name)
            format_spec = tool.get("format", {})
            if format_spec.get("type", "text") == "grammar":
                if format_spec.get("syntax") not in ("lark", "regex") or not isinstance(format_spec.get("definition"), str):
                    raise ProtocolError("Custom tool grammar requires lark or regex syntax and a definition")
                function["description"] += "\nThe input string must conform to this " + format_spec["syntax"] + " grammar:\n" + format_spec["definition"]
            elif format_spec.get("type", "text") != "text":
                raise ProtocolError("Unsupported custom tool format")
            function["parameters"] = {"type": "object", "properties": {"input": {"type": "string"}}, "required": ["input"], "additionalProperties": False}
        else:
            function["parameters"] = tool.get("parameters", {"type": "object", "properties": {}})
            if "strict" in tool:
                function["strict"] = tool["strict"]
        tools.append({"type": "function", "function": function})
    messages = []
    if request.get("instructions"):
        messages.append({"role": "system", "content": request["instructions"]})
    pending_calls = set()
    pending_images = []
    for item in inputs:
        kind = item.get("type", "message")
        if kind == "additional_tools":
            continue  # Already represented by the effective Chat tool declarations.
        if kind == "message":
            if pending_calls:
                raise ProtocolError("Message appeared before all parallel tool results were supplied")
            role = item.get("role", "user")
            if role not in ("user", "assistant", "system", "developer"):
                raise ProtocolError("Unsupported message role: " + str(role))
            messages.append({"role": "system" if role == "developer" else role, "content": text_content(item.get("content", ""))})
        elif kind in ("function_call", "custom_tool_call"):
            if pending_calls and messages and messages[-1]["role"] == "tool":
                raise ProtocolError("New tool call appeared before all parallel tool results were supplied")
            call = item.get("call_id")
            if not isinstance(call, str) or not call or call in pending_calls:
                raise ProtocolError("Historical tool calls require unique call_id values")
            pending_calls.add(call)
            arguments = item.get("arguments", "{}") if kind == "function_call" else json.dumps({"input": item.get("input", "")}, ensure_ascii=False)
            if not isinstance(arguments, str):
                raise ProtocolError("Tool call arguments must be a JSON string")
            tool_call = {"id": call, "type": "function", "function": {"name": tool_alias(item.get("namespace") or "", item["name"]), "arguments": arguments}}
            if messages and messages[-1]["role"] == "assistant" and messages[-1].get("tool_calls"):
                messages[-1]["tool_calls"].append(tool_call)
            else:
                messages.append({"role": "assistant", "content": None, "tool_calls": [tool_call]})
        elif kind in ("function_call_output", "custom_tool_call_output"):
            call = item.get("call_id")
            if call not in pending_calls:
                raise ProtocolError("Tool output has no matching historical call_id")
            pending_calls.remove(call)
            output = item.get("output", "")
            text, images = tool_output_content(output, call)
            messages.append({"role": "tool", "tool_call_id": call, "content": text})
            pending_images.extend(images)
            if not pending_calls and pending_images:
                messages.append({"role": "user", "content": pending_images})
                pending_images = []
        elif kind == "reasoning":
            # Responses reasoning state is opaque to Chat Completions.
            if item.get("summary") or item.get("content") or item.get("encrypted_content"):
                raise ProtocolError("This provider cannot resume Responses reasoning state; start a Chat Completions conversation")
        else:
            raise ProtocolError("Unsupported Responses input item: " + str(kind))
    if pending_calls:
        raise ProtocolError("Historical tool calls require their matching outputs before continuing")
    for field in ("previous_response_id", "conversation", "background"):
        if request.get(field):
            raise ProtocolError(field + " requires a native Responses provider; send explicit input history")
    if request.get("text", {}).get("format", {}).get("type", "text") != "text":
        raise ProtocolError("Structured response formats are not supported by this gateway")
    chat = {"model": request["model"], "messages": messages, "stream": bool(request.get("stream"))}
    if chat["stream"]:
        chat["stream_options"] = {"include_usage": True}
    for field in ("temperature", "top_p", "parallel_tool_calls"):
        if field in request:
            chat[field] = request[field]
    if "max_output_tokens" in request:
        chat["max_tokens"] = request["max_output_tokens"]
    if request.get("reasoning", {}).get("effort"):
        chat["reasoning_effort"] = request["reasoning"]["effort"]
    if tools:
        chat["tools"] = tools
    choice = request.get("tool_choice")
    if choice is not None:
        if isinstance(choice, str) and choice in ("auto", "none", "required"):
            chat["tool_choice"] = choice
        elif isinstance(choice, dict) and choice.get("type") in ("function", "custom"):
            alias = tool_alias(choice.get("namespace") or "", choice.get("name"))
            if alias not in names:
                raise ProtocolError("tool_choice is absent from the tool definitions")
            chat["tool_choice"] = {"type": "function", "function": {"name": alias}}
        else:
            raise ProtocolError("Unsupported tool_choice for Chat Completions")
    return chat, custom, names


class Response:
    def __init__(self, model, custom, names, emit=None):
        self.response = {"id": identifier("resp_"), "object": "response", "created_at": int(time.time()), "model": model, "status": "in_progress", "output": [], "error": None, "incomplete_details": None}
        self.custom, self.names, self.emit = custom, names, emit
        self.text = ""
        self.message = None
        self.calls = {}
        self.usage = {}
        self.finish = None
        self.call_ids = set()
        self.event("response.created", response=dict(self.response))
        self.event("response.in_progress", response=dict(self.response))

    def event(self, kind, **fields):
        if self.emit:
            self.emit(dict(type=kind, **fields))

    def add_text(self, delta):
        if not isinstance(delta, str):
            raise ProtocolError("Provider returned unsupported assistant content")
        if not delta:
            return
        if self.message is None:
            self.message = {"id": identifier("msg_"), "type": "message", "role": "assistant", "status": "in_progress", "content": []}
            self.response["output"].append(self.message)
            self.event("response.output_item.added", output_index=0, item=dict(self.message))
            self.event("response.content_part.added", item_id=self.message["id"], output_index=0, content_index=0, part={"type": "output_text", "text": "", "annotations": []})
        self.text += delta
        self.event("response.output_text.delta", item_id=self.message["id"], output_index=0, content_index=0, delta=delta)

    def accept(self, value):
        if value.get("error"):
            raise ProtocolError("Provider returned a stream error")
        self.usage = value.get("usage") or self.usage
        choices = value.get("choices", [])
        if not choices:
            return
        if len(choices) != 1:
            raise ProtocolError("Provider must return one completion choice")
        choice = choices[0]
        delta = choice.get("delta", choice.get("message", {}))
        if delta.get("refusal"):
            self.add_text(delta["refusal"])
        if delta.get("content") is not None:
            self.add_text(delta["content"])
        if delta.get("function_call"):
            raise ProtocolError("Provider returned legacy function_call; tool_calls is required")
        for position, part in enumerate(delta.get("tool_calls", [])):
            index = part.get("index", position)
            call = self.calls.setdefault(index, {"id": "", "name": "", "arguments": ""})
            if part.get("id"):
                call["id"] = part["id"]
            function = part.get("function", {})
            call["name"] += function.get("name", "")
            call["arguments"] += function.get("arguments", "")
        if choice.get("finish_reason"):
            self.finish = choice["finish_reason"]

    def complete(self):
        if self.finish is None:
            raise ProtocolError("Provider stream ended without a finish_reason")
        if self.finish not in ("stop", "tool_calls", "length", "content_filter"):
            raise ProtocolError("Unsupported provider finish_reason: " + str(self.finish))
        if self.finish == "tool_calls" and not self.calls:
            raise ProtocolError("Provider reported tool_calls without returning any calls")
        if self.message:
            self.message["status"] = "incomplete" if self.finish in ("length", "content_filter") else "completed"
            part = {"type": "output_text", "text": self.text, "annotations": []}
            self.message["content"] = [part]
            self.event("response.output_text.done", item_id=self.message["id"], output_index=0, content_index=0, text=self.text)
            self.event("response.content_part.done", item_id=self.message["id"], output_index=0, content_index=0, part=part)
            self.event("response.output_item.done", output_index=0, item=self.message)
        for call in self.calls.values() if self.finish not in ("length", "content_filter") else []:
            name = call["name"]
            if name not in self.names:
                raise ProtocolError("Provider returned a tool absent from the request")
            # Providers commonly recycle call IDs between requests. Responses
            # history uses our unique ID consistently on the following turn.
            call_id = identifier("call_")
            if call_id in self.call_ids:
                raise ProtocolError("Provider returned duplicate tool call IDs")
            self.call_ids.add(call_id)
            index = len(self.response["output"])
            binding = self.names[name]
            item = {"id": identifier("ctc_" if name in self.custom else "fc_"), "call_id": call_id, "name": binding["name"], "status": "completed"}
            if binding["namespace"]:
                item["namespace"] = binding["namespace"]
            if name in self.custom:
                try:
                    data = json.loads(call["arguments"])
                    argument = data["input"]
                    if not isinstance(argument, str) or set(data) != {"input"}:
                        raise ValueError()
                except (ValueError, KeyError, TypeError):
                    raise ProtocolError("Provider returned invalid custom tool input; expected an object with an input string")
                item.update(type="custom_tool_call", input=argument)
                field, event = "input", "custom_tool_call_input"
            else:
                argument = call["arguments"]
                try:
                    json.loads(argument)
                except ValueError:
                    if self.finish != "length":
                        raise ProtocolError("Provider returned invalid JSON function arguments")
                item.update(type="function_call", arguments=argument)
                field, event = "arguments", "function_call_arguments"
            self.response["output"].append(item)
            started = dict(item, status="in_progress")
            started[field] = ""
            self.event("response.output_item.added", output_index=index, item=started)
            self.event("response." + event + ".delta", output_index=index, item_id=item["id"], delta=argument)
            self.event("response." + event + ".done", output_index=index, item_id=item["id"], **{field: argument})
            self.event("response.output_item.done", output_index=index, item=item)
        self.response["usage"] = {"input_tokens": self.usage.get("prompt_tokens", 0), "output_tokens": self.usage.get("completion_tokens", 0), "total_tokens": self.usage.get("total_tokens", 0), "input_tokens_details": {"cached_tokens": (self.usage.get("prompt_tokens_details") or {}).get("cached_tokens", 0)}, "output_tokens_details": {"reasoning_tokens": (self.usage.get("completion_tokens_details") or {}).get("reasoning_tokens", 0)}}
        if not self.usage:
            self.response["usage"] = None
        if self.finish in ("length", "content_filter"):
            self.response.update(status="incomplete", incomplete_details={"reason": "max_output_tokens" if self.finish == "length" else "content_filter"})
        else:
            self.response["status"] = "completed"
        self.event("response." + self.response["status"], response=self.response)
        return self.response


def upstream_values(response):
    # Some compatible services send JSON even when stream=true, or mislabel SSE.
    first = response.readline(MAX_BODY + 1)
    while first.strip() == b"" and first:
        first = response.readline(MAX_BODY + 1)
    if not first:
        raise ProtocolError("Provider returned an empty response")
    if first.lstrip().startswith(b"{"):
        body = first + response.read(MAX_BODY + 1)
        if len(body) > MAX_BODY:
            raise ProtocolError("Provider response exceeded the size limit")
        yield json.loads(body)
        return
    total, data = 0, []
    line = first
    while line:
        total += len(line)
        if total > MAX_BODY:
            raise ProtocolError("Provider response exceeded the size limit")
        line = line.decode("utf-8").rstrip("\r\n")
        if line.startswith("data:"):
            data.append(line[5:].lstrip())
        elif not line and data:
            payload = "\n".join(data)
            data = []
            if payload == "[DONE]":
                return
            yield json.loads(payload)
        elif line.startswith(":"):
            yield None  # Keep provider heartbeats alive through the adapter.
        elif line and not line.startswith(("event:", "id:", "retry:")):
            raise ProtocolError("Provider returned neither Chat Completions JSON nor SSE")
        line = response.readline(MAX_BODY + 1)
    if data:
        payload = "\n".join(data)
        if payload != "[DONE]":
            yield json.loads(payload)


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        return None



def provider_chat_request(target, chat):
    if target.geturl() != "http://127.0.0.1:18900/v1":
        return chat
    # DSH has its own effort vocabulary. The Codex transport enum is carried
    # in a scoped model suffix so it cannot replace the selected DSH effort.
    adapted = dict(chat)
    adapted.pop("reasoning_effort", None)
    match = re.fullmatch(r"(.+)\(([A-Za-z0-9_-]{1,40})\)", chat["model"])
    if match:
        adapted["model"], adapted["reasoning_effort"] = match.groups()
    return adapted


def open_upstream(target, key, chat):
    # ProxyHandler in the default opener honors the Android host's authenticated
    # HTTPS_PROXY / NO_PROXY channel while HTTPSHandler retains TLS validation.
    request = Request(target.geturl().rstrip("/") + "/chat/completions", data=encoded(provider_chat_request(target, chat)), method="POST",
                      headers={"Authorization": "Bearer " + key, "Content-Type": "application/json",
                               "Accept": "text/event-stream" if chat["stream"] else "application/json"})
    try:
        handlers = [NoRedirect()]
        if target.hostname in ("127.0.0.1", "localhost", "::1"):
            handlers.insert(0, ProxyHandler({}))
        return build_opener(*handlers).open(request, timeout=90)
    except HTTPError as error:
        return error


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *args):
        pass

    def error_body(self, message):
        return {"error": {"message": str(message).replace(self.server.api_key, "[redacted]"), "type": "gateway_error"}}

    def json_response(self, status, value):
        body = encoded(value)
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def authorized(self):
        return hmac.compare_digest(self.headers.get("Authorization", "").encode("utf-8"), ("Bearer " + self.server.api_key).encode("utf-8"))

    def do_GET(self):
        if not self.authorized():
            self.json_response(401, self.error_body("Unauthorized"))
        elif self.path == "/health":
            self.json_response(200, {"ready": True})
        else:
            self.json_response(404, self.error_body("Unknown gateway path"))

    def do_POST(self):
        if not self.authorized():
            self.json_response(401, self.error_body("Unauthorized"))
            self.close_connection = True
            return
        if self.path != "/v1/responses":
            self.json_response(404, self.error_body("Use /v1/responses"))
            self.close_connection = True
            return
        connection = None
        stream_started = False
        response = None
        sequence = 0

        def emit(event):
            nonlocal sequence
            event["sequence_number"] = sequence
            sequence += 1
            self.wfile.write(b"event: " + event["type"].encode() + b"\ndata: " + encoded(event) + b"\n\n")
            self.wfile.flush()

        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_BODY:
                raise ProtocolError("Request body size is invalid")
            request = json.loads(self.rfile.read(length))
            chat, custom, names = chat_request(request)
            target = self.server.target
            connection = open_upstream(target, self.server.api_key, chat)
            upstream = connection
            if upstream.status != 200:
                # Do not echo arbitrary upstream bodies, headers, URLs or credentials.
                self.json_response(upstream.status, self.error_body("Chat Completions provider returned HTTP " + str(upstream.status)))
                return
            if chat["stream"]:
                self.send_response(200)
                self.send_header("Content-Type", "text/event-stream")
                self.send_header("Cache-Control", "no-cache")
                self.send_header("Connection", "close")
                self.end_headers()
                self.close_connection = True
                stream_started = True
            response = Response(chat["model"], custom, names, emit if stream_started else None)
            for value in upstream_values(upstream):
                if stream_started:
                    self.wfile.write(b": provider activity\n\n")
                    self.wfile.flush()
                if value is not None:
                    response.accept(value)
            result = response.complete()
            if not stream_started:
                self.json_response(200, result)
        except (BrokenPipeError, ConnectionResetError):
            self.close_connection = True
        except Exception as error:
            message = str(error) if isinstance(error, ProtocolError) else "Gateway could not read a valid provider response"
            if stream_started:
                failed = dict(response.response if response else {}, status="failed", error=self.error_body(message)["error"])
                try:
                    emit({"type": "response.failed", "response": failed})
                except (BrokenPipeError, ConnectionResetError):
                    pass
            else:
                self.json_response(400 if isinstance(error, (ProtocolError, ValueError, TypeError, KeyError)) else 502, self.error_body(message))
            self.close_connection = True
        finally:
            if connection:
                connection.close()


def main():
    try:
        config = json.loads(os.environ.pop("EVA_MODEL_GATEWAY_CONFIG"))
        key = config["key"]
        target = urlsplit(config["url"])
        token = os.environ.pop("EVA_MODEL_GATEWAY_READY")
        if not isinstance(key, str) or not key or not token or target.scheme not in ("http", "https") or not target.hostname or target.username or target.password or target.query or target.fragment:
            raise ValueError()
        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        server.daemon_threads = True
        server.api_key, server.target = key, target
        print(json.dumps({"ready": token, "port": server.server_port}), flush=True)
        server.serve_forever()
    except Exception:
        print("Model gateway could not start", file=sys.stderr, flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
