import pathlib,runpy,json
m=runpy.run_path('/root/eva-office.py')
root=pathlib.Path('/root/eva-workspace/') / 'office-model-1793664724571'
files=list(root.glob('*.pdf'))+list(root.glob('*.xlsx'))
assert len(files)==2
results=[]
for p in files:
 value=m['inspect_file'](str(p))
 assert 'EVA_OFFICE_MODEL_6193' in json.dumps(value)
 if p.suffix=='.xlsx':assert '=SUM(1,2)' in json.dumps(value)
 results.append({'path':str(p),'bytes':p.stat().st_size,'marker':True,'formula':p.suffix=='.xlsx'})
print(json.dumps({'result':'PASS','files':results},ensure_ascii=True))
