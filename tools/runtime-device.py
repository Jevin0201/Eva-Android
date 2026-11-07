"""Run a project-owned diagnostic inside Eva's private Linux rootfs."""
import os,sys,subprocess,shlex,pathlib
adb=os.environ.get('EVA_ADB') or os.path.expandvars(r'%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe')
pkg=os.environ.get('EVA_PACKAGE','ai.eva.android.probe');serial=os.environ.get('EVA_SERIAL','509655c7');base=[adb,'-s',serial]
apk=subprocess.check_output(base+['shell','pm','path',pkg],text=True).strip().removeprefix('package:');lib=apk.rsplit('/',1)[0]+'/lib/arm64';private='/data/user/0/'+pkg+'/files'
# Match Android Context.getFilesDir().getCanonicalFile() when both aliases exist.
# PRoot's emulated hardlinks retain this host prefix in their persistent targets.
canonical='/data/data/'+pkg+'/files'
if subprocess.run(base+['shell','run-as',pkg,'test',canonical,'-ef',private],capture_output=True).returncode==0:
 private=canonical
subprocess.run(base+['shell','run-as',pkg,'ln','-sf',lib+'/liboperit_proot.so','files/proot'],check=True)
args=['run-as',pkg,'env','PROOT_LOADER='+lib+'/liboperit_loader.so','PROOT_TMP_DIR='+private+'/tmp','PATH=/usr/bin:/bin:/usr/sbin:/sbin',private+'/proot','-0','--link2symlink','-r',private+'/alpine','-b','/dev','-b','/proc','-w','/root/eva-workspace','/usr/bin/python3','-']
if os.environ.get('EVA_RUNTIME_PROC','1')=='1':
 subprocess.run(base+['shell','run-as',pkg,'mkdir','-p','files/runtime-bindings'],check=True,capture_output=True)
 release=subprocess.check_output(base+['shell','uname','-r'],text=True).strip()
 subprocess.run(base+['exec-in','run-as',pkg,'tee','files/runtime-bindings/proc-version'],input=('Linux version '+release+' (Eva Android user-space runtime)\n').encode(),check=True,capture_output=True)
 args[-2:-2]=['-b',private+'/runtime-bindings/proc-version:/proc/version']
if os.environ.get('EVA_RUNTIME_IPC')=='1':args[-2:-2]=['--sysvipc']
if os.environ.get('EVA_RUNTIME_TRACE')=='1':args[-2:-2]=['-v','9']
if os.environ.get('EVA_RUNTIME_SHM')=='1':
 subprocess.run(base+['shell','run-as',pkg,'mkdir','-p','files/alpine/tmp/.eva-shm'],check=True)
 args[-2:-2]=['-b',private+'/alpine/tmp/.eva-shm:/dev/shm','-b',private+'/alpine/tmp/.eva-shm:/run/shm']
script=pathlib.Path(sys.argv[1]).read_bytes()
result=subprocess.run(base+['shell',shlex.join(args)],input=script,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=int(os.environ.get('EVA_RUNTIME_TIMEOUT','180')))
sys.stdout.buffer.write(result.stdout);raise SystemExit(result.returncode)
