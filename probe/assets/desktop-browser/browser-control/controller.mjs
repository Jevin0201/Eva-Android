import fs from 'node:fs';
import {BrowserPageCapabilities} from './page-capabilities.mjs';
import {readTable,editSurface} from './complex-controls.mjs';
import nativeDownloadPolicy from './native-download-policy.cjs';
import path from 'node:path';
import {DialogLifecycle} from './dialog-lifecycle.mjs';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright-core');
import {createPageObservation} from './bulu/browser-page-observation.mjs';
import {inspectPage,interact} from './bulu/browser-inspection.mjs';
import {executeBrowserSteps,waitForBrowserExpectation} from './bulu/browser-action-sequence.mjs';
import {scrollBrowserPage} from './bulu/browser-pointer.mjs';
import {parseBrowserRef} from './bulu/browser-host-state.mjs';
import {openNetworkArchive} from './bulu/browser-network-archive.mjs';
import {BrowserNetworkRecorder,browserBackgroundSession} from './bulu/browser-network-recorder.mjs';
import {requestInPage,replayBrowserRequest,mockBrowserResponse,unmockBrowserResponse} from './bulu/browser-network-actions.mjs';
import {selectInputFiles} from './file-selection.mjs';
import {uploadDirectory} from './upload-directory.mjs';

