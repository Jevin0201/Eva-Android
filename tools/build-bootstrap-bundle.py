"""Build a clean distributable runtime image, never copying the user's runtime or credentials."""
import argparse
import base64
import gzip
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import posixpath
import shlex
import subprocess
import tarfile
import time

ROOT = Path(__file__).resolve().parents[1]
os.chdir(ROOT)
parser = argparse.ArgumentParser()
parser.add_argument('--resume', action='store_true')
args = parser.parse_args()
ADB = os.environ.get('EVA_ADB', os.path.expandvars(r'%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe'))
PKG = 'ai.eva.android.probe'
OUT = ROOT / 'artifacts/bootstrap-image'
OUT.mkdir(parents=True, exist_ok=True)

def shell(*words, input=None, timeout=120):
    result = subprocess.run([ADB, 'exec-in' if input is not None else 'shell', shlex.join(list(words))], input=input, stdout=subprocess.PIPE,
                            stderr=subprocess.STDOUT, timeout=timeout)
    if result.returncode:
        raise RuntimeError(result.stdout.decode('utf-8', errors='replace')[-8000:])
    return result.stdout

private = shell('run-as', PKG, 'readlink', '-f', 'files').decode().strip()
stage = private + '/bootstrap-image-build/root'
apk = shell('pm', 'path', PKG).decode().strip().removeprefix('package:')
native = apk.rsplit('/', 1)[0] + '/lib/arm64'
base = ROOT / 'downloads/alpine.tar.gz'
expected = (ROOT / 'downloads/alpine.sha256').read_text().split()[0]
if hashlib.sha256(base.read_bytes()).hexdigest() != expected:
    raise RuntimeError('Base rootfs checksum mismatch')
metadata = json.loads((ROOT / 'research/codex-0.166.0/npm.json').read_text())
codex = ROOT / 'downloads/codex-0.166.0-verified.tgz'
integrity = base64.b64encode(hashlib.sha512(codex.read_bytes()).digest()).decode()
if metadata['dist']['integrity'] != 'sha512-' + integrity:
    raise RuntimeError('Official Codex package integrity mismatch')

if not args.resume:
    exists = subprocess.run([ADB, 'shell', 'run-as', PKG, 'test', '-e', stage], capture_output=True).returncode == 0
    if exists:
        raise RuntimeError('Isolated build directory already exists. Use --resume after inspecting it.')
    shell('run-as', PKG, 'mkdir', '-p', stage)
    shell('run-as', PKG, 'tar', '-xf', '-', '--no-same-owner', '-C', stage,
          input=gzip.decompress(base.read_bytes()))
    shell('run-as', PKG, 'mkdir', '-p', stage + '/root/eva-kernel', stage + '/root/eva-workspace')
    with tarfile.open(codex) as archive:
        with tarfile.open(OUT / 'kernel.tar', 'w') as target:
            prefix = 'package/vendor/aarch64-unknown-linux-musl/'
            for path in ['bin/codex', 'bin/codex-code-mode-host', 'codex-resources/bwrap']:
                member = archive.getmember(prefix + path)
                header = tarfile.TarInfo(path)
                header.mode = 0o755
                header.size = member.size
                target.addfile(header, archive.extractfile(member))
    with open(OUT / 'kernel.tar', 'rb') as stream:
        subprocess.run([ADB, 'exec-in', 'run-as', PKG, 'tar', '-xf', '-', '--no-same-owner', '-C', stage + '/root/eva-kernel'], stdin=stream, check=True, timeout=180)

def put(relative, data):
    shell('run-as', PKG, 'mkdir', '-p', stage + '/' + relative.rsplit('/', 1)[0])
    digest = hashlib.sha256(data).hexdigest()
    local = OUT / ('transfer-' + digest)
    local.write_bytes(data)
    remote = '/data/local/tmp/eva-bootstrap-build/' + digest
    shell('mkdir', '-p', '/data/local/tmp/eva-bootstrap-build')
    subprocess.run([ADB, 'push', str(local), remote], check=True, stdout=subprocess.DEVNULL)
    shell('run-as', PKG, 'cp', remote, stage + '/' + relative)
    actual = shell('run-as', PKG, 'sha256sum', stage + '/' + relative).decode().split()[0]
    if actual != digest:
        raise RuntimeError('Isolated build transfer integrity mismatch: ' + relative)

put('etc/resolv.conf', b'nameserver 223.5.5.5\nnameserver 119.29.29.29\n')
put('etc/apk/repositories', b'https://mirrors.tuna.tsinghua.edu.cn/alpine/v3.22/main\nhttps://mirrors.tuna.tsinghua.edu.cn/alpine/v3.22/community\n')
put('root/eva-office.py', (ROOT / 'probe/assets/office/eva-office.py').read_bytes())
put('../native/liboperit_proot.so', (ROOT / 'artifacts/proot-termux-release/candidate/liboperit_proot.so').read_bytes())
put('../native/liboperit_loader.so', (ROOT / 'artifacts/proot-termux-release/candidate/liboperit_loader.so').read_bytes())
shell('run-as', PKG, 'chmod', '700', private + '/bootstrap-image-build/native/liboperit_proot.so', private + '/bootstrap-image-build/native/liboperit_loader.so')
proot = ['run-as', PKG, 'env', 'PROOT_LOADER=' + private + '/bootstrap-image-build/native/liboperit_loader.so',
         'PROOT_TMP_DIR=' + private + '/tmp', 'HOME=/root', 'PATH=/usr/bin:/bin:/usr/sbin:/sbin',
         '/system/bin/linker64', private + '/bootstrap-image-build/native/liboperit_proot.so', '-0', '--link2symlink', '-r', stage, '-b', '/dev', '-b', '/proc', '-w', '/root']
