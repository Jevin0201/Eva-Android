const fs=require('fs'),assert=require('assert/strict'),{chromium,launchOptions}=require('./browser-test-env.cjs');
(async()=>{const browser=await chromium.launch(launchOptions());try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.opened=[];window.preview=false;window.EvaHost={load:()=>JSON.stringify({chats:[{id:'c',title:'虚拟屏幕快捷开关',messages:['正在检查预览入口'],draft:'保留这段未发送草稿'}],active:'c'}),save:()=>true,saveLater:()=>{},settings:()=>'{"theme":"light"}',providers:()=>'{"providers":[]}',kernelDrain:()=>'[]',tasks:()=>'[]',open:kind=>{opened.push(kind);if(kind==='phone-preview')preview=!preview;}}});
 await page.route('https://eva.invalid/**',r=>{const name=new URL(r.request().url()).pathname.slice(1);return r.fulfill({body:fs.readFileSync('probe/assets/'+name),contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html'})});
 await page.goto('https://eva.invalid/index.html');await page.evaluate(()=>{window.originalPrompt=document.querySelector('#prompt');window.originalScreen=document.querySelector('#screen').innerHTML;});
 const button=page.locator('.app-head [data-action="phone-preview"]');assert.equal(await button.count(),1);await button.click();assert.equal(await page.evaluate(()=>preview),true);await button.click();assert.equal(await page.evaluate(()=>preview),false);
 assert.deepEqual(await page.evaluate(()=>opened),['phone-preview','phone-preview']);assert.equal(await page.evaluate(()=>originalPrompt===document.querySelector('#prompt')),true);assert.equal(await page.locator('#prompt').inputValue(),'保留这段未发送草稿');assert.equal(await page.evaluate(()=>data.active),'c');assert.equal(await page.locator('.app-head [data-action="phone-setup"]').count(),0);
 await page.screenshot({path:'artifacts/performance-20261113/phone-shortcut.png'});
 await page.evaluate(()=>navigate('phone-control'));assert.equal(await page.evaluate(()=>opened.at(-1)),'phone-control');assert.deepEqual(errors,[]);
 console.log('PASS header dispatches preview toggle twice; chat, input node and draft preserved; control settings remain reachable (mock native host)');
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
