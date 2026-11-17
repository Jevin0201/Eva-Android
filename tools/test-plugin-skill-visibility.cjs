const fs=require('fs'),assert=require('assert/strict'),{chromium,launchOptions}=require('./browser-test-env.cjs');
(async()=>{const browser=await chromium.launch(launchOptions());try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.EvaHost={load:()=>JSON.stringify({projects:[],chats:[{id:'c',title:'Test',draft:'',messages:[]}],active:'c'}),save:()=>true,saveLater:()=>{},settings:()=>'{"theme":"light"}',providers:()=>'{"providers":[]}',kernelDrain:()=>'[]',kernelCall:()=>{},tasks:()=>'[]',open:()=>{}}});
 await page.route('https://eva.invalid/**',r=>{const name=new URL(r.request().url()).pathname.slice(1);return r.fulfill({body:fs.readFileSync('probe/assets/'+name),contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html'})});
 await page.goto('https://eva.invalid/index.html');
 await page.evaluate(()=>{
  window.fixtureSkills=[
   {name:'English standalone',enabled:true,path:'/root/.eva-codex/skills/english/SKILL.md'},
   {name:'用户技能',enabled:true,path:'/root/eva-workspace/.agents/skills/user/SKILL.md'},
   {name:'internal-english',enabled:true,pluginId:'mine@local',path:'/custom/plugin/SKILL.md'},
   {name:'插件内部中文技能',enabled:true,pluginId:'mine@local',path:'/custom/plugin/chinese/SKILL.md'},
   {name:'legacy-internal',enabled:true,path:'/root/.eva-codex/plugins/cache/my-market/mine/1.0/skills/internal/SKILL.md'},
   {name:'windows-internal',enabled:true,path:'C:/Codex/plugins/cache/my-market/my-plugin/1.0/skills/example/SKILL.md'},
   {name:'local-internal',enabled:true,path:'/work/plugins/custom/skills/inside/SKILL.md'},
   {name:'scope-internal',enabled:true,scope:'plugin',path:'/custom/scope/SKILL.md'},
   {name:'disabled',enabled:false,path:'/root/.eva-codex/skills/disabled/SKILL.md'}
  ];
  window.pluginFail=false;
  kernelCall=async method=>{
   if(method==='skills/list')return {data:[{skills:fixtureSkills}]};
   if(method==='plugin/installed'){
    if(pluginFail)throw Error('fixture unavailable');
    return {marketplaces:[{plugins:[{id:'mine@local',name:'My plugin',installed:true,enabled:true},{id:'off@local',name:'disabled plugin',installed:true,enabled:false}]}]};
   }
   return {};
  };
  route='chat';render();evaReferences.invalidate();
 });
 await page.locator('#prompt').fill('@');
 await page.waitForFunction(()=>document.querySelectorAll('[data-reference-pick]').length===3);
 assert.deepEqual((await page.locator('[data-reference-pick] strong').allTextContents()).sort(),['English standalone','My plugin','用户技能'].sort());
 await page.locator('#prompt').fill('$');
 await page.waitForFunction(()=>document.querySelectorAll('[data-reference-pick]').length===2);
 assert.deepEqual((await page.locator('[data-reference-pick] strong').allTextContents()).sort(),['English standalone','用户技能'].sort());
 await page.locator('#prompt').fill('@internal');
 await page.waitForFunction(()=>document.querySelector('#reference-picker')?.textContent.includes('没有匹配项'));
 assert.equal(await page.locator('[data-reference-pick]').count(),0);
 // Filtering the menu must not disable installed skills or invalidate old selections.
 const historical=await page.evaluate(async()=>evaReferences.inputs([{kind:'skill',name:'internal-english',path:'/custom/plugin/SKILL.md'}],active()));
 assert.deepEqual(historical,[{type:'skill',name:'internal-english',path:'/custom/plugin/SKILL.md'}]);
 assert.equal(await page.evaluate(()=>fixtureSkills.filter(s=>s.pluginId).every(s=>s.enabled)),true);
 await page.evaluate(()=>{pluginFail=true;evaReferences.invalidate()});
 await page.locator('#prompt').fill('@');
 await page.waitForFunction(()=>document.querySelector('#reference-picker')?.textContent.includes('插件读取失败'));
 assert.deepEqual((await page.locator('[data-reference-pick] strong').allTextContents()).sort(),['English standalone','用户技能'].sort());
 assert.equal(await page.evaluate(()=>evaReferences.isPluginSkill({path:'/work/plugins/custom/.agents/skills/independent/SKILL.md'})),false);
 assert.deepEqual(errors,[]);
 console.log('PASS plugin ownership hides internal skills from @/$ including legacy paths; standalone English skills retained; parent plugin visible; catalog failure does not leak internals; old references and enabled state preserved');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
