#!/usr/bin/env python3
"""Offline fixtures for managed office repair. No apk, pip or network calls."""
import json
from pathlib import Path
import runpy
import tempfile
from types import SimpleNamespace
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]


def main():
    runtime = runpy.run_path(str(ROOT / 'probe/assets/office/eva-office.py'))
    stage_library = runtime['stage_library']
    checks = 0
    with tempfile.TemporaryDirectory(prefix='office-repair-check-', dir=ROOT / 'tmp') as folder:
        folder = Path(folder)
        library = folder / 'lib'
        library.mkdir()
        for package in ('docx', 'pptx', 'private_dependency'):
            (library / package).mkdir()
            (library / package / '__init__.py').write_text(package)
        for name in ('python_docx-0.9.dist-info', 'python_pptx-0.9.dist-info', 'private-1.dist-info'):
            (library / name).mkdir()
            (library / name / 'METADATA').write_text(name)
        (library / 'private_link').symlink_to('private_dependency', target_is_directory=True)
        stage = stage_library(library, folder / 'stage')
        assert not (stage / 'docx').exists() and not (stage / 'python_docx-0.9.dist-info').exists()
        assert not (stage / 'pptx').exists() and not (stage / 'python_pptx-0.9.dist-info').exists()
        checks += 1
        assert (stage / 'private_dependency/__init__.py').read_text() == 'private_dependency'
        assert (stage / 'private-1.dist-info/METADATA').is_file() and (stage / 'private_link').is_symlink()
        checks += 1
        assert (library / 'docx/__init__.py').read_text() == 'docx'
        assert (library / 'pptx/__init__.py').read_text() == 'pptx'
        checks += 1
        linked = folder / 'linked-library'
        linked.symlink_to(library, target_is_directory=True)
        try:
            stage_library(linked, folder / 'linked-stage')
            raise AssertionError('symlink root accepted')
        except RuntimeError:
            checks += 1
        values = runtime['install'].__globals__
        values.update(BASE=folder, LIB=library, CANCEL=folder / 'cancel', PACKAGES=[], WHEELS=[])
        previous_backup = folder / 'lib.previous'
        previous_backup.mkdir()
        (previous_backup / 'important.txt').write_text('preserve old recovery files')
        read_text = Path.read_text

        def fixture_read(path, *args, **kwargs):
            if str(path) == '/etc/alpine-release':
                return '3.22.9'
            return read_text(path, *args, **kwargs)

        def fixture_process(command, **kwargs):
            if command[0] == 'apk':
                return SimpleNamespace(returncode=0, stdout='fixture apk inventory')
            return SimpleNamespace(returncode=0, stdout=json.dumps({'ready': False}))

        with patch.object(Path, 'read_text', fixture_read), patch.object(values['subprocess'], 'run', fixture_process):
            try:
                runtime['install']()
                raise AssertionError('failed fresh interpreter probe accepted')
            except RuntimeError as error:
                assert '恢复此前' in str(error)
        assert (library / 'docx/__init__.py').read_text() == 'docx'
        assert (library / 'private_dependency/__init__.py').is_file()
        assert (previous_backup / 'important.txt').read_text() == 'preserve old recovery files'
        assert not list(folder.glob('office-install-*'))
        checks += 1
    capabilities = runpy.run_path(str(ROOT / 'probe/assets/office/eva-capabilities.py'))
    state = capabilities['install'].__globals__
    calls = []
    state['preflight'] = lambda: {'distribution': '3.22.9', 'architecture': 'aarch64'}
    state['command'] = lambda args, timeout: calls.append(args) or '{}'
    state['office_status'] = lambda: {'ready': True, 'managedLibPath': '/root/.eva-office/lib'}
    result = capabilities['install']('office-authoring')
    assert result['ready'] and calls == [['python3', '/root/eva-office.py', 'install']]
    checks += 1
    state['office_status'] = lambda: {'ready': False}
    try:
        capabilities['repair_office']()
        raise AssertionError('unready office repair accepted')
    except RuntimeError:
        checks += 1
    print('PASS managed office repair', checks, 'offline checks')


if __name__ == '__main__':
    main()
