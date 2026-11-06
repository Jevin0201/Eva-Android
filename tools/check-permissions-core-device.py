"""Isolated real Android kernel + local Responses fixture, no account credentials."""
import json
import pathlib
import shlex
import subprocess

ADB = r'C:/Users/Jevin/AppData/Local/Eva/Tools/android/platform-tools/adb.exe'
PKG = 'ai.eva.android.probe'
base = subprocess.check_output([ADB, 'shell', 'pm', 'path', PKG], text=True).strip().removeprefix('package:').rsplit('/', 1)[0]
lib = base + '/lib/arm64'
link = 'files/tmp/eva-permissions-proot-fixture'
subprocess.run([ADB, 'shell', 'run-as', PKG, 'ln', '-s', lib+'/liboperit_proot.so', link], check=True)
prefix = ['run-as', PKG, 'env', 'PROOT_LOADER='+lib+'/liboperit_loader.so',
          'PROOT_TMP_DIR=/data/user/0/'+PKG+'/files/tmp', 'PATH=/usr/bin:/bin:/usr/sbin:/sbin',
          '/data/user/0/'+PKG+'/'+link, '-0', '-r', '/data/user/0/'+PKG+'/files/alpine',
          '-b', '/dev', '-b', '/proc', '-w', '/root', '/usr/bin/python3', '-']
