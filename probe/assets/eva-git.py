#!/usr/bin/env python3
"""Bounded local Git operations for Eva Android. No shell or remote commands."""
import base64, hashlib, json, os, pathlib, re, subprocess, sys, tempfile

LIMIT = 262144

class GitError(Exception):
    pass

def run(root, args, limit=LIMIT, ok=(0,), identity=None):
    env = {k:v for k,v in os.environ.items() if not k.startswith('GIT_')}
    env.update(PATH='/usr/bin:/bin', HOME='/root', GIT_CONFIG_NOSYSTEM='1', GIT_CONFIG_GLOBAL='/dev/null',
               GIT_TERMINAL_PROMPT='0', GIT_OPTIONAL_LOCKS='0', GIT_LITERAL_PATHSPECS='1',
               GIT_CEILING_DIRECTORIES=str(pathlib.Path(root).parent))
    if identity:
        env.update(GIT_AUTHOR_NAME=identity[0],GIT_AUTHOR_EMAIL=identity[1],GIT_COMMITTER_NAME=identity[0],GIT_COMMITTER_EMAIL=identity[1])
    cmd=['git','-c','core.hooksPath=/dev/null','-c','core.fsmonitor=false','-c','commit.gpgsign=false',
         '-c','core.pager=cat','-c','maintenance.auto=false','-c','gc.auto=0','-c','submodule.recurse=false',
         '-c','diff.external=','-c','core.quotePath=false',*args]
    with tempfile.TemporaryFile() as out, tempfile.TemporaryFile() as err:
        try:
            p=subprocess.run(cmd,cwd=root,env=env,stdout=out,stderr=err,timeout=25)
        except subprocess.TimeoutExpired:
            raise GitError('Git 操作超时，请刷新状态后检查结果，勿重复提交')
        out.seek(0); result=out.read(limit+1)
        if p.returncode not in ok:
            # Do not relay arbitrary repo configuration/remote URLs or hook output.
            raise GitError('Git 操作失败（退出码 %s）；请检查索引锁、文件权限或未解决的冲突' % p.returncode)
        return result[:limit],len(result)>limit,p.returncode

def text(root,args):
    data,cut,_=run(root,args)
    if cut: raise GitError('仓库结果过大，请缩小操作范围')
    return data.decode('utf-8','replace').strip()

def selected(root,path):
    if not isinstance(path,str) or not path or '\x00' in path or pathlib.PurePosixPath(path).is_absolute() or '..' in pathlib.PurePosixPath(path).parts or '.git' in pathlib.PurePosixPath(path).parts:
        raise GitError('文件路径无效')
    candidate=root/path
    # Do not follow directory or file links outside this repository.
    if not candidate.resolve().is_relative_to(root): raise GitError('文件链接指向仓库之外')
    if candidate.is_dir(): raise GitError('请选择单个文件')
    return path

def token(root):
    head=run(root,['rev-parse','--verify','HEAD'],ok=(0,128))[0]
    index=root/'.git/index'
    digest=hashlib.sha256(head)
    if index.exists():
        with index.open('rb') as stream:
            for block in iter(lambda:stream.read(65536),b''):digest.update(block)
    return digest.hexdigest()

def status(root):
    data,cut,_=run(root,['status','--porcelain=v1','-z','--untracked-files=all','--ignore-submodules=all'],limit=1048576)
    if cut:raise GitError('变更文件过多，请使用终端查看')
    records=data.split(b'\0'); files=[];i=0
    while i<len(records):
        entry=records[i];i+=1
        if not entry:continue
        code=entry[:2].decode('ascii'); path=entry[3:].decode('utf-8','strict')
        previous=''
        if 'R' in code or 'C' in code:
            previous=records[i].decode('utf-8','strict');i+=1
        files.append(dict(path=path,code=code,previous=previous))
    branch=run(root,['symbolic-ref','--quiet','--short','HEAD'],ok=(0,1))[0].decode('utf-8','replace').strip() or '分离 HEAD'
    return dict(repository=True,branch=branch,files=files,token=token(root))