command = '''set -eu
apk --timeout 120 --no-cache add python3 py3-pip nodejs npm git ripgrep bash coreutils findutils file jq zip unzip tar gzip curl ca-certificates
apk --timeout 120 --no-cache fix nodejs
mkdir -p /root/eva-kernel/codex-path
ln -sf /usr/bin/rg /root/eva-kernel/codex-path/rg
python3 /root/eva-office.py install
python3 --version
node --version
git --version
/root/eva-kernel/codex-path/rg --version
/root/eva-kernel/bin/codex --version
'''
print('Installing signed packages in a separate, clean rootfs', flush=True)
log = shell(*proot, '/bin/sh', '-c', command, timeout=1200).decode('utf-8', errors='replace')
(OUT / 'build.log').write_text(log, encoding='utf-8')
print(log[-1600:], flush=True)
inventory_script = "import json,pathlib;rows=[]\nfor b in pathlib.Path('/lib/apk/db/installed').read_text().split('\\n\\n'):\n d=dict(x.split(':',1) for x in b.splitlines() if ':' in x and len(x.split(':',1)[0])==1)\n if 'P' in d:rows.append({k:d.get(v,'') for k,v in [('name','P'),('version','V'),('license','L'),('source','U'),('origin','o')]})\nprint(json.dumps(rows,ensure_ascii=False))"
inventory = json.loads(shell(*proot, '/usr/bin/python3', '-c', inventory_script).decode())
(OUT / 'packages.json').write_text(json.dumps(inventory, indent=2), encoding='utf-8')
put('usr/share/licenses/eva/codex-LICENSE', (ROOT / 'research/codex-0.166.0/LICENSE').read_bytes())
put('root/.eva-runtime/image-packages.json', json.dumps(inventory, indent=2).encode())
put('root/.eva-runtime/image-provenance.json', json.dumps({
    'schema': 1, 'base': {'url': 'https://dl-cdn.alpinelinux.org/alpine/v3.22/releases/aarch64/alpine-minirootfs-3.22.7-aarch64.tar.gz', 'sha256': expected},
    'codex': {'version': metadata['version'], 'url': metadata['dist']['tarball'], 'integrity': metadata['dist']['integrity']},
    'ripgrep': 'Alpine signed package, replaces upstream glibc executable with musl-compatible /usr/bin/rg',
    'userDataIncluded': False,
}, indent=2).encode())

raw = OUT / 'rootfs-export.tar'
with open(raw, 'wb') as stream:
    subprocess.run([ADB, 'exec-out', 'run-as', PKG, 'tar', '-cf', '-', '-C', stage, '.'], stdout=stream, check=True, timeout=300)
asset = ROOT / 'probe/assets/runtime/eva-runtime-arm64.tar.gz'
asset.parent.mkdir(parents=True, exist_ok=True)
expanded = 0
with tarfile.open(raw) as source, open(asset, 'wb') as output, gzip.GzipFile(fileobj=output, mode='wb', compresslevel=6, mtime=0) as zipped, tarfile.open(fileobj=zipped, mode='w', format=tarfile.USTAR_FORMAT) as target:
    members = source.getmembers()
    index = {posixpath.normpath(m.name).removeprefix('./'): m for m in members}
    def resolve(name):
        for _ in range(40):
            entry = index[name]
            if entry.isfile():
                return entry
            if not (entry.issym() or entry.islnk()):
                raise RuntimeError('Hardlink emulation points to non-file: ' + name)
            link = entry.linkname
            if link.startswith(stage + '/'):
                name = link[len(stage) + 1:]
            elif entry.islnk():
                name = posixpath.normpath(link)
            elif link.startswith('/'):
                name = link.lstrip('/')
            else:
                name = posixpath.normpath(posixpath.join(posixpath.dirname(name), link))
        raise RuntimeError('Link cycle in runtime image')
    for member in members:
        name = posixpath.normpath(member.name).removeprefix('./')
        if name == '.':
            continue
        if name.startswith('/') or '..' in PurePosixPath(name).parts:
            raise RuntimeError('Unsafe image member: ' + name)
        if name.startswith(('root/.eva-codex/auth', 'root/.eva-codex/sessions', 'root/eva-workspace/')):
            raise RuntimeError('Unexpected private data in clean image')
        header = tarfile.TarInfo(name)
        header.mode = member.mode & 0o777
        header.uid = header.gid = header.mtime = 0
        if member.isdir():
            header.type = tarfile.DIRTYPE
            target.addfile(header)
        elif member.islnk() or (member.issym() and member.linkname.startswith(stage + '/')):
            original = resolve(name)
            header.size = original.size
            expanded += header.size
            target.addfile(header, source.extractfile(original))
        elif member.issym():
            if '/data/' in member.linkname:
                raise RuntimeError('Device-specific symlink in image: ' + name)
            header.type = tarfile.SYMTYPE
            header.linkname = member.linkname
            target.addfile(header)
        elif member.isfile():
            header.size = member.size
            expanded += header.size
            target.addfile(header, source.extractfile(member))
        else:
            raise RuntimeError('Unsupported special file in runtime image: ' + name)
manifest = {'version': 1, 'id': 'eva-alpine-3.22.7-codex-0.166.0-arm64-v1', 'minApi': 28, 'abi': 'arm64-v8a', 'components': [{
    'id': 'rootfs', 'asset': 'runtime/eva-runtime-arm64.tar.gz', 'sha256': hashlib.sha256(asset.read_bytes()).hexdigest(),
    'size': asset.stat().st_size, 'expandedSize': expanded, 'format': 'tar.gz', 'destination': 'alpine',
}]}
(asset.parent / 'bootstrap.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
print(json.dumps(manifest, indent=2))
