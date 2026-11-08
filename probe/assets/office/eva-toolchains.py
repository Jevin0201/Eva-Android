"""Project-scoped toolchain preparation. Existing managed installers own downloads."""
import contextlib
import fcntl
import hashlib
import json
import os
import pathlib
import re
import runpy
import shutil
import signal
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

BASE = pathlib.Path('/root/.eva-dependencies/toolchains')
RUNTIME = pathlib.Path('/root/.eva-runtime')
REGISTRIES = ('https://registry.npmjs.org', 'https://registry.npmmirror.com')
JAVA_HOMES = {17: pathlib.Path('/usr/lib/jvm/java-17-openjdk'),
              21: RUNTIME / 'java21/current'}


class ToolchainError(RuntimeError):
    def __init__(self, message, logs):
        super().__init__(message + '\nLogs: ' + str(logs))
        self.logDirectory = str(logs)
        attempts = pathlib.Path(logs) / 'source-attempts.json'
        self.sourceAttempts = json.loads(attempts.read_text()) if attempts.is_file() else []
        self.retryable = _network_failure(message)


def _network_failure(error):
    policy = RUNTIME / 'eva-download-policy.py'
    if not policy.is_file():
        policy = pathlib.Path(__file__).with_name('eva-download-policy.py')
    if not policy.is_file():
        return False  # No unverified retry classifier.
    return runpy.run_path(str(policy))['is_network_failure'](error)


def _check_cancel():
    marker = os.environ.get('EVA_DEPENDENCY_CANCEL_FILE')
    if marker and pathlib.Path(marker).exists():
        raise InterruptedError('依赖任务已取消；已完成事务保留，不继续后续步骤')


def _run(arguments, job, env=None, timeout=120):
    _check_cancel()
    log = job / ('command-' + str(time.time_ns()) + '.log')
    arguments = list(map(str, arguments))
    transaction = 'install' in arguments or 'add' in arguments
    with log.open('w') as output:
        output.write(json.dumps({'argv': arguments}, ensure_ascii=False) + '\n')
        output.flush()
        process = subprocess.Popen(arguments, stdout=output, stderr=subprocess.STDOUT,
                                   env=env, start_new_session=True)
        previous = None
        if hasattr(signal, 'SIGTERM'):
            def terminate(*_):
                raise InterruptedError('依赖任务已取消')
            previous = signal.signal(signal.SIGTERM, terminate)
        try:
            code = process.wait(timeout=timeout)
        except BaseException:
            if transaction:
                output.write('\nInstallation is finishing before interruption is reported.\n')
                output.flush()
                process.wait()
            else:
                with contextlib.suppress(ProcessLookupError):
                    os.killpg(process.pid, signal.SIGKILL)
                process.wait()
            raise
        finally:
            if previous is not None:
                signal.signal(signal.SIGTERM, previous)
    _check_cancel()
    text = log.read_text(errors='replace').split('\n', 1)[-1]
    if code:
        raise ToolchainError('命令失败 (' + str(code) + '): ' + text[-8000:], job)
    return text.strip()


def _json_command(arguments, job, timeout=120):
    text = _run(arguments, job, timeout=timeout)
    for line in reversed(text.splitlines()):
        try:
            value = json.loads(line)
            if isinstance(value, dict):
                return value
        except ValueError:
            pass
    raise ToolchainError('托管安装器未返回 JSON 状态: ' + text[-3000:], job)


def _apk(packages, job):
    _run([sys.executable, RUNTIME / 'eva-capabilities.py', 'install', '--apk', *packages], job, timeout=600)


def _source_attempt(job, source, stage, error=None):
    path = job / 'source-attempts.json'
    attempts = json.loads(path.read_text()) if path.is_file() else []
    attempts.append({'source': source, 'stage': stage, 'error': str(error) if error else None,
                     'retryable': _network_failure(error) if error else False})
    path.write_text(json.dumps(attempts, ensure_ascii=False, indent=2))


def _metadata(name, version, registry):
    _check_cancel()
    url = registry + '/' + urllib.parse.quote(name, safe='@') + '/' + urllib.parse.quote(version, safe='')
    try:
        with urllib.request.urlopen(url, timeout=25) as response:
            if urllib.parse.urlsplit(response.url).scheme != 'https':
                raise ValueError('npm 元数据下载必须保持 HTTPS')
            body = response.read(4 * 1024 * 1024 + 1)
    except urllib.error.HTTPError as error:
        raise
    if len(body) > 4 * 1024 * 1024:
        raise ValueError('npm 元数据过大')
    return json.loads(body)


