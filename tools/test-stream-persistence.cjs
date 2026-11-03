const fs=require('fs'),assert=require('assert/strict'),{chromium,launchOptions}=require('./browser-test-env.cjs');
(async()=>{const browser=await chromium.launch(launchOptions());try{
 const page=await browser.newPage();
 await page.addInitScript(()=>{window.EvaHost={load:()=>JSON.stringify({chats:[{id:'draft',messages:[],draft:''},{id:'loaded',messages:[],kernelThread:{id:'thread-a',turns:[]}}],active:'draft'}),save:()=>true,settings:()=>'{"theme":"light"}',providers:()=>'{"providers":[]}',kernelDrain:()=>'[]',tasks:()=>'[]',open:()=>{}}});
 await page.route('https://eva.invalid/**',r=>{const name=new URL(r.request().url()).pathname.slice(1);return r.fulfill({body:fs.readFileSync('probe/assets/'+name),contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html'})});
 await page.goto('https://eva.invalid/index.html');
 await page.evaluate(()=>{window.writes=[];EvaHost.saveLater=value=>writes.push({at:performance.now(),state:JSON.parse(value)});window.producer=setInterval(()=>{data.draft=String(Number(data.draft||0)+1);scheduleKernelSave()},50)});
 await page.waitForFunction(()=>writes.length>=3,{},{timeout:4000});
 const running=await page.evaluate(()=>{clearInterval(producer);return writes.map(x=>Number(x.state.draft))});assert(running[0]>0);assert(running.every((n,i)=>!i||n>running[i-1]));
 await page.evaluate(()=>{data.draft='background-final';scheduleKernelSave();window.dispatchEvent(new Event('pagehide'))});
 assert.equal(await page.evaluate(()=>writes.at(-1).state.draft),'background-final');
 const before=await page.evaluate(()=>{data.draft='durable';scheduleKernelSave();saveKernel();return writes.length});await page.waitForTimeout(650);assert.equal(await page.evaluate(()=>writes.length),before);
 await page.evaluate(()=>{EvaHost.saveLater=()=>{throw Error('fixture storage error')};scheduleKernelSave();flushKernelSave()});assert.equal(await page.evaluate(()=>kernelNotice),'fixture storage error');
 await page.evaluate(()=>{EvaHost.saveLater=value=>writes.push({state:JSON.parse(value)});data.draft='recovered';scheduleKernelSave();flushKernelSave()});assert.equal(await page.evaluate(()=>writes.at(-1).state.draft),'recovered');
 console.log('PASS continuous stream checkpoints, background flush, synchronous-save cancellation, storage failure and recovery');
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
