"""Import verified Alpine rootfs into the development probe; not a product installer."""
import gzip, hashlib, os, pathlib, shutil, subprocess, tarfile
root = pathlib.Path(__file__).resolve().parent.parent
os.chdir(root)
adb = os.environ.get('EVA_ADB') or shutil.which('adb.exe')
if not adb:
    raise SystemExit('Set EVA_ADB to the full adb.exe path')
archive = pathlib.Path('downloads/alpine.tar.gz')
expected = pathlib.Path('downloads/alpine.sha256').read_text().split()[0]
assert hashlib.sha256(archive.read_bytes()).hexdigest() == expected.lower(), 'SHA256 mismatch'
with tarfile.open(archive) as t:
    for m in t.getmembers():
        assert not m.name.startswith('/') and '..' not in m.name.split('/'), m.name
    pathlib.Path('research/alpine-package-manifest.txt').write_bytes(t.extractfile('./lib/apk/db/installed').read())
subprocess.run([adb,'shell','run-as','ai.eva.android.probe','mkdir','-p','files/alpine'],check=True)
with gzip.open(archive,'rb') as f:
    data=f.read()
subprocess.run([adb,'exec-in','run-as ai.eva.android.probe sh -c "cat > files/alpine.tar"'],input=data,check=True)
size=subprocess.check_output([adb,'shell','run-as','ai.eva.android.probe','stat','-c','%s','files/alpine.tar'],text=True)
assert int(size.strip()) == len(data), 'Incomplete transfer'
subprocess.run([adb,'shell','run-as','ai.eva.android.probe','tar','-xf','files/alpine.tar','--no-same-owner','-C','files/alpine'],check=True)
subprocess.run([adb,'exec-in','run-as ai.eva.android.probe sh -c "cat > files/alpine/root/eva-smoke.py"'],input=pathlib.Path('tools/linux-smoke.py').read_bytes(),check=True)
for name in ['task_runner.py', 'test_task_runner.py']:
    subprocess.run([adb,'exec-in',f'run-as ai.eva.android.probe sh -c "cat > files/alpine/root/{name}"'],input=pathlib.Path('runtime',name).read_bytes(),check=True)
subprocess.run([adb,'exec-in','run-as ai.eva.android.probe sh -c "cat > files/alpine/root/eva-command.py"'],input=pathlib.Path('runtime/eva-command.py').read_bytes(),check=True)
