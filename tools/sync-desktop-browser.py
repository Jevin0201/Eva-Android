"""Vendor user-authorized Eva desktop browser engine with exact provenance."""
from pathlib import Path
import os,hashlib,json,shutil
root=Path(__file__).resolve().parents[1]
src=Path(os.environ.get('EVA_DESKTOP_SOURCE','/Users/jevin/Documents/Codex/Eva-Source'))/'src'
dst=root/'probe/assets/desktop-browser'
records=[]
for base in ['main/browser-control']:
 for p in (src/base).rglob('*'):
  if p.is_file():
   target=dst/p.relative_to(src/'main');target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,target)
for name in ['browser-automation-ready.js','browser-result-store.cjs']:
 shutil.copyfile(src/'main'/name,dst/name)
for p in src.rglob('*'):
 if p.is_file() and ('browser' in p.name.lower() or 'browser-control' in p.parts):
  records.append({'path':str(p.relative_to(src)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size})
# Runtime dependency is packaged offline; no npm install on the phone.
pw=root/'node_modules/playwright-core'
shutil.copytree(pw,dst/'node_modules/playwright-core',dirs_exist_ok=True,ignore=shutil.ignore_patterns('.cache'))
(dst/'tools.json').write_text(__import__('subprocess').check_output(['node','-e',"console.log(JSON.stringify(require(process.argv[1]).tools))",str(dst/'browser-control/tool-definitions.js')],text=True))
(root/'migration/desktop-browser/SOURCE.json').write_text(json.dumps({'source':str(src),'files':records,'rights':'User-authorized Eva source migration; original notices and bulu/port-manifest.json retained. Playwright Apache-2.0 LICENSE/NOTICE packaged; no submodules used.','dependency':{'playwright-core':json.loads((pw/'package.json').read_text())['version']}},ensure_ascii=False,indent=2))
