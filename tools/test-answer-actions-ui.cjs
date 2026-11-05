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
   const turn={id:'changed',status:'completed',items:[{id:'u',type:'userMessage',content:[{type:'text',text:'调整设置'}]},{id:'f',type:'fileChange',status:'completed',changes:[{path:'/root/eva-workspace/settings.js',kind:'update',diff:'@@ -1 +1 @@\n-old\n+new'}]},{id:'a',type:'agentMessage',phase:'final_answer',text:'已整理设置。'}]};
   window.copied=[];window.EvaHost={load:()=>JSON.stringify({projects:[],drafts:[],chats:[{id:'fixture',title:'回答操作',messages:[],kernelThread:{id:'fixture-thread',turns:[turn]}}],active:'fixture'}),save:()=>true,saveLater:()=>{},settings:()=>'{}',providers:()=>'{"providers":[],"active":""}',tasks:()=>'[]',kernelDrain:()=>'[]',kernelCall:()=>{},copyText:text=>{copied.push(text);return true}};
  });
  await page.route('https://eva.invalid/**',route=>{
   const file='probe/assets/'+new URL(route.request().url()).pathname.slice(1);
   if(!fs.existsSync(file))return route.fulfill({status:404,body:''});
   return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'});
  });
  await page.goto('https://eva.invalid/index.html');
  await page.waitForFunction(()=>window.evaDesktopStream?.enabled);
  await page.evaluate(()=>{route='chat';render()});
  const summary=page.locator('.turn-changes-summary');await summary.waitFor();
  assert.equal(await page.locator('[data-turn-menu]').count(),0);
  assert.equal(await page.locator('[data-revert-turn]').count(),0);
  assert.equal(await page.locator('[data-copy-turn="changed"]').count(),1);
  await page.locator('[data-copy-turn="changed"]').click();
  assert.deepEqual(await page.evaluate(()=>copied),['已整理设置。']);
  await summary.click();
  await page.locator('.turn-diff-panel .diff-file').waitFor();
  assert((await page.locator('.turn-diff-panel').innerText()).includes('settings.js'));
  await page.getByRole('button',{name:'关闭',exact:true}).click();
  assert.equal(await page.locator('#eva-panel').count(),0);
  fs.mkdirSync('artifacts/answer-actions',{recursive:true});
  for(const width of [320,390,800]){
   await page.setViewportSize({width,height:844});
   assert.equal(await summary.evaluate(e=>e.scrollWidth>e.clientWidth),false);
   await page.screenshot({path:`artifacts/answer-actions/summary-${width}.png`});
  }
  assert.deepEqual(errors,[]);
  console.log('PASS actual Android renderer copy, direct diff opening/closing, no duplicate menu/unsupported undo, 320/390/800px summaries');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
