#!/usr/bin/env python3
"""Task-scoped Python dependency discovery and recoverable isolated repair."""
import fcntl
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import runpy
import shlex
import signal
import subprocess
import sys
import tempfile
import time
from urllib.parse import unquote, urlsplit

WORKSPACE = Path('/root/eva-workspace')
ENVIRONMENTS = Path('/root/.eva-python/environments')
MANAGED = Path('/root/.eva-office/lib')
CAPABILITIES = '/root/.eva-runtime/eva-capabilities.py'
ALIASES = {'docx': 'python-docx', 'pptx': 'python-pptx', 'PIL': 'Pillow', 'lxml': 'lxml', 'yaml': 'PyYAML'}
NATIVE = {'pillow': 'py3-pillow', 'lxml': 'py3-lxml'}
MODULE = re.compile(r'[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*')
PACKAGE = re.compile(r'([A-Za-z0-9][A-Za-z0-9._-]{0,127})(?:==([A-Za-z0-9][A-Za-z0-9.!+_-]{0,99}))?')
MAX_LOG = 1024 * 1024



SIGNALLED = False


class Cancelled(RuntimeError):
    pass


def check_cancel():
    marker = os.environ.get('EVA_DEPENDENCY_CANCEL_FILE')
    if SIGNALLED or (marker and Path(marker).is_file()):
        raise Cancelled('Dependency request cancelled; completed installations and logs are retained')


def redact(value):
    text = str(value)
    for name in ('HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy', 'PIP_INDEX_URL', 'PIP_EXTRA_INDEX_URL'):
        secret = os.environ.get(name, '')
        if not secret:
            continue
        parsed = urlsplit(secret)
        credentials = None
        if parsed.username is not None:
            credentials = base64.b64encode((unquote(parsed.username) + ':' + unquote(parsed.password or '')).encode()).decode()
        for fragment in (secret, parsed.password, credentials):
            if fragment and len(fragment) >= 3:
                text = text.replace(fragment, '[redacted]').replace(unquote(fragment), '[redacted]')
    return re.sub(r'(https?://)[^\s/@]+:[^\s/@]+@', r'\1[redacted]@', text)