export class BrowserController{
 constructor(bindings){
  this.capabilities=new BrowserPageCapabilities();
  this.bindings=bindings;this.selected=new Map();this.tabHistory=new Map();this.nextEpoch=0;this.epochs=new WeakMap();this.pages=new WeakMap();this.targetIDs=new WeakMap();this.ownedTargets=new Map();this.captureSites=new Map();this.dialogs=new Map();this.choosers=new Map();this.console=[];this.downloads=[];this.queues=new Map();
  this.dialogTokens=new WeakMap();this.dialogLifecycles=new WeakMap();this.dialogObservers=new WeakMap();this.boundPages=new Map();this.dialogNotices=new Map();this.uploads=new Map();this.observation=createPageObservation({pageID:p=>this.pages.get(p),epoch:p=>this.epochs.get(p)||0,bumpEpoch:p=>this.epochs.set(p,++this.nextEpoch)});
 }
 selectPage(session,id){this.selected.set(session,id);this.tabHistory.set(session,[...(this.tabHistory.get(session)||[]).filter(tab=>tab!==id),id]);}
 forgetPage(id){
  for(const [session,history]of this.tabHistory){
   let remaining=history.filter(tab=>tab!==id);
   try{const live=new Set(this.bindings.tabs(session).filter(tab=>tab.id!==id).map(tab=>tab.id));remaining=remaining.filter(tab=>live.has(tab));}
   catch{/* The host may still be removing a destroyed view. Verify again after close acknowledgement. */}
   this.tabHistory.set(session,remaining);
   if(this.selected.get(session)===id){if(remaining.length)this.selected.set(session,remaining.at(-1));else this.selected.delete(session);}
  }
 }
 forgetSession(session){this.selected.delete(session);this.tabHistory.delete(session);this.captureSites.delete(session);this.recorder?.stop(session);this.capabilities.forgetSession(session);}
 async ensure(){return this.starting||(this.starting=this.start().catch(e=>{this.starting=null;throw e}));}
 async openArchive(){
  if(this.archive)return this.archive;
  return this.archiveOpening||(this.archiveOpening=openNetworkArchive(path.join(this.bindings.root,'.local/browser-network')).then(archive=>this.archive=archive).catch(error=>{this.archiveOpening=null;throw error;}));
 }
 async start(){
  if(this.bindings.nativeBrowser)nativeDownloadPolicy.install();
  const endpoint=await this.bindings.endpoint();this.endpoint=endpoint;this.browser=await chromium.connectOverCDP(endpoint,{timeout:15000,...(this.bindings.preserveBrowserDefaults?{noDefaults:true}:{})});
  const connection=this.browser;
  connection.on('disconnected',()=>{if(this.browser!==connection)return;this.starting=null;this.ownedTargets.clear();this.recorder?.targets?.close();void Promise.resolve(this.capabilities.close()).catch(()=>{});});
  await this.openArchive();
  this.recorder=new BrowserNetworkRecorder(this.archive,p=>this.pages.get(p),()=>this.selected,{allowTarget:(target,parent)=>{
   if(this.ownedTargets.has(parent?.targetId)||this.recorder.workerPage(target))return true;
   // Shared/service workers have no page parent. Match the browser partition and
   // site of a registered browser page, excluding the application renderer.
   try{return [...this.ownedTargets.values()].some(p=>!p.isClosed()&&new URL(p.url()).origin===new URL(target.url).origin&&(!target.browserContextId||target.browserContextId===this.ownedContexts.get(p)))||this.backgroundAllowed(target);}catch{return false;}
  },allowCapture:target=>this.backgroundAllowed(target)});this.ownedContexts=new WeakMap();
  return this;
 }
 async pageFor(session,id){
  const {connect}=createRequire(import.meta.url)('../browser-automation-ready');
  return connect(()=>this.findPageFor(session,id),()=>!this.bindings.tabs(session).some(tab=>tab.id===id));
 }
 async findPageFor(session,id){
  await this.ensure();const tabs=this.bindings.tabs(session),tab=tabs.find(t=>t.id===id);
  if(!tab)throw Error('指定标签已关闭或不属于当前窗口，请重新列出标签。');
  const target=await this.bindings.target(tab.id);
  for(const context of this.browser.contexts())for(const page of context.pages()){
   if(page.isClosed())continue;
   if(!this.targetIDs.has(page)){let cdp;try{cdp=await context.newCDPSession(page);this.targetIDs.set(page,(await cdp.send('Target.getTargetInfo')).targetInfo.targetId);}catch(error){if(page.isClosed()||/Target.*closed|Session.*closed|No target with given id|No session with given id/i.test(error.message))continue;throw error;}finally{await cdp?.detach().catch(()=>{});}}
   if(this.targetIDs.get(page)!==target)continue;
   if(!this.pages.has(page))this.bindPage(page,tab.id);
   await this.observeNativeDialogs(page);
   this.ownedTargets.set(target,page);
   if(!this.ownedContexts.has(page)){const infoSession=await context.newCDPSession(page);try{this.ownedContexts.set(page,(await infoSession.send('Target.getTargetInfo')).targetInfo.browserContextId);}finally{await infoSession.detach().catch(()=>{});}}
   await this.recorder.prepare(this.endpoint);this.recorder.attach(context);await this.recorder.watch(session,page);return page;
  }
  throw Error('网页尚未就绪，请稍后重新读取当前标签。');
 }
 bindPage(page,id){
  this.pages.set(page,id);this.boundPages.set(id,page);this.epochs.set(page,++this.nextEpoch);page.setDefaultTimeout(5000);
  page.on('framenavigated',frame=>{this.epochs.set(page,++this.nextEpoch);if(frame===page.mainFrame())for(const session of this.recorder.enabled)if(this.recorder.watched.get(id)?.has(session))this.rememberSite(session,page);});
  const lifecycle=new DialogLifecycle({opened:record=>{const dialog=record.dialog;this.dialogs.set(id,dialog);this.dialogTokens.set(dialog,record.token);const info={dialogId:record.token,type:dialog.type(),message:dialog.message().slice(0,12000),defaultValue:dialog.defaultValue(),url:page.url()};
   if(this.bindings.dialogPolicy==='manual')this.bindings.javascriptDialog?.(id,info);
   else{const decision=info.type==='alert'?'accept':'dismiss';this.dialogNotices.set(id,{...info,decision,background:true,handled:false,status:'handling',at:Date.now()});this.dialogLifecycles.get(page).decide(dialog,{decision}).then(()=>{this.dialogNotices.set(id,{...info,decision,background:true,handled:true,status:'handled',at:Date.now()});}).catch(()=>{this.dialogNotices.set(id,{...info,background:true,handled:false,error:'网页对话框处理未确认',at:Date.now()});});}
   },closed:record=>{if(this.dialogs.get(id)===record.dialog)this.dialogs.delete(id);this.bindings.javascriptDialog?.(id,{closed:true,dialogId:record.token,background:this.bindings.dialogPolicy!=='manual'});}});this.dialogLifecycles.set(page,lifecycle);
  page.on('dialog',dialog=>lifecycle.observe(dialog));
  page.on('console',m=>{this.console.push({tabId:id,type:m.type(),text:m.text().slice(0,8000),at:Date.now()});this.console=this.console.slice(-500);});
  page.on('pageerror',e=>{this.console.push({tabId:id,type:'error',text:e.message.slice(0,8000),at:Date.now()});this.console=this.console.slice(-500);});
  page.on('close',()=>{void Promise.resolve(this.capabilities.forgetPage(page)).catch(()=>{});if(this.boundPages.get(id)===page)this.boundPages.delete(id);this.ownedTargets.delete(this.targetIDs.get(page));this.dialogs.delete(id);this.bindings.javascriptDialog?.(id,{closed:true});this.choosers.delete(id);this.forgetPage(id);});
 }
 async handleDialog(page,id,c){
   const dialog=this.dialogs.get(id);
   if(!dialog){if(c.dialogId)this.bindings.javascriptDialog?.(id,{closed:true,dialogId:c.dialogId});return {...this.result(page),notPending:true};}
   if(c.dialogId&&c.dialogId!==this.dialogTokens.get(dialog)){this.bindings.javascriptDialog?.(id,{closed:true,dialogId:c.dialogId});throw Error('网页弹窗已更新，请读取当前弹窗后再操作。');}
   if(!['accept','dismiss'].includes(c.decision))return this.result(page);
   const handled=await this.dialogLifecycles.get(page).decide(dialog,c);
   return {...this.result(page),...handled,nativeWindowVerified:false};
  }

