const fs=require('fs'),assert=require('assert/strict'),{chromium,launchOptions}=require('./browser-test-env.cjs');
(async()=>{const browser=await chromium.launch(launchOptions());try{
 const page=await browser.newPage();
 await page.addInitScript(()=>{window.EvaHost={load:()=>JSON.stringify({chats:[{id:'draft',messages:[],draft:''},{id:'loaded',messages:[],kernelThread:{id:'thread-a',turns:[]}}],active:'draft'}),save:()=>true,settings:()=>'{"theme":"light"}',providers:()=>'{"providers":[]}',kernelDrain:()=>'[]',tasks:()=>'[]',open:()=>{}}});
 await page.route('https://eva.invalid/**',r=>{const name=new URL(r.request().url()).pathname.slice(1);return r.fulfill({body:fs.readFileSync('probe/assets/'+name),contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html'})});
 await page.goto('https://eva.invalid/index.html');
 const result=await page.evaluate(()=>{
  for(const event of [{method:'thread/started',params:{thread:{id:'new-thread'}}},{method:'account/rateLimits/updated',params:{rateLimits:{}}},{method:'model/list/updated',params:{}},{method:'turn/started',params:{threadId:'unknown',turn:{id:'ignored',items:[]}}}])kernelEvent(event);
  kernelEvent({method:'turn/started',params:{threadId:'thread-a',turn:{id:'turn-a',status:'inProgress',items:[]}}});
  kernelEvent({method:'item/agentMessage/delta',params:{threadId:'thread-a',turnId:'turn-a',itemId:'message-a',delta:'hello'}});
  kernelEvent({method:'item/started',params:{threadId:'thread-a',turnId:'turn-a',item:{id:'message-a',type:'agentMessage',text:''}}});
  return {notice:kernelNotice,draftThread:active().kernelThread??null,text:data.chats.find(c=>c.id==='loaded').kernelThread.turns[0].items[0].text};
 });
 assert.deepEqual(result,{notice:'',draftThread:null,text:'hello'});console.log('PASS global and unknown-thread events isolated; draft preserved; delta-before-item retained');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
