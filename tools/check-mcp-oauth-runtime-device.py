"""Isolated installed-kernel OAuth fixture. Run through runtime-device.py."""
import base64, hashlib, http.server, json, os, pathlib, queue, subprocess, tempfile, threading, time, urllib.parse, urllib.request

report = {'isolated': True, 'externalNetwork': False}
state = {'grants': [], 'challenge': None, 'token': None, 'tools': 0}

class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass
    def reply(self, value, status=200, headers=None):
        body = json.dumps(value).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        for key, value in (headers or {}).items():
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)
    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        if path.startswith('/.well-known/oauth-protected-resource'):
            return self.reply({'resource': issuer+'/mcp', 'authorization_servers': [issuer], 'scopes_supported': ['mcp:tools']})
        if path.startswith('/.well-known/oauth-authorization-server') or path.startswith('/.well-known/openid-configuration'):
            return self.reply({'issuer': issuer, 'authorization_endpoint': issuer+'/authorize', 'token_endpoint': issuer+'/token', 'registration_endpoint': issuer+'/register', 'response_types_supported': ['code'], 'grant_types_supported': ['authorization_code', 'refresh_token'], 'token_endpoint_auth_methods_supported': ['none'], 'code_challenge_methods_supported': ['S256'], 'scopes_supported': ['mcp:tools']})
        return self.reply({}, 405)
    def do_POST(self):
        body = self.rfile.read(int(self.headers.get('Content-Length', '0')))
        path = urllib.parse.urlparse(self.path).path
        if path == '/register':
            value = json.loads(body)
            return self.reply({**value, 'client_id': 'fixture-client', 'client_id_issued_at': int(time.time())})
        if path == '/token':
            value = urllib.parse.parse_qs(body.decode())
            grant = value.get('grant_type', [''])[0]
            if grant == 'authorization_code':
                verifier = value.get('code_verifier', [''])[0]
                challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b'=').decode()
                if value.get('code') != ['fixture-code'] or challenge != state['challenge']:
                    return self.reply({'error': 'invalid_grant'}, 400)
            elif grant == 'refresh_token':
                if not value.get('refresh_token', [''])[0].startswith('fixture-refresh-'):
                    return self.reply({'error': 'invalid_grant'}, 400)
            else:
                return self.reply({'error': 'unsupported_grant_type'}, 400)
            state['grants'].append(grant)
            index = len(state['grants'])
            state['token'] = 'fixture-access-'+str(index)
            return self.reply({'access_token': state['token'], 'token_type': 'Bearer', 'refresh_token': 'fixture-refresh-'+str(index), 'expires_in': 2 if grant == 'authorization_code' else 3600, 'scope': 'mcp:tools'})
        if path != '/mcp':
            return self.reply({}, 404)
        if self.headers.get('Authorization') != 'Bearer '+str(state['token']) or state['token'] is None:
            return self.reply({'error': 'unauthorized'}, 401, {'WWW-Authenticate': 'Bearer resource_metadata="'+issuer+'/.well-known/oauth-protected-resource", scope="mcp:tools"'})
        value = json.loads(body)
        if 'id' not in value:
            return self.reply({}, 202)
        method = value.get('method')
        if method == 'initialize':
            result = {'protocolVersion': value.get('params', {}).get('protocolVersion', '2025-03-26'), 'capabilities': {'tools': {}}, 'serverInfo': {'name': 'eva-oauth-fixture', 'version': '1'}}
        elif method == 'tools/list':
            state['tools'] += 1
            result = {'tools': [{'name': 'fixture_echo', 'description': 'Isolated fixture echo', 'inputSchema': {'type': 'object', 'properties': {}}}]}
        elif method == 'tools/call':
            result = {'content': [{'type': 'text', 'text': 'EVA_OAUTH_TOOL_OK'}]}
        else:
            result = {}
        return self.reply({'jsonrpc': '2.0', 'id': value['id'], 'result': result})

