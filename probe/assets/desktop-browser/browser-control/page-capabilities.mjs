import {createHash,randomUUID} from 'node:crypto';

const maxStoredChars=64*1024*1024;
const protocolName=/^[A-Za-z][A-Za-z0-9]*\.[A-Za-z][A-Za-z0-9]*$/;
function budget(command){
 const value=command.maxResponseChars??6000;
 if(!Number.isInteger(value)||value<1||value>50000)throw Error('maxResponseChars 必须在 1 到 50000 之间');
 return value;
}
async function bounded(operation,signal,timeoutMs=15000){
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000)throw Error('timeoutMs 必须在 1 到 60000 之间');
 signal?.throwIfAborted();
 let timer,onAbort;
 const pending=Promise.resolve().then(operation);
 try{
  return await Promise.race([pending,new Promise((_,reject)=>{
   timer=setTimeout(()=>reject(Object.assign(Error('浏览器脚本或协议请求尚未返回'),{code:'capability_timeout'})),timeoutMs);
   onAbort=()=>reject(signal.reason??Error('浏览器请求已取消'));
   signal?.addEventListener('abort',onAbort,{once:true});
   if(signal?.aborted)onAbort();
  })]);
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',onAbort);}
}

export class BrowserPageCapabilities{
 constructor(){this.results=new Map();this.resultChars=0;this.sessions=new Map();this.operations=new Map();}
 async perform(session,page,command,signal,kind,operation){
  budget(command);signal?.throwIfAborted();
  const timeoutMs=command.timeoutMs??15000;
  if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000)throw Error('timeoutMs 必须在 1 到 60000 之间');
  const operationID=command.operationID??'op_'+randomUUID();
  if(!/^op_[a-f0-9-]{36}$/.test(operationID))throw Error('浏览器操作编号无效');
  const signature=createHash('sha256').update(JSON.stringify(command)).digest('hex');
  const existing=this.operations.get(operationID);
  if(existing){
   if(existing.session!==session||existing.page!==page||existing.signature!==signature||existing.kind!==kind)throw Error('操作编号已被其他请求使用');
   return this.result(session,{operationID});
  }
  for(const [id,row]of this.operations)if(this.operations.size>=100&&row.settled)this.operations.delete(id);
  if(this.operations.size>=100)throw Error('尚有过多浏览器操作未结束，请先查询已有 operationID');
  const row={session,page,signature,kind,settled:false};this.operations.set(operationID,row);
  const pending=Promise.resolve().then(()=>{if(row.retired)throw Error('浏览器操作所属会话已关闭');return operation(row);}).then(value=>{
   if(row.retired&&value?.resultID){const saved=this.results.get(value.resultID);if(saved?.session===session){this.results.delete(value.resultID);this.resultChars-=saved.text.length;}}
   row.settled=true;row.result={...value,operationID};return row.result;
  },error=>{
   row.settled=true;row.result={operationID,execution:{outcome:'unverified',reason:kind+'_failed',actionIssued:true,retrySafe:false,mayStillRun:false,error:error.message,recovery:'操作可能已经产生效果，请检查 DOM、Network 或存储状态，不要自动重放。'}};return row.result;
  });
  try{return await bounded(()=>pending,signal,timeoutMs);}
  catch(error){
   return {operationID,execution:{outcome:'unverified',reason:signal?.aborted?'cancelled':kind+'_timeout',actionIssued:true,retrySafe:false,mayStillRun:!row.settled,recovery:'通过 browser_result 查询 operationID 的后续结果，勿重复执行。'}};
  }
 }
 output(session,value,command={},operation){
  if(operation?.retired)return {execution:{outcome:'cancelled',actionIssued:true,retrySafe:false,mayStillRun:false}};
  const text=JSON.stringify(value??null,(_key,item)=>typeof item==='bigint'?{$type:'bigint',value:item.toString()}:item),limit=budget(command);
  if(text.length<=limit)return {value:JSON.parse(text),complete:true,totalChars:text.length};
  if(text.length>maxStoredChars)throw Error('结果超过缓存上限，请使用定点查询或在页面表达式中分页');
  while(this.results.size>=20||this.resultChars+text.length>maxStoredChars){
   const first=this.results.keys().next().value;
   this.resultChars-=this.results.get(first).text.length;this.results.delete(first);
  }
  const resultID=randomUUID();this.results.set(resultID,{session,text});this.resultChars+=text.length;
  return this.result(session,{resultID,offset:command.offset,maxResponseChars:command.maxResponseChars});
 }
 result(session,command){
  const operationID=command.operationID||(String(command.resultID||'').startsWith('op_')?command.resultID:null);
  if(operationID){
   const operation=this.operations.get(operationID);
   if(!operation||operation.session!==session)throw Error('操作不存在、已过期或不属于当前会话');
   return operation.result||{operationID,execution:{outcome:'pending',actionIssued:true,retrySafe:false,mayStillRun:true}};
  }
  const row=this.results.get(command.resultID);
  if(!row||row.session!==session)throw Error('结果不存在、已过期或不属于当前会话');
  const offset=command.offset??0,limit=budget(command);
  if(!Number.isInteger(offset)||offset<0||offset>row.text.length)throw Error('结果分页位置无效');
  const next=Math.min(offset+limit,row.text.length);
  return {resultID:command.resultID,format:'json',text:row.text.slice(offset,next),offset,nextOffset:next<row.text.length?next:null,totalChars:row.text.length,complete:next===row.text.length};
 }
 async evaluate(session,page,command,signal){
  if(typeof command.expression!=='string'||!command.expression.trim())throw Error('缺少页面 JavaScript 表达式或函数');
  budget(command);
  const args=JSON.stringify(command.args??null);
  const expression=`(async()=>{const argument=${args};const value=(${command.expression});return typeof value==='function'?await value(argument):await value;})()`;
  return this.perform(session,page,command,signal,'script',async operation=>this.output(session,await page.evaluate(expression),command,operation));
 }
 async connection(session,page){
  let pages=this.sessions.get(session);
  if(!pages){pages=new Map();this.sessions.set(session,pages);}
  let pending=pages.get(page);
  if(!pending){
   pending=page.context().newCDPSession(page).then(async client=>{
    if(this.sessions.get(session)!==pages||pages.get(page)!==pending){await client.detach().catch(()=>{});throw Error('浏览器协议连接已取消');}
    client.once('close',()=>{if(pages.get(page)===pending)pages.delete(page);});
    return {client,connectionID:randomUUID(),listeners:new Map(),events:[],nextEventID:0,droppedEvents:0};
   });
   pages.set(page,pending);
   try{await pending;}catch(error){if(pages.get(page)===pending)pages.delete(page);throw error;}
  }
  return pending;
 }
 async cdp(session,page,command,signal){
  const action=command.cdpAction??'send';
  if(action==='send'&&(typeof command.method!=='string'||!protocolName.test(command.method)))throw Error('请提供完整 CDP 方法名');
  if(command.params!=null&&(typeof command.params!=='object'||Array.isArray(command.params)))throw Error('CDP params 必须是对象');
  return this.perform(session,page,command,signal,'protocol',operation=>this.cdpValue(session,page,command,signal,operation));
 }
 async cdpValue(session,page,command,signal,operation){
  budget(command);signal?.throwIfAborted();
  const state=await this.connection(session,page),action=command.cdpAction??'send';
  signal?.throwIfAborted();
  if(operation.retired)throw Error('浏览器操作所属会话已关闭');
  if(action==='subscribe'||action==='unsubscribe'){
   if(!Array.isArray(command.events)||!command.events.length||command.events.length>20||command.events.some(name=>typeof name!=='string'||!protocolName.test(name)))throw Error('events 需要 1 到 20 个完整 CDP 事件名');
   for(const name of command.events){
    if(action==='unsubscribe'){
     const listener=state.listeners.get(name);if(listener)state.client.off(name,listener);state.listeners.delete(name);continue;
    }
    if(state.listeners.has(name))continue;
    if(state.listeners.size>=40)throw Error('当前页面的协议订阅数已达到上限，请先取消旧订阅');
    const listener=data=>{
     const text=JSON.stringify(data);
     const value=text.length>131072?{truncated:true,totalChars:text.length,text:text.slice(0,131072)}:data;
     state.events.push({id:++state.nextEventID,event:name,data:value});
     if(state.events.length>100){state.events.shift();state.droppedEvents++;}
    };
    state.listeners.set(name,listener);state.client.on(name,listener);
   }
   return {connectionID:state.connectionID,events:[...state.listeners.keys()],droppedEvents:state.droppedEvents};
  }
  if(action==='events'){
   const after=command.offset??0,limit=command.limit??50;
   if(!Number.isInteger(after)||after<0||!Number.isInteger(limit)||limit<1||limit>100)throw Error('事件分页参数无效');
   const events=state.events.filter(event=>event.id>after).slice(0,limit);
   return this.output(session,{connectionID:state.connectionID,events,nextOffset:events.at(-1)?.id??after,lastEventID:state.nextEventID,droppedEvents:state.droppedEvents},command,operation);
  }
  if(action!=='send'||typeof command.method!=='string'||!protocolName.test(command.method))throw Error('请提供完整 CDP 方法名');
  if(command.params!=null&&(typeof command.params!=='object'||Array.isArray(command.params)))throw Error('CDP params 必须是对象');
  return this.output(session,await state.client.send(command.method,command.params??{}),command,operation);
 }
 async storage(session,page,command,signal){
  if(command.keys!==undefined&&(!Array.isArray(command.keys)||command.keys.some(key=>typeof key!=='string')))throw Error('keys 必须是字符串数组');
  if(command.cookies!==undefined&&(!Array.isArray(command.cookies)||command.cookies.some(cookie=>!cookie||typeof cookie!=='object'||Array.isArray(cookie)||typeof cookie.name!=='string'||typeof cookie.value!=='string')))throw Error('cookies 必须是包含 name 和 value 字符串的对象数组');
  return this.perform(session,page,command,signal,'storage',operation=>this.storageValue(session,page,command,signal,operation));
 }
 async storageValue(session,page,command,signal,operation){
  const area=command.storageArea??'local',action=command.storageAction??'list';
  if(!['list','get','set','remove','clear'].includes(action))throw Error('不支持的存储操作');
  budget(command);signal?.throwIfAborted();
  if(area==='cookies'){
   const url=command.origin??page.url(),state=await this.connection(session,page);
   if(!/^https?:/.test(url))throw Error('Cookie 操作需要明确的 HTTP/HTTPS 页面来源');
   const {cookies}=await state.client.send('Network.getCookies',{urls:[url]});
   signal?.throwIfAborted();
   if(operation.retired)throw Error('浏览器操作所属会话已关闭');
   const names=command.keys??(command.name!==undefined?[command.name]:null);
   const selected=names?cookies.filter(cookie=>names.includes(cookie.name)):cookies;
   if(action==='get')return this.output(session,selected,command,operation);
   if(action==='list')return this.output(session,cookies.map(({value,...metadata})=>metadata),command,operation);
   if(action==='set'){
    const input=command.cookies??(typeof command.name==='string'?[{name:command.name,value:command.value,url}]:null);
    if(!Array.isArray(input)||!input.length)throw Error('请提供需要设置的 cookies');
    await state.client.send('Network.setCookies',{cookies:input.map(cookie=>cookie.url||cookie.domain?cookie:{...cookie,url})});
    return {updated:input.length};
   }
   if(action==='remove'&&!names?.length)throw Error('删除 Cookie 需要明确的 name 或 keys');
   for(const cookie of selected){signal?.throwIfAborted();if(operation.retired)throw Error('浏览器操作所属会话已关闭');await state.client.send('Network.deleteCookies',{name:cookie.name,domain:cookie.domain,path:cookie.path});}
   return {removed:selected.length};
  }
  if(!['local','session'].includes(area))throw Error('storageArea 必须是 local、session 或 cookies');
  if(['set','remove'].includes(action)&&typeof command.name!=='string')throw Error('存储写操作需要明确的 name');
  if(action==='set'&&typeof command.value!=='string')throw Error('存储 value 必须是字符串');
  const value=await page.evaluate(({area,action,name,value,keys})=>{
   const storage=area==='local'?localStorage:sessionStorage;
   if(action==='list')return {keys:Object.keys(storage),length:storage.length};
   if(action==='get')return Object.fromEntries((keys??(name!==undefined?[name]:Object.keys(storage))).map(key=>[key,storage.getItem(key)]));
   if(action==='set'){storage.setItem(name,value);return {updated:true,value:storage.getItem(name)};}
   if(action==='remove'){storage.removeItem(name);return {removed:true};}
   storage.clear();return {cleared:true};
  },{area,action,name:command.name,value:command.value,keys:command.keys});
  return this.output(session,value,command,operation);
 }
 forgetPage(page){
  for(const [session,pages] of this.sessions){
   const pending=pages.get(page);pages.delete(page);
   pending?.then(state=>state.client.detach()).catch(()=>{});
   if(!pages.size)this.sessions.delete(session);
  }
 }
 forgetSession(session){
  const pages=this.sessions.get(session);this.sessions.delete(session);
  for(const pending of pages?.values()??[])pending.then(state=>state.client.detach()).catch(()=>{});
  for(const [id,row] of this.results)if(row.session===session){this.resultChars-=row.text.length;this.results.delete(id);}
  for(const [id,row]of this.operations)if(row.session===session){row.retired=true;this.operations.delete(id);}
 }
 close(){for(const row of this.operations.values())row.retired=true;for(const session of [...this.sessions.keys()])this.forgetSession(session);this.results.clear();this.operations.clear();this.resultChars=0;}
}
