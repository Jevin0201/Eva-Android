/* Eva transport-shape adapter for REA's retained transcript functions. */
(() => {
  const core=globalThis.EvaNativeTranscriptCore;
  if(!core)throw Error('REA transcript declarations must load before their host adapter');
  const types={agentMessage:'assistant-message',commandExecution:'exec',fileChange:'patch',mcpToolCall:'mcp-tool-call',dynamicToolCall:'dynamic-tool-call',webSearch:'web-search',imageGeneration:'generated-image',imageView:'image-view',userMessage:'user-message',steeringUserMessage:'user-message',collabAgentToolCall:'multi-agent-action',subAgentActivity:'subagent-activity',contextCompaction:'context-compaction',automaticApprovalReview:'automatic-approval-review'};
  const selectCommand=core.bindCommandSelector(),webSources=core.bindWebSources();
  const activityCore=globalThis.EvaNativeActivityCore;
  const aggregateAgents=activityCore?.bindSubagents(id=>id),activityState=activityCore?.bindActivityState();
  // REA cra -> O6e: only these two MCP servers are native command sources.
  const isCommandSource=key=>/^server:(?:node_repl|cua_repl)$/.test(key);
  const summaryParts=activityCore?.bindSummary(isCommandSource);
  const knownGroupKeys=new Map(),renderFrames=new Map(),dynamicRenderers=new Map();
  function rememberKeys(scope,keys){while(keys.size>1000)keys.delete(keys.values().next().value);knownGroupKeys.delete(scope);knownGroupKeys.set(scope,keys);while(knownGroupKeys.size>200)knownGroupKeys.delete(knownGroupKeys.keys().next().value);}
  function beginRender(scope){const existing=renderFrames.get(scope);if(existing){existing.depth++;return;}renderFrames.set(scope,{previous:knownGroupKeys.get(scope)||new Set(),next:new Set(),depth:1});}
  function endRender(scope){const frame=renderFrames.get(scope);if(!frame||--frame.depth>0)return;rememberKeys(scope,frame.next);renderFrames.delete(scope);}
  const dynamicKey=item=>JSON.stringify([item.namespace||'',item.tool||item.name||'']);
  function registerDynamicTool(namespace,tool,renderer){const key=dynamicKey({namespace,tool});if(renderer==null)dynamicRenderers.delete(key);else dynamicRenderers.set(key,Object.freeze({...renderer}));}
  function dynamicRenderer(item){return dynamicRenderers.get(dynamicKey(item))||item.toolDisplay||{};}
  function dynamicToolLabel(item,{completed=item.status!=='inProgress',lang='zh'}={}){
    const renderer=dynamicRenderer(item),name=[renderer.title,renderer.label,item.displayName,String(item.tool||item.name||'工具').replace(/[_-]+/g,' ')].find(value=>typeof value==='string'&&value.trim()),failed=item.status==='failed'||item.success===false;
    const explicit=failed?renderer.failed:completed?renderer.invoked:renderer.invoking;
    if(typeof explicit==='string'&&explicit.trim())return explicit;
    return lang==='zh'?(failed?`调用 ${name} 失败`:completed?`已调用 ${name}`:`正在调用 ${name}`):(failed?`Failed to call ${name}`:completed?`Called ${name}`:`Calling ${name}`);
  }
  function disposition(item){
    if(item.type==='agentMessage'&&!item.text?.trim()&&item.structuredOutput==null&&item.requestUserInputAsync==null)return 'hidden';
    if(item.hiddenInConversation===true)return 'hidden';
    if(item.type==='automaticApprovalReview')return item.status==='approved'?'hidden':item.status==='inProgress'?'groupable':'standalone';
    if(item.tool==='update_running_summary'&&(item.type==='mcpToolCall'&&item.server==='codex_app'||item.type==='dynamicToolCall'&&(item.namespace==null||item.namespace==='codex_app')))return 'hidden';
    if(item.type==='dynamicToolCall'){const renderer=dynamicRenderer(item);if(renderer.hiddenInConversation===true)return 'hidden';if(renderer.standaloneInConversation===true)return 'standalone';}
    return null;
  }
  function agentName(path){const part=String(path||'').split('/').filter(s=>s&&s!=='root').at(-1);if(!part)return null;const name=part.replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim().toLowerCase();return name?name[0].toUpperCase()+name.slice(1):null;}
  function project(item,turn={},commandAction){
    const value={...item,type:types[item.type]||item.type,_source:item};
    if(item.type==='agentMessage')value.content=item.text||'';
    if(item.type==='subAgentActivity')Object.assign(value,{isMessage:item.kind==='interacted',displayName:agentName(item.agentPath)||item.displayName||'子智能体',displayStatus:({started:'active',interacted:'updated',completed:'completed',interrupted:'interrupted'})[item.kind]||'active'});
    if(item.type==='commandExecution'){
      // ZEM8.eo: declined commands fall back to the complete proposal rather
      // than presenting parsed read/search actions as work that took place.
      const action=item.status==='declined'?{type:'unknown',command:Array.isArray(item.command)?item.command.join(' '):item.command||''}:commandAction||item.commandActions?.find(a=>['read','search','listFiles','list_files'].includes(a.type))||item.commandActions?.[0];
      const type=action?.type==='listFiles'?'list_files':action?.type||'unknown';
      const interrupted=item.status==='inProgress'&&(turn.status==='interrupted'||turn.interruptedCommandExecutionItemIds?.includes(item.id));
      value.parsedCmd={...action,type,cmd:action?.command||commandLabel(item)||item.command||'',isFinished:interrupted||item.status!=='inProgress'};
      value.callId=item.id;value.executionStatus=interrupted?'interrupted':item.status;value.output={exitCode:item.exitCode};
    }
    if(item.type==='mcpToolCall')Object.assign(value,{callId:item.id,completed:item.status!=='inProgress'||turn.status&&turn.status!=='inProgress',invocation:{server:item.server||'',tool:item.tool||'',arguments:item.arguments},functionName:`${item.server}__${item.tool}`});
    if(['dynamicToolCall','webSearch','reasoning','agentMessage'].includes(item.type))value.completed=item.status?item.status!=='inProgress':turn.status!=='inProgress';
    if(item.type==='dynamicToolCall'&&item.status==='failed')value.success=false;
    if(item.type==='automaticApprovalReview'&&item.status==='inProgress'&&turn.status==='interrupted'){
      value.status='aborted';value._source={...item,status:'aborted'};
    }
    if(item.type==='webSearch'&&turn.items){const latest=turn.items.findLast(i=>!['userMessage','hookPrompt','steeringUserMessage','steered'].includes(i.type));value.completed=turn.status!=='inProgress'||latest?.id!==item.id;}
    if(item.type==='fileChange'){value.success=item.status==='inProgress'?null:item.status==='completed';value.changes=Object.fromEntries((item.changes||[]).map(c=>[c.path,c.kind||{type:'update'}]));}
    return value;
  }
  function renderGroups(items,classify,options={}){
    const scope=options.scope||null,frame=scope?renderFrames.get(scope):null,known=scope?(frame?.previous||knownGroupKeys.get(scope)||new Set()):null;
    // Empty transport message placeholders have no visible row. Letting them
    // reach the native splitter creates separate single-command disclosures.
    const visibleItems=items.filter(item=>classify(item)!=='hidden'&&!(item.type==='agentMessage'&&!item.text?.trim()&&item.structuredOutput==null&&item.requestUserInputAsync==null));
    const projected=visibleItems.map(item=>project(item,options.turn));
    const agentGroups=[],wholeTurn=options.turn?.items?options.turn.items.filter(item=>classify(item)!=='hidden').map(item=>project(item,options.turn)):projected;
    for(let i=0;i<wholeTurn.length;i++){const item=wholeTurn[i];if(item.type!=='subagent-activity'||item.isMessage)continue;const group=[item];while(wholeTurn[i+1]?.type==='subagent-activity'&&!wholeTurn[i+1].isMessage)group.push(wholeTurn[++i]);agentGroups.push(group);}
    const aggregates=aggregateAgents?.({activityItemGroups:agentGroups,backgroundAgents:options.backgroundAgents||[],turnKey:options.turn?.id,excludedSubagentThreadIds:options.excludedSubagentThreadIds})||[];
    const byAnchor=new Map(aggregates.filter(g=>g.anchorItemId!=null).map(g=>[g.anchorItemId,g]));
    for(const item of projected){const group=byAnchor.get(item.id);if(group)item._source={...item._source,_agentActivityGroup:group};}
    const split=core.bindRenderGroups(item=>{
      const kind=classify(item._source);
      return {item,grouping:kind==='standalone'?'standalone':'groupable'};
    });
    // Messages are separate rows; the retained F intentionally skips message
    // activities unless the surrounding pipeline marks them standalone.
    const standalone=new Set(projected.filter(item=>item.type==='subagent-activity'&&item.isMessage||item.type==='automatic-approval-review'&&item.status!=='inProgress'));
    const groups=split(projected,true,standalone,known?key=>known.has(key):undefined).map(group=>({...group,...group.item?{item:group.item._source}:{},...group.items?{items:group.items.map(item=>item._source)}:{}}));
    if(!options.turn?.items||items.includes(options.turn.items.at(-1)))for(const group of aggregates.filter(g=>g.anchorItemId==null))groups.push({type:'activity-item',key:'transcript-agents-live:'+options.turn?.id,item:{id:'agents-live:'+options.turn?.id,type:'subAgentActivity',_agentActivityGroup:group}});
    if(scope){const next=frame?.next||new Set();for(const group of groups)next.add(group.key);if(!frame)rememberKeys(scope,next);}
    return groups;
  }
  function source(item){const context=item.appContext,name=context?.appName||item.source?.name||item.server;if(!name)return null;return {key:context?.connectorId?'app:'+context.connectorId:'server:'+item.server,name:context?.appName||item.source?.name||String(name).replace(/^mcp__/, '').replace(/[_-]+/g,' ').replace(/^./,c=>c.toUpperCase())};}
  function summarize(items,turn,collapseWhenPossible=false,isLatestVisibleUnit=true){
    const projected=items.flatMap(item=>item.type==='commandExecution'&&item.status!=='declined'&&item.commandActions?.length>1?item.commandActions.map((action,index)=>({...project(item,turn,action),callId:`${item.id}:${index}`})):[project(item,turn)]),units=projected.map(item=>({item,grouping:'groupable'}));
    const lastActivity=projected.findLast(item=>item.type!=='reasoning'),isExploring=lastActivity?.type==='exec'&&['read','search','list_files'].includes(lastActivity.parsedCmd.type);
    // The caller may render only the segment preceding a steering message.
    const lastVisible=turn.items?.findLast(item=>item.hiddenInConversation!==true&&disposition(item)!=='hidden');
    if(lastVisible&&!items.some(item=>item.id===lastVisible.id))isLatestVisibleUnit=false;
    const state=activityState?.state({unit:{items:units},isLatestVisibleUnit,isTurnInProgress:turn.status==='inProgress',isActivitySliceClosed:collapseWhenPossible,isExploring})||{kind:'summary'};
    let counts={loadedToolCount:0,mcpToolCallSources:[],mcpToolCallCount:0,createdFileCount:0,editedFileCount:0,deletedFileCount:0,stoppedCreatedFileCount:0,exploredFileCount:0,searchCount:0,listCount:0,commandCount:0,completedVisualizationCommandCount:0,runningVisualizationCommandCount:0,completedWebSearchCommandCount:0,runningWebSearchCommandCount:0,webSearchCount:0};
    const sources=new Map(),files=new Map();
    for(const item of items){
      if(item.type==='mcpToolCall'){counts.mcpToolCallCount++;const value=source(item);if(value){const old=sources.get(value.key);sources.set(value.key,{...value,count:(old?.count||0)+1});}}
      if(item.type==='fileChange')for(const change of item.changes||[])files.set(change.path,change.kind?.type||'update');
      if(item.type==='commandExecution')for(const action of item.status==='declined'?[{type:'unknown'}]:item.commandActions?.length?item.commandActions:[{type:'unknown'}]){if(action.type==='read'){if(/[/\\]skills[/\\][^/\\]+[/\\]SKILL\.md$/i.test(action.path||action.name||''))counts.loadedToolCount++;else counts.exploredFileCount++;}else if(action.type==='search')counts.searchCount++;else if(['listFiles','list_files'].includes(action.type))counts.listCount++;else counts.commandCount++;}
      if(item.type==='webSearch')counts.webSearchCount++;
    }
    for(const kind of files.values())counts[kind==='add'?'createdFileCount':kind==='delete'?'deletedFileCount':'editedFileCount']++;
    counts.mcpToolCallSources=[...sources.values()];
    const statistics=globalThis.EvaNativeActivityStatistics;
    if(statistics)counts=statistics.aggregate(projected.map(display=>{
      const item=display._source;
      if(display.type==='patch'){const changes=Object.fromEntries(Object.entries(display.changes).map(([path,change])=>[path,{...change,content:change.content||item.changes?.find(c=>c.path===path)?.diff||''}]));return statistics.patch({...display,changes},turn.status==='interrupted');}
      if(display.type==='mcp-tool-call')return {type:'mcp-tool-call',source:source(item),isInProgress:!display.completed};
      if(display.type==='web-search')return {type:'web-search',count:1,runningCount:+!display.completed};
      if(display.type==='automatic-approval-review')return ['denied','timedOut'].includes(item.status)?{type:display.type,id:item.id,status:item.status}:{type:'other'};
      if(display.type!=='exec')return {type:'other'};
      const action=display.parsedCmd,running=!action.isFinished;
      if(!['read','search','list_files'].includes(action.type))return {type:'exec',isInProgress:running,visualizationActivityKind:item.visualizationActivityKind,searchesWeb:item.searchesWeb};
      const path=action.path||action.name||action.cmd,loaded=action.type==='read'&&/[/\\]skills[/\\][^/\\]+[/\\]SKILL\.md$/i.test(path);
      return {type:'exploration',readPaths:action.type==='read'&&!loaded?[path]:[],runningReadPaths:running&&action.type==='read'&&!loaded?[path]:[],loadedToolPaths:loaded?[path]:[],runningLoadedToolPaths:running&&loaded?[path]:[],searchCount:+(action.type==='search'),runningSearchCount:+(running&&action.type==='search'),listCount:+(action.type==='list_files'),runningListCount:+(running&&action.type==='list_files')};
    }));
    const parts=summaryParts?.(counts,counts.mcpToolCallSources.filter(source=>!isCommandSource(source.key)),[])||[];
    const dynamic=new Set();for(const item of items)if(item.type==='dynamicToolCall'){const key=dynamicKey(item);if(!dynamic.has(key)){dynamic.add(key);parts.push({kind:'dynamic-tool-call',key,item});}}
    const simplified=activityState?.simplify({kind:'group',items:units},state)?.kind==='standalone';
    return {state,parts,simplified,items:items.filter(item=>disposition(item)!=='hidden'),activeItem:state.item?.item?._source,activeDisplay:state.item?.item,activeKey:state.item?.item?.callId||state.item?.item?.id};
  }
  function commandLabel(item){
    const command=Array.isArray(item.command)?item.command.join(' '):item.command||'';
    return selectCommand({command,commandActions:item.commandActions||[]});
  }
  const disclosure=globalThis.EvaNativeDisclosure;
  const persistent=disclosure?.bindPersistent(dynamicRenderer,({item})=>item.mcpAppResourceUri!=null);
  function isPersistent(item,turn){return !!persistent?.({unit:{kind:'standalone',item:{item:project(item,turn)}},hasFollowingFinalAnswer:true,keepMcpAppEntriesPersistent:false,renderMcpApps:false});}
  function isFinal(item,turn){return item.type==='agentMessage'&&!!disclosure?.isFinal(project(item,turn));}
  globalThis.nativeTranscript=Object.freeze({renderGroups,beginRender,endRender,disposition,dynamicToolLabel,registerDynamicTool,isCommandSource,commandLabel,summarize:activityCore?summarize:null,project,agentName,isPersistent:disclosure?isPersistent:undefined,isFinal:disclosure?isFinal:undefined,disclosureState:disclosure?.state,collectWebSources:webSources.collect,normalizeSourceLink:webSources.normalizeLink});
})();
