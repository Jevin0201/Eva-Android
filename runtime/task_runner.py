"""Local command task runner. No listening socket or cloud credentials."""
import json, os, pathlib, selectors, signal, subprocess, time, uuid

class TaskRunner:
    def __init__(self, store):
        self.store = pathlib.Path(store)
        self.store.mkdir(parents=True, exist_ok=True)

    def run(self, argv, cwd, timeout=60, cancel_file=None, on_event=None):
        if not argv or not all(isinstance(x, str) for x in argv):
            raise ValueError('argv must be a nonempty list of strings')
        if timeout <= 0:
            raise ValueError('timeout must be positive')
        task_id = str(uuid.uuid4())
        folder = self.store / task_id
        folder.mkdir()
        started = time.monotonic()
        sequence = 0
        total = 0
        limit = 1024 * 1024
        def event(kind, **fields):
            nonlocal sequence
            sequence += 1
            with (folder / 'events.jsonl').open('a', encoding='utf8') as f:
                f.write(json.dumps(dict(seq=sequence, taskId=task_id, type=kind, **fields), ensure_ascii=False)+'\n')
                f.flush()
            if on_event is not None:
                on_event(dict(seq=sequence, taskId=task_id, type=kind, **fields))
        def snapshot(state, **fields):
            value = dict(taskId=task_id, state=state, argv=argv, cwd=str(cwd), **fields)
            temp = folder / 'state.tmp'
            temp.write_text(json.dumps(value, ensure_ascii=False), encoding='utf8')
            temp.replace(folder / 'state.json')
            return value
        snapshot('starting')
        try:
            p = subprocess.Popen(argv, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
        except Exception as e:
            event('error', message=str(e))
            return snapshot('failed', error=str(e))
        snapshot('running', pid=p.pid)
        event('started', pid=p.pid)
        selector = selectors.DefaultSelector()
        selector.register(p.stdout, selectors.EVENT_READ, 'stdout')
        selector.register(p.stderr, selectors.EVENT_READ, 'stderr')
        state = 'running'
        stopped = None
        truncated = False
        def kill_group(sig):
            try: os.killpg(p.pid, sig)
            except ProcessLookupError: pass
        try:
            while selector.get_map() or p.poll() is None:
                now = time.monotonic()
                if state == 'running':
                    if cancel_file and pathlib.Path(cancel_file).exists(): state = 'cancelled'
                    elif now - started >= timeout: state = 'timed_out'
                    if state != 'running':
                        event(state)
                        kill_group(signal.SIGTERM)
                        stopped = now
                if stopped is not None and now - stopped > 0.5:
                    kill_group(signal.SIGKILL)
                for key, _ in selector.select(0.05):
                    chunk = os.read(key.fileobj.fileno(), 8192)
                    if not chunk:
                        selector.unregister(key.fileobj)
                        key.fileobj.close()
                        continue
                    keep = chunk[:max(0, limit-total)]
                    total += len(keep)
                    if keep:
                        # Raw bytes preserve UTF-8 sequences split between reads.
                        import base64
                        event('output', stream=key.data, base64=base64.b64encode(keep).decode('ascii'))
                    if len(keep) < len(chunk) and not truncated:
                        truncated = True
                        event('output_truncated', limit=limit)
                if stopped is not None and now - stopped > 3:
                    break
            code = p.wait(timeout=2)
            if state == 'running': state = 'succeeded' if code == 0 else 'failed'
            event('finished', state=state, exitCode=code)
            return snapshot(state, exitCode=code, outputTruncated=truncated)
        finally:
            kill_group(signal.SIGKILL)
            selector.close()
            p.stdout.close(); p.stderr.close()

    def recover(self):
        # A new runner cannot safely identify old PIDs: mark interrupted, never replay.
        recovered = []
        for file in self.store.glob('*/state.json'):
            value = json.loads(file.read_text(encoding='utf8'))
            if value['state'] in ('starting', 'running'):
                value['state'] = 'interrupted'
                temp = file.with_suffix('.tmp')
                temp.write_text(json.dumps(value), encoding='utf8'); temp.replace(file)
                recovered.append(value['taskId'])
        return recovered
