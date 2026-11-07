'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium,launchOptions}=require('./browser-test-env.cjs');
(async()=>{
 const browser=await chromium.launch(launchOptions());
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
   window.events=[];window.workspaceOpens=[];
   window.EvaHost={load:()=>JSON.stringify({projects:[],drafts:[],chats:[{id:'layout',title:'布局测试',messages:[],providerId:'fixture',model:'fixture',kernelThread:{id:'thread',turns:[{id:'past',status:'completed',items:[{id:'body',type:'agentMessage',phase:'final_answer',text:'布局测试历史'}]}]}}],active:'layout'}),save:()=>true,saveLater:()=>{},settings:()=>'{}',providers:()=>JSON.stringify({providers:[{id:'fixture',model:'fixture'}],active:'fixture'}),tasks:()=>'[]',revealWorkspaceFile:path=>{workspaceOpens.push(path);return '';},kernelDrain:()=>JSON.stringify(events.splice(0)),kernelCall:(ticket,method)=>{events.push({ticket,result:method==='skills/list'?{data:[{skills:[{name:'layout-skill',path:'/root/.eva-codex/skills/layout/SKILL.md',enabled:true,description:'fixture'}]}]}:method==='plugin/installed'?{marketplaces:[]}:{} });}};
  });
  await page.route('https://eva.invalid/**',route=>{const n=new URL(route.request().url()).pathname.slice(1),f='probe/assets/'+n;route.fulfill({status:fs.existsSync(f)?200:404,body:fs.existsSync(f)?fs.readFileSync(f):'',contentType:n.endsWith('.js')?'text/javascript':n.endsWith('.css')?'text/css':'text/html'});});
  await page.goto('https://eva.invalid/index.html');
  await page.addStyleTag({url:'https://eva.invalid/composer-bottom-layout.css'});
  if(!await page.locator('script[src$="composer-bottom-layout.js"]').count())await page.addScriptTag({url:'https://eva.invalid/composer-bottom-layout.js'});
  await page.evaluate(()=>{route='chat';render();});
  assert.equal(await page.locator('.reference-open').count(),0);
  assert.equal(await page.locator('.project-caption').count(),0,'workspace never reserves an upper caption row');
  const workspace=page.getByRole('button',{name:'打开工作区：默认工作区',exact:true});
  assert.equal(await workspace.locator('svg').count(),1);
  await workspace.click();assert.deepEqual(await page.evaluate(()=>workspaceOpens),['']);
  await page.evaluate(()=>{active().model='gpt-6.1-terra';active().effort='medium';render();});
  assert.equal(await page.locator('.model-name').textContent(),'GPT-6.1 Terra');
  assert.equal(await page.locator('.model-effort').textContent(),'中');
  assert.equal(await page.evaluate(()=>active().model),'gpt-6.1-terra','display labels never rewrite the request ID');
  await page.evaluate(()=>{data.projects.push({id:'folder-test',name:'项目名称很长时仍然保留可点击文件夹入口'});active().projectId='folder-test';render();});
  await page.locator('.workspace-chip').click();assert.deepEqual(await page.evaluate(()=>workspaceOpens),['','projects/folder-test']);
  await page.evaluate(()=>{active().projectId=null;active().model='fixture';active().effort=null;render();});

  const permission=page.locator('.controls [data-action=kernel-permissions]');
  assert.equal(await permission.count(),1);
  assert.equal(await permission.locator('svg').count(),1);
  assert.equal(await permission.textContent(),'');
  assert.equal(await permission.getAttribute('aria-label'),'执行权限：请求批准');
  await permission.click();
  await page.locator('.permission-menu [data-permission-mode=full]').click();
  assert.equal(await permission.getAttribute('title'),'完全访问权限');
  assert.equal(await page.evaluate(()=>evaPermissions.params(active()).sandbox),'danger-full-access');
  await page.locator('#prompt').fill('@');
  await page.locator('.reference-picker [role=option]').first().waitFor();
  assert.ok((await page.locator('.reference-picker').textContent()).includes('layout-skill'));
  await page.locator('#prompt').fill('');
  const metrics=[];
  const session=await page.context().newCDPSession(page);
  await session.send('Emulation.setSafeAreaInsetsOverride',{insets:{bottom:20}});
  assert.equal(await page.evaluate(()=>{const probe=document.createElement('div');probe.style.paddingBottom='env(safe-area-inset-bottom)';document.body.append(probe);const inset=parseFloat(getComputedStyle(probe).paddingBottom);probe.remove();return inset;}),20,'fixture reproduces the device safe-area inset already handled by Android');
  for(const scenario of [{width:390,height:844,ime:false},{width:844,height:390,ime:false},{width:390,height:560,ime:true},{width:390,height:844,large:true}]){
   await page.setViewportSize({width:scenario.width,height:scenario.height});
   await page.evaluate(scenario=>{document.querySelector('#prompt').style.fontSize=scenario.large?'24px':'';evaKeyboardState({visible:!!scenario.ime});kernelNotice='引导信息已接收';refreshKernelControls();},scenario);
   await page.waitForFunction(()=>document.querySelector('.composer-status-strip span').textContent==='引导信息已接收');
   const geometry=await page.evaluate(()=>{
    const composer=document.querySelector('.composer').getBoundingClientRect(),dock=document.querySelector('.dock').getBoundingClientRect(),foot=document.querySelector('.composer-status-strip').getBoundingClientRect(),controls=document.querySelector('.controls').getBoundingClientRect(),permission=document.querySelector('[data-action=kernel-permissions]').getBoundingClientRect(),model=document.querySelector('.controls .model').getBoundingClientRect();
    const workspace=document.querySelector('.workspace-chip').getBoundingClientRect(),flow=document.querySelector('.flow').getBoundingClientRect();
    return {dockChildren:[...document.querySelector('.dock').children].map(e=>({class:e.className,height:e.getBoundingClientRect().height,margin:getComputedStyle(e).margin,top:e.getBoundingClientRect().top})),footCenter:(foot.left+foot.right)/2,footFont:getComputedStyle(document.querySelector('.composer-status-strip')).fontSize,composerCenter:(composer.left+composer.right)/2,workspaceBottom:workspace.bottom,workspaceTop:workspace.top,workspaceLeft:workspace.left,workspaceWidth:workspace.width,flowBottom:flow.bottom,dockTop:dock.top,width:innerWidth,height:innerHeight,composerLeft:composer.left,composerTop:composer.top,composerBottom:composer.bottom,composerHeight:composer.height,inputHeight:document.querySelector('#prompt').getBoundingClientRect().height,dockBottom:dock.bottom,bottomGap:dock.bottom-document.querySelector('.composer-footer').getBoundingClientRect().bottom,statusBottom:foot.bottom,controlsBottom:controls.bottom,permissionInside:permission.left>=composer.left&&permission.right<=composer.right,modelInside:model.right<=composer.right,footText:document.querySelector('.composer-status-strip').textContent,hasOldPermissionRow:!!document.querySelector('.permission-row')};
   });
   metrics.push(geometry);
   assert.ok(geometry.dockBottom<=scenario.height+1,JSON.stringify(geometry));
   assert.ok(geometry.composerTop>=0,JSON.stringify(geometry));
   assert.ok(geometry.bottomGap<=4,JSON.stringify(geometry));
   assert.equal(geometry.inputHeight,54,'recovered bottom space remains available for text at normal and large font sizes');
   assert.ok(geometry.composerBottom-geometry.controlsBottom>=0&&geometry.composerBottom-geometry.controlsBottom<=2,'controls stay inside and close to the composer bottom');
   assert.ok(geometry.workspaceTop>=geometry.composerBottom&&Math.abs(geometry.workspaceLeft-geometry.composerLeft)<8,'folder chip stays at composer lower-left edge');
   assert.ok(geometry.flowBottom<=geometry.dockTop+1,'content area ends at dock without a workspace overlay');
   assert.ok(Math.abs(geometry.footCenter-geometry.composerCenter)<1,'status stays centered on the full composer');
   assert.equal(geometry.footFont,'11px');
   assert.ok(geometry.statusBottom<=geometry.composerTop,'status occupies its own row above the editor');
   assert.ok(geometry.workspaceWidth<=scenario.width,'workspace stays within the available footer width');
   assert.ok(await page.locator('.composer-footer').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'footer has no horizontal overflow');
   assert.ok(geometry.permissionInside&&geometry.modelInside,JSON.stringify(geometry));
   assert.ok(geometry.footText.includes('引导信息已接收'));
   assert.equal(geometry.hasOldPermissionRow,false);
  }
  assert.deepEqual(errors,[]);
  fs.mkdirSync('artifacts/composer-bottom-layout',{recursive:true});fs.writeFileSync('artifacts/composer-bottom-layout/metrics.json',JSON.stringify(metrics,null,2));
  console.log('PASS compact bottom layout portrait/landscape/IME/large text, icon-only existing permission menu, unchanged permission params, @ skill trigger and retained status');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
