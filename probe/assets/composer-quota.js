'use strict';
window.composerQuota = (() => {
  const cache = new Map();
  const lifetime = 60000;
  let selection, root;
  const percent = w => w?.remaining == null ? '—' : Math.round(w.remaining) + '%';
  const amount = (row, key) => row[key] == null ? '未提供' : row[key] + ' ' + row.currency;

  function accountView(value) {
    const {account, rates} = value || {};
    const view = window.desktopQuota?.quotaView(account, rates, true);
    if (!view) return {title: 'ChatGPT', summary: '', lines: []};
    const buckets = view.buckets;
    const windowList = (buckets.find(b => b.id === 'codex') || buckets[0])?.windows || [];
    const five = windowList.find(w => w.mins === 300);
    const week = windowList.find(w => w.mins === 10080);
    const summary = view.plan === 'plus' ? '5小时 ' + percent(five) + '，7天 ' + percent(week)
      : percent(week || five || windowList[0]);
    const lines = buckets.flatMap(b => [
      ...(buckets.length > 1 ? [b.name] : []),
      ...b.windows.map(window.desktopQuota.windowText)
    ]);
    const resetCount = rates?.rateLimitResetCredits?.availableCount;
    lines.push(Number.isInteger(resetCount) && resetCount >= 0 ? '可用重置次数 ' + resetCount : '可用重置次数未提供');
    const credits = (rates?.rateLimitsByLimitId?.codex || rates?.rateLimits)?.credits;
    if (credits?.unlimited === true) lines.push('额外额度不限量');
    else if (credits?.balance != null) lines.push('额外额度余额 ' + credits.balance);
    else if (typeof credits?.hasCredits === 'boolean') lines.push(credits.hasCredits ? '有额外额度' : '暂无额外额度');
    else lines.push('额外额度余额未提供');
    return {title: view.planLabel, summary, lines};
  }

  function apiView(value) {
    const rows = value?.balance_infos || [];
    const lines = rows.flatMap(row => [
      '可用余额 ' + amount(row, 'total_balance'),
      '充值余额 ' + amount(row, 'topped_up_balance'),
      '赠送余额 ' + amount(row, 'granted_balance')
    ]);
    if (value?.is_available === false) lines.push('当前余额不足以调用 API');
    return {title: 'DeepSeek API', summary: rows.map(row => amount(row, 'total_balance')).join('，'), lines};
  }

  function draw() {
    if (!root?.isConnected || !selection) return;
    const entry = cache.get(selection.key);
    const view = selection.id === 'openai' ? accountView(entry?.value) : apiView(entry?.value);
    const button = root.firstElementChild;
    const panel = root.lastElementChild;
    const expanded = button.getAttribute('aria-expanded') === 'true';
    const status = entry?.pending ? '读取中…' : entry?.error ? '读取失败' : '额度暂不可用';
    const label = view.title + ' · ' + (view.summary || status);
    button.textContent = label;
    button.title = label;
    panel.hidden = !expanded;
    if (!expanded) return;
    const lines = [...view.lines];
    if (entry?.error) lines.push(entry.error);
    else if (!lines.length) lines.push(status);
    const nodes = lines.map(text => {
      const p = document.createElement('p');
      p.textContent = text;
      return p;
    });
    const refresh = document.createElement('button');
    refresh.type = 'button';
    refresh.textContent = entry?.pending ? '正在刷新…' : '刷新额度';
    refresh.disabled = !!entry?.pending;
    refresh.onclick = () => void load(true);
    panel.replaceChildren(...nodes, refresh);
  }

  async function load(force = false) {
    const target = selection;
    if (!target) return;
    const old = cache.get(target.key);
    if (old?.pending || (!force && old && Date.now() - old.at < lifetime)) return;
    const entry = {value: old?.value, pending: true, at: Date.now()};
    if (cache.size > 24) cache.delete(cache.keys().next().value);
    cache.set(target.key, entry);
    draw();
    try {
      if (target.id === 'openai') {
        const {account} = await kernelCall('account/read', {refreshToken: false});
        if (cache.get(target.key) !== entry) return;
        if (account?.type !== 'chatgpt') throw Error('登录 ChatGPT 后可查看额度。');
        entry.value = {account, rates: entry.value?.rates};
        draw();
        entry.value.rates = await kernelCall('account/rateLimits/read', {});
      } else {
        entry.value = await kernelCall('android/deepseekBalance', {providerId: target.id, revision: target.revision});
      }
    } catch {
      entry.error = '额度读取失败，请刷新重试。';
    } finally {
      entry.pending = false;
      entry.at = Date.now();
      if (selection?.key === target.key && cache.get(target.key) === entry) draw();
    }
  }

  function mount(footer, provider, account) {
    let next;
    if (provider?.id === 'openai' && account?.loggedIn) next = {id: 'openai', key: 'openai'};
    if (provider?.hasDeepSeekBalance && provider.hasKey && provider.connectionRevision) {
      next = {id: provider.id, revision: provider.connectionRevision, key: provider.id + ':' + provider.connectionRevision};
    }
    if (!next) {
      root?.remove();
      selection = null;
      return false;
    }
    if (selection?.key !== next.key) root?.remove();
    selection = next;
    if (root?.parentElement !== footer) {
      root?.remove();
      root = document.createElement('div');
      root.className = 'composer-quota';
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'composer-quota-toggle';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-controls', 'composer-quota-details');
      const panel = document.createElement('div');
      panel.className = 'composer-quota-panel';
      panel.id = 'composer-quota-details';
      panel.hidden = true;
      toggle.onclick = () => {
        const open = toggle.getAttribute('aria-expanded') !== 'true';
        toggle.setAttribute('aria-expanded', String(open));
        draw();
        if (open) void load();
      };
      root.append(toggle, panel);
      footer.insertBefore(root, footer.querySelector('[data-context-controls]'));
      draw();
    }
    void load();
    return true;
  }

  function close() {
    const button = root?.firstElementChild;
    if (button?.getAttribute('aria-expanded') !== 'true') return;
    button.setAttribute('aria-expanded', 'false');
    draw();
  }
  document.addEventListener('pointerdown', event => { if (!root?.contains(event.target)) close(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && root?.isConnected) void load();
  });
  function event(message) {
    if (message.method === 'android/accountChanged' || message.method === 'account/login/completed') {
      cache.delete('openai');
      if (selection?.id === 'openai') draw();
    }
    if (message.method === 'account/rateLimits/updated') {
      const entry = cache.get('openai'), incoming = message.params;
      if (entry?.value?.rates && incoming?.rateLimits) {
        const rates = entry.value.rates;
        const id = incoming.rateLimits.limitId || 'codex';
        const update = {...rates, ...incoming};
        if (rates.rateLimitsByLimitId) update.rateLimitsByLimitId = {...rates.rateLimitsByLimitId, [id]: incoming.rateLimits};
        entry.value.rates = update;
        if (selection?.id === 'openai') draw();
      }
    }
  }
  return {mount, event};
})();
