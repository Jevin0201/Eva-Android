"""Bounded verified downloads and per-command mirrors without global config edits."""
import hashlib
import http.client
import json
import time
from html.parser import HTMLParser
from pathlib import Path
import re
import urllib.error
import urllib.parse
import urllib.request

PIP_INDEXES = ('https://pypi.org/simple', 'https://pypi.tuna.tsinghua.edu.cn/simple', 'https://mirrors.aliyun.com/pypi/simple')
NPM_REGISTRIES = ('https://registry.npmjs.org', 'https://registry.npmmirror.com')
APK_MIRRORS = ('https://dl-cdn.alpinelinux.org/alpine', 'https://mirrors.tuna.tsinghua.edu.cn/alpine', 'https://mirrors.aliyun.com/alpine')


def pip_indexes():
    return PIP_INDEXES


def is_network_failure(error):
    if isinstance(error, urllib.error.HTTPError):
        return error.code >= 500 or error.code == 408
    text = str(error).lower()
    if any(value in text for value in ('hash mismatch', 'hashes do not match', 'sha256', 'integrity', 'certificate verify', 'certificate_verify', 'unsupported platform', 'not a supported wheel', 'wrong architecture', 'permission denied')):
        return False
    if isinstance(error, (TimeoutError, ConnectionError, urllib.error.URLError)):
        return True
    return bool(re.search(r'timed?\s*out|timeout|connection (?:reset|refused|aborted)|temporary (?:failure|error)|name resolution|failed to establish a new connection|network is unreachable|network error|could not resolve|http(?: error| status)?[ :]+5\d\d|\b50[0234]\b|remote end closed|tls.*(?:closed|reset)|ssl.*eof', text))


def apk_install(packages, runner, directory, progress=lambda message: None):
    """runner(argv) must capture errors and enforce its own execution deadline."""
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    attempts = []
    for index, mirror in enumerate(APK_MIRRORS):
        repositories = directory / ('repositories-' + str(index))
        repositories.write_text(mirror + '/v3.22/main\n' + mirror + '/v3.22/community\n')
        progress('检查 Alpine 签名仓库 ' + mirror)
        attempts.append({'source': mirror})
        try:
            runner(['apk', '--repositories-file', str(repositories), '--timeout', '60', '--no-cache', 'add', *packages])
            return attempts
        except Exception as error:
            attempts[-1]['failure'] = 'network' if is_network_failure(error) else 'package-or-verification'
            if not is_network_failure(error) or index == len(APK_MIRRORS) - 1:
                raise


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.values = []

    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            self.values.extend(value for key, value in attrs if key == 'href')


def wheel_url(index, filename):
    project = filename.split('-')[0].replace('_', '-')
    location = index.rstrip('/') + '/' + project + '/'
    with urllib.request.urlopen(location, timeout=30) as response:
        body = response.read(2 * 1024 * 1024 + 1)
    if len(body) > 2 * 1024 * 1024:
        raise ValueError('Package index exceeds size limit')
    parser = Links()
    parser.feed(body.decode())
    for href in parser.values:
        candidate = urllib.parse.urljoin(location, href)
        parsed = urllib.parse.urlsplit(candidate)
        if urllib.parse.unquote(parsed.path.rsplit('/', 1)[-1]) == filename:
            if parsed.scheme != 'https' or parsed.username or parsed.password:
                raise ValueError('Package mirror returned an unsafe download URL')
            return urllib.parse.urlunsplit(parsed._replace(fragment=''))
    raise ValueError('Pinned wheel is not present in the package mirror index')


