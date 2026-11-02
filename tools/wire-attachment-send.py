from pathlib import Path
p=Path('probe/assets/models.js');s=p.read_text(encoding='utf-8');s=s.replace("const prompt=$('#prompt')?.value.trim();if(!prompt)return;","const prompt=$('#prompt')?.value.trim()||'',attachments=[...(active()?.attachments||[])];if(!prompt&&!attachments.length)return;")
s=s.replace("title:prompt.slice(0,24),messages:[]","title:prompt.slice(0,24)||attachments[0]?.name||'新对话',projectId:data.projectId||'',messages:[]")
s=s.replace("saveKernel();render();if(!c.kernelThread)","if(c.title==='新对话')c.title=prompt.slice(0,24)||attachments[0]?.name||'新对话';saveKernel();render();if(!c.kernelThread)")
s=s.replace("model:c.model,modelProvider:c.providerId}","model:c.model,modelProvider:c.providerId,androidProject:c.projectId||''}")
s=s.replace("c.pending=prompt;c.running", "c.pending=prompt||attachments.map(a=>a.name).join('、');c.running")
s=s.replace("input:[{type:'text',text:prompt,text_elements:[]}]","input:[{type:'text',text:prompt+(attachments.length?'\\n\\n附件（已复制到本机工作区）：\\n'+attachments.map(a=>JSON.stringify({name:a.name,path:a.path})).join('\\n'):''),text_elements:[]},...attachments.filter(a=>/^image\\/(png|jpeg|webp|gif)$/.test(a.mime||'')).map(a=>({type:'localImage',path:a.path}))]")
s=s.replace("if(r.turn)mergeKernelTurn(c,r.turn);kernelNotice", "if(r.turn)mergeKernelTurn(c,r.turn);c.attachments=(c.attachments||[]).filter(a=>!attachments.some(sent=>sent.id===a.id));kernelNotice")
p.write_text(s,encoding='utf-8')
