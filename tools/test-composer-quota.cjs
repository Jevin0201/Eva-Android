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
      window.quotaCalls = [];
      window.quotaEvents = [];
      window.plan = 'plus';
      const selection = {providerId: 'openai', model: 'gpt'};
      const provider = {id: 'ds', name: 'DeepSeek', model: 'deepseek-flash', hasKey: true, hasDeepSeekBalance: true, connectionRevision: 'fixture'};
      window.EvaHost = {
        load: () => JSON.stringify({chats: [], projects: [], active: null, composerSelection: selection}),
        settings: () => '{}',
        providers: () => JSON.stringify({providers: [provider], account: {loggedIn: true}, defaultSelection: selection}),
        tasks: () => '[]',
        save: () => true,
        kernelDrain: () => JSON.stringify(quotaEvents.splice(0)),
        kernelCall: (ticket, method, json) => {
          quotaCalls.push({method, params: JSON.parse(json)});
          let result = {};
          if (method === 'account/read') result = {account: {type: 'chatgpt', planType: plan}};
          if (method === 'account/rateLimits/read') {
            result = {rateLimits: {
              primary: {usedPercent: 25, windowDurationMins: 300, resetsAt: 1795000000},
              secondary: {usedPercent: 60, windowDurationMins: 10080, resetsAt: 1795100000},
              credits: {balance: '12.00'}
            }, rateLimitResetCredits: {availableCount: 0}};
          }
          if (method === 'android/deepseekBalance') result = {is_available: true, balance_infos: [
            {currency: 'CNY', total_balance: '23.00', granted_balance: '3.00', topped_up_balance: '20.00'}
          ]};
          quotaEvents.push({ticket, result});
        }
      };
    });
    await page.route('https://eva.invalid/**', route => {
      const name = new URL(route.request().url()).pathname.slice(1);
      return route.fulfill({body: fs.readFileSync('probe/assets/' + name), contentType: name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html'});
    });
    await page.goto('https://eva.invalid/index.html');
    const toggle = page.locator('.composer-quota-toggle');
    const panel = page.locator('.composer-quota-panel');
    await page.waitForFunction(() => document.querySelector('.composer-quota-toggle')?.textContent.includes('5小时 75%，7天 40%'));
    assert.match(await toggle.innerText(), /Plus/);
    for (const width of [390, 320]) {
      await page.setViewportSize({width, height: 844});
      const placement = await toggle.evaluate(button => {
        const footer = button.closest('.composer-footer');
        const row = footer.getBoundingClientRect();
        const composer = footer.closest('.dock').querySelector('.composer').getBoundingClientRect();
        const workspace = footer.querySelector('.workspace-chip').getBoundingClientRect();
        const controls = footer.querySelector('[data-context-controls]').getBoundingClientRect();
        const pill = button.getBoundingClientRect();
        const middle = box => box.top + box.height / 2;
        return {
          centered: Math.abs(row.left + row.width / 2 - pill.left - pill.width / 2) < 2,
          below: pill.top >= composer.bottom,
          sameRow: Math.abs(middle(workspace) - middle(pill)) < 2 && Math.abs(middle(controls) - middle(pill)) < 2,
          noOverlap: workspace.right <= pill.left && pill.right <= controls.left,
          singleRow: row.height <= 32
        };
      });
      assert.deepEqual(placement, {centered: true, below: true, sameRow: true, noOverlap: true, singleRow: true});
    }
    await page.setViewportSize({width: 390, height: 844});

    assert.equal(await panel.isVisible(), false);
    await toggle.click();
    assert.match(await panel.innerText(), /5 小时限额.*重置/);
    assert.match(await panel.innerText(), /可用重置次数 0/);
    assert.match(await panel.innerText(), /额外额度余额 12.00/);
    await page.keyboard.press('Escape');
    assert.equal(await panel.isVisible(), false);
    await page.evaluate(() => {plan = 'pro'; kernelEvent({method: 'android/accountChanged'}); render();});
    await page.waitForFunction(() => /Pro · 40%/.test(document.querySelector('.composer-quota-toggle')?.textContent));
    assert.doesNotMatch(await toggle.innerText(), /5小时/);
    await page.evaluate(() => {data.composerSelection = {providerId:'ds', model:'deepseek-flash'}; render();});
    await page.waitForFunction(() => document.querySelector('.composer-quota-toggle')?.textContent.includes('DeepSeek API · 23.00 CNY'));
    await toggle.click();
    assert.match(await panel.innerText(), /充值余额 20.00 CNY/);
    assert.match(await panel.innerText(), /赠送余额 3.00 CNY/);
    const call = await page.evaluate(() => quotaCalls.find(c => c.method === 'android/deepseekBalance'));
    assert.deepEqual(call.params, {providerId: 'ds', revision: 'fixture'});
    await panel.getByRole('button', {name: '刷新额度'}).click();
    await page.waitForFunction(() => quotaCalls.filter(c => c.method === 'android/deepseekBalance').length === 2);
    await page.evaluate(() => { data.composerSelection = {providerId:'another', model:'other'}; render(); });
    assert.equal(await toggle.count(), 0);
    assert.deepEqual(errors, []);
    console.log('PASS Plus and Pro summaries, reset time and credits, DeepSeek breakdown, provider switch and refresh');
  } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode = 1;});
