"""Exercise dependency isolation, interrupted installs and readiness commits without downloads."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parents[1] / 'probe/assets/office/eva-distribution.py'
spec = importlib.util.spec_from_file_location('distribution', SOURCE)
distribution = importlib.util.module_from_spec(spec)
spec.loader.exec_module(distribution)


class ModularSetupTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='modular-check-', dir=SOURCE.parents[3] / 'tmp')
        self.addCleanup(self.temporary.cleanup)
        self.base = Path(self.temporary.name)
        self.commands = []
        self.addCleanup(patch.stopall)
        patch.object(distribution, 'BASE', self.base).start()
        patch.object(distribution, 'CANCEL', self.base / 'cancel').start()
        patch.object(distribution, 'emit', lambda _: None).start()
        patch.object(distribution, 'run', self.run_command).start()

    def run_command(self, args, **kwargs):
        self.commands.append(list(map(str, args)))
        if args[-1] == 'status':
            return json.dumps({'ready': True})
        return ''

    def packages(self):
        return [part for args in self.commands if args[0] == 'apk' for part in args[args.index('add') + 1:]]

    def test_core_does_not_download_optional_tools(self):
        distribution.install_profile('core')
        self.assertEqual(self.packages(), ['procps-ng', 'py3-pip'])
        self.assertIn(['python3', '-m', 'pip', '--version'], self.commands)
        self.assertEqual([p.name for p in self.base.glob('*.json')], ['core.json'])
        self.assertFalse(any('npm' in command or 'java' in command or 'libreoffice' in command for args in self.commands for command in args))

    def test_default_entry_installs_only_core(self):
        with patch('sys.argv', ['eva-distribution.py']):
            distribution.main()
        self.assertTrue((self.base / 'core.json').is_file())
        self.assertFalse((self.base / 'ready.json').exists())

    def test_error_never_commits_core_readiness(self):
        with patch.object(distribution, 'run', side_effect=RuntimeError('offline')):
            with self.assertRaisesRegex(RuntimeError, 'offline'):
                distribution.install_profile('core')
        self.assertFalse((self.base / 'core.json').exists())

    def test_failed_optional_keeps_core_and_other_modules(self):
        distribution.install_profile('core')
        original = (self.base / 'core.json').read_bytes()
        with patch.object(distribution, 'run', side_effect=RuntimeError('offline')):
            with self.assertRaises(RuntimeError):
                distribution.install_profile('development')
        self.assertEqual((self.base / 'core.json').read_bytes(), original)
        self.assertFalse((self.base / 'development.json').exists())

    def test_rea_does_not_download_ghidra_or_java_or_change_mcp(self):
        with patch.object(distribution, 'ghidra', side_effect=AssertionError('unexpected Ghidra')):
            distribution.install_profile('analysis')
        self.assertEqual(self.packages(), ['procps-ng'])
        self.assertTrue(any('rea-agents@6.8.0' in args for args in self.commands))
        self.assertFalse(any('eva-java21.py' in ' '.join(args) or 'config.toml' in ' '.join(args) for args in self.commands))
        self.assertTrue((self.base / 'analysis.json').is_file())

    def test_development_installs_sdk_but_not_office_or_analysis(self):
        distribution.install_profile('development')
        self.assertIn('openjdk17-jdk', self.packages())
        self.assertNotIn('openjdk21-jdk', self.packages())
        self.assertTrue(any(args[-1] == 'install' and 'eva-android-build.py' in args[1] for args in self.commands if len(args) > 1))
        self.assertFalse(any('npm' == args[0] or 'libreoffice' in args for args in self.commands))

    def test_cancel_during_transaction_prevents_ready_marker(self):
        def cancelled_transaction(args, **kwargs):
            (self.base / 'cancel').touch()
            return ''
        with patch.object(distribution, 'run', cancelled_transaction):
            with self.assertRaisesRegex(RuntimeError, '取消'):
                distribution.install_profile('media')
        self.assertFalse((self.base / 'media.json').exists())

    def test_retry_preserves_legacy_full_ready_record(self):
        legacy = self.base / 'ready.json'
        legacy.write_text('{"schema":1,"ready":true}')
        with patch('sys.argv', ['eva-distribution.py']):
            distribution.main()
        self.assertEqual(json.loads(legacy.read_text())['schema'], 1)

    def test_office_failure_does_not_mark_ready(self):
        office = {'status': lambda: {'ready': False}, 'install': lambda: (_ for _ in ()).throw(RuntimeError('wheel checksum mismatch'))}
        original_run_path = distribution.runpy.run_path

        def load_fixture(path, *args, **kwargs):
            if Path(path).name == 'eva-office.py':
                return office
            # Exercise the actual shared APK policy with the isolated fake runner.
            # Only the office installer is replaced, so its checksum failure must
            # be reached after the policy's real command contract succeeds.
            return original_run_path(path, *args, **kwargs)

        with patch.object(distribution.runpy, 'run_path', side_effect=load_fixture):
            with self.assertRaisesRegex(RuntimeError, 'checksum'):
                distribution.install_profile('office')
        self.assertFalse((self.base / 'office.json').exists())


if __name__ == '__main__':
    unittest.main()
