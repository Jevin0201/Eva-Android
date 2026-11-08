"""Phone-only pinned-kernel regression with a strict local Responses/compact server.
Input must be an explicitly prepared, non-destructive projected rollout backup.
"""
import json,os,pathlib,queue,subprocess,threading,time,uuid,shutil
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
root=pathlib.Path('/root/eva-history-wire-check');paths=list((root/'projected').glob('rollout-*.jsonl'));assert len(paths)==1
source=paths[0];meta=json.loads(source.read_text().splitlines()[0])['payload'];requests=[]
class Handler(BaseHTTPRequestHandler):
 def log_message(self,*a):pass
 def do_POST(self):
  body=json.loads(self.rfile.read(int(self.headers['Content-Length'])));items=body.get('input',[]);items=items if isinstance(items,list)else[]
  invalid=[i.get('type') for i in items if isinstance(i,dict) and i.get('type') in ['function_call','custom_tool_call'] and i.get('id') and not i['id'].startswith('fc_' if i['type']=='function_call'else'ctc_')]
  requests.append({'path':self.path,'items':len(items),'toolResults':sum(i.get('type')in ['function_call_output','custom_tool_call_output']for i in items),'invalidIDs':invalid})
  if invalid:
   payload=json.dumps({'error':{'message':'fixture invalid_id_prefix: expected fc_/ctc_'}}).encode();self.send_response(400);self.send_header('Content-Length',str(len(payload)));self.end_headers();self.wfile.write(payload);return
  item={'id':'msg_'+uuid.uuid4().hex,'type':'message','role':'assistant','status':'completed','content':[{'type':'output_text','text':'HISTORY_WIRE_OK','annotations':[]}]}
  response={'id':'resp_'+uuid.uuid4().hex,'object':'response','status':'completed','output':[item],'usage':{'input_tokens':10,'output_tokens':3,'total_tokens':13}}
  if self.path.endswith('/compact'):
   self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(json.dumps({'output':[item],'usage':response['usage']}).encode());return
  self.send_response(200);self.send_header('Content-Type','text/event-stream');self.end_headers()
  for kind,data in [('response.created',{'response':{**response,'status':'in_progress','output':[]}}),('response.output_item.done',{'output_index':0,'item':item}),('response.completed',{'response':response})]:
   self.wfile.write(('event: '+kind+'\ndata: '+json.dumps({'type':kind,**data})+'\n\n').encode());self.wfile.flush()
server=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
home=root/('kernel-home-'+uuid.uuid4().hex[:12]);home.mkdir(exist_ok=True);env={**os.environ,'CODEX_HOME':str(home),'HOME':'/root','OPENAI_API_KEY':'local-fixture-only','NO_PROXY':'127.0.0.1,localhost'}
p=subprocess.Popen(['/root/eva-kernel/bin/codex','app-server','-c','cli_auth_credentials_store="ephemeral"','-c','features.apps=false'],env=env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True,bufsize=1)
rows=queue.Queue();seq=0
threading.Thread(target=lambda:[rows.put(json.loads(line))for line in p.stdout],daemon=True).start()
def rpc(method,params):
 global seq
 seq+=1;p.stdin.write(json.dumps({'id':seq,'method':method,'params':params})+'\n');p.stdin.flush();deadline=time.monotonic()+40
 while time.monotonic()<deadline:
  row=rows.get(timeout=max(.1,deadline-time.monotonic()))
  if row.get('id')==seq:
   if 'error'in row:raise RuntimeError(row['error'])
   return row.get('result',{})
 raise TimeoutError(method)
def wait_done(tid,compact=False):
 deadline=time.monotonic()+45;seen=False
 while time.monotonic()<deadline:
  row=rows.get(timeout=max(.1,deadline-time.monotonic()));params=row.get('params',{});method=row.get('method','')
  if params.get('threadId')!=tid:continue
  if method=='error':raise RuntimeError(params.get('error'))
  if compact and method=='item/completed' and params.get('item',{}).get('type')=='contextCompaction':return
  if method=='turn/completed':
   if params['turn']['status']!='completed':raise RuntimeError(params['turn'].get('error'))
   if not compact:return
 raise TimeoutError('completion')
try:
 rpc('initialize',{'clientInfo':{'name':'eva_history_wire_fixture','version':'1'},'capabilities':{'experimentalApi':True}});p.stdin.write('{"method":"initialized","params":{}}\n');p.stdin.flush()
 destination=home/'sessions/2026/11/08'/source.name;destination.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,destination)
 rpc('thread/list',{'useStateDbOnly':False,'limit':100})
 definition={'name':'strict local fixture','base_url':'http://127.0.0.1:'+str(server.server_port)+'/v1','wire_api':'responses','requires_openai_auth':False,'request_max_retries':0,'stream_max_retries':0,'supports_websockets':False}
 config={'model_providers':{'fixture_wire':definition},'web_search':'disabled'}
 rpc('config/batchWrite',{'edits':[{'keyPath':'model_providers','value':{'fixture_wire':definition},'mergeStrategy':'replace'},{'keyPath':'model_provider','value':'fixture_wire','mergeStrategy':'replace'}]})
 fork=rpc('thread/fork',{'threadId':meta['id'],'modelProvider':'fixture_wire','model':'fixture-model','config':config,'cwd':'/root/eva-workspace','approvalPolicy':'never','sandbox':'read-only','persistExtendedHistory':True});tid=fork['thread']['id']
 rpc('turn/start',{'threadId':tid,'model':'fixture-model','input':[{'type':'text','text':'Return HISTORY_WIRE_OK without executing any tools.','text_elements':[]}],'approvalPolicy':'never','sandboxPolicy':{'type':'readOnly'}});wait_done(tid)
 assert requests and any(r['toolResults']>0 for r in requests),requests
 rpc('thread/compact/start',{'threadId':tid});wait_done(tid,True)
 assert len(requests)>=2,requests
 assert not any(r['invalidIDs']for r in requests),requests
 print(json.dumps({'passed':True,'kernel':'phone pinned Codex','requests':requests,'checks':['real projected user history replay','prior tool results retained','strict item ID validation','compaction completed','no tools executed','original history untouched']},ensure_ascii=False,indent=2))
finally:p.terminate();server.shutdown()
