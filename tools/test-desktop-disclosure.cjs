'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium,launchOptions}=require('./browser-test-env.cjs');
(async()=>{const browser=await chromium.launch(launchOptions());try{
 const page=await browser.newPage();await page.route('https://eva.invalid/**',route=>route.fulfill({contentType:route.request().url().endsWith('.js')?'text/javascript':'text/html',body:route.request().url().endsWith('.js')?fs.readFileSync('probe/assets/desktop-stream-disclosure.js'):'<div id="scroll" style="height:200px;overflow:auto"><div id="host" data-render-thread="thread"></div></div><script src="/desktop-stream-disclosure.js"></script>'}));await page.goto('https://eva.invalid/test');
 await page.evaluate(()=>{
  window.state={expanded:new Set(['global-sentinel'])};window.nativeTranscript={summarize(){}};
  const host=document.querySelector('#host'),state={expanded:new Set()};let api;
  function paint(){const expanded=state.expanded.has('work:test'),phase=api.state('work:test',expanded);host.innerHTML=`<div class="work-activity" data-ui-id="work:test" data-activity-state="active"><button data-toggle="work:test" aria-expanded="${expanded}"><span class="act-label" data-summary-key="a" data-summary-text="Alpha">Alpha</span></button>${expanded||phase==='closing'?'<div class="work-details" style="height:80px">Details</div>':''}</div>`;api.hydrate(host);}
  api=EvaDesktopDisclosure.create({state,els:{threadScroll:document.querySelector('#scroll')},renderTranscript:paint});window.fixture={api,state,paint,host};paint();
  api.toggle(host.querySelector('button'));
 });
 assert.equal(await page.evaluate(()=>fixture.state.expanded.has('work:test')),true);
 assert.equal(await page.evaluate(()=>state.expanded.has('work:test')),false);
 assert.equal(await page.evaluate(()=>fixture.api.state('work:test',true)),'opening');
 assert.equal(await page.locator('.work-details').evaluate(n=>n.getAnimations()[0].effect.getTiming().duration),180);
 await page.waitForTimeout(240);assert.equal(await page.evaluate(()=>fixture.api.state('work:test',true)),'expanded');
 await page.evaluate(()=>{const label=fixture.host.querySelector('.act-label');label.dataset.summaryKey='b';label.dataset.summaryText='Beta';label.textContent='Beta';fixture.api.hydrate(fixture.host);});
 assert.equal(await page.locator('.act-label').textContent(),'Alpha');await page.waitForTimeout(1100);assert.equal(await page.locator('.act-label').textContent(),'Beta');
 await page.evaluate(()=>fixture.api.toggle(fixture.host.querySelector('button')));assert.equal(await page.evaluate(()=>fixture.api.state('work:test',false)),'closing');await page.waitForTimeout(240);assert.equal(await page.evaluate(()=>fixture.api.state('work:test',false)),'collapsed');assert.equal(await page.locator('.work-details').count(),0);
 console.log('PASS original disclosure scoped state, 180ms open/close animation, 1s active summary throttle, closing body lifetime and global-state isolation');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
