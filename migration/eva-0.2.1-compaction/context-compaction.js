/* Context compaction display state, projected from native item lifecycle events.
   No summary generation, context replacement or automatic retry lives here. */
(function(root,factory){const exports=factory();if(typeof module==='object'&&module.exports)module.exports=exports;else {
 root.contextCompaction=exports.createContextCompaction({onChange:threadId=>{if(typeof state!=='undefined'&&state.activeThreadId===threadId&&typeof renderTranscript==='function')renderTranscript();}});
 if(typeof api!=='undefined')api.onNotification?.(({method,params})=>root.contextCompaction.observe(method,params));
}})(globalThis,function(){
 'use strict';
 function presentation(item,turn,now=Date.now(),lang='zh'){
  const completed=turn?.status==='completed'||(Object.hasOwn(item,'completed')?item.completed:true);
  const status=completed?'completed':turn?.status==='inProgress'?'inProgress':'interrupted';
  const slow=status==='inProgress'&&Number.isFinite(item.startedAtMs)&&now-item.startedAtMs>=10000;
  const manual=item.source==='manual';
  const label=lang==='zh'?(status==='inProgress'?(slow?'正在压缩上下文 · 可能需要几分钟':'正在压缩上下文'):status==='interrupted'?'压缩已中断':manual?'上下文已压缩':'上下文已自动压缩'):(status==='inProgress'?(slow?'Compacting context · This can take a few minutes':'Compacting context'):status==='interrupted'?'Compaction interrupted':manual?'Context compacted':'Context automatically compacted');
  return {status,label,slow,source:manual?'manual':'automatic'};
 }
 function createContextCompaction({now=()=>Date.now(),onChange=()=>{},setTimer=setTimeout,clearTimer=clearTimeout}={}){
  const pending=new Map(),synthetic=new Map(),records=new Map(),timers=new Map();let sequence=0;
  const key=(threadId,itemId)=>JSON.stringify([threadId,itemId]);
  const bucket=threadId=>{if(!pending.has(threadId))pending.set(threadId,new Map());return pending.get(threadId);};
  function cancel(id){const timer=timers.get(id);if(timer!==undefined)clearTimer(timer);timers.delete(id);}
  function schedule(threadId,id,startedAtMs){cancel(id);timers.set(id,setTimer(()=>{timers.delete(id);onChange(threadId);},Math.max(0,startedAtMs+10000-now())));}
  function beginManual(threadId){if(!threadId)throw Error('Missing compaction thread');const token='manual-compaction-'+(++sequence),startedAtMs=now();bucket(threadId).set(token,{token,startedAtMs});if(!synthetic.has(threadId)){synthetic.set(threadId,{startedAtMs});schedule(threadId,key(threadId,'synthetic'),startedAtMs);}onChange(threadId);return token;}
  function failManual(threadId,token){if(pending.get(threadId)?.delete(token)){if(!pending.get(threadId).size){synthetic.delete(threadId);cancel(key(threadId,'synthetic'));}onChange(threadId);}}
  function consume(threadId){const rows=pending.get(threadId);const first=rows?.values().next().value;if(first)rows.delete(first.token);return first;}
  function observe(method,p){
   if(!p?.threadId||!['item/started','item/completed'].includes(method)||p.item?.type!=='contextCompaction')return;
   const id=key(p.threadId,p.item.id),previous=records.get(id);
   if(method==='item/started'&&previous?.completed)return; // A late start cannot revive a completed item.
   const manual=method==='item/started'&&!previous?consume(p.threadId):null;
   if(method==='item/started'){synthetic.delete(p.threadId);cancel(key(p.threadId,'synthetic'));}
   const record={...previous,threadId:p.threadId,turnId:p.turnId,id:p.item.id,source:previous?.source||(manual?'manual':'automatic'),startedAtMs:previous?.startedAtMs??now(),completed:method==='item/completed'};
   records.set(id,record);
   if(record.completed)cancel(id);else schedule(p.threadId,id,record.startedAtMs);
   // The normal notification reducer owns history and the next render.
   if(records.size>2000)for(const [old,r]of records){if(r.completed){records.delete(old);if(records.size<=1500)break;}}
  }
  function overlay(threadId,turns){
   const result=(turns||[]).map(turn=>({...turn,items:(turn.items||[]).map(item=>item.type==='contextCompaction'?{...item,...records.get(key(threadId,item.id))}:item)}));
   const manual=synthetic.get(threadId);
   if(manual){let turn=result.at(-1);if(!turn||turn.status!=='inProgress'){turn={id:'pending-manual-compaction:'+threadId,status:'inProgress',items:[],_localOverlay:true};result.push(turn);}
    if(!turn.items.some(item=>item.id==='pending-manual-context-compaction'))turn.items.push({id:'pending-manual-context-compaction',type:'contextCompaction',completed:false,source:'manual',startedAtMs:manual.startedAtMs});
   }
   return result;
  }
  function dispose(){for(const id of timers.keys())cancel(id);pending.clear();synthetic.clear();records.clear();}
  return {beginManual,failManual,observe,overlay,presentation,dispose};
 }
 return {createContextCompaction,presentation};
});
