#!/usr/bin/env python3
"""Offline verified mirror fallback and safety fixtures."""
import hashlib
import io
import json
from pathlib import Path
import runpy
import tempfile
import urllib.error
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]


class Reply(io.BytesIO):
    def __init__(self, data, url):
        super().__init__(data)
        self.url = url


class InterruptedReply(Reply):
    def __init__(self, data, url):
        super().__init__(data, url)
        self.reads = 0
        self.headers = {'Content-Length': str(len(data) + 10)}

    def read(self, length=-1):
        self.reads += 1
        if self.reads > 1:
            raise ConnectionError('Connection reset while downloading')
        return super().read(length)


def main():
    policy = runpy.run_path(str(ROOT / 'probe/assets/office/eva-download-policy.py'))
    state = policy['download_verified'].__globals__
    checked = 0
    with tempfile.TemporaryDirectory(prefix='download-policy-', dir=ROOT / 'tmp') as temporary:
        base = Path(temporary)
        data = b'fixed verified wheel'
        digest = hashlib.sha256(data).hexdigest()
        calls = []

        def fallback(url, **kwargs):
            url = getattr(url, 'full_url', url)
            calls.append(url)
            if url == 'https://official.invalid/file':
                raise urllib.error.URLError('Connection reset')
            return Reply(data, url)

        with patch.object(state['urllib'].request, 'urlopen', fallback):
            result = policy['download_verified'](['https://official.invalid/file', 'https://mirror.invalid/file'], digest, base / 'verified')
        assert (base / 'verified').read_bytes() == data and len(result['sourceAttempts']) == 3
        checked += 1
        calls.clear()

        def wrong_hash(url, **kwargs):
            url = getattr(url, 'full_url', url)
            calls.append(url)
            return Reply(b'corrupted', url)

        with patch.object(state['urllib'].request, 'urlopen', wrong_hash):
            try:
                policy['download_verified'](['https://official.invalid/file', 'https://mirror.invalid/file'], digest, base / 'bad')
                raise AssertionError('bad digest accepted')
            except ValueError as error:
                assert not error.retryable and len(error.sourceAttempts) == len(calls) == 1
        checked += 1
        calls.clear()

        def offline(url, **kwargs):
            url = getattr(url, 'full_url', url)
            calls.append(url)
            raise urllib.error.URLError('Connection timed out')

        with patch.object(state['urllib'].request, 'urlopen', offline):
            try:
                policy['download_verified'](['https://official.invalid/file', 'https://mirror.invalid/file'], digest, base / 'offline')
                raise AssertionError('all failed accepted')
            except urllib.error.URLError as error:
                assert error.retryable and len(error.sourceAttempts) == 4
        checked += 1
        assert not policy['is_network_failure'](urllib.error.HTTPError('https://x', 401, 'Unauthorized', {}, None))
        assert not policy['is_network_failure']('certificate verify failed')
        assert not policy['is_network_failure']('No matching distribution found')
        checked += 1
        apk_calls = []

        def apk(command):
            apk_calls.append(command)
            if len(apk_calls) == 1:
                raise RuntimeError('temporary network error')
            return 'verified signed package installed'

        result = policy['apk_command'](['apk', 'add', 'py3-pip'], apk, base / 'apk')
        assert result.startswith('verified') and len(apk_calls) == 2
        repository = Path(apk_calls[1][apk_calls[1].index('--repositories-file') + 1])
        assert 'mirrors.tuna' in repository.read_text() and '/v3.22/main' in repository.read_text()
        assert (base / 'apk/source-attempts.jsonl').is_file()
        checked += 1
        wheel_name = 'python_docx-1.2.0-py3-none-any.whl'
        calls.clear()

        def wheel(url, **kwargs):
            url = getattr(url, 'full_url', url)
            calls.append(url)
            if url == 'https://files.pythonhosted.org/packages/file.whl':
                raise urllib.error.URLError('network unreachable')
            if '/simple/' in url:
                return Reply(('<a href="https://mirror.invalid/' + wheel_name + '">wheel</a>').encode(), url)
            return Reply(data, url)

        with patch.object(state['urllib'].request, 'urlopen', wheel):
            result = policy['download_wheel']('https://files.pythonhosted.org/packages/file.whl', wheel_name, digest, base / 'wheel')
        assert len(result) == 2 and (base / 'wheel').read_bytes() == data
        checked += 1
        partial = base / 'sdk.part'
        seen = []

        def interrupted(request, **kwargs):
            seen.append(request)
            if len(seen) == 1:
                return InterruptedReply(data[:5], request.full_url)
            raise urllib.error.URLError('Connection refused')

        with patch.object(state['urllib'].request, 'urlopen', interrupted):
            try:
                policy['download_verified'](['https://official.invalid/sdk'], digest, partial)
                raise AssertionError('partial download accepted')
            except Exception as error:
                assert error.retryable and partial.read_bytes() == data[:5]
        assert json.loads(partial.with_name(partial.name + '.resume.json').read_text())['sha256'] == digest
        checked += 1

        def resumed(request, **kwargs):
            assert request.get_header('Range') == 'bytes=5-'
            reply = Reply(data[5:], request.full_url)
            reply.status = 206
            reply.headers = {'Content-Range': 'bytes 5-' + str(len(data) - 1) + '/' + str(len(data))}
            return reply

        with patch.object(state['urllib'].request, 'urlopen', resumed):
            result = policy['download_verified'](['https://official.invalid/sdk'], digest, partial)
        assert result['verified'] and partial.read_bytes() == data
        checked += 1

        builder = runpy.run_path(str(ROOT / 'probe/assets/office/eva-android-build.py'))
        expected = {
            'platform': ('platform-36_r02.zip', '37607369a28c5b640b3a7998868d45898ebcb777565a0e85f9acf36f29631d2e'),
            'jars35': ('build-tools_r35_macosx.zip', '530cdbd1ec315e1477624d7ed2f0f2962108d69f36eddba5894cef9ea2cedb48'),
            'jars': ('build-tools_r36_macosx.zip', '04e7f3a72044de4926fa038fa0e251a37bba1e1c3fb8beab6f8401bfd9eb4bf3'),
        }
        assert set(builder['VERIFIED_MIRRORS']) == set(expected)
        cache = base / 'android-cache'
        cache.mkdir()
        for name, (filename, pinned) in expected.items():
            official = 'https://dl.google.com/android/repository/' + filename
            mirror = 'https://mirrors.cloud.tencent.com/AndroidSDK/' + filename
            assert builder['SOURCES'][name] == (official, pinned)
            assert builder['VERIFIED_MIRRORS'][name] == (mirror,)

            def verified_download(urls, sha256, destination, timeout):
                assert urls == [official, mirror] and sha256 == pinned and timeout == 90
                destination.write_bytes(data)
                return {'verified': True, 'sourceAttempts': [
                    {'url': official, 'error': 'Connection timed out'},
                    {'url': mirror, 'verified': True}]}

            # Shared policy fallback/hash safety is tested above; here verify the
            # builder supplies its exact pins and retains the policy provenance.
            with patch.object(builder['runpy'], 'run_path', return_value={'download_verified': verified_download}):
                target = builder['download'](name, cache)
            record = json.loads((cache / (name + '-download-attempts.json')).read_text())
            assert target.read_bytes() == data and target == cache / (name + '.zip')
            assert [attempt['url'] for attempt in record['sourceAttempts']] == [official, mirror]
        assert builder['SOURCES']['native'] == (
            'https://github.com/lzhiyong/android-sdk-tools/releases/download/35.0.2/android-sdk-tools-static-aarch64.zip',
            'db1cea2c4454d5f9c5a802646b2d1cf560b4ee7badbe23e51ab8e1881bb50fc2')
        checked += 1
        partial.write_bytes(data[:5])

        def wrong_range(request, **kwargs):
            reply = Reply(data[5:], request.full_url)
            reply.status = 206
            reply.headers = {'Content-Range': 'bytes 4-' + str(len(data) - 1) + '/' + str(len(data))}
            return reply

        with patch.object(state['urllib'].request, 'urlopen', wrong_range):
            try:
                policy['download_verified'](['https://official.invalid/sdk', 'https://mirror.invalid/sdk'], digest, partial)
                raise AssertionError('wrong range accepted')
            except ValueError as error:
                assert not error.retryable and len(error.sourceAttempts) == 1
        assert partial.read_bytes() == data[:5]
        checked += 1

        def ignores_range(request, **kwargs):
            reply = Reply(data, request.full_url)
            reply.status = 200
            reply.headers = {'Content-Length': str(len(data))}
            return reply

        with patch.object(state['urllib'].request, 'urlopen', ignores_range):
            result = policy['download_verified'](['https://official.invalid/sdk'], digest, partial)
        assert result['verified'] and partial.read_bytes() == data
        checked += 1
    print('PASS download policy', checked, 'offline checks: verified mirrors, explicit failures, signed repositories and retained source attempts')


if __name__ == '__main__':
    main()
