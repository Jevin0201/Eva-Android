'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {chromium, launchOptions} = require('./browser-test-env.cjs');
// Exercise the shipped entry contract as well as browser behavior. This catches
// an asset present in the fixture server but absent from Android's host allowlist.
const index = fs.readFileSync('probe/assets/index.html', 'utf8');
assert.ok(index.includes('src="desktop-runtime-diagnostics.js"'));
assert.ok(fs.readFileSync('probe/src/ShellActivity.java', 'utf8').includes('path.equals("/desktop-runtime-diagnostics.js")'));
assert.ok(fs.readFileSync('probe/assets/settings.js', 'utf8').includes("'runtime-diagnostics'"));
(async () => {
 const browser = await chromium.launch(launchOptions());
 try {
  const page = await browser.newPage();
  await page.addInitScript(() => {
   window.EvaHost = {load: () => '{}',save: () => true,saveLater: () => {},settings: () => '{}',providers: () => '{}',tasks: () => '[]',kernelDrain: () => '[]',kernelCall: () => {}};
  });
  await page.route('https://eva.invalid/**', route => {
   const path = new URL(route.request().url()).pathname.slice(1);
   return route.fulfill({body: fs.readFileSync('probe/assets/' + path),contentType: path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : 'text/html'});
  });
  await page.goto('https://eva.invalid/index.html');
  assert.equal(await page.evaluate(() => !!window.evaRuntimeDiagnostics), true);
  await page.evaluate(() => settingsGo('about'));
  await page.locator('[data-action=runtime-diagnostics]').click();
  await page.getByRole('button',{name:'关闭',exact:true}).click();
  const result = await page.evaluate(() => {
   kernelEvent({method:'warning',params:{message:'诊断 <script>bad()</script>'}});
   kernelEvent({method:'warning',params:{message:'诊断 <script>bad()</script>'}});
   kernelEvent({method:'error',params:{threadId:'t',turnId:'r',message:'insufficient_quota'}});
   navigate('runtime-diagnostics');
   return {entries:evaRuntimeDiagnostics.entries(),notice:kernelNotice,text:document.querySelector('[data-runtime-diagnostics-dialog]').textContent,unsafe:!!document.querySelector('[data-runtime-diagnostics-dialog] script')};
  });
  assert.equal(result.entries.length,2);
  assert.equal(result.entries.find(r => r.text.includes('诊断')).count,2);
  assert.match(result.notice,/使用额度已用完/);
  assert.match(result.text,/<script>/);
  assert.equal(result.unsafe,false);
  await page.getByRole('button',{name:'关闭',exact:true}).click();
  assert.equal(await page.locator('[data-runtime-diagnostics-dialog]').count(),0);
  console.log('PASS desktop diagnostics events, quota explanation, escaped history and close');
 } finally {await browser.close();}
})().catch(error => {console.error(error);process.exitCode=1;});
