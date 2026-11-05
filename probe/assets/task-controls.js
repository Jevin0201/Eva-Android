'use strict';
// Same thread/turn protocol as desktop actions.js; stop is independent of send.
(()=>{
 const restartCandidates=new Set([...data.chats,...data.drafts].filter(c=>c.running||c.pending||c.recoveryState)),sessionOwned=new WeakSet();
 const stopping=new Set(),interrupting=new Set(),steering=new Set(),stopSent=new Set();
 const turnOf=c=>c?.kernelThread?.turns?.findLast(t=>t.status==='inProgress');
 async function reconcile(c){
  if(!c?.kernelThread?.id)return false;const oldTurn=c.kernelThread.turns?.at(-1)?.id;
  const r=await kernelCall('thread/read',{threadId:c.kernelThread.id,includeTurns:true});
  if(!r.thread||r.thread.id!==c.kernelThread.id)throw Error('内核未返回匹配的会话状态');if(oldTurn!==c.kernelThread.turns?.at(-1)?.id)throw Error('核对期间会话已变化，请重新核对');
  c.kernelThread=r.thread;c.running=!!turnOf(c);if(!c.running){c.pending='';stopping.delete(c.id);stopSent.delete(c.id);}
  scheduleKernelSave();if(active()===c){updateKernelFlow(c);refreshKernelControls();}return !c.running;
 }
 window.taskStopBeforeStart=c=>{if(!stopping.has(c.id))return false;stopping.delete(c.id);return true;};
 // Restart recovery reads local journal first; it never submits a model turn.
 const recovering=new Map();
 function restorePending(c,unconfirmed=false){const pending=(c.pending||'').trim();if(unconfirmed&&pending){c.recoveryPendingText=pending;if(c.pendingSend)c.recoverySend=JSON.parse(JSON.stringify(c.pendingSend));}else if(pending&&!(c.draft||'').includes(pending))c.draft=[pending,c.draft].filter(Boolean).join('\n');c.pending='';c.running=false;}
 function repaintRecovery(c){scheduleKernelSave();if(active()===c){updateKernelFlow(c);if($('#prompt'))$('#prompt').value=c.draft||'';refreshKernelControls();}}
 function unresolved(c,message,unconfirmed=!!(c.pendingSend||c.recoverySend)){restorePending(c,unconfirmed);c.recoveryState='unverified';c.recoveryNotice=message;for(const t of c.kernelThread?.turns||[])if(t.status==='inProgress')t.status='unknown';repaintRecovery(c);}
 async function recover(c){
  if(!c||sessionOwned.has(c)||c.importedReadOnly||recovering.has(c.id))return recovering.get(c?.id);
  const work=(async()=>{
   if(!c.kernelThread?.id){restorePending(c);delete c.recoveryState;delete c.recoveryNotice;repaintRecovery(c);return;}
   c.recoveryState='checking';repaintRecovery(c);
   let timer;try{
    const r=await Promise.race([kernelCall('android/threadRecovery',{threadId:c.kernelThread.id}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('本地状态核对超时')),5000);})]);
    if(sessionOwned.has(c))return;const old=c.kernelThread.turns?.at(-1),send=c.pendingSend||c.recoverySend;const previousTurn=send?Array.isArray(send.baseTurnIds)&&send.baseTurnIds.includes(r.turnId)&&['preparing','dispatching'].includes(send.phase):old?.id===r.turnId;if(r.found&&r.terminal&&previousTurn&&['completed','interrupted'].includes(r.state)){
     c.pending=c.pending||c.recoveryPendingText||'';delete c.recoveryPendingText;restorePending(c);if(old?.id===r.turnId)old.status=r.state;delete c.pendingSend;delete c.recoverySend;delete c.recoveryState;delete c.recoveryNotice;repaintRecovery(c);
    }else unresolved(c,send?'任务状态待核对；上次发送可能已被接收，待核对文字单独保留，不会自动重发。':'任务状态待核对；未确认的文字已保留为草稿，不会自动重发。');
   }catch(e){unresolved(c,'任务状态待核对：'+e.message+'；草稿已保留，不会自动重发。');}finally{clearTimeout(timer);}
  })();recovering.set(c.id,work);try{return await work;}finally{recovering.delete(c.id);}
 }
 async function verifyRecovery(c){if(!c?.kernelThread?.id)return;const input=$('#prompt');if(input)c.draft=input.value;c.recoveryState='checking';controls();try{await reconcile(c);if(c.recoveryPendingText){const send=c.pendingSend||c.recoverySend,newTurn=send&&c.kernelThread.turns?.some(t=>!(send.baseTurnIds||[]).includes(t.id));if(send?.phase==='accepted'||newTurn){delete c.recoveryPendingText;delete c.pendingSend;delete c.recoverySend;}else if(!c.running){const text=c.recoveryPendingText;if(!(c.draft||'').includes(text))c.draft=[text,c.draft].filter(Boolean).join('\n');delete c.recoveryPendingText;delete c.pendingSend;delete c.recoverySend;}else throw Error('尚不能确认上次发送是否被接收');}delete c.recoveryState;delete c.recoveryNotice;kernelNotice=c.running?'已核对：原任务仍在执行；草稿未自动发送。':'已核对任务记录；草稿未自动发送。';repaintRecovery(c);}catch(e){unresolved(c,'任务状态核对失败：'+e.message+'；请稍后重试，或新建聊天。');}}
 function controls(){
  const c=active(),input=$('#prompt'),button=$('[data-task-primary]')||$('[data-action="kernel-send"],[data-action="kernel-stop"],[data-action="kernel-steer"]');if(!button)return;
  button.dataset.taskPrimary='true';const running=!!c?.running,hasText=!!input?.value.trim(),hasFiles=!!c?.attachments?.length;
  button.dataset.action=running?'kernel-steer':'kernel-send';button.textContent=running?(steering.has(c.id)?'发送中':'引导'):'发送';
  button.disabled=!!c?.recoveryState|| (running?(!hasText&&!hasFiles)||steering.has(c.id)||stopping.has(c.id)||!turnOf(c):kernelBusy||(!hasText&&!hasFiles));
  let recovery=$('[data-task-recovery]');if(c?.recoveryState){if(!recovery){recovery=document.createElement('button');recovery.type='button';recovery.dataset.action='task-recovery';recovery.dataset.taskRecovery='true';button.after(recovery);}recovery.textContent=c.recoveryState==='checking'?'正在核对…':'核对任务状态';recovery.disabled=c.recoveryState==='checking';if($('.foot'))$('.foot').textContent=c.recoveryNotice||'正在核对本地任务记录；不会自动发送。';}else recovery?.remove();
  let stop=$('[data-task-stop]');if(running){if(!stop){stop=document.createElement('button');stop.type='button';stop.dataset.action='kernel-stop';stop.dataset.taskStop='true';stop.style.cssText='margin-left:8px;flex-shrink:0';button.after(stop);}stop.textContent=stopping.has(c.id)?'正在停止…':'停止';stop.disabled=interrupting.has(c.id);stop.setAttribute('aria-label','停止当前任务');}else stop?.remove();
 }
 const oldRefresh=refreshKernelControls;refreshKernelControls=function(){oldRefresh();controls();};
 const oldRender=render;render=function(){oldRender();if(['home','chat'].includes(route))controls();};
 document.addEventListener('input',e=>{if(e.target.id==='prompt')controls();});
 async function interrupt(c){
  if(!c||interrupting.has(c.id))return;stopping.add(c.id);controls();let turn=turnOf(c);
  if(!turn&&kernelBusy){kernelNotice='正在取消发送…';refreshKernelControls();return;}
  interrupting.add(c.id);
  try{
   if(!turn&&c.kernelThread?.id){const r=await kernelCall('thread/read',{threadId:c.kernelThread.id,includeTurns:true});c.kernelThread=r.thread;turn=turnOf(c);}
   if(turn){stopSent.add(c.id);await kernelCall('turn/interrupt',{threadId:c.kernelThread.id,turnId:turn.id});kernelNotice=c.running?'已请求停止，等待内核确认':'任务已停止';}
   else{c.running=false;stopping.delete(c.id);kernelNotice='任务已结束';}
  }catch(e){stopping.delete(c.id);stopSent.delete(c.id);let ended=false;try{ended=await reconcile(c);}catch{}kernelNotice=ended?'任务已结束，已同步状态':'停止失败：'+e.message;}
  finally{interrupting.delete(c.id);scheduleKernelSave();if(active()===c)refreshKernelControls();}
 }
 async function steer(){
  const c=active(),turn=turnOf(c),input=$('#prompt'),text=input?.value.trim()||'',attachments=[...(c?.attachments||[])],references=window.evaReferences?.selected(c)||[];
  if(!turn||(!text&&!attachments.length)||steering.has(c.id)||stopping.has(c.id))return;
  steering.add(c.id);input.value='';c.draft='';refreshKernelControls();
  try{
   const referenceInput=await (window.evaReferences?.inputs(references,c)||Promise.resolve([]));const content=[{type:'text',text:text+(attachments.length?'\n\n附件：\n'+attachments.map(a=>JSON.stringify({name:a.name,path:a.path})).join('\n'):''),text_elements:[]},...attachments.filter(a=>/^image\/(png|jpeg|webp|gif)$/.test(a.mime||'')).map(a=>({type:'localImage',path:a.path})),...referenceInput];
   await kernelCall('turn/steer',{threadId:c.kernelThread.id,expectedTurnId:turn.id,clientUserMessageId:crypto.randomUUID(),input:content});
   c.attachments=(c.attachments||[]).filter(a=>!attachments.some(sent=>sent.id===a.id));window.evaReferences?.accepted(c,references);kernelNotice='引导信息已接收';
  }catch(e){c.draft=[text,c.draft].filter(Boolean).join('\n');if(active()===c&&$('#prompt'))$('#prompt').value=c.draft;kernelNotice='引导未确认：'+e.message+'；内容已保留，请先核对执行过程，勿重复发送。';}
  finally{steering.delete(c.id);scheduleKernelSave();if(active()===c){updateKernelFlow(c);refreshKernelControls();}}
 }
 const oldEvent=kernelEvent;kernelEvent=function(e){oldEvent(e);const p=e.params||{},c=[...data.chats,...data.drafts].find(c=>c.kernelThread?.id===p.threadId);if(!c)return;if(e.method==='turn/started')sessionOwned.add(c);if(e.method==='turn/started'&&stopping.has(c.id))interrupt(c);if(e.method==='turn/completed'){if(stopping.has(c.id))kernelNotice=p.turn?.status==='interrupted'?'任务已停止':'任务已结束';stopping.delete(c.id);stopSent.delete(c.id);if(active()===c)refreshKernelControls();}};
 window.taskTurnReady=c=>{sessionOwned.add(c);if(stopping.has(c.id)&&!stopSent.has(c.id))interrupt(c);};
 window.taskRecover=recover;
 const previousSend=kernelSend;kernelSend=function(){if(active()?.recoveryState){controls();return;}const eligible=!kernelBusy&&!active()?.running,result=previousSend();if(eligible&&active()?.running)sessionOwned.add(active());return result;};
 const oldNavigate=navigate;navigate=function(action){if(action==='task-recovery'){verifyRecovery(active());return;}if(action.startsWith('chat:')){const c=[...data.chats,...data.drafts].find(c=>c.id===action.slice(5));if(c&&((restartCandidates.has(c)&&(c.running||c.pending))||c.recoveryState||(sessionOwned.has(c)&&(c.running||c.pending)))){data.active=c.id;route='chat';settingPage=null;$('#phone').classList.remove('drawer-open');render();if(!sessionOwned.has(c))recover(c);return;}}if(action==='kernel-stop'){interrupt(active());return;}if(action==='kernel-steer'){steer();return;}oldNavigate(action);};
 controls();
 // A previous process can end while the WebView is absent. Trust native history,
 // not a saved running flag; this never restarts or resends a task.
 setTimeout(()=>{for(const c of restartCandidates)if(!sessionOwned.has(c)&&(c.running||c.pending||c.recoveryState))recover(c);},0);
})();
