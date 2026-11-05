const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium,launchOptions}=require('./browser-test-env.cjs');
(async()=>{
 const browser=await chromium.launch(launchOptions());
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   window.focused=true;document.hasFocus=()=>focused;
   window.EvaHost={load:()=>JSON.stringify({chats:[{id:'a',title:'active chat',messages:[],kernelThread:{id:'ta',turns:[]}},{id:'b',title:'project task',projectId:'p',messages:[],kernelThread:{id:'tb',turns:[]}}],drafts:[],projects:[{id:'p',name:'project'}],sidebarState:{p:false},active:'a'}),save:()=>true,saveLater:()=>{},settings:()=>'{}',tasks:()=>'[]',providers:()=>JSON.stringify({providers:[{id:'test',name:'test',model:'test'}],active:'test'}),kernelDrain:()=>'[]',kernelCall:()=>{}};
  });
  await page.route('https://eva.invalid/**',route=>{const n=new URL(route.request().url()).pathname.slice(1);route.fulfill({body:fs.readFileSync('probe/assets/'+n),contentType:n.endsWith('.js')?'text/javascript':n.endsWith('.css')?'text/css':'text/html'});});
  await page.goto('https://eva.invalid/index.html');
  await page.addStyleTag({url:'https://eva.invalid/desktop-task-status.css'});
  await page.evaluate(()=>{route='chat';render();kernelEvent({method:'turn/started',params:{threadId:'tb',turn:{id:'work',status:'inProgress',items:[]}}});});
  const task=page.locator('[data-running-tasks] [data-action="chat:b"]');
  assert.equal(await task.count(),1,'collapsed project is still represented in running region');
  assert.equal(await task.locator('.ti-spinner').count(),1);
  assert.equal(await task.locator('.ti-spinner').evaluate(n=>getComputedStyle(n).animationDuration),'1.25s');
  await page.evaluate(()=>{window.originalSpinner=document.querySelector('[data-running-tasks] .ti-spinner');evaDesktopActivity.paint();});
  assert.equal(await page.evaluate(()=>originalSpinner===document.querySelector('[data-running-tasks] .ti-spinner')),true,'repaint retains ongoing animation DOM');
  await page.evaluate(()=>{focused=false;kernelEvent({method:'turn/completed',params:{threadId:'tb',turn:{id:'work',status:'completed',items:[]}}});data.sidebarState.p=true;sidebar();});
  assert.equal(await page.locator('[data-running-tasks]').count(),0);
  const row=page.locator('.tree-chat[data-action="chat:b"]');
  assert.equal(await row.locator('.ti-unread').count(),1);
  assert.equal(await row.locator('.ti-unread').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(57, 129, 247)');
  await page.evaluate(()=>{data.active='b';render();});
  assert.equal(await row.locator('.ti-unread').count(),1,'background selection does not mark viewed');
  await page.evaluate(()=>{focused=true;evaDesktopActivity.paint();});
  assert.equal(await row.locator('.ti-unread').count(),0,'foreground viewing clears completion dot');
  await page.evaluate(()=>{
   const dialog=document.createElement('div');dialog.setAttribute('role','dialog');dialog.textContent='遮挡中的设置';document.body.append(dialog);
   kernelEvent({method:'turn/started',params:{threadId:'tb',turn:{id:'blocked',status:'inProgress',items:[]}}});
   kernelEvent({method:'turn/completed',params:{threadId:'tb',turn:{id:'blocked',status:'completed',items:[]}}});
  });
  assert.equal(await row.locator('.ti-unread').count(),1,'overlay does not count as viewing conversation');
  await page.evaluate(()=>{document.querySelector('[role="dialog"]').remove();evaDesktopActivity.paint();});
  assert.equal(await row.locator('.ti-unread').count(),0);
  await page.evaluate(()=>kernelEvent({method:'thread/status/changed',params:{threadId:'ta',status:{type:'active'}}}));
  assert.equal(await page.locator('[data-running-tasks] [data-action="chat:a"] .ti-spinner').count(),1,'native runtime status creates running row');
  await page.evaluate(()=>kernelEvent({method:'thread/status/changed',params:{threadId:'ta',status:{type:'idle'}}}));
  await page.evaluate(()=>{data.drafts.push({id:'draft-task',title:'starting',running:true,pending:'message'});evaDesktopActivity.paint();});
  assert.equal(await page.locator('[data-running-tasks] [data-action="chat:draft-task"]').count(),1);
  assert.equal(await page.locator('[data-running-tasks] .running-task-detail').textContent(),'正在启动');
  await page.evaluate(()=>{window.clicked=null;navigate=action=>{window.clicked=action;};document.querySelector('[data-running-tasks] [data-action="chat:draft-task"]').click();});
  assert.equal(await page.evaluate(()=>window.clicked),'chat:draft-task');
  assert.deepEqual(errors,[]);
  const lifecycle=await page.evaluate(()=>{
   const chat={id:'lifecycle',title:'lifecycle',messages:[],kernelThread:{id:'tl',turns:[]}};data.chats.push(chat);
   const event=(method,id,status)=>kernelEvent({method,params:{threadId:'tl',turn:{id,status,items:[]}}});
   event('turn/started','old','inProgress');event('turn/started','new','inProgress');
   event('turn/completed','old','completed');const stillRunning=chat.running;
   event('turn/completed','new','completed');
   chat.kernelThread.turns[0].status='inProgress';syncKernelRunning(chat);
   return {stillRunning,terminalRunning:chat.running,status:chat.kernelThread.status.type};
  });
  assert.deepEqual(lifecycle,{stillRunning:true,terminalRunning:false,status:'idle'},'older turn completion or cached incomplete history never changes the newest active turn');
  console.log('PASS running group across collapsed projects/drafts, continuous original spinner, blue unread completion, background preservation and foreground read, same-chat navigation');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