script = r'''
import subprocess,json,os,time,queue,threading,uuid,pathlib,shutil
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
root=pathlib.Path('/root/eva-permission-check-'+uuid.uuid4().hex)
root.mkdir()
reports=[]
def scenario(name,approval,sandbox,decision):
 home=root/name;home.mkdir();marker=home/'disposable-marker';marker.mkdir()
 calls=[];approvals=[];outputs=[];toolnames=[]
 class Handler(BaseHTTPRequestHandler):
  def log_message(self,*args):pass
  def do_POST(self):
   body=self.rfile.read(int(self.headers['Content-Length']))
   if self.headers.get('content-encoding')=='gzip':
    import gzip
    body=gzip.decompress(body)
   data=json.loads(body);calls.append(data)
   toolnames.extend(t.get('name','') for t in data.get('tools',[]))
   outputs.extend(row.get('output') for row in data.get('input',[]) if row.get('type') in ['function_call_output','custom_tool_call_output'])
   item={'type':'function_call','call_id':'fixture-remove','name':'exec_command','arguments':json.dumps({'cmd':'rm -rf -- '+str(marker),'max_output_tokens':200,'yield_time_ms':1000})} if len(calls)==1 else {'type':'message','role':'assistant','content':[{'type':'output_text','text':'Fixture complete.'}]}
   rid='response-'+str(len(calls));events=[{'type':'response.created','response':{'id':rid}},{'type':'response.output_item.done','item':item},{'type':'response.completed','response':{'id':rid,'usage':{'input_tokens':0,'output_tokens':0,'total_tokens':0}}}]
   self.send_response(200);self.send_header('Content-Type','text/event-stream');self.end_headers()
   for event in events:self.wfile.write(('data: '+json.dumps(event)+'\n\n').encode());self.wfile.flush()
 server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
 threading.Thread(target=server.serve_forever,daemon=True).start()
 config='model_provider = "fixture"\nmodel = "gpt-5.4"\n[features]\ncode_mode = false\n[model_providers.fixture]\nname = "Local fixture"\nbase_url = "http://127.0.0.1:'+str(server.server_port)+'/v1"\nwire_api = "responses"\nrequires_openai_auth = false\n'
 (home/'config.toml').write_text(config)
 env={**os.environ,'HOME':'/root','CODEX_HOME':str(home),'CODEX_SQLITE_HOME':str(home),'OPENAI_API_KEY':'','PATH':'/root/eva-kernel/bin:/usr/bin:/bin:/usr/sbin:/sbin'}
 p=subprocess.Popen(['/root/eva-kernel/bin/codex','app-server','-c','features.code_mode=false','-c','features.apps=false','-c','cli_auth_credentials_store="file"'],env=env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True,bufsize=1)
 rows=queue.Queue()
 def read():
  for line in p.stdout:
   try:rows.put(json.loads(line))
   except ValueError:pass
 threading.Thread(target=read,daemon=True).start()
 seq=0;seen=[]
 def write(value):p.stdin.write(json.dumps(value)+'\n');p.stdin.flush()
 def nextrow(deadline):
  row=rows.get(timeout=max(.1,deadline-time.monotonic()))
  if row.get('method') in ['item/commandExecution/requestApproval','item/fileChange/requestApproval']:
   approvals.append({'method':row['method'],'threadId':row['params'].get('threadId'),'turnId':row['params'].get('turnId'),'availableDecisions':row['params'].get('availableDecisions')})
   write({'id':row['id'],'result':{'decision':decision}})
  if row.get('method')=='turn/completed':seen.append(row)
  return row
 def call(method,params):
  nonlocal seq
  seq+=1;ident=seq;write({'id':ident,'method':method,'params':params});deadline=time.monotonic()+35
  while time.monotonic()<deadline:
   row=nextrow(deadline)
   if row.get('id')==ident and 'method' not in row:
    if 'error' in row:raise RuntimeError(row['error'])
    return row['result']
  raise TimeoutError(method)
 try:
  call('initialize',{'clientInfo':{'name':'eva_permissions_fixture','version':'1'},'capabilities':{'experimentalApi':True}});write({'method':'initialized'})
  result=call('thread/start',{'cwd':str(home),'model':'gpt-5.4','modelProvider':'fixture','approvalPolicy':approval,'approvalsReviewer':'user','sandbox':sandbox,'ephemeral':True})
  tid=result['thread']['id'];policy={'type':'dangerFullAccess'} if sandbox=='danger-full-access' else {'type':'readOnly'}
  call('turn/start',{'threadId':tid,'input':[{'type':'text','text':'Run the isolated fixture command.'}],'approvalPolicy':approval,'approvalsReviewer':'user','sandboxPolicy':policy})
  deadline=time.monotonic()+40
  while not seen and time.monotonic()<deadline:nextrow(deadline)
  report={'scenario':name,'approvalPolicy':result.get('approvalPolicy'),'sandbox':result.get('sandbox'),'completed':bool(seen),'turnStatus':seen[-1]['params']['turn']['status'] if seen else None,'approvals':approvals,'markerRemoved':not marker.exists(),'modelRequests':len(calls),'toolAvailable':'exec_command' in toolnames,'outputs':outputs}
  reports.append(report);print(json.dumps(report),flush=True)
 finally:
  p.terminate()
  try:p.wait(timeout=5)
  except subprocess.TimeoutExpired:p.kill();p.wait()
  server.shutdown();server.server_close()
try:
 for args in [('baseline-never','never','danger-full-access','decline'),('full-accept','on-request','danger-full-access','accept'),('manual-decline','on-request','danger-full-access','decline'),('read-only','never','read-only','decline')]:
  try:scenario(*args)
  except Exception as error:reports.append({'scenario':args[0],'error':str(error)});print(json.dumps(reports[-1]),flush=True)
 print(json.dumps({'reports':reports,'fixtureRoot':str(root)}),flush=True)
 assert len(reports)==4 and all(row.get('completed') and row.get('toolAvailable') for row in reports)
 assert not reports[0]['approvals'] and not reports[0]['markerRemoved']
 assert reports[1]['markerRemoved'] and len(reports[1]['approvals'])==1
 assert not reports[2]['markerRemoved'] and len(reports[2]['approvals'])==1
 assert not reports[3]['markerRemoved'] and not reports[3]['approvals']
 print(json.dumps({'result':'PASS','scope':'real kernel command approval and read-only policy; Java host auto-response and fileChange not exercised'}),flush=True)
finally:
 resolved=root.resolve()
 assert resolved.parent==pathlib.Path('/root') and resolved.name.startswith('eva-permission-check-') and len(resolved.name)==len('eva-permission-check-')+32
 shutil.rmtree(resolved)
 print(json.dumps({'temporaryPhoneDirectoryRemoved':True}),flush=True)
'''
try:
    result = subprocess.run([ADB, 'shell', shlex.join(prefix)], input=script, capture_output=True, text=True, timeout=230)
finally:
    subprocess.run([ADB, 'shell', 'run-as', PKG, 'rm', '--', link], check=True)
out = pathlib.Path('artifacts/permissions')
out.mkdir(parents=True, exist_ok=True)
(out/'native-kernel-fixture.txt').write_text(result.stdout+'\n'+result.stderr, encoding='utf-8')
print(result.stdout, result.stderr)
raise SystemExit(result.returncode)
