"""Eva Android office runtime. Self-authored adapter; cloud models execute locally.
All outputs are new workspace files. No desktop process or credentials are used.
"""
import argparse, fcntl, hashlib, importlib, importlib.metadata, json, os, pathlib, shutil, subprocess, sys, tempfile, time, urllib.request, zipfile
BASE = pathlib.Path('/root/.eva-office')
LIB = BASE / 'lib'
WORKSPACE = pathlib.Path('/root/eva-workspace')
sys.path.insert(0, str(LIB))
PACKAGES = ['py3-lxml','py3-pillow','py3-typing-extensions','py3-xlsxwriter','py3-openpyxl','py3-reportlab','py3-pypdf','font-wqy-zenhei']
WHEELS = [
 ('python_docx-1.2.0-py3-none-any.whl','https://files.pythonhosted.org/packages/d0/00/1e03a4989fa5795da308cd774f05b704ace555a70f9bf9d3be057b680bcf/python_docx-1.2.0-py3-none-any.whl','3fd478f3250fbbbfd3b94fe1e985955737c145627498896a8a6bf81f4baf66c7'),
 ('python_pptx-1.0.2-py3-none-any.whl','https://files.pythonhosted.org/packages/d9/4f/00be2196329ebbff56ce564aa94efb0fbc828d00de250b1980de1a34ab49/python_pptx-1.0.2-py3-none-any.whl','160838e0b8565a8b1f67947675886e9fea18aa5e795db7ae531606d68e785cba')]
FONT = pathlib.Path('/usr/share/fonts/wqy-zenhei/wqy-zenhei.ttc')
CANCEL = BASE / 'cancel'

def emit(value): print(json.dumps(value, ensure_ascii=False, default=str), flush=True)
def progress(message): emit({'progress':message})
def check_cancel():
 if CANCEL.exists(): raise RuntimeError('已取消；已安装依赖保留，可再次检查或安装')
def status():
 result={}
 for mod,dist in [('docx','python-docx'),('pptx','python-pptx'),('openpyxl','openpyxl'),('reportlab','reportlab'),('pypdf','pypdf'),('PIL','Pillow'),('lxml','lxml')]:
  try:
   m=importlib.import_module(mod)
   try: version=importlib.metadata.version(dist)
   except importlib.metadata.PackageNotFoundError: version=getattr(m,'__version__','installed')
   result[mod]={'ready':True,'version':version}
  except Exception as e: result[mod]={'ready':False,'error':str(e)}
 return {'ready':all(v['ready'] for v in result.values()) and FONT.is_file(),'modules':result,'chineseFont':FONT.is_file(),'entry':'python3 /root/eva-office.py','limitations':['不包含 Office 排版渲染引擎','Excel 公式保留但不会自动重算','不执行宏']}

