/* Snapshot/notification boundary logic. Ordinary live deltas are never deduplicated. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.streamState=api;})(globalThis,function(){
  const terminal=new Set(['completed','failed','interrupted']);
  function textMerge(before,after){return typeof before==='string'&&typeof after==='string'&&before.startsWith(after)?before:after;}
  function mergeItem(before,after,{source='history'}={}){
    const item={...before,...after};
    // Native user items may arrive before their content. Acceptance alone must
    // not erase the submitted text/images, including on completion snapshots.
    if(item.type==='userMessage'&&before?.content?.length&&!after?.content?.length)item.content=before.content;
    if(source==='completion')return item;
    for(const key of ['text','aggregatedOutput','output'])if(after?.[key]!==undefined)item[key]=textMerge(before?.[key],after[key]);
    for(const key of ['summary','content'])if(Array.isArray(before?.[key])&&Array.isArray(after?.[key]))item[key]=Array.from({length:Math.max(before[key].length,after[key].length)},(_,i)=>after[key][i]===undefined?before[key][i]:textMerge(before[key][i],after[key][i]));
    if(terminal.has(before?.status)&&after?.status==='inProgress')item.status=before.status;
    return item;
  }
  function mergeTurn(before,after,{order='incoming',source='history'}={}){
    const old=new Map((before?.items||[]).filter(x=>x?.id).map(x=>[x.id,x]));
    const fresh=new Map((after?.items||[]).filter(x=>x?.id).map(x=>[x.id,x]));
    const primary=order==='existing'?old:fresh,secondary=order==='existing'?fresh:old;
    const ids=[...primary.keys()];let anchor=-1;
    for(const id of secondary.keys()){const at=ids.indexOf(id);if(at>=0){anchor=at;continue;}ids.splice(++anchor,0,id);}
    const merged={...before,...after,items:ids.map(id=>mergeItem(old.get(id),fresh.get(id),{source}))};
    const echo=merged.items.find(i=>i.type==='userMessage'&&!i._raeSubmitted);
    if(echo){
      const submitted=merged.items.find(i=>i._raeSubmitted);
      if(!echo.content?.length&&submitted?.content?.length)echo.content=submitted.content;
      merged.items=merged.items.filter(i=>!i._raeSubmitted);
    }
    if(terminal.has(before?.status)&&after?.status==='inProgress')merged.status=before.status;
    return merged;
  }
  function deltaField(method,p){
    if(method==='item/reasoning/summaryTextDelta'&&(!Number.isSafeInteger(p.summaryIndex??0)||(p.summaryIndex??0)<0)||method==='item/reasoning/textDelta'&&(!Number.isSafeInteger(p.contentIndex??0)||(p.contentIndex??0)<0))return null;
    return method==='item/agentMessage/delta'||method==='item/plan/delta'?['text']:method==='item/commandExecution/outputDelta'?['aggregatedOutput']:method==='item/fileChange/outputDelta'?['output']:method==='item/reasoning/summaryTextDelta'?['summary',p.summaryIndex??0]:method==='item/reasoning/textDelta'?['content',p.contentIndex??0]:null;
  }
  function read(item,path){return path?.length===2?item?.[path[0]]?.[path[1]]:item?.[path?.[0]];}
  function append(item,path,chunk){if(path.length===2){item[path[0]] ||= [];item[path[0]][path[1]]=(item[path[0]][path[1]]||'')+chunk;}else item[path[0]]=(item[path[0]]||'')+chunk;}
  function overlap(snapshot,deltas){for(let n=Math.min(snapshot.length,deltas.length);n>0;n--)if(snapshot.endsWith(deltas.slice(0,n)))return n;return 0;}
  function createBoundary(){
    let active=null,sequence=0;const pending=new Map();
    const key=p=>JSON.stringify([p.threadId,p.turnId,p.itemId||p.item?.id]);
    function begin(threadId,baseline){active={threadId,events:[],baseline:baseline?JSON.parse(JSON.stringify(baseline)):null};pending.clear();}
    function cancel(threadId){if(threadId===undefined||active?.threadId===threadId)active=null;for(const k of pending.keys())if(threadId===undefined||JSON.parse(k)[0]===threadId)pending.delete(k);}
    function capture(event){if(active&&event.params?.threadId===active.threadId&&(/^(?:item\/|turn\/started$|turn\/completed$)/.test(event.method))){active.events.push(event);return true;}return false;}
    function finish(thread){
      if(active?.threadId!==thread.id)return [];
      let events=active.events;const baseline=active.baseline;active=null;
      const completed=new Map();events.forEach((event,index)=>{if(event.method==='item/completed'&&event.params.item)completed.set(key(event.params),index);});
      events=events.filter((event,index)=>!deltaField(event.method,event.params)||index>(completed.get(key(event.params))??-1));
      const groups=new Map();
      for(const event of events){const path=deltaField(event.method,event.params);if(!path)continue;const k=key(event.params)+JSON.stringify(path);if(!groups.has(k))groups.set(k,{path,p:event.params,events:[]});groups.get(k).events.push(event);}
      for(const group of groups.values()){
        const item=thread.turns?.find(t=>t.id===group.p.turnId)?.items?.find(i=>i.id===group.p.itemId);
        const snapshot=String(read(item,group.path)||'');
        const oldItem=baseline?.turns?.find(t=>t.id===group.p.turnId)?.items?.find(i=>i.id===group.p.itemId);
        const prior=String(read(oldItem,group.path)||'');
        const extension=snapshot.startsWith(prior)?snapshot.slice(prior.length):'';
        let skip=overlap(extension,group.events.map(e=>e.params.delta??e.params.chunk??'').join(''));
        for(const event of group.events){const value=event.params.delta??event.params.chunk??'';const count=Math.min(skip,value.length);skip-=count;event.params={...event.params,delta:value.slice(count),chunk:undefined};}
      }
      return events;
    }
    function delta(method,p,item){const path=deltaField(method,p);if(!path)return false;const chunk=p.delta??p.chunk??'';if(item)append(item,path,chunk);else{const k=key(p);if(!pending.has(k))pending.set(k,[]);pending.get(k).push({path,chunk,sequence:++sequence});}return true;}
    function checkpoint(threadId,turnId){const result=new Map();for(const [k,rows]of pending){const [thread,turn,id]=JSON.parse(k);if(thread===threadId&&turn===turnId)result.set(id,rows.at(-1)?.sequence??0);}return result;}
    function attach(p,item,{source='history',through=Infinity}={}){const k=key(p),rows=pending.get(k);if(!rows)return;pending.delete(k);const paths=new Map();for(const row of rows){if(source==='completion'&&row.sequence<=through&&read(item,row.path)!==undefined)continue;const k=JSON.stringify(row.path);if(!paths.has(k))paths.set(k,{path:row.path,text:''});paths.get(k).text+=row.chunk;}for(const row of paths.values()){const skip=source==='completion'&&read(item,row.path)!==undefined?0:overlap(String(read(item,row.path)||''),row.text);append(item,row.path,row.text.slice(skip));}}
    return {begin,cancel,capture,finish,delta,attach,checkpoint};
  }
  return {mergeItem,mergeTurn,createBoundary};
});
