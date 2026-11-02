'use strict';
// Evaluated in the desktop renderer; grouping and summary logic remain native.
function projectWorkGroups(items,turn,scope,closeTail=false){
 const flow=[];
 for(const item of items){
  if(item.type==='collabAgentToolCall'&&item.tool==='wait'&&!globalThis.nativeTranscript?.summarize)continue;
  const previous=flow.at(-1);
  if(item.type==='collabAgentToolCall'&&previous?.type==='collabAgentToolCall'&&previous.tool===item.tool){const actions=[...(previous._agentActions||[previous]),item];flow[flow.length-1]={...previous,_agentActions:actions,status:actions.some(a=>a.status==='inProgress')?'inProgress':actions.some(a=>a.status==='failed')?'failed':actions.some(a=>a.status==='interrupted')?'interrupted':'completed'};}
  else if(item.type==='imageView'){const paths=imageViewSources(item);if(previous?.type==='imageView'){previous.imagePaths.push(...paths);previous.imageCount+=item.imageCount||paths.length||1;}else flow.push({...item,imagePaths:paths,imageCount:item.imageCount||paths.length||1});}
  else flow.push(item);
 }
 const groups=nativeTranscript.renderGroups(flow,activityDisposition,{scope,turn,backgroundAgents:typeof transcriptBackgroundAgents==='function'?transcriptBackgroundAgents(turn):[]});
 return groups.map((group,index)=>{
  if(group.type!=='agent-activity')return {kind:'standalone',key:group.key,...group.items?{items:group.items}:{item:group.item}};
  const entries=group.items,id=`work:${turn.id}:${group.key||(entries.find(i=>i.type!=='reasoning')||entries[0]).id}`;
  const view=nativeTranscript.summarize(entries,turn,!!(group.collapseWhenPossible||closeTail),index===groups.length-1);
  const simplified=!!view?.simplified&&entries.length===1;
  const labels=nativeActivityLabels(view);if(!labels.length)labels.push(t('thought'));
  const open=isExpanded(id)||entries.some(i=>isExpanded(i.id));
  return {kind:simplified?'standalone':'activity',key:group.key||id,disclosureId:id,items:entries,...simplified?{item:entries[0]}:{},labels,label:labels.join(LANG==='zh'?'，':', '),state:view.state.kind,activeKey:view.activeKey||null,simplified,open,defaultExpanded:open,collapseWhenPossible:!!(group.collapseWhenPossible||closeTail),failed:entries.some(itemFailed)};
 });
}
module.exports={projectWorkGroups};
