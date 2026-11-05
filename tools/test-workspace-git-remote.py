"""Isolated remote Git cycle. All repositories and remote writes are task-owned."""
import importlib.util
import pathlib
import tempfile
import json
import os
import subprocess

if 'git_module' not in globals():
    spec = importlib.util.spec_from_file_location('eva_git', pathlib.Path(__file__).resolve().parents[1] / 'probe/assets/eva-git.py')
    git_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(git_module)
g = git_module
checks = []

def check(name, value):
    assert value, name
    checks.append(name)

def rejected(name, operation):
    try:
        operation()
    except g.GitError as error:
        checks.append(name)
        return str(error)
    raise AssertionError(name)

with tempfile.TemporaryDirectory(prefix='eva-git-remote-check-') as temporary:
    workspace = pathlib.Path(temporary)
    bare = workspace / 'remote.git'
    bare.mkdir()
    g.run(bare, ['init', '--bare', '--template=', '--initial-branch=main'])
    for name in ['one', 'two']:
        (workspace / name).mkdir()

    def call(repo, action, **values):
        state = g.execute(workspace, dict(folder=repo, action='status'))
        return g.execute(workspace, dict(folder=repo, action=action, token=state.get('token', ''), **values))

    def commit(repo, message):
        call(repo, 'stage', path='document.txt')
        return call(repo, 'commit', message=message, name='Fixture', email='fixture@example.test')

    call('one', 'init')
    (workspace / 'one/document.txt').write_text('base\n')
    commit('one', 'base')
    call('one', 'remote-set', remote='origin', url=str(bare))
    call('one', 'push', remote='origin', branch='main')
    check('push creates remote branch', g.text(bare, ['rev-parse', 'refs/heads/main']) == g.text(workspace / 'one', ['rev-parse', 'HEAD']))
    call('two', 'clone', url=str(bare))
    check('clone preserves content', (workspace / 'two/document.txt').read_text() == 'base\n')
    call('two', 'branch-create', branch='feature')
    check('branch creation switches', call('two', 'status')['branch'] == 'feature')
    call('two', 'branch-switch', branch='main')
    (workspace / 'two/document.txt').write_text('remote\n')
    commit('two', 'remote update')
    call('two', 'push', remote='origin', branch='main')
    call('one', 'pull', remote='origin', branch='main')
    check('fast-forward pull updates content', (workspace / 'one/document.txt').read_text() == 'remote\n')
    (workspace / 'one/document.txt').write_text('local conflict\n')
    rejected('dirty branch switch rejected', lambda: call('one', 'branch-switch', branch='main'))
    commit('one', 'local side')
    (workspace / 'two/document.txt').write_text('remote conflict\n')
    commit('two', 'remote side')
    call('two', 'push', remote='origin', branch='main')
    rejected('non-fast-forward push rejected', lambda: call('one', 'push', remote='origin', branch='main'))
    rejected('divergent pull reports explicit merge required', lambda: call('one', 'pull', remote='origin', branch='main'))
    merged = call('one', 'merge', branch='origin/main')
    check('merge exposes conflict paths', merged['merging'] and merged['conflicts'] == ['document.txt'])
    call('one', 'merge-abort')
    check('merge abort restores local content', (workspace / 'one/document.txt').read_text() == 'local conflict\n')
    call('one', 'merge', branch='origin/main')
    call('one', 'resolve', path='document.txt', side='theirs')
    state = call('one', 'commit', message='resolve merge', name='Fixture', email='fixture@example.test')
    check('resolved merge committed', not state['merging'] and not state['conflicts'])
    check('chosen conflict content retained', (workspace / 'one/document.txt').read_text() == 'remote conflict\n')
    call('one', 'push', remote='origin', branch='main')
    check('history visible', 'resolve merge' in call('one', 'history')['text'])
    rejected('credential-bearing URL refused', lambda: call('one', 'remote-set', remote='bad', url='https://user:secret@example.test/repo'))
    rejected('external local remote refused', lambda: call('one', 'remote-set', remote='bad', url='/tmp/outside-eva-repo'))
    rejected('unsafe branch refused', lambda: call('one', 'branch-create', branch='--orphan'))
    call('one', 'remote-set', remote='missing', url=str(workspace / 'missing.git'))
    reason=rejected('missing remote fails', lambda: call('one', 'fetch', remote='missing'))
    check('missing remote error classified', '\u4e0d\u5b58\u5728' in reason)
    g.run(workspace / 'one', ['config', 'url.ext::echo bad.insteadOf', str(bare)])
    rejected('URL rewrite prevented', lambda: call('one', 'fetch', remote='origin'))

    original_run = g.run
    saved_environment = dict(os.environ)
    auth_results = []
    def inspect_askpass(root, args, **options):
        if args[0] == 'config':
            return b'', False, 1
        helper = os.environ['EVA_GIT_ASKPASS']
        for prompt in ["Password for 'https://git@example.test/owner/repo.git':", "Password for 'https://git@other.test/owner/repo.git':"]:
            reply = subprocess.run(['/usr/bin/python3', helper, prompt], capture_output=True, env=os.environ)
            auth_results.append((reply.returncode, reply.stdout.decode().strip()))
        return b'', False, 0
    try:
        g.run = inspect_askpass
        os.environ.update(EVA_GIT_AUTH_URL='https://example.test/owner/repo.git', EVA_GIT_USERNAME='git', EVA_GIT_PASSWORD='fixture-secret')
        g.network(workspace / 'one', workspace, ['fetch', 'origin'], 'https://example.test/owner/repo.git')
        check('askpass supplies only bound repository credentials', auth_results[0] == (0, 'fixture-secret') and auth_results[1][0] != 0)
        check('askpass temporary environment cleared', 'EVA_GIT_ASKPASS' not in os.environ)
    finally:
        g.run = original_run
        os.environ.clear()
        os.environ.update(saved_environment)

    original_process = g.subprocess.run
    try:
        import types
        for diagnostic, category in [
            ('fatal: Authentication failed for fixture-secret 401', '\u8ba4\u8bc1\u5931\u8d25'),
            ('Host key verification failed fixture-secret', '\u4e3b\u673a\u5bc6\u94a5'),
            ('Could not resolve host fixture-secret', '\u7f51\u7edc\u8fde\u63a5\u5931\u8d25')]:
            def fail_process(command, **options):
                options['stderr'].write(diagnostic.encode())
                return types.SimpleNamespace(returncode=128)
            g.subprocess.run = fail_process
            try:
                g.run(workspace / 'one', ['fetch', 'origin'], network_error=True)
                raise AssertionError('Failure was not raised')
            except g.GitError as error:
                check('sanitized category ' + category, category in str(error) and 'fixture-secret' not in str(error))
    finally:
        g.subprocess.run = original_process

print(json.dumps(dict(result='PASS', count=len(checks), checks=checks)))
