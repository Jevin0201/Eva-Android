"""Read and exercise an independently installed Eva package with its own empty initial data."""
import argparse
import json
import os
from pathlib import Path
import shlex
import subprocess
import xml.etree.ElementTree as ET

parser = argparse.ArgumentParser()
parser.add_argument('--package', default='ai.eva.android.bootstrapcheck')
parser.add_argument('--isolated-root', action='store_true')
parser.add_argument('--office', action='store_true', help='Also verify explicitly installed office components; core-only by default')
args = parser.parse_args()
adb = os.environ.get('EVA_ADB', os.path.expandvars(r'%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe'))
pkg = args.package
relative = 'files/distribution-firstinstall-check' if args.isolated_root else 'files'
pref = 'firstinstall-check-eva-runtime-bootstrap.xml' if args.isolated_root else 'eva-runtime-bootstrap.xml'
out = Path('artifacts/bootstrap-fresh-acceptance-isolated' if args.isolated_root else 'artifacts/bootstrap-fresh-acceptance')
out.mkdir(parents=True, exist_ok=True)

def shell(*words, timeout=120):
    return subprocess.check_output([adb, 'shell', shlex.join(list(words))], timeout=timeout)

state = shell('run-as', pkg, 'cat', 'shared_prefs/' + pref)
values = {node.get('name'): node.get('value', node.text) for node in ET.fromstring(state)}
if values.get('ready') != 'true':
    raise RuntimeError('Clean installation did not reach ready: ' + json.dumps(values))
apk = shell('pm', 'path', pkg).decode().strip().removeprefix('package:')
native = apk.rsplit('/', 1)[0] + '/lib/arm64'
private = shell('run-as', pkg, 'readlink', '-f', relative).decode().strip()
script = r'''
import ctypes, json, os, pathlib, runpy, selectors, shutil, subprocess, tempfile, time
assert subprocess.check_output(['node', '-e', 'console.log(6*7)'], text=True).strip() == '42'
import ssl, sqlite3
libc=ctypes.CDLL(None, use_errno=True)
segment=libc.shmget(0,4096,0o1600)
assert segment >= 0, ('sysvipc', ctypes.get_errno())
assert libc.shmctl(segment,0,0) == 0
office_formats=0
if __CHECK_OFFICE__:
 office=runpy.run_path('/root/eva-office.py')
 assert office['status']()['ready']
 result=office['selftest']()
 assert result['passed']
 office_formats=4
testhome=pathlib.Path(tempfile.mkdtemp(prefix='bootstrap-core-',dir='/tmp'))
environment={**os.environ, 'HOME':'/root', 'CODEX_HOME':str(testhome), 'PATH':'/root/eva-kernel/bin:/root/eva-kernel/codex-path:/usr/bin:/bin:/usr/sbin:/sbin'}
child=subprocess.Popen(['/root/eva-kernel/bin/codex','app-server','-c','features.apps=false','-c','features.plugins=false','-c','analytics.enabled=false'],env=environment,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True,bufsize=1)
try:
 selector=selectors.DefaultSelector();selector.register(child.stdout,selectors.EVENT_READ)
 def rpc(identity,method,params):
  child.stdin.write(json.dumps({'id':identity,'method':method,'params':params})+'\n');child.stdin.flush()
  deadline=time.monotonic()+40
  while time.monotonic()<deadline:
   if not selector.select(1):continue
   line=child.stdout.readline()
   if not line:raise RuntimeError('Kernel exited')
   row=json.loads(line)
   if row.get('id')==identity:
    if 'error' in row:raise RuntimeError(str(row['error']))
    return row['result']
  raise TimeoutError(method)
 rpc(1,'initialize',{'clientInfo':{'name':'eva_fresh_install_acceptance','version':'0.0.68'},'capabilities':{'experimentalApi':True}})
 child.stdin.write(json.dumps({'method':'initialized','params':{}})+'\n');child.stdin.flush()
 account=rpc(2,'account/read',{'refreshToken':False})
 assert account.get('account') is None, 'Fresh test unexpectedly contains an account'
 thread=rpc(3,'thread/start',{'cwd':'/root/eva-workspace','ephemeral':True,'approvalPolicy':'on-request','sandbox':'read-only'})
 assert thread.get('thread',{}).get('id')
finally:
 child.terminate()
 try:child.wait(timeout=5)
 except subprocess.TimeoutExpired:child.kill();child.wait()
 shutil.rmtree(testhome)
print(json.dumps({'passed':True,'nodeExecution':42,'pythonSslSqlite':True,'sysvipc':True,'officeFormats':office_formats,'kernelInitialize':True,'ephemeralThread':True,'noImportedAccount':True},ensure_ascii=False),flush=True)
'''.replace('__CHECK_OFFICE__', repr(args.office))
source = out / 'acceptance.py'
source.write_text(script, encoding='utf-8')
remote = '/data/local/tmp/eva-bootstrap-build/acceptance.py'
shell('mkdir', '-p', '/data/local/tmp/eva-bootstrap-build')
subprocess.run([adb, 'push', str(source), remote], check=True, stdout=subprocess.DEVNULL)
shell('run-as', pkg, 'cp', remote, relative + '/alpine/root/.eva-bootstrap-acceptance.py')
shell('run-as', pkg, 'ln', '-sf', native + '/liboperit_proot.so', relative + '/bootstrap-test-proot')
command = ['run-as', pkg, 'env', 'PROOT_LOADER=' + native + '/liboperit_loader.so', 'PROOT_TMP_DIR=' + private + '/tmp',
           'HOME=/root', 'PATH=/usr/bin:/bin:/usr/sbin:/sbin', private + '/bootstrap-test-proot', '-0', '--link2symlink', '--sysvipc',
           '-r', private + '/alpine', '-b', '/dev', '-b', '/proc', '-b', private + '/runtime-bindings/proc-version:/proc/version',
           '-w', '/root/eva-workspace', '/usr/bin/python3', '/root/.eva-bootstrap-acceptance.py']
try:
    result = subprocess.run([adb, 'shell', shlex.join(command)], capture_output=True, timeout=150)
    text = (result.stdout + result.stderr).decode('utf-8', errors='replace')
    (out / 'result.txt').write_text(text, encoding='utf-8')
    print(text)
    if result.returncode or '"noImportedAccount": true' not in text:
        raise RuntimeError('Clean installed runtime acceptance failed')
    (out / 'deployment-state.xml').write_bytes(state)
finally:
    shell('run-as', pkg, 'rm', '-f', relative + '/alpine/root/.eva-bootstrap-acceptance.py', relative + '/bootstrap-test-proot')
    shell('rm', '-f', remote)
