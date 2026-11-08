"""Package installation preflight, signed Alpine packages, inventory and capability checks."""
import argparse, fcntl, json, os, pathlib, platform, re, runpy, shutil, subprocess, tarfile, tempfile, time

BASE = pathlib.Path('/root/.eva-runtime')
PROFILES = {
    'utilities': ['ripgrep', 'findutils', 'coreutils', 'file', 'jq', 'zip', 'unzip'],
    'office-render': ['libreoffice-impress', 'libreoffice-writer', 'libreoffice-calc',
                      'libreoffice-draw', 'poppler-utils', 'font-noto-cjk'],
    'office-authoring': [],  # Installed by the pinned managed office adapter.
    'html-render': ['chromium', 'font-noto-cjk'],
    'development': ['build-base', 'python3-dev', 'py3-pip', 'nodejs', 'npm', 'git', 'pkgconf'],
    'media': ['ffmpeg', 'imagemagick'],
}

def command(args, timeout=600):
    def attempt(command):
        transaction = command and command[0] == 'apk' and 'add' in command and '--simulate' not in command
        result = subprocess.run(command, capture_output=True, text=True, timeout=None if transaction else timeout)
        if result.returncode:
            raise RuntimeError((result.stdout + result.stderr)[-5000:])
        return result.stdout + result.stderr
    if args and args[0] == 'apk':
        policy = runpy.run_path(str(pathlib.Path(__file__).with_name('eva-download-policy.py')))
        return policy['apk_command'](args, attempt, BASE / 'download-attempts')
    return attempt(args)

def office_status():
    entry = pathlib.Path('/root/eva-office.py')
    if not entry.is_file():
        return {'ready': False, 'error': '办公入口缺失，请通过 eva_components ensure office 恢复资源'}
    try:
        return json.loads(command(['python3', str(entry), 'status'], timeout=60))
    except Exception as error:
        return {'ready': False, 'error': str(error)}

def repair_office():
    # Reuse signed Alpine dependencies and SHA-pinned pure-Python wheels. This
    # path does not require pip or replace the system Python installation.
    log = command(['python3', '/root/eva-office.py', 'install'], timeout=1200)
    result = office_status()
    if not result.get('ready'):
        raise RuntimeError('办公库修复尚未就绪：' + json.dumps(result, ensure_ascii=False) + '\n' + log[-3000:])
    return {'ready': True, 'profile': 'office-authoring', 'status': result}

def preflight():
    BASE.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='link-check-', dir=BASE) as folder:
        a = pathlib.Path(folder) / 'a'; b = pathlib.Path(folder) / 'b'
        a.write_text('Eva'); os.link(a, b); a.unlink()
        if b.read_text() != 'Eva':
            raise RuntimeError('硬链接兼容检查失败')
    return {'distribution': pathlib.Path('/etc/alpine-release').read_text().strip(),
            'architecture': platform.machine(), 'hardlinks': True,
            'freeBytes': shutil.disk_usage(BASE).free,
            'tools': {name: shutil.which(name) for name in ['apk', 'python3', 'pip3', 'node', 'npm', 'git', 'cc', 'libreoffice', 'chromium-browser']},
            'officeAuthoring': office_status(),
            'profiles': PROFILES}

def records():
    text = pathlib.Path('/lib/apk/db/installed').read_text()
    rows = []
    for block in text.split('\n\n'):
        fields = dict(line.split(':', 1) for line in block.splitlines() if ':' in line and len(line.split(':', 1)[0]) == 1)
        if 'P' in fields:
            rows.append({'name': fields['P'], 'version': fields.get('V'),
                         'license': fields.get('L'), 'source': fields.get('U'),
                         'origin': fields.get('o'), 'checksum': fields.get('C')})
    return rows

def install(profile=None, packages=()):
    state = preflight()
    if not state['distribution'].startswith('3.22.') or state['architecture'] != 'aarch64':
        raise RuntimeError('此安装入口只验证 Alpine 3.22 aarch64，请先适配当前环境')
    if profile == 'office-authoring':
        return repair_office()
    selected = list(dict.fromkeys(PROFILES.get(profile, []) + list(packages)))
    if not selected or any(not re.fullmatch(r'[a-z0-9][a-z0-9+_.-]*', p) for p in selected):
        raise ValueError('提供能力名称或合法 Alpine 软件包名；不接受命令或安装选项')
    if state['freeBytes'] < 512 * 1024 * 1024:
        raise RuntimeError('可用空间不足 512 MiB，请先释放空间')
    with open(BASE / 'installation.lock', 'w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        cancel = pathlib.Path('/root/.eva-office/cancel'); cancel.unlink(missing_ok=True)
        job = BASE / 'installations' / str(time.time_ns()); job.mkdir(parents=True)
        for name in ['/etc/apk/world', '/lib/apk/db/installed']:
            shutil.copyfile(name, job / pathlib.Path(name).name)
        cache = BASE / 'apk-cache'; cache.mkdir(exist_ok=True)
        prefix = ['apk', '--cache-dir', str(cache), '--update-cache']
        print(json.dumps({'progress': '检查签名仓库、依赖和许可证', 'packages': selected}, ensure_ascii=False), flush=True)
        command(['apk', '--cache-dir', str(cache), 'update'])
        plan = command(prefix + ['add', '--simulate', '--no-progress', *selected])
        planned = set(selected) | set(re.findall(r'(?:Installing|Upgrading|Reinstalling) ([a-z0-9][a-z0-9+_.-]*) \(', plan))
        licenses = []
        for index in cache.glob('APKINDEX.*.tar.gz'):
            with tarfile.open(index) as archive:
                member = archive.extractfile('APKINDEX')
                if member is None:
                    continue
                for block in member.read().decode().split('\n\n'):
                    fields = dict(line.split(':', 1) for line in block.splitlines() if ':' in line and len(line.split(':', 1)[0]) == 1)
                    if fields.get('P') in planned:
                        licenses.append({'name': fields['P'], 'version': fields.get('V'), 'license': fields.get('L'), 'source': fields.get('U')})
        if any(not any(r['name'] == name and r['license'] for r in licenses) for name in planned):
            raise RuntimeError('软件包许可证元数据不完整；未开始安装')
        (job / 'plan.json').write_text(json.dumps({'requested': selected, 'plan': plan, 'licenses': licenses}, ensure_ascii=False, indent=2))
        if cancel.exists():
            raise RuntimeError('已取消，未开始软件包安装')
        print(json.dumps({'progress': '安装软件包', 'licenses': licenses}, ensure_ascii=False), flush=True)
        try:
            log = command(prefix + ['add', '--no-progress', *selected])
        except Exception as error:
            (job / 'failure.txt').write_text(str(error))
            raise RuntimeError('安装未完成，记录已保存；请先检查包状态再重试：' + str(error))
        (job / 'install.log').write_text(log)
        inventory = records()
        (BASE / 'installed-packages.json').write_text(json.dumps(inventory, ensure_ascii=False, indent=2))
        return {'installed': selected, 'transaction': str(job), 'verifiedExecutable': False,
                'next': '安装成功后仍需运行版本检查和一项实际任务；不要仅以安装完成宣称能力可用。'}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['status', 'inventory', 'install'])
    parser.add_argument('--profile', choices=PROFILES)
    parser.add_argument('--apk', nargs='+', default=[])
    args = parser.parse_args()
    value = preflight() if args.action == 'status' else records() if args.action == 'inventory' else install(args.profile, args.apk)
    print(json.dumps(value, ensure_ascii=False), flush=True)

if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'error': str(error)}, ensure_ascii=False), flush=True)
        raise SystemExit(1)