 async observeNativeDialogs(page){
  if(!this.dialogObservers.has(page))this.dialogObservers.set(page,(async()=>{const session=await page.context().newCDPSession(page),lifecycle=this.dialogLifecycles.get(page);session.on('Page.javascriptDialogOpening',info=>lifecycle.opening(info));session.on('Page.javascriptDialogClosed',()=>lifecycle.closing());page.once('close',()=>session.detach().catch(()=>{}));await session.send('Page.enable');return session;})().catch(error=>{this.dialogObservers.delete(page);throw error;}));
  return this.dialogObservers.get(page);
 }
 async register(session,id){const page=await this.pageFor(session,id);return page;}
 run(session,command,signal){
  const uploadId=command.action==='upload'?(command.tabId||this.selected.get(session)||this.bindings.active(session)):null;
  if(uploadId&&this.uploads.has(uploadId))return Promise.reject(Error('当前标签正在接收文件，请稍后重试。'));
  const previous=command.action==='dialog'?Promise.resolve():(this.queues.get(session)||Promise.resolve());
  const operation=previous.catch(()=>{}).then(()=>{signal?.throwIfAborted();return this.execute(session,command,signal)}).catch(error=>{
   if(!signal?.aborted&&/Timeout|timed out/i.test(error.message)&&['act','click','type','press_key','pointer','upload','editor','batch'].includes(command.action)){
    const tabId=command.tabId||this.selected.get(session)||this.bindings.active(session);
    return {tabId,execution:{outcome:'unverified',reason:'action_timeout',actionIssued:true,retrySafe:false,recovery:'操作超时，结果尚未确认。先检查目标标签的页面、控件及加载状态，不要重复发送写入、点击或上传。仅在观察到原生阻塞窗口后使用 browser_dialog(native=true)。'}};
   }
   throw error;
  });
  if(uploadId){this.uploads.set(uploadId,operation);operation.finally(()=>{if(this.uploads.get(uploadId)===operation)this.uploads.delete(uploadId);}).catch(()=>{});}
  if(command.action==='dialog')return operation;
  this.queues.set(session,operation);operation.finally(()=>{if(this.queues.get(session)===operation)this.queues.delete(session);}).catch(()=>{});return operation;
 }
 async execute(session,c,signal){
  signal?.throwIfAborted();
  // Own-window tab metadata is available even while the CDP transport reconnects.
  // bindings.tabs performs the session ownership check; no page connection is needed.
  if(c.action==='result'){this.bindings.tabs(session);return this.capabilities.result(session,c);}
  if(c.action==='tabs')return {tabs:this.bindings.tabs(session),activeTabId:this.selected.get(session)};
  if(c.action==='network'&&!['replay','mock','unmock'].includes(c.networkAction)){
   this.bindings.tabs(session);await this.openArchive();return this.network(session,c);
  }
  if(!c.tabId&&!this.selected.has(session)&&c.action!=='open_tab'){
   const active=this.bindings.active(session);
   if(active&&[...this.selected].some(([owner,id])=>owner!==session&&id===active))throw Error('当前标签属于其他会话，请打开新页面或明确选择 tabId。');
  }
  if(c.action==='dialog'&&c.native)return this.bindings.nativeFallback(session,'需要检查所属应用窗口的原生阻塞弹窗。');
  const managedId=c.tabId||this.selected.get(session)||this.bindings.active(session);
  const managed=this.bindings.managedDialogs?.get(managedId);
  if(managed){
   if(!this.bindings.tabs(session).some(t=>t.id===managedId))throw Error('指定标签不属于当前窗口。');
   if(c.action==='dialog'){
    this.bindings.managedDialogs.decide(managedId,c);
    return {tabId:managedId,dialog:this.bindings.managedDialogs.get(managedId),handled:['accept','dismiss'].includes(c.decision)};
   }
   throw Error('请先处理当前网页对话框，再执行其他操作。');
  }
  if(c.action==='dialog'&&this.boundPages.has(managedId)){if(!this.bindings.tabs(session).some(t=>t.id===managedId))throw Error('指定标签不属于当前窗口。');return this.handleDialog(this.boundPages.get(managedId),managedId,c);}
  await this.ensure();signal?.throwIfAborted();
  if(c.action==='dialog'&&(c.native||!c.tabId&&!this.selected.get(session)&&!this.bindings.active(session)))return this.bindings.nativeFallback(session,'当前没有可处理的网页对话框；需要检查应用窗口的原生阻塞弹窗。');
  if(c.action==='open_tab'){
   const url=new URL(c.url);if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw Error('浏览器导航仅接受不含账号密码的 HTTP/HTTPS 地址。');
   const old=this.bindings.tabs(session).find(t=>t.id===(c.tabId||this.selected.get(session)));
   const id=c.newTab||!old?(await this.bindings.create(session,'about:blank')).id:old.id;
   this.selectPage(session,id);const page=await this.pageFor(session,id);this.rememberSite(session,page);await this.recorder.start(session,page);
   await this.runAction(page,()=>page.goto(url.href,{waitUntil:'domcontentloaded',timeout:25000}),signal);await this.bindings.activate(session,id,signal);return {...this.result(page),...await this.observation.snapshotData(page,{includeDocument:false,selector:c.observationSelector,maxTextChars:c.maxTextChars,maxRefs:c.maxRefs})};
  }
  const id=c.tabId||this.selected.get(session)||this.bindings.active(session);
  const page=await this.pageFor(session,id);if(c.action!=='close_tab')this.selectPage(session,id);
  if(c.action==='select_tab'){await this.bindings.activate(session,id,signal);return this.result(page);}
  if(c.action==='close_tab'){await this.bindings.close(session,id,signal);this.forgetPage(id);const activeTabId=this.selected.get(session);if(activeTabId)await this.bindings.activate(session,activeTabId,signal);return {closed:true,activeTabId,tabs:this.bindings.tabs(session)};}
  if(c.action==='snapshot')return {...this.result(page),...await this.observation.snapshotData(page,c)};
  if(['evaluate','cdp','storage'].includes(c.action))return {...this.result(page),...await this.capabilities[c.action](session,page,c,signal)};
  if(c.action==='table')return {...this.result(page),table:await readTable(await this.locator(page,c),c)};
  if(c.action==='editor'){
   const locator=await this.locator(page,c);
   if(c.editorAction&&c.editorAction!=='read'&&(this.dialogs.has(id)||this.bindings.managedDialogs?.get(id)))throw Error('Resolve the active dialog before editing');
   const editor=await this.runAction(page,()=>editSurface(locator,c),signal);
   if(c.editorAction&&c.editorAction!=='read')this.epochs.set(page,++this.nextEpoch);
   return {...this.result(page),editor};
  }
  if(c.action==='inspect')return {...this.result(page),...await inspectPage(page,c)};
  if(c.action==='request')return {...this.result(page),response:await requestInPage(page,c)};
  if(c.action==='downloads')return {downloads:this.bindings.downloads(id)};
  if(c.action==='dialog')return this.handleDialog(page,id,c);

  if(c.action==='debug'){
   if(c.mode==='start'){this.rememberSite(session,page);await this.recorder.start(session,page);}if(c.mode==='stop'){this.recorder.stop(session);this.captureSites.delete(session);}
   if(c.mode==='clear')await this.archive.clear(session,id);
   const entries=this.console.filter(x=>x.tabId===id&&(!c.query||x.text.includes(c.query))).slice().reverse();
   const offset=Math.max(0,Math.trunc(c.offset||0)),limit=Math.max(1,Math.min(100,Math.trunc(c.maxResults||20))),textLimit=Math.max(1,Math.min(8000,Math.trunc(c.maxTextChars||2000)));
   const consoleRows=entries.slice(offset,offset+limit).map(row=>({...row,text:row.text.slice(0,textLimit),textTruncated:row.text.length>textLimit||undefined}));
   return {...this.result(page),console:consoleRows,consoleTotal:entries.length,consoleNextOffset:offset+consoleRows.length<entries.length?offset+consoleRows.length:undefined,network:await this.archive.list(session,{tabId:id,limit:c.limit??20}),capture:this.recorder.status(session)};
  }
  if(c.action==='network'){
   if(c.networkAction==='replay')return replayBrowserRequest(this.archive,session,page,c);
   if(c.networkAction==='mock')return mockBrowserResponse(page,c,r=>this.recorder.markMocked(r));
   if(c.networkAction==='unmock')return unmockBrowserResponse(page,c.url);
  }
  if(c.action==='screenshot'){
   const folder=path.join(this.bindings.root,'analysis/browser-shots');fs.mkdirSync(folder,{recursive:true});const file=path.join(folder,`agent-${Date.now()}.png`);await page.screenshot({path:file,fullPage:true});return {...this.result(page),path:file};
  }
  if(this.dialogs.has(id))throw Error('请先处理当前网页对话框，再执行其他操作。');
  const before=await this.observation.semanticPageState(page);let verified=false,execution;
  if(c.action==='batch')execution=await this.runAction(page,()=>executeBrowserSteps(page,c.steps,{epoch:()=>this.epochs.get(page)||0,signal,timeoutMs:c.timeoutMs,subscribeDialog:listener=>{const handler=info=>{if(info.tabId===id)listener();};this.bindings.managedDialogs?.on('open',handler);return ()=>this.bindings.managedDialogs?.off('open',handler);}}),signal);
  else if(c.action==='upload'){
   const files=c.files;if(!Array.isArray(files)||!files.length)throw Error('请选择要上传的文件；取消选择不会清空原有附件。');
   for(const file of files)if(typeof file!=='string'||!path.isAbsolute(file)||!fs.existsSync(file))throw Error('上传文件不存在，请重新选择。');
   const pending=this.choosers.get(id);
   if(!pending)throw Error('请先点击网页的上传按钮，捕获当前文件选择请求后再上传文件。');
   const locator=pending.chooser.element();
   const input=await locator.evaluate(e=>({directory:!!e.webkitdirectory,multiple:!!e.multiple}));
   if(input.directory){if(files.length!==1||!fs.statSync(files[0]).isDirectory())throw Error('此网页要求选择一个文件夹，请传入单个文件夹路径。');}
   else{if(files.some(file=>!fs.statSync(file).isFile()))throw Error('此网页只接受文件，不接受文件夹。');if(files.length>1&&!input.multiple)throw Error('此网页一次只接受一个文件。');}
   const delivered=input.directory?{files:await uploadDirectory(page,locator,files[0]),selectionConfirmed:true,uploadStatus:'not-verified'}:await selectInputFiles(locator,files,()=>pending.chooser.setFiles(files));
   if(this.choosers.get(id)===pending){this.choosers.delete(id);this.bindings.fileChooserDone(id);}return {...this.result(page),...delivered,...await this.observation.finishAction(page,before,{verified:true,signal})};
  }
  else if(c.action==='press_key'){if(typeof c.key!=='string')throw Error('缺少按键名称');await this.runAction(page,()=>page.keyboard.press(c.key),signal);}
  else if(c.action==='pointer'){
   if(c.pointer==='scroll')await scrollBrowserPage(page,c);else{if(!Number.isFinite(c.x)||!Number.isFinite(c.y))throw Error('缺少有效点击坐标');await this.runAction(page,()=>page.mouse.click(c.x,c.y,{clickCount:c.pointer==='double_click'?2:1}),signal);}
  }
  else if(['act','click','type'].includes(c.action)){const locator=await this.locator(page,c);await this.runAction(page,()=>interact(locator,{...c,interaction:c.interaction||(c.action==='type'?'type':'click')}),signal);}
  else throw Error('不支持的浏览器控制操作。');
  if(c.expect&&!this.dialogs.has(id)&&!this.bindings.managedDialogs?.get(id)){
   try{await waitForBrowserExpectation(page,c.expect,signal);verified=true;}
   catch(error){execution={...execution,outcome:signal?.aborted?'cancelled':'expectation-failed',verified:false,actionIssued:true,retrySafe:false,error:error.message,recovery:'操作已发出，先检查当前 DOM 或 Network 结果，不要自动重复执行。'};}
  }
  if(signal?.aborted)return {...this.result(page),execution:execution||{outcome:'cancelled',actionIssued:true,retrySafe:false}};
  if(this.dialogs.has(id)||this.bindings.managedDialogs?.get(id)||this.choosers.has(id))return {...this.result(page),execution};
  return {...this.result(page),...await this.observation.finishAction(page,before,{verified,signal,selector:c.observationSelector,maxTextChars:c.maxTextChars,maxRefs:c.maxRefs}),execution};
 }
 result(page){const id=this.pages.get(page),dialog=this.dialogs.get(id),chooser=this.choosers.get(id);const notice=[this.bindings.managedDialogs?.recent?.(id),this.dialogNotices.get(id)].filter(Boolean).sort((a,b)=>b.at-a.at)[0];return {tabId:id,url:page.url(),epoch:this.epochs.get(page),dialogNotice:notice&&Date.now()-notice.at<60000?notice:null,dialog:this.bindings.managedDialogs?.get(id)||(dialog?{dialogId:this.dialogTokens.get(dialog),type:dialog.type(),message:dialog.message()}:null),fileChooser:chooser?{pending:true,multiple:chooser.multiple,directory:chooser.directory,accept:chooser.accept}:null};}
 async runAction(page,run,signal){
  signal?.throwIfAborted();let finish,rejectAbort;
  const boundary=new Promise(resolve=>{finish=resolve;});
  // Intercept only for the duration of an automation action. Leaving a permanent
  // filechooser listener disables Chromium's normal native picker for human clicks.
  let captured;const capture=chooser=>{captured=(async()=>{const id=this.pages.get(page);try{const input=await chooser.element().evaluate(e=>({accept:e.accept||'',directory:!!e.webkitdirectory}));this.choosers.set(id,{chooser,...input,multiple:chooser.isMultiple()});this.bindings.fileChooser(id,{...input,multiple:chooser.isMultiple()});}catch{this.bindings.fileChooser(id,{error:'无法获取上传控件，请重新点击选择文件。'});}finally{finish();}})();};
  const stop=()=>finish();const managedStop=info=>{if(info.tabId===this.pages.get(page))finish();};this.bindings.managedDialogs?.on('open',managedStop);page.once('dialog',stop);page.once('filechooser',capture);
  const aborted=new Promise((_,reject)=>{rejectAbort=()=>reject(signal.reason);signal?.addEventListener('abort',rejectAbort,{once:true});});
  const operation=Promise.resolve().then(run).then(async result=>{
   // Flush browser events emitted by the input before removing the interception.
   // A click acknowledgement can arrive before its filechooser event.
   if(!page.isClosed())await page.evaluate(()=>{});return result;
  });operation.catch(()=>{});
  try{const result=await Promise.race([operation,boundary,aborted]);if(captured)await captured;return result;}
  finally{this.bindings.managedDialogs?.off('open',managedStop);page.off('dialog',stop);page.off('filechooser',capture);signal?.removeEventListener('abort',rejectAbort);}
 }
 async locator(page,c){
  if(c.ref&&parseBrowserRef(c.ref).epoch!==(this.epochs.get(page)||0))throw Error('页面元素引用已失效，请重新读取页面后再操作。');
  const selector=c.ref?`[data-rae-ref=${JSON.stringify(c.ref)}]`:c.selector;if(!selector)throw Error('需要最新页面元素引用或明确的 CSS 选择器。');
  const candidates=[];for(const frame of page.frames()){const locator=frame.locator(selector);const count=await locator.count().catch(()=>0);if(count)candidates.push({locator,count});}
  if(candidates.reduce((n,c)=>n+c.count,0)!==1)throw Error('目标元素不存在或不唯一，请重新检查页面。');return candidates[0].locator;
 }
 async network(session,c){
  const owner=c.scope==='background'?browserBackgroundSession:session;
  const query={tabId:c.scope==='background'&&!String(c.tabId||'').startsWith('background:')?undefined:c.tabId,query:c.query,resourceType:c.resourceType,status:c.status,parentID:c.parentID,offset:c.offset,limit:c.limit,bodyState:c.bodyState};
  if(c.networkAction==='list')return {...await this.archive.list(owner,query),capture:this.recorder?.status(session)||{enabled:false,connected:false}};
  if(c.networkAction==='wait')return this.archive.wait(owner,query,{timeoutMs:c.timeoutMs,minCount:c.minCount});
  if(c.networkAction==='export')return this.archive.export(owner,query);
  if(c.networkAction==='clear'){await this.archive.clear(owner,c.tabId);return {cleared:true};}
  if(!c.recordID)throw Error('需要明确的 Network 请求 ID');
  if(c.networkAction==='get')return {record:await this.archive.get(owner,c.recordID)};
  if(c.networkAction==='body')return this.archive.body(owner,c.recordID,c.direction||'response',c);
  throw Error('不支持的 Network 查询');
 }
 async cancelChooser(id){this.choosers.delete(id);this.bindings.fileChooserDone(id);return {canceled:true};}
 chooser(id){const p=this.choosers.get(id);return p?{multiple:p.multiple,directory:p.directory,accept:p.accept}:null;}
 rememberSite(session,page){try{const origin=new URL(page.url()).origin;if(!/^https?:/.test(origin))return;const sites=this.captureSites.get(session)||new Set();sites.add(`${this.ownedContexts.get(page)||''}|${origin}`);this.captureSites.set(session,sites);}catch{}}
 backgroundAllowed(target){try{const origin=new URL(target.url).origin;return [...this.captureSites].some(([session,sites])=>this.recorder.enabled.has(session)&&sites.has(`${target.browserContextId||''}|${origin}`));}catch{return false;}}
}
