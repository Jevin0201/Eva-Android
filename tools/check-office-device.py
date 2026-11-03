"""Phone-side office validation (pipe into tools/device-python.py)."""
import importlib.util,json,pathlib,hashlib,subprocess
spec=importlib.util.spec_from_file_location('eva_office','/root/eva-office.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
root=m.WORKSPACE/'office-checks'/'safety';root.mkdir(parents=True,exist_ok=True)
checks=[]
def reject(name,fn):
 try:fn()
 except (ValueError,FileExistsError):checks.append(name);return
 raise AssertionError(name+' should fail')
reject('outside workspace input',lambda:m.workspace_path('/etc/passwd',True))
reject('outside workspace output',lambda:m.create('word',{'title':'no'},'/root/outside.docx'))
existing=root/'keep.docx';existing.write_bytes(b'existing user content')
try:
 reject('overwrite rejected',lambda:m.create('word',{'title':'no'},str(existing)))
 assert existing.read_bytes()==b'existing user content';checks.append('existing bytes preserved')
 link=root/'escape'
 if not link.exists():link.symlink_to('/etc',target_is_directory=True)
 try:reject('symlink escape rejected',lambda:m.workspace_path(str(link/'passwd'),True))
 finally:link.unlink(missing_ok=True)
 d=m.status();assert d['ready'];checks.append('all modules and Chinese font available')
 from openpyxl import load_workbook
 latest=sorted(m.WORKSPACE.glob('office-checks/*/*.xlsx'))[-1]
 wb=load_workbook(latest);assert wb.active['B3'].value=='=SUM(B2:B2)';wb.close();checks.append('formula preserved without claiming calculation')
 result={'passed':True,'checks':checks,'status':d};print(json.dumps(result,ensure_ascii=False));(root/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
finally:existing.unlink(missing_ok=True)
