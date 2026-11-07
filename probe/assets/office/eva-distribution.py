"""Idempotent first-launch dependency setup. Never copies another device's user data."""
import fcntl
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time
import tomllib
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


def main():
    BASE.mkdir(parents=True, exist_ok=True)
    with (BASE / 'setup.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        started = BASE / 'started.json'
        free = shutil.disk_usage(BASE).free
        if not started.is_file():
            if free < 6 * 1024**3:
                raise RuntimeError('完整依赖首次部署需要至少 6 GiB 可用空间')
            temporary = BASE / 'started.tmp'
            temporary.write_text(json.dumps({'schema': 1, 'initialFreeBytes': free}))
            temporary.replace(started)
        elif free < 512 * 1024**2:
            raise RuntimeError('继续部署前请至少腾出 512 MiB 空间，已有组件与下载保留')
        emit('安装签名系统依赖与办公渲染引擎')
        run(['apk', '--timeout', '120', '--no-cache', 'add', 'build-base', 'python3-dev',
             'pkgconf', 'procps-ng', 'bison', 'flex', 'zlib-dev', 'openjdk17-jdk', 'openjdk21-jdk', 'gradle', 'tesseract-ocr',
             'tesseract-ocr-data-chi_sim', 'libreoffice-impress', 'libreoffice-writer',
             'libreoffice-calc', 'libreoffice-draw', 'poppler-utils', 'font-noto-cjk',
             'chromium', 'ffmpeg', 'imagemagick'])
        emit('部署并验证 Java 21 兼容运行时')
        run(['python3', '/root/.eva-runtime/eva-java21.py', 'install'])
        emit('下载校验并部署 Android SDK')
        run(['python3', '/root/.eva-runtime/eva-android-build.py', 'install'])
        emit('部署 Ghidra ARM64 原生反编译器')
        ghidra()
        emit('部署 REA 6.8.0')
        rea = BASE / 'rea'
        rea.mkdir(exist_ok=True)
        run(['npm', 'install', '--prefix', rea, '--save-exact', '--no-audit', '--no-fund', 'rea-agents@6.8.0'])
        emit('执行本地工具自检')
        run(['python3', '/root/eva-office.py', 'selftest'])
        run(['python3', '/root/.eva-runtime/eva-java21.py', 'selftest'])
        env = {**os.environ, 'JAVA_HOME': str(JAVA), 'GHIDRA_INSTALL_DIR': str(GHIDRA),
               'PATH': str(JAVA / 'bin') + ':' + os.environ.get('PATH', ''),
               'EVA_JAVA21_COMPAT': '1', 'LD_PRELOAD': str(JAVA / 'libeva-java21-memory.so')}
        run([rea / 'node_modules/.bin/rea', '--version'], env=env)
        emit('实际编译执行并验证 Ghidra 与 REA 反编译')
        run(['python3', '/root/.eva-runtime/eva-distribution-check.py'], timeout=600, env=env)
        home = Path('/root/.eva-codex')
        home.mkdir(exist_ok=True)
        config = home / 'config.toml'
        text = config.read_text() if config.exists() else ''
        tomllib.loads(text)
        if not config.exists():
            text += '\n[mcp_servers.rea]\ncommand = ' + json.dumps(str(rea / 'node_modules/.bin/rea')) + '\nargs = ["mcp"]\nstartup_timeout_sec = 120\n'
            text += '[mcp_servers.rea.env]\n' + ''.join(k + ' = ' + json.dumps(env[k]) + '\n' for k in ['JAVA_HOME', 'GHIDRA_INSTALL_DIR', 'EVA_JAVA21_COMPAT', 'LD_PRELOAD'])
            tomllib.loads(text)
            with tempfile.NamedTemporaryFile(mode='w', prefix='distribution-config-', dir=home, delete=False) as target:
                temporary = Path(target.name)
                target.write(text)
                target.flush()
                os.fsync(target.fileno())
            try:
                os.link(temporary, config)
            except FileExistsError:
                emit('已有配置由用户或应用创建，保留现有配置')
            finally:
                temporary.unlink(missing_ok=True)
        installed = run(['python3', '/root/.eva-runtime/eva-capabilities.py', 'inventory'])
        (BASE / 'packages.json').write_text(installed)
        record = {'schema': 1, 'ready': True, 'rea': '6.8.0', 'ghidraSha256': GHIDRA_SHA256}
        temporary = BASE / 'ready.tmp'
        temporary.write_text(json.dumps(record))
        temporary.replace(BASE / 'ready.json')
        print(json.dumps(record), flush=True)


if __name__ == '__main__':
    main()
