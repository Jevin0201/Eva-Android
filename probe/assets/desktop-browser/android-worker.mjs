import readline from 'node:readline';
import http from 'node:http';
import './android-input.cjs';
import {BrowserController} from './browser-control/controller.mjs';
import definitions from './browser-control/tool-definitions.js';
import resultModule from './browser-result-store.cjs';
const {BrowserResultStore,projectBrowserResult}=resultModule;
const endpoint=process.argv[2],root=process.env.EVA_BROWSER_ROOT||'/root/eva-workspace';
const store=new BrowserResultStore(root+'/.local/browser-results');
let state={tabs:[],active:null};
const host=async(action,id)=>{const payload=JSON.stringify({action,id});const data=await new Promise((resolve,reject)=>{const req=http.request(endpoint+'/host',{method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(payload),Connection:'close'}},response=>{const chunks=[];let size=0;response.on('data',chunk=>{size+=chunk.length;if(size>16*1024*1024){req.destroy(Error('原生浏览器响应过大'));return;}chunks.push(chunk);});response.on('end',()=>{try{const value=JSON.parse(Buffer.concat(chunks).toString());if(response.statusCode!==200)throw Error(value.error);resolve(value);}catch(error){reject(error);}});response.on('error',reject);});req.setTimeout(15000,()=>req.destroy(Error('原生浏览器宿主请求超时')));req.on('error',reject);req.end(payload);});if(data.tabs)state=data;return data;};
const controller=new BrowserController({root,preserveBrowserDefaults:true,
 endpoint:async()=>{const r=await fetch(endpoint+'/json/version');const v=await r.json();const path=v.webSocketDebuggerUrl?new URL(v.webSocketDebuggerUrl).pathname:'/devtools/browser';return endpoint.replace('http:','ws:')+path;},
 tabs:()=>state.tabs,active:()=>state.active,
 create:async()=>{const before=new Set(state.tabs.map(t=>t.id));await host('create');return state.tabs.find(t=>!before.has(t.id));},
 activate:async(_,id)=>host('activate',id),close:async(_,id)=>host('close',id),
 target:async id=>{for(const context of controller.browser.contexts())for(const page of context.pages()){
  if(await page.evaluate(()=>window.__evaNativeTab).catch(()=>null)!==id)continue;
  const cdp=await context.newCDPSession(page);try{return (await cdp.send('Target.getTargetInfo')).targetInfo.targetId;}finally{await cdp.detach();}
 }throw Error('Eva 标签尚未准备好');},
 fileChooser(){},fileChooserDone(){},javascriptDialog(){},downloads:()=>[],
 nativeFallback:async()=>({requiresPhoneUse:true,instruction:'使用 eva_phone 处理本应用原生弹窗，完成后重新观察。'})
});
const running=new Map();
readline.createInterface({input:process.stdin}).on('line',async line=>{let row;try{row=JSON.parse(line);if(row.cancel){running.get(row.cancel)?.abort(Error('网页控制已交还'));return;}const abort=new AbortController();running.set(row.id,abort);await host('state');const command=definitions.command(row.tool,row.args);let result;if(row.tool==='browser_screenshot'){try{result=await controller.run(row.session,command,abort.signal);}catch(error){if(abort.signal.aborted)throw error;result={...await host('screenshot',row.args.tabId||state.active),cdpCaptureError:error.message};}}else if(row.tool==='browser_downloads'){result=await host('downloads',row.args.tabId||state.active);}else if(row.tool==='browser_result'&&(row.args.action==='list'||String(row.args.resultID||'').startsWith('br_'))){result=row.args.action==='list'?store.list(row.session,row.args):store.read(row.session,row.args);}else{result=await controller.run(row.session,command,abort.signal);result=projectBrowserResult(result,store.save(row.session,result));}process.stdout.write(JSON.stringify({id:row.id,result})+'\n');}catch(error){process.stdout.write(JSON.stringify({id:row?.id,error:String(error.message)})+'\n');}finally{running.delete(row?.id);}});