def install():
 BASE.mkdir(parents=True,exist_ok=True)
 with open(BASE/'install.lock','w') as lock:
  try: fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  except BlockingIOError: raise RuntimeError('另一办公环境安装正在进行')
  CANCEL.unlink(missing_ok=True)
  if not pathlib.Path('/etc/alpine-release').read_text().strip().startswith('3.22.'):
   raise RuntimeError('此依赖清单仅验证 Alpine 3.22；请先适配当前运行环境')
  progress('正在安装 Alpine 签名仓库依赖；此步骤取消将在包事务结束后生效')
  repos=BASE/'repositories'
  repos.write_text('https://mirrors.tuna.tsinghua.edu.cn/alpine/v3.22/main\nhttps://mirrors.tuna.tsinghua.edu.cn/alpine/v3.22/community\n',encoding='utf-8')
  p=subprocess.run(['apk','--repositories-file',str(repos),'add','--no-cache','--no-progress',*PACKAGES],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=480)
  if p.returncode: raise RuntimeError('系统依赖安装失败：'+p.stdout[-6000:])
  check_cancel()
  stage=pathlib.Path(tempfile.mkdtemp(prefix='office-install-',dir=BASE))
  try:
   for name,url,sha in WHEELS:
    progress('下载并校验 '+name); dest=stage/name
    last=None
    for attempt in range(3):
     try:
      download_url=url if attempt==0 else url.replace('https://files.pythonhosted.org/','https://pypi.tuna.tsinghua.edu.cn/')
      with urllib.request.urlopen(download_url,timeout=30) as response,open(dest,'wb') as out:
       if not response.url.startswith(('https://files.pythonhosted.org/','https://pypi.tuna.tsinghua.edu.cn/')): raise ValueError('不允许的下载重定向')
       size=0
       while True:
        check_cancel();chunk=response.read(65536)
        if not chunk: break
        size+=len(chunk)
        if size>4*1024*1024: raise ValueError('依赖包超过大小限制')
        out.write(chunk)
      if hashlib.sha256(dest.read_bytes()).hexdigest()!=sha: raise ValueError('SHA256 校验失败')
      last=None;break
     except Exception as e:
      last=e;check_cancel()
    if last: raise RuntimeError('依赖下载失败，可重试：'+str(last))
   extracted=stage/'lib';extracted.mkdir()
   for name,_,_ in WHEELS:
    with zipfile.ZipFile(stage/name) as z:
     total=0
     for info in z.infolist():
      target=(extracted/info.filename).resolve();total+=info.file_size
      if not target.is_relative_to(extracted.resolve()) or (info.external_attr>>16)&0o170000==0o120000 or total>20*1024*1024: raise ValueError('非法 wheel 内容')
     z.extractall(extracted)
   check_cancel()
   old=BASE/'lib.previous'
   if old.exists(): shutil.rmtree(old)
   if LIB.exists(): LIB.rename(old)
   try: extracted.rename(LIB)
   except BaseException:
    if old.exists(): old.rename(LIB)
    raise
   importlib.invalidate_caches()
   result=status()
   if not result['ready']:
    shutil.rmtree(LIB)
    if old.exists():old.rename(LIB)
    raise RuntimeError('安装后检查失败，已恢复此前的私有库：'+json.dumps(result,ensure_ascii=False))
   inventory=subprocess.run(['apk','info','-v'],capture_output=True,text=True,timeout=30).stdout
   (BASE/'installed.json').write_text(json.dumps({'timestamp':time.time(),'wheels':WHEELS,'apkInventory':inventory,'status':result},ensure_ascii=False,indent=2),encoding='utf-8')
   return result
  finally: shutil.rmtree(stage,ignore_errors=True)

def workspace_path(value, existing=False):
 p=pathlib.Path(value).expanduser()
 if not p.is_absolute(): p=WORKSPACE/p
 p=p.resolve()
 if not p.is_relative_to(WORKSPACE.resolve()): raise ValueError('文件必须位于手机工作区')
 if existing:
  if not p.is_file(): raise ValueError('文件不存在')
  if p.stat().st_size>32*1024*1024: raise ValueError('文件超过 32 MiB 读取限制')
 return p

def checked_zip(p):
 with zipfile.ZipFile(p) as z:
  if len(z.infolist())>10000 or sum(i.file_size for i in z.infolist())>128*1024*1024: raise ValueError('文档解压大小超过限制')

