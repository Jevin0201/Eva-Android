from pathlib import Path
root = Path('/root/eva-workspace/projects/extension-acceptance')
root.mkdir(parents=True, exist_ok=True)
(root/'mcp_fixture.py').write_text('''import sys,json
from pathlib import Path
for line in sys.stdin:
 try:
  q=json.loads(line); method=q.get('method'); result={}
  if 'id' not in q: continue
  if method=='initialize': result={'protocolVersion':'2024-11-05','capabilities':{'tools':{},'resources':{}},'serverInfo':{'name':'eva-acceptance','version':'1.0'}}
  elif method=='tools/list': result={'tools':[{'name':'echo_acceptance','description':'Return the EVA MCP acceptance marker with the provided text.','inputSchema':{'type':'object','properties':{'text':{'type':'string'}},'required':['text']}}]}
  elif method=='tools/call':
   text=q.get('params',{}).get('arguments',{}).get('text',''); result={'content':[{'type':'text','text':'EVA_MCP_OK_8427 '+text}]}
   with open('/root/eva-workspace/projects/extension-acceptance/mcp-calls.jsonl','a') as f:f.write(json.dumps({'tool':q['params']['name'],'text':text})+'\\n')
  elif method=='resources/list': result={'resources':[{'uri':'eva-test://guide','name':'验收资料','mimeType':'text/plain'}]}
  elif method=='resources/templates/list': result={'resourceTemplates':[]}
  elif method=='resources/read': result={'contents':[{'uri':'eva-test://guide','mimeType':'text/plain','text':'EVA_RESOURCE_OK_8427'}]}
  print(json.dumps({'jsonrpc':'2.0','id':q['id'],'result':result}),flush=True)
 except Exception as e: print(str(e),file=sys.stderr,flush=True)
''',encoding='utf-8')
print('Created own stdio MCP fixture')
