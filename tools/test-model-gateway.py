#!/usr/bin/env python3
"""Real loopback HTTP fixtures. No credentials or network provider required."""
import http.client
import json
import os
import runpy
from urllib.parse import urlsplit
from pathlib import Path
import subprocess
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = Path(__file__).resolve().parents[1]
requests = []
mode = "text"


class Upstream(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_POST(self):
        global mode
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        requests.append((self.path, self.headers.get("Authorization"), body))
        status = 429 if mode == "error" else 302 if mode == "redirect" else 200
        self.send_response(status)
        if status != 200:
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        call_name = next((tool["function"]["name"] for tool in body.get("tools", []) if tool["function"]["name"].startswith("eva_ns_")), "run") if mode.startswith("namespace_") else "run"
        message = {"role": "assistant", "content": "hello"}
        if mode in ("function", "custom", "namespace_function", "namespace_custom"):
            message = {"role": "assistant", "content": None, "tool_calls": [{"id": "upstream-call", "type": "function", "function": {"name": call_name, "arguments": '{"input":"pwd"}' if mode in ("custom", "namespace_custom") else '{"value":1}'}}]}
        finish = "length" if mode in ("length", "truncated_tool") else "tool_calls" if mode in ("function", "custom", "namespace_function", "namespace_custom") else "stop"
        if mode == "truncated_tool":
            message = {"role": "assistant", "content": None, "tool_calls": [{"id": "cut", "type": "function", "function": {"name": call_name, "arguments": '{"input":"unfinished'}}]}
        usage = {"prompt_tokens": 12, "completion_tokens": 4, "total_tokens": 16, "prompt_tokens_details": {"cached_tokens": 2}}
        if body.get("stream") and mode not in ("json_fallback", "truncated_tool"):
            # Deliberately incorrect content type tests body-based SSE detection.
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b": fixture heartbeat\n\n")
            chunks = [{"choices": [{"delta": {"content": "hello"}, "finish_reason": None}]}]
            if mode in ("function", "custom", "namespace_function", "namespace_custom"):
                call = message["tool_calls"][0]
                chunks = [{"choices": [{"delta": {"tool_calls": [{"index": 0, "id": call["id"], "function": {"name": call_name, "arguments": call["function"]["arguments"][:5]}}]}, "finish_reason": None}]}, {"choices": [{"delta": {"tool_calls": [{"index": 0, "function": {"arguments": call["function"]["arguments"][5:]}}]}, "finish_reason": None}]}]
            chunks.append({"choices": [{"delta": {}, "finish_reason": finish}], "usage": usage})
            for chunk in chunks:
                self.wfile.write(b"data: " + json.dumps(chunk).encode() + b"\n\n")
            self.wfile.write(b"data: [DONE]\n\n")
        else:
            self.send_header("Content-Type", "text/event-stream")
            self.end_headers()
            self.wfile.write(json.dumps({"choices": [{"message": message, "finish_reason": finish}], "usage": usage}).encode())


def post(port, request, key="fixture-key"):
    connection = http.client.HTTPConnection("127.0.0.1", port, timeout=10)
    connection.request("POST", "/v1/responses", json.dumps(request), {"Authorization": "Bearer " + key, "Content-Type": "application/json"})
    response = connection.getresponse()
    body = response.read().decode()
    status = response.status
    connection.close()
    return status, body


def completed(body):
    assert ": provider activity" in body, "upstream activity heartbeat lost"
    events = [json.loads(line[6:]) for line in body.splitlines() if line.startswith("data: ")]
    assert [event["sequence_number"] for event in events] == list(range(len(events)))
    return events[-1]["response"], events


