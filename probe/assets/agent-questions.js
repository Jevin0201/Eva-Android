'use strict';
// Desktop ui.js buildQuestion protocol, adapted to the Android conversation flow.
// Pending JSON-RPC IDs are NEVER persisted. Only a replay from the live native
// connection may restore a request after a WebView reload.
(()=>{
 const pending=new Map(),settled=new Set();
 const requestKey=id=>JSON.stringify(id);
 const draftKey=p=>JSON.stringify([p.threadId,p.turnId,p.itemId]);
 const drafts=()=>data.agentQuestionDrafts||(data.agentQuestionDrafts={});
 function forget(record){pending.delete(requestKey(record.id));settled.add(requestKey(record.id));delete drafts()[draftKey(record.params)];scheduleKernelSave();}
 function persist(record){const safe=Object.create(null);for(const q of record.params.questions)if(!q.isSecret&&record.answers[q.id])safe[q.id]=record.answers[q.id];drafts()[draftKey(record.params)]=safe;scheduleKernelSave();}
 function receive(e){
  const key=requestKey(e.id);if(pending.has(key)||settled.has(key))return true;
  const p=e.params||{};if(!p.threadId||!p.turnId||!Array.isArray(p.questions)||!p.questions.length||p.questions.length>32)return false;
  const ids=p.questions.map(q=>q.id);if(ids.some(id=>typeof id!=='string'||!id)||new Set(ids).size!==ids.length)return false;
  const saved=drafts()[draftKey(p)]||{},answers=Object.create(null);for(const q of p.questions)if(!q.isSecret&&Object.hasOwn(saved,q.id))answers[q.id]=saved[q.id];
  pending.set(key,{id:e.id,params:p,answers,state:'pending',error:''});paint();return true;
 }
 function element(tag,text,cls){const node=document.createElement(tag);if(text!=null)node.textContent=String(text);if(cls)node.className=cls;return node;}
 function answerValue(record,q){const value=record.answers[q.id];if(value?.kind==='option'){const option=(q.options||[])[value.index];return option?String(option.label):'';}return value?.kind==='text'?String(value.text||'').trim():'';}
 function card(record){
  const section=element('section',null,'agent-question-card');section.dataset.questionRequest=requestKey(record.id);section.setAttribute('aria-label','Eva 等待你的回答');
  section.append(element('strong',record.state==='submitted'?'回答已提交，等待处理':record.state==='stopping'?'正在停止任务…':'Eva 需要你的回答'));
  const form=element('form');const error=element('p',record.error,'agent-question-error');error.setAttribute('role','alert');
  const disabled=record.state!=='pending';
  for(const q of record.params.questions){
   const field=element('fieldset');field.disabled=disabled;field.append(element('legend',q.header||'问题'),element('p',q.question||''));
   const radios=[];
   for(const [index,option] of (q.options||[]).entries()){
    const label=element('label',null,'agent-question-option'),radio=element('input');radio.type='radio';radio.name='q-'+record.params.questions.indexOf(q);radio.checked=record.answers[q.id]?.kind==='option'&&record.answers[q.id].index===index;
    const copy=element('span');copy.append(element('b',option.label));if(option.description)copy.append(element('small',option.description));label.append(radio,copy);field.append(label);radios.push(radio);
    radio.addEventListener('change',()=>{record.answers[q.id]={kind:'option',index};persist(record);error.textContent='';});
   }
   const freeLabel=element('label',null,'agent-question-free');freeLabel.append(element('span',(q.options||[]).length?'或输入自己的答案':'你的答案'));
   const input=element(q.isSecret?'input':'textarea');if(q.isSecret){input.type='password';input.autocomplete='off';}else input.rows=2;input.maxLength=10000;input.setAttribute('aria-label',q.question||q.header||'你的答案');
   input.value=record.answers[q.id]?.kind==='text'?record.answers[q.id].text:'';
   input.addEventListener('input',()=>{for(const r of radios)r.checked=false;record.answers[q.id]={kind:'text',text:input.value};persist(record);error.textContent='';});freeLabel.append(input);field.append(freeLabel);form.append(field);
  }
  const actions=element('div',null,'agent-question-actions'),submit=element('button','提交回答'),cancel=element('button','停止任务');submit.type='submit';submit.disabled=disabled;cancel.type='button';cancel.disabled=record.state==='stopping';
  form.addEventListener('submit',event=>{event.preventDefault();if(record.state!=='pending')return;const answers=Object.create(null);for(const q of record.params.questions){const value=answerValue(record,q);if(!value){error.textContent='请回答每个问题后再提交。';return;}answers[q.id]={answers:[value]};}
   // Mark before crossing the native bridge to prevent duplicate taps/replays.
   record.state='submitted';record.error='';paint(true);
   try{EvaHost.kernelRespond(JSON.stringify(record.id),JSON.stringify({answers}));delete drafts()[draftKey(record.params)];record.answers={};scheduleKernelSave();paint(true);}
   catch(e){record.state='pending';record.error='提交失败：'+e.message;paint(true);}
  });
  cancel.addEventListener('click',async()=>{if(record.state==='stopping')return;const previous=record.state;record.state='stopping';record.error='';paint(true);try{await kernelCall('turn/interrupt',{threadId:record.params.threadId,turnId:record.params.turnId});}catch(e){if(!pending.has(requestKey(record.id)))return;record.state=previous;record.error='停止失败：'+e.message;paint(true);}});
  actions.append(cancel,submit);form.append(error,actions);section.append(form);return section;
 }
 function paint(force=false){
  const thread=active()?.kernelThread?.id,flow=document.querySelector('.flow');document.querySelectorAll('[data-agent-questions-banner]').forEach(n=>n.remove());if(!flow||settingPage||!['home','chat'].includes(route))return;
  let host=flow.querySelector('[data-agent-questions]');if(!host){host=element('div');host.dataset.agentQuestions='true';host.dataset.turn='agent-questions';flow.append(host);}
  const current=[...pending.values()].filter(r=>r.params.threadId===thread);const signature=current.map(r=>requestKey(r.id)+':'+r.state+':'+r.error).join('|');
  if(force||host.dataset.signature!==signature){host.replaceChildren(...current.map(card));host.dataset.signature=signature;}
  const elsewhere=[...pending.values()].filter(r=>r.params.threadId!==thread);if(elsewhere.length){const banner=element('button','其他对话有 '+elsewhere.length+' 项问题待回答');banner.dataset.agentQuestionsBanner='true';banner.type='button';banner.addEventListener('click',()=>{const c=[...data.chats,...data.drafts].find(c=>c.kernelThread?.id===elsewhere[0].params.threadId);if(c)navigate('chat:'+c.id);});document.querySelector('.app-head')?.after(banner);}
 }
 const style=element('style');style.textContent='.agent-question-card{margin:12px 0;padding:16px;border-radius:16px;background:var(--surface,#f4f4f4);color:inherit}.dark .agent-question-card{background:#282828}.agent-question-card fieldset{border:0;padding:12px 0;margin:0;min-width:0}.agent-question-card legend{font-weight:600}.agent-question-card p{white-space:pre-wrap;overflow-wrap:anywhere;margin:8px 0}.agent-question-option{display:flex;align-items:flex-start;gap:9px;padding:10px 0}.agent-question-option small{display:block;opacity:.7;margin-top:4px}.agent-question-free{display:block}.agent-question-free input,.agent-question-free textarea{display:block;box-sizing:border-box;width:100%;margin-top:8px;padding:10px;border:1px solid #9996;border-radius:8px;font:inherit;color:inherit;background:transparent}.agent-question-actions{display:flex;justify-content:flex-end;gap:12px;flex-wrap:wrap}.agent-question-actions button{padding:10px 14px;border-radius:10px}.agent-question-error{color:#b43333}[data-agent-questions-banner]{margin:8px 16px;padding:10px;border-radius:10px}';document.head.append(style);
 const previousEvent=kernelEvent;kernelEvent=function(e){if(e.method==='item/tool/requestUserInput'&&e.id!==undefined&&receive(e))return;const p=e.params||{};
  if(e.method==='serverRequest/resolved'){const record=pending.get(requestKey(p.requestId));if(record&&record.params.threadId===p.threadId)forget(record);}
  if(e.method==='turn/completed')for(const record of pending.values())if(record.params.threadId===p.threadId&&record.params.turnId===(p.turn?.id||p.turnId))forget(record);
  if(e.method==='android/kernelExited'){const ids=Array.isArray(p.threadIds)?new Set(p.threadIds):null;for(const record of pending.values())if(!ids||ids.has(record.params.threadId))forget(record);if(!ids)settled.clear();}
  previousEvent(e);paint();
 };
 const previousFlow=updateKernelFlow;updateKernelFlow=function(c){const host=document.querySelector('[data-agent-questions]');host?.remove();previousFlow(c);if(host)document.querySelector('.flow')?.append(host);paint();};
 const previousRender=render;render=function(){previousRender();paint();};
 window.agentQuestions={receive,refresh:paint,pendingCount:()=>pending.size};
 // This bridge returns ONLY requests still pending in the live kernel process.
 try{if(EvaHost.pendingQuestions)for(const e of JSON.parse(EvaHost.pendingQuestions()))receive(e);}catch{}
 paint();
})();