def download_wheel(url, filename, sha256, destination, max_bytes=4 * 1024 * 1024, check_cancel=lambda: None):
    attempts = []
    sources = [('official', None), *[(index, index) for index in PIP_INDEXES[1:]]]
    for position, (source, index) in enumerate(sources):
        attempts.append({'source': source})
        try:
            location = url if index is None else wheel_url(index, filename)
            with urllib.request.urlopen(location, timeout=30) as response, Path(destination).open('wb') as output:
                if urllib.parse.urlsplit(response.url).scheme != 'https':
                    raise ValueError('Package download must preserve HTTPS')
                digest = hashlib.sha256()
                total = 0
                while True:
                    check_cancel()
                    chunk = response.read(65536)
                    if not chunk:
                        break
                    total += len(chunk)
                    if total > max_bytes:
                        raise ValueError('Package exceeded size limit')
                    digest.update(chunk)
                    output.write(chunk)
            if digest.hexdigest() != sha256:
                raise ValueError('Package SHA256 mismatch; mirror fallback is prohibited')
            return attempts
        except Exception as error:
            retryable = is_network_failure(error)
            attempts[-1]['failure'] = 'network' if retryable else 'verification'
            if not retryable or position == len(sources) - 1:
                error.sourceAttempts, error.retryable = attempts, retryable
                raise
    return attempts


def check_cancel():
    import os
    marker = os.environ.get('EVA_DEPENDENCY_CANCEL_FILE')
    if marker and Path(marker).is_file():
        raise RuntimeError('Dependency request cancelled; completed transactions are retained')


def apk_command(arguments, runner, directory):
    """Retry a signed apk command against bounded per-command repository files."""
    import json
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    attempts = []
    sources = [('configured-repositories', None), *[(mirror, mirror) for mirror in APK_MIRRORS[1:]]]
    for position, (name, mirror) in enumerate(sources):
        check_cancel()
        command = [argument for argument in arguments if argument != '--no-cache']
        if '--cache-dir' not in command:
            cache = directory / 'apk-cache'
            cache.mkdir(exist_ok=True)
            command[1:1] = ['--cache-dir', str(cache)]
        if '--timeout' not in command:
            command[1:1] = ['--timeout', '60']
        if mirror is not None:
            repositories = directory / ('repositories-' + str(position))
            repositories.write_text(mirror + '/v3.22/main\n' + mirror + '/v3.22/community\n')
            if '--repositories-file' in command:
                command[command.index('--repositories-file') + 1] = str(repositories)
            else:
                command[1:1] = ['--repositories-file', str(repositories)]
        attempts.append({'source': name})
        try:
            result = runner(command)
            with (directory / 'source-attempts.jsonl').open('a') as log:
                log.write(json.dumps(attempts) + '\n')
            check_cancel()
            return result
        except Exception as error:
            retryable = is_network_failure(error)
            attempts[-1]['failure'] = 'network' if retryable else 'package-or-verification'
            with (directory / 'source-attempts.jsonl').open('a') as log:
                log.write(json.dumps(attempts) + '\n')
            if not retryable or position == len(sources) - 1:
                error.sourceAttempts, error.retryable = attempts, retryable
                raise


