import json, pathlib, subprocess, urllib.request
p=pathlib.Path('/root/eva-workspace'); p.mkdir(exist_ok=True)
f=p/'hello.txt'; f.write_text('Eva 手机运行测试',encoding='utf8'); assert f.read_text(encoding='utf8')=='Eva 手机运行测试'
r=subprocess.run(['node','-e',"const fs=require('fs');fs.writeFileSync('/root/eva-workspace/node.txt','NODE_OK');process.stdout.write('NODE_CHILD_OK')"],capture_output=True,text=True,timeout=15,check=True)
assert r.stdout=='NODE_CHILD_OK'
assert (p/'node.txt').read_text()=='NODE_OK'
subprocess.run(['git','init',str(p)],capture_output=True,check=True)
subprocess.run(['git','-C',str(p),'add','hello.txt','node.txt'],check=True)
r=subprocess.run(['git','-C',str(p),'diff','--cached','--name-only'],capture_output=True,text=True,check=True)
assert set(r.stdout.splitlines())=={'hello.txt','node.txt'}
try:
 subprocess.run(['sleep','10'],timeout=0.3,check=True)
 raise AssertionError('timeout missing')
except subprocess.TimeoutExpired: pass
with urllib.request.urlopen('https://dl-cdn.alpinelinux.org/alpine/v3.22/main/aarch64/',timeout=20) as response:
 assert response.status==200
print(json.dumps(dict(file=True,nodeChild=True,gitStaging=True,childTimeout=True,https=True)))