def create(kind,data,output):
 out=workspace_path(output)
 if out.exists(): raise ValueError('输出已存在，请使用新文件名以保留原稿')
 out.parent.mkdir(parents=True,exist_ok=True)
 tmp=out.parent/('.eva-office-'+os.urandom(8).hex()+out.suffix)
 try:
  if kind=='word':
   from docx import Document
   d=Document()
   if data.get('title'): d.add_heading(str(data['title']),0)
   for item in data.get('paragraphs',[]):
    item={'text':item} if isinstance(item,str) else item
    if item.get('heading'):d.add_heading(str(item.get('text','')),max(1,min(6,int(item['heading']))))
    else: d.add_paragraph().add_run(str(item.get('text',''))).bold=bool(item.get('bold'))
   for table in data.get('tables',[]):
    rows=table.get('rows',[])
    if rows:
     t=d.add_table(rows=0,cols=max(len(r) for r in rows));t.style='Table Grid'
     for row in rows:
      cells=t.add_row().cells
      for i,value in enumerate(row): cells[i].text=str(value if value is not None else '')
   d.save(tmp)
  elif kind=='excel':
   from openpyxl import Workbook
   from openpyxl.styles import Font
   d=Workbook();d.remove(d.active)
   for sheet in data.get('sheets') or [{'name':'Sheet1','rows':data.get('rows',[])}]:
    s=d.create_sheet(sheet.get('name') or 'Sheet1')
    for row in sheet.get('rows',[]):s.append(row)
    for cell,value in sheet.get('cells',{}).items():
     s[cell]=('='+value['formula'].lstrip('=')) if isinstance(value,dict) and 'formula' in value else value
    if sheet.get('header',True):
     for cell in s[1]:cell.font=Font(bold=True)
    s.freeze_panes='A2'
   d.save(tmp)
  elif kind=='ppt':
   from pptx import Presentation
   from pptx.util import Inches,Pt
   d=Presentation();d.slide_width=Inches(13.333);d.slide_height=Inches(7.5)
   for item in data.get('slides',[]):
    slide=d.slides.add_slide(d.slide_layouts[6])
    title=slide.shapes.add_textbox(Inches(.6),Inches(.4),Inches(12.1),Inches(.8)).text_frame
    title.text=str(item.get('title',''));title.paragraphs[0].font.size=Pt(28)
    body=slide.shapes.add_textbox(Inches(.7),Inches(1.5),Inches(11.9),Inches(5.3)).text_frame
    body.text='\n'.join(str(x) for x in item.get('body',item.get('paragraphs',[])))
    for p in body.paragraphs:p.font.size=Pt(20)
    for img in item.get('images',[]):slide.shapes.add_picture(str(workspace_path(img['path'],True)),Inches(img.get('x',1)),Inches(img.get('y',2)),Inches(img.get('w',5)),Inches(img.get('h',3)))
   d.save(tmp)
  elif kind=='pdf':
   from reportlab.pdfbase import pdfmetrics
   from reportlab.pdfbase.ttfonts import TTFont
   from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer
   from reportlab.lib.styles import ParagraphStyle
   from xml.sax.saxutils import escape
   pdfmetrics.registerFont(TTFont('EvaChinese',str(FONT),subfontIndex=0))
   style=ParagraphStyle('body',fontName='EvaChinese',fontSize=12,leading=20,wordWrap='CJK')
   text=[data.get('title',''),*data.get('paragraphs',[])]
   flow=[]
   for value in text:
    if isinstance(value,dict):value=value.get('text','')
    flow.extend([Paragraph(escape(str(value)).replace('\n','<br/>'),style),Spacer(1,8)])
   SimpleDocTemplate(str(tmp)).build(flow)
  else:raise ValueError('支持 word、excel、ppt、pdf')
  # Android SELinux blocks link(2) under this PRoot. Exclusive creation never replaces a competing user file.
  with open(out,'xb') as target:
   try:
    with open(tmp,'rb') as source:shutil.copyfileobj(source,target)
    target.flush();os.fsync(target.fileno())
   except BaseException:
    out.unlink(missing_ok=True);raise
  return {'path':str(out),'bytes':out.stat().st_size}
 finally:tmp.unlink(missing_ok=True)

def inspect_file(value):
 p=workspace_path(value,True);ext=p.suffix.lower()
 if ext in ('.docx','.xlsx','.pptx'):checked_zip(p)
 if ext=='.docx':
  from docx import Document
  d=Document(p);return {'paragraphs':[x.text for x in d.paragraphs][:2000],'tables':[[[c.text for c in r.cells] for r in t.rows][:200] for t in d.tables][:50]}
 if ext=='.xlsx':
  from openpyxl import load_workbook
  import itertools
  d=load_workbook(p,read_only=True,data_only=False,keep_links=False)
  try:return {'sheets':[{'name':s.title,'rows':list(itertools.islice(s.iter_rows(max_col=min(s.max_column or 0,100),values_only=True),200))} for s in d.worksheets[:30]],'note':'公式未计算；最多 30 工作表 × 200 行 × 100 列'}
  finally:d.close()
 if ext=='.pptx':
  from pptx import Presentation
  d=Presentation(p);return {'slides':[[s.text for s in slide.shapes if s.has_text_frame] for slide in list(d.slides)[:200]]}
 if ext=='.pdf':
  from pypdf import PdfReader
  d=PdfReader(p)
  if d.is_encrypted:raise ValueError('加密 PDF 需要先解密')
  return {'pages':len(d.pages),'text':'\n'.join(x.extract_text()[:50000] for x in list(d.pages)[:100])[:200000]}
 raise ValueError('支持 DOCX、XLSX、PPTX、PDF')