def file_sha256(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def download_verified(urls, sha256, destination, timeout=90):
    if not re.fullmatch(r'[a-fA-F0-9]{64}', sha256):
        raise ValueError('A trusted SHA256 digest is required')
    urls = list(urls)
    if not urls:
        raise ValueError('No verified download sources were supplied')
    for url in urls:
        parsed = urllib.parse.urlsplit(url)
        if parsed.scheme != 'https' or parsed.username or parsed.password:
            raise ValueError('Verified downloads require credential-free HTTPS sources')
    destination = Path(destination)
    metadata = destination.with_name(destination.name + '.resume.json')
    journal = destination.with_name(destination.name + '.attempts.jsonl')
    if any(path.is_symlink() for path in (destination, metadata, journal)):
        raise ValueError('Download files must not use symlinks')
    expected = sha256.lower()
    if destination.is_file() and file_sha256(destination) == expected:
        return {'path': str(destination), 'sourceAttempts': [], 'verified': True, 'resumeMetadata': str(metadata), 'attemptLog': str(journal)}
    if metadata.is_file():
        state = json.loads(metadata.read_text())
        if state.get('sha256') != expected or not re.fullmatch(r'[a-f0-9]{64}', str(state.get('urlIdentity', ''))):
            raise ValueError('Existing partial download has different SHA256 or invalid URL identity; retained for inspection')
    elif destination.exists():
        # Preserve an unidentifiable prior file before starting this tracked job.
        destination.rename(destination.with_name(destination.name + '.unidentified-' + str(time.time_ns())))
    attempts = []

    def save_state(source):
        value = {'sha256': expected, 'urlIdentity': hashlib.sha256(source.encode()).hexdigest()}
        temporary = metadata.with_name(metadata.name + '.tmp')
        if temporary.is_symlink():
            raise ValueError('Download metadata temporary path uses a symlink')
        temporary.write_text(json.dumps(value))
        temporary.replace(metadata)

    def record(attempt):
        with journal.open('a') as stream:
            stream.write(json.dumps(attempt) + '\n')

    for source_index, url in enumerate(urls):
        for retry in range(2):
            check_cancel()
            offset = destination.stat().st_size if destination.is_file() else 0
            if offset > 2 * 1024**3:
                raise ValueError('Partial download exceeds size limit')
            attempt = {'source': urllib.parse.urlsplit(url).hostname, 'offset': offset}
            attempts.append(attempt)
            try:
                headers = {'Accept-Encoding': 'identity'}
                if offset:
                    headers['Range'] = 'bytes=' + str(offset) + '-'
                request = urllib.request.Request(url, headers=headers)
                with urllib.request.urlopen(request, timeout=timeout) as response:
                    if urllib.parse.urlsplit(response.url).scheme != 'https':
                        raise ValueError('Download redirected outside HTTPS')
                    status = getattr(response, 'status', 200)
                    response_headers = getattr(response, 'headers', {})
                    total_size, range_length = None, None
                    if status == 206:
                        content_range = response_headers.get('Content-Range', '')
                        match = re.fullmatch(r'bytes (\d+)-(\d+)/(\d+)', content_range)
                        if not match:
                            raise ValueError('Invalid Content-Range on resumed download')
                        start, end, total_size = map(int, match.groups())
                        if start != offset or end < start or end >= total_size or total_size > 2 * 1024**3:
                            raise ValueError('Content-Range offset or size mismatch')
                        range_length = end - start + 1
                    elif status == 200:
                        offset = 0  # Server ignored Range. Rewrite this tracked partial.
                        length = response_headers.get('Content-Length')
                        total_size = int(length) if length and length.isdigit() else None
                    else:
                        raise ValueError('Unsupported download HTTP status ' + str(status))
                    # The URL identity is recorded, while the common trusted SHA
                    # permits a verified mirror to continue the identical artifact.
                    save_state(url)
                    received = 0
                    with destination.open('ab' if offset else 'wb') as output:
                        while True:
                            check_cancel()
                            try:
                                chunk = response.read(1024 * 1024)
                            except http.client.IncompleteRead as error:
                                if error.partial:
                                    output.write(error.partial)
                                raise ConnectionError('Download interrupted; partial bytes retained') from error
                            if not chunk:
                                break
                            received += len(chunk)
                            if offset + received > 2 * 1024**3:
                                raise ValueError('Download exceeds 2 GiB limit')
                            output.write(chunk)
                    if range_length is not None and received != range_length:
                        raise ConnectionError('Download interrupted before its Content-Range completed')
                    if total_size is not None and destination.stat().st_size != total_size:
                        raise ConnectionError('Download interrupted before its declared size completed')
                if file_sha256(destination) != expected:
                    raise ValueError('Download SHA256 mismatch; no mirror fallback is allowed')
                attempt['verified'] = True
                record(attempt)
                return {'path': str(destination), 'sourceAttempts': attempts, 'verified': True, 'resumeMetadata': str(metadata), 'attemptLog': str(journal)}
            except Exception as error:
                retryable = is_network_failure(error)
                attempt['failure'] = 'network' if retryable else 'verification'
                record(attempt)
                if not retryable or (source_index == len(urls) - 1 and retry == 1):
                    error.sourceAttempts, error.retryable = attempts, retryable
                    raise
    raise RuntimeError('Verified download did not complete')
