'use strict';
(() => {
 const marker='\n\n<eva-document-selection-context>\n', end='\n</eva-document-selection-context>';
 function normalize(value) {
  if(!value||typeof value!=='object')throw Error('选区信息无效');
  const path=String(value.path||'');
  if(!path||path.length>2048||path.startsWith('/')||/[\\\x00-\x1f]/.test(path)||path.split('/').some(p=>!p||p==='.'||p==='..'))throw Error('文件路径无效');
  if(!/^[a-f0-9]{64}$/i.test(value.sourceSha256||''))throw Error('文件版本信息无效');
  const text=String(value.selectedText??'');const emptyCell=value.kind==='xlsx'&&typeof value.locator?.sheetName==='string'&&/^[A-Z]{1,3}[1-9][0-9]{0,6}$/.test(value.locator?.cellRange||'');if((!text.trim()&&!emptyCell)||text.length>16000)throw Error('请先选择需要修改的文字或单元格');
  const locator=value.locator;if(!locator||typeof locator!=='object'||Array.isArray(locator)||JSON.stringify(locator).length>8192)throw Error('选区位置无效');
  const id=String(value.id||'');if(!/^[a-z0-9-]{16,80}$/i.test(id))throw Error('选区标识无效');
  const instruction=String(value.instruction||'').trim();if(instruction.length>4000)throw Error('修改要求过长');
  return {id,path,name:path.split('/').pop(),sourceSha256:value.sourceSha256.toLowerCase(),kind:String(value.kind||'').slice(0,32),selectedText:text,locator,instruction};
 }
 function displayLocator(value){const l=value.locator||{};return l.sheetName?`${l.sheetName}${l.cellRange?' · '+l.cellRange:''}`:l.slide?'第 '+l.slide+' 张幻灯片':l.startLine?'第 '+l.startLine+(l.endLine&&l.endLine!==l.startLine?'–'+l.endLine:'')+' 行':l.page?'第 '+l.page+' 页':'所选文字';}
 function context(items){return marker+JSON.stringify(items.map(v=>({selectionId:v.id,path:'/root/eva-workspace/'+v.path,expectedSha256:v.sourceSha256,kind:v.kind==='markdown'?'md':v.kind,selectedText:v.selectedText,locator:v.locator})))+end;}
 function strip(text){const at=text.lastIndexOf(marker);if(at<0||!text.endsWith(end))return {text,items:[]};try{const items=JSON.parse(text.slice(at+marker.length,-end.length));if(!Array.isArray(items)||items.length>8)return {text,items:[]};return {text:text.slice(0,at),items:items.filter(v=>v&&typeof v.path==='string'&&v.path.startsWith('/root/eva-workspace/')&&typeof v.selectedText==='string')};}catch{return {text,items:[]};}}
 if(typeof module!=='undefined')module.exports={normalize,displayLocator,context,strip};
 if(typeof window==='undefined')return;
 function receive(raw){
  let value;try{value=normalize(typeof raw==='string'?JSON.parse(raw):raw);}catch(e){kernelNotice=e.message;refreshKernelControls();return false;}
  if((data.previewSelectionReceipts||[]).includes(value.id))return true;
  let c=active();if(c?.importedReadOnly)c=null;if((c?.previewSelections||[]).length>=8){kernelNotice='草稿已有 8 个选区，请先移除或发送';refreshKernelControls();return false;}const previousActive=data.active,previousProject=data.projectId,previousDraft=data.draft,created=!c,previousDraftIds=new Set(data.drafts.map(v=>v.id));
  if(!c){const projectId=data.projectId||'';c=data.drafts.findLast(v=>v.projectId===projectId&&!v.running&&!v.draft?.trim()&&!v.attachments?.length&&!v.references?.length&&!v.previewSelections?.length&&!v.kernelThread?.id);if(!c){c={id:crypto.randomUUID(),title:'新对话',projectId,messages:[],draft:'',attachments:[]};data.drafts.push(c);}data.active=c.id;data.projectId=projectId;}
  const oldDraft=c.draft,oldSelections=c.previewSelections,oldReceipts=data.previewSelectionReceipts;
  c.previewSelections=[...(c.previewSelections||[]),value].slice(-8);
  if(created)data.draft='';
  c.draft=[created?previousDraft:c.draft,value.instruction||'请修改所选内容：'].filter(Boolean).join('\n\n');
  data.previewSelectionReceipts=[...(oldReceipts||[]),value.id].slice(-100);
  try{saveKernel();}catch(e){c.draft=oldDraft;c.previewSelections=oldSelections;data.previewSelectionReceipts=oldReceipts;if(created){if(!previousDraftIds.has(c.id))data.drafts=data.drafts.filter(v=>v!==c);data.active=previousActive;data.projectId=previousProject;data.draft=previousDraft;}kernelNotice='选区保存失败，请重试';refreshKernelControls();return false;}
  route='chat';settingPage=null;document.querySelector('#phone')?.classList.remove('drawer-open');render();kernelNotice='选区已加入草稿，请确认修改要求后发送';refreshKernelControls();document.querySelector('#prompt')?.focus();return true;
 }
 function paint(){const host=document.querySelector('.composer');if(!host)return;host.querySelector('.preview-selection-chips')?.remove();const items=active()?.previewSelections||[];if(!items.length)return;const box=document.createElement('div');box.className='preview-selection-chips';box.style.cssText='display:flex;gap:6px;flex-wrap:wrap;padding:6px 8px';for(const v of items){const button=document.createElement('button');button.type='button';button.className='reference-chip';button.textContent=v.name+' · '+displayLocator(v)+' ×';button.title=v.selectedText;button.onclick=()=>{const c=active(),prior=c.previewSelections;c.previewSelections=(prior||[]).filter(x=>x.id!==v.id);try{saveKernel();render();}catch(error){c.previewSelections=prior;kernelNotice='选区移除未保存，请重试';refreshKernelControls();}};box.append(button);}host.prepend(box);}
 const priorRender=render;render=function(){priorRender();paint();};
 function consume(c,ids){c.previewSelections=(c.previewSelections||[]).filter(v=>!ids.includes(v.id));if(c.previewSelectionSend?.ids?.every(id=>ids.includes(id)))delete c.previewSelectionSend;scheduleKernelSave(c);paint();}
 function reconcile(c,turns){const pending=c?.previewSelectionSend;if(!pending)return;for(const turn of turns||[]){if((pending.baseTurnIds||[]).includes(turn.id))continue;const text=(turn.items||[]).filter(v=>v.type==='userMessage'||v.type==='steeringUserMessage').map(v=>JSON.stringify(v.content||v.input||[])).join('');if(pending.ids.every(id=>text.includes(id))){consume(c,pending.ids);return;}}}
 const priorCall=kernelCall;kernelCall=function(method,params={}){
  const c=[...data.chats,...data.drafts].find(v=>v.kernelThread?.id===params.threadId);reconcile(c,c?.kernelThread?.turns);
  const items=(method==='turn/start'||method==='turn/steer')?[...(c?.previewSelections||[])]:[];
  if(!items.length)return Promise.resolve(priorCall(method,params)).then(result=>{if(c&&result?.thread?.turns)reconcile(c,result.thread.turns);return result;});
  const input=[...(params.input||[])];input.push({type:'text',text:context(items),text_elements:[]});
  if(method==='turn/start'){c.previewSelectionSend={clientId:params.clientUserMessageId,ids:items.map(v=>v.id),baseTurnIds:(c.kernelThread?.turns||[]).map(v=>v.id)};try{saveKernel();}catch(error){delete c.previewSelectionSend;if(c.pendingSend)c.pendingSend.phase='preparing';throw error;}}
  return Promise.resolve(priorCall(method,{...params,input})).then(result=>{if(method==='turn/steer'||result?.turn)consume(c,items.map(v=>v.id));return result;});
 };
 if(typeof kernelEvent==='function'){const priorEvent=kernelEvent;kernelEvent=function(event){priorEvent(event);const c=[...data.chats,...data.drafts].find(v=>v.kernelThread?.id===event.params?.threadId),pending=c?.previewSelectionSend;if(!pending)return;const turn=event.params?.turn;if(event.method==='turn/started'&&turn&&!pending.baseTurnIds.includes(turn.id)&&c.lastSendTurnId===turn.id)consume(c,pending.ids);else reconcile(c,c.kernelThread?.turns);};}
 const oldHtml=window.evaUserAttachments?.html;
 if(oldHtml)window.evaUserAttachments.html=function(item,turn){const content=item.content||item.input||[],items=[];const clean=content.map(v=>{if(!['text','inputText'].includes(v.type))return v;const parsed=strip(v.text||'');items.push(...parsed.items);return {...v,text:parsed.text};});const copy={...item,...(item.content?{content:clean}:{input:clean})};let html=oldHtml(copy,turn);if(items.length){const box=document.createElement('div');box.className='user-file-attachments';for(const v of items){const link=document.createElement('a');link.className='user-file-attachment';link.href=v.path.split('/').map(encodeURIComponent).join('/');link.textContent=v.path.split('/').pop()+' · '+displayLocator(v);link.title=v.selectedText;box.append(link);}html=box.outerHTML+html;}return html;};
 window.evaPreviewSelection={receive,strip};paint();
})();
