#!/usr/bin/env python3
"""Bounded local Git operations for Eva Android. No shell or remote commands."""
import base64, hashlib, json, os, pathlib, re, subprocess, sys, tempfile, urllib.parse

LIMIT = 262144

class GitError(Exception):
    pass

def run(root, args, limit=LIMIT, ok=(0,), identity=None, network_error=False):
    env = {k:v for k,v in os.environ.items() if not k.startswith('GIT_')}
    env.update(PATH='/usr/bin:/bin', HOME='/root', GIT_CONFIG_NOSYSTEM='1', GIT_CONFIG_GLOBAL='/dev/null',
               GIT_TERMINAL_PROMPT='0', GIT_OPTIONAL_LOCKS='0', GIT_LITERAL_PATHSPECS='1',
               GIT_CEILING_DIRECTORIES=str(pathlib.Path(root).parent),LC_ALL='C')
    if os.environ.get('EVA_GIT_ASKPASS'):env['GIT_ASKPASS']=os.environ['EVA_GIT_ASKPASS']
    if identity:
        env.update(GIT_AUTHOR_NAME=identity[0],GIT_AUTHOR_EMAIL=identity[1],GIT_COMMITTER_NAME=identity[0],GIT_COMMITTER_EMAIL=identity[1])
    cmd=['git','-c','core.createObject=rename','-c','core.hooksPath=/dev/null','-c','core.fsmonitor=false','-c','commit.gpgsign=false',
         '-c','core.pager=cat','-c','maintenance.auto=false','-c','gc.auto=0','-c','submodule.recurse=false',
         '-c','credential.helper=','-c','credential.useHttpPath=true','-c','protocol.allow=never','-c','protocol.https.allow=always','-c','protocol.ssh.allow=always','-c','core.sshCommand=ssh -oBatchMode=yes -oStrictHostKeyChecking=yes','-c','diff.external=','-c','core.quotePath=false',*args]
    with tempfile.TemporaryFile() as out, tempfile.TemporaryFile() as err:
        try:
            p=subprocess.run(cmd,cwd=root,env=env,stdout=out,stderr=err,timeout=120)
        except subprocess.TimeoutExpired:
            raise GitError('Git 操作超时，请刷新状态后检查结果，勿重复提交')
        out.seek(0); result=out.read(limit+1)
        if network_error and p.returncode:
            err.seek(0)
            detail=err.read(8192).decode('utf-8','replace').lower()
            if 'host key verification failed' in detail:raise GitError('SSH 主机密钥尚未确认，请先在终端核对服务器指纹')
            if any(value in detail for value in ['authentication failed','could not read username','401','403','permission denied (publickey']):raise GitError('远程认证失败，请检查账号、令牌权限或 SSH 密钥')
            if any(value in detail for value in ['non-fast-forward','fetch first','rejected']):raise GitError('远端分支已更新或拒绝推送，请获取并合并远端提交后重试')
            if any(value in detail for value in ['repository not found','does not appear to be a git repository','not found']):raise GitError('远程仓库不存在或当前账号无权访问，请核对仓库地址')
            if any(value in detail for value in ['certificate','ssl','tls']):raise GitError('远程 TLS 证书验证失败，请检查服务器证书与手机时间')
            if any(value in detail for value in ['resolve host','resolve hostname','connect','timed out','network is unreachable']):raise GitError('远程网络连接失败，请检查网络、主机地址和端口')
            raise GitError('远程 Git 请求失败，请核对地址、分支与服务器权限')
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
    for name in ['HEAD','config','packed-refs']:
        metadata=root/'.git'/name
        if metadata.is_file():digest.update(metadata.read_bytes())
    digest.update(run(root,['for-each-ref','--format=%(refname) %(objectname)'])[0])
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
    branches=text(root,['for-each-ref','--format=%(refname:short)','refs/heads']).splitlines()
    remotes=text(root,['remote']).splitlines()
    merging=(root/'.git/MERGE_HEAD').exists()
    upstream=run(root,['rev-parse','--abbrev-ref','@{upstream}'],ok=(0,128))[0].decode('utf-8','replace').strip()
    return dict(repository=True,branch=branch,files=files,token=token(root),branches=branches,remotes=remotes,merging=merging,upstream=upstream,conflicts=[f['path'] for f in files if f['code'] in ['UU','AA','DD','AU','UA','DU','UD']])

