"""Build Eva from source on macOS. A base APK supplies ignored voice/native dependencies.
Without the original keystore this emits an unsigned candidate and never installs it.
"""
import argparse,hashlib,json,os,pathlib,shutil,subprocess,zipfile
p=argparse.ArgumentParser();p.add_argument('--jdk',required=True);p.add_argument('--sdk',required=True);p.add_argument('--base-apk',required=True);p.add_argument('--keystore');p.add_argument('--package');p.add_argument('--release',action='store_true');p.add_argument('--keystore-pass-file');p.add_argument('--signing-lineage');a=p.parse_args()
root=pathlib.Path(__file__).resolve().parents[1];os.chdir(root);jdk=pathlib.Path(a.jdk).resolve();sdk=pathlib.Path(a.sdk).resolve();bt=next(sdk.glob('*/lib/apksigner.jar')).parent.parent;platform=next(sdk.glob('*/android.jar'));out=root/('probe/build/macos-'+a.package if a.package else ('probe/build/macos-release' if a.release else 'probe/build/macos'));out.mkdir(parents=True,exist_ok=True)
# Serialize builds sharing this checkout, including runs started by another chat.
import fcntl
build_lock=(root/'probe/build/.macos-build.lock').open('a')
fcntl.flock(build_lock,fcntl.LOCK_EX)
def source_manifest():
 paths=[root/'probe/AndroidManifest.xml',root/'LICENSE.md',root/'probe/voice-keywords.txt',root/'research/runtime-provenance.json',pathlib.Path(__file__).resolve()]
 for folder in ['probe/src','probe/third_party','probe/assets','probe/res','probe/libs']:
  paths.extend(path for path in (root/folder).rglob('*') if path.is_file())
 return {str(path.relative_to(root)):hashlib.sha256(path.read_bytes()).hexdigest() for path in sorted(paths)}
source_before=source_manifest()
env=dict(os.environ,JAVA_HOME=str(jdk));env['PATH']=str(jdk/'bin')+os.pathsep+env.get('PATH','')
def run(*cmd):subprocess.run(list(map(str,cmd)),env=env,check=True)
for name in ['aapt2','zipalign','apksigner','d8']:(bt/name).chmod(0o755)
assets=out/'assets';shutil.rmtree(assets,ignore_errors=True);assets.mkdir();native={}
with zipfile.ZipFile(a.base_apk) as z:
 for name in z.namelist():
  if name.startswith('assets/voice/') and not name.endswith('/'):
   relative=pathlib.PurePosixPath(name).relative_to('assets');assert '..' not in relative.parts
   target=assets.joinpath(*relative.parts);target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(z.read(name))
  if name.startswith('lib/arm64-v8a/') and name.endswith('.so'):native[name]=z.read(name)
if not native or not list((assets/'voice').rglob('*.onnx')):raise RuntimeError('Base APK lacks native/voice dependencies')
# A prior APK may carry an obsolete PRoot even when its UI version is recent.
provenance=json.loads((root/'research/runtime-provenance.json').read_text(encoding='utf-8'))
for entry in provenance['files']:
 name='lib/arm64-v8a/'+entry['name']
 local=root/'probe/native'/name
 body=local.read_bytes() if local.is_file() else native.get(name,b'')
 if hashlib.sha256(body).hexdigest()!=entry['sha256'].lower():
  raise RuntimeError('Runtime dependency differs from pinned source build: '+name+'; supply the current native libraries or a matching base APK')
 native[name]=body
shutil.copytree(root/'probe/assets',assets,dirs_exist_ok=True);shutil.copyfile(root/'LICENSE.md',assets/'EVA_LICENSE.md');shutil.copyfile(root/'probe/voice-keywords.txt',assets/'voice/kws/keywords.txt')
classes=out/'classes';shutil.rmtree(classes,ignore_errors=True);classes.mkdir()
libs=list((root/'probe/libs').glob('*.jar'));cp=os.pathsep.join(map(str,[platform,*libs]));sources=list((root/'probe/src').glob('*.java'))+list((root/'probe/third_party').rglob('*.java'))
run(jdk/'bin/javac','-encoding','UTF-8','--release','8','-classpath',cp,'-d',classes,*sources)
run(jdk/'bin/jar','cf',out/'classes.jar','-C',classes,'.');run(bt/'d8','--lib',platform,'--min-api','28','--output',out,out/'classes.jar',*libs)
manifest=root/'probe/AndroidManifest.xml'
if a.package or a.release:
 import re,xml.etree.ElementTree as ET
 if a.package and not re.fullmatch(r'[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+',a.package):raise RuntimeError('Invalid package')
 tree=ET.parse(manifest);document=tree.getroot();original=document.get('package');target_package=a.package or original;namespace='{http://schemas.android.com/apk/res/android}'
 for node in document.iter():
  name=node.get(namespace+'name','')
  if name.startswith('.'):node.set(namespace+'name',original+name)
  authority=node.get(namespace+'authorities','')
  if authority:node.set(namespace+'authorities',authority.replace(original+'.',target_package+'.'))
  if node.tag=='instrumentation':node.set(namespace+'targetPackage',target_package)
 if a.release:
  application=document.find('application');application.set(namespace+'debuggable','false');application.set(namespace+'label','Eva')
  for node in list(document.findall('instrumentation')):document.remove(node)
  for node in list(application):
   if node.get(namespace+'name','').rsplit('.',1)[-1] in ['AttachmentImportCheck$FixtureProvider','PhoneFixtureActivity','DesktopStreamFixtureActivity']:application.remove(node)
 document.set('package',target_package);manifest=out/'AndroidManifest.xml';tree.write(manifest,encoding='utf-8')
run(bt/'aapt2','compile' ,'--dir',root/'probe/res','-o',out/'resources.zip');run(bt/'aapt2','link','-0','onnx','-0','gz','-I',platform,'--manifest',manifest,out/'resources.zip','-A',assets,'-o',out/'base.apk')
shutil.copyfile(out/'base.apk',out/'un-aligned.apk')
with zipfile.ZipFile(out/'un-aligned.apk','a') as z:
 z.write(out/'classes.dex','classes.dex')
 for name,body in native.items():z.writestr(name,body)
run(bt/'zipalign','-f','4',out/'un-aligned.apk',out/'eva-upgrade-unsigned.apk')
source_after=source_manifest()
if source_before!=source_after:raise RuntimeError('Source changed during build; the candidate has not been signed. Rerun after the concurrent edits finish.')
(out/'build-source-manifest.json').write_text(json.dumps(source_after,ensure_ascii=False,indent=2),encoding='utf-8')
if a.keystore:
 if a.release and not a.keystore_pass_file:raise RuntimeError('Release signing requires --keystore-pass-file')
 password='file:'+str(pathlib.Path(a.keystore_pass_file).resolve()) if a.keystore_pass_file else 'pass:android'
 signing=[]
 if a.signing_lineage:signing=['--lineage',str(pathlib.Path(a.signing_lineage).resolve()),'--rotation-min-sdk-version','28','--v1-signing-enabled','false','--v2-signing-enabled','false']
 run(bt/'apksigner','sign','--ks',a.keystore,'--ks-pass',password,*signing,'--out',out/'eva-upgrade.apk',out/'eva-upgrade-unsigned.apk');run(bt/'apksigner','verify',out/'eva-upgrade.apk');print(out/'eva-upgrade.apk')
else:print('UNSIGNED, NOT INSTALLED:',out/'eva-upgrade-unsigned.apk')
