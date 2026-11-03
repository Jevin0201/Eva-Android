'use strict';
// REA: QE/$E/YE/LO in subagent-activity-chip-group and subagent-panel.
// The shipped panel gates interaction by membership.canInteract: legacy
// spawnAgent can interact; v2 subAgentActivity defaults to read-only.
const subagentViews = new Map();
let subagentPaintTimer = null;
const agentTopology=globalThis.subagentTopologyFactory?.create({request:(method,params)=>api.call(method,params),getConversation:id=>state.thread?.id===id?state.thread:subagentViews.get(id)?.thread,onUpdate:parentId=>{if(state.activeThreadId===parentId&&typeof scheduleTranscript==='function')scheduleTranscript();const tab=selectedAgentTab();if(tab?.parentThreadId===parentId)renderSubagentsPanel(tab);},warn:error=>{if(typeof runtimeWarnings!=='undefined')runtimeWarnings.record('子智能体状态同步：'+String(error?.message||error));}});
function subagentParentThreadId(thread=state.thread) {
  const source=thread?.source?.subagent??thread?.source?.subAgent;
  return thread?.parentThreadId||source?.thread_spawn?.parent_thread_id||null;
}
function subagentInteractionAllowed(thread=state.thread) {
  const parentId=subagentParentThreadId(thread);if(!parentId)return true;
  const source=thread?.source?.subagent??thread?.source?.subAgent;
  if(source?.thread_spawn?.agent_path!=null)return false;
  const parent=subagentViews.get(parentId)?.thread;
  return agentReferences(parent?.turns).get(thread.id)?.canInteract===true;
}
function renderSubagentComposerContext() {
  const blocked=!subagentInteractionAllowed();
  els.composer.classList.toggle('subagent-readonly',blocked);
  if(blocked){els.input.readOnly=true;els.input.placeholder='在主对话中补充要求';els.send.disabled=true;els.stop.classList.add('hidden');}
}
function agentReceiverIds(item) {
  return [...new Set([...(item.receiverThreadIds||[]),...(item.receiverThreads||[]).map(r=>r.threadId),...Object.keys(item.agentsStates||{})])].filter(id=>typeof id==='string'&&id);
}
function agentReferences(turns,parentId) {
  const agents=new Map();
  for(const thread of parentId?agentTopology?.descendants(parentId)||[]:[]){const source=thread.source?.subagent??thread.source?.subAgent;agents.set(thread.id,{id:thread.id,thread,path:source?.thread_spawn?.agent_path,canInteract:false,status:thread.status?.type==='active'?'running':thread.status?.type==='idle'?'idle':thread.status?.type==='systemError'?'errored':undefined});}
  for(const turn of turns||[])for(const item of turn.items||[]) {
    if(item.type==='subAgentActivity') {
      if(!item.agentThreadId)continue;
      const old=agents.get(item.agentThreadId)||{};
      // An interaction is a message event, not a new running/completed lifecycle.
      agents.set(item.agentThreadId,{...old,id:item.agentThreadId,path:item.agentPath,model:item.model??old.model,canInteract:old.canInteract===true,status:item.kind==='interacted'?old.status:({started:'running',completed:'completed',interrupted:'interrupted'}[item.kind]||old.status),parentTurnId:turn.id});
    } else if(item.type==='collabAgentToolCall')for(const id of agentReceiverIds(item)) {
      const old=agents.get(id)||{},embedded=item.receiverThreads?.find(r=>r.threadId===id)?.thread;
      agents.set(id,{...old,id,thread:embedded||old.thread,tool:item.tool,canInteract:item.tool==='spawnAgent'||old.canInteract===true,objective:item.prompt?.trim()||old.objective,model:item.model||old.model,status:item.agentsStates?.[id]?.status||old.status,message:item.agentsStates?.[id]?.message??old.message,parentTurnId:turn.id});
    }
  }
  return agents;
}
function agentName(ref) {
  const thread=subagentViews.get(ref.id)?.thread||ref.thread;
  return ref.path?.split('/').filter(Boolean).at(-1)||thread?.agentNickname||thread?.name||'子智能体';
}
function agentRuntimeStatus(ref) {
  const cached=subagentViews.get(ref.id)?.thread;
  const thread=ref.thread?{...cached,...ref.thread,turns:cached?.turns||ref.thread.turns}:cached;
  if(thread?.status?.type==='systemError')return 'errored';
  if(thread?.status?.type==='active')return 'running';
  const last=thread?.turns?.at(-1);
  if(thread?.status?.type==='idle'&&!['completed','failed','interrupted'].includes(last?.status))return 'idle';
  if(last?.status==='inProgress')return 'running';
  if(last?.status==='failed')return 'errored';
  if(last?.status==='interrupted')return 'interrupted';
  if(last?.status==='completed')return 'completed';
  return ref.status;
}
function agentStatus(ref) {
  return {pendingInit:'正在启动',running:'正在工作',idle:'已结束',completed:'已完成',interrupted:'已停止',errored:'发生错误',shutdown:'已关闭',notFound:'暂不可用'}[agentRuntimeStatus(ref)]||'状态待同步';
}
// Original Cks/kks palette order and wks seed hash; assets copied byte-for-byte.
const agentAvatarPalette=[{"dark":"assets/subagents/00-dark.svg","light":"assets/subagents/00-light.svg"},{"dark":"assets/subagents/01-dark.svg","light":"assets/subagents/01-light.svg"},{"dark":"assets/subagents/02-dark.svg","light":"assets/subagents/02-light.svg"},{"dark":"assets/subagents/03-dark.svg","light":"assets/subagents/03-light.svg"},{"dark":"assets/subagents/04-dark.svg","light":"assets/subagents/04-light.svg"},{"dark":"assets/subagents/05-dark.svg","light":"assets/subagents/05-light.svg"},{"dark":"assets/subagents/06-dark.svg","light":"assets/subagents/06-light.svg"},{"dark":"assets/subagents/07-dark.svg","light":"assets/subagents/07-light.svg"},{"dark":"assets/subagents/08-dark.svg","light":"assets/subagents/08-light.svg"},{"dark":"assets/subagents/09-dark.svg","light":"assets/subagents/09-light.svg"},{"dark":"assets/subagents/10-dark.svg","light":"assets/subagents/10-light.svg"},{"dark":"assets/subagents/11-dark.svg","light":"assets/subagents/11-light.svg"},{"dark":"assets/subagents/12-dark.svg","light":"assets/subagents/12-light.svg"},{"dark":"assets/subagents/13-dark.svg","light":"assets/subagents/13-light.svg"},{"dark":"assets/subagents/14-dark.svg","light":"assets/subagents/14-light.svg"},{"dark":"assets/subagents/15-dark.svg","light":"assets/subagents/15-light.svg"},{"dark":"assets/subagents/16-dark.svg","light":"assets/subagents/16-light.svg"},{"dark":"assets/subagents/17-dark.svg","light":"assets/subagents/17-light.svg"},{"dark":"assets/subagents/18-dark.svg","light":"assets/subagents/18-light.svg"},{"dark":"assets/subagents/19-dark.svg","light":"assets/subagents/19-light.svg"},{"dark":"assets/subagents/20-dark.svg","light":"assets/subagents/20-light.svg"},{"dark":"assets/subagents/21-dark.svg","light":"assets/subagents/21-light.svg"},{"dark":"assets/subagents/22-dark.svg","light":"assets/subagents/22-light.svg"},{"dark":"assets/subagents/23-dark.svg","light":"assets/subagents/23-light.svg"},{"dark":"assets/subagents/24-dark.svg","light":"assets/subagents/24-light.svg"},{"dark":"assets/subagents/25-dark.svg","light":"assets/subagents/25-light.svg"}];
function agentAvatarIndex(seed,count=agentAvatarPalette.length){let n=0;for(let t=0;t<seed.length;t+=1)n=(n*31+seed.charCodeAt(t))%2147483647;return n%count;}
function agentAvatar(id){const pair=agentAvatarPalette[agentAvatarIndex(String(id))];return '<span class="agent-avatar" aria-hidden="true"><img class="agent-avatar-light" alt="" draggable="false" src="'+pair.light+'"/><img class="agent-avatar-dark" alt="" draggable="false" src="'+pair.dark+'"/></span>';}
function agentGroupIcon(){return "<svg class=\"icon\" viewBox=\"0 0 16 16\" width=\"16\" height=\"16\" fill=\"none\" aria-hidden=\"true\"><path d=\"M7.3335 4.82617C7.3335 5.37846 6.88578 5.82617 6.3335 5.82617C5.78121 5.82617 5.3335 5.37846 5.3335 4.82617C5.3335 4.27389 5.78121 3.82617 6.3335 3.82617C6.88578 3.82617 7.3335 4.27389 7.3335 4.82617Z\" fill=\"currentColor\"/> <path d=\"M10.6665 4.82617C10.6665 5.37846 10.2188 5.82617 9.6665 5.82617C9.11422 5.82617 8.6665 5.37846 8.6665 4.82617C8.6665 4.27389 9.11422 3.82617 9.6665 3.82617C10.2188 3.82617 10.6665 4.27389 10.6665 4.82617Z\" fill=\"currentColor\"/> <path d=\"M12.1416 4.27148C12.1416 3.90046 12.1411 3.65254 12.126 3.46191C12.1113 3.27711 12.0847 3.19065 12.0576 3.13574C11.9789 2.9763 11.8499 2.8472 11.6904 2.76855C11.6355 2.7415 11.5498 2.71586 11.3652 2.70117C11.1746 2.68603 10.9267 2.68555 10.5557 2.68555H5.44434C5.07327 2.68555 4.82539 2.68605 4.63477 2.70117C4.44996 2.71586 4.3635 2.74148 4.30859 2.76855C4.14916 2.84723 4.02008 2.97631 3.94141 3.13574C3.91433 3.19065 3.88871 3.27711 3.87402 3.46191C3.8589 3.65254 3.8584 3.90042 3.8584 4.27148C3.8584 5.00556 3.85829 5.52568 3.89062 5.93262C3.9225 6.33359 3.98329 6.58013 4.0791 6.77441C4.28764 7.19707 4.63003 7.53959 5.05273 7.74805C5.247 7.84376 5.49371 7.9037 5.89453 7.93555C6.30145 7.96785 6.82171 7.96875 7.55566 7.96875H8.44434C9.17841 7.96875 9.69853 7.96788 10.1055 7.93555C10.5064 7.90367 10.753 7.84386 10.9473 7.74805C11.37 7.53954 11.7124 7.19715 11.9209 6.77441C12.0167 6.58013 12.0765 6.33357 12.1084 5.93262C12.1407 5.52568 12.1416 5.00556 12.1416 4.27148ZM13.1914 4.27148C13.1914 4.98875 13.1917 5.55746 13.1553 6.01562C13.1184 6.47961 13.0414 6.87502 12.8623 7.23828C12.5516 7.86842 12.0413 8.3787 11.4111 8.68945C11.0479 8.86856 10.6525 8.94555 10.1885 8.98242C9.73031 9.01883 9.1616 9.01855 8.44434 9.01855H7.55566C6.8383 9.01855 6.26876 9.01883 5.81055 8.98242C5.34662 8.94553 4.95112 8.86858 4.58789 8.68945C3.95779 8.3787 3.44746 7.86839 3.13672 7.23828C2.95766 6.87505 2.88062 6.47957 2.84375 6.01562C2.80734 5.55745 2.80762 4.98875 2.80762 4.27148C2.80762 3.91701 2.80792 3.61985 2.82715 3.37793C2.84685 3.13033 2.88968 2.89564 3 2.67188C3.18093 2.30498 3.47783 2.00808 3.84473 1.82715C4.06849 1.71683 4.30318 1.674 4.55078 1.6543C4.7927 1.63507 5.08986 1.63477 5.44434 1.63477H10.5557C10.9099 1.63477 11.2064 1.63508 11.4482 1.6543C11.696 1.67399 11.9314 1.71674 12.1553 1.82715C12.522 2.0081 12.8191 2.30512 13 2.67188C13.1102 2.89557 13.1532 3.13041 13.1729 3.37793C13.1921 3.61985 13.1914 3.91701 13.1914 4.27148Z\" fill=\"currentColor\"/> <path d=\"M7.47461 1.88477V1.33398C7.47461 1.04403 7.71005 0.808594 8 0.808594C8.28995 0.808594 8.52539 1.04403 8.52539 1.33398V1.88477C8.52531 2.17464 8.2899 2.40918 8 2.40918C7.7101 2.40918 7.47469 2.17464 7.47461 1.88477Z\" fill=\"currentColor\"/> <path d=\"M7.99986 10.1309C10.4492 10.1309 12.535 11.6826 13.3309 13.8545C13.4305 14.1267 13.2906 14.4286 13.0184 14.5283C12.7463 14.6278 12.4443 14.4879 12.3446 14.2158C11.6954 12.4443 9.99461 11.1816 7.99986 11.1816C6.00516 11.1817 4.30429 12.4444 3.65513 14.2158C3.55532 14.4879 3.25345 14.628 2.9813 14.5283C2.70915 14.4286 2.56924 14.1267 2.6688 13.8545C3.46467 11.6827 5.55056 10.1309 7.99986 10.1309Z\" fill=\"currentColor\"/></svg>";}
function agentActionLabel(item) {
  // Action status and agent runtime status are independent (a finished wait is
  // not evidence that an agent finished). Shipped YE/ZE use this same split.
  const labels={spawnAgent:['正在创建','已创建','创建失败'],sendInput:['正在发送指令','已发送指令','发送失败'],sendMessage:['正在发送消息','已发送消息','发送失败'],followupTask:['正在发送指令','已发送指令','发送失败'],interruptAgent:['正在停止','已请求停止','停止失败'],resumeAgent:['正在恢复','已恢复','恢复失败'],closeAgent:['正在关闭','已关闭','关闭失败'],listAgents:['正在查看','已查看','查看失败']};
  if(item.status==='interrupted')return '操作已停止';
  return (labels[item.tool]||['正在协作','已协作','协作失败'])[item.status==='failed'?2:item.status==='completed'?1:0];
}
function renderAgentActivity(item,turn,parentId=turn?._agentParentId||state.activeThreadId) {
  if(item._agentActivityGroup){
    const group=item._agentActivityGroup,verb={active:'开始工作',updated:'已更新',completed:'已完成',interrupted:'已停止'}[group.status]||'已更新';
    const rows=group.rows.map(row=>{const label=agentAvatar(row.conversationId)+'<span class="agent-name">'+esc(row.displayName)+'</span>';return row.canOpen?'<button class="subagent-inline" data-open-subagent="'+esc(row.conversationId)+'" data-agent-parent="'+esc(parentId)+'" aria-label="查看 '+esc(row.displayName)+' 的执行过程">'+label+'</button>':'<span class="subagent-inline">'+label+'</span>';}).join('');
    return '<div class="subagent-activity subagent-inline-group" data-agent-item="'+esc(item.id)+'" data-agent-status="'+esc(group.status)+'">'+rows+'<span class="agent-state">'+esc(verb)+'</span></div>';
  }
  if(item.tool==='wait')return '';
  const actions=item._agentActions||[item];
  const refs=[...agentReferences([{id:turn?.id,items:actions}]).values()];
  if(item.type==='subAgentActivity') {
    const ref=refs[0];if(!ref)return '';
    if(item.kind==='interacted')return '<div class="subagent-message">'+ic('chat')+'<span>已发送消息给 '+esc(agentName(ref))+'</span></div>';
    const verb={started:'开始工作',completed:'已完成',interrupted:'已停止'}[item.kind]||'已更新';
    return '<div class="subagent-activity" data-agent-item="'+esc(item.id)+'"><button class="subagent-inline" data-open-subagent="'+esc(ref.id)+'" data-agent-parent="'+esc(parentId)+'" aria-label="查看 '+esc(agentName(ref))+' 的执行过程">'+agentAvatar(ref.id)+'<span class="agent-name">'+esc(agentName(ref))+'</span><span class="agent-state">'+esc(verb)+'</span></button></div>';
  }
  const key='agents:'+turn?.id+':'+item.id,open=isExpanded(key),label=agentActionLabel(item);
  const rows=refs.map(ref=>'<div class="agent-action-row"><button class="subagent-inline" data-open-subagent="'+esc(ref.id)+'" data-agent-parent="'+esc(parentId)+'">'+agentAvatar(ref.id)+'<span class="agent-name">'+esc(agentName(ref))+'</span></button><span class="agent-state">'+esc(agentStatus(ref))+'</span></div>'+(ref.objective?'<div class="agent-instructions">'+esc(ref.objective)+'</div>':'')).join('');
  return '<div class="subagent-activity agent-action-group'+(item.status==='inProgress'?' running':'')+'" data-agent-item="'+esc(item.id)+'"><button class="activity" data-toggle="'+esc(key)+'" aria-expanded="'+open+'">'+agentGroupIcon()+'<span class="act-label">'+esc(label+(refs.length?' '+refs.length+' 个智能体':''))+'</span>'+ic('chevronRight','chev')+'</button>'+(open?'<div class="agent-action-details">'+rows+'</div>':'')+'</div>';
}
function backgroundAgentMemberships(parentId=state.activeThreadId){
  const thread=state.thread?.id===parentId?state.thread:subagentViews.get(parentId)?.thread;
  if(!thread||thread.id!==parentId)return [];
  const parentTurnIds=new Set((thread.turns||[]).map(turn=>turn.id));
  return [...agentReferences(thread.turns,parentId).values()].map(ref=>{
    // A parent transcript reference proves the turn directly. Thread/source
    // ancestry proves only the conversation, never its latest/current turn.
    if(ref.parentTurnId)return {...ref,attribution:'parent-event'};
    const child=subagentViews.get(ref.id)?.thread||ref.thread;
    // Turn.rootTurnId is the only returned turn-lineage field. Match an exact
    // loaded parent turn ID, not shared root IDs, timestamps, or current turn.
    const latest=(child?.turns||[]).findLast(turn=>turn.inherited!==true);
    const linked=typeof latest?.rootTurnId==='string'&&parentTurnIds.has(latest.rootTurnId);
    return {...ref,parentTurnId:linked?latest.rootTurnId:undefined,attribution:linked?'root-turn-lineage':null};
  });
}
function backgroundAgentRow(ref,parentTurnKey=null){
  return {conversationId:ref.id,parentTurnKey,displayName:globalThis.nativeTranscript?.agentName(ref.path)||agentName(ref),status:['completed','idle','interrupted','errored','shutdown'].includes(agentRuntimeStatus(ref))?'done':['running','pendingInit'].includes(agentRuntimeStatus(ref))?'active':'unknown'};
}
function transcriptBackgroundAgents(turn){
  const parentId=turn?._agentParentId||state.activeThreadId;
  return backgroundAgentMemberships(parentId).filter(ref=>ref.parentTurnId===turn.id).map(ref=>backgroundAgentRow(ref,turn.id)).filter(row=>row.status!=='unknown');
}
function transcriptUnassignedBackgroundAgents(parentId=state.activeThreadId){
  return backgroundAgentMemberships(parentId).filter(ref=>!ref.parentTurnId).map(ref=>backgroundAgentRow(ref));
}
function renderUnassignedBackgroundAgents(parentId=state.activeThreadId){
  // Membership alone does not prove current work. Unknown historical agents
  // remain accessible in the launcher, without a permanent transcript footer.
  const rows=transcriptUnassignedBackgroundAgents(parentId).filter(row=>row.status==='active');
  if(!rows.length)return '';
  return '<section class="subagent-unassigned-activities" data-flow-key="'+esc('unassigned-agents:'+parentId)+'" aria-label="后台代理，回合归属待确认"><div class="subagent-unassigned-heading">后台代理 · 回合归属待确认</div>'+rows.map(row=>'<div class="subagent-activity"><button class="subagent-inline" data-open-subagent="'+esc(row.conversationId)+'" data-agent-parent="'+esc(parentId)+'" aria-label="查看 '+esc(row.displayName)+' 的执行过程">'+agentAvatar(row.conversationId)+'<span class="agent-name">'+esc(row.displayName)+'</span></button><span class="agent-state">'+(row.status==='active'?'正在工作':'状态待同步')+'</span></div>').join('')+'</section>';
}
function scheduleSubagentTranscript(id){
  if(typeof scheduleTranscript==='function'&&backgroundAgentMemberships(state.activeThreadId).some(ref=>ref.id===id))scheduleTranscript();
}
function subagentParent(tab) {
  return tab?.parentThreadId===state.thread?.id?state.thread:subagentViews.get(tab?.parentThreadId)?.thread||tab?.parentThread;
}
function renderSubagentLauncher() {
  const anchor=document.getElementById('head-summary');if(!anchor)return;
  let button=document.getElementById('head-subagents');
  if(!button){button=document.createElement('button');button.id='head-subagents';button.className='icon-btn';button.onclick=()=>openSubagentPanel();anchor.before(button);}
  const agents=agentReferences(state.thread?.turns,state.activeThreadId);if(button.hidden!==!agents.size)button.hidden=!agents.size;if(button.dataset.agentCount!==String(agents.size)){button.dataset.agentCount=String(agents.size);button.title='查看子智能体';button.setAttribute('aria-label','查看子智能体');button.innerHTML=agentGroupIcon()+'<span>'+agents.size+'</span>';}
  if(state.thread?.id&&!state.loadingThread)agentTopology?.discover(state.thread.id);
  const tab=selectedAgentTab();if(tab&&state.thread&&tab.parentThreadId===state.thread.id){const stamp=JSON.stringify([...agents.values()].map(a=>[a.id,agentRuntimeStatus(a),a.path,a.objective]));if(tab.statusStamp!==stamp){tab.statusStamp=stamp;queueMicrotask(()=>{if(selectedAgentTab()===tab)renderSubagentsPanel(tab);});}}
}
function openSubagentPanel(id,parentId=state.activeThreadId) {
  const parent=parentId===state.thread?.id?state.thread:subagentViews.get(parentId)?.thread;if(!parent)return;
  if(id&&!agentReferences(parent.turns,parentId).has(id)){toast('此子智能体不属于当前对话');return;}
  agentTopology?.discover(parentId,{force:true});
  toggleBrowserPanel(true,{createInitial:false});
  let tab=state.browserTabs.find(t=>t.kind==='agents'&&t.parentThreadId===parentId);
  if(!tab){tab={id:'workspace-agents-'+crypto.randomUUID(),kind:'agents',title:'子智能体',url:'about:blank',parentThreadId:parentId,ephemeral:true};state.browserTabs.push(tab);}
  tab.parentThread=parent;tab.agentId=id||null;activateBrowserTab(tab.id);if(id)loadSubagent(id,true);
}
function selectedAgentTab() {const tab=browserActiveTab();return state.browserOpen&&tab?.kind==='agents'?tab:null;}
function renderSubagentTurn(turn,threadId) {
  const scoped={...turn,_agentParentId:threadId};let segment=[],index=0,html='';
  const scope=`${state.thread?.id||state.activeThreadId||''}:${turn.id}`;
  const flush=()=>{if(segment.length)html+=renderAssistantSegment(segment,scoped,index++);segment=[];};
  globalThis.nativeTranscript?.beginRender?.(scope);
  try{
    for(const item of turn.items||[]){if(['userMessage','steeringUserMessage'].includes(item.type)){flush();html+=renderUserMessage(item,scoped);}else segment.push(item);}flush();
    if(shouldShowThinking(scoped,null))html+=renderThinking(scoped);
  }finally{globalThis.nativeTranscript?.endRender?.(scope);}
  return '<section class="subagent-turn" data-agent-turn="'+esc(turn.id)+'">'+html+(turn.error?'<p role="alert">'+esc(turn.error.message||'任务未完成')+'</p>':'')+'</section>';
}
function renderSubagentComposer(ref,view) {
  const running=agentRuntimeStatus(ref)==='running',draft=view?.draft||'',model=ref.model||view?.model||'';
  return '<div class="subagent-compose"><div class="composer agent-composer"><textarea data-agent-followup placeholder="添加消息…" rows="2">'+esc(draft)+'</textarea><div class="composer-bar"><span class="agent-composer-model">'+esc(model)+'</span><button class="send-btn" data-agent-send aria-label="发送"'+(view?.sending||!draft.trim()?' disabled':'')+'>'+ic('send')+'</button><button class="send-btn'+(!running?' hidden':'')+'" data-agent-interrupt aria-label="停止"'+(!running?' disabled':'')+'>'+ic('stop')+'</button></div></div>'+(view?.notice?'<p role="status">'+esc(view.notice)+'</p>':'')+'</div>';
}
function renderSubagentsPanel(tab) {
  if(!tab||tab.kind!=='agents')return;
  const parent=subagentParent(tab),agents=agentReferences(parent?.turns,tab.parentThreadId),ref=agents.get(tab.agentId),view=ref&&subagentViews.get(ref.id),host=els.browserHost,old=host.querySelector('.subagent-conversation'),top=old?.scrollTop||0,atBottom=!old||old.scrollHeight-old.scrollTop-old.clientHeight<32;
  let html='<div class="subagent-pane">'+(ref?'<header class="subagent-header"><button class="icon-btn" data-agent-back aria-label="返回子智能体列表">'+ic('back')+'</button>'+(ref?agentAvatar(ref.id):'')+'<strong>'+esc(ref?agentName(ref):'子智能体')+'</strong><span>'+esc(ref?(ref.model||view?.model||''):'')+'</span></header>':'');
  if(!ref) {
    const rows=[...agents.values()],terminal=new Set(['idle','completed','interrupted','errored','shutdown','notFound']);
    const renderSection=(kind,label,list,limit)=>{
      if(kind==='done'&&!list.length)return '';
      const key='agent-list:'+tab.parentThreadId+':'+kind,visible=isExpanded(key)?list:list.slice(0,limit);
      return '<section class="agent-list-section"><h2>'+label+' · '+list.length+'</h2>'+visible.map(a=>'<button class="agent-list-row" data-open-subagent="'+esc(a.id)+'" data-agent-parent="'+esc(tab.parentThreadId)+'">'+agentAvatar(a.id)+'<span class="agent-list-copy"><strong>'+esc(agentName(a))+'</strong>'+(a.objective?'<small>'+esc(a.objective)+'</small>':'')+'</span><span class="agent-state">'+esc(agentStatus(a))+'</span></button>').join('')+(!list.length?'<p class="agent-empty">暂无正在运行的子智能体</p>':'')+(list.length>visible.length?'<button class="agent-list-more" data-agent-list-more="'+esc(key)+'">显示其余 '+(list.length-visible.length)+' 个</button>':'')+'</section>';
    };
    html+='<div class="subagent-list">'+renderSection('active','正在运行',rows.filter(a=>!terminal.has(agentRuntimeStatus(a))),4)+renderSection('done','已结束',rows.filter(a=>terminal.has(agentRuntimeStatus(a))),10)+'</div>';
  } else {
    html+='<div class="subagent-conversation" aria-label="子智能体执行过程"><p class="subagent-status sr-only" role="status" data-agent-runtime="'+esc(agentRuntimeStatus(ref)||'unknown')+'">'+esc(agentStatus(ref))+'</p>'+(view?.error?'<p class="agent-load-error" role="alert">'+esc(view.error)+'</p>':'');
    if(view?.thread?.turns?.length)html+=view.thread.turns.map(turn=>renderSubagentTurn(turn,ref.id)).join('');
    else if(!view?.error)html+='<p class="agent-empty" role="status">'+(view?.pending?'正在读取执行过程…':'尚无执行记录')+'</p>';
    html+='</div>'+(ref.canInteract?renderSubagentComposer(ref,view):'');
  }
  host.innerHTML=html+'</div>';
  if(host.querySelector('[data-agent-back]'))host.querySelector('[data-agent-back]').onclick=()=>{tab.agentId=null;renderSubagentsPanel(tab);};
  host.querySelectorAll('[data-agent-list-more]').forEach(button=>button.onclick=()=>{state.expanded.add(button.dataset.agentListMore);renderSubagentsPanel(tab);});
  if(ref){if(ref.canInteract){const box=host.querySelector('[data-agent-followup]');box.oninput=()=>{const data=subagentViews.get(ref.id);if(data)data.draft=box.value;host.querySelector('[data-agent-send]').disabled=!box.value.trim()||!!data?.sending;};host.querySelector('[data-agent-send]').onclick=()=>sendSubagentFollowup(ref.id);host.querySelector('[data-agent-interrupt]').onclick=()=>interruptSubagent(ref.id);}const scroll=host.querySelector('.subagent-conversation');scroll.scrollTop=atBottom?scroll.scrollHeight:top;if(!view)loadSubagent(ref.id);}
}
function mergeSubagentTurns(history,live) {
  const byId=new Map((history||[]).map(turn=>[turn.id,turn]));
  for(const turn of live||[])byId.set(turn.id,typeof mergeTurn==='function'?mergeTurn(byId.get(turn.id),turn):{...byId.get(turn.id),...turn});
  return [...byId.values()];
}
async function loadSubagent(id,force=false) {
  let view=subagentViews.get(id);if(view?.request)return view.request;if(view?.loaded&&!force)return view;
  view=view||{thread:{id,turns:[]},revision:0};subagentViews.set(id,view);view.pending=true;
  const revision=view.revision,statusRevision=view.statusRevision||0;
  const request=(async()=>{try{
    const [meta,page]=await Promise.all([api.call('thread/read',{threadId:id,includeTurns:false}),api.call('thread/turns/list',{threadId:id,limit:10,sortDirection:'desc',itemsView:'full'})]);

    // Only merge notifications arriving during this read; old cached inProgress
    // records must never override the authoritative completed history snapshot.
    const live=view.revision!==revision?view.thread.turns:[];
    const liveStatus=(view.statusRevision||0)!==statusRevision?view.thread.status:null;
    view.thread={...meta.thread,...(liveStatus?{status:liveStatus}:{}),turns:mergeSubagentTurns((page.data||[]).slice().reverse(),live)};agentTopology?.observe?.(view.thread);view.model=meta.model;view.error='';view.loaded=true;
  }catch(error){view.error=shortError(error.message);}finally{view.pending=false;view.request=null;view.syncedAt=Date.now();scheduleSubagentTranscript(id);const tab=selectedAgentTab();if(tab&&(tab.agentId===id||!tab.agentId)&&!document.activeElement?.matches('[data-agent-followup]'))renderSubagentsPanel(tab);}return view;})();
  view.request=request;return request;
}
function updateSubagentView(view,method,params) {
  if(!view?.thread)return false;
  if(method==='thread/status/changed'){view.thread.status=params.status;view.statusRevision=(view.statusRevision||0)+1;view.revision=(view.revision||0)+1;return true;}
  if(!['turn/started','turn/completed','item/started','item/completed','item/agentMessage/delta','item/plan/delta','item/commandExecution/outputDelta','item/mcpToolCall/progress','item/reasoning/summaryTextDelta','item/reasoning/textDelta'].includes(method))return false;
  const turnId=params.turnId||params.turn?.id;
  if(!turnId)return false;
  let turn=view.thread.turns.find(t=>t.id===turnId);
  if(method==='turn/started'||method==='turn/completed') {
    if(!params.turn)return false;
    const next=globalThis.streamState?.mergeTurn?streamState.mergeTurn(turn,params.turn,{source:method==='turn/completed'?'completion':'history'}):typeof mergeTurn==='function'?mergeTurn(turn,params.turn):{...turn,...params.turn};
    if(turn)view.thread.turns[view.thread.turns.indexOf(turn)]=next;else view.thread.turns.push(next);
    view.thread.status={type:view.thread.turns.some(t=>t.status==='inProgress')?'active':'idle'};
    view.statusRevision=(view.statusRevision||0)+1;
  } else {
    if(!turn){turn={id:turnId,status:'inProgress',items:[]};view.thread.turns.push(turn);}
    if((method==='item/started'||method==='item/completed')&&params.item){const at=turn.items.findIndex(i=>i.id===params.item.id);if(at<0)turn.items.push(params.item);else turn.items[at]=globalThis.streamState?.mergeItem?streamState.mergeItem(turn.items[at],params.item,{source:method==='item/completed'?'completion':'history'}):{...turn.items[at],...params.item};}
    else {
      const item=turn.items.find(i=>i.id===params.itemId);
      if(!item)return false;
      if(method==='item/agentMessage/delta'||method==='item/plan/delta')item.text=(item.text||'')+(params.delta||'');
      else if(method==='item/commandExecution/outputDelta')item.aggregatedOutput=(item.aggregatedOutput||'')+(params.delta||params.chunk||'');
      else if(method==='item/mcpToolCall/progress')item.progressMessage=params.message;
      else if(method==='item/reasoning/summaryTextDelta'){item.summary||=[];const index=params.summaryIndex??0;item.summary[index]=(item.summary[index]||'')+(params.delta||'');}
      else if(method==='item/reasoning/textDelta'){item.content||=[];const index=params.contentIndex??0;item.content[index]=(item.content[index]||'')+(params.delta||'');}
      else return false;
    }
  }
  view.revision=(view.revision||0)+1;return true;
}
function interactiveSubagent(id) {
  const tab=selectedAgentTab();return tab?.agentId===id&&agentReferences(subagentParent(tab)?.turns).get(id)?.canInteract===true;
}
function stopSubagentDescendants(parentId){return agentTopology?.stop(parentId,new Map([...subagentViews].map(([id,view])=>[id,view.thread])))||Promise.resolve();}
async function sendSubagentFollowup(id) {
  const view=subagentViews.get(id);if(!interactiveSubagent(id)||!view?.draft?.trim()||view.sending)return;
  view.sending=true;view.notice='正在发送…';const text=view.draft;
  try{const turn=view.thread.turns.findLast(t=>t.status==='inProgress'),params={threadId:id,input:[{type:'text',text,text_elements:[]}],_raeRequestId:crypto.randomUUID()};await api.call(turn?'turn/steer':'turn/start',turn?{...params,expectedTurnId:turn.id}:params);if(view.draft===text)view.draft='';view.notice='指令已发送';await loadSubagent(id,true);}catch(error){view.notice=shortError(error.message);}finally{view.sending=false;const tab=selectedAgentTab();if(tab?.agentId===id)renderSubagentsPanel(tab);}
}
async function interruptSubagent(id) {
  if(!interactiveSubagent(id))return;
  const view=subagentViews.get(id),turn=view?.thread?.turns.findLast(t=>t.status==='inProgress');if(!turn)return;
  try{await api.call('turn/interrupt',{threadId:id,turnId:turn.id});view.notice='已请求停止，等待确认';await loadSubagent(id,true);}catch(error){view.notice=shortError(error.message);}const tab=selectedAgentTab();if(tab?.agentId===id)renderSubagentsPanel(tab);
}
document.addEventListener('click',event=>{const button=event.target.closest('[data-open-subagent]');if(button){event.preventDefault();const tab=selectedAgentTab();openSubagentPanel(button.dataset.openSubagent,button.dataset.agentParent||tab?.agentId||state.activeThreadId);}});
api.onNotification(({method,params})=>{
  let view=subagentViews.get(params?.threadId);
  if(!view&&params?.threadId){const ref=agentReferences(state.thread?.turns,state.activeThreadId).get(params.threadId);if(ref){view={thread:{...ref.thread,id:ref.id,turns:ref.thread?.turns||[]},revision:0};subagentViews.set(ref.id,view);}}
  if(!updateSubagentView(view,method,params))return;
  agentTopology?.observe?.(view.thread);
  scheduleSubagentTranscript(params.threadId);
  const tab=selectedAgentTab();if(tab&&!subagentPaintTimer)subagentPaintTimer=setTimeout(()=>{subagentPaintTimer=null;const active=selectedAgentTab();if(active&&!document.activeElement?.matches('[data-agent-followup]'))renderSubagentsPanel(active);},40);
});
setInterval(()=>{const tab=selectedAgentTab();if(document.visibilityState==='visible'&&tab?.agentId){const view=subagentViews.get(tab.agentId);const ref=agentReferences(subagentParent(tab)?.turns).get(tab.agentId);if(!document.activeElement?.matches('[data-agent-followup]')&&(!view?.loaded||ref?.status==='running'||view.thread?.status?.type==='active'||view.thread?.turns?.some(t=>t.status==='inProgress')))loadSubagent(tab.agentId,true);}},3000);

// Hydrate background status even when no agent details tab has been opened.
let backgroundAgentRefreshPending=false;
async function refreshBackgroundAgentStatuses(){
 if(backgroundAgentRefreshPending||document.visibilityState!=='visible'||!state.thread?.id||state.loadingThread)return;
 backgroundAgentRefreshPending=true;const parentId=state.thread.id;
 try{await agentTopology?.discover?.(parentId);if(state.thread?.id!==parentId)return;const refs=[...agentReferences(state.thread.turns,parentId).values()].filter(ref=>{const view=subagentViews.get(ref.id);return !['completed','idle','interrupted','errored','shutdown'].includes(agentRuntimeStatus(ref))&&!view?.pending&&Date.now()-(view?.syncedAt||0)>=10000;}).sort((a,b)=>(subagentViews.get(a.id)?.syncedAt||0)-(subagentViews.get(b.id)?.syncedAt||0));await Promise.all(refs.slice(0,2).map(ref=>loadSubagent(ref.id,true)));}finally{backgroundAgentRefreshPending=false;}
}
setInterval(()=>{void refreshBackgroundAgentStatuses();},10000);
