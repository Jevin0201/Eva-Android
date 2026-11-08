#!/usr/bin/env python3
"""Offline dependency fixtures with real venvs and import verification."""
import json
import base64
import os
from pathlib import Path
import runpy
import subprocess
import sys
import tempfile
import time
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]


def main():
    scope = runpy.run_path(str(ROOT / 'probe/assets/office/eva-dependencies.py'))
    execute = scope['execute']
    state = execute.__globals__
    checked = 0
    with tempfile.TemporaryDirectory(prefix='dependencies-', dir=ROOT / 'tmp') as temporary:
        base = Path(temporary)
        workspace = base / 'workspace'
        workspace.mkdir()
        managed = base / 'managed'
        managed.mkdir()
        (managed / 'kept_private.py').write_text("VALUE='preserved'\n")
        (managed / 'versioned_demo.py').write_text("__version__='1.0'\n")
        state.update(WORKSPACE=workspace, ENVIRONMENTS=base / 'environments', MANAGED=managed)
        result = execute({'action': 'status', 'python': [{'module': 'json'}, {'module': 'kept_private'}]})
        assert result['ready'] and not state['ENVIRONMENTS'].exists()
        checked += 1
        alias_request = {'action': 'status', 'requirements': [{'kind': 'python', 'module': 'json', 'package': 'json'}]}
        snapshot = json.dumps(alias_request, sort_keys=True)
        result = execute(alias_request)
        assert result['ready'] and json.dumps(alias_request, sort_keys=True) == snapshot and not state['ENVIRONMENTS'].exists()
        checked += 1
        result = execute({'action': 'status', 'requirements': [{'kind': 'python', 'module': 'json', 'name': 'json', 'package': 'json'}]})
        assert result['ready'] and not state['ENVIRONMENTS'].exists()
        checked += 1
        # Put a valid missing dependency first: a later bad alias must fail the
        # whole plan before any subprocess, environment, installer or probe runs.
        original_execute_python = state['execute_python']
        def unexpected_execution(request):
            raise AssertionError('invalid plan executed Python work')
        state['execute_python'] = unexpected_execution
        before = sorted(str(path.relative_to(base)) for path in base.rglob('*'))
        try:
            invalid = [{'kind': 'python', 'module': 'missing', 'name': 'one', 'package': 'two'}]
            invalid += [{'kind': kind, 'name': 'example', 'package': 'example'} for kind in ('npm', 'java', 'android', 'system')]
            for row in invalid:
                for first in ({'kind': 'python', 'module': 'missing', 'name': 'missing'}, {'kind': 'npm', 'name': 'example'}):
                    with patch.object(state['runpy'], 'run_path', side_effect=AssertionError('invalid plan loaded an installer')):
                        try:
                            execute({'action': 'ensure', 'requirements': [first, row]})
                            raise AssertionError('invalid package alias accepted')
                        except ValueError:
                            pass
                    assert sorted(str(path.relative_to(base)) for path in base.rglob('*')) == before
        finally:
            state['execute_python'] = original_execute_python
        checked += 1
        result = execute({'action': 'ensure', 'python': [{'module': 'unknown_missing_eva_module'}]})
        assert not result['ready'] and 'explicit package' in result['results'][0]['error'] and not state['ENVIRONMENTS'].exists()
        checked += 1
        for package in ('--global', '../escape', 'https://host/a.whl', 'name;touch bad', 'name @ https://host/a.whl'):
            try:
                execute({'action': 'ensure', 'python': [{'module': 'missing', 'package': package}]})
                raise AssertionError('unsafe requirement accepted')
            except ValueError:
                pass
        checked += 1
        outside = base / 'outside'
        outside.mkdir()
        (workspace / 'escape').symlink_to(outside, target_is_directory=True)
        for project in (str(base), str(workspace / 'escape')):
            try:
                execute({'action': 'status', 'projectPath': project, 'python': [{'module': 'json'}]})
                raise AssertionError('workspace escape accepted')
            except ValueError:
                pass
        checked += 1
        original_run = state['run']
        calls = []
        fail_install = [False]

        def fixture_run(command, deadline, log=None, timeout=600):
            if len(command) >= 3 and command[1:3] == ['-m', 'pip']:
                calls.append(command)
                if command[-1] == '--version':
                    return 'pip fixture'
                if fail_install[0]:
                    if log:
                        log.write_text('retained fixture install failure')
                    raise RuntimeError('No matching distribution found')
                purelib = subprocess.check_output([command[0], '-c', 'import sysconfig;print(sysconfig.get_path("purelib"))'], text=True).strip()
                library = Path(purelib)
                (library / 'versioned_demo.py').write_text("__version__='2.0'\n")
                metadata = library / 'versioned_demo-2.0.dist-info'
                metadata.mkdir(exist_ok=True)
                (metadata / 'METADATA').write_text('Metadata-Version: 2.1\nName: versioned-demo\nVersion: 2.0\n')
                return 'fixture installed'
            return original_run(command, deadline, log, timeout)

        state['run'] = fixture_run
        request = {'action': 'ensure', 'python': [{'module': 'versioned_demo', 'package': 'versioned-demo==2.0'}, {'module': 'kept_private'}]}
        result = execute(request)
        assert result['ready'], result
        executable = result['pythonExecutable']
        assert '/environments/' in executable and Path(executable).is_file()
        assert result['modules'][0]['version'] == '2.0' and 'environments' in result['modules'][0]['path']
        assert result['modules'][1]['path'] == str(managed / 'kept_private.py')
        assert str(managed) not in result['command'][1]
        assert (managed / 'versioned_demo.py').read_text().find('1.0') >= 0
        checked += 1
        count = len(calls)
        result = execute(request)
        assert result['ready'] and len(calls) == count
        checked += 1
        alias = {'action': 'ensure', 'requirements': [{'kind': 'python', 'module': 'versioned_demo', 'name': 'versioned-demo', 'package': 'versioned-demo', 'version': '2.0'}]}
        result = execute(alias)
        assert result['ready'] and result['modules'][0]['version'] == '2.0' and len(calls) == count
        assert alias['requirements'][0]['package'] == 'versioned-demo'
        checked += 1
        fail_install[0] = True
        failure = execute({'action': 'ensure', 'projectPath': str(workspace / 'other'), 'python': [{'module': 'not_installed', 'package': 'nonexistent-test-package'}]})
        assert not failure['ready'] and Path(failure['logPath']).is_file() and Path(failure['pythonExecutable']).is_file()
        checked += 1
        aggregate = execute({'action': 'status', 'requirements': [{'kind': 'python', 'module': 'json'}, {'kind': 'unsupported-environment', 'name': 'something'}]})
        assert not aggregate['ready'] and aggregate['results'][0]['ready'] and not aggregate['results'][1]['ready']
        checked += 1
        policy = runpy.run_path(str(ROOT / 'probe/assets/office/eva-download-policy.py'))
        assert policy['is_network_failure']('Connection reset by peer')
        assert not policy['is_network_failure']('Package SHA256 mismatch')
        assert not policy['is_network_failure']('No matching distribution found')
        checked += 1
        attempts = []

        def mirrors(command, deadline, log=None, timeout=600):
            index = command[command.index('--index-url') + 1]
            attempts.append(index)
            if index == 'https://pypi.org/simple':
                raise RuntimeError('Connection timed out')
            return 'ok'

        state['run'] = mirrors
        state['install_python_packages'](Path(sys.executable), ['demo==1.0'], time.monotonic() + 30, base / 'mirror.log')
        assert attempts == list(policy['pip_indexes']()[:2])
        checked += 1
        attempts.clear()

        def broken_hash(command, deadline, log=None, timeout=600):
            attempts.append(command)
            raise RuntimeError('Package hashes do not match')

        state['run'] = broken_hash
        try:
            state['install_python_packages'](Path(sys.executable), ['demo==1.0'], time.monotonic() + 30, base / 'hash.log')
            raise AssertionError('hash failure retried')
        except RuntimeError as error:
            assert len(attempts) == 1 and len(error.sourceAttempts) == 1
        checked += 1
        attempts.clear()

        def all_offline(command, deadline, log=None, timeout=600):
            source = command[command.index('--index-url') + 1]
            attempts.append(source)
            with log.open('a') as stream:
                stream.write(source + ': Connection refused\n')
            raise RuntimeError('Connection refused')

        state['run'] = all_offline
        failure_log = base / 'all-sources.log'
        try:
            state['install_python_packages'](Path(sys.executable), ['demo==1.0'], time.monotonic() + 30, failure_log)
            raise AssertionError('all offline sources accepted')
        except RuntimeError as error:
            assert len(error.sourceAttempts) == 3 and error.retryable
            assert all(source in failure_log.read_text() for source in policy['pip_indexes']())
        checked += 1
        state['run'] = original_run
        cancel = base / 'cancel'
        completed = base / 'transaction-completed'
        old_cancel = os.environ.get('EVA_DEPENDENCY_CANCEL_FILE')
        os.environ['EVA_DEPENDENCY_CANCEL_FILE'] = str(cancel)
        try:
            script = 'from pathlib import Path;import time;Path(' + repr(str(cancel)) + ').write_text("cancel");time.sleep(.15);Path(' + repr(str(completed)) + ').write_text("completed")'
            try:
                original_run([sys.executable, '-c', script, '-m', 'pip', 'install'], time.monotonic() + 5, base / 'cancel.log')
                raise AssertionError('cancelled transaction reported success')
            except state['Cancelled']:
                assert completed.read_text() == 'completed'
            checked += 1
        finally:
            if old_cancel is None:
                os.environ.pop('EVA_DEPENDENCY_CANCEL_FILE')
            else:
                os.environ['EVA_DEPENDENCY_CANCEL_FILE'] = old_cancel
        previous = os.environ.get('HTTPS_PROXY')
        os.environ['HTTPS_PROXY'] = 'http://eva:private-proxy-token@127.0.0.1:12345'
        try:
            assert 'private-proxy-token' not in state['redact']('failed http://eva:private-proxy-token@127.0.0.1:12345')
            credential = base64.b64encode(b'eva:private-proxy-token').decode()
            assert credential not in state['redact']('Proxy-Authorization: Basic ' + credential)
            proof_path = '/root/.eva-python/environments/example/site-packages/demo.py'
            assert state['redact'](proof_path) == proof_path
            assert 'private-proxy-token' not in state['redact']('proxy password private-proxy-token')
            assert 'eva' not in state['redact']('http://eva:other-password@127.0.0.1:12345')
        finally:
            if previous is None:
                os.environ.pop('HTTPS_PROXY')
            else:
                os.environ['HTTPS_PROXY'] = previous
        checked += 1
    print('PASS dependencies', checked, 'offline checks including real venv/import/version isolation and classified mirrors')


if __name__ == '__main__':
    main()
