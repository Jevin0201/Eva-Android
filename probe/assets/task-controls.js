'use strict';
// Same thread/turn protocol as desktop actions.js; stop is independent of send.
(()=>{
 const stopping=new Set(),interrupting=new Set(),steering=new Set(),stopSent=new Set();
 const turnOf=c=>c?.kernelThread?.turns?.findLast(t=>t.status==='inProgress');
 async function reconcile(c){
  if(!c?.kernelThread?.id)return false;const oldTurn=c.kernelThread.turns?.at(-1)?.id;
  const r=await kernelCall('thread/read',{threadId:c.kernelThread.id,includeTurns:true});
  if(!r.thread||oldTurn!==c.kernelThread.turns?.at(-1)?.id)return false;
  c.kernelThread=r.thread;c.running=!!turnOf(c);if(!c.running){c.pending='';stopping.delete(c.id);stopSent.delete(c.id);}
  scheduleKernelSave();if(active()===c){updateKernelFlow(c);refreshKernelControls();}return !c.running;
 }
 window.taskStopBeforeStart=c=>{if(!stopping.has(c.id))return false;stopping.delete(c.id);return true;};
 function controls(){
  const c=active(),input=$('#prompt'),button=$('[data-task-primary]')||$('[data-action="kernel-send"],[data-action="kernel-stop"],[data-action="kernel-steer"]');if(!button)return;
  button.dataset.taskPrimary='true';const running=!!c?.running,hasText=!!input?.value.trim(),hasFiles=!!c?.attachments?.length;
  button.dataset.action=running?'kernel-steer':'kernel-send';button.textContent=running?(steering.has(c.id)?'发送中':'引导'):'发送';
  button.disabled=running?(!hasText&&!hasFiles)||steering.has(c.id)||stopping.has(c.id)||!turnOf(c):kernelBusy||(!hasText&&!hasFiles);
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
  const c=active(),turn=turnOf(c),input=$('#prompt'),text=input?.value.trim()||'',attachments=[...(c?.attachments||[])];
  if(!turn||(!text&&!attachments.length)||steering.has(c.id)||stopping.has(c.id))return;
  steering.add(c.id);input.value='';c.draft='';refreshKernelControls();
  try{
   const content=[{type:'text',text:text+(attachments.length?'\n\n附件：\n'+attachments.map(a=>JSON.stringify({name:a.name,path:a.path})).join('\n'):''),text_elements:[]},...attachments.filter(a=>/^image\/(png|jpeg|webp|gif)$/.test(a.mime||'')).map(a=>({type:'localImage',path:a.path}))];
   await kernelCall('turn/steer',{threadId:c.kernelThread.id,expectedTurnId:turn.id,clientUserMessageId:crypto.randomUUID(),input:content});
   c.attachments=(c.attachments||[]).filter(a=>!attachments.some(sent=>sent.id===a.id));kernelNotice='引导信息已接收';
  }catch(e){c.draft=[text,c.draft].filter(Boolean).join('\n');if(active()===c&&$('#prompt'))$('#prompt').value=c.draft;kernelNotice='引导未确认：'+e.message+'；内容已保留，请先核对执行过程，勿重复发送。';}
  finally{steering.delete(c.id);scheduleKernelSave();if(active()===c){updateKernelFlow(c);refreshKernelControls();}}
 }
 const oldEvent=kernelEvent;kernelEvent=function(e){oldEvent(e);const p=e.params||{},c=[...data.chats,...data.drafts].find(c=>c.kernelThread?.id===p.threadId);if(!c)return;if(e.method==='turn/started'&&stopping.has(c.id))interrupt(c);if(e.method==='turn/completed'){if(stopping.has(c.id))kernelNotice=p.turn?.status==='interrupted'?'任务已停止':'任务已结束';stopping.delete(c.id);stopSent.delete(c.id);if(active()===c)refreshKernelControls();}};
 window.taskTurnReady=c=>{if(stopping.has(c.id)&&!stopSent.has(c.id))interrupt(c);};
 const oldNavigate=navigate;navigate=function(action){if(action==='kernel-stop'){interrupt(active());return;}if(action==='kernel-steer'){steer();return;}oldNavigate(action);};
 controls();
 // A previous process can end while the WebView is absent. Trust native history,
 // not a saved running flag; this never restarts or resends a task.
 setTimeout(()=>{for(const c of [...data.chats,...data.drafts])if(c.running&&c.kernelThread?.id)reconcile(c).catch(()=>{});},0);
})();
