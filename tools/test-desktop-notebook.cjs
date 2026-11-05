const fs = require('node:fs');
const assert = require('node:assert/strict');
const {chromium,launchOptions} = require('./browser-test-env.cjs');
(async () => {
 const browser = await chromium.launch(launchOptions());
 try {
  const page = await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const notebook={nbformat:4,nbformat_minor:5,metadata:{},cells:[
   {cell_type:'markdown',id:'md',metadata:{},source:['# Desktop Notebook\n','**中文说明** <script>window.PWNED=true</script>']},
   {cell_type:'code',id:'code',metadata:{},execution_count:1,source:['print("hello")'],outputs:[{output_type:'stream',name:'stdout',text:['hello output\n']},{output_type:'display_data',metadata:{},data:{'text/html':['<b>HTML output</b><script>parent.PWNED=true</script>']}}]}
  ]};
  await page.addInitScript(text=>{window.PreviewHost={readNotebook:()=>JSON.stringify({ok:true,text})};},JSON.stringify(notebook));
  await page.route('https://eva-preview.invalid/**',route=>{
   const name=new URL(route.request().url()).pathname.slice(1);
   route.fulfill({body:fs.readFileSync('probe/assets/'+name),contentType:name.endsWith('.js')?'text/javascript':'text/html'});
  });
  await page.goto('https://eva-preview.invalid/desktop-notebook.html');
  await page.waitForFunction(()=>document.documentElement.dataset.notebookReady==='true');
  await page.getByRole('heading',{name:'Desktop Notebook',exact:true}).waitFor();
  await page.getByText('hello output',{exact:false}).first().waitFor();
  const frame=page.locator('iframe');
  assert.equal(await frame.getAttribute('sandbox'),'');
  assert.equal(await page.evaluate(()=>window.PWNED),undefined);
  assert.equal(await page.evaluate(()=>window.EvaHost),undefined);
  assert.deepEqual(errors,[]);
  const longPage = await browser.newPage({viewport:{width:390,height:844}});
  const longNotebook = {nbformat:4,nbformat_minor:5,metadata:{},cells:Array.from({length:50},(_,i)=>({cell_type:'markdown',metadata:{},id:'cell'+i,source:['# Cell '+i+'\n'+('body\n\n'.repeat(10))]}))};
  await longPage.addInitScript(text => {
   window.PreviewHost = {
    readNotebook: () => JSON.stringify({ok:true,text,viewport:Number(sessionStorage.getItem('notebook-force-top')||localStorage.getItem('notebook-test-top')||0)}),
    saveViewport: top => localStorage.setItem('notebook-test-top',String(top))
   };
  }, JSON.stringify(longNotebook));
  await longPage.route('https://eva-preview.invalid/**',route=>{
   const name=new URL(route.request().url()).pathname.slice(1);
   route.fulfill({body:fs.readFileSync('probe/assets/'+name),contentType:name.endsWith('.js')?'text/javascript':'text/html'});
  });
  await longPage.goto('https://eva-preview.invalid/desktop-notebook.html');
  await longPage.getByRole('heading',{name:'Cell 49',exact:true}).waitFor({state:'attached'});
  await longPage.waitForFunction(()=>document.scrollingElement.scrollHeight>10000);
  await longPage.evaluate(()=>window.scrollTo(0,5000));
  await longPage.waitForFunction(()=>Number(localStorage.getItem('notebook-test-top'))===5000);
  await longPage.reload();
  await longPage.waitForFunction(()=>Math.abs(document.scrollingElement.scrollTop-5000)<2);
  assert.equal(await longPage.evaluate(()=>document.scrollingElement.tagName),'HTML');
  await longPage.evaluate(()=>window.dispatchEvent(new WheelEvent('wheel',{deltaY:-100})));
  await longPage.evaluate(()=>window.scrollTo(0,3000));
  await longPage.waitForFunction(()=>Number(localStorage.getItem('notebook-test-top'))===3000);
  await longPage.reload();
  await longPage.waitForFunction(()=>Math.abs(document.scrollingElement.scrollTop-3000)<2);
  await longPage.evaluate(()=>sessionStorage.setItem('notebook-force-top','500000'));
  await longPage.reload();
  await longPage.getByRole('heading',{name:'Cell 49',exact:true}).waitFor({state:'attached'});
  await longPage.evaluate(()=>{window.dispatchEvent(new Event('touchstart'));window.scrollTo(0,700);});
  await longPage.waitForFunction(()=>Number(localStorage.getItem('notebook-test-top'))===700);
  console.log('PASS desktop Notebook cells/Markdown/code/output, sandboxed HTML, no EvaHost, long-document middle viewport restored after reconstruction');
 } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
