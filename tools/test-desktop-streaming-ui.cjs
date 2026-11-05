'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const {chromium,launchOptions}=require('./browser-test-env.cjs');
const mode=process.env.EVA_STREAM_MODE||'legacy';
(async()=>{
 const browser=await chromium.launch(launchOptions());
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(mode=>{
   window.EVA_STREAM_MODE=mode;window.kernelPollingEnabled=false;window.fixtureEvents=[];
   const turns=Array.from({length:24},(_,i)=>({id:'past'+i,status:'completed',items:[{id:'past-user'+i,type:'userMessage',content:[{type:'text',text:'历史问题'+i}]},{id:'past-agent'+i,type:'agentMessage',phase:'final_answer',text:'历史回答 '+('用于检查阅读时的滚动位置。'.repeat(30))}]}));
   window.EvaHost={load:()=>JSON.stringify({projects:[],drafts:[],chats:[{id:'fixture',title:'stream fixture',providerId:'fixture',model:'fixture',messages:[],kernelThread:{id:'fixture-thread',turns}}],active:'fixture'}),save:()=>true,saveLater:()=>{},settings:()=>'{}',providers:()=>JSON.stringify({providers:[{id:'fixture',name:'fixture',model:'fixture'}],active:'fixture'}),tasks:()=>'[]',kernelDrain:()=>JSON.stringify(fixtureEvents.splice(0)),kernelCall:()=>{}};
  },mode);
  await page.route('https://eva.invalid/**',route=>{
   const name=new URL(route.request().url()).pathname.slice(1),file='probe/assets/'+name;
   if(!fs.existsSync(file))return route.fulfill({status:404,body:''});
   return route.fulfill({body:fs.readFileSync(file),contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html'});
  });
  await page.goto('https://eva.invalid/index.html');
  if(mode==='desktop')await page.waitForFunction(()=>window.evaDesktopStream?.enabled===true);
  if(mode==='desktop') {
   const flow=page.locator('.flow');
   await page.evaluate(()=>{const f=document.querySelector('.flow');window.evaChatScroll.before(f,active().id);f.scrollTop=f.scrollHeight;});
   assert.equal(await flow.evaluate(e=>getComputedStyle(e).overflowY),'auto','mobile transcript allows native touch scrolling');
   const session=await page.context().newCDPSession(page),box=await flow.boundingBox();
   const before=await flow.evaluate(e=>e.scrollTop);
   await session.send('Input.synthesizeScrollGesture',{x:Math.round(box.x+box.width/2),y:Math.round(box.y+box.height/3),yDistance:220,speed:450,gestureSourceType:'touch'});
   const earlier=await flow.evaluate(e=>e.scrollTop);
   assert.ok(earlier<before-60,'finger swipe reads earlier history');
   await session.send('Input.synthesizeScrollGesture',{x:Math.round(box.x+box.width/2),y:Math.round(box.y+box.height*2/3),yDistance:-160,speed:450,gestureSourceType:'touch'});
   assert.ok(await flow.evaluate(e=>e.scrollTop)>earlier+40,'reverse finger swipe reads later history');
   await session.detach();
  }
  const report=await page.evaluate(async mode=>{
   route='chat';render();
   const durations=[],previousUpdate=updateKernelFlow;
   updateKernelFlow=function(chat){const start=performance.now();try{return previousUpdate(chat);}finally{durations.push(performance.now()-start);}};
   const threadId='fixture-thread',turnId='live';
   const emit=(method,params)=>kernelEvent({method,params:{threadId,turnId,...params}});
   emit('turn/started',{turn:{id:turnId,status:'inProgress',items:[]}});
   emit('item/started',{item:{id:'live-agent',type:'agentMessage',phase:'commentary',text:'正文片段0000\n\n'}});
   emit('item/started',{item:{id:'live-command',type:'commandExecution',command:'fixture output',status:'inProgress',aggregatedOutput:''}});
   function text(root){let result=root?.textContent||'';function shadows(node){if(node.shadowRoot){result+=node.shadowRoot.textContent;for(const child of node.shadowRoot.children)shadows(child);}for(const child of node.children||[])shadows(child);}if(root)shadows(root);return result;}
   function openDetails(root){for(const button of root.querySelectorAll('button[aria-expanded="false"]'))button.click();for(const node of root.querySelectorAll('*'))if(node.shadowRoot)openDetails(node.shadowRoot);}
   function assistant(){const selectors=mode==='desktop'?'[data-native-steering]':'.assistant.markdown';return [...document.querySelectorAll(selectors)].find(node=>text(node).includes('正文片段0000'));}
   await new Promise((resolve,reject)=>{const until=performance.now()+5000;function wait(){if(assistant())resolve();else if(performance.now()>until)reject(Error('Streaming assistant host did not appear'));else requestAnimationFrame(wait);}wait();});
   const flow=document.querySelector('.flow'),originalAssistant=assistant(),originalShadow=originalAssistant.shadowRoot;
   let previousCount=1,frames=0,blankFrames=0,rebuilds=0,shadowRebuilds=0,regressions=0,flowRebuilds=0,readingTop=null,maxReadingDrift=0,finished=false;
   let largestCount=1;
   const sample=()=>{
    const current=assistant();frames++;
    if(document.querySelector('.flow')!==flow)flowRebuilds++;
    if(!current)blankFrames++;
    else{
     if(current!==originalAssistant)rebuilds++;
     if(current===originalAssistant&&current.shadowRoot!==originalShadow)shadowRebuilds++;
     const count=new Set(text(current).match(/正文片段\d{4}/g)||[]).size;
     if(count<previousCount)regressions++;
     previousCount=count;largestCount=Math.max(largestCount,count);
    }
    if(readingTop!=null)maxReadingDrift=Math.max(maxReadingDrift,Math.abs(flow.scrollTop-readingTop));
    if(!finished)requestAnimationFrame(sample);
   };
   requestAnimationFrame(sample);
   let expected='正文片段0000\n\n',queue=[],lastFlush=performance.now();
   const flush=()=>{kernelDraining=true;try{for(const event of queue)kernelEvent(event);}finally{queue=[];kernelDraining=false;updateKernelFlow(active());refreshKernelControls();lastFlush=performance.now();}};
   for(let i=1;i<=540;i++){
    const content=(i%30===1?'```javascript\n':i%30===15?'```\n\n':'')+'正文片段'+String(i).padStart(4,'0')+' '+('payload '.repeat(3))+'\n';expected+=content;
    queue.push({method:'item/agentMessage/delta',params:{threadId,turnId,itemId:'live-agent',delta:content}});
    queue.push({method:'item/commandExecution/outputDelta',params:{threadId,turnId,itemId:'live-command',delta:'tool output '+i+'\n'}});
    if(performance.now()-lastFlush>=150)flush();
    if(i===120){flush();flow.scrollTop=300;flow.dispatchEvent(new Event('scroll'));readingTop=flow.scrollTop;}
    if(i===450){readingTop=null;document.querySelector('.chat-scroll-bottom')?.click();}
    await new Promise(resolve=>setTimeout(resolve,16));
   }
   flush();
   for(let pass=0;pass<3;pass++){openDetails(flow);await new Promise(resolve=>setTimeout(resolve,220));}
   await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
   const finalText=text(assistant()),modelText=active().kernelThread.turns.find(t=>t.id===turnId).items.find(i=>i.id==='live-agent').text;
   finished=true;
   const sorted=[...durations].sort((a,b)=>a-b);
   return {mode,frames,blankFrames,rebuilds,shadowRebuilds,regressions,flowRebuilds,largestCount,finalCount:new Set(finalText.match(/正文片段\d{4}/g)||[]).size,modelExact:modelText===expected,toolOutputVisible:text(flow).includes('tool output 540'),maxReadingDrift,finalBottomGap:flow.scrollHeight-flow.clientHeight-flow.scrollTop,updates:durations.length,p95UpdateMs:sorted[Math.floor(sorted.length*.95)]||0,maxUpdateMs:Math.max(0,...durations)};
  },mode);
  fs.mkdirSync('artifacts/desktop-streaming',{recursive:true});
  fs.writeFileSync('artifacts/desktop-streaming/'+mode+'.json',JSON.stringify({report,errors},null,2));
  console.log(JSON.stringify({report,errors}));
  assert.equal(report.flowRebuilds,0,'flow node identity retained');
  assert.equal(report.blankFrames,0,'no blank message frame');
  assert.equal(report.rebuilds,0,'assistant host retained for 540 deltas');
  assert.equal(report.shadowRebuilds,0,'assistant shadow root retained');
  assert.equal(report.regressions,0,'rendered fragment count grows monotonically');
  assert.equal(report.finalCount,541,'all fragments rendered');
  assert.equal(report.modelExact,true,'exact stream contents retained');
  assert.equal(report.toolOutputVisible,true,'latest command output visible in tool detail');
  assert.ok(report.maxReadingDrift<3,'reading earlier history is not pulled');
  assert.ok(report.finalBottomGap<=25,'jump button resumes bottom follow');
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
