"""Build an isolated Android storage regression APK. Never signs or replaces Eva."""
import argparse,os,pathlib,subprocess,zipfile
p=argparse.ArgumentParser();p.add_argument('--jdk',required=True);p.add_argument('--sdk',required=True);args=p.parse_args()
root=pathlib.Path(__file__).resolve().parents[1];os.chdir(root);jdk=pathlib.Path(args.jdk);sdk=pathlib.Path(args.sdk)
bt=next(sdk.glob('*/lib/apksigner.jar')).parent.parent
platform=next(sdk.glob('*/android.jar'));out=root/'probe/build/storage-check';out.mkdir(parents=True,exist_ok=True)
env=dict(os.environ,JAVA_HOME=str(jdk));env['PATH']=str(jdk/'bin')+os.pathsep+env.get('PATH','')
for name in ['aapt2','d8','apksigner']: (bt/name).chmod(0o755)
def run(*cmd):subprocess.run(list(map(str,cmd)),env=env,check=True)
libs=list((root/'probe/libs').glob('*.jar'));classes=root/'probe/build/classes';classes.mkdir(parents=True,exist_ok=True)
cp=os.pathsep.join(map(str,[platform,*libs]))
sources=list((root/'probe/src').glob('*.java'))+list((root/'probe/third_party').rglob('*.java'))+[root/'tools/android-storage-probe/StorageProbeActivity.java',root/'tools/ThreadRecoveryTest.java']
run(jdk/'bin/javac','-encoding','UTF-8','--release','8','-classpath',cp,'-d',classes,*sources)
run(jdk/'bin/jar','cf',out/'classes.jar','-C',classes,'.')
run(bt/'d8','--lib',platform,'--min-api','28','--output',out,out/'classes.jar',*libs)
run(bt/'aapt2','link','-I',platform,'--manifest',root/'tools/android-storage-probe/AndroidManifest.xml','-o',out/'unsigned.apk')
with zipfile.ZipFile(out/'unsigned.apk','a') as z:z.write(out/'classes.dex','classes.dex')
key=out/'test-only.keystore'
if not key.exists():run(jdk/'bin/keytool','-genkeypair','-keystore',key,'-storepass','android','-keypass','android','-alias','test','-dname','CN=Eva Isolated Storage Test','-keyalg','RSA','-validity','3650')
run(bt/'apksigner','sign','--ks',key,'--ks-pass','pass:android','--out',out/'storage-check.apk',out/'unsigned.apk')
run(bt/'apksigner','verify',out/'storage-check.apk');print(out/'storage-check.apk')
