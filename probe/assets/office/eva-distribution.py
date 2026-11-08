"""Idempotent first-launch dependency setup. Never copies another device's user data."""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time
import runpy
import sys
import urllib.request
import zipfile

BASE = Path('/root/.eva-runtime/distribution')
GHIDRA = Path('/root/.eva-runtime/ghidra/ghidra_12.1.4_PUBLIC')
GHIDRA_URL = 'https://github.com/NationalSecurityAgency/ghidra/releases/download/Ghidra_12.1.4_build/ghidra_12.1.4_PUBLIC_20260921.zip'
GHIDRA_SHA256 = 'ddac49f903da9d5bac833e5cc79395098b9c33cfd3279be5f31bd00387d2d4db'
JAVA = Path('/root/.eva-runtime/java21/current')


def emit(message):
    print(json.dumps({'progress': message}, ensure_ascii=False), flush=True)


def run(command, timeout=1200, env=None, cwd=None):
    if command and str(command[0]) == 'apk' and 'add' in command and '--simulate' not in command:
        timeout = None  # Let the signed package transaction finish before cancellation.
    result = subprocess.run(list(map(str, command)), stdout=subprocess.PIPE,
                            stderr=subprocess.STDOUT, text=True, timeout=timeout, env=env, cwd=cwd)
    if result.returncode:
        raise RuntimeError(result.stdout[-6000:])
    return result.stdout


