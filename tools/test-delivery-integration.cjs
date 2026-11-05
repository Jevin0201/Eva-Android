// Full bundled page test. Resource allowlist and MIME mapping follow ShellActivity,
// rather than granting every file in probe/assets as previous renderer tests did.
const fs=require('fs'),assert=require('assert/strict'),{chromium,launchOptions}=require('./browser-test-env.cjs');
(async()=>{
 const native=fs.readFileSync('probe/src/ShellActivity.java','utf8');
 const intercept=native.slice(native.indexOf('public WebResourceResponse shouldInterceptRequest'),native.indexOf('public WebResourceResponse shouldInterceptRequest')+10000);
 const allowed=new Set([...intercept.matchAll(/path\.equals\("([^"\n]+)"\)/g)].map(m=>m[1]));
 const browser=await chromium.launch(launchOptions());
 try{
  const p=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[],requests=[],blocked=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{
   const turn={id:'delivered-turn',status:'completed',startedAtMs:1000,completedAtMs:4000,items:[
    {id:'request',type:'userMessage',content:[{type:'text',text:'请制作课程幻灯片，提供讲师笔记和预览。'}]},
    {id:'empty-reasoning',type:'reasoning',summary:[]},
    {id:'answer',type:'agentMessage',phase:'final_answer',text:'课程文件已制作完成，包含两页内容和讲师笔记。\n\n[课程幻灯片](/root/eva-workspace/projects/course/课程-第一讲.pptx)\n\n[预览 PDF](/root/eva-workspace/projects/course/课程-第一讲.pdf)\n\n[讲师笔记](/root/eva-workspace/projects/course/notes.md)'}]};
   window.savedFiles=[];window.fixtureThread={id:'thread',cwd:'/root/eva-workspace/projects/course',turns:[turn]};window.jobs=[];
   const state={projects:[],drafts:[],chats:[{id:'chat',title:'课程制作',draft:'',messages:[],providerId:'test',model:'test-model',kernelThread:fixtureThread}],active:'chat'};
   window.EvaHost={exportWorkspaceFile:path=>savedFiles.push(path),load:()=>JSON.stringify(state),save:()=>true,saveLater:()=>{},settings:()=>'{"theme":"light"}',providers:()=>JSON.stringify({providers:[{id:'test',model:'test-model',name:'Test'}],active:'test'}),kernelDrain:()=>'[]',kernelCall:(ticket,method,params)=>{jobs.push({ticket,method,params:JSON.parse(params)});if(method==='thread/read')setTimeout(()=>kernelEvent({ticket,result:{thread:fixtureThread}}),0);},open:()=>{},tasks:()=>'[]'};
  });
  await p.route('https://eva.invalid/**',async route=>{
   const name=new URL(route.request().url()).pathname;requests.push(name);
   if(!allowed.has(name)){blocked.push(name);return route.fulfill({body:'',contentType:'text/plain; charset=UTF-8'});}
   const target='probe/assets'+name;
   if(!fs.existsSync(target))throw Error('Allowlisted resource missing: '+name);
   return route.fulfill({body:fs.readFileSync(target),contentType:name.endsWith('.js')?'text/javascript; charset=UTF-8':name.endsWith('.css')?'text/css; charset=UTF-8':'text/html; charset=UTF-8'});
  });
  await p.goto('https://eva.invalid/index.html');
  await p.evaluate(()=>{route='chat';render();});
  await p.locator('.delivery-file').first().waitFor();
  const details=await p.evaluate(()=>({
   stylesheet:!!document.querySelector('link[rel="stylesheet"][href$="delivery-files.css"]'),
   cards:[...document.querySelectorAll('.delivery-file')].map(el=>({display:getComputedStyle(el).display,decoration:getComputedStyle(el).textDecorationLine,href:el.getAttribute('href'),text:el.innerText,width:el.getBoundingClientRect().width})),
   visibleText:document.querySelector('.flow').innerText,
   localLinks:[...document.querySelectorAll('.flow a[href]')].filter(a=>a.getAttribute('href').startsWith('/root/eva-workspace/')).map(a=>a.getAttribute('href')),
   overflow:document.documentElement.scrollWidth>390,
   prompt:!!document.querySelector('#prompt')
  }));
  fs.mkdirSync('artifacts/delivery-files',{recursive:true});
  await p.screenshot({path:'artifacts/delivery-files/full-chat-integration.png',fullPage:true});
  fs.writeFileSync('artifacts/delivery-files/integration-result.json',JSON.stringify({details,requests,blocked,errors},null,2));
  const failures=[];const check=(ok,message)=>{if(!ok)failures.push(message)};
  check(details.stylesheet,'index.html must load delivery-files.css');
  check(requests.includes('/delivery-files.css'),'stylesheet must actually be requested through native allowlist');
  check(details.cards.length===3,'three file cards must appear in full conversation');
  check(details.cards.every(c=>c.display==='flex'),'file cards must have computed display:flex');
  check(details.cards.every(c=>c.decoration==='none'),'file cards must not appear as bare underlined links');
  check(!details.visibleText.includes('/root/eva-workspace/')&&!details.visibleText.includes('projects/course/'),'runtime and project paths must not be shown as user-facing content');
  check(details.localLinks.length===new Set(details.localLinks).size,'each delivered file must have one visible link, without duplicate markdown links');
  check(!details.overflow,'390px chat must not overflow horizontally');
  check(details.prompt,'real composer must remain visible');
  check(!details.visibleText.includes('用时'),'empty completed reasoning must not create a worked-for row');
  check(!errors.length,'page must have no uncaught script errors: '+errors.join('; '));
  assert.deepEqual(failures,[],failures.join('\n'));
  await p.locator('.delivery-file-save').first().click();
  assert.equal(await p.evaluate(()=>savedFiles[0]),'/root/eva-workspace/projects/course/课程-第一讲.pptx');
  await p.evaluate(()=>{const t=active().kernelThread.turns[0];t.items.find(i=>i.id==='answer').text+='\n\n[第四个文件](/root/eva-workspace/projects/course/extra.pdf)';completedTurnHtml.delete(t);updateKernelFlow(active());});
  assert.equal(await p.locator('.delivery-file:visible').count(),3);await p.locator('[data-action^="delivery-more:"]').click();assert.equal(await p.locator('.delivery-file:visible').count(),4);await p.locator('[data-action^="delivery-more:"]').click();assert.equal(await p.locator('.delivery-file:visible').count(),3);
  const activity=await p.evaluate(()=>{const user={id:'u',type:'userMessage',content:[{text:'检查文件'}]},command={id:'cmd',type:'commandExecution',command:'ls',status:'inProgress'};const live=projectKernelTurn({id:'live-check',status:'inProgress',items:[user,command]});const finished=projectKernelTurn({id:'done-check',status:'completed',items:[user,{...command,status:'completed'},{id:'a',type:'agentMessage',phase:'final_answer',text:'已完成'}]});const first=t=>t.mobileBlocks.find(b=>b.kind==='assistant').workGroups.find(g=>g.kind==='activity');return {live:first(live).open,finished:first(finished).open};});
  assert.deepEqual(activity,{live:true,finished:false});
  console.log('PASS full page: actual CSS, unique styled files, native save action, first-three expansion, no empty worked row and running/completed disclosure defaults');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
