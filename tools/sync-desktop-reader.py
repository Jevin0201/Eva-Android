"""Copy authorized desktop reader assets; preserve vendor notices and provenance."""
from pathlib import Path
import hashlib,json,os,re,shutil
source=Path(os.environ.get('EVA_DESKTOP_SOURCE','/Users/jevin/Documents/Codex/Eva-Source'))
src=source/'src/renderer';dst=Path('probe/assets/desktop-reader');dst.mkdir(parents=True,exist_ok=True)
names=['cloud-docx-frame.html','cloud-docx-frame.js','cloud-pdf-frame.html','cloud-pdf-frame.mjs','cloud-pdf-continuous.mjs','cloud-pdf-annotations.mjs','cloud-pdf-search.mjs','cloud-pdf-layer.css','office-preview.js','cloud-markdown.js','vendor/docx-current.mjs','vendor/pdf-current.mjs','vendor/pdf-viewer-current.mjs','vendor/pdf.worker.mjs','vendor/rolldown-runtime-428824ca0286.js','vendor/app-shared-b9a49a97ca55.js']
records=[]
for name in names:
 p=src/name;t=dst/name;t.parent.mkdir(parents=True,exist_ok=True);raw=p.read_bytes();records.append({'source':str(p),'sha256':hashlib.sha256(raw).hexdigest()})
 text=raw.decode().replace('app://bundle/','https://reader.eva.invalid/desktop-reader/')
 for directive in ['script','worker','connect','style']:text=text.replace(directive+'-src app:',directive+"-src 'self'")
 t.write_text(text)
import runpy
runpy.run_path(str(Path(__file__).with_name('desktop-reader-mobile.py')))['adapt'](dst)
shutil.copytree(src/'vendor/katex',dst/'vendor/katex',dirs_exist_ok=True)
for base in [src/'native-preview',src/'native-steering/markdown-runtime']:
 for p in base.rglob('*'):
  if p.is_file():records.append({'source':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
p=source/'src/main/office-preview.js';records.append({'source':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
Path('migration/desktop-reader/provenance.json').write_text(json.dumps({'files':records,'adaptations':['Android HTTPS origin replaces Electron app scheme','Browser Office transport replaces filesystem and unzipper with JSZip; native ZIP preflight retains inflated limits'],'rights':'User-authorized Eva migration; extracted vendor resources retain original provenance, no relicensing.'},indent=2))
