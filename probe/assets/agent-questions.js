'use strict';
// Desktop ui.js buildQuestion protocol, adapted to the Android conversation flow.
// Pending JSON-RPC IDs are NEVER persisted. Only a replay from the live native
// connection may restore a request after a WebView reload.
(()=>{
 const pending=new Map(),settled=new Set();
 const requestKey=id=>JSON.stringify(id);
 const draftKey=p=>JSON.stringify([p.threadId,p.turnId,p.itemId]);
 const drafts=()=>data.agentQuestionDrafts||(data.agentQuestionDrafts={});
 function forget(record){if(record.mount)window.EvaNativeUserInput?.unmount(record.mount);record.section?.remove();pending.delete(requestKey(record.id));settled.add(requestKey(record.id));delete drafts()[draftKey(record.params)];scheduleKernelSave();}
 function persist(record){const safe=Object.create(null);for(const q of record.params.questions)if(!q.isSecret&&record.answers[q.id])safe[q.id]=record.answers[q.id];drafts()[draftKey(record.params)]=safe;scheduleKernelSave();}
 function receive(e){
  const key=requestKey(e.id);if(pending.has(key)||settled.has(key))return true;
  const p=e.params||{};if(!p.threadId||!p.turnId||!Array.isArray(p.questions)||!p.questions.length||p.questions.length>32)return false;
  const ids=p.questions.map(q=>q.id);if(ids.some(id=>typeof id!=='string'||!id)||new Set(ids).size!==ids.length)return false;
  const saved=drafts()[draftKey(p)]||{},answers=Object.create(null);for(const q of p.questions)if(!q.isSecret&&Object.hasOwn(saved,q.id))answers[q.id]=saved[q.id];
  pending.set(key,{id:e.id,params:p,answers,state:'pending',error:''});paint();return true;
 }
 function element(tag,text,cls){const node=document.createElement(tag);if(text!=null)node.textContent=String(text);if(cls)node.className=cls;return node;}
 function card(record){
  if(!record.section){
   record.section=element('section',null,'agent-question-card');
   record.section.dataset.questionRequest=requestKey(record.id);
   record.mount=element('div');record.mount.dataset.nativeQuestion='';
   record.errorNode=element('p',null,'agent-question-error');record.errorNode.setAttribute('role','alert');
   record.section.append(record.mount,record.errorNode);
  }
  if(record.state==='submitted'){window.EvaNativeUserInput?.unmount(record.mount);record.mount.textContent='回答已提交，等待处理';record.errorNode.textContent='';return record.section;}
  const native=window.EvaNativeUserInput;
  if(!native)throw Error('电脑端问题组件未加载');
  const model=()=>({key:requestKey(record.id),questions:record.params.questions,draft:record.nativeDraft||{
   questionIndex:0,answers:record.params.questions.map(q=>{
    const value=record.answers[q.id];return {selectedOptionId:value?.kind==='option'?q.options?.[value.index]?.label:q.options?.[0]?.label??null,freeformText:value?.kind==='text'?value.text:null};
   })},isSubmitting:record.state!=='pending'});
  const redraw=()=>{record.errorNode.textContent=record.error;native.render(record.mount,model(),bridge);};
  const bridge={
   draft(value){record.nativeDraft=value;const safe=Object.create(null);for(const [i,q] of record.params.questions.entries()){
    if(q.isSecret)continue;const answer=value.answers?.[i];
    if(answer?.freeformText)safe[q.id]={kind:'text',text:answer.freeformText};
    else if(answer?.selectedOptionId!=null){const index=(q.options||[]).findIndex(o=>o.label===answer.selectedOptionId);if(index>=0)safe[q.id]={kind:'option',index};}
   }record.answers=safe;persist(record);},
   async dismiss(){if(record.state!=='pending')return;record.state='stopping';record.error='';redraw();try{await kernelCall('turn/interrupt',{threadId:record.params.threadId,turnId:record.params.turnId});}catch(error){if(!pending.has(requestKey(record.id)))return;record.state='pending';record.error='停止失败：'+error.message;redraw();}},
   submit(result){if(record.state!=='pending'||!pending.has(requestKey(record.id)))return;
    record.state='submitted';record.error='';redraw();
    try{EvaHost.kernelRespond(JSON.stringify(record.id),JSON.stringify(result));delete drafts()[draftKey(record.params)];record.answers={};record.nativeDraft=undefined;native.unmount(record.mount);record.mount.textContent='回答已提交，等待处理';scheduleKernelSave();}
    catch(error){record.state='pending';record.error='提交失败：'+error.message;redraw();}
   }
  };
  redraw();return record.section;
 }
 function paint(force=false){
  const thread=active()?.kernelThread?.id,flow=document.querySelector('.flow');document.querySelectorAll('[data-agent-questions-banner]').forEach(n=>n.remove());if(!flow||settingPage||!['home','chat'].includes(route))return;
  let host=flow.querySelector('[data-agent-questions]');if(!host){host=element('div');host.dataset.agentQuestions='true';host.dataset.turn='agent-questions';flow.append(host);}
  const current=[...pending.values()].filter(r=>r.params.threadId===thread);const signature=current.map(r=>requestKey(r.id)+':'+r.state+':'+r.error).join('|');
  if(force||host.dataset.signature!==signature){host.replaceChildren(...current.map(card));host.dataset.signature=signature;}
  const elsewhere=[...pending.values()].filter(r=>r.params.threadId!==thread);if(elsewhere.length){const banner=element('button','其他对话有 '+elsewhere.length+' 项问题待回答');banner.dataset.agentQuestionsBanner='true';banner.type='button';banner.addEventListener('click',()=>{const c=[...data.chats,...data.drafts].find(c=>c.kernelThread?.id===elsewhere[0].params.threadId);if(c)navigate('chat:'+c.id);});document.querySelector('.app-head')?.after(banner);}
 }
 const style=element('style');style.textContent='.agent-question-card{margin:12px 0;min-width:0}.agent-question-error{color:#b43333;overflow-wrap:anywhere}[data-agent-questions-banner]{margin:8px 16px;padding:10px;border-radius:10px}';document.head.append(style);
 function syncTheme(){document.documentElement.dataset.theme=document.querySelector('#phone')?.classList.contains('dark')?'dark':'light';for(const record of pending.values())if(record.mount&&record.state==='pending')card(record);}
 const themeObserver=new MutationObserver(syncTheme);const phone=document.querySelector('#phone');if(phone)themeObserver.observe(phone,{attributes:true,attributeFilter:['class']});syncTheme();
 const previousEvent=kernelEvent;kernelEvent=function(e){if(e.method==='item/tool/requestUserInput'&&e.id!==undefined&&receive(e))return;const p=e.params||{};
  if(e.method==='serverRequest/resolved'){const record=pending.get(requestKey(p.requestId));if(record&&record.params.threadId===p.threadId)forget(record);}
  if(e.method==='turn/completed')for(const record of pending.values())if(record.params.threadId===p.threadId&&record.params.turnId===(p.turn?.id||p.turnId))forget(record);
  if(e.method==='android/kernelExited'){const ids=Array.isArray(p.threadIds)?new Set(p.threadIds):null;for(const record of pending.values())if(!ids||ids.has(record.params.threadId))forget(record);if(!ids)settled.clear();}
  previousEvent(e);paint();
 };
 const previousFlow=updateKernelFlow;updateKernelFlow=function(c){if(window.evaDesktopStream?.enabled){previousFlow(c);paint();return;}const host=document.querySelector('[data-agent-questions]');host?.remove();previousFlow(c);if(host)document.querySelector('.flow')?.append(host);paint();};
 const previousRender=render;render=function(){previousRender();paint();};
 window.agentQuestions={receive,refresh:paint,pendingCount:()=>pending.size,hasPending:threadId=>[...pending.values()].some(row=>row.params.threadId===threadId)};
 // This bridge returns ONLY requests still pending in the live kernel process.
 try{if(EvaHost.pendingQuestions)for(const e of JSON.parse(EvaHost.pendingQuestions()))receive(e);}catch{}
 paint();
})();
