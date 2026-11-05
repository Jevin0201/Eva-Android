'use strict';
// Android presentation adapter for Eva 0.2.0 subagents.js. The kernel owns spawn,
// scheduling, inherited permissions and completion; this file never simulates them.
window.mobileSubagents=(()=>{
 const children=new Map(),boundary=streamState.createBoundary();let shown=null,refreshTimer=null;
 const labels={pendingInit:'正在启动',running:'正在工作',idle:'已结束',completed:'已完成',interrupted:'已停止',errored:'发生错误',shutdown:'已关闭',notFound:'暂不可用'};
 function receiverIds(item){return [...new Set([...(item.receiverThreadIds||[]),...(item.receiverThreads||[]).map(r=>r.threadId),...Object.keys(item.agentsStates||{})])].filter(id=>typeof id==='string'&&id);}
 function references(turns){const agents=new Map();for(const turn of turns||[])for(const item of turn.items||[]){
  if(item.type==='subAgentActivity'&&item.agentThreadId){const old=agents.get(item.agentThreadId)||{};agents.set(item.agentThreadId,{...old,id:item.agentThreadId,path:item.agentPath,model:item.model??old.model,status:item.kind==='interacted'?old.status:({started:'running',completed:'completed',interrupted:'interrupted'}[item.kind]||old.status),parentTurnId:turn.id});}
  else if(item.type==='collabAgentToolCall')for(const id of receiverIds(item)){const old=agents.get(id)||{};agents.set(id,{...old,id,objective:item.prompt?.trim()||old.objective,model:item.model||old.model,status:item.agentsStates?.[id]?.status||old.status,message:item.agentsStates?.[id]?.message??old.message,parentTurnId:turn.id});}
 }return agents;}
 const parent=id=>data.chats.find(c=>c.kernelThread?.id===id)?.kernelThread||children.get(id)?.kernelThread;
 function membership(childId){for(const c of data.chats){const ref=references(c.kernelThread?.turns).get(childId);if(ref)return {parent:c.kernelThread,ref};}for(const c of children.values()){const ref=references(c.kernelThread.turns).get(childId);if(ref)return {parent:c.kernelThread,ref};}return null;}
 const name=ref=>ref.path?.split('/').filter(Boolean).at(-1)||children.get(ref.id)?.kernelThread?.agentNickname||'子智能体';
 function item(value){if(!['collabAgentToolCall','subAgentActivity'].includes(value.type))return null;const refs=[...references([{id:'item',items:[value]}]).values()];const action=value.type==='subAgentActivity'?({started:'开始工作',completed:'已完成',interrupted:'已停止',interacted:'已发送消息'}[value.kind]||'状态更新'):({spawnAgent:'创建子智能体',wait:'等待子智能体',sendInput:'发送补充要求',closeAgent:'关闭子智能体',resumeAgent:'恢复子智能体'}[value.tool]||'子智能体协作');const failed=value.status==='failed'||value.status==='interrupted';return `<div class="tool-item mobile-subagent-item ${failed?'tool-failed':''}" data-agent-kind="${esc(value.kind||value.tool||'')}"><strong>${esc(action)}</strong>${refs.map(ref=>`<div class="mobile-subagent-row"><button data-open-mobile-agent="${esc(ref.id)}">${icon('chat')}<span>${esc(name(ref))}</span></button><small>${esc(labels[ref.status]||'状态待同步')}</small></div>`).join('')}${value.prompt?`<p class="panel-muted">${esc(value.prompt)}</p>`:''}${value.error?`<p role="alert">${esc(value.error.message||value.error)}</p>`:''}</div>`;}
 function panel(){const host=document.querySelector('[data-mobile-agent-panel]');if(!host||!shown)return;const selected=shown,member=membership(selected.id);if(!member){host.innerHTML='<p role="alert">子智能体不属于已加载的对话。</p>';return;}const cached=children.get(selected.id)?.kernelThread;const turns=cached?.turns||[];host.innerHTML=`<p class="panel-muted">${esc(name(member.ref))} · ${esc(labels[member.ref.status]||'状态待同步')}<br>在主对话中补充要求，子智能体沿用主任务的权限。</p><button data-refresh-mobile-agent>刷新执行过程</button><div class="mobile-subagent-transcript">${turns.length?turns.map(t=>mobileFlow.turn(projectKernelTurn(t))).join(''):'<p class="panel-muted">正在读取子智能体执行过程…</p>'}</div>${selected.error?`<p role="alert">${esc(selected.error)}</p>`:''}`;host.querySelector('[data-refresh-mobile-agent]').onclick=()=>refresh(selected);}
 async function refresh(selected){if(selected.loading)return;selected.loading=true;try{const result=await kernelCall('thread/read',{threadId:selected.id,includeTurns:true});if(shown!==selected)return;if(result.thread?.id!==selected.id)throw Error('内核返回了不同的子智能体');const old=children.get(selected.id)?.kernelThread;const thread=result.thread;thread.turns=(thread.turns||[]).map(t=>{const before=old?.turns?.find(x=>x.id===t.id);return before?streamState.mergeTurn(before,t,{source:'history',order:'existing'}):t});children.set(selected.id,{kernelThread:thread});selected.error='';}catch(e){if(shown===selected)selected.error=e.message;}finally{selected.loading=false;if(shown===selected)panel();}}
 function open(id){const member=membership(id);if(!member)return;shown={id,parentId:member.parent.id,error:'',loading:false};const host=modelPanel('子智能体执行过程');host.dataset.mobileAgentPanel='';panel();refresh(shown);}
 function schedulePanel(){if(refreshTimer)return;refreshTimer=setTimeout(()=>{refreshTimer=null;panel();},80);}
 function event(e){const p=e.params||{};if(e.method==='thread/started'&&p.thread?.id&&membership(p.thread.id)){const id=p.thread.id;if(!children.has(id))children.set(id,{kernelThread:{...p.thread,turns:p.thread.turns||[]}});}
  const id=p.threadId;if(typeof id!=='string'||!id||data.chats.some(c=>c.kernelThread?.id===id)||!membership(id))return;
  let c=children.get(id);if(!c){c={kernelThread:{id,turns:[]}};children.set(id,c);}let turn=c.kernelThread.turns.find(t=>t.id===(p.turnId||p.turn?.id));
  if(e.method==='turn/started'||e.method==='turn/completed'){if(p.turn)mergeKernelTurn(c,p.turn,e.method==='turn/completed'?'completion':'history');}
  else if(p.item){if(!turn){turn={id:p.turnId,status:'inProgress',items:[]};c.kernelThread.turns.push(turn);}const at=turn.items.findIndex(i=>i.id===p.item.id),value=streamState.mergeItem(at<0?undefined:turn.items[at],p.item,{source:e.method==='item/completed'?'completion':'history'});boundary.attach(p,value);at<0?turn.items.push(value):turn.items[at]=value;}
  else boundary.delta(e.method,p,turn?.items?.find(i=>i.id===p.itemId));if(shown?.id===id)schedulePanel();
 }
 const originalEvent=kernelEvent;kernelEvent=function(e){const result=originalEvent(e);event(e);if(shown&&membership(shown.id))schedulePanel();return result;};
 document.addEventListener('click',e=>{const button=e.target.closest('[data-open-mobile-agent]');if(button)open(button.dataset.openMobileAgent);});
 return {item,references,open};
})();

