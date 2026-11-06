const fs = require('fs');
const assert = require('assert/strict');
const {chromium, launchOptions} = require('./browser-test-env.cjs');

(async () => {
 const browser = await chromium.launch(launchOptions());
 try {
  const page = await browser.newPage();
  await page.addInitScript(() => {
   window.events = []; window.partialWrites = []; window.fullWrites = []; window.heldReceipts = [];
   window.EvaHost = {
    load: () => JSON.stringify({chats: [
     {id: 'a', messages: [], draft: '', kernelThread: {id: 'ta', turns: []}},
     {id: 'b', messages: [], draft: '', kernelThread: {id: 'tb', turns: []}},
     {id: 'large', messages: ['inactive-history-marker' + 'x'.repeat(2 * 1024 * 1024)]}
    ], drafts: [], projects: [], active: 'a'}),
    save: value => { fullWrites.push(JSON.parse(value)); return true; },
    saveLater: value => fullWrites.push(JSON.parse(value)),
    saveCheckpoint: (ticket, value) => { fullWrites.push(JSON.parse(value)); events.push({ticket, result: {}}); },
    saveConversationCheckpoint: (ticket, value) => {
     partialWrites.push(JSON.parse(value));
     const result = {needsFullSnapshot: !!window.needsFull}; window.needsFull = false;
     (window.holdWrites ? heldReceipts : events).push({ticket, result});
    },
    settings: () => '{}', providers: () => '{"providers":[]}', tasks: () => '[]',
    kernelDrain: () => JSON.stringify(events.splice(0)), open: () => {}
   };
  });
  await page.route('https://eva.invalid/**', route => {
   const name = new URL(route.request().url()).pathname.slice(1);
   return route.fulfill({body: fs.readFileSync('probe/assets/' + name), contentType: name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html'});
  });
  await page.goto('https://eva.invalid/index.html');
  await page.waitForTimeout(700);
  await page.evaluate(() => {
   partialWrites.length = 0; fullWrites.length = 0;
   for (const id of ['a', 'b']) {
    const chat = data.chats.find(c => c.id === id); chat.draft = 'saved-' + id; scheduleKernelSave(chat);
   }
   flushKernelSave();
  });
  await page.waitForFunction(() => partialWrites.length === 2 && kernelPending.size === 0);
  const writes = await page.evaluate(() => partialWrites);
  assert.deepEqual(writes.map(w => w.conversation.id), ['a', 'b']);
  assert(writes.every(w => JSON.stringify(w).length < 3000));
  assert(writes.every(w => w.state.chats.length === 3));
  assert(!JSON.stringify(writes).includes('inactive-history-marker'));
  assert.equal(await page.evaluate(() => fullWrites.length), 0);

  const start = await page.evaluate(() => {
   window.holdWrites = true;
   scheduleKernelSave(active()); flushKernelSave();
   const count = partialWrites.length;
   for (let i = 0; i < 4; i++) { active().draft = 'latest-' + i; scheduleKernelSave(active()); flushKernelSave(); }
   return count;
  });
  assert.equal(await page.evaluate(() => partialWrites.length), start);
  await page.evaluate(() => { window.holdWrites = false; events.push(...heldReceipts.splice(0)); });
  await page.waitForFunction(() => partialWrites.at(-1).conversation.draft === 'latest-3' && kernelPending.size === 0);

  await page.evaluate(() => { active().draft = 'typing'; persistDraft(); });
  await page.waitForFunction(() => partialWrites.at(-1).conversation.draft === 'typing' && kernelPending.size === 0);
  assert.equal(await page.evaluate(() => fullWrites.length), 0);

  await page.evaluate(() => { window.needsFull = true; scheduleKernelSave(active()); flushKernelSave(); });
  await page.waitForFunction(() => fullWrites.length === 1 && kernelPending.size === 0);
  assert.equal(await page.evaluate(() => fullWrites[0].chats[2].messages[0].startsWith('inactive-history-marker')), true);

  await page.evaluate(() => { active().draft = 'background'; scheduleKernelSave(active()); window.dispatchEvent(new Event('pagehide')); });
  assert.equal(await page.evaluate(() => fullWrites.at(-1).chats[0].draft), 'background');
  await page.evaluate(() => { active().draft = 'last keystroke'; persistDraft(); window.dispatchEvent(new Event('pagehide')); });
  assert.equal(await page.evaluate(() => fullWrites.at(-1).chats[0].draft), 'last keystroke');
  await page.evaluate(() => { data.projectId = 'changed'; scheduleKernelSave(); flushKernelSave(); });
  assert.equal(await page.evaluate(() => fullWrites.at(-1).projectId), 'changed');

  const before = await page.evaluate(() => { scheduleKernelSave(active()); saveKernel(); return partialWrites.length; });
  await page.waitForTimeout(650);
  assert.equal(await page.evaluate(() => partialWrites.length), before);
  console.log('PASS changed conversations only, concurrent chats, complete index, draft autosave, full fallback, background flush, metadata writes and synchronous-save cancellation');
 } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
