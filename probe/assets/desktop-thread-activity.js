/* Desktop thread-activity.js, hosted with Android storage and lifecycle. */
(() => {
 const module = {exports: {}};
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

 const activity = module.exports.create({
  load: () => data.threadReadMarkers || [],
  save: rows => { data.threadReadMarkers = rows; scheduleKernelSave(); }
 });
 function visibleThread() {
  const shown = selector => [...document.querySelectorAll(selector)].some(node => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden');
  const question = shown('.agent-question-card, [data-native-question-mount]');
  const overlay = shown('[role="dialog"], .model-overlay, .model-panel');
  const focused = !document.hasFocus || document.hasFocus();
  return !settingPage && route === 'chat' && document.visibilityState !== 'hidden' && focused && !overlay && !question
   ? active()?.kernelThread?.id : null;
 }
 function presentation(chat) {
  if (!chat.kernelThread?.id) return {type: chat.running && !chat.recoveryState ? 'loading' : 'idle', unread: false};
  const status = activity.presentation(chat.kernelThread, {owned: !!chat.running && !chat.recoveryState});
  return chat.recoveryState ? {...status, type: 'idle'} : status;
 }
 // Markup and timing are renderThreadActivity / styles.css from desktop Eva.
 function markerMarkup(status) {
  if (status.type === 'loading') return '<svg class="ti-spinner" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 3a7 7 0 0 1 0 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  return status.unread ? '<span class="ti-unread"></span>' : '';
 }
 function decorate(node, chat) {
  const status = presentation(chat);
  node.dataset.runtimeStatus = status.type;
  node.dataset.unread = String(status.unread);
  let marker = node.querySelector('[data-thread-status]');
  if (!marker) {
   marker = document.createElement('span');
   marker.dataset.threadStatus = '';
   marker.className = 'ti-status';
   marker.setAttribute('role', 'status');
   node.append(marker);
  }
  const signature = status.type + ':' + status.unread;
  // Retain the SVG during deltas so its animation is never restarted per token.
  if (marker.dataset.signature !== signature) {
   marker.innerHTML = markerMarkup(status);
   const spinner = marker.querySelector('.ti-spinner');
   if (spinner) spinner.style.animationDelay = '-' + (Date.now() % 1250) + 'ms';
   marker.dataset.signature = signature;
  }
  marker.setAttribute('aria-label', status.type === 'loading' ? (chat.kernelThread?.id ? '正在运行' : '正在启动') : status.unread ? '有未读结果' : '');
  marker.hidden = status.type !== 'loading' && !status.unread;
 }
 function paintRunningRegion(chats) {
  const scroller = document.querySelector('#sidebar .side-scroll');
  if (!scroller) return;
  let region = scroller.querySelector('[data-running-tasks]');
  const tasks = chats.filter(chat => presentation(chat).type === 'loading' || chat.running || chat.pending);
  if (!tasks.length) { region?.remove(); return; }
  if (!region) {
   region = document.createElement('section');
   region.dataset.runningTasks = '';
   region.className = 'desktop-running-tasks';
   region.setAttribute('aria-label', '正在执行的任务');
   const heading = document.createElement('div');
   heading.className = 'tree-section';
   heading.textContent = '正在执行的任务';
   region.append(heading);
   scroller.prepend(region);
  }
  const expected = new Set(tasks.map(chat => chat.id));
  for (const row of [...(region.querySelector('[data-running-list]')?.children || [])]) if (!expected.has(row.dataset.chatId)) row.remove();
  let list = region.querySelector('[data-running-list]');
  if (!list) { list = document.createElement('div'); list.dataset.runningList = ''; region.append(list); }
  for (const chat of tasks) {
   let row = [...list.children].find(node => node.dataset.chatId === chat.id);
   if (!row) {
    row = document.createElement('button');
    row.type = 'button'; row.className = 'tree-chat desktop-running-task'; row.dataset.chatId = chat.id;
    row.dataset.action = 'chat:' + chat.id;
    const title = document.createElement('span'); title.className = 'ti-title'; row.append(title);
    const detail = document.createElement('small'); detail.className = 'running-task-detail'; row.append(detail);
    list.append(row);
   }
   row.querySelector('.ti-title').textContent = chat.title || '新对话';
   row.classList.toggle('is-active', chat.id === data.active);
   const detail = row.querySelector('.running-task-detail');
   detail.textContent = chat.recoveryState ? '待核对任务状态' : !chat.kernelThread?.id ? '正在启动' : '';
   detail.hidden = !detail.textContent;
   decorate(row, chat);
  }
 }
 function paint() {
  const visible = visibleThread();
  if (visible) activity.read(visible);
  const chats = [...data.chats, ...data.drafts];
  paintRunningRegion(chats);
  for (const chat of chats) {
   for (const node of document.querySelectorAll('.tree-chat[data-action="chat:' + CSS.escape(chat.id) + '"]')) decorate(node, chat);
  }
  window.evaChatScroll?.sync(document.querySelector('.flow'));
 }
 const previousSidebar = sidebar;
 sidebar = function() { previousSidebar(); paint(); };
 const previousEvent = kernelEvent;
 kernelEvent = function(event) {
  previousEvent(event);
  if (event.method === 'android/kernelExited') {
   const ids = event.params?.threadIds;
   for (const chat of [...data.chats, ...data.drafts]) {
    const id = chat.kernelThread?.id;
    if (id && (!Array.isArray(ids) || ids.includes(id))) activity.observe('thread/status/changed', {threadId:id,status:{type:'notLoaded'}});
   }
   paint();
  } else if (activity.observe(event.method, event.params, visibleThread())) paint();
 };
 document.addEventListener('visibilitychange', paint);
 window.addEventListener('focus', paint);
 window.evaDesktopActivity = {presentation, paint};
 paint();
})();

/* Desktop optimistic steering state with Android render lifecycle. */
(() => {
 const module = {exports: {}};
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

 const steering = module.exports.createSteeringState();
 window.evaDesktopSteering = steering;
 const previousFlow = updateKernelFlow;
 updateKernelFlow = function(chat) {
  if (!chat?.kernelThread) return previousFlow(chat);
  const thread = chat.kernelThread;
  const original = thread.turns;
  try {
   thread.turns = steering.overlay(thread.id, original);
   return previousFlow(chat);
  } finally {
   thread.turns = original;
  }
 };
})();