def execute(workspace, request):
    workspace=pathlib.Path(workspace).resolve()
    folder=request.get('folder','')
    if not isinstance(folder,str) or pathlib.PurePosixPath(folder).is_absolute() or '..' in pathlib.PurePosixPath(folder).parts:raise GitError('工作区路径无效')
    root=(workspace/folder).resolve()
    if root==workspace or not root.is_relative_to(workspace) or not root.is_dir():raise GitError('请打开工作区中的项目目录')
    action=request.get('action','status')
    gitdir=root/'.git'
    if gitdir.is_symlink() or (gitdir.exists() and not gitdir.is_dir()):raise GitError('此入口暂不支持链接仓库或外部工作树')
    for parent in root.parents:
        # The runtime may initialize its umbrella workspace as a repository.
        # Independent projects are still allowed below that managed boundary.
        if parent==workspace:break
        if (parent/'.git').exists():raise GitError('请在所属 Git 仓库根目录打开版本管理')
    if not gitdir.exists():
        if action=='status':return dict(repository=False,files=[])
        if action!='init':raise GitError('当前目录尚未初始化 Git')
        run(root,['init','--template=','--initial-branch=main'])
        return status(root)
    # Reject redirected metadata, shared object stores, and symlinked internals.
    if (gitdir/'commondir').exists() or (gitdir/'objects/info/alternates').exists():raise GitError('暂不支持共享或外部 Git 元数据')
    for number,entry in enumerate(gitdir.rglob('*')):
        if number>100000:raise GitError('Git 元数据过多，请使用终端处理此仓库')
        if entry.is_symlink():raise GitError('Git 元数据包含链接，请使用终端检查')
    # Even status can run a clean/process filter when refreshing index information.
    if run(root,['config','--get-regexp',r'^filter\..*\.(clean|process|required)$'],ok=(0,1))[0]:
        raise GitError('仓库配置了内容过滤器；请使用终端检查此仓库（包括 Git LFS）')
    if text(root,['rev-parse','--show-toplevel']) != str(root):raise GitError('Git 仓库根目录不匹配')
    if action=='status':return status(root)
    if action=='diff':
        path=selected(root,request.get('path'))
        state=status(root); item=next((f for f in state['files'] if f['path']==path),None)
        if item and item['code']=='??':
            file=root/path
            with file.open('rb') as stream:data=stream.read(LIMIT+1)
            content='二进制文件，无法显示文本差异' if b'\0' in data else data[:LIMIT].decode('utf-8','replace')
            return dict(text=content,truncated=len(data)>LIMIT,untracked=True)
        args=['diff','--no-ext-diff','--no-textconv','--no-color']
        if request.get('staged'):args+=['--cached']
        data,cut,_=run(root,args+['--',path])
        return dict(text=data.decode('utf-8','replace'),truncated=cut)
    if action in ('stage','unstage','commit'):
        if request.get('token')!=token(root):raise GitError('仓库索引已变化，请刷新后重新操作')
        if any((gitdir/name).exists() for name in ['MERGE_HEAD','CHERRY_PICK_HEAD','REVERT_HEAD','rebase-merge','rebase-apply']):raise GitError('仓库正在合并或变基，请先在终端完成或处理冲突')
        if action=='commit':
            message=request.get('message','').strip();name=request.get('name','').strip();email=request.get('email','').strip()
            if not message or len(message)>4096 or '\0' in message:raise GitError('请填写 1–4096 字符的提交说明')
            if not name or len(name)>128 or any(c in name for c in '\r\n<>\0') or not re.fullmatch(r'[^\s<>\x00]{1,128}@[^\s<>\x00]{1,128}',email):raise GitError('请填写有效的作者名称和邮箱')
            run(root,['commit','--no-verify','--no-gpg-sign','-m',message],identity=(name,email))
        else:
            path=selected(root,request.get('path'))
            item=next((f for f in status(root)['files'] if f['path']==path),None)
            if not item:raise GitError('文件状态已变化，请刷新')
            paths=[path]
            if item['previous']:paths.append(selected(root,item['previous']))
            if action=='stage':run(root,['add','--',*paths])
            elif run(root,['rev-parse','--verify','HEAD'],ok=(0,128))[2]==0:run(root,['reset','-q','HEAD','--',*paths])
            else:run(root,['rm','--cached','--',path])
        return status(root)
    raise GitError('不支持的 Git 操作')

if __name__=='__main__':
    try:
        request=json.loads(base64.b64decode(sys.argv[1],validate=True))
        result=execute('/root/eva-workspace',request)
        print(json.dumps(dict(ok=True,result=result),ensure_ascii=False))
    except Exception as error:
        message=str(error) if isinstance(error,GitError) else 'Git 请求无法完成；请检查运行环境及文件编码'
        print(json.dumps(dict(ok=False,error=message),ensure_ascii=False))
