import readline from 'node:readline';
import http from 'node:http';
import {AsyncLocalStorage} from 'node:async_hooks';
import './android-input.cjs';
import {BrowserController} from './browser-control/controller.mjs';
import definitions from './browser-control/tool-definitions.js';
import resultModule from './browser-result-store.cjs';
const {BrowserResultStore,projectBrowserResult}=resultModule;
const endpoint=process.argv[2],root=process.env.EVA_BROWSER_ROOT||'/root/eva-workspace';
const store=new BrowserResultStore(root+'/.local/browser-results');
let state={tabs:[],active:null};
const context=new AsyncLocalStorage();
const send=row=>process.stdout.write(JSON.stringify(row)+'\n');
const stage=value=>{const call=context.getStore();if(call)send({id:call.id,stage:value});};
async function bounded(operation,ms,message){
 let timer;try{return await Promise.race([operation,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(message)),ms);})]);}
 finally{clearTimeout(timer);}
}
const host=async(action,id)=>{const payload=JSON.stringify({action,id,requestId:context.getStore()?.id});const data=await new Promise((resolve,reject)=>{const req=http.request(endpoint+'/host',{method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(payload),Connection:'close'}},response=>{const chunks=[];let size=0;response.on('data',chunk=>{size+=chunk.length;if(size>16*1024*1024){req.destroy(Error('原生浏览器响应过大'));return;}chunks.push(chunk);});response.on('end',()=>{try{const value=JSON.parse(Buffer.concat(chunks).toString());if(response.statusCode!==200)throw Error(value.error);resolve(value);}catch(error){reject(error);}});response.on('error',reject);});req.setTimeout(5000,()=>req.destroy(Error('原生浏览器宿主请求超时')));req.on('error',reject);req.end(payload);});if(data.tabs)state=data;return data;};
const controller=new BrowserController({root,preserveBrowserDefaults:true,
 endpoint:async()=>{stage('发现 WebView 调试端点');const r=await fetch(endpoint+'/json/version',{signal:AbortSignal.timeout(3000)});if(!r.ok)throw Error('WebView 调试端点返回 HTTP '+r.status);const v=await r.json();const path=v.webSocketDebuggerUrl?new URL(v.webSocketDebuggerUrl).pathname:'/devtools/browser';stage('建立 WebView 控制连接');return endpoint.replace('http:','ws:')+path;}, phase:stage,
 tabs:()=>state.tabs,active:()=>state.active,
 create:async()=>{const before=new Set(state.tabs.map(t=>t.id));await host('create');return state.tabs.find(t=>!before.has(t.id));},
 activate:async(_,id)=>host('activate',id),close:async(_,id)=>host('close',id),
 target:async id=>{
  stage('匹配当前浏览器标签');
  const pages=controller.browser.contexts().flatMap(ctx=>ctx.pages()).filter(page=>!page.isClosed()&&!page.url().startsWith('https://eva.invalid/'));
  const matches=await Promise.all(pages.map(async page=>await bounded(page.evaluate(()=>window.__evaNativeTab),750,'标签标识读取超时').catch(()=>null)===id?page:null));
  const page=matches.find(Boolean);
  if(!page)throw Error('未找到可读的当前 Eva 标签');
  const cdp=await bounded(page.context().newCDPSession(page),2000,'打开标签 CDP 会话超时');
  try{return (await bounded(cdp.send('Target.getTargetInfo'),2000,'查询标签目标超时')).targetInfo.targetId;}
  finally{void cdp.detach().catch(()=>{});}
 },
 fileChooser(){},fileChooserDone(){},javascriptDialog(){},downloads:()=>[],
 nativeFallback:async()=>({requiresPhoneUse:true,instruction:'使用 eva_phone 处理本应用原生弹窗，完成后重新观察。'})
});
const running=new Map();
readline.createInterface({input:process.stdin}).on('line',line=>{
 let row;try{row=JSON.parse(line);}catch{return;}
 if(row.cancel){running.get(row.cancel)?.abort(Error('网页控制已交还'));return;}
 void context.run(row,async()=>{
  const abort=new AbortController();running.set(row.id,abort);
  try{
   stage('读取 Eva 浏览器窗口和标签');
   await host('state');abort.signal.throwIfAborted();
   const command=definitions.command(row.tool,row.args);
   let result;
   if(row.tool==='browser_screenshot'){
    try{result=await controller.run(row.session,command,abort.signal);}
    catch(error){abort.signal.throwIfAborted();result={...await host('screenshot',row.args.tabId||state.active),cdpCaptureError:error.message};}
   }else if(row.tool==='browser_downloads')result=await host('downloads',row.args.tabId||state.active);
   else if(row.tool==='browser_result'&&(row.args.action==='list'||String(row.args.resultID||'').startsWith('br_')))result=row.args.action==='list'?store.list(row.session,row.args):store.read(row.session,row.args);
   else{
    result=await controller.run(row.session,command,abort.signal);abort.signal.throwIfAborted();
    if(row.tool==='browser_cdp'&&command.method==='Page.getFrameTree'&&(command.cdpAction??'send')==='send'&&result.execution?.outcome==='unverified')throw Error('读取页面结构时 DevTools 未返回结果');
    result=projectBrowserResult(result,store.save(row.session,result));
   }
   abort.signal.throwIfAborted();send({id:row.id,result});
  }catch(error){send({id:row.id,error:String(error.message||error.name||'浏览器调用失败')});}
  finally{running.delete(row.id);}
 });
});
