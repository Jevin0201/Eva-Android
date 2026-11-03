"""Install/deploy the bundled office adapter on an already-connected Eva test phone.
Usage: python tools/deploy-office-runtime.py [status|install|selftest]
Uses only this workspace's asset; all installation is on the phone itself.
"""
import base64, pathlib, subprocess, sys
root=pathlib.Path(__file__).resolve().parent.parent
source=base64.b64encode((root/'probe/assets/office/eva-office.py').read_bytes()).decode()
action=sys.argv[1] if len(sys.argv)>1 else 'status'
if action not in ('status','install','selftest'):raise SystemExit('Unsupported action')
script="import base64,pathlib,subprocess\np=pathlib.Path('/root/eva-office.py')\np.write_bytes(base64.b64decode('"+source+"'))\nraise SystemExit(subprocess.run(['python3',str(p),'"+action+"']).returncode)\n"
raise SystemExit(subprocess.run([sys.executable,str(root/'tools/device-python.py')],input=script,text=True,encoding='utf-8').returncode)
