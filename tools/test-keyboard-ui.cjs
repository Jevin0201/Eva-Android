const fs=require('fs'),assert=require('assert/strict'),{chromium,launchOptions}=require('./browser-test-env.cjs');
(async()=>{const b=await chromium.launch(launchOptions());try{
 const p=await b.newPage({viewport:{width:390,height:844}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>{window.hides=0;window.EvaHost={load:()=>JSON.stringify({chats:[{id:'a',title:'对话',messages:[],draft:'保留草稿'}],active:'a'}),save:()=>true,settings:()=>'{}',providers:()=>'{"providers":[]}',kernelDrain:()=>'[]',hideKeyboard:()=>hides++,tasks:()=>'[]',open:()=>{}};});
 await p.route('https://eva.invalid/**',r=>{const n=new URL(r.request().url()).pathname.slice(1);return r.fulfill({body:fs.readFileSync('probe/assets/'+n),contentType:n.endsWith('.js')?'text/javascript':n.endsWith('.css')?'text/css':'text/html'})});
 await p.goto('https://eva.invalid/index.html');assert(await p.locator('#eva-keyboard-toolbar').isHidden());
 await p.locator('#prompt').focus();await p.evaluate(()=>evaKeyboardState({visible:true,height:900}));assert(await p.getByRole('button',{name:'收起键盘',exact:true}).isVisible());
 await p.setViewportSize({width:390,height:480});const button=await p.getByRole('button',{name:'收起键盘',exact:true}).boundingBox();assert(button.y>=0&&button.y+button.height<=480);
 await p.getByRole('button',{name:'收起键盘',exact:true}).click();assert.equal(await p.locator('#prompt').inputValue(),'保留草稿');assert.equal(await p.evaluate(()=>hides),1);assert(await p.locator('#eva-keyboard-toolbar').isHidden());
 await p.evaluate(()=>{projectDialog();document.querySelector('.project-input').focus();evaKeyboardState({visible:true,height:900});});
 await p.evaluate(()=>evaBack());assert.equal(await p.locator('#eva-panel').count(),1);assert.equal(await p.evaluate(()=>hides),2);await p.evaluate(()=>evaBack());assert.equal(await p.locator('#eva-panel').count(),0);
 await p.locator('#prompt').focus();await p.evaluate(()=>{evaKeyboardState({visible:true,height:900});evaKeyboardState({visible:false,height:0});});assert.notEqual(await p.evaluate(()=>document.activeElement.id),'prompt');assert.equal(await p.locator('#prompt').inputValue(),'保留草稿');assert.deepEqual(errors,[]);
 console.log('PASS visible keyboard-dismiss action, native bridge, draft preservation, resized viewport, keyboard-first back, IME-hide focus reset');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
