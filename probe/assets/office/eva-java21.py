"""Install and verify Eva's scoped OpenJDK 21 memory-mapping adapter."""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import tempfile

BASE = Path('/root/.eva-runtime/java21')
SYSTEM = Path('/usr/lib/jvm/java-21-openjdk')
SOURCE = Path(__file__).with_name('eva-java21-memory.c')


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def run(args, env=None):
    result = subprocess.run(list(map(str, args)), env=env, capture_output=True,
                            text=True, timeout=120)
    if result.returncode:
        raise RuntimeError((result.stdout + result.stderr)[-5000:])
    return result.stdout + result.stderr


def selftest(home):
    env = {**os.environ, 'JAVA_HOME': str(home)}
    version = run([home / 'bin/java', '-version'], env)
    if 'version "21.' not in version:
        raise RuntimeError('Expected OpenJDK 21: ' + version)
    code = '''import java.util.concurrent.*;
public class EvaJava21Check {
 public static void main(String[] args) throws Exception {
  var executor = Executors.newVirtualThreadPerTaskExecutor();
  try (executor) {
   var answer = executor.submit(() -> {
    long sum = 0;
    for (int i = 0; i < 1000000; i++) sum += i;
    return sum;
   }).get();
   if (answer != 499999500000L) throw new AssertionError(answer);
   System.out.println("PASS Java21 compiler, lambda, virtual thread and hot loop");
  }
 }
}
'''
    with tempfile.TemporaryDirectory(prefix='verify-', dir=BASE) as folder:
        path = Path(folder)
        (path / 'EvaJava21Check.java').write_text(code)
        run([home / 'bin/javac', path / 'EvaJava21Check.java'], env)
        outputs = [run([home / 'bin/java', *options, '-cp', path, 'EvaJava21Check'], env)
                   for options in [[], ['-Xint'], ['-Xcomp', '-XX:CompileThreshold=100']]]
        if not all('PASS Java21' in output for output in outputs):
            raise RuntimeError('Java21 execution checks failed')
    return {'ready': True, 'javaHome': str(home), 'version': version.strip(),
            'checks': ['javac', 'lambda', 'virtual-thread', 'hot-loop',
                       'mixed-mode', 'interpreted-mode', 'compiled-mode']}


def install():
    if platform.machine() != 'aarch64' or not Path('/etc/alpine-release').is_file():
        raise RuntimeError('This adapter requires the Alpine aarch64 Eva runtime')
    if not (SYSTEM / 'bin/java').is_file() or not shutil.which('gcc'):
        raise RuntimeError('Install signed Alpine openjdk21-jdk and build-base packages first')
    BASE.mkdir(parents=True, exist_ok=True)
    with (BASE / 'installation.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        identity = digest(SOURCE)[:16] + '-' + digest(SYSTEM / 'lib/server/libjvm.so')[:16]
        builds = BASE / 'builds'
        builds.mkdir(exist_ok=True)
        target = builds / identity
        if not target.exists():
            with tempfile.TemporaryDirectory(prefix='build-', dir=BASE) as folder:
                stage = Path(folder) / 'runtime'
                stage.mkdir()
                shutil.copyfile(SOURCE, stage / 'eva-java21-memory.c')
                run(['gcc', '-O2', '-Wall', '-Wextra', '-Werror', '-shared', '-fPIC',
                     '-o', stage / 'libeva-java21-memory.so', SOURCE, '-ldl'])
                for source in SYSTEM.iterdir():
                    if source.name != 'bin':
                        (stage / source.name).symlink_to(source)
                (stage / 'bin').mkdir()
                for source in (SYSTEM / 'bin').iterdir():
                    if source.is_file():
                        wrapper = stage / 'bin' / source.name
                        wrapper.write_text(
                            '#!/bin/sh\n'
                            'EVA_JAVA21_COMPAT=1\n'
                            f'LD_PRELOAD="{target}/libeva-java21-memory.so${{LD_PRELOAD:+:$LD_PRELOAD}}"\n'
                            'export EVA_JAVA21_COMPAT LD_PRELOAD\n'
                            f'exec "{source}" "$@"\n')
                        wrapper.chmod(0o755)
                manifest = {'systemJavaHome': str(SYSTEM), 'sourceSha256': digest(SOURCE),
                            'systemJvmSha256': digest(SYSTEM / 'lib/server/libjvm.so'),
                            'adapterSha256': digest(stage / 'libeva-java21-memory.so')}
                (stage / 'eva-runtime.json').write_text(json.dumps(manifest, indent=2) + '\n')
                stage.rename(target)
        # Check a completed generation before switching the active launcher.
        result = selftest(target)
        current = BASE / 'current'
        if current.exists() and not current.is_symlink():
            raise RuntimeError('Existing current path is unmanaged; preserved')
        pending = BASE / 'current.next'
        pending.unlink(missing_ok=True)
        pending.symlink_to(target)
        pending.replace(current)
        result['javaHome'] = str(current)
        (BASE / 'verification.json').write_text(json.dumps(result, indent=2) + '\n')
        return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['install', 'status', 'selftest'])
    action = parser.parse_args().action
    if action == 'install':
        result = install()
    elif action == 'selftest':
        result = selftest(BASE / 'current')
    else:
        home = BASE / 'current'
        result = {'installed': (home / 'bin/java').is_file(), 'javaHome': str(home)}
        if result['installed']:
            manifest = json.loads((home / 'eva-runtime.json').read_text())
            result['systemJvmUnchanged'] = manifest['systemJvmSha256'] == digest(SYSTEM / 'lib/server/libjvm.so')
            result['adapterUnchanged'] = manifest['adapterSha256'] == digest(home / 'libeva-java21-memory.so')
    print(json.dumps(result, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'error': str(error)}, ensure_ascii=False), flush=True)
        raise SystemExit(1)
