'use strict';
// Android host adapter. State machine and labels are reused from Eva desktop 0.2.1.
(()=>{
 window.evaCompactionIcon="<svg viewBox=\"0 0 20 20\" aria-hidden=\"true\"><g transform=\"scale(1.25)\" stroke=\"none\"><path d=\"M11.5247 1.80859C12.9925 1.80873 14.1826 2.99992 14.1829 4.46777V11.752C14.6643 11.9563 15.0021 12.4342 15.0022 12.9902C15.0021 13.7322 14.4004 14.3346 13.6584 14.335C12.9162 14.335 12.3139 13.7324 12.3137 12.9902C12.3138 12.4342 12.6513 11.9563 13.1331 11.752V4.46777C13.1328 3.57982 12.4126 2.85951 11.5247 2.85938L8.86646 2.86035C8.57667 2.86035 8.34133 2.62469 8.34106 2.33496C8.34106 2.04501 8.57651 1.80859 8.86646 1.80859H11.5247Z\" fill=\"currentColor\"/> <path d=\"M2.33228 1.75488C3.0744 1.75501 3.67589 2.35651 3.67603 3.09863C3.67603 3.65479 3.33827 4.13233 2.85669 4.33691L2.85767 11.5234C2.85793 12.4115 3.57797 13.1318 4.46606 13.1318H7.12427C7.41399 13.1321 7.64966 13.3674 7.64966 13.6572C7.64939 13.9468 7.41383 14.1824 7.12427 14.1826H4.46606C2.99807 14.1826 1.80813 12.9914 1.80786 11.5234L1.80688 4.33691C1.32538 4.13221 0.987549 3.65459 0.987549 3.09863C0.987681 2.35642 1.59004 1.75488 2.33228 1.75488Z\" fill=\"currentColor\"/> <path d=\"M8.66626 8.89258C8.95621 8.89258 9.19165 9.12802 9.19165 9.41797C9.19165 9.70792 8.95621 9.94336 8.66626 9.94336H5.66626C5.37648 9.94316 5.14087 9.7078 5.14087 9.41797C5.14087 9.12814 5.37648 8.89278 5.66626 8.89258H8.66626Z\" fill=\"currentColor\"/> <path d=\"M10.3333 6.05957C10.6231 6.05975 10.8577 6.29512 10.8577 6.58496C10.8575 6.87469 10.623 7.11018 10.3333 7.11035H5.66626C5.37656 7.11015 5.141 6.87468 5.14087 6.58496C5.14087 6.29513 5.37648 6.05977 5.66626 6.05957H10.3333Z\" fill=\"currentColor\"/></g></svg>";
 const failures=new Map(),usage=new Map(),manualTokens=new Map();
 const core=EvaContextCompaction.createContextCompaction({onChange:id=>{const c=active();if(c?.kernelThread?.id!==id)return;for(const turn of c.kernelThread.turns||[])completedTurnHtml.delete(turn);updateKernelFlow(c);paint();}});
 const overlay=c=>core.overlay(c?.kernelThread?.id,c?.kernelThread?.turns||[]);
 const busy=c=>overlay(c).some(t=>t.items.some(i=>i.type==='contextCompaction'&&core.presentation(i,t).status==='inProgress'));
 function percent(info){const window=info?.modelContextWindow,used=info?.last?.totalTokens;if(typeof window!=='number'||!Number.isFinite(window)||window<=0||typeof used!=='number'||!Number.isFinite(used)||used<0)return null;return Math.min(used,window)/window*100;}
 function status(c){for(const turn of overlay(c).reverse())for(const item of [...turn.items].reverse())if(item.type==='contextCompaction')return core.presentation(item,turn).label;return '';}
 function paint(){
  const c=active(),id=c?.kernelThread?.id,foot=document.querySelector('.foot');if(!foot)return;
  foot.querySelector('[data-context-controls]')?.remove();if(!id||c.importedReadOnly)return;
  const controls=document.createElement('span');controls.dataset.contextControls='';controls.className='context-compaction-controls';const value=percent(usage.get(id));
  if(value!=null){const label=document.createElement('span');label.textContent=`上下文 ${Math.round(value)}%`;label.title='当前请求上下文占用（last.totalTokens / modelContextWindow），不是累计消耗';controls.append(label);}
  const label=failures.get(id)?.message||status(c);if(label){const text=document.createElement('span');text.textContent=label;text.setAttribute('role','status');controls.append(text);}
  const button=document.createElement('button');button.type='button';button.dataset.action='context-compact';button.textContent='压缩上下文';button.title='调用内核压缩上下文，保留可见聊天记录';button.disabled=!!kernelBusy||!!c.running||busy(c)||!!document.querySelector('#prompt')?.value.trim();controls.append(button);foot.append(controls);
 }
 async function request({command=false}={}){
  const c=active();let id=c?.kernelThread?.id;const input=document.querySelector('#prompt'),text=input?.value.trim()||'';
  if(!id||c.importedReadOnly)throw Error('请先打开可继续的会话');
  if(kernelBusy||c.running||busy(c))throw Error('任务进行中，暂时不能压缩上下文');
  if(text&&!(command&&text==='/compact'))throw Error('请先保留或发送输入框内容，再压缩上下文');
  failures.delete(id);let token=core.beginManual(id);manualTokens.set(id,token);
  try{
   // Identical scheduling contract to desktop actions.js: only native item events finish it.
   const stamp=[id,c.providerId,c.model,c.projectId].join('|');
   if(!loadedKernelThreads.has(stamp)){
    const cached=c.kernelThread,reply=await kernelCall('thread/resume',{threadId:id,model:c.model,modelProvider:c.providerId,androidProject:c.projectId||'',excludeTurns:true,...(window.evaPermissions?.params(c)||{})});
    window.evaPermissions?.validate(reply,c);
    if(reply.thread?.id!==id&&reply.androidPreviousThreadId!==id)throw Error('会话来源已变化，请重新打开会话后压缩');
    c.kernelThread={...cached,...reply.thread,turns:cached.turns||[]};
    if(reply.thread.id!==id){c.previousKernelThreadIds=[...new Set([...(c.previousKernelThreadIds||[]),id])];core.failManual(id,token);manualTokens.delete(id);id=reply.thread.id;token=core.beginManual(id);manualTokens.set(id,token);}
    loadedKernelThreads.add([id,c.providerId,c.model,c.projectId].join('|'));
   }
   await kernelCall('thread/compact/start',{threadId:id});
   if(command&&input?.value.trim()==='/compact'){input.value='';if((c.draft||'').trim()==='/compact')c.draft='';scheduleKernelSave();}
   paint();return true;
  }catch(error){core.failManual(id,token);failures.set(id,{message:'压缩失败：'+error.message});if(active()===c){kernelNotice=failures.get(id).message;refreshKernelControls();}throw error;}
 }
 const beforeEvent=kernelEvent;kernelEvent=function(event){const p=event.params||{};
  core.observe(event.method,p);
  if(event.method==='item/completed'&&p.item?.type==='contextCompaction'&&failures.get(p.threadId)?.transient){failures.delete(p.threadId);if(active()?.kernelThread?.id===p.threadId)kernelNotice='';}
  const c=[...data.chats,...data.drafts].find(c=>c.kernelThread?.id===p.threadId);
  if(c&&busy(c)&&(event.method==='error'||event.method==='turn/completed'&&['failed','interrupted'].includes(p.turn?.status))){
   const error=p.error||p.turn?.error,message=typeof error==='string'?error:error?.message;
   failures.set(p.threadId,{turnId:p.turnId||p.turn?.id,transient:p.willRetry===true,message:(p.willRetry===true?'压缩连接中断，内核重试中':'压缩'+(p.turn?.status==='interrupted'?'已中断':'失败'))+'：'+(message||'内核未完成上下文压缩')});
   if(p.willRetry!==true)core.failManual(p.threadId,manualTokens.get(p.threadId));
   if(active()===c)kernelNotice=failures.get(p.threadId).message;
  }
  if(event.method==='thread/tokenUsage/updated' &&p.threadId)usage.set(p.threadId,p.tokenUsage);
  const result=beforeEvent(event);paint();return result;
 };
 // Project the complete turn list only during rendering. Never persist synthetic rows.
 const beforeUpdate=updateKernelFlow;updateKernelFlow=function(c){
  if(!c?.kernelThread?.id)return beforeUpdate(c);const saved=c.kernelThread;
  const raw=saved.turns||[],projected=core.overlay(saved.id,raw).map((turn,index)=>!turn._localOverlay&&!turn.items.some(item=>item.type==='contextCompaction')?raw[index]:turn);
  c.kernelThread={...saved,turns:projected};
  try{return beforeUpdate(c);}finally{c.kernelThread=saved;}
 };
 const beforeFlow=mobileFlow.turn;mobileFlow.turn=function(turn){const html=beforeFlow(turn),items=(turn.items||[]).filter(i=>i.type==='contextCompaction');if(!items.length)return html;const template=document.createElement('template');template.innerHTML=html;
  for(const item of items){const failure=failures.get(active()?.kernelThread?.id),view=failure?.turnId===turn.id?{...core.presentation(item,turn),status:failure.transient?'inProgress':'interrupted',label:failure.message}:core.presentation(item,turn),node=[...template.content.querySelectorAll('[data-flow-key]')].find(e=>e.dataset.flowKey===item.id);if(!node)continue;const label=esc(view.label),summary=view.status==='inProgress'?'<span class="eva-thinking-text">'+label+'<span class="eva-thinking-sweep" aria-hidden="true"><span class="eva-thinking-highlight">'+label+'</span></span></span>':label;
   node.outerHTML='<div class="context-compaction-row" data-flow-key="'+esc(item.id)+'" data-compaction-state="'+view.status+'" data-compaction-source="'+view.source+'" role="status">'+window.evaCompactionIcon+'<span class="compaction-summary">'+summary+'</span></div>';
  }return template.innerHTML;
 };
 const beforeRefresh=refreshKernelControls;refreshKernelControls=function(){const result=beforeRefresh();paint();return result;};
 const beforeRender=render;render=function(){const result=beforeRender();paint();return result;};
 const beforeSend=kernelSend;kernelSend=function(){if(document.querySelector('#prompt')?.value.trim()==='/compact')return request({command:true}).catch(error=>{kernelNotice=error.message;refreshKernelControls();});if(busy(active())){kernelNotice='正在压缩上下文，请等待内核完成';refreshKernelControls();return;}return beforeSend();};
 const beforeNavigate=navigate;navigate=function(action){if(action==='context-compact'){request().catch(error=>{kernelNotice=error.message;refreshKernelControls();});return;}return beforeNavigate(action);};
 document.addEventListener('input',event=>{if(event.target?.id==='prompt')paint();});
 window.addEventListener('pagehide',()=>core.dispose());
 window.evaContextCompaction={request,percent,core};paint();
})();
