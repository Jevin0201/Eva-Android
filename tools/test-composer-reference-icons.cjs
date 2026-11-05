const fs=require('fs'),assert=require('assert/strict');
const {chromium,launchOptions}=require('./browser-test-env.cjs');
(async()=>{
 const native=fs.readFileSync('probe/src/ShellActivity.java','utf8');
 const intercept=native.slice(native.indexOf('public WebResourceResponse shouldInterceptRequest'),native.indexOf('public WebResourceResponse shouldInterceptRequest')+12000);
 const allowed=new Set([...intercept.matchAll(/path\.equals\("([^"\n]+)"\)/g)].map(m=>m[1]));
 const browser=await chromium.launch(launchOptions());
 try{
  const p=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[],images=[];let retryWorks=false;
  p.setDefaultTimeout(6000);p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{window.EvaHost={load:()=>JSON.stringify({projects:[],chats:[{id:'c',title:'附件与能力',messages:[],draft:'请用选中的能力处理文件',kernelThread:{id:'t',turns:[]}}],active:'c'}),save:()=>true,settings:()=>'{"theme":"light"}',providers:()=>JSON.stringify({providers:[{id:'test',name:'Test',model:'test'}],active:'test'}),kernelDrain:()=>'[]',kernelCall:()=>{},tasks:()=>'[]',open:()=>{}}});
  await p.route('https://eva.invalid/**',async r=>{
   const url=new URL(r.request().url()),name=url.pathname;
   if(['/extension-media','/extension-icon'].includes(name)){
    images.push({path:name,local:url.searchParams.get('path'),remote:url.searchParams.get('url'),revision:url.searchParams.get('revision')});
    const fail=(url.searchParams.get('path')||'').includes('missing')||((url.searchParams.get('url')||'').includes('retry')&&!retryWorks);
    return r.fulfill({status:fail?404:200,contentType:'image/svg+xml',body:fail?'':'<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" rx="7" fill="#645adc"/></svg>'});
   }
   if(!allowed.has(name))return r.fulfill({status:404,body:''});
   return r.fulfill({body:fs.readFileSync('probe/assets'+name),contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html'});
  });
  await p.goto('https://eva.invalid/index.html');
  await p.evaluate(()=>{
   kernelCall=async(method)=>{
    if(method==='skills/list')return {data:[{skills:[
     {name:'Local Skill',enabled:true,path:'/root/.eva-codex/skills/demo/SKILL.md',interface:{iconSmall:'assets/small.svg',iconSmallDark:'assets/dark.svg',iconSmallUrl:'https://brand.example/unused.svg'}},
     {name:'Fallback Skill',enabled:true,path:'/root/.eva-codex/skills/fallback/SKILL.md',interface:{iconSmall:'assets/missing.svg',iconSmallUrl:'https://brand.example/fallback.svg'}},
     {name:'google-drive:google-docs',description:'Documents',enabled:true,path:'/root/.eva-codex/skills/docs/SKILL.md',interface:{displayName:'Google Docs'}},
     {name:'google-drive:google-sheets',description:'Spreadsheets',enabled:true,path:'/root/.eva-codex/skills/sheets/SKILL.md',interface:{}},
     {name:'No Icon',enabled:true,path:'/root/.eva-codex/skills/plain/SKILL.md',interface:{}},
     {name:'Unsafe Relative',enabled:true,path:'/root/.eva-codex/skills/unsafe/SKILL.md',interface:{iconSmall:'../escape.svg'}}
    ]}]};
    if(method==='plugin/installed')return {marketplaces:[{plugins:[
     {id:'brand',name:'Brand Plugin',installed:true,enabled:true,localVersion:'v2',interface:{composerIconUrl:'https://brand.example/composer.svg',logoUrl:'https://brand.example/logo.svg',composerIconUrlDark:'https://brand.example/composer-dark.svg'}},
     {id:'retry',name:'Retry Plugin',installed:true,enabled:true,version:'v3',interface:{composerIconUrl:'https://brand.example/retry.svg'}}
    ]}]};return {};
   };route='chat';render();
  });
  const row=name=>p.locator('[data-reference-pick]').filter({hasText:name});
  const loaded=async name=>row(name).locator('img').evaluate(img=>!img.hidden&&img.complete&&img.naturalWidth>0);
  await p.locator('#prompt').fill((await p.locator('#prompt').inputValue())+' @');
  await p.waitForFunction(()=>document.querySelectorAll('[data-reference-pick]').length===8);
  await p.waitForFunction(()=>document.querySelectorAll('.reference-logo.has-logo').length===3);
  assert(await loaded('Local Skill'));assert(await loaded('Fallback Skill'));assert(await loaded('Brand Plugin'));
  assert.equal(await row('No Icon').locator('img').getAttribute('src'),null);
  assert.equal(await row('Unsafe Relative').locator('img').getAttribute('src'),null);
  assert.equal(await row('Retry Plugin').locator('img').getAttribute('src'),null);
  assert(images.some(x=>x.local==='/root/.eva-codex/skills/demo/assets/small.svg'));
  assert(!images.some(x=>x.remote?.endsWith('unused.svg')),'local success must avoid remote request');
  assert(images.some(x=>x.remote==='https://brand.example/composer.svg'&&x.revision==='v2'));
  assert(!images.some(x=>x.remote==='https://brand.example/logo.svg'),'composer brand preferred');
  assert(await p.locator('link[href$="composer-references.css"]').count());
  assert.equal(await row('Local Skill').locator('.reference-logo').evaluate(n=>getComputedStyle(n).width),'32px');
  assert.equal(await row('Local Skill').locator('svg').evaluate(n=>getComputedStyle(n).visibility),'hidden');
  assert.equal(await row('No Icon').locator('svg').evaluate(n=>getComputedStyle(n).visibility),'visible');
  retryWorks=true;await p.locator('[data-reference-refresh]').click();await p.waitForFunction(()=>document.querySelectorAll('.reference-logo.has-logo').length===4);
  assert(await loaded('Retry Plugin'),'failed icon must retry when reopened/refreshed');
  await p.evaluate(()=>$('#phone').classList.add('dark'));
  await p.waitForFunction(()=>[...document.querySelectorAll('.reference-logo img')].some(i=>i.src.includes('dark.svg')&&!i.hidden));
  assert(images.some(x=>x.local==='/root/.eva-codex/skills/demo/assets/dark.svg'));
  await p.waitForFunction(()=>[...document.querySelectorAll('.reference-logo img')].some(i=>i.src.includes('composer-dark.svg')&&!i.hidden));
  fs.mkdirSync('artifacts/composer-reference-icons',{recursive:true});
  await p.screenshot({path:'artifacts/composer-reference-icons/full-page-dark.png',fullPage:true});
  await row('Brand Plugin').click();assert.match(await p.locator('.reference-chips').innerText(),/Brand Plugin/);
  assert.equal(await p.locator('#prompt').inputValue(),'请用选中的能力处理文件 @Brand Plugin ');
  await p.locator('#prompt').fill('@google-drive:');
  await p.waitForFunction(()=>document.querySelectorAll('[data-reference-pick]').length===2);
  assert.equal(await row('Google Docs').count(),1);assert.equal(await row('Google Sheets').count(),1);
  await row('Google Docs').click();assert.equal(await p.locator('#prompt').inputValue(),'@Google Docs ');
  await p.locator('#prompt').fill((await p.locator('#prompt').inputValue())+' @');await row('Google Sheets').click();
  const protocol=await p.evaluate(()=>evaReferences.inputs(evaReferences.selected(active()),active()));
  assert(protocol.some(x=>x.type==='skill'&&x.name==='google-drive:google-docs'&&x.path.endsWith('/docs/SKILL.md')));
  assert(protocol.some(x=>x.type==='skill'&&x.name==='google-drive:google-sheets'));
  await p.evaluate(()=>{evaReferences.add({kind:'skill',name:'google-drive：google-slides',path:'/root/.eva-codex/skills/slides/SKILL.md'})});
  assert.match(await p.locator('.reference-chips').innerText(),/Google Slides/);
  assert(!await p.locator('.reference-chips').innerText().then(text=>text.includes('google-drive')));
  assert.deepEqual(errors,[]);
  console.log('PASS full page native asset routing, local relative skill icons, cached remote revision, theme variants, failure retry, loaded brand visibility and selection');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
