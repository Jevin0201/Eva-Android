import subprocess,pathlib,json,time,shlex
import os, shutil
adb = os.environ.get('EVA_ADB') or shutil.which('adb') or shutil.which('adb.exe')
if not adb: raise SystemExit('Set EVA_ADB to your adb executable')
pkg='ai.eva.android.probe'
base=subprocess.check_output([adb,'shell','pm','path',pkg],text=True).strip().removeprefix('package:').rsplit('/',1)[0]
lib=base+'/lib/arm64'
subprocess.run([adb,'shell','run-as',pkg,'ln','-sf',lib+'/liboperit_proot.so','files/proot'],check=True)
prefix=[adb,'shell','run-as',pkg,'env','PROOT_LOADER='+lib+'/liboperit_loader.so','PROOT_TMP_DIR=/data/user/0/'+pkg+'/files/tmp','PATH=/usr/bin:/bin:/usr/sbin:/sbin','/data/user/0/'+pkg+'/files/proot','-0','-r','/data/user/0/'+pkg+'/files/alpine','-b','/dev','-b','/proc','-w','/root','/usr/bin/python3']
r=subprocess.run(prefix+['/root/test_task_runner.py'],capture_output=True,text=True,timeout=30)
print(r.stdout,r.stderr);assert r.returncode==0
start=time.monotonic();p=subprocess.Popen([adb,'shell',shlex.join(prefix[2:]+['/root/eva-command.py','printf FIRST; sleep 2; printf SECOND','/root/unused-test-cancel'])],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
events=[];first=None
for line in p.stdout:
 e=json.loads(line);events.append(e)
 if e['type']=='output' and 'FIRST' in e.get('text',''):first=time.monotonic()-start
assert p.wait(timeout=10)==0
assert first is not None and first<2,first
assert any(e.get('state')=='succeeded' and e['type']=='result' for e in events)
report={'context':'ADB run-as, not UI interaction','regression':r.stdout.strip(),'firstOutputSeconds':first,'events':events}
pathlib.Path('artifacts/task-stream-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print('Streaming before command completion passed:',first)
