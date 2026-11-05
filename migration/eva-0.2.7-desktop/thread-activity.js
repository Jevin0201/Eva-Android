/* Native QEn status precedence; EVA adapts RPC events and local read markers. */
(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else {root.threadActivity=value.create({load:()=>store.get('eva.thread-read-markers',[]),save:rows=>store.set('eva.thread-read-markers',rows)});const seen=()=>{if(document.visibilityState==='hidden'||document.hasFocus?.()===false||typeof state==='undefined'||!state.activeThreadId)return;if(root.threadActivity.read(state.activeThreadId)&&typeof renderSidebar==='function')renderSidebar();};window.addEventListener('focus',seen);document.addEventListener('visibilitychange',seen);}})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 function QEn({hasInProgressOwnedWork:e,isResponseInProgress:t,latestTurnHasSystemError:n,resumeState:r,threadRuntimeStatus:i}){return e?'loading':i?.type==='systemError'?'error':i?.type==='active'?'loading':r==='needs_resume'?'idle':n?'error':t===true?'loading':'idle';}
 function create({load=()=>[],save=()=>{}}={}){
  const runtime=new Map(),markers=new Map((()=>{const value=load();return Array.isArray(value)?value.filter(r=>Array.isArray(r)&&typeof r[0]==='string'):[];})()),terminal=new Set();
  function persist(){while(markers.size>1000)markers.delete(markers.keys().next().value);save([...markers]);}
  function read(id){const row=markers.get(id);if(!row?.unread)return false;markers.set(id,{...row,unread:false});persist();return true;}
  function observe(method,p,visibleId=null){
   const id=p?.threadId??p?.thread?.id;if(!id)return false;
   if(method==='thread/status/changed'){runtime.set(id,{...runtime.get(id),status:p.status});return true;}
   if(method==='turn/started'){
    if(!p.turn?.id||terminal.has(id+':'+p.turn.id)||p.turn.status&&p.turn.status!=='inProgress')return false;
    runtime.set(id,{turnId:p.turn.id,status:{type:'active'}});return true;
   }
   if(method==='turn/completed'){
    const turn=p.turn;if(!turn?.id||terminal.has(id+':'+turn.id))return false;terminal.add(id+':'+turn.id);if(terminal.size>2000)terminal.delete(terminal.values().next().value);
    const current=runtime.get(id);if(current?.turnId&&current.turnId!==turn.id)return false;
    runtime.set(id,{turnId:turn.id,status:{type:turn.status==='failed'?'systemError':'idle'}});
    markers.set(id,{turnId:turn.id,unread:id!==visibleId&&turn.status!=='interrupted'});persist();return true;
   }
   if(method==='thread/deleted'){runtime.delete(id);markers.delete(id);persist();return true;}
   return false;
  }
  function presentation(thread,{owned=false}={}){return {type:QEn({hasInProgressOwnedWork:owned,threadRuntimeStatus:runtime.get(thread.id)?.status??thread.status}),unread:markers.get(thread.id)?.unread??thread.hasUnreadTurn===true};}
  return {observe,read,presentation};
 }
 return {create,QEn};
});
