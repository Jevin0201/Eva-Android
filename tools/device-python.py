"""Run a diagnostic Python script inside Eva's own phone runtime (ADB required)."""
import os, shlex, shutil, subprocess, sys
adb = os.environ.get('EVA_ADB') or shutil.which('adb')
if not adb:
    raise SystemExit('Set EVA_ADB to the adb executable')
script = sys.stdin.read()
pkg = 'ai.eva.android.probe'
base = subprocess.check_output([adb, 'shell', 'pm', 'path', pkg], text=True).strip().removeprefix('package:').rsplit('/', 1)[0]
lib = base + '/lib/arm64'
root = '/data/user/0/' + pkg + '/files'
subprocess.run([adb, 'shell', 'run-as', pkg, 'ln', '-sf', lib + '/liboperit_proot.so', 'files/proot'], check=True)
args = ['run-as', pkg, 'env', 'PATH=/usr/bin:/bin:/usr/sbin:/sbin', 'PROOT_LOADER=' + lib + '/liboperit_loader.so', 'PROOT_TMP_DIR=' + root + '/tmp', root + '/proot', '-0', '-r', root + '/alpine', '-b', '/dev', '-b', '/proc', '-w', '/root', '/usr/bin/python3', '-c', script]
raise SystemExit(subprocess.run([adb, 'shell', shlex.join(args)]).returncode)
