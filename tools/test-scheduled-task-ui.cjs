'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {chromium, launchOptions} = require('./browser-test-env.cjs');
(async () => {
 const browser = await chromium.launch(launchOptions());
 try {
  const page = await browser.newPage({viewport: {width: 390, height: 844}});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
   window.calls = [];
   window.events = [];
   window.EvaHost = {
    load: () => JSON.stringify({chats: [], drafts: [], projects: []}),
    save: () => true, saveLater: () => {}, settings: () => '{}', tasks: () => '[]',
    providers: () => JSON.stringify({providers: [{id: 'p', name: 'fixture', model: 'm'}], active: 'p'}),
    scheduledThreadBinding: id => id.startsWith('scheduled-') ? JSON.stringify({automationId: 'fixture', provider: 'p', model: 'm'}) : 'null',
    kernelDrain: () => JSON.stringify(events.splice(0)),
    kernelCall(ticket, method, json) {
     calls.push({method, params: JSON.parse(json)});
     const result = method === 'thread/read' ? {thread: {id: 'scheduled-thread', status: {type: 'active'}, turns: []}} :
      method === 'thread/turns/list' ? {data: [{id: 'run', status: 'inProgress', items: []}], nextCursor: null} : {};
     events.push({ticket, result});
    }
   };
  });
  await page.route('https://eva.invalid/**', route => {
   const path = new URL(route.request().url()).pathname.slice(1);
   return route.fulfill({body: fs.readFileSync('probe/assets/' + path), contentType: path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : 'text/html'});
  });
  await page.goto('https://eva.invalid/index.html');
  await page.waitForFunction(() => window.evaDesktopStream?.enabled);
  await page.evaluate(() => evaScheduledTasks.openThread('scheduled-thread'));
  assert.equal(await page.evaluate(() => active().scheduledReadOnly), true);
  assert.equal(await page.locator('#prompt').getAttribute('readonly'), '');
  assert.equal(await page.locator('[data-task-primary]').isDisabled(), true);
  await page.evaluate(() => kernelSend());
  assert.equal(await page.evaluate(() => calls.some(row => ['thread/resume', 'turn/start', 'turn/steer'].includes(row.method))), false);
  await page.evaluate(() => {
   kernelEvent({method: 'turn/started', params: {threadId: 'scheduled-background', turn: {id: 'background-run', status: 'inProgress', items: []}}});
   kernelEvent({method: 'turn/started', params: {threadId: 'ordinary-unknown', turn: {id: 'ordinary-run', status: 'inProgress', items: []}}});
  });
  assert.equal(await page.evaluate(() => data.chats.filter(chat => chat.kernelThread.id === 'scheduled-background' && chat.scheduledReadOnly && chat.running).length), 1);
  assert.equal(await page.evaluate(() => data.chats.some(chat => chat.kernelThread.id === 'ordinary-unknown')), false);
  assert.deepEqual(errors, []);
  console.log('PASS scheduled conversations use read-only history, never resume/start/steer, and owned background runs appear in task status');
 } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode = 1;});
