"""Eva's scoped mitmproxy response and transport diagnostics adapter.

Loaded only for the capture selected through PCAPdroid's application filter.
Request headers, cookies, query parameters and request bodies are excluded.
"""
import json
import os
import re
from urllib.parse import urlsplit, urlunsplit

OUTPUT = "__EVA_EVENTS_PATH__"
MAX_BYTES = 12 * 1024 * 1024
SECRET = re.compile(r"token|password|passwd|secret|cookie|authorization|session|credential|api.?key|access.?key|phone|mobile|email|idcard", re.I)


def redact(value, depth=0):
    if depth > 12:
        return "[depth limit]"
    if isinstance(value, dict):
        return {key: "[redacted]" if SECRET.search(key) else redact(item, depth + 1)
                for key, item in list(value.items())[:100]}
    if isinstance(value, list):
        return [redact(item, depth + 1) for item in value[:100]]
    return value


def write(value):
    data = (json.dumps(value, ensure_ascii=False) + "\n").encode()
    size = os.path.getsize(OUTPUT) if os.path.exists(OUTPUT) else 0
    if size + len(data) <= MAX_BYTES:
        with open(OUTPUT, "ab") as stream:
            stream.write(data)


def endpoint(data):
    server = data.context.server
    address = server.address
    return server.sni or (address[0] if address else "unknown")


def tls_failed_client(data):
    write({"type": "tls_client_error", "server": endpoint(data), "error": str(data.conn.error)[:1000]})


def tls_failed_server(data):
    write({"type": "tls_server_error", "server": endpoint(data), "error": str(data.conn.error)[:1000]})


def tls_established_client(data):
    write({"type": "tls_client_ready", "server": endpoint(data)})


def error(flow):
    write({"type": "http_error", "server": flow.request.host, "error": str(flow.error)[:1000]})


def tcp_error(flow):
    address = flow.server_conn.address
    write({"type": "tcp_error", "server": address[0] if address else "unknown", "error": str(flow.error)[:1000]})


def server_connect_error(data):
    address = data.server.address
    write({"type": "tcp_error", "server": address[0] if address else "unknown",
           "error": str(data.server.error)[:1000]})


def server_connected(data):
    address = data.server.address
    write({"type": "server_connected", "server": address[0] if address else "unknown"})


def response(flow):
    mime = flow.response.headers.get("content-type", "")
    body = ""
    if "json" in mime or mime.startswith("text/") or "xml" in mime:
        body = flow.response.get_text(strict=False) or ""
        if "json" in mime:
            try:
                body = json.dumps(redact(json.loads(body)), ensure_ascii=False)
            except (ValueError, TypeError):
                body = "[invalid JSON body retained in HAR]"
    parsed = urlsplit(flow.request.pretty_url)
    safe_url = urlunsplit((parsed.scheme, parsed.hostname or "", parsed.path, "", ""))
    write({"type": "http", "entry": {
        "request": {"url": safe_url, "method": flow.request.method},
        "response": {"status": flow.response.status_code, "content": {
            "mimeType": mime, "text": body[:262144]}}
    }})


def running():
    write({"type": "proxy_ready"})


def done():
    write({"type": "proxy_stopped"})