def _binary(value):
    if not isinstance(value, str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._+-]*', value):
        raise ValueError('binary 需要明确的可执行文件名')
    return value


def _npm(requirement, scope, job, action):
    name = requirement.get('name', '')
    if not isinstance(name, str) or len(name)>214 or not re.fullmatch(r'(?:@[a-z0-9][a-z0-9._-]*/)?[a-z0-9][a-z0-9._-]*', name):
        raise ValueError('npm 只接受明确包名，不接受 URL、选项或 shell 片段')
    version = str(requirement.get('version') or 'latest')
    if version != 'latest' and not re.fullmatch(r'[0-9]+\.[0-9]+\.[0-9]+(?:-[A-Za-z0-9.-]+)?(?:\+[A-Za-z0-9.-]+)?', version):
        raise ValueError('npm version 需要精确版本号')
    module = requirement.get('module', name)
    if not isinstance(module, str) or not (module == name or re.fullmatch(re.escape(name) + r'/[A-Za-z0-9_./-]+', module)) or '..' in module.split('/'):
        raise ValueError('module 必须属于请求的 npm 包')
    binary = _binary(requirement['binary']) if requirement.get('binary') else None
    prefix = scope / 'npm' / hashlib.sha256((name + '\n' + version).encode()).hexdigest()[:24]
    package = prefix / 'node_modules' / name / 'package.json'
    node, npm = shutil.which('node'), shutil.which('npm')
    changed = False
    if not node or not npm:
        if action == 'status':
            return {'ready': False, 'missing': ['node', 'npm'], 'changed': False}
        _apk(['nodejs', 'npm'], job)
        changed = True
        node, npm = shutil.which('node'), shutil.which('npm')
        if not node or not npm:
            raise RuntimeError('签名软件包安装后仍找不到 node/npm')
    env = dict(os.environ)
    env['NODE_PATH'] = str(prefix / 'node_modules') + (os.pathsep + env['NODE_PATH'] if env.get('NODE_PATH') else '')
    env['PATH'] = str(prefix / 'node_modules/.bin') + os.pathsep + env.get('PATH', '')

    def verify():
        installed = json.loads(package.read_text())
        if installed.get('name') != name or (version != 'latest' and installed.get('version') != version):
            raise ValueError('托管 npm 包版本不匹配')
        if binary:
            executable = prefix / 'node_modules/.bin' / binary
            executable.resolve(strict=True).relative_to(prefix.resolve())
            proof = _run([executable, '--version'], job, env)
        else:
            preload = prefix / '.eva-module-preload.cjs'
            preload.write_text("const packageName = " + json.dumps(name) + ";\n" +
                               "const prefix = " + json.dumps(str(prefix)) + ";\n" + """
const Module = require('node:module');
const resolve = Module._resolveFilename;
const pinnedParent = new Module(prefix + '/package.json');
pinnedParent.filename = prefix + '/package.json';
pinnedParent.paths = Module._nodeModulePaths(prefix);
Module._resolveFilename = function(request, parent, isMain, options) {
  if (request === packageName || request.startsWith(packageName + '/')) {
    return resolve.call(this, request, pinnedParent, isMain, {...options, paths: [prefix]});
  }
  return resolve.call(this, request, parent, isMain, options);
};
""")
            script = "const p=require.resolve(process.argv[1]);import(require('node:url').pathToFileURL(p).href).then(()=>console.log(JSON.stringify({verified:true,importPath:p}))).catch(e=>{console.error(e);process.exit(1)})"
            proof = _run([node, '--require', preload, '-e', script, module], job, env)
            import_path = json.loads(proof.splitlines()[-1])['importPath']
            loader = prefix / '.eva-module-loader.mjs'
            loader.write_text("const packageName = " + json.dumps(name) + ";\n" + """
export async function resolve(specifier, context, nextResolve) {
  if (specifier === packageName || specifier.startsWith(packageName + '/')) {
    return nextResolve(specifier, {...context, parentURL: new URL('./package.json', import.meta.url).href});
  }
  return nextResolve(specifier, context);
}
""")
            esm = "import(process.argv[1]).then(()=>console.log('esm module verified')).catch(e=>{console.error(e);process.exit(1)})"
            _run([node, '--experimental-loader', loader, '--input-type=module', '-e', esm, module], job, env)
        return {'ready': True, 'verified': True, 'version': installed['version'], 'proof': proof,
                'prefix': str(prefix), 'npmPrefix': str(prefix), 'nodeExecutable': node, 'moduleName': module,
                'importPath': None if binary else import_path,
                'moduleLoader': None if binary else str(loader), 'modulePreload': None if binary else str(preload), 'scope': 'project-private-prefix', 'environment': {'NODE_PATH': env['NODE_PATH'], 'PATH': env['PATH']},
                'commandPrefix': [str(prefix / 'node_modules/.bin' / binary)] if binary else [node, '--require', str(preload), '--experimental-loader', str(loader)]}
    if package.is_file():
        try:
            return {**verify(), 'changed': changed}
        except Exception:
            if action == 'status':
                return {'ready': False, 'changed': False, 'prefix': str(prefix)}
    elif action == 'status':
        return {'ready': False, 'changed': False, 'prefix': str(prefix)}
    metadata = None
    failures = []
    for registry in REGISTRIES:
        try:
            metadata = _metadata(name, version, registry)
            _source_attempt(job, registry, 'metadata')
            break
        except Exception as error:
            failures.append(registry + ': ' + str(error))
            _source_attempt(job, registry, 'metadata', error)
            if not _network_failure(error):
                raise
    if metadata is None:
        raise RuntimeError('npm 所有源失败: ' + '\n'.join(failures))
    resolved = metadata.get('version', '')
    if metadata.get('name') != name or not re.fullmatch(r'[0-9]+\.[0-9]+\.[0-9]+(?:-[A-Za-z0-9.-]+)?(?:\+[A-Za-z0-9.-]+)?', resolved) or (version != 'latest' and resolved != version):
        raise ValueError('npm 官方目录包身份或版本不匹配')
    license_value = metadata.get('license')
    integrity = metadata.get('dist', {}).get('integrity')
    if not license_value or not isinstance(integrity, str) or not integrity.startswith(('sha512-', 'sha256-', 'sha1-')):
        raise ValueError('npm 包缺少许可证或完整性元数据')
    prefix.mkdir(parents=True, exist_ok=True)
    (job / 'npm-source.json').write_text(json.dumps({'name': name, 'version': resolved, 'license': license_value,
                                                  'integrity': integrity, 'registry': registry, 'failures': failures}, indent=2))
    registries = REGISTRIES[REGISTRIES.index(registry):]
    for index, source in enumerate(registries):
        try:
            if source != registry:
                mirror = _metadata(name, resolved, source)
                if mirror.get('dist', {}).get('integrity') != integrity:
                    raise ValueError('npm 镜像完整性与固定元数据不一致')
            _source_attempt(job, source, 'install')
            _run([npm, '--prefix', prefix, 'install', '--save-exact', '--no-audit', '--no-fund',
                  '--fetch-timeout=60000', '--fetch-retries=1', '--registry=' + source, '--', name + '@' + resolved], job, env, timeout=600)
            break
        except Exception as error:
            _source_attempt(job, source, 'install', error)
            if not _network_failure(error) or index == len(registries) - 1:
                raise
    lock = json.loads((prefix / 'package-lock.json').read_text())
    if lock.get('packages', {}).get('node_modules/' + name, {}).get('integrity') != integrity:
        raise ValueError('npm lock 完整性与固定版本目录不一致')
    return {**verify(), 'changed': True, 'source': str(job / 'npm-source.json')}


