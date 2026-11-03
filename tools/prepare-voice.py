from pathlib import Path
import shutil,json,hashlib
root=Path(__file__).resolve().parent.parent
import os,tarfile,zipfile
os.chdir(root)
for dep in json.loads((root/'research/voice/dependencies.json').read_text(encoding='utf-8')):
 file=root/'downloads/voice'/dep['file']
 if not file.is_file() or hashlib.sha256(file.read_bytes()).hexdigest()!=dep['sha256']:raise ValueError('Dependency missing or checksum mismatch: '+str(file))
base=(root/'downloads/voice/extracted').resolve();base.mkdir(exist_ok=True)
for kind in ['kws','asr']:
 with tarfile.open(root/('downloads/voice/'+kind+'.tar.bz2')) as archive:
  for member in archive.getmembers():
   if not (base/member.name).resolve().is_relative_to(base) or member.issym() or member.islnk():raise ValueError('Unsafe archive entry')
  archive.extractall(base)
with zipfile.ZipFile(root/'downloads/voice/sherpa.aar') as archive:archive.extractall(root/'downloads/voice/aar')
assets=root/'probe/assets/voice'
for name in ['kws','asr','licenses']:(assets/name).mkdir(parents=True,exist_ok=True)
kws=root/'downloads/voice/extracted/sherpa-onnx-kws-zipformer-zh-en-3M-2025-12-20'
asr=root/'downloads/voice/extracted/sherpa-onnx-streaming-zipformer-small-ctc-zh-int8-2025-04-01'
for kind in ['encoder','decoder','joiner']:
 suffix='.onnx' if kind=='decoder' else '.int8.onnx'
 shutil.copyfile(kws/(kind+'-epoch-13-avg-2-chunk-16-left-64'+suffix),assets/'kws'/(kind+suffix))
shutil.copyfile(kws/'tokens.txt',assets/'kws/tokens.txt')
for name in ['model.int8.onnx','tokens.txt']:shutil.copyfile(asr/name,assets/'asr'/name)
keywords=(root/'probe/voice-keywords.txt').read_text(encoding='utf-8')
tokens={l.split()[0] for l in (kws/'tokens.txt').read_text(encoding='utf-8').splitlines()}
for line in keywords.splitlines():
 for t in line.split()[:-1]:
  if t not in tokens: raise ValueError('unknown token '+t)
(assets/'kws/keywords.txt').write_text(keywords,encoding='utf-8')
shutil.copyfile('research/voice/LICENSE',assets/'licenses/sherpa-Apache-2.0.txt')
shutil.copyfile('research/voice/kws-LICENSE',assets/'licenses/kws-Apache-2.0.txt')
shutil.copyfile('downloads/voice/aar/classes.jar','probe/libs/sherpa-onnx-2.0.1.jar')
shutil.copyfile('downloads/voice/kotlin-stdlib.jar','probe/libs/kotlin-stdlib-2.1.0.jar')
(root/'probe/native/lib/arm64-v8a').mkdir(parents=True,exist_ok=True)
for name in ['libsherpa-onnx-jni.so','libonnxruntime.so']:shutil.copyfile('downloads/voice/aar/jni/arm64-v8a/'+name,'probe/native/lib/arm64-v8a/'+name)

print("Prepared pinned voice dependencies; no source/manifest edits")
