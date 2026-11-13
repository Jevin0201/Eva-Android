const fs=require('fs'),assert=require('assert/strict'),{chromium,launchOptions}=require('./browser-test-env.cjs');
(async()=>{const browser=await chromium.launch(launchOptions());try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  window.pasteResult={text:'中文\n🧪代码'};window.copyOK=true;window.copies=[];window.attachmentPayload={};
  window.EvaHost={load:()=>JSON.stringify({chats:[{id:'a',draft:'前面替换后面',messages:[]},{id:'b',draft:'另一个草稿',messages:[]}],active:'a'}),save:()=>true,saveLater:()=>{},settings:()=>'{}',providers:()=>'{"providers":[]}',tasks:()=>'[]',kernelDrain:()=>'[]',copyText:text=>{copies.push(text);return copyOK},clipboardPaste:()=>JSON.stringify(pasteResult),attachmentResult:()=>JSON.stringify(attachmentPayload),attachmentAck:()=>{attachmentPayload={}}};
 });
 await page.route('https://eva.invalid/**',r=>{const path='probe/assets/'+new URL(r.request().url()).pathname.slice(1);return r.fulfill({status:fs.existsSync(path)?200:404,body:fs.existsSync(path)?fs.readFileSync(path):'',contentType:path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html'});});
 await page.goto('https://eva.invalid/index.html');
 await page.evaluate(()=>{const p=document.querySelector('#prompt');p.focus();p.setSelectionRange(2,4);window.originalInput=p});
 await page.getByRole('button',{name:'粘贴到输入框',exact:true}).click();
 assert.equal(await page.locator('#prompt').inputValue(),'前面中文\n🧪代码后面');
 assert.deepEqual(await page.evaluate(()=>[active().draft,originalInput===document.querySelector('#prompt'),originalInput.selectionStart]),['前面中文\n🧪代码后面',true,9]);
 await page.evaluate(()=>{pasteResult={error:'剪贴板不可用'};evaClipboard.paste()});
 assert.equal(await page.locator('#prompt').inputValue(),'前面中文\n🧪代码后面');
 const copied=await page.evaluate(()=>{
  originalInput.blur();const p=document.createElement('pre');p.textContent='选中中文\nconst x = "🧪";';document.body.append(p);const r=document.createRange();r.selectNodeContents(p);getSelection().removeAllRanges();getSelection().addRange(r);
  const e=new ClipboardEvent('copy',{bubbles:true,cancelable:true,clipboardData:new DataTransfer()});p.dispatchEvent(e);
  return {prevented:e.defaultPrevented,copies:[...copies],text:e.clipboardData.getData('text/plain')};
 });
 assert.deepEqual(copied,{prevented:true,copies:['选中中文\nconst x = "🧪";'],text:'选中中文\nconst x = "🧪";'});
 assert.equal(await page.evaluate(()=>{copyOK=false;const e=new ClipboardEvent('copy',{bubbles:true,cancelable:true});document.body.dispatchEvent(e);return e.defaultPrevented}),false);
 await page.evaluate(()=>{copyOK=true;data.active='b';render();window.inputB=document.querySelector('#prompt');inputB.focus();inputB.setSelectionRange(1,3);attachmentPayload={id:'fixture-import',target:'a',files:[{id:'f',name:'a.png',path:'/root/eva-workspace/a.png',mime:'image/png'}]};receiveAttachments()});
 assert.deepEqual(await page.evaluate(()=>[active().id,inputB===document.querySelector('#prompt'),inputB.value,inputB.selectionStart,[...data.chats,...data.drafts].find(c=>c.id==='a').attachments.length]),['b',true,'另一个草稿',1,1]);
 await page.evaluate(()=>{attachmentPayload={id:'fixture-import-2',target:'b',files:[{id:'f2',name:'b.txt',path:'/root/eva-workspace/b.txt'}]};receiveAttachments()});
 assert.deepEqual(await page.evaluate(()=>[inputB===document.querySelector('#prompt'),inputB.selectionStart,active().attachments.length]),[true,1,1]);
 assert.deepEqual(errors,[]);fs.mkdirSync('artifacts/clipboard-0.1.1',{recursive:true});await page.screenshot({path:'artifacts/clipboard-0.1.1/paste-toolbar.png'});
 console.log('PASS selected-text Android copy bridge, failure, caret/selection paste, Unicode/newlines and import completion across chats without replacing input');
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