def _java(requirement, job, action):
    version = str(requirement.get('version') or '17')
    if version not in ('17', '21'):
        raise ValueError('当前只验证 Java 17/21，不将其他版本冒充可用')
    major = int(version)
    home = JAVA_HOMES[major]
    changed = False
    if not (home / 'bin/javac').is_file() or not (home / 'bin/java').is_file():
        if action == 'status':
            return {'ready': False, 'changed': False, 'javaHome': str(home)}
        _apk(['openjdk' + version + '-jdk'] + (['build-base'] if major == 21 else []), job)
        if major == 21:
            _json_command([sys.executable, RUNTIME / 'eva-java21.py', 'install'], job, timeout=600)
        changed = True
    env = dict(os.environ, JAVA_HOME=str(home))
    env['PATH'] = str(home / 'bin') + os.pathsep + env.get('PATH', '')
    proof = _run([home / 'bin/java', '-version'], job, env)
    if not re.search(r'version\s+"' + version + r'(?:[.\"])', proof):
        raise RuntimeError('Java 实际版本与请求不匹配: ' + proof)
    with tempfile.TemporaryDirectory(prefix='java-check-', dir=job) as temporary:
        source = pathlib.Path(temporary) / 'EvaToolchainCheck.java'
        source.write_text('public class EvaToolchainCheck { public static void main(String[] args) { System.out.print(6*7); } }')
        _run([home / 'bin/javac', source], job, env)
        if _run([home / 'bin/java', '-cp', temporary, 'EvaToolchainCheck'], job, env) != '42':
            raise RuntimeError('Java 编译执行样例未通过')
    return {'ready': True, 'verified': True, 'changed': changed, 'javaHome': str(home),
            'environment': {'JAVA_HOME': str(home), 'PATH': env['PATH']},
            'commandPrefix': [str(home / 'bin/java')], 'version': proof}


