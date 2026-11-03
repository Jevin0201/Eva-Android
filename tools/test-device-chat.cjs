// Real device test through Eva's own WebView and native kernel bridge.
// Requires adb forward tcp:9223 localabstract:webview_devtools_remote_<Eva PID>.
const {chromium}=require('playwright-core');
const fs=require('fs');
(async()=>{
 const browser=await chromium.connectOverCDP('http://127.0.0.1:9223');
 try{
  const page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url()==='https://eva.invalid/index.html');
  if(!page)throw Error('Eva conversation WebView not open');
  await page.waitForFunction(()=>typeof kernelCall==='function'&&typeof kernelSend==='function',{},{timeout:15000});
  const prompt=process.env.EVA_TEST_PROMPT||'请只回复：DeepSeek 连通测试成功。不使用任何工具。';
  await page.evaluate(()=>{
   if(window.evaTimingInstalled)return;window.evaTimingInstalled=true;
   const call=kernelCall,event=kernelEvent,flow=updateKernelFlow;
   kernelCall=async function(method,params){const start=performance.now();try{return await call(method,params)}finally{if(window.evaTiming)evaTiming.calls.push({method,ms:Math.round(performance.now()-start)})}};
   kernelEvent=function(e){const t=window.evaTiming;if(t){const method=e.method+(e.params?.item?.type?':'+e.params.item.type:'');if(e.method&&!t.events.some(x=>x.method===method))t.events.push({method,ms:Math.round(performance.now()-t.start)});if(e.method==='item/agentMessage/delta'&&t.firstTextMs==null)t.firstTextMs=Math.round(performance.now()-t.start);if(e.method==='turn/completed')t.completedMs=Math.round(performance.now()-t.start);}return event(e)};
   updateKernelFlow=function(c){const start=performance.now();try{return flow(c)}finally{if(window.evaTiming){evaTiming.renders++;evaTiming.renderMs+=performance.now()-start}}};
  });
  if(process.argv.includes('--send')||process.argv.includes('--continue'))await page.evaluate(({prompt,continuing})=>{
   if(kernelBusy||active()?.running)throw Error('Wait for current task before testing');
   window.evaTiming={start:performance.now(),calls:[],renders:0,renderMs:0,events:[]};if(EvaHost.kernelTrace)EvaHost.kernelTrace(true);if(!continuing)navigate('new');document.querySelector('#prompt').value=prompt;kernelSend();
  },{prompt,continuing:process.argv.includes('--continue')});
  await page.waitForFunction(()=>!kernelBusy&&!active()?.running,{},{timeout:55000}).catch(()=>{});
  const report=await page.evaluate(()=>({chatId:active()?.id,model:active()?.model,notice:kernelNotice,running:kernelBusy||!!active()?.running,timing:window.evaTiming,nativeTiming:EvaHost.kernelTrace?JSON.parse(EvaHost.kernelTrace(false)):null,
   turns:active()?.kernelThread?.turns.map(t=>({id:t.id,status:t.status,error:t.error,
    items:t.items.filter(i=>['agentMessage','dynamicToolCall','commandExecution','fileChange'].includes(i.type)).map(i=>({type:i.type,phase:i.phase,text:i.text,tool:i.tool,status:i.status,success:i.success,command:i.command,exitCode:i.exitCode,contentItems:i.contentItems?.filter(c=>c.type==='inputText')}))}))}));
  fs.mkdirSync('artifacts/acceptance-0.0.28',{recursive:true});
  fs.writeFileSync('artifacts/acceptance-0.0.28/'+report.chatId+'.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify({chatId:report.chatId,model:report.model,notice:report.notice,running:report.running,timing:report.timing,nativeTiming:report.nativeTiming,turns:report.turns?.map(t=>({status:t.status,error:t.error,items:t.items.map(i=>({type:i.type,tool:i.tool,success:i.success,status:i.status,text:i.text,exitCode:i.exitCode}))}))},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
