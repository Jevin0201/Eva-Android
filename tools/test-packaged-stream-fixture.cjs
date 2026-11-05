'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const {chromium,launchOptions}=require('./browser-test-env.cjs');
const mode='desktop';
(async()=>{
 const browser=await chromium.launch(launchOptions());
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(mode=>{
   window.TestHost={done(raw){window.pressureResult=JSON.parse(raw);}};window.EVA_STREAM_MODE=mode;window.kernelPollingEnabled=false;window.fixtureEvents=[];
   const turns=Array.from({length:24},(_,i)=>({id:'past'+i,status:'completed',items:[{id:'past-user'+i,type:'userMessage',content:[{type:'text',text:'历史问题'+i}]},{id:'past-agent'+i,type:'agentMessage',phase:'final_answer',text:'历史回答 '+('用于检查阅读时的滚动位置。'.repeat(30))}]}));
   window.EvaHost={load:()=>JSON.stringify({projects:[],drafts:[],chats:[{id:'fixture',title:'stream fixture',providerId:'fixture',model:'fixture',messages:[],kernelThread:{id:'fixture-thread',turns}}],active:'fixture'}),save:()=>true,saveLater:()=>{},settings:()=>'{}',providers:()=>JSON.stringify({providers:[{id:'fixture',name:'fixture',model:'fixture'}],active:'fixture'}),tasks:()=>'[]',kernelDrain:()=>JSON.stringify(fixtureEvents.splice(0)),kernelCall:()=>{}};
  },mode);
  await page.route('https://eva.invalid/**',route=>{
   const name=new URL(route.request().url()).pathname.slice(1),file='probe/assets/'+name;
   if(!fs.existsSync(file))return route.fulfill({status:404,body:''});
   let body=fs.readFileSync(file);if(name==='index.html')body=body.toString().replace('<script src="app.js">','<script src="desktop-stream-check.js"></script><script src="app.js">');return route.fulfill({body,contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html'});
  });
  await page.goto('https://eva.invalid/index.html');
  if(mode==='desktop')await page.waitForFunction(()=>window.evaDesktopStream?.enabled===true);
  await page.waitForFunction(()=>window.pressureResult,{timeout:90000});
  const report=await page.evaluate(()=>window.pressureResult);console.log(JSON.stringify(report));assert.equal(report.passed,true);assert.deepEqual(errors,[]);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