def reference(root, value):
    if not isinstance(value,str) or not value or value.startswith('-') or '\x00' in value:
        raise GitError('Git 分支或引用无效')
    if run(root,['check-ref-format','--branch',value],ok=(0,128))[2]:raise GitError('Git 分支名称无效')
    return value

def remote_url(workspace, value):
    if not isinstance(value,str) or not value or any(c in value for c in '\r\n\x00'):raise GitError('远程地址无效')
    parsed=urllib.parse.urlsplit(value)
    if parsed.scheme in ['https','ssh'] and parsed.hostname and not parsed.password and (parsed.scheme=='ssh' or parsed.username is None) and not parsed.query and not parsed.fragment:
        return value
    local=pathlib.Path(value)
    if local.is_absolute() and local.resolve().is_relative_to(workspace):return str(local.resolve())
    raise GitError('请输入 HTTPS、ssh:// 地址或工作区内的本地远端路径，凭据请单独保存')

def remote_name(value):
    if not isinstance(value,str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,127}',value):raise GitError('远端名称无效')
    return value

def network(root,workspace,args,url):
    remote_url(workspace,url)
    if run(root,['config','--local','--get-regexp',r'^(url\..*\.(insteadof|pushinsteadof)|include.*|remote\..*\.(uploadpack|receivepack)|http\..*|credential\..*)$'],ok=(0,1,128))[0]:
        raise GitError('远程配置含重写、外部命令或额外认证头，请先在终端检查')
    # This program holds no credentials. The encrypted Android store supplies
    # environment values only for the selected HTTPS repository.
    script="""#!/usr/bin/python3
import os,sys,urllib.parse,re
match=re.search(r"'([^']+)'",sys.argv[1])
expected=urllib.parse.urlsplit(os.environ.get('EVA_GIT_AUTH_URL',''))
actual=urllib.parse.urlsplit(match.group(1)) if match else None
if actual and actual.scheme=='https' and (actual.hostname,actual.port,actual.path.rstrip('/'))==(expected.hostname,expected.port,expected.path.rstrip('/')):
 print(os.environ.get('EVA_GIT_USERNAME','') if sys.argv[1].startswith('Username') else os.environ.get('EVA_GIT_PASSWORD',''))
else:sys.exit(1)
"""
    with tempfile.NamedTemporaryFile(mode='w',prefix='eva-git-askpass-',delete=False) as handle:
        handle.write(script);helper=handle.name
    try:
        os.chmod(helper,0o700)
        # run() intentionally strips inherited Git controls, so use a dedicated value.
        os.environ['EVA_GIT_ASKPASS']=helper
        prefix=['-c','protocol.file.allow=always'] if pathlib.Path(url).is_absolute() else []
        return run(root,prefix+args,network_error=True)
    finally:
        os.environ.pop('EVA_GIT_ASKPASS',None);os.unlink(helper)

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
        if action=='clone':
            if any(root.iterdir()):raise GitError('克隆目标目录必须为空')
            url=remote_url(workspace,request.get('url'))
            if network(root,workspace,['clone','--no-hardlinks','--no-recurse-submodules','--',url,'.'],url)[2]:raise GitError('克隆失败，请检查地址、认证与网络；目录内容请刷新核对')
            return status(root)
        if action!='init':raise GitError('当前目录尚未初始化 Git')
        run(root,['init','--template=','--initial-branch=main'])
        return status(root)
    # Reject redirected metadata, shared object stores, and symlinked internals.
    if (gitdir/'commondir').exists() or (gitdir/'objects/info/alternates').exists():raise GitError('暂不支持共享或外部 Git 元数据')
    for number,entry in enumerate(gitdir.rglob('*')):
        if number>100000:raise GitError('Git 元数据过多，请使用终端处理此仓库')
        if entry.is_symlink():raise GitError('Git 元数据包含链接，请使用终端检查')
    # Even status can run a clean/process filter when refreshing index information.
    if run(root,['config','--get-regexp',r'^filter\..*\.(clean|smudge|process|required)$'],ok=(0,1))[0]:
        raise GitError('仓库配置了内容过滤器；请使用终端检查此仓库（包括 Git LFS）')
    if text(root,['rev-parse','--show-toplevel']) != str(root):raise GitError('Git 仓库根目录不匹配')
    if action=='status':return status(root)
    if run(root,['config','--get-regexp',r'^merge\..*\.driver$'],ok=(0,1))[0]:raise GitError('仓库配置了外部合并程序，请先在终端检查')
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
    if action=='history':
        offset=request.get('offset',0)
        if not isinstance(offset,int) or offset<0:raise GitError('提交历史位置无效')
        if run(root,['rev-parse','--verify','HEAD'],ok=(0,128))[2]:return dict(text='',hasMore=False)
        value=text(root,['log','-40','--skip='+str(offset),'--date=short','--format=%h %ad %an %s'])
        return dict(text=value,hasMore=len(value.splitlines())==40)
    if action=='remote-info':
        name=remote_name(request.get('remote','origin'))
        urls=text(root,['remote','get-url','--all',name]).splitlines()
        for url in urls:remote_url(workspace,url)
        return dict(url=urls[0],remote=name)
    if action in ['remote-set','fetch','pull','push','branch-create','branch-switch','merge','merge-abort','resolve']:
        if request.get('token')!=token(root):raise GitError('仓库索引已变化，请刷新后重新操作')
        state=status(root)
        if action=='remote-set':
            name=remote_name(request.get('remote','origin'));url=remote_url(workspace,request.get('url'))
            run(root,['remote','set-url' if name in state['remotes'] else 'add',name,url])
        elif action in ['fetch','pull','push']:
            name=remote_name(request.get('remote','origin'))
            url=text(root,['remote','get-url',name])
            if action=='push':
                url=text(root,['remote','get-url','--push',name])
                branch=reference(root,request.get('branch') or state['branch'])
                args=['push',*(['--receive-pack=git -c core.createObject=rename receive-pack'] if pathlib.Path(url).is_absolute() else []),'--set-upstream',name,'HEAD:refs/heads/'+branch]
            else:args=['fetch','--no-tags',name]
            if network(root,workspace,args,url)[2]:raise GitError('远程操作失败，请检查认证、网络或远端分支是否已更新；未自动重试')
            if action=='pull':
                if state['files']:raise GitError('已获取远端，请先提交或保存本地变更后再拉取')
                branch=reference(root,request.get('branch') or state['branch'])
                if run(root,['merge','--ff-only',name+'/'+branch],ok=(0,1,128))[2]:raise GitError('已获取远端，分支存在分歧；请显式合并远端分支')
        elif action in ['branch-create','branch-switch']:
            if state['files'] or state['merging']:raise GitError('请先提交当前变更并完成合并')
            branch=reference(root,request.get('branch'))
            run(root,['switch',*(['-c'] if action=='branch-create' else []),branch])
        elif action=='merge':
            if state['files'] or state['merging']:raise GitError('请先提交当前变更并完成合并')
            ref=reference(root,request.get('branch'))
            run(root,['merge','--no-commit','--no-ff',ref],ok=(0,1),identity=('Eva Pending Merge','eva-merge@localhost'))
        elif action=='merge-abort':
            if not state['merging']:raise GitError('当前没有合并任务')
            run(root,['merge','--abort'])
        elif action=='resolve':
            path=selected(root,request.get('path'));side=request.get('side')
            if path not in state['conflicts'] or side not in ['ours','theirs']:raise GitError('冲突状态或选择无效')
            run(root,['checkout','--'+side,'--',path]);run(root,['add','--',path])
        return status(root)
    if action in ('stage','unstage','commit'):
        if request.get('token')!=token(root):raise GitError('仓库索引已变化，请刷新后重新操作')
        if any((gitdir/name).exists() for name in ['CHERRY_PICK_HEAD','REVERT_HEAD','rebase-merge','rebase-apply']):raise GitError('仓库正在合并或变基，请先在终端完成或处理冲突')
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
