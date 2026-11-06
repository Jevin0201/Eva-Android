"""Fault-inject only the disposable fresh-install package, never the user's Eva package."""
import json
import os
from pathlib import Path
import subprocess
import time
import xml.etree.ElementTree as ET

adb = os.path.expandvars(r'%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe')
pkg = 'ai.eva.android.bootstrapcheck'
component = pkg + '/ai.eva.android.probe.ShellActivity'
out = Path('artifacts/bootstrap-fresh-acceptance')
out.mkdir(parents=True, exist_ok=True)

def run(*args):
    return subprocess.run([adb, *args], capture_output=True, timeout=30)

def state():
    result = run('shell', 'run-as', pkg, 'cat', 'shared_prefs/eva-runtime-bootstrap.xml')
    if result.returncode:
        return {}
    return {node.get('name'): node.get('value', node.text) for node in ET.fromstring(result.stdout)}

cleared = run('shell', 'pm', 'clear', pkg)
if b'Success' not in cleared.stdout:
    raise RuntimeError('Disposable package did not clear')
run('shell', 'am', 'start', '-n', component).check_returncode()
deadline = time.monotonic() + 35
interrupted = None
while time.monotonic() < deadline:
    current = state()
    if current.get('stage') == 'extracting' and current.get('ready') != 'true':
        interrupted = current
        run('shell', 'am', 'force-stop', pkg).check_returncode()
        break
    time.sleep(.15)
if interrupted is None:
    raise RuntimeError('Could not interrupt while extracting: ' + json.dumps(state()))
run('shell', 'am', 'start', '-n', component).check_returncode()
deadline = time.monotonic() + 120
while time.monotonic() < deadline:
    current = state()
    if current.get('ready') == 'true':
        result = {'passed': True, 'package': pkg, 'interruptedStage': interrupted['stage'],
                  'automaticResume': True, 'readyAfterRestart': True, 'image': current.get('installedId')}
        (out / 'interruption-recovery.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
        print(json.dumps(result))
        break
    if current.get('stage') == 'error':
        raise RuntimeError('Automatic retry failed: ' + json.dumps(current, ensure_ascii=False))
    time.sleep(.5)
else:
    raise RuntimeError('Automatic retry timed out: ' + json.dumps(state(), ensure_ascii=False))
