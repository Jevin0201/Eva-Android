import base64, json, pathlib, tempfile, threading, time
from task_runner import TaskRunner
root = pathlib.Path(tempfile.mkdtemp(prefix='eva-tasks-'))
r = TaskRunner(root/'tasks')
a = r.run(['python3','-c',"import sys; print('中文输出'); print('ERR',file=sys.stderr)"],root)
assert a['state']=='succeeded'
events=[json.loads(x) for x in (root/'tasks'/a['taskId']/'events.jsonl').read_text().splitlines()]
out=b''.join(base64.b64decode(e['base64']) for e in events if e['type']=='output' and e['stream']=='stdout')
assert '中文输出' in out.decode()
assert r.run(['/bin/sh','-c','exit 7'],root)['exitCode']==7
assert r.run(['sleep','10'],root,timeout=.2)['state']=='timed_out'
flag=root/'cancel'
threading.Timer(.2, lambda: flag.touch()).start()
# A child writes a delayed marker: cancellation must stop the process group.
a=r.run(['/bin/sh','-c','(sleep 1; echo leaked > leaked.txt) & wait'],root, cancel_file=flag)
assert a['state']=='cancelled'
time.sleep(1.2)
assert not (root/'leaked.txt').exists()
b=r.run(['python3','-c',"print('x'*1200000)"],root)
assert b['state']=='succeeded' and b['outputTruncated']
f=root/'tasks'/'interrupted'; f.mkdir(); (f/'state.json').write_text('{"taskId":"interrupted","state":"running"}')
assert r.recover()==['interrupted']
assert r.recover()==[]
print(json.dumps(dict(command=True,utf8=True,stderr=True,nonzero=True,timeout=True,cancelProcessGroup=True,outputLimit=True,recoverWithoutReplay=True)))
