// Exercise the shipped reader's copy handler and browser selection APIs.
const assert=require('node:assert/strict'),fs=require('fs'),{spawnSync}=require('node:child_process');
const {chromium,launchOptions}=require('./browser-test-env.cjs');
const readerPath='probe/assets/desktop-reader/cloud-markdown.js',source=fs.readFileSync(readerPath,'utf8');
const regenerated=spawnSync('python',['-c',"import runpy,pathlib; m=runpy.run_path('tools/desktop-reader-mobile.py'); s=pathlib.Path('probe/assets/desktop-reader/cloud-markdown.js').read_text(encoding='utf-8'); h=m['MARKDOWN_CLIPBOARD_HELPER']; assert s.count(h)==1; original=s.replace(h,'').replace('await copyReaderText(content);','await navigator.clipboard.writeText(content);'); assert m['adapt_markdown_clipboard'](original)==s"],{encoding:'utf8'});
assert.equal(regenerated.status,0,regenerated.stderr);
(async()=>{
 const browser=await chromium.launch(launchOptions());
 try{
  const page=await browser.newPage();
  await page.setContent('<input id="input" value="前缀中文后缀"><div id="selection" contenteditable>第一段中文\n第二段</div><main id="reader"></main>');
  await page.addScriptTag({path:'probe/assets/desktop-reader/markdown-deps.js'});
  await page.addScriptTag({path:readerPath});
  const result=await page.evaluate(async()=>{
   const text='中文代码\n第二行\t保留缩进\n',root=document.getElementById('reader'),input=document.getElementById('input'),selectionNode=document.getElementById('selection');
   root.innerHTML=cloudMarkdown.render('```text\n'+text+'```');cloudMarkdown.hydrate(root);
   const button=root.querySelector('.cloud-code-copy'),out=[];
   for(const mode of ['native','missing','denied','false','throw']){
    let copied=null,fallbackCalls=0;
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:mode==='missing'?undefined:{writeText:async value=>{if(mode==='native'){copied=value;return;}throw Error('NotAllowedError');}}});
    document.execCommand=command=>{if(command!=='copy')throw Error('Unexpected command');fallbackCalls++;if(mode==='throw')throw Error('Copy unavailable');if(mode==='false')return false;copied=document.activeElement.value;return true;};
    input.focus();input.setSelectionRange(1,4,'backward');
    button.click();await new Promise(resolve=>setTimeout(resolve,20));
    out.push({mode,copied,fallbackCalls,label:button.textContent,focus:document.activeElement.id,start:input.selectionStart,end:input.selectionEnd,direction:input.selectionDirection,temporaryFields:document.querySelectorAll('textarea').length});
   }
   Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined});
   document.execCommand=()=>true;selectionNode.focus();const selection=getSelection();selection.setBaseAndExtent(selectionNode.firstChild,6,selectionNode.firstChild,1);
   const before={text:selection.toString(),anchor:selection.anchorOffset,focus:selection.focusOffset};button.click();await new Promise(resolve=>setTimeout(resolve,20));
   const after={text:selection.toString(),anchor:selection.anchorOffset,focus:selection.focusOffset};
   return {text,out,before,after,selectionFocus:document.activeElement.id};
  });
  for(const row of result.out){
   const success=['native','missing','denied'].includes(row.mode);
   assert.equal(row.label,success?'已复制':'复制失败，请重试',row.mode);
   assert.equal(row.copied,success?result.text:null,row.mode+' exact Chinese/newline text');
   assert.equal(row.fallbackCalls,row.mode==='native'?0:1,row.mode+' fallback count');
   assert.equal(row.focus,'input');assert.equal(row.start,1);assert.equal(row.end,4);assert.equal(row.direction,'backward');assert.equal(row.temporaryFields,0);
  }
  assert.deepEqual(result.after,result.before,'restore backward DOM selection');assert.equal(result.selectionFocus,'selection');
  console.log('PASS reader clipboard: native, absent/denied API fallback, false/throw failure, exact Chinese/newlines, input focus/range and backward DOM selection restoration, cleanup and regeneration parity');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