def _android(requirement, job, action):
    if requirement.get('version') not in (None, '', '36', 36):
        raise ValueError('当前托管 Android SDK 只验证 API 36')
    helper = RUNTIME / 'eva-android-build.py'
    status = _json_command([sys.executable, helper, 'status'], job)
    changed = False
    if not status.get('ready'):
        if action == 'status':
            return {'ready': False, 'changed': False, 'status': status}
        _run([sys.executable, helper, 'install'], job, timeout=720)
        status = _json_command([sys.executable, helper, 'status'], job)
        changed = True
    if not status.get('ready'):
        raise RuntimeError('Android 托管构建链安装后仍未就绪')
    sdk = pathlib.Path(status['sdk'])
    aapt = sdk / 'build-tools/36.0.0/aapt2'
    proof = _run([aapt, 'version'], job)
    environment = {'ANDROID_HOME': str(sdk), 'ANDROID_SDK_ROOT': str(sdk),
                   'PATH': str(aapt.parent) + os.pathsep + os.environ.get('PATH', '')}
    if status.get('java'):
        home = pathlib.Path(status['java']).parent.parent
        environment['JAVA_HOME'] = str(home)
        environment['PATH'] = str(home / 'bin') + os.pathsep + environment['PATH']
    return {'ready': True, 'verified': True, 'changed': changed, 'sdk': str(sdk), 'proof': proof,
            'environment': environment, 'aapt2Executable': str(aapt),
            'commandPrefix': [sys.executable, str(helper)]}


def _system(requirement, job, action):
    name = requirement.get('name', '')
    if not isinstance(name, str) or not re.fullmatch(r'[a-z0-9][a-z0-9+_.-]*', name):
        raise ValueError('system 需要明确 Alpine 软件包名')
    binary = _binary(requirement.get('binary'))
    if requirement.get('version'):
        raise ValueError('系统软件版本由签名仓库固定并记录，暂不接受任意版本覆盖')
    executable = shutil.which(binary)
    changed = False
    if not executable:
        if action == 'status':
            return {'ready': False, 'changed': False, 'missing': [binary]}
        _apk([name], job)
        executable = shutil.which(binary)
        changed = True
    if not executable:
        raise RuntimeError('安装后找不到请求的可执行文件: ' + binary)
    proof = _run([executable, '--version'], job)
    return {'ready': True, 'verified': True, 'changed': changed, 'proof': proof,
            'executable': executable, 'commandPrefix': [executable]}


def ensure_requirement(requirement, project_path, action):
    if action not in ('status', 'ensure'):
        raise ValueError('不支持的工具链操作')
    kind = requirement.get('kind')
    if kind not in ('npm', 'java', 'android', 'system'):
        raise ValueError('不支持的工具链种类')
    project = pathlib.Path(project_path).resolve(strict=True)
    if not project.is_dir():
        raise ValueError('项目目录不存在')
    scope = BASE / hashlib.sha256(str(project).encode()).hexdigest()[:24]
    scope.mkdir(parents=True, exist_ok=True)
    if scope.is_symlink() or not scope.resolve().is_relative_to(BASE.resolve()):
        raise ValueError('工具链目录包含链接或越界')
    job = scope / 'logs' / str(time.time_ns())
    job.mkdir(parents=True)
    with (scope / 'repair.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        try:
            if kind == 'npm':
                result = _npm(requirement, scope, job, action)
            elif kind == 'java':
                result = _java(requirement, job, action)
            elif kind == 'android':
                result = _android(requirement, job, action)
            else:
                result = _system(requirement, job, action)
            _check_cancel()
            result.update(kind=kind, name=requirement.get('name', kind), logDirectory=str(job))
            (job / 'result.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
            return result
        except Exception as error:
            (job / 'failure.txt').write_text(str(error))
            raise ToolchainError(str(error), job) from error
