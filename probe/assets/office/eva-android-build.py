"""Phone-local Android SDK installation and Java/Gradle APK builds.

AOSP tools are Apache-2.0. Google SDK jars retain their SDK license files.
Downloads are pinned by SHA-256 and extracted by an explicit member allowlist.
"""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import signal
import subprocess
import tempfile
import urllib.request
import zipfile

BASE = Path('/root/.eva-android')
SDK = BASE / 'sdk-36'
WORKSPACE = Path('/root/eva-workspace')
JAVA_HOME = Path('/usr/lib/jvm/java-17-openjdk')
SOURCES = {
    'native': ('https://github.com/lzhiyong/android-sdk-tools/releases/download/35.0.2/android-sdk-tools-static-aarch64.zip',
               'db1cea2c4454d5f9c5a802646b2d1cf560b4ee7badbe23e51ab8e1881bb50fc2'),
    'platform': ('https://dl.google.com/android/repository/platform-36_r02.zip',
                 '37607369a28c5b640b3a7998868d45898ebcb777565a0e85f9acf36f29631d2e'),
    'jars35': ('https://dl.google.com/android/repository/build-tools_r35_macosx.zip',
               '530cdbd1ec315e1477624d7ed2f0f2962108d69f36eddba5894cef9ea2cedb48'),
    'jars': ('https://dl.google.com/android/repository/build-tools_r36_macosx.zip',
             '04e7f3a72044de4926fa038fa0e251a37bba1e1c3fb8beab6f8401bfd9eb4bf3'),
}


class BuildCancelled(RuntimeError):
    pass


def cancelled(signum, frame):
    raise BuildCancelled('已取消构建')


def emit(value):
    print(json.dumps(value, ensure_ascii=False), flush=True)


