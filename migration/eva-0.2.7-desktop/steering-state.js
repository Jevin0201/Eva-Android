/* Display-only optimistic steering state. Never written into kernel history. */
(function(root,factory){const exported=factory();if(typeof module==='object'&&module.exports)module.exports=exported;else {root.steeringState=exported.createSteeringState();root.steeringState.subscribe(({threadId})=>{if(typeof state!=='undefined'&&state.activeThreadId===threadId&&typeof renderTranscript==='function')renderTranscript();});}})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const copy=value=>value==null?value:JSON.parse(JSON.stringify(value));
 function inputKey(input){return JSON.stringify((input||[]).map(part=>{
  if(part.type==='inputText'||part.type==='text')return {type:'text',text:String(part.text||'').trim()};
  if(part.type==='inputImage'||part.type==='image'){
   // Native UserInput image is a URL/fileId union. A file ID is identity,
   // never a guessed URL; keep it separate from URL and local-path matching.
   if(typeof part.fileId==='string')return {type:'image',fileId:part.fileId};
   const src=part.imageUrl??part.url??part.src??part.image_url;
   if(typeof src==='string')return {type:'image',src};
   // Unsupported image records must not collapse to the same null identity.
   const fields={};for(const key of Object.keys(part).sort())if(!['type','detail','annotations'].includes(key))fields[key]=part[key];
   return {type:'image',unresolved:fields};
  }
  if(part.type==='localImage')return {type:'image',src:part.path};
  const normalized={};for(const key of Object.keys(part).sort())if(!['text_elements','annotations','detail'].includes(key))normalized[key]=part[key];return normalized;
 }));}
 function nativeMessages(turns){return (turns||[]).flatMap((turn,turnIndex)=>(turn.items||[]).flatMap((item,index)=>{
  if(item._localOptimistic||!['userMessage','steeringUserMessage'].includes(item.type))return [];
  const turnId=turn.id??turn.turnId??null,id=item.id??item.serverUserMessageId;
  return [{item,turnId,key:id!=null?'id:'+id:'position:'+String(turnId??turnIndex)+':'+index+':'+inputKey(item.content??item.input),clientId:item.clientUserMessageId??item.clientId??null,input:item.content??item.input??[]}];
 }));}
 function createSteeringState(){
  const byThread=new Map(),consumed=new Map(),known=new Map(),listeners=new Set();let sequence=0;
  const bucket=thread=>{if(!byThread.has(thread))byThread.set(thread,new Map());return byThread.get(thread);};
  const emit=threadId=>{for(const fn of listeners)try{fn({threadId});}catch{}};
  function begin(options){
   const {threadId,id,targetTurnId=null,input=[],nativeTurns}=options||{};
   if(typeof threadId!=='string'||!threadId||typeof id!=='string'||!id)throw Error('Steering requires threadId and request id');
   const rows=bucket(threadId);if(rows.has(id))return copy(rows.get(id));
   const baseline=new Set([...(known.get(threadId)||[]),...nativeMessages(nativeTurns).map(row=>row.key)]);
   const nativeTurn=(nativeTurns||[]).find(turn=>(turn.id??turn.turnId)===targetTurnId),anchor=nativeTurn?.items?.at(-1);
   const row={id,type:'steeringUserMessage',threadId,targetTurnId,clientUserMessageId:options.clientUserMessageId??id,status:'pending',deliveryState:'pending',input:copy(input),attachments:copy(options.attachments||[]),restoreMessage:copy(options.restoreMessage??null),_localOptimistic:true,_sequence:++sequence,_anchorId:anchor?.id??null,_anchorIndex:nativeTurn?.items?.length??null,_baseline:[...baseline]};
   rows.set(id,row);emit(threadId);return copy(row);
  }
  function update(threadId,id,patch){const row=byThread.get(threadId)?.get(id);if(!row)return null;Object.assign(row,patch);emit(threadId);return copy(row);}
  function accepted(threadId,id,patch={}){const safe={};for(const key of ['targetTurnId','serverUserMessageId'])if(patch[key]!=null)safe[key]=patch[key];const row=byThread.get(threadId)?.get(id);if(safe.targetTurnId!=null&&row&&safe.targetTurnId!==row.targetTurnId){safe._anchorId=null;safe._anchorIndex=null;}return update(threadId,id,{...safe,status:'accepted',deliveryState:'accepted'});}
  function unknown(threadId,id,error){return update(threadId,id,{status:'pending',deliveryState:'unknown',deliveryError:error?.message??(typeof error==='string'?error:undefined)});}
  function rejected(threadId,id){const rows=byThread.get(threadId),row=rows?.get(id);if(!row)return null;rows.delete(id);if(!rows.size)byThread.delete(threadId);emit(threadId);return copy(row);}
  function match(threadId,turns){
   const rows=[...(byThread.get(threadId)?.values()||[])],echoes=nativeMessages(turns),used=new Set(consumed.get(threadId)||[]),matches=[];
   // First reserve exact client identities, then permit target/input fallback.
   for(const exact of [true,false])for(const row of rows){
    if(matches.some(pair=>pair.row.id===row.id))continue;
    const echo=echoes.find(e=>!used.has(e.key)&&!(row._baseline||[]).includes(e.key)&&
     (row.targetTurnId==null||e.turnId===row.targetTurnId)&&
     (exact?e.clientId!=null&&e.clientId===row.clientUserMessageId:e.clientId==null&&inputKey(e.input)===inputKey(row.input)));
    if(echo){used.add(echo.key);matches.push({row,echo});}
   }
   return {matches,echoes};
  }
  function reconcile(threadId,turns,{silent=false}={}){
   const {matches,echoes}=match(threadId,turns);const used=consumed.get(threadId)||new Set();for(const pair of matches){used.add(pair.echo.key);byThread.get(threadId)?.delete(pair.row.id);}consumed.set(threadId,used);
   known.set(threadId,new Set([...(known.get(threadId)||[]),...echoes.map(e=>e.key)]));
   if(byThread.get(threadId)?.size===0)byThread.delete(threadId);if(matches.length&&!silent)emit(threadId);
   return {matchedIds:matches.map(pair=>pair.row.id),remaining:items(threadId)};
  }
  function items(threadId){return [...(byThread.get(threadId)?.values()||[])].map(copy);}
  function overlay(threadId,turns){
   reconcile(threadId,turns,{silent:true});const rows=items(threadId);
   if(!rows.length)return turns||[];
   const result=(turns||[]).map(turn=>({...turn,items:[...(turn.items||[])]}));
   for(const row of rows){let turn=result.find(turn=>(turn.id??turn.turnId)===row.targetTurnId);
    // Native steering belongs to its target turn. Pagination can unload that
    // turn; retain the receipt until it is loaded again, never append a fake
    // active turn after newer history. Pending delivery is not model execution.
    if(!turn&&row.targetTurnId!=null)continue;
    if(!turn){turn=result.find(turn=>turn._localOverlay&&turn.targetTurnId===row.targetTurnId);if(!turn){turn={id:'local-steering:'+threadId+':pending',targetTurnId:null,status:'pending',_localOverlay:true,items:[]};result.push(turn);}}
    let index=row._anchorId==null?-1:turn.items.findIndex(item=>item.id===row._anchorId);
    index=index>=0?index+1:row._anchorIndex==null?turn.items.length:Math.min(row._anchorIndex,turn.items.length);
    while(turn.items[index]?._localOptimistic&&turn.items[index]._sequence<row._sequence)index++;
    turn.items.splice(index,0,row);
   }return result;
  }
  return {begin,accepted,rejected,unknown,reconcile,overlay,items,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);}};
 }
 return {createSteeringState,inputKey};
});
