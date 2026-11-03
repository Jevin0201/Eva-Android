"""Exercise the pinned Codex app-server on the phone, without cloud credentials."""
import json, pathlib, subprocess, shlex, sys
import os, shutil
ADB = os.environ.get('EVA_ADB') or shutil.which('adb') or shutil.which('adb.exe')
if not ADB: raise SystemExit('Set EVA_ADB to your adb executable')
PKG = 'ai.eva.android.probe'
base = subprocess.check_output([ADB, 'shell', 'pm', 'path', PKG], text=True).strip().removeprefix('package:').rsplit('/', 1)[0]
lib = base + '/lib/arm64'
subprocess.run([ADB, 'shell', 'run-as', PKG, 'ln', '-sf', lib+'/liboperit_proot.so', 'files/proot'], check=True)
prefix = ['run-as', PKG, 'env', 'PROOT_LOADER='+lib+'/liboperit_loader.so', 'PROOT_TMP_DIR=/data/user/0/'+PKG+'/files/tmp', 'PATH=/usr/bin:/bin:/usr/sbin:/sbin', '/data/user/0/'+PKG+'/files/proot', '-0', '-r', '/data/user/0/'+PKG+'/files/alpine', '-b', '/dev', '-b', '/proc', '-w', '/root', '/usr/bin/python3']
script = r'''
import subprocess,json,os,time,queue,threading,uuid
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
requests=[]
class Handler(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_POST(self):
  requests.append(json.loads(self.rfile.read(int(self.headers["Content-Length"]))))
  msg={"id":"fixture-message","type":"message","role":"assistant","status":"completed","content":[{"type":"output_text","text":"Fixture response","annotations":[]}]}
  self.send_response(200);self.send_header("Content-Type","text/event-stream");self.end_headers()
  for kind,value in [("response.created",{"response":{"id":"fixture-response","status":"in_progress","output":[]}}),("response.output_item.done",{"output_index":0,"item":msg}),("response.completed",{"response":{"id":"fixture-response","status":"completed","output":[msg],"usage":{"input_tokens":10,"output_tokens":3,"total_tokens":13}}})]:
   self.wfile.write(("event: "+kind+"\ndata: "+json.dumps({"type":kind,**value})+"\n\n").encode());self.wfile.flush()
server=ThreadingHTTPServer(("127.0.0.1",0),Handler)
threading.Thread(target=server.serve_forever,daemon=True).start()
root='/root/eva-provider-switch-check-'+uuid.uuid4().hex
os.makedirs(root)
env={**os.environ,'HOME':'/root','CODEX_HOME':root,'PATH':'/root/eva-kernel/bin:/usr/bin:/bin:/usr/sbin:/sbin'}
defs={n:{'name':n,'base_url':'http://127.0.0.1:'+str(server.server_port)+'/v1','wire_api':'responses','requires_openai_auth':False} for n in ['fixture_a','fixture_b']}
p=subprocess.Popen(['/root/eva-kernel/bin/codex','app-server','-c','cli_auth_credentials_store="ephemeral"','-c','features.apps=false'],env=env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True,bufsize=1)
rows=queue.Queue()
def reader():
 for line in p.stdout:
  try:rows.put(json.loads(line))
  except ValueError:pass
threading.Thread(target=reader,daemon=True).start()
seq=0
def call(method,params):
 global seq
 seq+=1;p.stdin.write(json.dumps({'id':seq,'method':method,'params':params})+'\n');p.stdin.flush();deadline=time.monotonic()+35
 while time.monotonic()<deadline:
  row=rows.get(timeout=max(.1,deadline-time.monotonic()))
  if row.get('id')==seq:
   if 'error' in row:raise RuntimeError(row['error']['message'])
   return row['result']
 raise TimeoutError(method)
try:
 call('initialize',{'clientInfo':{'name':'eva_switch_fixture','version':'1'},'capabilities':{'experimentalApi':True}})
 p.stdin.write(json.dumps({'method':'initialized'})+'\n');p.stdin.flush()
 config={'model_providers':defs}
 call('config/batchWrite',{'edits':[{'keyPath':'model_providers','value':defs,'mergeStrategy':'replace'},{'keyPath':'model_provider','value':'fixture_a','mergeStrategy':'replace'}]})
 a=call('thread/start',{'cwd':'/root/eva-workspace','modelProvider':'fixture_a','model':'fixture-model','config':config,'approvalPolicy':'on-request','sandbox':'read-only','persistExtendedHistory':True,'dynamicTools':[{'name':'fixture_phone_tool','description':'Preserved phone capability fixture','inputSchema':{'type':'object','properties':{}}}]})
 tid=a['thread']['id'];print(json.dumps({'createdProvider':a['modelProvider']}),flush=True)
 turn=call('turn/start',{'threadId':tid,'input':[{'type':'text','text':'Fixture input','text_elements':[]}]})
 while True:
  row=rows.get(timeout=35)
  if row.get('method')=='turn/completed':break
 saved=call('thread/read',{'threadId':tid,'includeTurns':True})
 assert len(saved['thread']['turns'])==1
 call('thread/unsubscribe',{'threadId':tid})
 call('config/batchWrite',{'edits':[{'keyPath':'model_providers','value':defs,'mergeStrategy':'replace'},{'keyPath':'model_provider','value':'fixture_b','mergeStrategy':'replace'}]})
 try:
  call('thread/resume',{'threadId':tid,'modelProvider':'fixture_b','model':'fixture-model','config':config})
  print(json.dumps({'resumeAccepted':True}),flush=True)
 except RuntimeError as e:print(json.dumps({'resumeError':str(e)}),flush=True)
 fork=call('thread/fork',{'threadId':tid,'modelProvider':'fixture_b','model':'fixture-model','config':config})
 assert fork['modelProvider']=='fixture_b'
 assert fork['thread']['id']!=tid
 assert len(fork['thread']['turns'])==1
 assert any(i.get('text')=='Fixture response' for i in fork['thread']['turns'][0]['items'] if i.get('type')=='agentMessage')
 call('turn/start',{'threadId':fork['thread']['id'],'input':[{'type':'text','text':'Continue fixture','text_elements':[]}]})
 while True:
  row=rows.get(timeout=35)
  if row.get('method')=='turn/completed':break
 final=call('thread/read',{'threadId':fork['thread']['id'],'includeTurns':True})
 original=call('thread/read',{'threadId':tid,'includeTurns':True})
 assert len(final['thread']['turns'])==2
 assert len(original['thread']['turns'])==1
 assert len(requests)==2
 assert 'fixture_phone_tool' in json.dumps(requests[-1].get('tools',[]))
 print(json.dumps({'forkProvider':fork['modelProvider'],'newNativeId':True,'turns':len(fork['thread'].get('turns',[])),'continuedTurns':2,'originalUnchanged':True,'dynamicToolsPreserved':True,'result':'PASS'}),flush=True)
finally:
 server.shutdown();p.terminate()
 try:p.wait(timeout=5)
 except subprocess.TimeoutExpired:p.kill()
'''

subprocess.run([ADB,'exec-in','run-as',PKG,'sh','-c','cat > files/alpine/root/check-provider-switch.py'],input=script.encode(),check=True)
r=subprocess.run([ADB,'shell',shlex.join(prefix+['/root/check-provider-switch.py'])],capture_output=True,text=True,timeout=160)
out=pathlib.Path('artifacts/provider-switch');out.mkdir(parents=True,exist_ok=True)
(out/'native-core.txt').write_text(r.stdout+'\n'+r.stderr,encoding='utf-8')
print(r.stdout,r.stderr);raise SystemExit(0 if '"result": "PASS"' in r.stdout else 1)
