#!/usr/bin/env python3
"""Exercise the real dispatcher and scoped npm adapters without registry access."""
import copy
import hashlib
import json
import os
from pathlib import Path
import runpy
import shutil
import subprocess
import tempfile
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]


def snapshot(folder):
    return {str(path.relative_to(folder)): hashlib.sha256(path.read_bytes()).hexdigest()
            for path in folder.rglob('*') if path.is_file()}


def write_package(folder, name, version, value):
    folder.mkdir(parents=True, exist_ok=True)
    (folder / 'package.json').write_text(json.dumps({
        'name': name, 'version': version,
        'exports': {'.': './index.cjs', './sub': './sub.cjs'},
    }))
    (folder / 'index.cjs').write_text('module.exports=' + json.dumps({'version': version, 'value': value}))
    (folder / 'sub.cjs').write_text('module.exports=' + json.dumps('sub-' + version))


def main():
    node = shutil.which('node')
    if not node:
        raise RuntimeError('Node is required for actual CJS/ESM composition checks')
    dependency = runpy.run_path(str(ROOT / 'probe/assets/office/eva-dependencies.py'))
    state = dependency['execute'].__globals__
    actual_toolchain = runpy.run_path(str(ROOT / 'probe/assets/office/eva-toolchains.py'))
    toolchain = actual_toolchain['ensure_requirement']
    tool_state = toolchain.__globals__
    original_run = tool_state['_run']
    original_run_path = runpy.run_path
    temporary_root = ROOT / 'tmp'
    temporary_root.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='dependency-node-', dir=temporary_root) as folder:
        base = Path(folder)
        workspace = base / 'workspace'
        workspace.mkdir()
        state.update(WORKSPACE=workspace, ENVIRONMENTS=base / 'python', MANAGED=base / 'managed')
        tool_state['BASE'] = base / 'toolchains'
        for name in ['demo-one', 'demo-two', 'unrequested']:
            write_package(workspace / 'node_modules' / name, name, '1.0.0', 9)
        (workspace / 'package-lock.json').write_text('{"userLock":"preserve original v1 dependencies"}')
        scripts = {
            'original.cjs': "const a=require('demo-one'),b=require('demo-two');console.log(JSON.stringify([a.version,b.version,a.value+b.value,require('unrequested').value,require('demo-one/sub')]))",
            'original.mjs': "import a from 'demo-one';import b from 'demo-two';import unchanged from 'unrequested';import sub from 'demo-one/sub';console.log(JSON.stringify([a.version,b.version,a.value+b.value,unchanged.value,sub]))",
        }
        for filename, text in scripts.items():
            (workspace / filename).write_text(text)
        original_files = snapshot(workspace)
        installations = []
        metadata_reads = []
        dispatches = []

        def metadata(name, version, registry):
            metadata_reads.append((name, version))
            assert version == '2.0.0', 'latest must be normalized to the explicit version before resolution'
            return {'name': name, 'version': version, 'license': 'MIT', 'dist': {'integrity': 'sha512-fixture'}}

        def command(arguments, job, env=None, timeout=120):
            arguments = list(map(str, arguments))
            if arguments[0] != '/fixture/npm':
                return original_run(arguments, job, env, timeout)
            prefix = Path(arguments[arguments.index('--prefix') + 1])
            name, version = arguments[-1].rsplit('@', 1)
            installations.append((name, version))
            write_package(prefix / 'node_modules' / name, name, version, 2 if name == 'demo-one' else 3)
            (prefix / 'package-lock.json').write_text(json.dumps({'packages': {
                'node_modules/' + name: {'integrity': 'sha512-fixture'},
            }}))
            return 'installed offline fixture'

        def prepared_toolchain(requirement, project, action):
            dispatches.append(copy.deepcopy(requirement))
            return toolchain(requirement, project, action)

        def source(path, *args, **kwargs):
            if Path(path).name == 'eva-toolchains.py':
                return {'ensure_requirement': prepared_toolchain}
            return original_run_path(path, *args, **kwargs)

        def which(name):
            return node if name == 'node' else '/fixture/npm' if name == 'npm' else None

        request = {'action': 'ensure', 'requirements': [
            {'kind': 'npm', 'name': 'demo-one', 'module': 'demo-one/sub', 'version': 'latest'},
            {'kind': 'npm', 'name': 'demo-one', 'version': '2.0.0'},
            {'kind': 'npm', 'name': 'demo-two', 'version': '2.0.0'},
        ]}
        request_before = copy.deepcopy(request)
        with patch.object(state['runpy'], 'run_path', source), \
                patch.dict(tool_state, _metadata=metadata, _run=command), \
                patch.object(tool_state['shutil'], 'which', side_effect=which):
            result = dependency['execute'](request)
            assert request == request_before, 'normalization must not mutate the caller request'
            assert result['ready'] and all(row['ready'] for row in result['results'])
            assert installations == [('demo-one', '2.0.0'), ('demo-two', '2.0.0')]
            assert len(metadata_reads) == 2, 'duplicate fixed requirements reuse the same managed prefix'
            assert result['nodeCommand'][0] == node
            assert result['nodeCommand'].count('--require') == 2, 'CJS preload deduplicated and aggregated'
            assert result['nodeCommand'].count('--experimental-loader') == 2, 'ESM loaders deduplicated and aggregated'
            for row in result['results']:
                assert row['modulePreload'] in result['nodeCommand']
                assert row['moduleLoader'] in result['nodeCommand']
            assert any(row['kind'] == 'node' and row['commandPrefix'] == result['nodeCommand']
                       for row in result['commands'])
            paths = result['environment']['NODE_PATH'].split(os.pathsep)
            private_paths = {str(Path(row['npmPrefix']) / 'node_modules') for row in result['results']}
            assert private_paths.issubset(paths) and len(set(paths)) == len(paths), 'both private module paths retained without duplication'
            environment = dict(os.environ, **result['environment'])
            for filename in scripts:
                process = subprocess.run([*result['nodeCommand'], str(workspace / filename)],
                                         env=environment, capture_output=True, text=True, timeout=15)
                assert process.returncode == 0, process.stderr
                assert json.loads(process.stdout) == ['2.0.0', '2.0.0', 5, 9, 'sub-2.0.0']
            assert snapshot(workspace) == original_files, 'user modules, lock and original scripts preserved'
            status = dependency['execute']({**request, 'action': 'status'})
            assert status['ready'] and len(installations) == 2 and len(metadata_reads) == 2
            assert status['nodeCommand'] == result['nodeCommand'], 'status reuses verified adapters offline'

            before_conflict = snapshot(base)
            count_before_conflict = len(dispatches)
            conflict = {'action': 'ensure', 'python': [{'module': 'should_not_run', 'package': 'should-not-run'}],
                        'requirements': [
                            {'kind': 'npm', 'name': 'demo-one', 'version': '1.0.0'},
                            {'kind': 'npm', 'name': 'demo-one', 'version': '2.0.0'},
                        ]}
            def unexpected_python(*args):
                raise AssertionError('Python ran before conflict rejection')
            with patch.dict(state, execute_python=unexpected_python):
                try:
                    dependency['execute'](conflict)
                except ValueError as error:
                    assert 'Conflicting fixed npm versions' in str(error)
                else:
                    raise AssertionError('conflicting versions were accepted')
            assert len(dispatches) == count_before_conflict, 'conflict rejected before any toolchain operation'
            assert len(installations) == 2 and len(metadata_reads) == 2
            assert snapshot(base) == before_conflict, 'conflict creates no environments, logs, installs or file writes'
    print('PASS dispatcher Node composition: pinned v2 overrides user v1 only in controlled CJS/ESM commands; preload/loader dedup, subpaths, unrelated modules, immutable files, offline status, conflict rejected without side effects')


if __name__ == '__main__':
    main()