def ghidra():
    binary = GHIDRA / 'Ghidra/Features/Decompiler/os/linux_arm_64/decompile'
    if binary.is_file() and os.access(binary, os.X_OK):
        return
    archive = BASE / 'ghidra.zip'
    def digest(path):
        with path.open('rb') as stream:
            return hashlib.file_digest(stream, 'sha256').hexdigest()
    if not archive.is_file() or digest(archive) != GHIDRA_SHA256:
        partial = BASE / 'ghidra.partial'
        with urllib.request.urlopen(GHIDRA_URL, timeout=60) as source, partial.open('wb') as target:
            received = 0
            last_progress = 0.0
            while True:
                chunk = source.read(1024 * 1024)
                if not chunk:
                    break
                received += len(chunk)
                if received > 2 * 1024**3:
                    raise RuntimeError('Ghidra download exceeds expected size bound')
                target.write(chunk)
                if time.monotonic() - last_progress > 2:
                    emit('正在下载 Ghidra，已接收 ' + str(received // 1024**2) + ' MiB')
                    last_progress = time.monotonic()
        if digest(partial) != GHIDRA_SHA256:
            raise RuntimeError('Ghidra SHA-256 mismatch')
        partial.replace(archive)
    GHIDRA.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='ghidra-', dir=BASE) as folder:
        stage = Path(folder)
        emit('正在解压校验后的 Ghidra 发行包')
        with zipfile.ZipFile(archive) as source:
            for member in source.infolist():
                path = Path(member.filename)
                if path.is_absolute() or '..' in path.parts or '\\' in member.filename:
                    raise RuntimeError('Unsafe Ghidra archive member')
                mode = member.external_attr >> 16
                if mode & 0o170000 == 0o120000:
                    raise RuntimeError('Unexpected Ghidra archive symlink')
                target = stage / path
                if member.is_dir():
                    target.mkdir(parents=True, exist_ok=True)
                else:
                    target.parent.mkdir(parents=True, exist_ok=True)
                    with source.open(member) as input_file, target.open('wb') as output:
                        shutil.copyfileobj(input_file, output)
                    target.chmod((mode & 0o777) or 0o644)
        root = stage / GHIDRA.name
        if not (root / 'LICENSE').is_file():
            raise RuntimeError('Ghidra license missing')
        emit('正在编译 Ghidra ARM64 反编译器')
        run(['make', '-j2', 'ghidra_opt', 'ARCH_TYPE=', 'OSDIR=linux_arm_64'],
            cwd=root / 'Ghidra/Features/Decompiler/src/decompile/cpp')
        built = root / 'Ghidra/Features/Decompiler/src/decompile/cpp/ghidra_opt'
        destination = root / 'Ghidra/Features/Decompiler/os/linux_arm_64/decompile'
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(built, destination)
        destination.chmod(0o755)
        if GHIDRA.exists():
            raise RuntimeError('Incomplete existing Ghidra directory preserved; inspect before replacing')
        root.rename(GHIDRA)


# A full legacy installation remains valid; new installs only require core.json.
PROFILES = {
    'core': ['procps-ng', 'py3-pip'],
    'office': ['libreoffice-impress', 'libreoffice-writer', 'libreoffice-calc',
               'libreoffice-draw', 'poppler-utils', 'font-noto-cjk', 'chromium'],
    'development': ['build-base', 'python3-dev', 'py3-pip', 'pkgconf', 'openjdk17-jdk', 'gradle'],
    'media': ['tesseract-ocr', 'tesseract-ocr-data-chi_sim', 'ffmpeg', 'imagemagick'],
    'analysis': ['procps-ng'],
    'ghidra': ['build-base', 'bison', 'flex', 'zlib-dev', 'openjdk21-jdk'],
}
CANCEL = BASE / 'cancel'


def check_cancel():
    if CANCEL.exists():
        raise RuntimeError('已取消后续步骤，已安装组件保留，可重试继续')


def checked_run(args, **kwargs):
    check_cancel()
    result = run(args, **kwargs)
    check_cancel()
    return result


def write_record(profile):
    value = {'schema': 2, 'profile': profile, 'ready': True, 'verifiedAt': time.time()}
    temporary = BASE / (profile + '.tmp')
    temporary.write_text(json.dumps(value), encoding='utf-8')
    temporary.replace(BASE / (profile + '.json'))
    return value


def verify_core():
    checked_run(['python3', '-m', 'pip', '--version'])
    checked_run(['node', '-e', 'if(6*7!==42)process.exit(1)'])
    checked_run(['python3', '-c', 'import ssl,sqlite3; assert sqlite3.connect(":memory:").execute("select 42").fetchone()[0]==42'])
    checked_run(['git', '--version'])
    checked_run(['/root/eva-kernel/bin/codex', '--version'])


def install_profile(profile):
    check_cancel()
    emit('安装' + {'core': '必备依赖', 'office': '办公组件', 'development': '开发工具',
                  'media': '图像与音视频组件', 'analysis': 'REA', 'ghidra': 'Ghidra'}[profile])
    # Do not impose the former full-toolchain 6 GiB gate on core setup.
    # apk checks real transaction space; extraction has its own measured gate.
    if shutil.disk_usage(BASE).free < 256 * 1024**2:
        raise RuntimeError('请至少保留 256 MiB 可用空间供安装事务使用；大型组件还需要额外空间')
    policy = runpy.run_path(str(Path(__file__).with_name('eva-download-policy.py')))
    policy['apk_command'](['apk', '--timeout', '120', '--no-cache', 'add', *PROFILES[profile]], checked_run, BASE / 'download-attempts')
    if profile == 'core':
        verify_core()
    elif profile == 'office':
        office = runpy.run_path('/root/eva-office.py')
        if not office['status']()['ready']:
            office['install']()
        check_cancel()
        checked_run(['python3', '/root/eva-office.py', 'selftest'])
        checked_run(['libreoffice', '--headless', '--version'])
        checked_run(['chromium-browser', '--version'])
        checked_run(['pdfinfo', '-v'])
    elif profile == 'development':
        checked_run(['python3', '/root/.eva-runtime/eva-android-build.py', 'install'])
        result = json.loads(checked_run(['python3', '/root/.eva-runtime/eva-android-build.py', 'status']))
        if not result.get('ready'):
            raise RuntimeError('Android 构建工具链自检未通过')
        checked_run(['gcc', '--version'])
    elif profile == 'media':
        for args in [['tesseract', '--version'], ['ffmpeg', '-version'], ['magick', '-version']]:
            checked_run(args)
    elif profile == 'analysis':
        rea = BASE / 'rea'
        rea.mkdir(exist_ok=True)
        checked_run(['npm', 'install', '--prefix', rea, '--save-exact', '--no-audit', '--no-fund', 'rea-agents@6.8.0'])
        checked_run([rea / 'node_modules/.bin/rea', '--version'])
        # No implicit MCP config edits, Java or Ghidra downloads.
    elif profile == 'ghidra':
        checked_run(['python3', '/root/.eva-runtime/eva-java21.py', 'install'])
        checked_run(['python3', '/root/.eva-runtime/eva-java21.py', 'selftest'])
        check_cancel()
        ghidra()
        check_cancel()
        binary = GHIDRA / 'Ghidra/Features/Decompiler/os/linux_arm_64/decompile'
        if not binary.is_file() or not os.access(binary, os.X_OK):
            raise RuntimeError('Ghidra 原生反编译器缺失')
    return write_record(profile)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--profile', choices=PROFILES, default='core')
    args = parser.parse_args()
    BASE.mkdir(parents=True, exist_ok=True)
    with (BASE / 'setup.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        CANCEL.unlink(missing_ok=True)
        record = install_profile(args.profile)
        print(json.dumps(record), flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'error': str(error)}, ensure_ascii=False), flush=True)
        raise SystemExit(1)
