"""Collect exact aports recipes and hash-verified sources for the clean Eva seed."""
import concurrent.futures
import hashlib
import json
import pathlib
import re
import tarfile
import urllib.error
import urllib.parse
import urllib.request

BASE = pathlib.Path('artifacts/runtime-license')
SOURCE = BASE / 'sources'
INSTALLED = pathlib.Path('artifacts/bootstrap-image/apk-installed.txt')


def fetch(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'Eva-source-collector/1.0'})
    with urllib.request.urlopen(request, timeout=180) as response:
        return response.read()


def collect(group):
    origin, commit, packages = group
    directory = SOURCE / (origin + '-' + packages[0]['version'])
    directory.mkdir(parents=True, exist_ok=True)
    recipe = None
    for repository in ['main', 'community', 'testing']:
        base = f'https://raw.githubusercontent.com/alpinelinux/aports/{commit}/{repository}/{origin}'
        try:
            recipe = fetch(base + '/APKBUILD')
            break
        except urllib.error.HTTPError as error:
            if error.code != 404:
                raise
    if recipe is None:
        raise RuntimeError('Exact commit APKBUILD unavailable')
    (directory / 'APKBUILD').write_bytes(recipe)
    matches = re.search(r'^sha512sums=["\'](.*?)["\']', recipe.decode(), re.M | re.S)
    if matches is None:
        raise RuntimeError('No static sha512sums in exact APKBUILD')
    files = [{'name': 'APKBUILD', 'url': base + '/APKBUILD',
              'sha512': hashlib.sha512(recipe).hexdigest()}]
    missing = []
    for line in matches.group(1).strip().splitlines():
        checksum, name = line.split()
        if not re.fullmatch(r'[0-9a-f]{128}', checksum):
            raise RuntimeError('Unsupported checksum expression')
        target = directory / name
        if pathlib.PurePosixPath(name).name != name:
            raise RuntimeError('Source filename contains a path')
        if target.is_file() and hashlib.sha512(target.read_bytes()).hexdigest() == checksum:
            files.append({'name': name, 'sha512': checksum, 'cached': True,
                          'sourceCandidates': [base + '/' + urllib.parse.quote(name),
                                               'https://distfiles.alpinelinux.org/distfiles/v3.22/' + urllib.parse.quote(name)]})
            continue
        found = False
        candidates = [base + '/' + urllib.parse.quote(name),
                      'https://distfiles.alpinelinux.org/distfiles/v3.22/' + urllib.parse.quote(name)]
        for url in candidates:
            try:
                data = fetch(url)
            except (urllib.error.URLError, TimeoutError) as error:
                continue
            if hashlib.sha512(data).hexdigest() != checksum:
                continue
            target.write_bytes(data)
            files.append({'name': name, 'sha512': checksum, 'url': url})
            found = True
            break
        if not found:
            missing.append({'name': name, 'sha512': checksum, 'attempted': candidates})
    return {'origin': origin, 'commit': commit, 'repository': repository,
            'packages': packages, 'files': files, 'missing': missing,
            'complete': not missing, 'directory': directory.as_posix()}


def main():
    SOURCE.mkdir(parents=True, exist_ok=True)
    groups = {}
    inventory = []
    for block in INSTALLED.read_text(encoding='utf-8').split('\n\n'):
        fields = dict(line.split(':', 1) for line in block.splitlines() if len(line) > 1 and line[1] == ':')
        if 'P' not in fields:
            continue
        package = {'name': fields['P'], 'version': fields['V'], 'license': fields.get('L', ''),
                   'origin': fields.get('o'), 'commit': fields.get('c'), 'homepage': fields.get('U')}
        inventory.append(package)
        if re.search(r'\b(?:L?GPL|MPL)', package['license']):
            groups.setdefault((package['origin'], package['commit']), []).append(package)
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        jobs = {pool.submit(collect, (origin, commit, packages)): (origin, commit)
                for (origin, commit), packages in sorted(groups.items())}
        for job in concurrent.futures.as_completed(jobs):
            origin, commit = jobs[job]
            try:
                result = job.result()
            except Exception as error:
                result = {'origin': origin, 'commit': commit, 'complete': False, 'error': str(error)}
            results.append(result)
            print(origin, 'complete' if result['complete'] else 'INCOMPLETE', flush=True)
            (BASE / 'source-manifest.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
    notices = ['Eva clean Alpine 3.22 aarch64 seed third-party inventory', '',
               'Exact corresponding-source collection status is recorded in source-manifest.json.',
               'Incomplete entries must be resolved before representing this source delivery as complete.', '']
    notices.extend(f"{p['name']} {p['version']} | {p['license']} | aports {p['origin']} at {p['commit']}" for p in inventory)
    (BASE / 'THIRD_PARTY_NOTICES.txt').write_text('\n'.join(notices) + '\n', encoding='utf-8')
    (BASE / 'README.txt').write_text(
        'Eva Alpine 3.22 aarch64 corresponding-source delivery\n\n'
        'The apk-installed.txt ledger identifies exact installed package versions and aports commits.\n'
        'Each copyleft origin directory contains the exact commit APKBUILD plus every file in its sha512sums.\n'
        'Original archive files preserve upstream license and copyright texts. Source archives are not executed.\n'
        'source-manifest.json records source completeness independently for every origin.\n'
        'THIRD_PARTY_NOTICES.txt lists all installed packages, including permissively licensed packages.\n'
        'For rebuilds use the included APKBUILD with its matching Alpine 3.22 aports toolchain and dependencies.\n'
        'GCC 14.2.0 was obtained from the Tsinghua GNU mirror and matched the exact APKBUILD SHA-512.\n'
        'This delivery covers Alpine GPL/LGPL/MPL package sources. PRoot, Codex, APK native libraries,\n'
        'application UI component permissions and other third-party obligations have separate records.\n',
        encoding='utf-8')
    output = pathlib.Path('outputs/runtime-sources')
    output.mkdir(parents=True, exist_ok=True)
    archive = output / 'eva-alpine-3.22-aarch64-sources.tar.gz'
    with tarfile.open(archive, 'w:gz') as tar:
        tar.add(SOURCE, arcname='sources')
        for name in ['source-manifest.json', 'THIRD_PARTY_NOTICES.txt', 'README.txt']:
            tar.add(BASE / name, arcname=name)
        tar.add(INSTALLED, arcname='apk-installed.txt')
        tar.add(__file__, arcname='collect-bootstrap-sources.py')
    missing = [result['origin'] for result in results if not result['complete']]
    print(json.dumps({'origins': len(results), 'incomplete': missing, 'archive': str(archive)}), flush=True)
    return bool(missing)


if __name__ == '__main__':
    raise SystemExit(main())