def run(argv, cwd=None, env=None, timeout=900):
    process = subprocess.Popen(list(map(str, argv)), cwd=cwd, env=env,
                               start_new_session=True)
    try:
        code = process.wait(timeout=timeout)
    except BaseException:
        try:
            os.killpg(process.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            process.wait()
        raise
    if code:
        raise RuntimeError('构建工具退出码 ' + str(code) + '，请检查上方输出')


def workspace_path(value):
    path = Path(value).resolve(strict=True)
    path.relative_to(WORKSPACE.resolve())
    return path


def status():
    required = [SDK / 'platforms/android-36/android.jar']
    for revision in ['35.0.0', '36.0.0']:
        tools = SDK / 'build-tools' / revision
        required.extend([tools / name for name in ['aapt','aapt2','aidl','dexdump','split-select','zipalign','lib/d8.jar','lib/apksigner.jar','core-lambda-stubs.jar']])
    return {'ready': all(p.is_file() for p in required) and (JAVA_HOME / 'bin/javac').is_file(),
            'sdk': str(SDK), 'architecture': platform.machine(),
            'java': str(JAVA_HOME / 'bin/java'), 'gradle': shutil.which('gradle'),
            'sources': SOURCES}


def download(name, cache):
    url, digest = SOURCES[name]
    target = cache / (name + '.zip')
    if target.is_file():
        with target.open('rb') as cached:
            if hashlib.file_digest(cached, 'sha256').hexdigest() == digest:
                return target
    temp = target.with_suffix('.part')
    try:
        with urllib.request.urlopen(url, timeout=90) as source, temp.open('wb') as output:
            shutil.copyfileobj(source, output)
        with temp.open('rb') as source:
            actual = hashlib.file_digest(source, 'sha256').hexdigest()
        if actual != digest:
            raise ValueError('下载校验失败 ' + name)
        temp.replace(target)
    finally:
        temp.unlink(missing_ok=True)
    return target


def extract_member(archive, member, target):
    target.parent.mkdir(parents=True, exist_ok=True)
    with archive.open(member) as source, target.open('wb') as output:
        shutil.copyfileobj(source, output)


def install():
    if platform.machine() != 'aarch64':
        raise ValueError('当前预编译工具仅适配 aarch64')
    if not (JAVA_HOME / 'bin/javac').is_file():
        raise ValueError('先运行 eva-capabilities.py install --apk openjdk17-jdk gradle')
    BASE.mkdir(parents=True, exist_ok=True)
    with (BASE / 'install.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        if status()['ready']:
            return status()
        cache = BASE / 'downloads'
        cache.mkdir(exist_ok=True)
        archives = {}
        for name in SOURCES:
            emit({'progress': '下载并校验 Android 工具 ' + name})
            archives[name] = download(name, cache)
        with tempfile.TemporaryDirectory(prefix='sdk-install-', dir=BASE) as folder:
            stage = Path(folder) / 'sdk'
            for revision, archive_name in [('35.0.0', 'jars35'), ('36.0.0', 'jars')]:
                tools = stage / 'build-tools' / revision
                with zipfile.ZipFile(archives['native']) as archive:
                    for name in ['aapt', 'aapt2', 'aidl', 'dexdump', 'split-select', 'zipalign']:
                        extract_member(archive, 'build-tools/' + name, tools / name)
                        (tools / name).chmod(0o755)
                with zipfile.ZipFile(archives[archive_name]) as archive:
                    for name in ['d8.jar', 'apksigner.jar']:
                        member = next(p for p in archive.namelist() if p.endswith('/lib/' + name))
                        extract_member(archive, member, tools / 'lib' / name)
                    member = next(p for p in archive.namelist() if p.endswith('/core-lambda-stubs.jar'))
                    extract_member(archive, member, tools / 'core-lambda-stubs.jar')
                    for member in archive.namelist():
                        if member.endswith('/NOTICE.txt'):
                            extract_member(archive, member, tools / 'NOTICE.txt')
                for tool, jar, main in [('d8', 'd8.jar', 'com.android.tools.r8.D8'),
                                        ('apksigner', 'apksigner.jar', 'com.android.apksigner.ApkSignerTool')]:
                    (tools / tool).write_text('#!/bin/sh\nexec java -cp "$(dirname "$0")/lib/' + jar + '" ' + main + ' "$@"\n')
                    (tools / tool).chmod(0o755)
                (tools / 'source.properties').write_text('Pkg.Desc=Eva ARM64 Android build tools\nPkg.Revision=' + revision + '\n')
            with zipfile.ZipFile(archives['platform']) as archive:
                for member in archive.namelist():
                    parts = Path(member).parts
                    if len(parts) > 1 and not member.endswith('/') and '..' not in parts:
                        extract_member(archive, member, stage / 'platforms/android-36' / Path(*parts[1:]))
            (stage / 'eva-sources.json').write_text(json.dumps(SOURCES, indent=2))
            tools = stage / 'build-tools/35.0.0'
            run([tools / 'aapt2', 'version'], env=environment())
            run(['java', '-cp', tools / 'lib/d8.jar', 'com.android.tools.r8.D8', '--version'], env=environment())
            # Add missing verified members without replacing existing SDK files.
            with (BASE / 'build.lock').open('w') as build_lock:
                fcntl.flock(build_lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
                if SDK.exists():
                    if SDK.is_symlink():
                        raise ValueError('SDK 目录不能是符号链接')
                    for source in stage.rglob('*'):
                        if not source.is_file():
                            continue
                        target = SDK / source.relative_to(stage)
                        if target.name == 'eva-sources.json':
                            target = SDK / 'eva-sources-35.json'
                        target.parent.mkdir(parents=True, exist_ok=True)
                        target.parent.resolve().relative_to(SDK.resolve())
                        if target.exists():
                            if target.is_symlink() or target.read_bytes() != source.read_bytes():
                                raise ValueError('已有SDK文件与固定版本不一致，保留原文件：' + str(target))
                            continue
                        created = False
                        try:
                            output = target.open('xb')
                            created = True
                            with output, source.open('rb') as input_file:
                                shutil.copyfileobj(input_file, output)
                            target.chmod(source.stat().st_mode & 0o777)
                        except BaseException:
                            if created:
                                target.unlink(missing_ok=True)
                            raise
                else:
                    stage.rename(SDK)
        return status()


def environment():
    env = dict(os.environ)
    env['ANDROID_HOME'] = env['ANDROID_SDK_ROOT'] = str(SDK)
    env['GRADLE_USER_HOME'] = str(BASE / 'gradle')
    env['JAVA_HOME'] = str(JAVA_HOME)
    env['PATH'] = str(JAVA_HOME / 'bin') + ':' + str(SDK / 'build-tools/36.0.0') + ':' + env.get('PATH', '')
    return env


def java_build(project, output, env):
    config = json.loads((project / 'eva-android.json').read_text())
    tools = SDK / 'build-tools/36.0.0'
    android = SDK / 'platforms/android-36/android.jar'
    def source(name, default):
        path = (project / config.get(name, default)).resolve()
        path.relative_to(project)
        return path
    manifest = source('manifest', 'AndroidManifest.xml')
    resources = source('resources', 'res')
    assets = source('assets', 'assets')
    sources = sorted(source('java', 'src').rglob('*.java'))
    libraries = sorted(source('libraries', 'libs').glob('*.jar'))
    if not sources:
        raise ValueError('没有 Java 源码')
    # Validate leaf files as well as the configured roots before invoking tools.
    for path in [manifest, *sources, *libraries]:
        path.resolve(strict=True).relative_to(project)
    for folder in [resources, assets]:
        if folder.is_dir():
            for entry in folder.rglob('*'):
                entry.resolve(strict=True).relative_to(project)
    minimum = int(config.get('minSdk', 28))
    if minimum < 21 or minimum > 36:
        raise ValueError('minSdk 必须在 21 到 36 之间')
    with tempfile.TemporaryDirectory(prefix='.eva-build-', dir=project) as folder:
        build = Path(folder)
        classes = build / 'classes'
        classes.mkdir()
        generated = build / 'generated'
        generated.mkdir()
        args = [tools / 'aapt2', 'link', '-I', android, '--manifest', manifest,
                '--min-sdk-version', str(minimum), '--target-sdk-version', '36',
                '--java', generated, '-o', build / 'base.apk']
        if resources.is_dir():
            run([tools / 'aapt2', 'compile', '--dir', resources, '-o', build / 'resources.zip'], env=env)
            args.append(build / 'resources.zip')
        if assets.is_dir():
            args += ['-A', assets]
        run(args, env=env)
        source_list = build / 'sources.txt'
        # javac argument-file quoting preserves spaces in user project paths.
        source_list.write_text('\n'.join(json.dumps(str(p)) for p in sources + sorted(generated.rglob('*.java'))))
        run(['javac', '-encoding', 'UTF-8', '--release', '8', '-classpath',
             ':'.join(map(str, [android, *libraries])), '-d', classes, '@' + str(source_list)], env=env)
        run(['jar', 'cf', build / 'classes.jar', '-C', classes, '.'], env=env)
        run([tools / 'd8', '--lib', android, '--min-api', str(minimum), '--output', build,
             build / 'classes.jar', *libraries], env=env)
        with zipfile.ZipFile(build / 'base.apk', 'a') as archive:
            for dex in build.glob('classes*.dex'):
                archive.write(dex, dex.name)
            native = source('nativeLibraries', 'jniLibs')
            for library in native.glob('*/*.so'):
                resolved = library.resolve()
                resolved.relative_to(project)
                archive.write(resolved, 'lib/' + library.relative_to(native).as_posix())
        run([tools / 'zipalign', '-P', '16', '-f', '4', build / 'base.apk', build / 'aligned.apk'], env=env)
        key = BASE / 'debug.p12'
        password = BASE / 'debug-password'
        if key.exists() != password.exists():
            raise ValueError('调试签名密钥与口令文件不完整，请恢复原签名文件后重试')
        if not key.exists():
            import secrets
            secret = secrets.token_urlsafe(32)
            password.write_text(secret)
            password.chmod(0o600)
            keyenv = dict(env, EVA_ANDROID_SIGN_PASSWORD=secret)
            run(['keytool', '-genkeypair', '-keystore', key, '-storepass:env', 'EVA_ANDROID_SIGN_PASSWORD',
                 '-storetype', 'PKCS12', '-noprompt', '-alias', 'eva-debug', '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000',
                 '-dname', 'CN=Eva Local Debug'], env=keyenv)
            key.chmod(0o600)
        keyenv = dict(env, EVA_ANDROID_SIGN_PASSWORD=password.read_text())
        apk = output / 'app-debug.apk'
        run([tools / 'apksigner', 'sign', '--ks', key, '--ks-pass', 'env:EVA_ANDROID_SIGN_PASSWORD',
             '--out', apk, build / 'aligned.apk'], env=keyenv)
        run([tools / 'apksigner', 'verify', '--verbose', apk], env=env)
        return [apk]


def build(project, output, task):
    project = workspace_path(project)
    if not project.is_dir():
        raise ValueError('项目路径必须是目录')
    output = Path(output).absolute()
    output.parent.resolve(strict=True).relative_to(WORKSPACE.resolve())
    if output.exists() or output.is_symlink():
        raise ValueError('输出目录须为工作区中的新目录')
    if not status()['ready']:
        raise ValueError('Android 工具链未就绪，请先运行 install')
    BASE.mkdir(parents=True, exist_ok=True)
    with (BASE / 'build.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        output.mkdir()
        env = environment()
        try:
            if (project / 'eva-android.json').is_file():
                apks = java_build(project, output, env)
            else:
                if not task or task.startswith('-') or not all(c.isalnum() or c in ':_-' for c in task):
                    raise ValueError('Gradle 任务名称无效')
                task_name = task.rsplit(':', 1)[-1]
                if not task_name.startswith('assemble'):
                    raise ValueError('APK 构建任务须为 assemble 或 assembleVariant')
                wrapper = project / 'gradlew'
                if wrapper.exists():
                    wrapper.resolve(strict=True).relative_to(project)
                command = ['sh', str(wrapper)] if wrapper.is_file() else ['gradle']
                run([*command, '--no-daemon', '--no-watch-fs', '-Dorg.gradle.native=false',
                     '-Dorg.gradle.java.home=' + str(JAVA_HOME),
                     '-Porg.gradle.java.installations.auto-detect=false',
                     '-Porg.gradle.java.installations.auto-download=false',
                     '-Porg.gradle.java.installations.paths=' + str(JAVA_HOME),
                     '-Pandroid.aapt2FromMavenOverride=' + str(SDK / 'build-tools/36.0.0/aapt2'), task],
                    cwd=project, env=env, timeout=1800)
                variant = task_name[len('assemble'):].lower()
                apks = sorted(project.glob('**/build/outputs/apk/**/*.apk'))
                if variant:
                    apks = [apk for apk in apks if variant in ('/' + apk.relative_to(project).as_posix()).split('/build/outputs/apk/', 1)[1].rsplit('/', 1)[0].replace('/', '').lower()]
                if not apks:
                    raise ValueError('Gradle 已结束但没有 APK 输出')
                copied = []
                for number, apk in enumerate(apks):
                    apk.resolve(strict=True).relative_to(project)
                    dest = output / (str(number + 1) + '-' + apk.name)
                    shutil.copy2(apk, dest)
                    copied.append(dest)
                apks = copied
            result = {'passed': True, 'phoneLocal': True, 'project': str(project),
                      'apks': [str(p) for p in apks]}
            (output / 'build-result.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
            return result
        except BaseException as error:
            (output / 'build-failure.txt').write_text(str(error))
            raise


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['status', 'install', 'build'])
    parser.add_argument('--project')
    parser.add_argument('--output-dir')
    parser.add_argument('--task', default='assembleDebug')
    args = parser.parse_args()
    if args.action == 'build' and (not args.project or not args.output_dir):
        parser.error('build 需要 --project 和 --output-dir')
    emit(status() if args.action == 'status' else install() if args.action == 'install' else
         build(args.project, args.output_dir, args.task))


if __name__ == '__main__':
    signal.signal(signal.SIGTERM, cancelled)
    signal.signal(signal.SIGINT, cancelled)
    try:
        main()
    except Exception as error:
        emit({'error': str(error)})
        raise SystemExit(1)
