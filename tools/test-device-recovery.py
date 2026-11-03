"""Authorized fault injection: remove only Eva's accessibility entry and verify real rebind."""
import json, os, pathlib, re, shutil, subprocess, time
adb = os.environ.get('EVA_ADB') or shutil.which('adb')
if not adb: raise SystemExit('Set EVA_ADB')
def shell(*args): return subprocess.check_output([adb, 'shell', *args], text=True, encoding='utf-8')
prefs = shell('run-as','ai.eva.android.probe','cat','shared_prefs/eva-phone.xml')
assert 'name="keepEnabled" value="true"' in prefs, 'Keep control must already be enabled'
before = shell('settings','get','secure','enabled_accessibility_services').strip()
entries = [s for s in before.split(':') if s and s != 'null']
others = [s for s in entries if not s.startswith('ai.eva.android.probe/')]
assert len(others) < len(entries), 'Eva accessibility must initially be enabled'
start = time.monotonic()
shell('settings','put','secure','enabled_accessibility_services', ':'.join(others) or 'null')
rebound = False
try:
    while time.monotonic()-start < 22:
        settings = shell('settings','get','secure','enabled_accessibility_services').strip()
        dump = shell('dumpsys','accessibility')
        bound = re.findall(r'Bound services:\{([^\n]*)', dump)
        if 'ai.eva.android.probe/' in settings and any('Eva 手机控制' in s for s in bound):
            rebound = True
            break
        time.sleep(.4)
    assert rebound, 'Setting restored but no actual service binding (or recovery failed)'
    assert all(s in settings.split(':') for s in others), 'Other accessibility services changed'
    result = {'passed': True, 'reboundMs': round((time.monotonic()-start)*1000), 'systemSettingEnabled': True, 'serviceActuallyBound': True, 'otherServicesPreserved': True}
    path = pathlib.Path('artifacts/acceptance-0.0.28/accessibility-rebind.json');path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result))
finally:
    if not rebound:
        shell('settings','put','secure','enabled_accessibility_services',before)
        shell('settings','put','secure','accessibility_enabled','1')
