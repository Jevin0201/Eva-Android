/* Thin Android presentation bridge over Eva 0.2.0 native-transcript modules.
 * Grouping, summaries and disclosure decisions remain in the migrated modules.
 * Source/limits: migration/eva-0.2.0-flow/SOURCE.json and README.md. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;root.EvaFlowProjection=api;})(globalThis,function(root){
 'use strict';
 const nativeTranscript=root.nativeTranscript;
 if(!nativeTranscript?.renderGroups)throw Error('Load Eva native-transcript modules before the Android projection');
 const LANG='zh',basename=value=>String(value||'').replace(/\\/g,'/').split('/').at(-1);
 const t=(key,args={})=>({thinking:'正在思考',thought:'已思考',ranCommand:'运行了命令',ranCommands:`运行了 ${args.count} 条命令`})[key]||key;
 function nativeActivityLabels(view) {
  if(view.state.kind==='thinking')return [t('thinking')];
  if(view.state.kind==='active'){
    const item=view.activeItem;
    if(item?.type==='commandExecution'){
      const action=view.activeDisplay?.parsedCmd;
      if(action?.type==='read')return [LANG==='zh'?`正在读取 ${action.name||basename(action.path||'文件')}`:`Reading ${action.name||action.path||'file'}`];
      if(action?.type==='search')return [LANG==='zh'?'正在搜索文件':'Searching files'];
      if(action&&['listFiles','list_files'].includes(action.type))return [LANG==='zh'?'正在列出文件':'Listing files'];
      return [LANG==='zh'?'正在运行命令':'Running command'];
    }
    if(item?.type==='fileChange')return [LANG==='zh'?'正在编辑文件':'Editing files'];
    if(item?.type==='webSearch')return [LANG==='zh'?'正在搜索网页':'Searching the web'];
    if(item?.type==='dynamicToolCall')return [nativeTranscript.dynamicToolLabel(item,{completed:false,lang:LANG})];
    if(item?.type==='mcpToolCall'){if(nativeTranscript.isCommandSource('server:'+item.server))return [item.toolDisplay?.invoking||(LANG==='zh'?'正在运行命令':'Running command')];const name=item.appContext?.appName||item.source?.name||String(item.server||'').replace(/[_-]+/g,' ').replace(/^./,c=>c.toUpperCase());return [item.toolDisplay?.invoking||(LANG==='zh'?`正在使用 ${name} 集成`:`Using ${name} integration`)];}
    return [t('thinking')];
  }
  return view.parts.map(part=>{
    switch(part.kind){
      case 'mcp-sources':{const names=part.sources.map(source=>source.name).join(LANG==='zh'?'、':', ');return LANG==='zh'?`已使用 ${names} 集成`:`Used ${names} integration${part.sources.length>1?'s':''}`;}
      case 'unnamed-mcp-calls':return LANG==='zh'?'调用了工具':'Called tools';
      case 'dynamic-tool-call':return part.item?nativeTranscript.dynamicToolLabel(part.item,{completed:true,lang:LANG}):LANG==='zh'?'调用了工具':'Called tools';
      case 'loaded-tools':return LANG==='zh'?'加载了工具':'Loaded tools';
      case 'file-changes':return LANG==='zh'?'编辑了文件':'Edited files';
      case 'stopped-file-creation':return LANG==='zh'?'已停止创建文件':'Stopped creating files';
      case 'exploration':return LANG==='zh'?'查看了文件':'Explored files';
      case 'commands':return part.count===1?t('ranCommand'):t('ranCommands',{count:part.count});
      case 'web-search':return LANG==='zh'?'搜索了网页':'Searched the web';
      default:return '';
    }
  }).filter(Boolean);
}


 function activityDisposition(item) {
  const native=globalThis.nativeTranscript?.disposition?.(item);
  if(native)return native;
  if (item.hiddenInConversation === true) return 'hidden';
  if(['collabAgentToolCall','subAgentActivity'].includes(item.type))return 'standalone';
  if (item.standaloneInConversation === true) return 'standalone';
  if (item.type === 'reasoning') return 'auxiliary';
  if (item.type === 'webSearch' && typeof item.query === 'string' && !item.query.trim()) return 'hidden';
  return ['commandExecution','fileChange','mcpToolCall','dynamicToolCall','collabAgentToolCall','webSearch'].includes(item.type) ? 'groupable' : 'standalone';
}


 const user=i=>['userMessage','steeringUserMessage'].includes(i.type);
 const failed=i=>i.status==='failed'||i.status==='declined'||i.success===false||!!(i.error||i.failure)||i.result?.isError===true||(i.exitCode!=null&&i.exitCode!==0);
 function safeItem(i,text){
  if(i.type==='reasoning')return {id:i.id,type:i.type,status:i.status,summary:(Array.isArray(i.summary)?i.summary:[]).map(s=>typeof s==='string'?s:s?.text||'')};
  if(i.type==='agentMessage')return {...i,text:text(i)};
  if(i.type==='dynamicToolCall'&&['eva_phone','eva_browser'].includes(i.tool))return {...i,command:(i.tool==='eva_browser'?'浏览器操作 · ':'手机操作 · ')+(i.arguments?.action||''),output:(i.contentItems||[]).filter(x=>x.type==='inputText').map(x=>x.text).join('\n')||i.error||i.output};
  return i;
 }
 function agentRows(items,turnId){
  const rows=new Map();
  for(const i of items){
   if(i.type==='subAgentActivity'&&i.agentThreadId){const old=rows.get(i.agentThreadId)||{};rows.set(i.agentThreadId,{...old,conversationId:i.agentThreadId,displayName:nativeTranscript.agentName(i.agentPath)||i.displayName||'子智能体',parentTurnKey:turnId,status:i.kind==='interacted'?(old.status||'active'):['completed','interrupted'].includes(i.kind)?'done':'active'});}
   if(i.type==='collabAgentToolCall')for(const [id,v]of Object.entries(i.agentsStates||{})){const old=rows.get(id)||{};rows.set(id,{...old,conversationId:id,displayName:old.displayName||'子智能体',parentTurnKey:turnId,status:['completed','idle','interrupted','errored','shutdown','notFound'].includes(v?.status)?'done':'active'});}
  }
  return [...rows.values()];
 }
 function duration(turn){if(Number.isFinite(turn.durationMs)&&turn.durationMs>=0)return turn.durationMs;const ms=value=>typeof value==='number'?(value<1e12?value*1000:value):Date.parse(value);const start=turn.startedAtMs??turn.turnStartedAtMs??(turn.startedAt!=null?ms(turn.startedAt):null),end=turn.completedAtMs??(turn.completedAt!=null?ms(turn.completedAt):null);return Number.isFinite(start)&&Number.isFinite(end)&&end>=start?end-start:null;}
 function durationLabel(value){if(value==null)return '处理过程';const seconds=Math.floor(value/1000);return '用时 '+(seconds>=60?Math.floor(seconds/60)+'m '+seconds%60+'s':seconds+'s');}
 function projectTurn(input,text=i=>i.text??(i.content||[]).map(x=>x.text||'').join('\n'),options={}){
  const turn={...input,items:(input.items||[]).filter(Boolean).map(i=>safeItem(i,text))},scope=String(turn.id||'turn'),blocks=[],backgroundAgents=options.backgroundAgents||agentRows(turn.items,turn.id),hasActiveAgents=backgroundAgents.some(a=>a.status!=='done');
  let segment=[],index=0;
  function groups(items,part,closeTail){
   const result=nativeTranscript.renderGroups(items,activityDisposition,{scope,turn,backgroundAgents});
   return result.map((g,n)=>{
    if(g.type!=='agent-activity')return {kind:g.type,key:g.key,items:g.items,item:g.item};
    const view=nativeTranscript.summarize(g.items,turn,g.collapseWhenPossible||closeTail,n===result.length-1),labels=nativeActivityLabels(view);
    return {kind:'activity',key:g.key,items:g.items,state:view.state.kind,label:labels.join('，')||(view.state.kind==='thinking'?'正在思考':'已思考'),open:false,failed:g.items.some(failed),failureCount:g.items.filter(failed).length,view};
   });
  }
  function flush(){
   if(!segment.length)return;
   // Same final boundary / persistence policy as desktop renderAssistantSegment.
   const start=segment.findIndex(i=>nativeTranscript.isFinal(i,turn)),work=start<0?segment:segment.slice(0,start),final=start<0?[]:segment.slice(start),persistent=work.filter(i=>nativeTranscript.isPersistent(i,turn)),history=work.filter(i=>!persistent.includes(i)),key=scope+':'+index++,cancelled=['interrupted','cancelled','canceled','failed'].includes(turn.status);
   const disclosure=nativeTranscript.disclosureState({hasFinalAssistantStarted:final.length>0,isTurnCancelled:cancelled,hasRenderableAgentItems:history.length>0,forceExpanded:hasActiveAgents,persistedCollapsed:options.expandedKeys?.has(key)?false:undefined});
   blocks.push({kind:'assistant',key,work:history,persistent,final,workGroups:groups(history,key+':work',start>=0),persistentGroups:groups(persistent,key+':persistent',false),finalGroups:groups(final,key+':final',false),collapsible:disclosure.shouldAllowCollapse,open:!disclosure.isCollapsed,label:durationLabel(duration(turn)),durationMs:duration(turn),failureCount:work.filter(failed).length,hasActiveAgents});segment=[];
  }
  nativeTranscript.beginRender(scope);
  try{for(const i of turn.items){if(activityDisposition(i)==='hidden')continue;if(user(i)){flush();blocks.push({kind:'user',item:i});}else segment.push(i);}flush();return {...turn,mobileBlocks:blocks};}finally{nativeTranscript.endRender(scope);}
 }
 nativeTranscript.registerDynamicTool('','eva_phone',{title:'手机控制',invoking:'正在操作手机',invoked:'操作了手机',failed:'手机操作失败'});
 nativeTranscript.registerDynamicTool('','eva_browser',{title:'Eva 浏览器',invoking:'正在操作浏览器',invoked:'操作了浏览器',failed:'浏览器操作失败'});
 return {projectTurn,activityDisposition,nativeActivityLabels,duration};
});
