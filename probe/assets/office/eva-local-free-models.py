#!/usr/bin/env python3
"""Start the existing standalone project without changing its source or settings."""
import hashlib
import json
import os
import pathlib
import runpy
import signal
import subprocess
import time
import urllib.request

ROOT = pathlib.Path('/root/eva-workspace/projects/our-free-model-eva')
DATA = ROOT.parent / 'our-free-model-eva-data'
OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def healthy():
    try:
        with OPENER.open('http://127.0.0.1:18900/health', timeout=2) as response:
            return json.load(response).get('service') == 'our-free-model-standalone'
    except Exception:
        return False


def start():
    DATA.mkdir(mode=0o700, exist_ok=True)
    # A service left alive by a previous host has a stale authenticated proxy.
    source = runpy.run_path(str(pathlib.Path(__file__).with_name('eva-local-free-models-compat.py')))['apply'](ROOT)
    stamp = hashlib.sha256((os.environ.get('HTTPS_PROXY', '') + '\n' + source).encode()).hexdigest()
    marker = DATA / 'eva-managed-service.json'
    if healthy():
        try:
            prior = json.loads(marker.read_text())
        except (OSError, ValueError):
            raise RuntimeError('已有外部服务正在运行，无法确认其协议版本。请停止该实例后重新接入；源码备份和数据已保留。')
        if prior.get('proxy') == stamp:
            return
        pid = prior.get('pid')
        if not isinstance(pid, int) or pid < 2:
            raise RuntimeError('invalid managed service pid')
        try:
            command = pathlib.Path(f'/proc/{pid}/cmdline').read_bytes().split(b'\0')
            if str(ROOT / 'packages/standalone/cli.mjs').encode() not in command or str(DATA).encode() not in command:
                raise RuntimeError('managed service ownership changed')
            os.kill(pid, signal.SIGTERM)
        except FileNotFoundError:
            pass
        for _ in range(20):
            if not healthy():
                break
            time.sleep(0.1)
        if healthy():
            raise RuntimeError('previous managed service did not stop')
    env = dict(os.environ, OUR_FREE_MODEL_FREE_TRANSPORT='node', NODE_USE_ENV_PROXY='1')
    descriptor = os.open(DATA / 'eva-service.log', os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o600)
    with os.fdopen(descriptor, 'ab') as output:
        child = subprocess.Popen(['node', str(ROOT / 'packages/standalone/cli.mjs'), '--data-dir', str(DATA), '--port', '18900'], cwd=ROOT, env=env, stdin=subprocess.DEVNULL, stdout=output, stderr=output, start_new_session=True)
    temporary = marker.with_suffix('.tmp')
    temporary.write_text(json.dumps({'pid': child.pid, 'proxy': stamp}))
    temporary.chmod(0o600)
    temporary.replace(marker)
    for _ in range(50):
        if healthy():
            return
        if child.poll() is not None:
            raise RuntimeError('standalone service exited during startup')
        time.sleep(0.2)
    child.terminate()
    raise RuntimeError('standalone service readiness timed out')


if __name__ == '__main__':
    try:
        start()
    except RuntimeError as error:
        print('EVA_LOCAL_ERROR:' + str(error), flush=True)
        raise SystemExit(1)
    print('EVA_LOCAL_READY:' + os.environ['EVA_LOCAL_READY_TOKEN'], flush=True)
