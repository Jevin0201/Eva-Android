import codecs,base64,json,os,sys
from task_runner import TaskRunner
os.environ['PATH']='/usr/bin:/bin:/usr/sbin:/sbin'
decoders={s:codecs.getincrementaldecoder('utf8')(errors='replace') for s in ('stdout','stderr')}
def update(event):
 if event['type']=='output':
  stream=event['stream']
  text=decoders[stream].decode(base64.b64decode(event['base64']))
  print(json.dumps({'type':'output','stream':stream,'text':text},ensure_ascii=False),flush=True)
 else:
  print(json.dumps(event,ensure_ascii=False),flush=True)
r=TaskRunner('/root/eva-tasks')
result=r.run(['/bin/sh','-c',sys.argv[1]],'/root/eva-workspace',timeout=max(1,min(300,int(sys.argv[3]))) if len(sys.argv)>3 else 120,cancel_file=sys.argv[2],on_event=update)
for stream,decoder in decoders.items():
 tail=decoder.decode(b'',final=True)
 if tail: print(json.dumps({'type':'output','stream':stream,'text':tail},ensure_ascii=False),flush=True)
print(json.dumps({'type':'result',**result},ensure_ascii=False),flush=True)
sys.exit(0 if result['state']=='succeeded' else 1)
