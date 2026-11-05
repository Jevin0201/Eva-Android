"""Build Eva from source on macOS. A base APK supplies ignored voice/native dependencies.
Without the original keystore this emits an unsigned candidate and never installs it.
"""
import argparse,os,pathlib,shutil,subprocess,zipfile
p=argparse.ArgumentParser();p.add_argument('--jdk',required=True);p.add_argument('--sdk',required=True);p.add_argument('--base-apk',required=True);p.add_argument('--keystore');a=p.parse_args()
root=pathlib.Path(__file__).resolve().parents[1];os.chdir(root);jdk=pathlib.Path(a.jdk).resolve();sdk=pathlib.Path(a.sdk).resolve();bt=next(sdk.glob('*/lib/apksigner.jar')).parent.parent;platform=next(sdk.glob('*/android.jar'));out=root/'probe/build/macos';out.mkdir(parents=True,exist_ok=True)
env=dict(os.environ,JAVA_HOME=str(jdk));env['PATH']=str(jdk/'bin')+os.pathsep+env.get('PATH','')
def run(*cmd):subprocess.run(list(map(str,cmd)),env=env,check=True)
for name in ['aapt2','zipalign','apksigner','d8']:(bt/name).chmod(0o755)
assets=out/'assets';assets.mkdir(exist_ok=True);native={}
with zipfile.ZipFile(a.base_apk) as z:
 for name in z.namelist():
  if name.startswith('assets/voice/') and not name.endswith('/'):
   relative=pathlib.PurePosixPath(name).relative_to('assets');assert '..' not in relative.parts
   target=assets.joinpath(*relative.parts);target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(z.read(name))
  if name.startswith('lib/arm64-v8a/') and name.endswith('.so'):native[name]=z.read(name)
if not native or not list((assets/'voice').rglob('*.onnx')):raise RuntimeError('Base APK lacks native/voice dependencies')
shutil.copytree(root/'probe/assets',assets,dirs_exist_ok=True);shutil.copyfile(root/'probe/voice-keywords.txt',assets/'voice/kws/keywords.txt')
classes=out/'classes';shutil.rmtree(classes,ignore_errors=True);classes.mkdir()
libs=list((root/'probe/libs').glob('*.jar'));cp=os.pathsep.join(map(str,[platform,*libs]));sources=list((root/'probe/src').glob('*.java'))+list((root/'probe/third_party').rglob('*.java'))
run(jdk/'bin/javac','-encoding','UTF-8','--release','8','-classpath',cp,'-d',classes,*sources)
run(jdk/'bin/jar','cf',out/'classes.jar','-C',classes,'.');run(bt/'d8','--lib',platform,'--min-api','28','--output',out,out/'classes.jar',*libs)
run(bt/'aapt2','compile','--dir',root/'probe/res','-o',out/'resources.zip');run(bt/'aapt2','link','-0','onnx','-I',platform,'--manifest',root/'probe/AndroidManifest.xml',out/'resources.zip','-A',assets,'-o',out/'base.apk')
shutil.copyfile(out/'base.apk',out/'un-aligned.apk')
with zipfile.ZipFile(out/'un-aligned.apk','a') as z:
 z.write(out/'classes.dex','classes.dex')
 for name,body in native.items():z.writestr(name,body)
run(bt/'zipalign','-f','4',out/'un-aligned.apk',out/'eva-upgrade-unsigned.apk')
if a.keystore:
 run(bt/'apksigner','sign','--ks',a.keystore,'--ks-pass','pass:android','--out',out/'eva-upgrade.apk',out/'eva-upgrade-unsigned.apk');run(bt/'apksigner','verify',out/'eva-upgrade.apk');print(out/'eva-upgrade.apk')
else:print('UNSIGNED, NOT INSTALLED:',out/'eva-upgrade-unsigned.apk')
