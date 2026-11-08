"""Freeze build inputs; do not sign files while another chat edits the workspace."""
from pathlib import Path
import shutil,subprocess,sys
root=Path(__file__).resolve().parents[1];snapshot=root/'artifacts/dsh-availability-20261108/build-input'
if snapshot.exists():raise SystemExit('Inspect the existing input snapshot before replacing it')
snapshot.mkdir(parents=True)
for name in ['probe/src','probe/third_party','probe/assets','probe/res','probe/libs']:
 shutil.copytree(root/name,snapshot/name)
for name in ['probe/AndroidManifest.xml','probe/voice-keywords.txt','LICENSE.md','research/runtime-provenance.json','tools/build-probe-macos.py']:
 p=snapshot/name;p.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(root/name,p)
subprocess.run([sys.executable,str(snapshot/'tools/build-probe-macos.py'),*sys.argv[1:]],check=True,cwd=root)