def selftest():
 if not status()['ready']:raise RuntimeError('请先安装办公依赖')
 folder=WORKSPACE/'office-checks'/time.strftime('%Y%m%d-%H%M%S')
 folder.mkdir(parents=True,exist_ok=False);marker='Eva 手机办公验收 7391'
 cases=[('word','docx',{'title':marker,'paragraphs':['中文段落与 English'],'tables':[{'rows':[['项目','数量'],['测试',2]]}]}),('excel','xlsx',{'sheets':[{'name':'验收','rows':[['项目','数量'],[marker,2]],'cells':{'B3':{'formula':'SUM(B2:B2)'}}}]}),('ppt','pptx',{'slides':[{'title':marker,'body':['中文内容','第二行']}]}),('pdf','pdf',{'title':marker,'paragraphs':['中文字体嵌入验收','本文件在安卓手机本地生成。']})]
 results=[]
 for kind,ext,data in cases:
  check_cancel();progress('生成并回读 '+ext.upper())
  output=folder/('验收样例.'+ext);result=create(kind,data,str(output));read=inspect_file(str(output))
  if marker not in json.dumps(read,ensure_ascii=False):raise ValueError(ext+' 回读内容不匹配')
  result.update({'format':ext,'readback':True,'sha256':hashlib.sha256(output.read_bytes()).hexdigest()});results.append(result)
 result={'passed':True,'directory':str(folder),'files':results,'scope':'生成与文本/表格回读；未验证 Office 排版渲染、公式重算'}
 (folder/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8');return result

def schema():
 return {'create':{'word':{'title':'Document title','paragraphs':['Plain text',{'text':'Heading','heading':1},{'text':'Bold text','bold':True}],'tables':[{'rows':[['Name','Count'],['Example',2]]}]},'excel':{'sheets':[{'name':'Sheet1','rows':[['Name','Count'],['Example',2]],'cells':{'B3':{'formula':'SUM(B2:B2)'}},'header':True}]},'ppt':{'slides':[{'title':'Slide title','body':['First point','Second point'],'images':[]}]},'pdf':{'title':'Document title','paragraphs':['Text with Chinese supported.']}},'usage':'python3 /root/eva-office.py create word|excel|ppt|pdf --input /root/eva-workspace/content.json --output /root/eva-workspace/new-file.ext','read':'python3 /root/eva-office.py inspect --input /root/eva-workspace/file.ext','scope':['New outputs only; existing files are never overwritten','DOCX/PPTX/XLSX structure and content, not pixel-identical Office rendering','XLSX formula strings retained, not recalculated','No macros or embedded scripts executed','PPT images require workspace path and optional x/y/w/h in inches']}

def main():
 parser=argparse.ArgumentParser(description='Eva 手机办公文档工具')
 parser.add_argument('action',choices=['status','install','selftest','create','inspect','schema']);parser.add_argument('kind',nargs='?');parser.add_argument('--input');parser.add_argument('--output')
 a=parser.parse_args()
 if a.action=='schema':result=schema()
 elif a.action=='status':result=status()
 elif a.action=='install':result=install()
 elif a.action=='selftest':CANCEL.unlink(missing_ok=True);result=selftest()
 elif a.action=='inspect':result=inspect_file(a.input)
 else:
  source=workspace_path(a.input,True)
  if source.stat().st_size>2*1024*1024:raise ValueError('内容 JSON 超过 2 MiB')
  result=create(a.kind,json.loads(source.read_text(encoding='utf-8')),a.output)
 emit(result)
if __name__=='__main__':
 try:main()
 except Exception as e:emit({'error':str(e)});sys.exit(1)
