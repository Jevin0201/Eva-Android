"""Run with python3 on Linux, or via device-python.py with the helper source preloaded."""
import pathlib, tempfile, importlib.util, os, json
if 'git_module' not in globals():
    spec=importlib.util.spec_from_file_location('eva_git',pathlib.Path(__file__).resolve().parents[1]/'probe/assets/eva-git.py')
    git_module=importlib.util.module_from_spec(spec);spec.loader.exec_module(git_module)
g=git_module
checks=[]
def check(name,condition):
    assert condition,name
    checks.append(name)
def rejected(name,fn):
    try:fn()
    except g.GitError:checks.append(name);return
    raise AssertionError(name)

with tempfile.TemporaryDirectory(prefix='eva-git-check-') as tmp:
    workspace=pathlib.Path(tmp);repo=workspace/'项目';repo.mkdir()
    # Real phone bootstrap has an umbrella .git at the workspace root.
    g.run(workspace,['init','--template=','--initial-branch=main'])
    def call(action,**params):return g.execute(workspace,dict(folder='项目',action=action,**params))
    check('empty folder',not call('status')['repository'])
    check('umbrella repository preserved',(workspace/'.git').is_dir())
    state=call('init');check('init main',state['branch']=='main')
    source=repo/'中文 notes.txt';source.write_text('第一行\n',encoding='utf-8')
    state=call('status');check('unicode filename',state['files'][0]['path']==source.name)
    check('untracked preview',call('diff',path=source.name)['text']=='第一行\n')
    state=call('stage',path=source.name,token=state['token']);check('staged file',state['files'][0]['code']=='A ')
    state=call('unstage',path=source.name,token=state['token']);check('unborn unstage keeps content',source.read_text(encoding='utf-8')=='第一行\n' and state['files'][0]['code']=='??')
    stale=state['token'];state=call('stage',path=source.name,token=stale)
    rejected('stale index rejected',lambda:call('commit',token=stale,message='bad',name='Tester',email='tester@example.invalid'))
    hook=repo/'.git/hooks/pre-commit';hook.parent.mkdir(exist_ok=True);hook.write_text('#!/bin/sh\nprintf unsafe > '+str(repo/'hook-ran'));hook.chmod(0o755)
    state=call('commit',token=state['token'],message='首次提交',name='Eva Test',email='eva-test@example.invalid')
    check('commit clean and hooks disabled',not state['files'] and not (repo/'hook-ran').exists())
    source.write_text('第二行\n',encoding='utf-8');state=call('status')
    g.run(repo,['config','diff.external','touch '+str(repo/'external-ran')])
    g.run(repo,['config','core.fsmonitor','touch '+str(repo/'monitor-ran')])
    check('worktree diff', '+第二行' in call('diff',path=source.name)['text'])
    state=call('status');check('external diff and fsmonitor disabled',not (repo/'external-ran').exists() and not (repo/'monitor-ran').exists())
    state=call('stage',token=state['token'],path=source.name)
    check('cached diff','+第二行' in call('diff',path=source.name,staged=True)['text'])
    state=call('unstage',token=state['token'],path=source.name)
    check('unstage keeps worktree',source.read_text(encoding='utf-8')=='第二行\n' and state['files'][0]['code']==' M')
    rejected('traversal rejected',lambda:g.execute(workspace,dict(folder='../',action='status')))
    rejected('pathspec traversal rejected',lambda:call('diff',path='../outside'))
    (repo/'outside').symlink_to('/etc/passwd')
    rejected('outside symlink rejected',lambda:call('diff',path='outside'))
    nested=repo/'nested';nested.mkdir()
    rejected('ancestor repo rejected',lambda:g.execute(workspace,dict(folder='项目/nested',action='init')))
    g.run(repo,['config','filter.bad.clean','touch '+str(repo/'filter-ran')])
    (repo/'.gitattributes').write_text('* filter=bad\n')
    rejected('status clean filter blocked',lambda:call('status'))
    rejected('clean filter blocked',lambda:call('stage',path=source.name,token=state['token']))
    check('filter did not execute',not (repo/'filter-ran').exists())
    external=workspace/'linked';external.mkdir();(external/'.git').write_text('gitdir: '+str(repo/'.git'))
    rejected('external gitdir rejected',lambda:g.execute(workspace,dict(folder='linked',action='status')))
print(json.dumps(dict(result='PASS',checks=checks,count=len(checks)),ensure_ascii=False))