def specifications(request):
    if request.get('action') not in ('status', 'ensure'):
        raise ValueError('action must be status or ensure')
    rows = request.get('python')
    if not isinstance(rows, list) or not 1 <= len(rows) <= 16:
        raise ValueError('python must contain 1 to 16 module requests')
    result, seen = [], set()
    for row in rows:
        if not isinstance(row, dict) or set(row) - {'module', 'package', 'version'}:
            raise ValueError('A Python dependency accepts only module, package and optional version')
        module = row.get('module')
        if not isinstance(module, str) or len(module) > 200 or not MODULE.fullmatch(module) or module in seen:
            raise ValueError('Module names must be unique Python import names')
        seen.add(module)
        package = row.get('package') or ALIASES.get(module)
        version = row.get('version')
        if version is not None and (not isinstance(version, str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9.!+_-]{0,99}', version)):
            raise ValueError('version must be a fixed package version')
        if package is not None:
            if not isinstance(package, str) or not PACKAGE.fullmatch(package):
                raise ValueError('package must be a PyPI name, optionally pinned with ==version; URLs, paths and options are unsupported')
            name, embedded_version = PACKAGE.fullmatch(package).groups()
            if version is not None and embedded_version is not None and version != embedded_version:
                raise ValueError('Conflicting fixed package versions')
            version = version or embedded_version
            package = name
        elif version is not None:
            raise ValueError('A fixed version requires an explicit package or known module alias')
        result.append({'module': module, 'package': package, 'version': version})
    return result


def project_path(value):
    if not isinstance(value, str) or len(value) > 4096:
        raise ValueError('projectPath must be a workspace directory')
    root = WORKSPACE.resolve()
    lexical = Path(os.path.abspath(value))
    if not lexical.is_relative_to(WORKSPACE.absolute()):
        raise ValueError('projectPath must be inside the Eva workspace')
    resolved = lexical.resolve()
    if not resolved.is_relative_to(root):
        raise ValueError('projectPath follows a symlink outside the Eva workspace')
    if resolved.exists() and not resolved.is_dir():
        raise ValueError('projectPath must be a directory')
    return resolved


def environment_path(project):
    path = ENVIRONMENTS / hashlib.sha256(str(project).encode()).hexdigest()[:32]
    if path.is_symlink() or ENVIRONMENTS.resolve() != ENVIRONMENTS.absolute():
        raise ValueError('Managed dependency environments must not use redirected directories')
    return path


def python_environment(executable=None):
    env = dict(os.environ)
    existing = env.get('PYTHONPATH', '')
    isolated = executable is not None and str(executable).startswith(str(ENVIRONMENTS) + os.sep)
    paths = [path for path in existing.split(os.pathsep) if path != str(MANAGED)] if isolated else existing.split(os.pathsep)
    if not isolated and MANAGED.is_dir():
        paths.insert(0, str(MANAGED))
    env['PYTHONPATH'] = os.pathsep.join(dict.fromkeys(path for path in paths if path))
    if isolated:
        env['PATH'] = str(Path(executable).parent) + os.pathsep + env.get('PATH', '')
    env['PYTHONUNBUFFERED'] = '1'
    env['PIP_DISABLE_PIP_VERSION_CHECK'] = '1'
    env['PIP_NO_INPUT'] = '1'
    return env


def run(command, deadline, log=None, timeout=600):
    check_cancel()
    transactional = ('-m' in command and 'pip' in command and 'install' in command) or (CAPABILITIES in command and 'install' in command)
    remaining = min(timeout, deadline - time.monotonic())
    if remaining <= 0:
        raise RuntimeError('Dependency repair timed out; the environment and logs are retained')
    child = None
    with tempfile.TemporaryFile() as output:
        try:
            child = subprocess.Popen(command, stdout=output, stderr=subprocess.STDOUT, env=python_environment(command[0]), start_new_session=True)
            end = time.monotonic() + remaining
            finishing = False
            while child.poll() is None:
                if not transactional:
                    check_cancel()
                if time.monotonic() >= end:
                    if not transactional:
                        raise RuntimeError('Dependency command timed out')
                    if not finishing:
                        print(json.dumps({'progress': '安装事务仍在安全收尾，不再启动后续步骤', 'installationMayBeFinishing': True}), flush=True)
                        finishing = True
                if output.tell() > MAX_LOG:
                    if not transactional:
                        raise RuntimeError('Dependency command exceeded the output limit')
                    output.seek(0)
                    output.truncate()
                time.sleep(0.05)
        finally:
            if child is not None and child.poll() is None:
                try:
                    os.killpg(child.pid, signal.SIGTERM)
                except ProcessLookupError:
                    pass
                try:
                    child.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    try:
                        os.killpg(child.pid, signal.SIGKILL)
                    except ProcessLookupError:
                        pass
                    child.wait(timeout=3)
            output.seek(0)
            text = redact(output.read(MAX_LOG).decode('utf-8', errors='replace'))
            if log is not None:
                with log.open('a', encoding='utf-8') as stream:
                    stream.write(redact(shlex.join(command)) + '\n' + text + '\n')
        check_cancel()
        if child.returncode:
            raise RuntimeError('Dependency command exited ' + str(child.returncode) + ': ' + text[-5000:])
        return text


PROBE = r'''
import contextlib, importlib, importlib.metadata, io, json, sys
rows=[]
for spec in json.loads(sys.argv[1]):
 row={'module':spec['module'],'ready':False}
 try:
  with contextlib.redirect_stdout(io.StringIO()),contextlib.redirect_stderr(io.StringIO()):
   module=importlib.import_module(spec['module'])
  version=getattr(module,'__version__',None)
  if spec.get('package'):
   try:version=importlib.metadata.version(spec['package'])
   except importlib.metadata.PackageNotFoundError:pass
  row.update(ready=True,path=getattr(module,'__file__',None),version=str(version) if version is not None else None)
  if spec.get('version') and row['version']!=spec['version']:
   row.update(ready=False,error='Installed version does not match requested version '+spec['version'])
 except Exception as error:row['error']=type(error).__name__+': '+str(error)
 rows.append(row)
print(json.dumps(rows))
'''


def probe(executable, specs, deadline):
    rows = json.loads(run([str(executable), '-c', PROBE, json.dumps(specs)], deadline, timeout=30))
    if not isinstance(rows, list) or len(rows) != len(specs):
        raise RuntimeError('Python import verification returned invalid output')
    return rows


def pip_available(executable, deadline):
    try:
        run([str(executable), '-m', 'pip', '--version'], deadline, timeout=30)
        return True
    except RuntimeError:
        return False



def install_python_packages(executable, requirements, deadline, log):
    policy = runpy.run_path(str(Path(__file__).with_name('eva-download-policy.py')))
    attempts = []
    cache = ENVIRONMENTS.parent / 'pip-cache'
    cache.mkdir(parents=True, exist_ok=True)
    for index in policy['pip_indexes']():
        attempts.append({'source': index})
        command = [str(executable), '-m', 'pip', 'install', '--disable-pip-version-check', '--no-input', '--timeout', '30', '--retries', '1', '--cache-dir', str(cache), '--index-url', index, '--', *requirements]
        try:
            run(command, deadline, log)
            return attempts
        except Exception as error:
            attempts[-1]['failure'] = 'network' if policy['is_network_failure'](error) else 'package-or-verification'
            if not policy['is_network_failure'](error) or index == policy['pip_indexes']()[-1]:
                error.sourceAttempts = attempts
                error.retryable = policy['is_network_failure'](error)
                raise
    return attempts


def ensure_pip(deadline, log):
    if not pip_available(sys.executable, deadline):
        run([sys.executable, CAPABILITIES, 'install', '--apk', 'py3-pip'], deadline, log, timeout=600)
        if not pip_available(sys.executable, deadline):
            raise RuntimeError('Signed py3-pip installation did not provide pip; inspect the retained log')


def response(project, executable, modules, installed, **extra):
    selected = python_environment(executable)
    command = ['env', 'PYTHONPATH=' + selected.get('PYTHONPATH', ''), 'PATH=' + selected.get('PATH', ''), str(executable)]
    return dict(ready=all(row['ready'] for row in modules), projectPath=str(project), pythonExecutable=str(executable), installed=installed,
                modules=modules, command=command, nextUsage=shlex.join(command + ['your_script.py']), **extra)


def execute_python(request):
    specs = specifications(request)
    project = project_path(request.get('projectPath', str(WORKSPACE)))
    environment = environment_path(project)
    executable = environment / 'bin/python' if (environment / 'bin/python').is_file() else Path(sys.executable)
    deadline = time.monotonic() + (540 if request['action'] == 'ensure' else 50)
    modules = probe(executable, specs, deadline)
    missing = [spec for spec, row in zip(specs, modules) if not row['ready']]
    if request['action'] == 'status' or not missing:
        return response(project, executable, modules, [])
    if any(not spec['package'] for spec in missing):
        return response(project, executable, modules, [], error='Missing imports require an explicit package name; unknown module names are never guessed')
    environment.mkdir(mode=0o700, parents=True, exist_ok=True)
    log = environment / ('repair-' + str(time.time_ns()) + '.log')
    descriptor = os.open(log, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    os.close(descriptor)
    installed, source_attempts = [], []
    try:
        with (environment / 'repair.lock').open('a') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            # Another completed invocation may have supplied these imports.
            modules = probe(executable, specs, deadline)
            missing = [spec for spec, row in zip(specs, modules) if not row['ready']]
            if not missing:
                return response(project, executable, modules, [], logPath=str(log))
            ensure_pip(deadline, log)
            # Reuse Alpine native wheels for common native libraries, unless a
            # task explicitly pins another version. Other packages stay local.
            native = sorted({NATIVE[spec['package'].lower()] for spec in missing if spec['package'].lower() in NATIVE and not spec['version']})
            if native:
                run([sys.executable, CAPABILITIES, 'install', '--apk', *native], deadline, log)
            run([sys.executable, '-m', 'venv', '--system-site-packages', '--without-pip', str(environment)], deadline, log, timeout=60)
            executable = environment / 'bin/python'
            if MANAGED.is_dir():
                registration = "from pathlib import Path; import sysconfig; p=Path(sysconfig.get_path('purelib'))/'eva_managed_office.pth'; value=" + repr(str(MANAGED) + '\n') + "; assert not p.is_symlink() and (not p.exists() or p.read_text()==value), 'Unknown office path registration preserved'; p.write_text(value)"
                run([str(executable), '-c', registration], deadline, log, timeout=30)
            modules = probe(executable, specs, deadline)
            remaining = [spec for spec, row in zip(specs, modules) if not row['ready']]
            requirements = list(dict.fromkeys(spec['package'] + ('==' + spec['version'] if spec['version'] else '') for spec in remaining))
            if requirements:
                source_attempts = install_python_packages(executable, requirements, deadline, log)
            modules = probe(executable, specs, deadline)
            installed = [spec['package'] + ('==' + spec['version'] if spec['version'] else '') for spec, row in zip(specs, modules) if spec in missing and row['ready']]
            if not all(row['ready'] for row in modules):
                return dict(response(project, executable, modules, installed, logPath=str(log)), ready=False, error='Installation finished but requested imports or versions still fail; inspect modules and logPath')
            return response(project, executable, modules, installed, logPath=str(log), sourceAttempts=source_attempts)
    except Exception as error:
        try:
            modules = probe(executable, specs, deadline)
        except Exception:
            pass
        return dict(response(project, executable, modules, installed, logPath=str(log)), ready=False, error=redact(error)[-6000:], sourceAttempts=getattr(error, 'sourceAttempts', source_attempts), retryable=getattr(error, 'retryable', False), cancelled=isinstance(error, Cancelled))



def execute(request):
    action = request.get('action')
    if action not in ('status', 'ensure'):
        raise ValueError('action must be status or ensure')
    project = project_path(request.get('projectPath', str(WORKSPACE)))
    requirements = request.get('requirements', [])
    python_rows = list(request.get('python', [])) if isinstance(request.get('python', []), list) else request.get('python')
    if not isinstance(requirements, list) or not isinstance(python_rows, list) or not 1 <= len(requirements) + len(python_rows) <= 16:
        raise ValueError('Provide 1 to 16 requirements or Python module requests')
    requirements = [dict(row) if isinstance(row, dict) else row for row in requirements]
    # Validate aliases for the entire plan before probing or installing any item.
    for row in requirements:
        if isinstance(row, dict) and 'package' in row:
            if row.get('kind') != 'python':
                raise ValueError('package is only a Python requirement alias for name')
            alias = row['package']
            if not isinstance(alias, str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]{0,199}', alias):
                raise ValueError('Python package alias must be a PyPI distribution name')
            if 'name' in row and row['name'] != alias:
                raise ValueError('Conflicting Python name and package aliases')
            row['name'] = row.pop('package')
    npm_versions = {}
    for row in requirements:
        if isinstance(row, dict) and row.get('kind') == 'npm':
            version = row.get('version')
            if version not in (None, 'latest'):
                name = row.get('name')
                if name in npm_versions and npm_versions[name] != version:
                    raise ValueError('Conflicting fixed npm versions for the same import name; use separate project environments')
                npm_versions[name] = version
    for row in requirements:
        if isinstance(row, dict) and row.get('kind') == 'npm' and row.get('version') in (None, 'latest') and row.get('name') in npm_versions:
            row['version'] = npm_versions[row['name']]
    for requirement in requirements:
        if not isinstance(requirement, dict):
            raise ValueError('Requirements must be objects')
        if requirement.get('kind') == 'python':
            if set(requirement) - {'kind', 'name', 'module', 'version'}:
                raise ValueError('Python requirements accept kind, name, module and version')
            row = {'module': requirement.get('module')}
            if requirement.get('name') is not None:
                row['package'] = requirement['name']
            if 'version' in requirement:
                row['version'] = requirement['version']
            python_rows.append(row)
    results, commands, environments = [], [], {}
    python_result = None
    if python_rows:
        python_result = execute_python({'action': action, 'projectPath': str(project), 'python': python_rows})
        results.append(dict(python_result, kind='python'))
        if python_result.get('command'):
            commands.append({'kind': 'python', 'commandPrefix': python_result['command']})
            selected_environment = python_environment(python_result['pythonExecutable'])
            for key in ('PATH', 'PYTHONPATH'):
                environments[key] = selected_environment.get(key, '')
    toolchains = None
    for requirement in requirements:
        kind = requirement.get('kind')
        if kind == 'python':
            continue
        try:
            check_cancel()
            if kind not in ('npm', 'java', 'android', 'system'):
                raise ValueError('Unsupported dependency kind ' + str(kind) + '; inspect its official installation and compatibility requirements before choosing a supported repair path')
            if toolchains is None:
                entry = Path(__file__).with_name('eva-toolchains.py')
                if not entry.is_file():
                    raise RuntimeError('Managed toolchain installer is missing; restore Eva runtime resources before retrying')
                toolchains = runpy.run_path(str(entry))['ensure_requirement']
            result = toolchains(requirement, project, action)
            check_cancel()
            if not isinstance(result, dict) or not isinstance(result.get('ready'), bool):
                raise RuntimeError('Toolchain verification returned invalid readiness')
            result = dict(result, kind=kind)
        except Exception as error:
            result = {'kind': kind, 'name': requirement.get('name'), 'ready': False, 'error': redact(error)[-6000:],
                      'cancelled': isinstance(error, Cancelled), 'retryable': getattr(error, 'retryable', False), 'sourceAttempts': getattr(error, 'sourceAttempts', []),
                      'nextAction': 'Inspect the failed installation or compatibility stage, repair it and retry; continue the original task after verification'}
            if getattr(error, 'logDirectory', None):
                result['logDirectory'] = str(error.logDirectory)
        results.append(result)
        if result.get('commandPrefix'):
            commands.append({'kind': kind, 'commandPrefix': result['commandPrefix']})
        for name, value in result.get('environment', {}).items():
            if name in ('PATH', 'NODE_PATH', 'PYTHONPATH') and environments.get(name):
                environments[name] = os.pathsep.join(dict.fromkeys(part for part in (str(value) + os.pathsep + environments[name]).split(os.pathsep) if part))
            else:
                environments[name] = value
    response = {'ready': all(result['ready'] for result in results), 'cancelled': any(result.get('cancelled', False) for result in results), 'projectPath': str(project),
                'results': results, 'commands': commands, 'environment': environments}
    npm_results = [result for result in results if result.get('kind') == 'npm' and result.get('ready')]
    node_executables = list(dict.fromkeys(result['nodeExecutable'] for result in npm_results if result.get('nodeExecutable')))
    loaders = list(dict.fromkeys(result['moduleLoader'] for result in npm_results if result.get('moduleLoader')))
    preloads = list(dict.fromkeys(result['modulePreload'] for result in npm_results if result.get('modulePreload')))
    if len(node_executables) == 1:
        node_command = [node_executables[0]]
        for preload in preloads:
            node_command.extend(['--require', preload])
        for loader in loaders:
            node_command.extend(['--experimental-loader', loader])
        response['nodeExecutable'] = node_executables[0]
        response['nodeCommand'] = node_command
        commands.append({'kind': 'node', 'commandPrefix': node_command})
    elif len(node_executables) > 1:
        response.update(ready=False, error='Verified npm requirements use different Node runtimes; use each scoped command and environment separately')
    if python_result:
        for field in ('pythonExecutable', 'modules', 'installed', 'command', 'nextUsage', 'logPath', 'sourceAttempts'):
            if field in python_result:
                response[field] = python_result[field]
    return response


def interrupted(signum, frame):
    global SIGNALLED
    SIGNALLED = True


def main():
    for sig in (signal.SIGTERM, signal.SIGINT):
        signal.signal(sig, interrupted)
    try:
        raw = os.environ.pop('EVA_DEPENDENCY_REQUEST', '')
        if len(raw) > 65536:
            raise ValueError('Dependency request exceeded 64 KiB')
        result = execute(json.loads(raw))
    except Exception as error:
        result = {'ready': False, 'pythonExecutable': sys.executable, 'installed': [], 'modules': [], 'error': redact(error)[-6000:], 'cancelled': isinstance(error, Cancelled)}
    print(json.dumps(result, ensure_ascii=False), flush=True)
    return 0 if result['ready'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
