'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium,launchOptions}=require('./browser-test-env.cjs');
const userText='用户复制测试：保留中文、emoji 🧪\n第二行';
const answerText='回答复制测试。\n\n```js\nconst value = "中文 🧪";\nconsole.log(value);\n```';
const codeText='const value = "中文 🧪";\nconsole.log(value);';
(async()=>{
 const browser=await chromium.launch(launchOptions());
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(({userText,answerText})=>{
   window.nativeCopies=[];window.nativeAttempts=[];window.webCopyAttempts=[];window.clipboardMode='success';
   Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{webCopyAttempts.push({kind:'text',text});throw new DOMException('Web clipboard unavailable','NotAllowedError');},write:async value=>{webCopyAttempts.push({kind:'rich'});throw new DOMException('Web clipboard unavailable','NotAllowedError');}}});
   const turn={id:'copy-turn',status:'completed',items:[{id:'copy-user',type:'userMessage',content:[{type:'text',text:userText}]},{id:'copy-answer',type:'agentMessage',phase:'final_answer',text:answerText}]};
   window.EvaHost={load:()=>JSON.stringify({chats:[{id:'copy-chat',messages:[],kernelThread:{id:'copy-thread',cwd:'/root/eva-workspace',turns:[turn]}}],active:'copy-chat',drafts:[],projects:[]}),save:()=>true,saveLater:()=>{},settings:()=>'{}',tasks:()=>'[]',providers:()=>JSON.stringify({providers:[{id:'fixture',model:'fixture'}],active:'fixture'}),kernelDrain:()=>'[]',kernelCall:()=>{},pendingQuestions:()=>'[]',copyText:text=>{nativeAttempts.push(text);if(clipboardMode==='throw')throw Error('native clipboard unavailable');if(clipboardMode==='reject')return false;nativeCopies.push(text);return true;}};
  },{userText,answerText});
  await page.route('https://eva.invalid/**',r=>{const name=new URL(r.request().url()).pathname.slice(1),file='probe/assets/'+name;return r.fulfill({status:fs.existsSync(file)?200:404,body:fs.existsSync(file)?fs.readFileSync(file):'',contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html'});});
  await page.goto('https://eva.invalid/index.html');
  await page.waitForFunction(()=>window.evaDesktopStream?.enabled);
  await page.evaluate(()=>{route='chat';render();});
  await page.locator('[data-user-message-bubble]').waitFor();
  const user=page.locator('[data-native-steering]').filter({has:page.locator('[data-user-message-bubble]')});
  const copy=user.locator('button').first();
  await copy.click({force:true});await page.waitForTimeout(100);
  const userResult=await page.evaluate(()=>({native:[...nativeCopies],web:[...webCopyAttempts]}));
  assert.deepEqual(userResult.native,[userText],'user-message copy must use Android clipboard when Web Clipboard is unavailable');
  assert.equal(await copy.getAttribute('aria-label'),'已复制');
  const answer=page.locator('[data-copy-turn]');
  await answer.click({force:true});
  const answerResult=await page.evaluate(()=>nativeCopies.at(-1));
  assert.equal(answerResult,answerText,'whole answer copies through native bridge');
  assert.equal(await answer.getAttribute('aria-label'),'已复制');
  assert.equal(await answer.getAttribute('data-copy-succeeded'),'true');
  await page.evaluate(()=>{active().kernelThread.turns[0].items.push({id:'late-answer',type:'agentMessage',phase:'final_answer',text:'迟到的消息'});updateKernelFlow(active());});
  assert.equal(await answer.getAttribute('aria-label'),'已复制','changed turn refresh preserves the 1500 ms success feedback');
  await page.evaluate(()=>{active().kernelThread.turns[0].items.pop();updateKernelFlow(active());});
  await page.evaluate(()=>updateKernelFlow(active()));
  assert.equal(await answer.getAttribute('aria-label'),'已复制','ordinary transcript refresh preserves answer success feedback');
  assert.equal(await answer.getAttribute('data-copy-succeeded'),'true');
  const assistant=page.locator('[data-native-steering]').filter({has:page.locator('[data-code-block-source]')});
  const code=assistant.locator('button').last();
  await code.click({force:true});await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>nativeCopies.at(-1)),codeText,'code copy must load the native lazy service and preserve code');
  await page.waitForTimeout(1600);
  assert.equal(await copy.getAttribute('aria-label'),'复制消息');
  assert.equal(await answer.getAttribute('aria-label'),'复制回答');
  assert.equal(await answer.getAttribute('data-copy-succeeded'),null);
  // A native false/exception is failure, even with an available Web Clipboard.
  // In particular, no control may display its success checkmark on failure.
  for(const mode of ['reject','throw']){
   await page.evaluate(mode=>{clipboardMode=mode;kernelNotice='';},mode);
   const before=await page.evaluate(()=>nativeCopies.length);
   await copy.click({force:true});await page.waitForTimeout(100);
   assert.equal(await copy.getAttribute('aria-label'),'复制消息');
   assert.match(await page.evaluate(()=>kernelNotice),/复制失败/);
   await answer.click({force:true});
   assert.equal(await answer.getAttribute('data-copy-succeeded'),null);
   assert.equal(await answer.getAttribute('aria-label'),'复制回答');
   const beforeCode=await code.innerHTML();await code.click({force:true});await page.waitForTimeout(100);
   assert.equal(await code.innerHTML(),beforeCode,'code failure keeps copy icon');
   assert.equal(await page.evaluate(()=>nativeCopies.length),before);
   assert.deepEqual(await page.evaluate(()=>webCopyAttempts),[],'no browser fallback after native rejection');
  }
  // Legacy light-DOM entry guards missing code rather than clearing the clipboard.
  await page.evaluate(()=>{clipboardMode='success';const box=document.createElement('div');box.className='code-block';box.innerHTML='<button data-copy-code="1" id="empty-code-copy">复制代码</button>';document.querySelector('.flow.desktop-stream-host').append(box);});
  const attempts=await page.evaluate(()=>nativeAttempts.length);
  await page.locator('#empty-code-copy').click({force:true});
  assert.equal(await page.evaluate(()=>nativeAttempts.length),attempts);
  assert.match(await page.evaluate(()=>kernelNotice),/没有可复制/);
  assert.deepEqual(errors,[]);
  const result={passed:true,checks:['native user message with Web Clipboard unavailable','whole answer success checkmark/reset','lazy code clipboard service','Unicode and multiline preservation','native false/exception with no success feedback or fallback','missing code leaves clipboard intact'],nativeCopies:await page.evaluate(()=>nativeCopies.length)};
  fs.mkdirSync('artifacts/clipboard-20261113',{recursive:true});fs.writeFileSync('artifacts/clipboard-20261113/results.json',JSON.stringify(result,null,2));
  console.log('PASS '+JSON.stringify(result));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