def main():
    global mode
    adapt = runpy.run_path(str(ROOT / "probe/assets/office/eva-model-gateway.py"))["provider_chat_request"]
    local = urlsplit("http://127.0.0.1:18900/v1")
    for effort in ("off", "light", "balanced", "deep", "max", "low", "medium", "high", "none"):
        original = {"model": "kilo-auto/free(" + effort + ")", "reasoning_effort": "medium", "stream": True}
        adapted = adapt(local, original)
        assert adapted["model"] == "kilo-auto/free" and adapted["reasoning_effort"] == effort
        assert original["model"].endswith("(" + effort + ")") and original["reasoning_effort"] == "medium"
        assert "reasoning_effort" not in adapt(local, {"model": "kilo-auto/free", "reasoning_effort": effort})
        for other in ("https://fixture.invalid/v1", "http://127.0.0.1:18901/v1", "http://localhost:18900/v1"):
            assert adapt(urlsplit(other), original) == original
    assert adapt(local, {"model": "kilo-auto/free", "stream": False}) == {"model": "kilo-auto/free", "stream": False}
    server = ThreadingHTTPServer(("127.0.0.1", 0), Upstream)
    server.daemon_threads = True
    threading.Thread(target=server.serve_forever, daemon=True).start()
    env = dict(os.environ, EVA_MODEL_GATEWAY_CONFIG=json.dumps({"url": "http://127.0.0.1:" + str(server.server_port) + "/v1", "key": "fixture-key"}), EVA_MODEL_GATEWAY_READY="fixture-ready", NO_PROXY="", no_proxy="", HTTP_PROXY="http://127.0.0.1:9", http_proxy="http://127.0.0.1:9", HTTPS_PROXY="http://127.0.0.1:9", https_proxy="http://127.0.0.1:9")
    child = subprocess.Popen(["python3", "-B", str(ROOT / "probe/assets/office/eva-model-gateway.py")], env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    try:
        ready = json.loads(child.stdout.readline())
        assert ready["ready"] == "fixture-ready"
        port = ready["port"]
        status, body = post(port, {"model": "fixture", "input": "hi"})
        result = json.loads(body)
        assert status == 200 and result["output"][0]["content"][0]["text"] == "hello"
        assert result["usage"]["input_tokens"] == 12
        status, body = post(port, {"model": "fixture", "input": "hi", "stream": True})
        streamed, events = completed(body)
        assert status == 200 and streamed["status"] == "completed" and any(e["type"] == "response.output_text.delta" for e in events)
        assert streamed["id"] != result["id"] and streamed["output"][0]["id"] != result["output"][0]["id"]
        for kind in ("function", "custom"):
            mode = kind
            tool = {"type": kind, "name": "run", "parameters": {"type": "object"}}
            status, body = post(port, {"model": "fixture", "input": "run", "tools": [tool], "stream": True})
            reply, events = completed(body)
            call = reply["output"][0]
            assert call["type"] == ("function_call" if kind == "function" else "custom_tool_call")
            assert call["id"].startswith("fc_" if kind == "function" else "ctc_")
            mode = "text"
            output = {"type": "function_call_output" if kind == "function" else "custom_tool_call_output", "call_id": call["call_id"], "output": "/workspace"}
            status, body = post(port, {"model": "fixture", "input": [{"role": "user", "content": "run"}, call, output], "tools": [tool]})
            assert status == 200
            sent = requests[-1][2]["messages"]
            assert sent[1]["tool_calls"][0]["id"] == sent[2]["tool_call_id"] == call["call_id"]
        for kind in ("function", "custom"):
            mode = "namespace_" + kind
            leaf = {"type": kind, "name": "run", "namespace": None, "description": "run a command", "parameters": {"type": "object"}}
            if kind == "custom":
                leaf["format"] = {"type": "grammar", "syntax": "regex", "definition": "[a-z]+"}
            tools = [{"type": "function", "name": "run", "namespace": None, "parameters": {"type": "object"}}, {"type": "namespace", "name": "workspace", "tools": [{"type": "namespace", "name": "files", "tools": [leaf]}]}, {"type": "namespace", "name": "other", "tools": [{"type": "function", "name": "run", "parameters": {"type": "object"}}]}]
            status, body = post(port, {"model": "fixture", "input": "run", "tools": tools, "stream": True, "tool_choice": {"type": kind, "name": "run", "namespace": "workspace.files"}})
            reply, events = completed(body)
            assert status == 200 and reply["status"] == "completed"
            call = reply["output"][0]
            assert call["name"] == "run" and call["namespace"] == "workspace.files"
            sent = requests[-1][2]
            aliases = [tool["function"]["name"] for tool in sent["tools"]]
            assert len(set(aliases)) == 3 and all(len(alias) <= 64 for alias in aliases)
            assert sent["tool_choice"]["function"]["name"] == aliases[1]
            if kind == "custom":
                assert "[a-z]+" in sent["tools"][1]["function"]["description"]
            mode = "text"
            output = {"type": "function_call_output" if kind == "function" else "custom_tool_call_output", "call_id": call["call_id"], "output": "ok"}
            status, body = post(port, {"model": "fixture", "input": [{"role": "user", "content": "run"}, call, output], "tools": tools})
            assert status == 200
            messages = requests[-1][2]["messages"]
            assert messages[1]["tool_calls"][0]["function"]["name"] == aliases[1]
            assert messages[2]["tool_call_id"] == call["call_id"]
        for kind in ("function", "custom"):
            mode = "namespace_" + kind
            leaf = {"type": kind, "name": "run", "description": "restored tool", "parameters": {"type": "object"}}
            if kind == "custom":
                leaf["format"] = {"type": "text"}
            declaration = {"type": "additional_tools", "role": "developer", "tools": [{"type": "namespace", "name": "restored", "tools": [leaf]}]}
            history = [declaration, {"role": "user", "content": "continue the restored conversation"}]
            status, body = post(port, {"model": "fixture", "input": history, "stream": True})
            reply, events = completed(body)
            assert status == 200 and reply["status"] == "completed"
            call = reply["output"][0]
            assert call["name"] == "run" and call["namespace"] == "restored"
            mode = "text"
            output = {"type": "function_call_output" if kind == "function" else "custom_tool_call_output", "call_id": call["call_id"], "output": "ok"}
            history.extend([call, output, declaration])
            status, body = post(port, {"model": "fixture", "input": history})
            assert status == 200
            sent = requests[-1][2]
            assert len(sent["tools"]) == 1
            assert [message["role"] for message in sent["messages"]] == ["user", "assistant", "tool"]
            assert sent["messages"][1]["tool_calls"][0]["function"]["name"] == sent["tools"][0]["function"]["name"]
        declarations = {"type": "additional_tools", "role": "developer", "tools": [{"name": "old", "input_schema": {"type": "object", "properties": {}}}, {"type": "function", "function": {"name": "run", "description": "old schema", "parameters": {"type": "object"}}}]}
        status, body = post(port, {"model": "fixture", "input": [declarations, {"role": "user", "content": "hello"}], "tools": [{"type": "function", "name": "run", "description": "current schema", "parameters": {"type": "object"}}]})
        assert status == 200
        sent = requests[-1][2]
        assert len(sent["tools"]) == 2 and sent["tools"][1]["function"]["description"] == "current schema"
        assert "tools" not in sent["messages"][0]
        for bad in ({"type": "additional_tools", "role": "user", "tools": []}, {"type": "additional_tools", "role": "developer", "tools": [{"type": "web_search"}]}, {"type": "additional_tools", "role": "developer", "tools": None}):
            status, body = post(port, {"model": "fixture", "input": [bad]})
            assert status == 400
        mode = "json_fallback"
        status, body = post(port, {"model": "fixture", "input": "hi", "stream": True})
        assert completed(body)[0]["status"] == "completed"
        image = "data:image/png;base64,AA=="
        status, body = post(port, {"model": "fixture", "input": [{"role": "user", "content": [{"type": "input_image", "image_url": image}, {"type": "input_text", "text": "look"}]}]})
        assert status == 200 and requests[-1][2]["messages"][0]["content"][0]["image_url"]["url"] == image
        for kind in ("function", "custom"):
            mode = kind
            tool = {"type": kind, "name": "run", "parameters": {"type": "object"}}
            status, body = post(port, {"model": "fixture", "input": "observe the phone", "tools": [tool]})
            call = json.loads(body)["output"][0]
            second_call = dict(call, id="parallel-item", call_id="parallel-call")
            output_kind = "function_call_output" if kind == "function" else "custom_tool_call_output"
            first_output = {"type": output_kind, "call_id": call["call_id"], "output": [{"type": "input_text", "text": "Phone observation"}, {"type": "input_image", "image_url": image, "detail": "high"}]}
            second_output = {"type": output_kind, "call_id": "parallel-call", "output": [{"type": "input_text", "text": "Second observation"}, {"type": "input_image", "image_url": image}]}
            mode = "text"
            status, body = post(port, {"model": "fixture", "tools": [tool], "input": [{"role": "user", "content": "observe"}, call, second_call, first_output, second_output]})
            assert status == 200
            sent = requests[-1][2]["messages"]
            assert [message["role"] for message in sent] == ["user", "assistant", "tool", "tool", "user"]
            assert len(sent[1]["tool_calls"]) == 2
            assert sent[2]["tool_call_id"] == call["call_id"] and sent[3]["tool_call_id"] == "parallel-call"
            assert "Phone observation" in sent[2]["content"] and "Second observation" in sent[3]["content"]
            assert image not in sent[2]["content"] and image not in sent[3]["content"]
            attached = sent[4]["content"]
            assert attached[1]["type"] == "image_url" and attached[1]["image_url"] == {"url": image, "detail": "high"}
            assert call["call_id"] in attached[0]["text"] and "parallel-call" in attached[2]["text"]
            assert attached[3]["image_url"]["url"] == image
            for ordinary in ("plain text", {"ok": True, "count": 2}, [{"ok": True}], [{"type": "input_text", "text": "text only"}]):
                output = {"type": output_kind, "call_id": call["call_id"], "output": ordinary}
                status, body = post(port, {"model": "fixture", "tools": [tool], "input": [call, output]})
                assert status == 200 and len(requests[-1][2]["messages"]) == 2
            for unsupported in ([{"type": "input_audio", "audio_url": "data:audio/wav;base64,AA=="}], [{"type": "input_image", "file_id": "unresolved-file"}], [{"type": "input_text", "text": "text"}, 1]):
                output = {"type": output_kind, "call_id": call["call_id"], "output": unsupported}
                status, body = post(port, {"model": "fixture", "tools": [tool], "input": [call, output]})
                assert status == 400
        count = len(requests)
        for invalid in ({"tools": [{"type": "web_search"}]}, {"input": [{"type": "function_call_output", "call_id": "missing", "output": "x"}]}, {"previous_response_id": "old"}):
            status, body = post(port, dict({"model": "fixture", "input": "hi"}, **invalid))
            assert status == 400 and "error" in json.loads(body)
        assert len(requests) == count
        status, body = post(port, {"model": "fixture", "input": "hi", "tools": [{"type": "tool_search"}]})
        assert status == 400 and "tool_search" in json.loads(body)["error"]["message"]
        status, body = post(port, {"model": "fixture", "input": "hi", "tools": [{"type": "function", "name": None}]})
        assert status == 400 and "name type NoneType" in json.loads(body)["error"]["message"]
        status, body = post(port, {"model": "fixture", "input": "hi"}, "wrong-key")
        assert status == 401
        for error_mode, expected in (("error", 429), ("redirect", 302)):
            mode = error_mode
            status, body = post(port, {"model": "fixture", "input": "hi"})
            assert status == expected and "fixture-key" not in body
        mode = "length"
        status, body = post(port, {"model": "fixture", "input": "hi", "stream": True})
        assert completed(body)[0]["status"] == "incomplete"
        mode = "truncated_tool"
        status, body = post(port, {"model": "fixture", "input": "run", "tools": [{"type": "custom", "name": "run"}], "stream": True})
        reply, events = completed(body)
        assert reply["status"] == "incomplete" and not reply["output"]
        connection = http.client.HTTPConnection("127.0.0.1", port)
        connection.request("GET", "/health", headers={"Authorization": "Bearer fixture-key"})
        health = connection.getresponse()
        assert health.status == 200 and json.loads(health.read())["ready"]
        connection.close()
        assert all(path == "/v1/chat/completions" and auth == "Bearer fixture-key" for path, auth, _ in requests)
        print("PASS model gateway HTTP fixtures: text, SSE, JSON fallback, function/custom and recursive namespace two-turn pairing, parallel image tool outputs, images, usage, truncation, authentication, unsupported fields/tools, original HTTP errors, no redirects and loopback bypasses invalid inherited proxy, scoped DSH efforts/defaults")
    finally:
        child.terminate()
        child.wait(timeout=5)
        stdout, stderr = child.communicate()
        assert "fixture-key" not in stdout + stderr
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
