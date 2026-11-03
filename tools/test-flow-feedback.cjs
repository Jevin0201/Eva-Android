'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium,launchOptions}=require('./browser-test-env.cjs');
(async()=>{
 const browser=await chromium.launch(launchOptions());
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
   window.kernelPollingEnabled=false;
   window.EvaHost={load:()=>JSON.stringify({chats:[{id:'feedback',title:'反馈测试',messages:[],providerId:'ds',model:'deepseek-flash',kernelThread:{id:'thread',turns:[]}}],active:'feedback'}),save:()=>true,saveLater:()=>{},settings:()=>'{}',providers:()=>JSON.stringify({providers:[{id:'ds',model:'deepseek-flash'}],active:'ds'}),tasks:()=>'[]',kernelDrain:()=>'[]',kernelCall:()=>{}};
  });
  await page.route('https://eva.invalid/**',route=>{const name=new URL(route.request().url()).pathname.slice(1);return route.fulfill({body:fs.readFileSync('probe/assets/'+name),contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html'});});
  await page.goto('https://eva.invalid/index.html');
  await page.evaluate(()=>{route='chat';render();});
  const feedback=page.locator('.flow .eva-thinking');
  assert.equal(await feedback.count(),0,'idle conversation has no fabricated progress');
  await page.evaluate(()=>{const c=active();c.pending='测试任务';c.running=true;evaFlowFeedback.begin(c);updateKernelFlow(c);});
  assert.equal(await feedback.count(),1);assert.equal(await feedback.locator('.eva-thinking-text').evaluate(el=>el.firstChild.textContent),'正在连接内核');
  await page.evaluate(()=>{evaFlowFeedback.stage(active(),'submitting');updateKernelFlow(active());});
  assert.equal(await feedback.locator('.eva-thinking-text').evaluate(el=>el.firstChild.textContent),'正在提交任务');
  await page.evaluate(()=>kernelEvent({method:'turn/started',params:{threadId:'thread',turn:{id:'turn',status:'inProgress',items:[]}}}));
  assert.equal(await feedback.locator('.eva-thinking-text').evaluate(el=>el.firstChild.textContent),'正在思考','accepted empty turn replaces submission feedback');const geometry=await feedback.evaluate(el=>{const base=el.querySelector('.eva-thinking-text'),sweep=el.querySelector('.eva-thinking-sweep');return {position:getComputedStyle(sweep).position,font:getComputedStyle(el).fontSize,contained:sweep.getBoundingClientRect().width<=base.getBoundingClientRect().width+1}});assert.equal(geometry.position,'absolute');assert.equal(geometry.font,'14px');assert(geometry.contained);for(const width of [320,390]){await page.setViewportSize({width,height:844});assert(await page.locator('.controls').evaluate(el=>el.scrollWidth<=el.clientWidth+1))}await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>kernelEvent({method:'item/started',params:{threadId:'thread',turnId:'turn',item:{id:'command',type:'commandExecution',command:'echo test',status:'inProgress'}}}));
  assert.equal(await feedback.count(),0,'active tool owns progress without second thinking row');
  assert.equal(await page.locator('[data-activity-state="active"]').count(),1);
  await page.evaluate(()=>{active().kernelThread.turns[0].items=[];kernelApprovals.set('approval',{method:'item/commandExecution/requestApproval',params:{threadId:'thread',command:'test'}});updateKernelFlow(active());});
  assert.equal(await page.locator('.kernel-approval').count(),1);assert.equal(await feedback.count(),0,'approval blocks misleading thinking');
  await page.evaluate(()=>{kernelApprovals.clear();updateKernelFlow(active());});
  assert.equal(await feedback.count(),1,'thinking returns after approval clears');
  // Drive the actual models.js event/delta path, retaining the same assistant node.
  await page.evaluate(()=>kernelEvent({method:'item/started',params:{threadId:'thread',turnId:'turn',item:{id:'answer',type:'agentMessage',phase:'final_answer',status:'inProgress',text:'开始'}}}));
  assert.equal(await feedback.count(),0,'visible answer replaces generic progress');
  await page.evaluate(()=>{window.savedAssistant=document.querySelector('.assistant[data-flow-key="answer"]');window.savedTurn=document.querySelector('section[data-turn="turn"]');});
  assert.equal(await page.evaluate(()=>!!window.savedAssistant),true);
  for(const delta of ['，继续','，完成'])await page.evaluate(delta=>kernelEvent({method:'item/agentMessage/delta',params:{threadId:'thread',turnId:'turn',itemId:'answer',delta}}),delta);
  assert.equal(await page.locator('.assistant[data-flow-key="answer"]').innerText(),'开始，继续，完成');
  assert.equal(await page.evaluate(()=>savedAssistant===document.querySelector('.assistant[data-flow-key="answer"]')&&savedTurn===document.querySelector('section[data-turn="turn"]')),true,'streaming updates patch rather than replace assistant DOM');
  await page.evaluate(()=>kernelEvent({method:'turn/completed',params:{threadId:'thread',turn:{id:'turn',status:'completed',items:[{id:'answer',type:'agentMessage',phase:'final_answer',status:'completed',text:'开始，继续，完成'}]}}}));
  assert.equal(await feedback.count(),0);assert.equal(await page.locator('section[data-turn="response-status"]').count(),0);
  assert.equal(await page.evaluate(()=>active().running),false);
  assert.equal(await page.evaluate(()=>evaFlowFeedback.samples.at(-1)?.status),'completed');
  assert.deepEqual(errors,[],'page scripts must run without uncaught errors');
  console.log('PASS feedback lifecycle, exclusive tool progress, approval blocking, completion cleanup, streaming assistant DOM identity');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
