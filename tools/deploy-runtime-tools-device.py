"""Deploy only the project-owned runtime tools for device regression before packaging."""
import os,subprocess,pathlib
adb=os.environ.get('EVA_ADB') or os.path.expandvars(r'%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe')
base=[adb,'-s',os.environ.get('EVA_SERIAL','509655c7')];pkg='ai.eva.android.probe'
assets=pathlib.Path('probe/assets/office')
pairs=[(assets/'eva-office.py','eva-office.py'),(assets/'eva-render.py','.eva-office/eva-render.py'),(assets/'eva-presentations.py','.eva-office/eva-presentations.py'),(assets/'eva-capabilities.py','.eva-runtime/eva-capabilities.py')]
pairs += [(assets/'eva-android-build.py','.eva-runtime/eva-android-build.py')]
pairs += [(p,'.eva-codex/skills/'+p.relative_to(assets/'skills').as_posix()) for p in (assets/'skills').rglob('*') if p.is_file()]
for source,name in pairs:
 target='files/alpine/root/'+name
 subprocess.run(base+['shell','run-as',pkg,'mkdir','-p',target.rsplit('/',1)[0]],check=True,capture_output=True)
 result=subprocess.run(base+['exec-in','run-as',pkg,'tee',target],input=source.read_bytes(),capture_output=True,check=True)
 copied=subprocess.check_output(base+['exec-out','run-as',pkg,'cat',target])
 if copied!=source.read_bytes():raise RuntimeError('Asset copy mismatch: '+name)
print('PASS deployed',len(pairs),'project-owned runtime assets')
