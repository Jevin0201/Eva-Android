'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const {chromium, launchOptions} = require('./browser-test-env.cjs');
(async () => {
 const browser = await chromium.launch(launchOptions());
 try {
  const page = await browser.newPage({viewport: {width: 390, height: 844}});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
   window.kernelPollingEnabled = false;
   window.EvaHost = {
    load: () => JSON.stringify({chats: [{id: 'chat', title: 'Pending order', messages: [], running: true, pending: 'Current user prompt', pendingSend: {baseTurnIds: [], phase: 'dispatching'}, kernelThread: {id: 'thread', turns: []}}], active: 'chat'}),
    save: () => true, saveLater: () => {}, settings: () => '{}',
    providers: () => JSON.stringify({providers: [{id: 'test', model: 'test'}], active: 'test'}),
    tasks: () => '[]', kernelDrain: () => '[]', kernelCall: () => {}, pendingQuestions: () => '[]'
   };
  });
  await page.route('https://eva.invalid/**', route => {
   const name = new URL(route.request().url()).pathname.slice(1);
   return route.fulfill({body: fs.readFileSync('probe/assets/' + name), contentType: name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html'});
  });
  await page.goto('https://eva.invalid/index.html');
  await page.waitForFunction(() => window.evaDesktopStream?.enabled);
  await page.evaluate(() => {route = 'chat'; render();});
  const prompt = page.locator('.flow').getByText('Current user prompt', {exact: true});
  assert.equal(await prompt.count(), 1, 'pending prompt appears before a turn exists');

  async function assertPromptBeforeProgress(label) {
   assert.equal(await prompt.count(), 1, label + ': exactly one prompt');
   await page.waitForFunction(() => {
    const flow = document.querySelector('.flow');
    const thinking = flow.querySelector('.eva-thinking-text');
    return thinking?.textContent.includes('正在思考');
   });
   const userBox = await prompt.boundingBox();
   const thinkingBox = await page.locator('.flow .eva-thinking-text').first().boundingBox();
   assert.ok(userBox && thinkingBox && userBox.y + userBox.height <= thinkingBox.y + 1, label + ': thinking follows the prompt');
  }
  await page.evaluate(() => kernelEvent({method: 'turn/started', params: {threadId: 'thread', turn: {id: 'current', status: 'inProgress', items: []}}}));
  await assertPromptBeforeProgress('empty accepted first turn');
  assert.equal(await page.evaluate(() => active().kernelThread.turns[0].items.length), 0, 'provisional user never enters persisted kernel history');
  assert.equal(await page.locator('.flow .turn-progress').count(), 0, 'accepted turn has no second sending indicator');

  await page.evaluate(() => {
   const chat = active();
   chat.kernelThread.turns.unshift({id: 'past', status: 'completed', items: [{id: 'past-user', type: 'userMessage', content: [{type: 'text', text: 'Past prompt'}]}, {id: 'past-answer', type: 'agentMessage', phase: 'final_answer', text: 'Past answer'}]});
   chat.pendingSend.baseTurnIds = ['past'];
   updateKernelFlow(chat);
  });
  await assertPromptBeforeProgress('history followed by empty new turn');
  const historyBox = await page.locator('.flow').getByText('Past answer', {exact: true}).boundingBox();
  const currentBox = await prompt.boundingBox();
  assert.ok(historyBox.y < currentBox.y, 'history remains before the new prompt');

  await page.evaluate(() => kernelEvent({method: 'item/started', params: {threadId: 'thread', turnId: 'current', item: {id: 'echo-user', type: 'userMessage', content: [{type: 'text', text: 'Current user prompt'}]}}}));
  await assertPromptBeforeProgress('formal user echo replaces provisional message');
  assert.equal(await page.evaluate(() => active().pending), '', 'normal event handling accepts the formal echo');
  assert.equal(await page.evaluate(() => active().kernelThread.turns.at(-1).items.filter(item => item.type === 'userMessage').length), 1);
  assert.deepEqual(errors, []);
  console.log('PASS desktop pending user precedes thinking with empty/new accepted turns and old history; formal echo deduplicates; source history remains unchanged');
 } finally {
  await browser.close();
 }
})().catch(error => {console.error(error); process.exitCode = 1;});