// Desktop subagents.js presentation, with Android's existing membership and RPC store.
window.EvaDesktopSubagents={create({state,renderer}){
 const {esc,ic,patchTranscriptDOM,renderUserMessage,renderAssistantSegment,shouldShowThinking,renderThinking}=renderer;
 const subagentViews=new Map(),els={};let tab=null,timer=null;
 const isExpanded=id=>state.expanded.has(id);
 const agentReferences=turns=>mobileSubagents.references(turns);
 const agentName=ref=>ref.path?.split('/').filter(Boolean).at(-1)||ref.thread?.agentNickname||'子智能体';
 const agentRuntimeStatus=ref=>subagentViews.get(ref.id)?.thread?.status?.type==='active'?'running':ref.status;
 const agentStatus=ref=>({running:'正在工作',completed:'已完成',idle:'已结束',errored:'发生错误',interrupted:'已停止'}[agentRuntimeStatus(ref)]||'状态待同步');
 const subagentParent=tab=>data.chats.find(c=>c.kernelThread?.id===tab.parentThreadId)?.kernelThread;
 const renderSubagentComposer=()=>'';
 async function loadSubagent(id){
  if(!tab||tab.agentId!==id)return;
  const view=subagentViews.get(id)||{};if(view.pending)return;view.pending=true;subagentViews.set(id,view);
  try{const r=await kernelCall('thread/read',{threadId:id,includeTurns:true});if(r.thread?.id!==id)throw Error('子智能体记录不匹配');view.thread=window.evaKernelHistory?.mergeThread({kernelThread:view.thread},r.thread)||r.thread;view.error='';}
  catch(e){view.error=e.message;}finally{view.pending=false;if(tab?.agentId===id)renderSubagentsPanel(tab);}
 }
const agentAvatarPalette=[{"dark":"desktop-stream/subagents/00-dark.svg","light":"desktop-stream/subagents/00-light.svg"},{"dark":"desktop-stream/subagents/01-dark.svg","light":"desktop-stream/subagents/01-light.svg"},{"dark":"desktop-stream/subagents/02-dark.svg","light":"desktop-stream/subagents/02-light.svg"},{"dark":"desktop-stream/subagents/03-dark.svg","light":"desktop-stream/subagents/03-light.svg"},{"dark":"desktop-stream/subagents/04-dark.svg","light":"desktop-stream/subagents/04-light.svg"},{"dark":"desktop-stream/subagents/05-dark.svg","light":"desktop-stream/subagents/05-light.svg"},{"dark":"desktop-stream/subagents/06-dark.svg","light":"desktop-stream/subagents/06-light.svg"},{"dark":"desktop-stream/subagents/07-dark.svg","light":"desktop-stream/subagents/07-light.svg"},{"dark":"desktop-stream/subagents/08-dark.svg","light":"desktop-stream/subagents/08-light.svg"},{"dark":"desktop-stream/subagents/09-dark.svg","light":"desktop-stream/subagents/09-light.svg"},{"dark":"desktop-stream/subagents/10-dark.svg","light":"desktop-stream/subagents/10-light.svg"},{"dark":"desktop-stream/subagents/11-dark.svg","light":"desktop-stream/subagents/11-light.svg"},{"dark":"desktop-stream/subagents/12-dark.svg","light":"desktop-stream/subagents/12-light.svg"},{"dark":"desktop-stream/subagents/13-dark.svg","light":"desktop-stream/subagents/13-light.svg"},{"dark":"desktop-stream/subagents/14-dark.svg","light":"desktop-stream/subagents/14-light.svg"},{"dark":"desktop-stream/subagents/15-dark.svg","light":"desktop-stream/subagents/15-light.svg"},{"dark":"desktop-stream/subagents/16-dark.svg","light":"desktop-stream/subagents/16-light.svg"},{"dark":"desktop-stream/subagents/17-dark.svg","light":"desktop-stream/subagents/17-light.svg"},{"dark":"desktop-stream/subagents/18-dark.svg","light":"desktop-stream/subagents/18-light.svg"},{"dark":"desktop-stream/subagents/19-dark.svg","light":"desktop-stream/subagents/19-light.svg"},{"dark":"desktop-stream/subagents/20-dark.svg","light":"desktop-stream/subagents/20-light.svg"},{"dark":"desktop-stream/subagents/21-dark.svg","light":"desktop-stream/subagents/21-light.svg"},{"dark":"desktop-stream/subagents/22-dark.svg","light":"desktop-stream/subagents/22-light.svg"},{"dark":"desktop-stream/subagents/23-dark.svg","light":"desktop-stream/subagents/23-light.svg"},{"dark":"desktop-stream/subagents/24-dark.svg","light":"desktop-stream/subagents/24-light.svg"},{"dark":"desktop-stream/subagents/25-dark.svg","light":"desktop-stream/subagents/25-light.svg"}];
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
function renderSubagentTurn(turn,threadId) {
  const scoped={...turn,_agentParentId:threadId,_agentCwd:subagentViews.get(threadId)?.thread?.cwd};let segment=[],index=0,html='';
  const scope=`${threadId}:${turn.id}`;
  const flush=()=>{if(segment.length)html+=renderAssistantSegment(segment,scoped,index++);segment=[];};
  globalThis.nativeTranscript?.beginRender?.(scope);
  try{
    for(const item of turn.items||[]){if(['userMessage','steeringUserMessage'].includes(item.type)){flush();html+=renderUserMessage(item,scoped);}else segment.push(item);}flush();
    if(shouldShowThinking(scoped,null))html+=renderThinking(scoped);
  }finally{globalThis.nativeTranscript?.endRender?.(scope);}
  return '<section class="subagent-turn" data-agent-turn="'+esc(turn.id)+'">'+((turn.androidSummary||turn.androidItemsCursor)?'<button class="load-older" data-agent-details="'+esc(turn.id)+'">查看执行详情</button>':'')+html+(turn.error?'<p role="alert">'+esc(turn.error.message||'任务未完成')+'</p>':'')+'</section>';
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
  // Native message HTML contains mount points, not rendered message text.
  // Reconcile and hydrate the child pane just like the main transcript; plain
  // innerHTML left final answers empty and recreated mounted roots on updates.
  const panelKey='subagents:'+tab.parentThreadId+':'+(ref?.id||'list');
  if(typeof patchTranscriptDOM==='function')patchTranscriptDOM(host,html+'</div>',panelKey);
  else {
    host.innerHTML=html+'</div>';
    globalThis.nativeImagePreviewHost?.hydrate(host);
    globalThis.nativeSteeringHost?.hydrate(host);
    globalThis.activityDisclosure?.hydrate(host);
    globalThis.workTimer?.refresh();
  }
  if(host.querySelector('[data-agent-back]'))host.querySelector('[data-agent-back]').onclick=()=>{tab.agentId=null;renderSubagentsPanel(tab);};
  host.querySelectorAll('[data-agent-list-more]').forEach(button=>button.onclick=()=>{state.expanded.add(button.dataset.agentListMore);renderSubagentsPanel(tab);});
  if(ref){if(ref.canInteract){const box=host.querySelector('[data-agent-followup]');box.oninput=()=>{const data=subagentViews.get(ref.id);if(data)data.draft=box.value;host.querySelector('[data-agent-send]').disabled=!box.value.trim()||!!data?.sending;};host.querySelector('[data-agent-send]').onclick=()=>sendSubagentFollowup(ref.id);host.querySelector('[data-agent-interrupt]').onclick=()=>interruptSubagent(ref.id);}const scroll=host.querySelector('.subagent-conversation');scroll.scrollTop=atBottom?scroll.scrollHeight:top;if(!view)loadSubagent(ref.id);}
}

 async function loadDetails(turnId){
  const selected=tab?.agentId,view=subagentViews.get(selected),turn=view?.thread?.turns?.find(t=>t.id===turnId);if(!turn||turn.detailsPending)return;
  turn.detailsPending=true;
  try{const r=await kernelCall('thread/items/list',{threadId:selected,turnId,limit:20,sortDirection:'desc',...(turn.androidItemsCursor?{cursor:turn.androidItemsCursor}:{})});
   if(!Array.isArray(r.data)||r.data.some(e=>e.turnId!==turnId||!e.item?.id))throw Error('执行详情返回了不匹配的记录');
   const incoming=r.data.map(e=>e.item).reverse(),byId=new Map(incoming.map(e=>[e.id,e]));
   const existing=(turn.items||[]).filter(e=>!byId.has(e.id));turn.items=[...existing.filter(e=>e.type==='userMessage'),...incoming,...existing.filter(e=>e.type!=='userMessage')];
   turn.androidItemsCursor=r.nextCursor??null;turn.androidSummary=false;
  }catch(e){view.error=e.message;}finally{turn.detailsPending=false;if(tab?.agentId===selected)renderSubagentsPanel(tab);}
 }
 function close(){clearInterval(timer);timer=null;els.browserHost?.parentElement.remove();tab=null;}
 function open(id){const parent=active()?.kernelThread;if(!parent||!agentReferences(parent.turns).has(id))return;
  if(!tab){const shell=document.createElement('aside');shell.className='desktop-agent-panel desktop-stream-host';shell.setAttribute('aria-label','子智能体面板');shell.innerHTML='<button data-agent-panel-close aria-label="关闭子智能体面板">关闭</button><div class="desktop-agent-body"></div>';document.querySelector('#phone').append(shell);els.browserHost=shell.querySelector('.desktop-agent-body');shell.querySelector('[data-agent-panel-close]').onclick=close;
   shell.addEventListener('click',event=>{const details=event.target.closest('[data-agent-details]');if(details){loadDetails(details.dataset.agentDetails);return;}const target=event.target.closest('[data-open-subagent],[data-toggle]');if(!target)return;if(target.dataset.openSubagent){open(target.dataset.openSubagent);return;}const key=target.dataset.toggle;renderer.setExpanded(key,!isExpanded(key));renderSubagentsPanel(tab);});
   timer=setInterval(()=>{if(tab?.agentId)loadSubagent(tab.agentId);},1500);
  }
  tab={kind:'agents',agentId:id,parentThreadId:parent.id};renderSubagentsPanel(tab);loadSubagent(id);
 }
 document.addEventListener('click',event=>{const button=event.target.closest('[data-open-subagent]');if(button&&!button.closest('.desktop-agent-panel'))open(button.dataset.openSubagent);});
 const back=window.evaBack;window.evaBack=()=>{if(tab){close();return true;}return back?.()||false;};
 return {renderAgentActivity,open,close};
}};
