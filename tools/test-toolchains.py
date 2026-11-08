"""Offline toolchain policy and execution fixtures. Never installs host packages."""
import importlib.util
import json
import hashlib
import io
import os
import pathlib
import shutil
import subprocess
import tempfile
import unittest
import sys
sys.dont_write_bytecode = True
from unittest.mock import patch

SOURCE = pathlib.Path(__file__).resolve().parents[1] / 'probe/assets/office/eva-toolchains.py'
spec = importlib.util.spec_from_file_location('toolchains', SOURCE)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class Toolchains(unittest.TestCase):
    def setUp(self):
        temporary_root = SOURCE.parents[3] / 'tmp'
        temporary_root.mkdir(exist_ok=True)
        self.temporary = tempfile.TemporaryDirectory(prefix='eva-toolchain-test-', dir=temporary_root)
        self.root = pathlib.Path(self.temporary.name)
        self.project = self.root / 'project'
        self.project.mkdir()
        self.base = patch.object(m, 'BASE', self.root / 'managed')
        self.base.start()
        self.commands = []
        self.sources = []
        self.real_run = m._run
        self.node = shutil.which('node')
        self.which = patch.object(m.shutil, 'which', side_effect=lambda name: self.node if name == 'node' else '/fixture/npm' if name == 'npm' else None)
        self.which.start()

    def tearDown(self):
        self.which.stop()
        self.base.stop()
        self.temporary.cleanup()

    def metadata(self, name, version, registry):
        self.sources.append(registry)
        return {'name': name, 'version': '7.0.0', 'license': 'MIT', 'dist': {'integrity': 'sha512-fixture'}}

    def fake_run(self, args, job, env=None, timeout=120):
        args = list(map(str, args))
        self.commands.append(args)
        if args[0] != '/fixture/npm':
            return self.real_run(args, job, env, timeout)
        prefix = pathlib.Path(args[args.index('--prefix') + 1])
        package = prefix / 'node_modules/is-number'
        package.mkdir(parents=True, exist_ok=True)
        (package / 'package.json').write_text(json.dumps({'name': 'is-number', 'version': '7.0.0', 'main': 'index.js'}))
        (package / 'index.js').write_text('module.exports=value=>typeof value===\'number\';')
        (prefix / 'package-lock.json').write_text(json.dumps({'packages': {'node_modules/is-number': {'integrity': 'sha512-fixture'}}}))
        return 'fixture npm installed'

    def test_npm_mirror_and_real_cjs_esm_original_script(self):
        if not self.node:
            self.skipTest('Node required for real offline import execution')
        def metadata(name, version, registry):
            if registry == m.REGISTRIES[0]:
                self.sources.append(registry)
                raise TimeoutError('network timeout')
            return self.metadata(name, version, registry)
        with patch.object(m, '_metadata', side_effect=metadata), patch.object(m, '_run', side_effect=self.fake_run):
            result = m.ensure_requirement({'kind': 'npm', 'name': 'is-number', 'version': '7.0.0'}, self.project, 'ensure')
            self.assertTrue(result['ready'])
            self.assertEqual(self.sources, list(m.REGISTRIES))
            self.assertTrue(result['changed'])
            for filename, code in [('task.cjs', "console.log(require('is-number')(42))"), ('task.mjs', "import isNumber from 'is-number';console.log(isNumber(42))")]:
                script = self.project / filename
                script.write_text(code)
                before = script.read_bytes()
                process = subprocess.run([*result['commandPrefix'], str(script)], env={**os.environ, **result['environment']}, capture_output=True, text=True)
                self.assertEqual(process.returncode, 0, process.stderr)
                self.assertEqual(process.stdout.strip(), 'true')
                self.assertEqual(script.read_bytes(), before)
            self.sources.clear()
            result = m.ensure_requirement({'kind': 'npm', 'name': 'is-number', 'version': '7.0.0'}, self.project, 'ensure')
            self.assertFalse(result['changed'])
            self.assertFalse(self.sources, 'reuse verified installation offline')

    def test_pinned_scopes_override_old_requested_packages_only(self):
        if not self.node:
            self.skipTest('Node required for actual scoped resolution checks')
        def write_package(folder, name, version):
            folder.mkdir(parents=True, exist_ok=True)
            (folder / 'package.json').write_text(json.dumps({'name': name, 'version': version,
                'exports': {'.': './index.js', './sub': './sub.js'}}))
            (folder / 'index.js').write_text('module.exports=' + json.dumps({'version': version}) + ';')
            (folder / 'sub.js').write_text('module.exports=' + json.dumps('sub-' + version) + ';')
        for name in ['pinned-demo', 'second-demo', 'unrelated']:
            write_package(self.project / 'node_modules' / name, name, '1.0.0')
        (self.project / 'package-lock.json').write_text('{"user-lock":"preserve"}')
        scripts = {
            'task.cjs': "console.log(JSON.stringify([require('pinned-demo').version,require('second-demo').version,require('unrelated').version,require('pinned-demo/sub')]))",
            'task.mjs': "import one from 'pinned-demo';import two from 'second-demo';import unchanged from 'unrelated';import sub from 'pinned-demo/sub';console.log(JSON.stringify([one.version,two.version,unchanged.version,sub]))",
        }
        for filename, code in scripts.items():
            (self.project / filename).write_text(code)
        before = {str(path.relative_to(self.project)): hashlib.sha256(path.read_bytes()).hexdigest()
                  for path in self.project.rglob('*') if path.is_file()}
        def metadata(name, version, registry):
            return {'name': name, 'version': '2.0.0', 'license': 'MIT', 'dist': {'integrity': 'sha512-fixture'}}
        def install(args, job, env=None, timeout=120):
            args = list(map(str, args))
            if args[0] != '/fixture/npm':
                return self.real_run(args, job, env, timeout)
            prefix = pathlib.Path(args[args.index('--prefix') + 1])
            name = args[-1].rsplit('@', 1)[0]
            write_package(prefix / 'node_modules' / name, name, '2.0.0')
            (prefix / 'package-lock.json').write_text(json.dumps({'packages': {'node_modules/' + name: {'integrity': 'sha512-fixture'}}}))
            return 'installed fixture version 2'
        with patch.object(m, '_metadata', side_effect=metadata), patch.object(m, '_run', side_effect=install):
            results = [m.ensure_requirement({'kind': 'npm', 'name': name, 'version': '2.0.0'}, self.project, 'ensure')
                       for name in ['pinned-demo', 'second-demo']]
        command = [self.node]
        for result in results:
            self.assertTrue(result['ready'])
            self.assertIn('--require', result['commandPrefix'])
            command.extend(['--require', result['modulePreload'], '--experimental-loader', result['moduleLoader']])
        environment = dict(os.environ)
        environment['NODE_PATH'] = os.pathsep.join(result['environment']['NODE_PATH'] for result in results)
        for filename in scripts:
            process = subprocess.run([*command, str(self.project / filename)], env=environment, capture_output=True, text=True)
            self.assertEqual(process.returncode, 0, process.stderr)
            self.assertEqual(json.loads(process.stdout), ['2.0.0', '2.0.0', '1.0.0', 'sub-2.0.0'])
        after = {str(path.relative_to(self.project)): hashlib.sha256(path.read_bytes()).hexdigest()
                 for path in self.project.rglob('*') if path.is_file()}
        self.assertEqual(before, after, 'user modules, lock and original CJS/ESM scripts remain unchanged')

    def test_status_never_downloads_or_installs(self):
        with patch.object(m, '_metadata', side_effect=AssertionError('network forbidden')), patch.object(m, '_apk', side_effect=AssertionError('installation forbidden')):
            self.assertFalse(m.ensure_requirement({'kind': 'npm', 'name': 'missing'}, self.project, 'status')['ready'])
            self.assertFalse(m.ensure_requirement({'kind': 'system', 'name': 'ripgrep', 'binary': 'rg'}, self.project, 'status')['ready'])

    def test_all_registry_failures_preserved(self):
        with patch.object(m, '_metadata', side_effect=TimeoutError('network timeout')):
            with self.assertRaises(m.ToolchainError) as caught:
                m.ensure_requirement({'kind': 'npm', 'name': 'is-number'}, self.project, 'ensure')
        self.assertTrue(pathlib.Path(caught.exception.logDirectory, 'failure.txt').is_file())
        self.assertEqual(len(caught.exception.sourceAttempts), 2)
        self.assertTrue(caught.exception.retryable)

    def test_integrity_mismatch_never_installs_or_tries_other_sources(self):
        def run(args, job, env=None, timeout=120):
            if str(args[0]) == '/fixture/npm':
                raise RuntimeError('network timeout')
            return self.real_run(args, job, env, timeout)
        def metadata(name, version, registry):
            result = self.metadata(name, version, registry)
            if registry == m.REGISTRIES[1]:
                result['dist']['integrity'] = 'sha512-different'
            return result
        with patch.object(m, '_metadata', side_effect=metadata), patch.object(m, '_run', side_effect=run):
            with self.assertRaisesRegex(m.ToolchainError, '完整性'):
                m.ensure_requirement({'kind': 'npm', 'name': 'is-number'}, self.project, 'ensure')

    def test_reject_options_urls_wrong_versions_and_modules(self):
        requests = [{'kind': 'npm', 'name': value} for value in ['--global', 'https://example.test/p', 'pkg;echo x']]
        requests += [{'kind': 'npm', 'name': 'ok', 'module': '../secret'}, {'kind': 'java', 'version': '99'}, {'kind': 'system', 'name': 'pkg', 'binary': '--version'}]
        for request in requests:
            with self.subTest(request=request), self.assertRaises((m.ToolchainError, ValueError)):
                m.ensure_requirement(request, self.project, 'status')

    def test_java_existing_compiler_and_android_reuse(self):
        java_home = self.root / 'jdk17'
        (java_home / 'bin').mkdir(parents=True)
        for binary in ['java', 'javac']:
            (java_home / 'bin' / binary).touch()
        sdk = self.root / 'sdk'
        def run(args, job, env=None, timeout=120):
            self.commands.append(list(map(str, args)))
            if '-version' in args:
                return 'openjdk version "17.0.1"'
            if 'EvaToolchainCheck' in args:
                return '42'
            return 'Android Asset Packaging Tool version 2.19'
        with patch.object(m, 'JAVA_HOMES', {17: java_home}), patch.object(m, '_run', side_effect=run), patch.object(m, '_apk', side_effect=AssertionError('must not reinstall')):
            self.assertTrue(m.ensure_requirement({'kind': 'java', 'version': '17'}, self.project, 'status')['verified'])
            with patch.object(m, '_json_command', return_value={'ready': True, 'sdk': str(sdk)}):
                self.assertTrue(m.ensure_requirement({'kind': 'android'}, self.project, 'status')['verified'])
        self.assertTrue(any(str(java_home / 'bin/javac') in command for command in self.commands))
        self.assertTrue(any('version' in command for command in self.commands))

    def test_transaction_timeout_waits_without_killing_package_process(self):
        process = unittest.mock.Mock(pid=123)
        process.wait.side_effect = [subprocess.TimeoutExpired('npm', 1), 0]
        with patch.object(m.subprocess, 'Popen', return_value=process), patch.object(m.os, 'killpg', side_effect=AssertionError('must not kill transaction')):
            with self.assertRaises(subprocess.TimeoutExpired):
                m._run(['npm', 'install', 'fixture'], self.root, timeout=1)
        self.assertEqual(process.wait.call_count, 2)

    def test_android_download_keeps_pinned_sha_and_source_failures(self):
        builder_spec = importlib.util.spec_from_file_location('android_builder', SOURCE.with_name('eva-android-build.py'))
        builder = importlib.util.module_from_spec(builder_spec)
        builder_spec.loader.exec_module(builder)
        cache = self.root / 'downloads'
        cache.mkdir()
        body = b'pinned Android fixture archive'
        digest = hashlib.sha256(body).hexdigest()
        class Response(io.BytesIO):
            url = 'https://official.example/archive.zip'
        builder.SOURCES['fixture'] = (Response.url, digest)
        with patch('urllib.request.urlopen', side_effect=lambda *args, **kwargs: Response(body)):
            target = builder.download('fixture', cache)
        self.assertEqual(target.read_bytes(), body)
        target.unlink()
        builder.SOURCES['fixture'] = (Response.url, '0' * 64)
        with patch('urllib.request.urlopen', side_effect=lambda *args, **kwargs: Response(body)):
            with self.assertRaisesRegex(ValueError, 'SHA256'):
                builder.download('fixture', cache)
        record = json.loads((cache / 'fixture-download-attempts.json').read_text())
        self.assertFalse(record['retryable'])
        self.assertEqual(record['sourceAttempts'][0]['failure'], 'verification')
        self.assertFalse(target.exists(), 'unverified download never becomes installed archive')

    def test_cancel_marker_blocks_new_process(self):
        marker = self.root / 'cancel'
        marker.touch()
        with patch.dict(os.environ, EVA_DEPENDENCY_CANCEL_FILE=str(marker)):
            with self.assertRaisesRegex(InterruptedError, '取消'):
                m._run(['/should/not/run'], self.root)


if __name__ == '__main__':
    unittest.main()
