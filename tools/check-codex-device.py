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
script = '''import subprocess,json,os,selectors,time
root='/root/eva-codex-check'
os.makedirs(root,exist_ok=True)
env={**os.environ,'HOME':'/root','CODEX_HOME':root,'PATH':'/root/eva-kernel/bin:/usr/bin:/bin:/usr/sbin:/sbin'}
binary='/root/eva-kernel/bin/codex'
version=subprocess.run([binary,'--version'],env=env,capture_output=True,text=True,timeout=30)
assert version.returncode==0,(version.returncode,version.stderr)
print(json.dumps({'version':version.stdout.strip()}),flush=True)
with open(root+'/stderr.log','w') as err:
 p=subprocess.Popen([binary,'app-server'],env=env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=err,text=True,bufsize=1)
 try:
  def send(obj):p.stdin.write(json.dumps(obj)+'\\n');p.stdin.flush()
  sel=selectors.DefaultSelector();sel.register(p.stdout,selectors.EVENT_READ)
  def receive(id):
   deadline=time.monotonic()+40
   while time.monotonic()<deadline:
    if not sel.select(1):continue
    line=p.stdout.readline()
    if not line:raise RuntimeError('app-server exited: '+open(root+'/stderr.log').read()[-1800:])
    row=json.loads(line)
    if row.get('id')==id:
     if 'error' in row:raise RuntimeError(str(row['error']))
     return row['result']
   raise TimeoutError('app-server request timed out')
  send({'id':1,'method':'initialize','params':{'clientInfo':{'name':'eva_android','version':'0.0.11'},'capabilities':{'experimentalApi':True}}})
  result=receive(1);print(json.dumps({'initialize':result}),flush=True)
  send({'method':'initialized','params':{}})
  send({'id':2,'method':'account/read','params':{'refreshToken':False}})
  result=receive(2);print(json.dumps({'accountAvailable':result.get('account') is not None}),flush=True)
  send({'id':3,'method':'thread/start','params':{'cwd':'/root/eva-workspace','ephemeral':True,'approvalPolicy':'on-request','sandbox':'read-only'}})
  result=receive(3);print(json.dumps({'threadCreated':bool(result.get('thread',{}).get('id')),'model':result.get('model')}),flush=True)
 finally:
  p.terminate()
  try:p.wait(timeout=5)
  except subprocess.TimeoutExpired:p.kill()
'''
if '--login' in sys.argv:
 script=script.replace("  send({'id':3,'method':'thread/start'", """  send({'id':10,'method':'account/login/start','params':{'type':'chatgptDeviceCode'}})
  login=receive(10)
  assert login.get('type')=='chatgptDeviceCode' and login.get('loginId') and login.get('userCode')
  assert login.get('verificationUrl','').startswith('https://auth.openai.com/')
  print(json.dumps({'deviceCodeIssued':True,'officialVerificationURL':True}),flush=True)
  send({'id':11,'method':'account/login/cancel','params':{'loginId':login['loginId']}})
  receive(11);print(json.dumps({'loginCancelled':True}),flush=True)
  send({'id':3,'method':'thread/start'""")
subprocess.run([ADB,'exec-in','run-as',PKG,'sh','-c','cat > files/alpine/root/check-codex.py'], input=script.encode(), check=True)
r=subprocess.run([ADB,'shell',shlex.join(prefix+['/root/check-codex.py'])],capture_output=True,text=True,timeout=150)
out=pathlib.Path('artifacts/codex-0.166.0');out.mkdir(parents=True,exist_ok=True)
(out/('login-check.txt' if '--login' in sys.argv else 'device-check.txt')).write_text(r.stdout+'\n'+r.stderr,encoding='utf-8')
print(r.stdout,r.stderr);raise SystemExit(r.returncode)
