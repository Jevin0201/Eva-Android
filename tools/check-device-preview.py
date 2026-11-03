import pathlib,subprocess,uuid,json,time
adb=r'C:\Users\Jevin\AppData\Local\Eva\Tools\android\platform-tools\adb.exe';pkg='ai.eva.android.probe';folder='preview-checks-'+uuid.uuid4().hex[:12];base='/data/user/0/'+pkg+'/files/alpine/root/eva-workspace/'+folder
subprocess.run([adb,'shell','run-as',pkg,'mkdir','-p',base],check=True)
for name in ['sample.docx','sample.xlsx','sample.pptx','sample.md','sample.html','fixture.png','sample.wav','sample.webm','unsafe.docx']:
 temp='/data/local/tmp/'+folder+'-'+name
 subprocess.run([adb,'push',str(pathlib.Path('artifacts/previews')/name),temp],check=True,capture_output=True)
 subprocess.run([adb,'shell','run-as',pkg,'cp',temp,base+'/'+name],check=True)
pathlib.Path('artifacts/previews/device-fixture.json').write_text(json.dumps({'folder':folder},indent=2),'utf-8')
subprocess.run([adb,'shell','am','start','-W','-n',pkg+'/.ShellActivity','--es','page','preview-selfcheck','--es','preview-folder',folder],check=True,capture_output=True)
for _ in range(30):
 r=subprocess.run([adb,'shell','run-as',pkg,'cat','shared_prefs/eva-preview-check.xml'],capture_output=True,text=True,encoding='utf-8')
 if r.returncode==0:
  import xml.etree.ElementTree as E
  data=json.loads(next(x.text for x in E.fromstring(r.stdout) if x.attrib.get('name')=='result'));print(json.dumps(data));pathlib.Path('artifacts/previews/native-result.json').write_text(json.dumps(data,indent=2),'utf-8');assert data['passed'];break
 time.sleep(.3)
else: raise RuntimeError('Preview self-check timed out')