server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
issuer = 'http://127.0.0.1:'+str(server.server_port)
server_thread = threading.Thread(target=server.serve_forever, name='oauth-fixture-http')
server_thread.start()
with tempfile.TemporaryDirectory(prefix='eva-mcp-oauth-', dir='/tmp') as folder:
    home = pathlib.Path(folder)
    (home/'config.toml').write_text('mcp_oauth_credentials_store = "file"\n[mcp_servers.oauth_fixture]\nurl = '+json.dumps(issuer+'/mcp')+'\nenabled = true\n')
    environment = {**os.environ, 'HOME': '/root', 'CODEX_HOME': str(home), 'CODEX_SQLITE_HOME': str(home), 'NO_PROXY': '*', 'no_proxy': '*'}
    for key in ['OPENAI_API_KEY', 'CODEX_API_KEY', 'HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy']:
        environment.pop(key, None)
    process = subprocess.Popen(['/root/eva-kernel/bin/codex', 'app-server', '-c', 'analytics.enabled=false', '-c', 'features.apps=false', '-c', 'features.plugins=false'], env=environment, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
    messages = queue.Queue()
    def reader():
        for line in process.stdout:
            try:
                messages.put(json.loads(line))
            except ValueError:
                pass
    reader_thread = threading.Thread(target=reader, name='oauth-fixture-rpc-reader')
    reader_thread.start()
    counter = 0
    notifications = []
    def rpc(method, params, timeout=40):
        global counter
        counter += 1
        identifier = counter
        process.stdin.write(json.dumps({'id': identifier, 'method': method, 'params': params})+'\n')
        process.stdin.flush()
        deadline = time.monotonic()+timeout
        while time.monotonic() < deadline:
            value = messages.get(timeout=max(.1, deadline-time.monotonic()))
            if value.get('id') == identifier and 'method' not in value:
                if 'error' in value:
                    raise RuntimeError(method+': '+str(value['error']))
                return value.get('result', {})
            notifications.append(value)
        raise TimeoutError(method)
    try:
        rpc('initialize', {'clientInfo': {'name': 'eva_oauth_fixture', 'version': '1'}, 'capabilities': {'experimentalApi': True}})
        process.stdin.write(json.dumps({'method': 'initialized', 'params': {}})+'\n')
        process.stdin.flush()
        login = rpc('mcpServer/oauth/login', {'name': 'oauth_fixture', 'timeoutSecs': 30})
        query = urllib.parse.parse_qs(urllib.parse.urlparse(login['authorizationUrl']).query)
        state['challenge'] = query.get('code_challenge', [''])[0]
        report['pkceS256'] = query.get('code_challenge_method') == ['S256'] and bool(state['challenge'])
        redirect = query['redirect_uri'][0]
        callback = redirect+'?'+urllib.parse.urlencode({'code': 'fixture-code', 'state': query['state'][0], 'iss': issuer})
        with urllib.request.urlopen(callback, timeout=10) as response:
            report['callbackHTTP'] = response.status
        deadline = time.monotonic()+15
        while time.monotonic() < deadline:
            event = messages.get(timeout=max(.1, deadline-time.monotonic()))
            notifications.append(event)
            if event.get('method') == 'mcpServer/oauthLogin/completed':
                report['loginSuccess'] = event['params'].get('success')
                break
        rpc('config/mcpServer/reload', None)
        authenticated = rpc('mcpServerStatus/list', {'serverName': 'oauth_fixture', 'detail': 'toolsAndAuthOnly', 'limit': 100})
        report['afterLogin'] = [{'name': row.get('name'), 'authStatus': row.get('authStatus'), 'runtimeStatus': row.get('runtimeStatus'), 'tools': list(row.get('tools', {}))} for row in authenticated.get('data', [])]
        time.sleep(3)
        rpc('config/mcpServer/reload', None)
        rpc('mcpServerStatus/list', {'serverName': 'oauth_fixture', 'detail': 'toolsAndAuthOnly', 'limit': 100})
        report['refreshObserved'] = 'refresh_token' in state['grants']
        logout = subprocess.run(['/root/eva-kernel/bin/codex', '-c', 'analytics.enabled=false', 'mcp', 'logout', '--', 'oauth_fixture'], env=environment, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=30)
        report['logoutExit'] = logout.returncode
        rpc('config/mcpServer/reload', None)
        unauthenticated = rpc('mcpServerStatus/list', {'serverName': 'oauth_fixture', 'detail': 'toolsAndAuthOnly', 'limit': 100})
        report['afterLogout'] = [{'authStatus': row.get('authStatus'), 'runtimeStatus': row.get('runtimeStatus')} for row in unauthenticated.get('data', [])]
        cancel_login = rpc('mcpServer/oauth/login', {'name': 'oauth_fixture', 'timeoutSecs': 30})
        cancel_query = urllib.parse.parse_qs(urllib.parse.urlparse(cancel_login['authorizationUrl']).query)
        cancel_callback = cancel_query['redirect_uri'][0]+'?'+urllib.parse.urlencode({'error': 'access_denied', 'state': cancel_query['state'][0], 'iss': issuer})
        try:
            with urllib.request.urlopen(cancel_callback, timeout=10) as response:
                report['cancelCallbackHTTP'] = response.status
        except urllib.error.HTTPError as response:
            report['cancelCallbackHTTP'] = response.code
            response.close()
        deadline = time.monotonic()+15
        while time.monotonic() < deadline:
            event = messages.get(timeout=max(.1, deadline-time.monotonic()))
            if event.get('method') == 'mcpServer/oauthLogin/completed':
                report['cancelled'] = event['params'].get('success') is False
                break
        report['grants'] = state['grants']
        report['toolDiscoveryCount'] = state['tools']
    except Exception as error:
        report['error'] = str(error)
    finally:
        process.stdin.close()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
        report['appServerExit'] = process.poll()
        server.shutdown()
        server.server_close()
        server_thread.join(timeout=5)
        reader_thread.join(timeout=5)
        process.stdout.close()
        report['remainingThreads'] = [thread.name for thread in threading.enumerate() if thread is not threading.main_thread()]
print(json.dumps(report, ensure_ascii=False), flush=True)

raise SystemExit(0 if report.get('loginSuccess') and report.get('cancelled') and report.get('refreshObserved') and report.get('logoutExit') == 0 and state['tools'] > 0 and any(row.get('authStatus') == 'notLoggedIn' for row in report.get('afterLogout', [])) else 1)
