'use strict';
// The installed app-server exposes cursor-based history. Never hydrate a whole rollout.
(()=>{
 const baseCall=kernelCall,inFlight=new Map(),readEpoch=new Map(),checkpoints=new WeakMap(),observedTurns=new Map();let eventSequence=0;
 // Adapted from desktop Eva actions.js openThread: request epoch + retained/live merge.
 const priorEvent=kernelEvent;kernelEvent=function(event){const p=event.params||{},id=p.turnId||p.turn?.id;if(!event.ticket&&p.threadId&&id){let turns=observedTurns.get(p.threadId);if(!turns){turns=new Map();observedTurns.set(p.threadId,turns);}turns.set(id,++eventSequence);}return priorEvent(event);};
 function stale(){const error=Error('较新的历史请求已取代本次结果');error.staleHistory=true;return error;}
 function conversation(id){return [...data.chats,...data.drafts].find(c=>c.kernelThread?.id===id);}
 function mergeThread(c,thread){const point=checkpoints.get(thread)||{ids:new Set((c.kernelThread?.turns||[]).map(t=>t.id)),sequence:eventSequence},existing=new Map((c.kernelThread?.turns||[]).map(t=>[t.id,t])),byId=new Map();for(const turn of thread.turns||[]){const cached=existing.get(turn.id),changed=(observedTurns.get(thread.id)?.get(turn.id)||0)>point.sequence;const merged=changed?streamState.mergeTurn(turn,cached||turn,{order:'existing'}):streamState.mergeTurn(cached,turn,{order:'existing'});if(cached&&!cached.androidSummary&&cached.itemsView!=='summary'&&['completed','failed','interrupted'].includes(cached.status)){merged.androidSummary=false;merged.itemsView='full';}byId.set(turn.id,merged);}for(const turn of existing.values())if(!byId.has(turn.id)&&(!point.ids.has(turn.id)||(observedTurns.get(thread.id)?.get(turn.id)||0)>point.sequence))byId.set(turn.id,turn);return {...thread,turns:[...byId.values()]};}
 function primeActivities(c,thread,epoch){
  if(!c||!window.EvaHost?.supportsHistoryActivity?.())return;
  const turns=thread.turns.filter(t=>t.androidSummary&&!t.androidActivity);if(!turns.length)return;
  baseCall('android/threadActivity',{threadId:thread.id,turnIds:turns.slice(-5).map(t=>t.id)}).then(result=>{
   if(readEpoch.get(thread.id)!==epoch||c.kernelThread?.id!==thread.id)return;
   for(const info of result.data||[]){const turn=c.kernelThread.turns.find(t=>t.id===info.turnId);if(turn?.androidSummary){turn.androidActivity=info;if(typeof completedTurnHtml!=='undefined')completedTurnHtml.delete(turn);}}
   refresh(c);
  }).catch(error=>{if(readEpoch.get(thread.id)!==epoch)return;for(const turn of c.kernelThread?.turns||[])if(turns.some(t=>t.id===turn.id)&&turn.androidSummary)turn.androidActivity={hasActivity:null,error:error.message};});
 }
 function validThread(result,id){if(!result?.thread||result.thread.id!==id)throw Error('历史返回了不匹配的会话');return result.thread;}
 function page(result){if(!Array.isArray(result?.data))throw Error('内核未返回分页历史；请更新内核，不会尝试全量加载');return result;}
 function summary(turn){if(!turn?.id||!Array.isArray(turn.items))throw Error('回合摘要格式无效');return {...turn,androidSummary:true,androidItemsCursor:null,androidItemsStarted:false};}
 kernelCall=async function(method,params={}){
  if(method==='thread/resume')return baseCall(method,{...params,excludeTurns:true});
  if(method!=='thread/read'||params.includeTurns!==true)return baseCall(method,params);
  const id=params.threadId,epoch=(readEpoch.get(id)||0)+1;readEpoch.set(id,epoch);const c=conversation(id),point={ids:new Set((c?.kernelThread?.turns||[]).map(t=>t.id)),sequence:eventSequence};
  const result=await baseCall(method,{...params,includeTurns:false}),thread=validThread(result,id);if(readEpoch.get(id)!==epoch)throw stale();
  const turns=page(await baseCall('thread/turns/list',{threadId:params.threadId,itemsView:'summary',limit:5,sortDirection:'desc'}));
  if(readEpoch.get(id)!==epoch)throw stale();const snapshot={...thread,turns:[...turns.data].reverse().map(summary),androidTurnsCursor:turns.nextCursor??null,androidPagedHistory:true};checkpoints.set(snapshot,point);const merged=c?mergeThread(c,snapshot):snapshot;checkpoints.set(merged,point);if(window.EvaHost?.supportsHistoryActivity?.())setTimeout(()=>primeActivities(c,merged,epoch),0);return {...result,thread:merged};
 };
 function current(c,id){if(c?.kernelThread?.id!==id)throw Error('加载期间会话已切换，未合并历史');}
 function refresh(c){scheduleKernelSave();if(active()===c){updateKernelFlow(c);refreshKernelControls();}}
 function once(key,operation){if(inFlight.has(key))return inFlight.get(key);const task=operation().finally(()=>inFlight.delete(key));inFlight.set(key,task);return task;}
 function mergeItems(anchors,details){
  const output=[],seen=new Set(),full=new Map(details.map(i=>[i.id,i]));
  const append=i=>{if(!i?.id)throw Error('历史消息缺少稳定编号');if(!seen.has(i.id)){output.push(full.get(i.id)||i);seen.add(i.id);}};
  for(const item of anchors)if(item.type==='userMessage')append(item);
  for(const item of details)append(item);
  for(const item of anchors)if(item.type!=='userMessage')append(item);
  return output;
 }
 async function loadOlder(c){
  const id=c?.kernelThread?.id,cursor=c?.kernelThread?.androidTurnsCursor;if(!id||!cursor)return false;
  return once('turns:'+id,async()=>{
   const epoch=readEpoch.get(id);const result=page(await baseCall('thread/turns/list',{threadId:id,cursor,itemsView:'summary',limit:5,sortDirection:'desc'}));current(c,id);if(readEpoch.get(id)!==epoch)throw stale();
   const existing=c.kernelThread.turns||[],known=new Set(existing.map(t=>t.id));
   const older=[...result.data].reverse().filter(t=>!known.has(t.id)).map(summary);
   c.kernelThread={...c.kernelThread,turns:[...older,...existing],androidTurnsCursor:result.nextCursor??null};
   if(typeof flowHistoryLimits!=='undefined')flowHistoryLimits.set(c,Math.max(20,c.kernelThread.turns.length));refresh(c);primeActivities(c,c.kernelThread,epoch);return true;
  });
 }
 async function loadItems(c,turnId){
  const id=c?.kernelThread?.id;if(!id)throw Error('没有可加载的会话');
  return once('items:'+id+':'+turnId,async()=>{
   let turn=c.kernelThread.turns?.find(t=>t.id===turnId);if(!turn)throw Error('回合已不在当前历史中');
   if(turn.androidItemsStarted&&!turn.androidItemsCursor)return false;
   const requestSequence=eventSequence,epoch=readEpoch.get(id);const result=page(await baseCall('thread/items/list',{threadId:id,turnId,limit:10,sortDirection:'desc',...(turn.androidItemsCursor?{cursor:turn.androidItemsCursor}:{})}));current(c,id);if(readEpoch.get(id)!==epoch)throw stale();
   turn=c.kernelThread.turns?.find(t=>t.id===turnId);if(!turn)throw Error('加载期间回合已变化');
   const incoming=result.data.map(entry=>{if(entry.turnId!==turnId||!entry.item?.id)throw Error('历史详情返回了不匹配的回合');return entry.item;}).reverse();
   const prior=turn.androidItemsStarted?(turn.items||[]):[],known=new Set(incoming.map(i=>i.id)),details=[...incoming,...prior.filter(i=>!known.has(i.id))];
   const anchors=turn.androidSummaryItems||turn.items||[];
   const history={...turn,items:mergeItems(anchors,details)},merged=(observedTurns.get(id)?.get(turnId)||0)>requestSequence?streamState.mergeTurn(history,turn,{order:'incoming'}):streamState.mergeTurn(turn,history,{order:'incoming'});
   const replacement={...merged,androidSummaryItems:anchors,androidItemsStarted:true,androidItemsCursor:result.nextCursor??null,androidSummary:!!result.nextCursor};
   c.kernelThread={...c.kernelThread,turns:c.kernelThread.turns.map(t=>t.id===turnId?replacement:t)};refresh(c);return true;
  });
 }
 window.evaKernelHistory={loadOlder,loadItems,mergeThread,moreButton:turn=>turn.androidItemsCursor?`<button class="history-more" data-action="kernel-history-items:${esc(turn.id)}">加载更早执行详情</button>`:''};
 const originalUpdate=updateKernelFlow;updateKernelFlow=function(c){originalUpdate(c);if(!window.evaDesktopStream?.enabled&&c?.kernelThread?.androidTurnsCursor&&active()===c){const flow=document.querySelector('.flow');if(flow&&!flow.querySelector('[data-action="kernel-history-older"]')){const section=document.createElement('section');section.dataset.turn='remote-history-window';section.innerHTML='<button class="history-more" data-action="kernel-history-older">加载更早回合</button>';flow.prepend(section);}}};
 const originalNavigate=navigate;navigate=function(action){if(action!=='kernel-history-older'&&!action.startsWith('kernel-history-items:'))return originalNavigate(action);const c=active();const operation=action==='kernel-history-older'?loadOlder(c):loadItems(c,action.slice('kernel-history-items:'.length));operation.catch(error=>{if(error.staleHistory)return;kernelNotice=error.message;refreshKernelControls();});};
})();
