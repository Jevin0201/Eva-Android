/* Codex clone — sidebar, header, transcript rendering */

function render() {
  globalThis.notificationSettings?.syncContext();
  renderSidebar();
  renderHead();
  renderTranscript();
  renderComposer();
  renderTabs();
  renderOverlay();
  globalThis.workspaceProtection?.sync();
}

// EVA host optimization: preserve unchanged navigation DOM during streaming updates.
const sidebarMarkupCache = new WeakMap();
function renderSidebar() {
  const sidebarTop = els.sidebarScroll.scrollTop;
  const focusedProject = document.activeElement?.dataset?.project;
  els.sidebar.classList.toggle("collapsed", state.sidebarCollapsed);
  document.body.classList.toggle("sidebar-collapsed", state.sidebarCollapsed);

  const destination = state.settingsOpen ? (["skills", "plugins"].includes(state.settingsTab) ? state.settingsTab : "account") : state.customize ? "plugins" : state.altPage || "chats";
  const railItems = [
    { key: "chats", icon: destination === "chats" ? "homeFilled" : "home", title: LANG === "zh" ? "首页" : "Home" },
    { key: "library", icon: destination === "library" ? "librarySelected" : "library", title: LANG === "zh" ? "资料空间" : "Spaces" },
    { key: "scheduled", icon: destination === "scheduled" ? "clockSelected" : "clock", title: t("scheduledTasks") },
    { key: "plugins", icon: destination === "plugins" ? "pluginSelected" : "plugin", title: t("plugins") },
    { key: "more", icon: "more", title: LANG === "zh" ? "探索" : "Explore" },
    { sep: true },
    ...(state.productMode === 'chatgpt' ? [] : [{ key: "review", icon: "reviewOriginal", title: LANG === "zh" ? "代码审查（当前会话）" : "Code review (current chat)" }]),
    { key: "sites", icon: "sitesOriginal", title: LANG === "zh" ? "站点" : "Sites" },
  ];

  const railHTML = `
    ${railItems
      .map((item) =>
        item.sep
          ? `<div class="rail-sep"></div>`
          : `<button class="rail-btn${destination === item.key ? " active" : ""}" data-rail="${item.key}" title="${esc(item.title)}" aria-label="${esc(item.title)}"${destination === item.key ? ' aria-current="page"' : ""}>${ic(item.icon)}</button>`,
      )
      .join("")}
    <div class="rail-grow"></div>
    <button class="rail-avatar" data-rail="account" title="${esc(accountLabel())}"><img src="assets/branding/eva-logo.png" alt="Eva" class="eva-avatar-logo" /></button>
  `;

  if (sidebarMarkupCache.get(els.rail) !== railHTML) {
    els.rail.innerHTML = railHTML;
    sidebarMarkupCache.set(els.rail, railHTML);
  }
  els.workspaceLabel.textContent = state.productMode==='chatgpt'?'ChatGPT':'Eva';
  const threadHTML = state.searchTerm.trim() ? renderSearchResults() : renderThreadTree();
  const threadKey = JSON.stringify([threadHTML, state.threadListError, state.threadListCursor, !!state.loadingMoreThreads]);
  if (sidebarMarkupCache.get(els.threadList) === threadKey) return;
  els.threadList.innerHTML = threadHTML;
  sidebarMarkupCache.set(els.threadList, threadKey);
  if (state.threadListError) {
    const retry = document.createElement('button');
    retry.className = 'thread-load-more';
    retry.textContent = state.threadListError;
    retry.addEventListener('click', refreshThreads);
    els.threadList.appendChild(retry);
  }
  if (state.threadListCursor) {
    const more = document.createElement('button');
    more.className = 'thread-load-more';
    more.textContent = state.loadingMoreThreads ? '正在加载…' : '加载更多对话';
    more.disabled = !!state.loadingMoreThreads;
    more.addEventListener('click', loadMoreThreads);
    els.threadList.appendChild(more);
  }
  if (focusedProject) els.threadList.querySelector(`[data-project="${CSS.escape(focusedProject)}"]`)?.focus({ preventScroll: true });
  els.sidebarScroll.scrollTop = sidebarTop;
}

function avatarLetter() {
  const email = state.settingsData?.account?.account?.email || "";
  return (email || "C").slice(0, 1).toUpperCase();
}

function accountLabel() {
  return state.settingsData?.account?.account?.email || t("account");
}

function collectProjects(threads = state.threads) {
  const map = new Map();
  // Trust configuration is metadata, not a list of projects added to this client.
  const trust = new Map(Object.entries(state.config?.projects || {}).map(([path, value]) => [projectKey(path), value?.trust_level ?? value?.trustLevel ?? null]));
  for (const entry of Object.values(state.localProjects)) {
    // Legacy picker entries had a path without a name; name-only edits are not pins.
    if (!entry.path || entry.removed || !(entry.added || !entry.name)) continue;
    const key = projectKey(entry.path);
    if (!map.has(key)) map.set(key, { key, path: entry.path, name: basename(entry.path), added: true, trust: trust.get(key) || null, threads: [], latest: 0 });
  }
  for (const thread of threads) {
    if(thread.projectless)continue;
    const path = thread.cwd || "";
    const key = projectKey(path);
    if (!key) continue;
    if (!map.has(key)) {
      map.set(key, { key, path, name: basename(path), trust: trust.get(key) || null, threads: [], latest: 0 });
    }
    const group = map.get(key);
    group.threads.push(thread);
    group.latest = Math.max(group.latest, thread.recencyAt || thread.updatedAt || 0);
  }
  for (const group of map.values()) {
    group.name = state.localProjects[group.key]?.name || group.name;
    group.threads.sort(
      (a, b) => (b.recencyAt || b.updatedAt || 0) - (a.recencyAt || a.updatedAt || 0),
    );
  }
  return Array.from(map.values())
    .filter((group) => !state.localProjects[group.key]?.removed && (group.threads.length > 0 || group.added))
    .sort((a, b) => b.latest - a.latest);
}

function activeProjectKey() {
  if(state.thread?.projectless)return '';
  return projectKey(state.thread?.cwd || state.cwd || "");
}

function renderThreadTree() {
  if (state.view === "archived") return renderArchived();

  const visibleThreadIds = new Set();
  const html = [];
  const sectionThreadIds = new Set();
  const pinnedIds = new Set(store.get('codex-rae.pinnedThreads', []));
  const pinned = state.threads.filter(thread => pinnedIds.has(thread.id));
  if (pinned.length) {
    html.push('<div class="section-head"><span class="sec-title">置顶</span></div><div class="threads">');
    for (const thread of pinned) { sectionThreadIds.add(thread.id); html.push(renderThreadItem(thread)); }
    html.push('</div>');
  }
  for (const section of state.sections) {
    const threads = state.threads.filter((thread) => thread.section?.id === section.id && !sectionThreadIds.has(thread.id));
    if (!threads.length) continue;
    for (const thread of threads) sectionThreadIds.add(thread.id);
    const expanded = !state.collapsedSections.has(section.id);
    html.push(
      `<div class="section-head"><button class="sec-toggle" data-section-toggle="${esc(section.id)}" title="${esc(section.name)}">${ic(expanded ? "chevron" : "chevronRight")}</button><span class="sec-title">${esc(section.name)}</span><button data-section-menu="${esc(section.id)}" title="${esc(t("renameSection"))}">${ic("more")}</button></div>`,
    );
    if (expanded) {
      html.push(`<div class="threads">`);
      for (const thread of threads) {
        visibleThreadIds.add(thread.id);
        html.push(renderThreadItem(thread));
      }
      html.push(`</div>`);
    }
  }

  const projects = collectProjects(
    state.threads.filter((thread) => !sectionThreadIds.has(thread.id)),
  );
  const projectThreadIds = new Set(projects.flatMap(group => group.threads.map(thread => thread.id)));

  html.push(
    `<div class="section-head project-section-head" data-project-section><span class="sec-title">${esc(t("projects"))}</span><button class="icon-btn project-create" data-action="create-project" aria-label="创建项目" title="创建项目">${ic("plus")}</button></div>`,
  );

  for (const group of projects) {
    const expanded = !state.collapsedProjects.has(group.key);
    const hasActive = state.thread ? group.threads.some((thread) => thread.id === state.activeThreadId) : group.key === activeProjectKey();
    html.push(`<div class="proj-group">`);
    html.push(
      `<button class="proj-row${hasActive ? " active" : ""}" data-project="${esc(group.key)}" aria-expanded="${expanded}" title="${esc(group.path)}">
        ${ic(expanded ? "projectFolderOpen" : "folder", "folder")}
        <span class="proj-name">${esc(group.name)}</span>
        ${ic(expanded ? "chevron" : "chevronRight", "chev")}
      </button>`,
    );
    if (!expanded) { html.push(`</div>`); continue; }
    html.push(`<div class="threads">`);
    const limit = state.projectLimits[group.key] || 7;
    for (const thread of group.threads.slice(0, limit)) {
      visibleThreadIds.add(thread.id);
      html.push(renderThreadItem(thread));
    }
    if (group.threads.length > limit) {
      html.push(
        `<button class="side-more" data-more-project="${esc(group.key)}">${esc(t("showMore"))} (${group.threads.length - limit})</button>`,
      );
    }
    if (limit > 7) {
      html.push(
        `<button class="side-more" data-less-project="${esc(group.key)}">${esc(t("showLess"))}</button>`,
      );
    }
    html.push(`</div>`);
    html.push(`</div>`);
  }

  const recent = state.threads
    .filter((thread) => !projectThreadIds.has(thread.id) && !sectionThreadIds.has(thread.id))
    .slice(0, 12);
  if (recent.length) {
    html.push(
      `<button class="recent-head${state.collapsedRecent ? "" : " open"}" data-action="toggle-recent">${ic("chevronRight")}<span>${esc(t("recent"))}</span></button>`,
    );
    if (!state.collapsedRecent) {
      for (const thread of recent) html.push(renderThreadItem(thread));
    }
  }
  return html.join("");
}

function renderThreadItem(thread) {
  const active = thread.id === state.activeThreadId;
  const title = threadTitle(thread);
  return `<button class="thread-item${active ? " active" : ""}" data-thread="${esc(thread.id)}" title="${esc(title)}">
    <span class="ti-title">${esc(title)}</span>
    ${renderThreadActivity(thread,active)}
  </button>`;
}

function renderThreadActivity(thread,active){
  const status=globalThis.threadActivity?.presentation(thread,{owned:active&&state.running});
  if(status?.type==='loading')return '<span class="ti-status" role="status" aria-label="正在运行"><svg class="ti-spinner" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 3a7 7 0 0 1 0 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span>';
  return status?.unread?'<span class="ti-status" role="status" aria-label="有未读结果"><span class="ti-unread"></span></span>':'';
}

function renderSearchResults() {
  const q = state.searchTerm.trim().toLowerCase();
  const results = state.threads.filter((thread) => {
    const haystack = `${threadTitle(thread)}\n${thread.preview || ""}\n${thread.cwd || ""}`.toLowerCase();
    return haystack.includes(q);
  });
  if (!results.length) return `<div class="side-empty">${esc(t("searchEmpty"))}</div>`;
  return results.map((thread) => renderThreadItem(thread)).join("");
}

function renderArchived() {
  const rows = state.threads
    .map(
      (thread) => `<button class="thread-item" data-thread="${esc(thread.id)}">
        <span class="ti-title">${esc(threadTitle(thread))}</span>
        <span class="ti-preview">${esc(basename(thread.cwd || ""))}</span>
      </button>`,
    )
    .join("");
  return `<div class="section-head"><button class="btn subtle" data-action="back-threads" style="height:24px">← ${esc(t("back"))}</button></div>
    ${rows || `<div class="side-empty">${esc(t("archivedEmpty"))}</div>`}`;
}

function renderHead() {
  const cwd = state.thread?.cwd || state.cwd || "";
  const project = basename(cwd) || "Codex";
  const title = state.thread ? threadTitle(state.thread) : t("newChat");
  els.crumbs.innerHTML = `
    <span class="head-thread-icon">${ic("folder", "icon")}</span>
    <button class="crumb crumb-title" data-action="project-menu" title="${esc(title)}">${esc(title)}</button>
  `;
  els.headDiff.classList.add("hidden");
  els.headMore.disabled = !state.thread;
  document.getElementById('head-summary').disabled = !state.thread;
  document.getElementById('head-summary').setAttribute('aria-pressed', String(state.outputsOpen));
  els.navBack.disabled = state.altPage!=='sites'&&state.navIndex <= 0;
  els.navForward.disabled = state.navIndex >= state.navStack.length - 1;
  els.tbSidebar.disabled = false;
}

function turnErrorHtml(turn) {
  if (!turn?.error) return "";
  const rawMessage =
    turn.error.message ||
    turn.error.codexErrorInfo ||
    turn.error.additionalDetails ||
    safeJson(turn.error);
  const message=quotaFailureText(rawMessage)||(/stream disconnected|WebSocket|connection (?:reset|closed)|request timed out/i.test(String(rawMessage))?'连接中断，本次回复未完成。请检查网络或模型服务。':rawMessage);
  const quota = /usage.?limit|rate.?limit|使用上限|额度|hit your/i.test(String(message));
  return `<div class="turn-error${quota ? " quota-error" : ""}" role="alert">${quota ? ic("info") : ""}<span>${esc(message)}</span></div>`;
}

const transcriptOutputPositions = new Map();
const transcriptMissingImages = new Set();
let transcriptViewportMemory = null;
let transcriptNativeResizeObserver;

function watchNativeTranscriptLayout(){
  if(transcriptNativeResizeObserver||typeof ResizeObserver!=='function')return;
  transcriptNativeResizeObserver=new ResizeObserver(()=>restoreTranscriptAfterMedia());
  transcriptNativeResizeObserver.observe(els.transcript);
  transcriptNativeResizeObserver.observe(els.threadScroll);
}

function rememberTranscriptViewport() {
  const sc = els.threadScroll;
  transcriptViewportMemory = { threadId: state.thread?.id, top: sc.scrollTop,
    follow: sc.scrollHeight - sc.scrollTop - sc.clientHeight <= 24, anchor: sc.scrollHeight - sc.scrollTop - sc.clientHeight <= 24 ? null : transcriptViewportAnchor() };
}

function restoreTranscriptAfterMedia() {
  const memory = transcriptViewportMemory;
  const sc = els.threadScroll;
  if (!memory || memory.threadId !== state.thread?.id || Math.abs(sc.scrollTop - memory.top) > 1) {
    rememberTranscriptViewport(); return;
  }
  const root = memory.anchor && els.transcript.querySelector(`[data-flow-key="${CSS.escape(memory.anchor.key)}"]`);
  const anchorRoot=memory.anchor?.shadow?root?.shadowRoot:root;
  const leaf = anchorRoot && (memory.anchor.selector ? anchorRoot.querySelector(memory.anchor.selector) : root);
  if (memory.follow) sc.scrollTop = sc.scrollHeight;
  else if (leaf) sc.scrollTop += leaf.getBoundingClientRect().top - memory.anchor.top;
  state.lastScrollTop = sc.scrollTop;
  rememberTranscriptViewport();
}

function transcriptViewportAnchor() {
  const viewport = els.threadScroll.getBoundingClientRect();
  const candidates = [];
  for (const root of els.transcript.querySelectorAll('[data-flow-key]')) {
    const rootRect = root.getBoundingClientRect();
    if (rootRect.bottom <= viewport.top || rootRect.top >= viewport.bottom) continue;
    const queryRoot=root.shadowRoot||root;
    const leaves = [...queryRoot.querySelectorAll('p,pre,li,.activity,.process-toggle')];
    for (const element of leaves.length ? leaves : [root]) {
      const rect = element.getBoundingClientRect();
      if (rect.bottom <= viewport.top || rect.top >= viewport.bottom || !rect.height) continue;
      const parts = []; let node = element;
      while (node !== queryRoot&&node!==root) {
        const siblings = [...node.parentNode.children].filter(e => e.tagName === node.tagName);
        parts.unshift(`${node.tagName.toLowerCase()}:nth-of-type(${siblings.indexOf(node) + 1})`); node = node.parentNode;
      }
      const candidate = { key: root.dataset.flowKey, selector: parts.join(' > '), top: rect.top };
      if(root.shadowRoot)candidate.shadow=true;
      if (rect.top >= viewport.top) return candidate;
      candidates.push(candidate);
    }
  }
  return candidates.find(c => c.top >= viewport.top) || candidates[0] || null;
}

function renderTranscript(options = {}) {
  watchNativeTranscriptLayout();
  globalThis.nativeUserInputHost?.hydrate();
  if(typeof renderSubagentLauncher==='function')renderSubagentLauncher();
  globalThis.cloudMarkdown?.hydrate(els.transcript);
  document.body.classList.toggle('new-chat', !state.thread && !state.loadingThread&&!state.pendingSubmission);
  renderOutputsPanel();
  const sc = els.threadScroll;
  const nearBottom = sc.scrollHeight - sc.scrollTop - sc.clientHeight <= 24;
  const prevTop = sc.scrollTop;
  const viewportAnchor = nearBottom ? null : transcriptViewportAnchor();
  const focusedToggle = els.transcript.contains(document.activeElement) ? document.activeElement.closest('[data-toggle]')?.dataset.toggle : null;
  // Scrolling through a live process is not an explicit expansion choice.
  // Completed work defaults to collapsed; only disclosure clicks expand it.
  const currentTurns = new Map((state.thread?.turns || []).map(turn => [String(turn.id), turn]));
  for (const process of els.transcript.querySelectorAll('[data-process]')) {
    if (process.dataset.processStatus !== 'inProgress') continue;
    const turn = currentTurns.get(process.closest('[data-turn]')?.dataset.turn);
    if (turn && turn.status !== 'inProgress') state.expanded.delete(process.dataset.process);
  }
  const outputKey = element => `${element.closest('[data-turn]')?.dataset.turn}:${element.dataset.output}`;
  for (const element of $$("[data-output]", els.transcript)) {
    const key = outputKey(element);
    transcriptOutputPositions.delete(key);
    transcriptOutputPositions.set(key, { top: element.scrollTop, left: element.scrollLeft,
      atBottom: element.scrollHeight - element.scrollTop - element.clientHeight < 4 });
  }
  while (transcriptOutputPositions.size > 200) transcriptOutputPositions.delete(transcriptOutputPositions.keys().next().value);
  if(state.loadingThread&&state.threadPreview?.id===state.activeThreadId){
    patchTranscriptDOM(els.transcript,state.threadPreview.turns.map(renderTurn).join('')+'<div class="turn-progress" role="status">'+ic('refresh')+'<span>正在同步对话…</span></div>',state.activeThreadId);
    renderTranscriptNavigator();return;
  }
  if (state.loadingThread) {
    patchTranscriptDOM(els.transcript, `<div class="thread-skeleton" aria-label="${esc(t("loading"))}">
      <div class="sk-row"><span class="sk-avatar"></span><span class="sk-line w70"></span></div>
      <div class="sk-line"></div><div class="sk-line w92"></div><div class="sk-line w60"></div>
      <div class="sk-row" style="margin-top:26px"><span class="sk-avatar"></span><span class="sk-line w40"></span></div>
      <div class="sk-line w86"></div><div class="sk-line w74"></div>
    </div>`, state.activeThreadId);
    renderTranscriptNavigator();
    return;
  }

  const pending=state.pendingSubmission,pendingHtml=pending?renderUserMessage({id:'pending:'+pending.id,content:composerInput(pending.text,pending.attachments,pending.mentions)},{id:'pending:'+pending.id})+'<div class="turn-progress" role="status">'+ic('dot')+'<span>正在发送…</span></div>':'';
  const compactionTurns=state.thread&&globalThis.contextCompaction?globalThis.contextCompaction.overlay(state.thread.id,state.thread.turns||[]):state.thread?.turns||[];
  const displayTurns=state.thread&&globalThis.steeringState?globalThis.steeringState.overlay(state.thread.id,compactionTurns):compactionTurns;
  if (!state.thread || !displayTurns.length) {
    const background=state.thread&&typeof renderUnassignedBackgroundAgents==='function'?renderUnassignedBackgroundAgents(state.thread.id):'';
    patchTranscriptDOM(els.transcript, (pendingHtml||renderEmpty())+background, state.thread?.id);
    renderTranscriptNavigator();
    return;
  }

  const chunks = [];
  if (state.olderCursor) {
    chunks.push(
      `<button class="load-older" data-action="load-older">${esc(state.loadingOlder ? t("loading") : t("loadOlder"))}</button>`,
    );
  }
  let previousTime = null;
  for (const turn of displayTurns) {
    const showTime = turn.startedAt && (!previousTime || toMs(turn.startedAt) - toMs(previousTime) > 1800000);
    chunks.push(renderTurn(turn, showTime));
    previousTime = turn.startedAt || previousTime;
  }
  if(typeof renderUnassignedBackgroundAgents==='function')chunks.push(renderUnassignedBackgroundAgents(state.thread.id));
  patchTranscriptDOM(els.transcript, chunks.join("")+pendingHtml, state.thread.id,[...chunks,pendingHtml]);
  globalThis.cloudUserMessages?.hydrate(els.transcript,{selector:'.codex-user-text',container:'.bubble'});
  for (const element of $$("[data-output]", els.transcript)) {
    const position = transcriptOutputPositions.get(outputKey(element));
    if (!position) continue;
    element.scrollTop = position.atBottom ? element.scrollHeight : position.top;
    element.scrollLeft = position.left;
  }

  // Restore before another render can observe the temporarily clamped scrollTop.
  // Deferred rAF restorations used to race rapid toggles and stream notifications.
  const anchor = options?.anchor;
  const toggle = anchor && els.transcript.querySelector(`[data-toggle="${CSS.escape(anchor.id)}"]`);
  const root = viewportAnchor && els.transcript.querySelector(`[data-flow-key="${CSS.escape(viewportAnchor.key)}"]`);
  const anchorRoot=viewportAnchor?.shadow?root?.shadowRoot:root;
  const leaf = anchorRoot && (viewportAnchor.selector ? anchorRoot.querySelector(viewportAnchor.selector) : root);
  if (toggle) sc.scrollTop += toggle.getBoundingClientRect().top - anchor.top;
  else if (nearBottom) sc.scrollTop = sc.scrollHeight;
  else if (leaf) sc.scrollTop += leaf.getBoundingClientRect().top - viewportAnchor.top;
  else sc.scrollTop = prevTop;
  state.lastScrollTop = sc.scrollTop;
  if (focusedToggle) els.transcript.querySelector(`[data-toggle="${CSS.escape(focusedToggle)}"]`)?.focus({ preventScroll: true });
  rememberTranscriptViewport();
  renderTranscriptNavigator();
}

function renderEmpty() {
  const cwd = newChatProjectName();
  return `<div class="empty-state">
    <div class="empty-logo"><img src="assets/branding/eva-logo.png" alt="Eva" class="eva-empty-logo" /></div>
    <div class="empty-title">${esc(state.cwd===null||state.thread?.projectless?t('emptyTitle'):LANG === 'zh' ? `我们应该在${cwd}中做些什么？` : `What should we do in ${cwd}?`)}</div>
  </div>`;
}

function renderTurn(turn, showTime = true) {
  const renderScope=`${state.thread?.id||state.activeThreadId||''}:${turn.id}`;
  globalThis.nativeTranscript?.beginRender?.(renderScope);
  try {
  const html = [`<section class="turn-block" data-turn="${esc(turn.id)}" data-turn-key="${esc(turn.id)}">`];
  if (showTime && turn.startedAt) html.push(`<div class="turn-time">${esc(fmtFull(turn.startedAt))}</div>`);
  let segment = [];
  let segmentIndex = 0;
  const flush = () => {
    if (segment.length) {
      html.push(renderAssistantSegment(segment, turn, segmentIndex++));
    }
    segment = [];
  };
  for (const item of turn.items || []) {
    if (!item) continue;
    if (["userMessage","steeringUserMessage"].includes(item.type)) { flush(); html.push(renderUserMessage(item, turn)); }
    else segment.push(item);
  }
  flush();
  // A completed tool is still part of a running turn. Only the terminal turn
  // owns the result card; steering does not create extra completion boundaries.
  html.push(renderTurnChanges(turn));
  if (!segmentIndex && state.plans.has(turn.id)) html.push(`<div class="msg-assistant">${renderPlan(state.plans.get(turn.id))}</div>`);
  html.push(turnErrorHtml(turn));
  html.push(renderTurnArtifacts(turn));
  const connection=state.turnConnections?.get(JSON.stringify([state.activeThreadId,turn.id]));
  if(shouldShowThinking(turn,connection))html.push(renderThinking(turn));
  if(connection&&!['finished','recovered'].includes(connection.kind)&&(turn.status==='inProgress'||connection.kind==='failed')&&!(connection.kind==='failed'&&turn.error))html.push(`<div class="turn-connection${connection.kind==='failed'?' failed':''}" data-flow-key="${esc(turn.id+':connection')}" role="status">${ic(connection.kind==='failed'?'info':'dot')}<span>${esc(connection.text)}</span></div>`);
  if (turn.status !== "inProgress" && finalAnswerItems(turn).length) {
    html.push(`<div class="msg-actions turn-actions"><button class="mini-btn" data-copy-turn="${esc(turn.id)}" title="${esc(t("copy"))}" aria-label="复制回答">${ic("chatCopy")}</button><button class="mini-btn" data-turn-menu="${esc(turn.id)}" title="${esc(t("more"))}">${ic("more")}</button></div>`);
  }
  html.push(`</section>`);
  return html.join("");
  } finally { globalThis.nativeTranscript?.endRender?.(renderScope); }
}

function finalAnswerStart(items, turn) {
  if(globalThis.nativeTranscript?.isFinal)return items.findIndex(item=>nativeTranscript.isFinal(item,turn));
  const explicit = items.findIndex(item => item.type === "agentMessage" && item.phase === "final_answer" && item.text?.trim());
  if (explicit >= 0) return explicit;
  // Older providers omit phase. Only a terminal text item is inferred as final.
  if (turn.status !== "inProgress") {
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      if (item.type === "agentMessage" && !item.text?.trim()) continue;
      return item.type === "agentMessage" ? i : -1;
    }
  }
  return -1;
}

function renderThinking(turn){return `<div class="eva-thinking" data-flow-key="${esc(turn.id+':thinking')}" role="status" aria-live="polite"><span class="eva-thinking-text">正在思考<span class="eva-thinking-sweep" aria-hidden="true"><span class="eva-thinking-highlight">正在思考</span></span></span></div>`;}

function shouldShowThinking(turn,connection){if(turn.status!=='inProgress'||turn.error||connection&&!['finished','recovered'].includes(connection.kind))return false;if((state.approvals||[]).some(a=>a.params?.threadId===state.activeThreadId&&(!a.params.turnId||a.params.turnId===turn.id)))return false;const last=(turn.items||[]).findLast(item=>!['userMessage','steeringUserMessage'].includes(item.type)&&activityDisposition(item)!=='hidden');if(!last)return true;if(last.type==='contextCompaction'&&globalThis.contextCompaction?.presentation(last,turn).status==='inProgress')return false;if(last.type==='agentMessage')return !last.text?.trim();if(globalThis.nativeTranscript?.summarize&&['groupable','auxiliary'].includes(activityDisposition(last)))return false;if(last.type==='reasoning')return !reasoningContent(last);return last.status!=='inProgress';}

function finalAnswerItems(turn) {
  const items = turn.items || [];
  const lastUser = items.findLastIndex(item => ["userMessage","steeringUserMessage"].includes(item.type));
  const response = items.slice(lastUser + 1);
  const start = finalAnswerStart(response, turn);
  return start < 0 ? [] : response.slice(start).filter(item => item.type === "agentMessage" && item.text?.trim());
}

function itemFailed(item) {
  return item.status === "failed" || item.status === "declined" || item.success === false || Boolean(item.error || item.failure) || item.result?.isError === true || (item.exitCode != null && item.exitCode !== 0);
}

function turnDurationLabel(turn) {
  const ms = turn.durationMs ?? (turn.completedAt && turn.startedAt ? toMs(turn.completedAt) - toMs(turn.startedAt) : null);
  if (ms == null) return LANG === "zh" ? "处理过程" : "Work details";
  const sec = Math.max(0, Math.floor(ms / 1000));
  const duration = sec >= 60 ? `${Math.floor(sec / 60)}m ${sec % 60}s` : `${sec}s`;
  return `${LANG === "zh" ? "用时" : "Worked for"} ${duration}`;
}

function renderAssistantSegment(items, turn, index) {
  const start = finalAnswerStart(items, turn);
  const work = start >= 0 ? items.slice(0, start) : items;
  const final = start >= 0 ? items.slice(start) : [];
  // Original rM keeps actionable approval failures outside collapsed history.
  const persistent = work.filter(item => globalThis.nativeTranscript?.isPersistent ? nativeTranscript.isPersistent(item,turn) : item.type === 'mcpToolCall' && item.result?.type === 'error' && item.result.error === 'MCP tool call requires approval, but approval policy is never');
  const collapsibleWork = work.filter(item => !persistent.includes(item));
  const hasPlan = state.plans.has(turn.id) && !items.some(item => item.type === "plan");
  const key = `process:${turn.id}:${index}`;
  const completed = turn.status !== "inProgress";
  // Current Windows local-conversation-thread passes commentaryDisplay="all".
  // Its fM/uM disclosure collapses work after the final response, except when
  // cancelled. Native activity slices do not replace this outer disclosure.
  const nativeFlow = Boolean(globalThis.nativeTranscript?.summarize);
  const cancelled = ['interrupted','cancelled','canceled','failed'].includes(turn.status);
  const hasActiveAgents = typeof transcriptBackgroundAgents === 'function' && transcriptBackgroundAgents(turn).some(agent => agent.status !== 'done');
  const disclosure=globalThis.nativeTranscript?.disclosureState?.({hasFinalAssistantStarted:final.length>0,isTurnCancelled:cancelled,hasRenderableAgentItems:work.length>0||hasPlan,forceExpanded:hasActiveAgents,persistedCollapsed:isExpanded(key)?false:undefined});
  const collapsible = disclosure?.shouldAllowCollapse ?? (!cancelled && final.length > 0);
  const open = disclosure ? !disclosure.isCollapsed : !collapsible || hasActiveAgents || isExpanded(key);
  // Closed history has no mounted body. Avoid building hidden tool outputs and
  // nested native models on every live delta; generate them when expanded.
  const workHtml = open ? renderFlowItems(collapsibleWork, turn,start>=0) + (hasPlan ? renderPlan(state.plans.get(turn.id)) : "") : "";
  const hasWork = open ? !!workHtml : hasPlan || collapsibleWork.some(item => {
    const disposition = activityDisposition(item);
    if(disposition === 'hidden')return false;
    if(disposition === 'groupable' || disposition === 'auxiliary')return nativeFlow || item.type !== 'reasoning' || !!reasoningContent(item);
    return !!renderItem(item,turn);
  });
  const failures = work.filter(itemFailed);
  let html = "";
  if (hasWork) {
    html += `<div class="turn-process${open ? " open" : ""}" data-process="${esc(key)}" data-process-status="${esc(turn.status)}">`;
    if (collapsible) {
      html += `<button class="process-toggle" data-toggle="${esc(key)}" aria-expanded="${open}" aria-controls="${esc(key)}" data-failure-count="${failures.length}" title="${LANG==='zh'?'查看处理过程':'View work details'}">${esc(turnDurationLabel(turn))}${ic("chevronRight", "chev")}</button>`;
    } else if (!nativeFlow && !completed && turn.startedAt) {
      const elapsed = turnDurationLabel({ durationMs: Math.max(0, Date.now() - toMs(turn.startedAt)) }).replace(LANG === "zh" ? "用时" : "Worked for", LANG === "zh" ? "已处理" : "Working for");
      html += `<div class="process-live-label">${esc(elapsed)}</div>`;
    }
    if (persistent.length) html += renderFlowItems(persistent, turn);
    if (open) html += `<div class="process-body" id="${esc(key)}">${workHtml}</div>`;
    html += `</div>`;
  }
  if (!hasWork && persistent.length) html += renderFlowItems(persistent, turn);
  if (final.length) html += `<div class="turn-final">${renderFlowItems(final, turn)}</div>`;
  return html ? `<div class="msg-assistant" data-segment="${esc(`${turn.id}:${index}`)}">${html}</div>` : "";
}

function activityDisposition(item) {
  const native=globalThis.nativeTranscript?.disposition?.(item);
  if(native)return native;
  if (item.hiddenInConversation === true) return 'hidden';
  if(['collabAgentToolCall','subAgentActivity'].includes(item.type))return 'standalone';
  if (item.standaloneInConversation === true) return 'standalone';
  if (item.type === 'reasoning') return 'auxiliary';
  if (item.type === 'webSearch' && typeof item.query === 'string' && !item.query.trim()) return 'hidden';
  return ['commandExecution','fileChange','mcpToolCall','dynamicToolCall','collabAgentToolCall','webSearch'].includes(item.type) ? 'groupable' : 'standalone';
}

function renderFlowItems(items, turn, closeTail=false) {
  const html = [];
  let activity = [];
  let pendingReasoning = [];
  const flushActivity = () => {
    if (activity.length) {
      if (activity.every(item => item.type === 'reasoning')) pendingReasoning.push(...activity);
      else html.push(renderWorkActivity(activity, turn));
    }
    activity = [];
  };
  // REA A1 coalesces only adjacent imageView records; other tools break the run.
  const flow = [];
  for (const item of items) {
    // Invisible wait records still separate native agent groups. Removing them
    // here would make F discard the next anchor while whole-turn aggregation
    // still treats it as a separate group.
    if(item.type==='collabAgentToolCall'&&item.tool==='wait'&&!globalThis.nativeTranscript?.summarize)continue;
    const previous=flow.at(-1);
    if(item.type==='collabAgentToolCall'&&previous?.type==='collabAgentToolCall'&&previous.tool===item.tool){
      const actions=[...(previous._agentActions||[previous]),item];
      flow[flow.length-1]={...previous,_agentActions:actions,status:actions.some(a=>a.status==='inProgress')?'inProgress':actions.some(a=>a.status==='failed')?'failed':actions.some(a=>a.status==='interrupted')?'interrupted':'completed'};
    } else if (item.type === 'imageView') {
      const paths = imageViewSources(item), previous = flow.at(-1);
      if (previous?.type === 'imageView') { previous.imagePaths.push(...paths); previous.imageCount += item.imageCount || paths.length || 1; }
      else flow.push({ ...item, imagePaths: paths, imageCount: item.imageCount || paths.length || 1 });
    } else flow.push(item);
  }
  if(globalThis.nativeTranscript){
    const groups=nativeTranscript.renderGroups(flow,activityDisposition,{scope:`${state.thread?.id||state.activeThreadId||''}:${turn.id}`,turn,backgroundAgents:typeof transcriptBackgroundAgents==='function'?transcriptBackgroundAgents(turn):[]});
    for(const [groupIndex,group] of groups.entries()){
      if(group.type==='agent-activity')html.push(renderWorkActivity(group.items,turn,group.key,group.collapseWhenPossible||closeTail,groupIndex===groups.length-1));
      else if(group.items)html.push(group.items.map(item=>renderItem(item,turn)).join(''));
      else if(group.item){const item=group.item;html.push(renderItem(item,turn).replace(/^<([a-z][a-z0-9-]*)/i,`<$1 data-flow-key="${esc(group.key)}"`));}
    }
    return html.join('');
  }
  for (const item of flow) {
    const disposition = activityDisposition(item);
    const groupable = disposition === 'groupable' || disposition === 'auxiliary';
    // Match the shipped activity classifier: ordinary tools share an activity
    // disclosure; prose, interactive content and approvals remain separate.
    // Retain reasoning in the disclosure rather than printing raw previews.
    const rendered = disposition === 'hidden' ? ''
      : groupable ? (item.type === 'reasoning' && !reasoningContent(item) ? '' : null)
      : renderItem(item, turn);
    if (rendered === "") continue;
    if (rendered === null) {
      if (item.type !== 'reasoning' && pendingReasoning.length) { activity.unshift(...pendingReasoning); pendingReasoning = []; }
      activity.push(item);
    }
    else { flushActivity(); html.push(rendered.replace(/^<([a-z][a-z0-9-]*)/i, `<$1 data-flow-key="${esc(`${turn.id}:${item.id}`)}"`)); }
  }
  flushActivity();
  if (pendingReasoning.length) html.push(renderWorkActivity(pendingReasoning, turn));
  return html.join("");
}

const transcriptReferenceCatalog={scope:null,at:0,pending:null,plugins:[],skills:[]};
function transcriptReferenceScope(){return JSON.stringify([state.thread?.cwd||state.cwd||'',state.meta?.codexHome||'']);}
function warmTranscriptReferences(){
  if(typeof api==='undefined'||typeof api.call!=='function')return;
  const cache=transcriptReferenceCatalog,scope=transcriptReferenceScope();
  if(cache.scope===scope&&(cache.pending||Date.now()-cache.at<15000))return;
  cache.scope=scope;cache.plugins=[];cache.skills=[];cache.at=Date.now();
  const cwd=state.thread?.cwd||state.cwd,params=cwd?{cwds:[cwd]}:{};
  const pending=Promise.allSettled([api.call('plugin/installed',params),api.call('skills/list',params)]);cache.pending=pending;
  pending.then(([plugins,skills])=>{if(cache.pending!==pending||scope!==transcriptReferenceScope())return;cache.plugins=plugins.status==='fulfilled'?(plugins.value.marketplaces||[]).flatMap(m=>(m.plugins||[]).map(p=>({...p,marketplace:m}))):[];cache.skills=skills.status==='fulfilled'?(skills.value.data||[]).flatMap(d=>d.skills||[]):[];cache.pending=null;cache.at=Date.now();if(typeof renderTranscript==='function')renderTranscript();}).catch(()=>{if(cache.pending===pending)cache.pending=null;});
}
function userMessageReferenceItem(ref){
  try{const item=ref.kind==='plugin'&&typeof customizePlugins==='function'?customizePlugins().find(p=>'plugin://'+p.id===ref.path):ref.kind==='skill'&&typeof customizeSkills==='function'?customizeSkills().find(s=>s.path===ref.path):null;
    if(item)return item;
    if(transcriptReferenceCatalog.scope!==transcriptReferenceScope())return null;
    return ref.kind==='plugin'?transcriptReferenceCatalog.plugins.find(p=>'plugin://'+p.id===ref.path):transcriptReferenceCatalog.skills.find(s=>s.path===ref.path);
  }catch{return null;}
}
function renderUserMessageReferences(text,content){
  const refs=[],seen=new Set();
  for(const input of content||[]){const kind=input?.type==='skill'?'skill':input?.type==='mention'&&String(input.path||'').startsWith('plugin://')?'plugin':null;if(!kind||!input.path||seen.has(kind+input.path))continue;seen.add(kind+input.path);refs.push({kind,name:input.name||basename(input.path),path:input.path});}
  if(refs.length)warmTranscriptReferences();
  const spans=[],extras=[];
  for(const ref of refs){const item=userMessageReferenceItem(ref),names=[ref.name,item?.interface?.displayName].filter(Boolean),tokens=names.flatMap(name=>['@',...(ref.kind==='skill'?['$']:[])].map(prefix=>prefix+name)).sort((a,b)=>b.length-a.length);let match=null;
    for(const token of tokens){let start=text.indexOf(token);while(start>=0){const end=start+token.length;if(!/[\p{L}\p{N}_-]/u.test(text[end]||'')&&!spans.some(s=>start<s.end&&end>s.start)){if(!match||start<match.start)match={start,end};break;}start=text.indexOf(token,start+1);}}
    const face=item?.interface||{},local=face.iconSmall||face.composerIcon||face.logo||face.iconLarge,remote=face.iconSmallUrl||face.composerIconUrl||face.logoUrl;
    const src=local?mediaUrl(local):/^https:\/\//i.test(remote||'')?remote:globalThis.builtinPluginIcon?.(item||ref),label=item?.interface?.displayName||ref.name,title=(ref.kind==='plugin'?'插件':'技能')+'：'+label;
    const html='<button type="button" class="message-reference message-reference-'+ref.kind+'" data-message-ref-kind="'+ref.kind+'" data-message-ref-path="'+esc(ref.path)+'" data-message-ref-name="'+esc(ref.name)+'" title="'+esc(title)+'" aria-label="'+esc(title)+'"><span class="message-reference-icon">'+ic(ref.kind==='plugin'?'plugin':'layers')+(src?'<img src="'+esc(src)+'" alt="" loading="lazy" style="opacity:0"/>':'')+'</span><span>'+esc(label)+'</span></button>';
    if(match)spans.push({...match,html});else extras.push(html);
  }
  spans.sort((a,b)=>a.start-b.start);let at=0,html='';for(const span of spans){html+=esc(text.slice(at,span.start))+span.html;at=span.end;}return html+esc(text.slice(at))+(extras.length?(text?' ':'')+extras.join(' '):'');
}
function renderUserMessage(item, turn) {
  const firstUser=(turn?.items||[]).find(entry=>['userMessage','steeringUserMessage'].includes(entry.type));
  const steering=item.type==='steeringUserMessage'||!!item.steeringStatus||item.type==='userMessage'&&firstUser&&firstUser.id!==item.id;
  const delivery=item.deliveryState||item.steeringStatus||(item.type==='steeringUserMessage'?item.status||'pending':'accepted');
  const content=(item.content||item.input||[]).map(input=>input?.type==='inputText'?{...input,type:'text'}:input?.type==='inputImage'?{...input,type:'image',url:input.imageUrl||input.url||input.image_url}:input);
  const parts = [];
  const images = [],originalImages=[];
  for (const input of content) {
    if (!input) continue;
    if (input.type === "text") parts.push(input.text || "");
    else if (input.type === "localImage"){
      images.push(mediaUrl(input.path));originalImages.push(input.path);
    }
    else if (input.type === "image" && input.url){images.push(input.url);originalImages.push(input.url);}

  }
  const parsed=typeof parseAttachedMessage==='function'?parseAttachedMessage(parts.join('\n')):{text:parts.join('\n'),files:[]};
  const text = (globalThis.nativeUserInputHost?.displayReply(parsed.text)??parsed.text).trim(),files=parsed.files.filter(f=>!images.includes(mediaUrl(f.path))),body=renderUserMessageReferences(text,content);
  if(!files.length&&globalThis.nativeSteeringHost&&state.productMode!=='chatgpt')return nativeSteeringHost.html({item,turn,conversationId:state.activeThreadId||state.thread?.id,delivery,text,sources:originalImages,files,temporary:!!(state.ephemeral||state.sideChatEphemeral)});
  return `<div class="msg-user${steering?' steering-user-message':''}"${steering?` data-steering-state="${esc(delivery)}"`:''} data-flow-key="${esc(`${turn?.id || ''}:user:${item.id}`)}">
    ${files.length?`<div class="user-file-attachments">${files.map(file=>`<button class="user-file-attachment" data-artifact-path="${esc(file.path)}" title="${esc(file.path)}">${ic('doc')}<span>${esc(file.name)}</span></button>`).join('')}</div>`:''}
    ${images.length?`<div class="user-attachments">${images.map((src,index)=>`<button class="user-attachment${transcriptMissingImages.has(src)?' image-unavailable':''}" data-flow-key="${esc(`${turn?.id}:user:${item.id}:attachment:${index}`)}" data-image-src="${esc(src)}" data-zoom="${esc(src)}" aria-label="查看上传的图片 ${index+1}"><img src="${esc(src)}" alt="上传的图片 ${index+1}" loading="lazy" decoding="async"/><span class="user-attachment-error">图片不可用</span></button>`).join('')}</div>`:''}
    ${body?`<div class="bubble"><div class="codex-user-text">${body}</div><span class="cloud-user-ellipsis" aria-hidden="true" hidden>…</span><button type="button" class="cloud-user-expand" aria-expanded="false" hidden>显示更多 ⌄</button></div>`:''}
    ${body||steering?`<div class="user-message-footer">${steering?`<span class="steering-user-status" role="status">${esc(delivery==='unknown'?'引导状态未确认':delivery==='accepted'?'已引导':'正在引导…')}</span>`:''}${body?`<div class="msg-actions"><button class="mini-btn" data-copy-text="${esc(text)}" title="${esc(t('copy'))}" aria-label="复制消息">${ic('chatCopy')}</button></div>`:''}</div>`:''}
  </div>`;
}

function nativeActivityLabels(view) {
  if(view.state.kind==='thinking')return [t('thinking')];
  if(view.state.kind==='active'){
    const item=view.activeItem;
    if(item?.type==='commandExecution'){
      const action=view.activeDisplay?.parsedCmd;
      if(action?.type==='read')return [LANG==='zh'?`正在读取 ${action.name||basename(action.path||'文件')}`:`Reading ${action.name||action.path||'file'}`];
      if(action?.type==='search')return [LANG==='zh'?'正在搜索文件':'Searching files'];
      if(action&&['listFiles','list_files'].includes(action.type))return [LANG==='zh'?'正在列出文件':'Listing files'];
      return [LANG==='zh'?'正在运行命令':'Running command'];
    }
    if(item?.type==='fileChange')return [LANG==='zh'?'正在编辑文件':'Editing files'];
    if(item?.type==='webSearch')return [LANG==='zh'?'正在搜索网页':'Searching the web'];
    if(item?.type==='dynamicToolCall')return [nativeTranscript.dynamicToolLabel(item,{completed:false,lang:LANG})];
    if(item?.type==='mcpToolCall'){if(nativeTranscript.isCommandSource('server:'+item.server))return [item.toolDisplay?.invoking||(LANG==='zh'?'正在运行命令':'Running command')];const name=item.appContext?.appName||item.source?.name||String(item.server||'').replace(/[_-]+/g,' ').replace(/^./,c=>c.toUpperCase());return [item.toolDisplay?.invoking||(LANG==='zh'?`正在使用 ${name} 集成`:`Using ${name} integration`)];}
    return [t('thinking')];
  }
  return view.parts.map(part=>{
    switch(part.kind){
      case 'mcp-sources':{const names=part.sources.map(source=>source.name).join(LANG==='zh'?'、':', ');return LANG==='zh'?`已使用 ${names} 集成`:`Used ${names} integration${part.sources.length>1?'s':''}`;}
      case 'unnamed-mcp-calls':return LANG==='zh'?'调用了工具':'Called tools';
      case 'dynamic-tool-call':return part.item?nativeTranscript.dynamicToolLabel(part.item,{completed:true,lang:LANG}):LANG==='zh'?'调用了工具':'Called tools';
      case 'loaded-tools':return LANG==='zh'?'加载了工具':'Loaded tools';
      case 'file-changes':return LANG==='zh'?'编辑了文件':'Edited files';
      case 'stopped-file-creation':return LANG==='zh'?'已停止创建文件':'Stopped creating files';
      case 'exploration':return LANG==='zh'?'查看了文件':'Explored files';
      case 'commands':return part.count===1?t('ranCommand'):t('ranCommands',{count:part.count});
      case 'web-search':return LANG==='zh'?'搜索了网页':'Searched the web';
      default:return '';
    }
  }).filter(Boolean);
}

function renderWorkActivity(items, turn, originalKey, collapseWhenPossible=false, isLatestVisibleUnit=true) {
  // Original list keys live within a turn; Eva's global disclosure store needs the same scope.
  const id = `work:${turn.id}:${originalKey || (items.find(item => item.type !== 'reasoning') || items[0]).id}`;
  const view=globalThis.nativeTranscript?.summarize?.(items,turn,collapseWhenPossible,isLatestVisibleUnit);
  if(view?.simplified&&items.length===1){const html=renderItem(items[0],turn);return html.replace(/^<([a-z][a-z0-9-]*)/i,`<$1 data-flow-key="${esc(originalKey||id)}"`);}
  const open = isExpanded(id) || items.some(item => isExpanded(item.id));
  const commands = items.filter((item) => item.type === "commandExecution");
  const files = new Set(items.flatMap((item) => (item.changes || []).map((change) => displayPath(change.path))));
  const tools = items.filter(item => ['mcpToolCall','dynamicToolCall','collabAgentToolCall'].includes(item.type));
  const browserWork = items.some(item => item.type === 'webSearch' || /^browser_|^web_/.test(item.tool || item.name || ''));
  const computerWork = tools.some(item => item.server === 'cua_repl');
  const running = view ? view.state.kind!=='summary' : items.some((item) => item.status === "inProgress")
    || (turn.status === 'inProgress' && items.some(item => item.type === 'reasoning' && item.id === turn.items?.at(-1)?.id));
  const failures = items.filter(itemFailed);
  const failed = failures.length > 0;
  const labels = [];
  if (files.size) labels.push(LANG === "zh" ? "编辑了文件" : "Edited files");
  if (commands.length) labels.push(commands.length === 1 ? t("ranCommand") : t("ranCommands", { count: commands.length }));
  if (browserWork) labels.push(LANG === 'zh' ? '浏览了网页' : 'Browsed pages');
  if (computerWork) labels.push(LANG === 'zh' ? '操作了电脑' : 'Used computer');
  if (tools.some(item => item.server !== 'cua_repl' && !/^browser_|^web_/.test(item.tool || item.name || ''))) labels.push(LANG === 'zh' ? '调用了工具' : 'Used tools');
  if (!labels.length) labels.push(running ? t('thinking') : t('thought'));
  if(view){labels.splice(0,labels.length,...nativeActivityLabels(view));if(!labels.length)labels.push(t('thought'));}
  const status = running&&!view ? t("running") : "";
  const detailId = `${id}:details`;
  const summaryIcon=view?.parts[0]?.kind==='commands'?'terminal':files.size?'pencil':commands.length?'terminal':browserWork?'globe':tools.length?'tool':'sparkle';
  const disclosure=globalThis.activityDisclosure?.state(id,open)|| (open?'expanded':'collapsed');
  const mounted=open||disclosure==='closing';
  if(view&&globalThis.nativeSteeringHost){const detailsHTML=items.map(item=>renderItem(item,turn)).join('');const model={kind:'activity',glyphName:view.state.kind==='thinking'?null:({terminal:'terminal-light-16',pencil:'pencil-light-16',globe:'globe-light-16',tool:'wrench-light-16',sparkle:'sparkles-light-16'})[summaryIcon],summaryParts:view.state.kind==='summary'?view.parts.map(part=>part.kind==='dynamic-tool-call'?{...part,label:nativeTranscript.dynamicToolLabel(part.item,{completed:true,lang:LANG})}:part):null,conversationId:state.thread?.id||state.activeThreadId||'draft',turn,item:{id:'activity:'+id},text:labels.join(LANG==='zh'?'，':', '),summaryKey:view.state.kind==='active'?'active:'+view.activeKey:view.state.kind,summaryTransition:view.state.kind==='summary'?'immediate':'throttled',expanded:open,canExpand:!!detailsHTML,detailsHTML};return '<div class="work-activity" data-activity-state="'+esc(view.state.kind)+'" data-flow-key="'+esc(originalKey||id)+'">'+nativeSteeringHost.html(model)+'</div>';}
  return `<div data-ui-id="${esc(id)}" data-flow-key="${esc(originalKey||id)}" data-disclosure-state="${esc(disclosure)}" data-activity-state="${esc(view?.state.kind|| (running?'active':'summary'))}" class="work-activity${open ? " open" : ""}${failed ? " failed" : ""}${running ? " running" : ""}${failures.some(item => item.type === 'mcpToolCall') ? ' tool-failed' : ''}">
    <div class="activity-row"><button class="activity" data-ui-action="toggle-activity" data-toggle="${esc(id)}" aria-expanded="${open}" aria-controls="${esc(detailId)}" title="${esc(LANG === 'zh' ? `查看 ${items.length} 项操作详情` : `View ${items.length} activities`)}">
      ${ic(summaryIcon)}<span class="act-label" data-summary-key="${esc(view?.state.kind==='active'?'active:'+view.activeKey:view?.state.kind||'summary')}" data-summary-text="${esc(labels.join(LANG === "zh" ? "，" : ", "))}">${esc(labels.join(LANG === "zh" ? "，" : ", "))}</span>
      ${status ? `<span class="work-status">${esc(status)}</span>` : ""}${ic("chevronRight", "chev")}
    </button></div>
    ${mounted ? `<div class="work-details" id="${esc(detailId)}">${items.map((item) => renderItem(item, turn)).join("")}</div>` : ""}
  </div>`;
}

function renderTurnChanges(turn) {
  if (!["completed", "interrupted", "failed"].includes(turn.status)) return "";
  const files = new Map();
  const netDiff = state.diffs?.has(turn.id) ? unifiedDiffFiles(state.diffs.get(turn.id)) : null;
  if (netDiff) {
    const paths = (turn.items || []).flatMap(item => item.type === "fileChange" ? (item.changes || []).map(change => change.path) : []);
    for (const file of netDiff.values()) {
      const originalPath = paths.find(path => displayPath(path).replace(/\\/g, "/") === file.path.replace(/\\/g, "/")) || file.path;
      files.set(displayPath(originalPath), { ...file, originalPath });
    }
  }
  for (const item of turn.items || []) {
    if (netDiff) break;
    if (item.type !== "fileChange" || item.status !== "completed") continue;
    for (const change of item.changes || []) {
      const path = displayPath(change.path);
      const current = files.get(path);
      const stats = fileChangeStats(change);
      // Without a net diff, overlapping patches cannot establish final totals.
      files.set(path, { ...stats, known: stats.known && !current, originalPath: change.path });
    }
  }
  if (!files.size) return "";
  const totals = [...files.values()].reduce((sum, file) => ({ add: sum.add + file.add, del: sum.del + file.del }), { add: 0, del: 0 });
  const statsKnown = [...files.values()].every(file => file.known);
  const title = files.size === 1 ? t("fileEdited", { name: basename([...files.keys()][0]) }) : LANG === "zh" ? `已编辑 ${files.size} 个文件` : `Edited ${files.size} files`;
  const entries = [...files.entries()];
  const key = `changes:${turn.id}`;
  const expanded = isExpanded(key);
  const visible = entries.length > 1 ? entries.slice(0, expanded ? undefined : 3) : [];
  return `<div class="turn-changes">
    <div class="turn-changes-head"><span class="turn-changes-icon">${ic("filePlus")}</span>
    <div class="turn-changes-copy"><strong title="${esc([...files.keys()].join("\n"))}">${esc(title)}</strong>${statsKnown ? `<div class="file-meta"><span class="stat-add">+${totals.add}</span><span class="stat-del">-${totals.del}</span></div>` : ""}</div>
    ${turn.status !== "inProgress" ? `<button class="pill" data-revert-turn="${esc(turn.id)}" title="${esc(t("revert"))}">${esc(t("undo"))}${ic("undo")}</button>` : ""}
    <button class="pill" data-turn-diff="${esc(turn.id)}">${esc(t("diff"))}</button></div>
    ${visible.length ? `<div class="turn-file-list">${visible.map(([path, stats]) => `<button class="turn-file-row" data-turn-file="${esc(turn.id)}" data-change-path="${esc(stats.originalPath)}"><span>${esc(path)}</span>${stats.known ? `<span class="file-meta"><span class="stat-add">+${stats.add}</span><span class="stat-del">-${stats.del}</span></span>` : ""}</button>`).join("")}${entries.length > 3 ? `<button class="changes-more" data-toggle="${esc(key)}" aria-expanded="${expanded}">${esc(expanded ? (LANG === "zh" ? "收起文件" : "Show fewer files") : (LANG === "zh" ? `再显示 ${entries.length - 3} 个文件` : `Show ${entries.length - 3} more files`))}${ic("chevron", expanded ? "flipped" : "")}</button>` : ""}</div>` : ""}
  </div>`;
}

function turnArtifacts(turn) {
  const artifacts = new Map();
  const add = (label, destination, mime = "") => {
    const link = transcriptLink(destination);
    if (!link) return;
    const path = link.path || link.href;
    const ext = /\.([a-z0-9]+)$/i.exec(path)?.[1]?.toLowerCase();
    const types = { pdf: "PDF", docx: "Word", xlsx: "Excel", pptx: "PowerPoint", csv: "CSV", tsv: "TSV", zip: "ZIP", png: "图像", jpg: "图像", jpeg: "图像", webp: "图像", svg: "图像", html: "网站", htm: "网站", mp4: "视频", mp3: "音频", wav: "音频" };
    const website = link.kind === "web" && /https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/|$)/i.test(path);
    if (!types[ext] && !/^(?:tex|doc|xls|xlsm|ppt|md|mdx|gif|avif)$/.test(ext||'') && !website) return;
    if (link.kind === "web" && !website) return;
    const type = website ? "网站" : types[ext]||ext.toUpperCase();
    const key = path.replace(/\\/g, "/");
    if (!artifacts.has(key)) artifacts.set(key, { ...link, label: label || basename(path), type, mime, ext });
  };
  // REA X_s -> dvs: completed assistant output links are a delivery source.
  // The default shipped Markdown output types are intentionally narrower than
  // declared tool outputs. Inline code and fenced examples are not deliveries.
  if (turn.status === 'completed') {
    const text = finalAnswerItems(turn).map(item=>item.text).join('\n');
    const cwd=turn.cwd||state.thread?.cwd||state.cwd;
    const referenced=new Set((turn.artifacts?.referencedFilePaths||[]).map(p=>p.replace(/\\/g,'/')));
    for(const link of globalThis.EvaDeliverySource?.scanLinks(text)||[]){
      if(link.syntax!=='link')continue;
      let target=link.destination;try{target=decodeURI(target);}catch{}
      if(!transcriptLink(target)&&!/^\w+:/i.test(target)&&cwd)target=cwd.replace(/[\\/]$/,'')+'/'+target;
      const local=transcriptLink(target);if(local?.kind!=='local')continue;
      const normalized=local.path.replace(/\\/g,'/'),relative=cwd&&normalized.startsWith(cwd.replace(/\\/g,'/')+'/')?normalized.slice(cwd.length+1):normalized;
      if(referenced.has(normalized)||/^(?:work|\.codex_scratch)(?:\/|$)/.test(relative))continue;
      if(!/\.(?:docx|pdf|tex|pptx|xlsx)$/i.test(local.path))continue;
      add(link.label,local.path);
    }
    for(const target of turn.artifacts?.outputFilePaths||[]){
      const cwdPath=transcriptLink(target)?target:cwd?cwd.replace(/[\\/]$/,'')+'/'+target:null;
      if(cwdPath&&!/^(?:work|\.codex_scratch)\//.test(target.replace(/\\/g,'/')))add(basename(target),cwdPath);
    }
  }
  for (const item of turn.items || []) {
    if (item.type === "imageGeneration" && item.status === "completed" && item.savedPath) add(basename(item.savedPath), item.savedPath, "image/png");
    for (const content of item.result?.content || []) {
      // Tool screenshots/resources belong to the tool disclosure, not the
      // generated-image delivery surface. Keep non-image declared artifacts.
      if (content?.type === "resource_link" && !/^image\//i.test(content.mimeType || '') && !/\.(png|jpe?g|gif|webp|bmp|svg)(?:[?#]|$)/i.test(content.uri || '')) add(content.title || content.name, content.uri, content.mimeType);
    }
  }
  return [...artifacts.values()];
}

function renderGeneratedImageGroup(images, key, running = false) {
  const open = isExpanded(key), detailId = key + ':details';
  const label = LANG === 'zh' ? (running ? '正在生成图像' : `已生成 ${images.length} 张图像`) : (running ? 'Generating image' : `Generated ${images.length} image${images.length === 1 ? '' : 's'}`);
  return `<div class="generated-image-activity${open ? ' open' : ''}" data-ui-id="${esc(key)}" data-flow-key="${esc(key)}"><div class="activity-row"><button class="activity" data-ui-action="toggle-activity" data-toggle="${esc(key)}" aria-expanded="${open}" aria-controls="${esc(detailId)}">${ic('imageStack')}<span class="act-label">${esc(label)}</span>${ic('chevronRight','chev')}</button></div>${open ? `<div class="generated-image-gallery" id="${esc(detailId)}">${images.join('')}</div>` : ''}</div>`;
}

function renderTurnArtifacts(turn) {
  const artifacts = turnArtifacts(turn);
  if (!artifacts.length) return "";
  const images = [], cards = [];
  for (const item of artifacts) {
    const target = item.kind === "local" ? `data-artifact-path="${esc(item.path)}"` : `data-artifact-url="${esc(item.href)}"`;
    if(item.type==='图像'&&item.kind==='local'){
      const src=mediaUrl(item.path);
      images.push(`<figure class="artifact-image${transcriptMissingImages.has(item.path)?' image-unavailable':''}" data-image-path="${esc(item.path)}" data-flow-key="${esc(`${turn.id}:image:${item.path}`)}"><button class="artifact-image-preview" data-zoom="${esc(src)}" aria-label="放大生成的图片" title="放大图片"><img src="${esc(src)}" alt="${esc(item.label)}" loading="lazy" decoding="async"/><span class="artifact-image-missing" role="status">图片不可用，文件可能已移动或删除</span></button><figcaption><span title="${esc(item.path)}">生成的图片</span><div class="artifact-image-actions"><button class="mini-btn" data-save-generated="${esc(item.path)}" title="保存图片副本" aria-label="保存图片副本">${ic('download')}</button><button class="mini-btn" data-reveal-generated="${esc(item.path)}" title="在文件夹中显示" aria-label="在文件夹中显示">${ic('folder')}</button><button class="mini-btn" ${target} title="打开图片" aria-label="打开图片">${ic('external')}</button></div></figcaption></figure>`);
      continue;
    }
    const icon = item.type === "网站" ? "globe" : item.type === "图像" ? "image" : "doc";
    cards.push(globalThis.nativeSteeringHost ? nativeSteeringHost.html({kind:'delivery',item:{id:`delivery:${item.path||item.href}`},turn,conversationId:state.thread?.id||state.activeThreadId,cwd:state.thread?.cwd||state.cwd,artifact:item,sources:[]}) : `<div class="artifact-card"><button class="artifact-main" ${target}>${esc(item.label)}</button></div>`);
  }
  return `<div class="turn-artifacts">${images.length ? renderGeneratedImageGroup(images,`generated-images:${turn.id}`) : ''}${cards.join('')}</div>`;
}

function renderOutputsPanel() {
  if (!els.outputsPanel) return;
  if(els.outputsPanel.dataset.threadId!==(state.thread?.id||'')) {
    state.summaryPopoverOpen=false;state.summaryHover=false;
    els.outputsPanel.dataset.threadId=state.thread?.id||'';
  }
  const mode=summaryDisplayMode();
  const visible=!!state.thread&&(mode==='overlay'?!!state.summaryPopoverOpen:state.outputsOpen||state.summaryHover);
  els.outputsPanel.dataset.displayMode=mode;
  els.outputsPanel.setAttribute('role',mode==='overlay'?'dialog':'complementary');
  els.outputsPanel.setAttribute('aria-label','会话摘要');
  const column=document.querySelector('.conversation-column');
  if(column)column.style.translate=visible&&mode==='shift'&&state.outputsOpen?'-154px 0':'';
  els.outputsPanel.classList.toggle("hidden", !visible);
  els.outputsPanel.classList.toggle('unpinned',mode==='overlay'||!state.outputsOpen);
  document.getElementById('head-summary')?.setAttribute('aria-pressed', String(mode==='overlay'?!!state.summaryPopoverOpen:state.outputsOpen));
  document.getElementById('head-summary')?.setAttribute('aria-expanded',String(visible));
  if (!visible) return;
  const outputs = new Map();
  const sources = new Map();
  for (const turn of state.thread?.turns || []) {
    for (const artifact of turnArtifacts(turn)) outputs.set(artifact.path || artifact.href, artifact);
    for (const item of finalAnswerItems(turn)) {
      for (const match of item.text.matchAll(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g)) {
        const link = transcriptLink(match[2]);
        if (link?.kind === "web" && !outputs.has(link.href)) sources.set(link.href, match[1]);
      }
    }
  }
  const searched=globalThis.nativeTranscript?.collectWebSources(state.thread?.turns||[]);
  for(const link of searched?.viewedLinks||[])if(!outputs.has(link.url))sources.set(link.url,link.label);
  for (const turn of state.thread?.turns || []) for (const item of turn.items || []) if (item.type === 'userMessage') for (const input of (item.content || item.input || [])) {
    if (input.type === 'localImage' && input.path) sources.set(input.path, { label: basename(input.path), path: input.path });
    else if (input.type === 'image' && input.url && /^https?:/.test(input.url)) sources.set(input.url, { label: '图像', href: input.url });
  }
  els.outputsPanel.innerHTML = `<div class="outputs-heading"><span>${LANG === "zh" ? "输出内容" : "Outputs"}</span><button class="icon-btn" data-new-output title="新建文件或站点">${ic('plus')}</button></div><div class="outputs-items">${[...outputs.values()].map(item => `<button class="output-row" ${item.path ? `data-artifact-path="${esc(item.path)}"` : `data-artifact-url="${esc(item.href)}"`} title="${esc(item.path || item.href)}">${ic(item.type === "网站" ? "globe" : "doc")}<span>${esc(item.label)}</span></button>`).join("") || `<p class="outputs-empty">${LANG === "zh" ? "创建文件或站点" : "Create files or sites"}</p>`}</div><div class="outputs-heading"><span>来源</span><button class="icon-btn" data-add-source title="添加图像来源">${ic('plus')}</button></div><div class="outputs-items">${[...sources].map(([href, value]) => { const item = typeof value === 'string' ? {label:value,href} : value; return `<button class="output-row" ${item.path ? `data-artifact-path="${esc(item.path)}"` : `data-artifact-url="${esc(item.href)}"`} title="${esc(item.path || item.href)}">${item.path ? `<img class="source-thumb" src="${esc(mediaUrl(item.path))}" alt=""/>` : ic('globe')}<span>${esc(item.label)}</span></button>`; }).join('') || '<p class="outputs-empty">暂无来源</p>'}</div>`;
}

function isExpanded(id) {
  return state.expanded.has(id);
}

function renderCodexMarkdown(text){return globalThis.cloudMarkdown?.renderNative(text)??renderMarkdown(text);}

function renderNativeActivity(item,turn,text,detailsHTML,glyphName){
  turn=turn||(state.thread?.turns||[]).find(entry=>(entry.items||[]).some(value=>value.id===item.id));
  return nativeSteeringHost.html({kind:'activity',conversationId:state.thread?.id||state.activeThreadId||'draft',turn,item,text,glyphName,summaryKey:item.status||'summary',summaryTransition:'immediate',canExpand:!!detailsHTML,expanded:isExpanded(item.id),detailsHTML:detailsHTML||''});
}

function renderItem(item, turn) {
  switch (item.type) {
    case "agentMessage": {
      const structuredQuestions=globalThis.nativeUserInputHost?.html(item);
      if(structuredQuestions)return structuredQuestions;
      const text = item.text || "";
      const last = (turn.items || [])[turn.items.length - 1];
      const streaming = turn.status === "inProgress" && item === last;
      if(text.trim()&&globalThis.nativeSteeringHost)return '<div class="assistant-body'+(item.phase==='commentary'?' commentary':'')+(streaming?' streaming':'')+'">'+nativeSteeringHost.html({kind:'assistant',text,item,turn,conversationId:state.thread?.id||state.activeThreadId||'draft',cwd:state.thread?.cwd||state.cwd,sources:[]})+'</div>';
      return text.trim() ? `<div class="assistant-body${item.phase === "commentary" ? " commentary" : ""}${streaming ? " streaming" : ""}">${renderCodexMarkdown(text)}</div>` : "";
    }
    case "reasoning":
      return renderReasoning(item, turn);
    case "commandExecution":
      return renderCommand(item,turn);
    case "fileChange":
      return renderFileChange(item, turn);
    case "mcpToolCall":
      return renderToolActivity(item,turn);
    case "dynamicToolCall":
      return renderToolActivity(item,turn);
    case "automaticApprovalReview": {
      if(item.status==='approved')return '';
      const label={inProgress:'正在审核操作',denied:'审核未通过',timedOut:'操作审核超时',aborted:'操作审核已中止'}[item.status]||'操作审核';
      return renderActivity(item,'info',label,item.rationale||item.reason||null);
    }
    case "collabAgentToolCall":
    case "subAgentActivity":
      return typeof renderAgentActivity==='function'?renderAgentActivity(item,turn):renderActivity(item,"tool","子智能体活动",item);
    case "webSearch":
      return renderActivity(
        item,
        "globe",
        item.query ? t("searchedWebQ", { q: item.query }) : t("searchedWeb"),
        item.query,
      );
    case "plan":
      return renderPlan({ explanation: item.text || "", plan: item.steps || item.plan || [] });
    case "imageView":
      return renderImageView(item, turn);
    case "image": {
      const src = item.path ? mediaUrl(item.path) : item.url;
      return src
        ? `<div class="image-grid"><img src="${esc(src)}" alt="" data-zoom="${esc(src)}" /></div>`
        : "";
    }
    case "imageGeneration": {
      if (item.failure) return renderActivity({ ...item, error: item.failure }, "image", LANG === "zh" ? "图像生成失败" : "Image generation failed", item.failure);
      if (item.savedPath && item.status === "completed") return ""; // Delivered once through the collapsed artifact group.
      const source = item.savedPath ? mediaUrl(item.savedPath) : /^https?:\/\//i.test(item.result || "") ? item.result : /^[a-z0-9+/=\r\n]+$/i.test(item.result || "") ? `data:image/png;base64,${item.result}` : null;
      return source ? renderGeneratedImageGroup([`<div class="image-grid"><img src="${esc(source)}" alt="${esc(item.revisedPrompt || "")}" data-zoom="${esc(source)}" /></div>`], `generated-image:${turn.id}:${item.id}`, item.status === "inProgress") : renderActivity(item, "image", LANG === "zh" ? "生成图像" : "Generate image", null);
    }
    case "contextCompaction":
      return renderContextCompaction(item, turn);
    case "hookPrompt":
      return renderActivity(item, "info", item.text || "hook", null);
    default:
      if (item.text && typeof item.text === "string") {
        return `<div class="assistant-body">${renderCodexMarkdown(item.text)}</div>`;
      }
      return renderActivity(item, "info", item.type || "item", item);
  }
}

function renderContextCompaction(item,turn){
  const view=globalThis.contextCompaction.presentation(item,turn,Date.now(),LANG);
  const label=esc(view.label),running=view.status==='inProgress';
  const summary=running?'<span class="eva-thinking-text">'+label+'<span class="eva-thinking-sweep" aria-hidden="true"><span class="eva-thinking-highlight">'+label+'</span></span></span>':label;
  return '<div class="context-compaction-row" data-compaction-state="'+view.status+'" data-compaction-source="'+view.source+'" role="status">'+ic('contextCompact')+'<span class="compaction-summary">'+summary+'</span></div>';
}

function reasoningContent(item) {
  const summary = Array.isArray(item.summary) ? item.summary.join("\n") : item.summary;
  const text = item.text || (Array.isArray(item.content) ? item.content.join("\n") : item.content) || "";
  return [...new Set([summary, text].filter(Boolean))].join("\n\n").trim();
}

function renderReasoning(item, turn) {
  const content = reasoningContent(item);
  if (!content) return "";
  const open = isExpanded(item.id);
  const thinking = turn?.status === "inProgress" && turn.items?.findLast(entry=>activityDisposition(entry)!=='hidden')?.id === item.id;
  const label = thinking ? t("thinking") : t("thought");
  if(globalThis.nativeSteeringHost)return renderNativeActivity(item,turn,label,'<div class="reasoning-panel assistant-body">'+nativeSteeringHost.html({kind:'assistant',conversationId:state.thread?.id||state.activeThreadId||'draft',turn,item:{...item,id:item.id+':reasoning-body'},text:content,cwd:state.thread?.cwd||state.cwd,sources:[]})+'</div>',null);
  const preview = content.split("\n").find(line => line.trim())?.replace(/[*#`]/g, "");
  return `<div class="activity-row reasoning-row">
    <button class="activity${open ? " open" : ""}" data-toggle="${esc(item.id)}" aria-expanded="${open}">${ic("sparkle")}<span class="act-label">${esc(label)}</span><span class="reasoning-preview">${esc(preview || "")}</span>${ic("chevronRight", "chev")}</button>
  </div>
  ${open ? `<div class="reasoning-panel assistant-body" data-flow-key="${esc(`${turn?.id || ''}:${item.id}:reasoning-body`)}">${renderCodexMarkdown(content)}</div>` : ""}`;
}

function renderCommand(item,turn) {
  const status = item.status || "";
  const failed = status === "failed" || status === "declined" || (item.exitCode != null && item.exitCode !== 0);
  const label =
    status === "inProgress"
      ? t("runningCommand")
      : status === "failed"
        ? t("commandFailed")
        : status === "declined"
          ? t("commandDeclined")
          : t("ranCommand");
  const open = isExpanded(item.id);
  const output = item.aggregatedOutput || item.output || "";
  const command = Array.isArray(item.command) ? item.command.join(" ") : item.command || "";
  const commandLabel = globalThis.nativeTranscript ? nativeTranscript.commandLabel(item) : command;
  const statusLabel =
    status === "inProgress"
      ? t("runningCommand")
      : failed
        ? ""
        : status
          ? "DONE"
          : "";
  if(globalThis.nativeSteeringHost)return renderNativeActivity(item,turn,commandLabel||label,`<div class="act-panel"><div class="act-cmd"><span class="dollar">$</span><span>${esc(command)}</span></div><pre class="act-out${output?'':' empty'}" data-output="${esc(item.id)}">${esc(output||t('noOutput'))}</pre>${item.exitCode!=null?'<div class="tool-progress">'+esc(item.exitCode===0?'Success':'Exit code '+item.exitCode)+'</div>':''}</div>`,'terminal-light-16');
  return `<div class="activity-row">
    <button class="activity cmd-activity${open ? " open" : ""}${failed ? " failed" : ""}" data-toggle="${esc(item.id)}" aria-expanded="${open}" title="${esc(command)}">
      <span class="cmd-line"><span class="dollar">$</span><span class="cmd-text">${esc(commandLabel||label)}</span></span>
      ${statusLabel ? `<span class="cmd-status${failed ? " failed" : ""}">${esc(statusLabel)}</span>` : ""}
    </button>
  </div>
  ${
    open
      ? `<div class="act-panel"><div class="act-cmd"><span class="dollar">$</span><span>${esc(command)}</span></div><pre class="act-out${output ? "" : " empty"}" data-output="${esc(item.id)}">${esc(output || t("noOutput"))}</pre></div>`
      : ""
  }`;
}

function displayPath(filePath) {
  const cwd = state.thread?.cwd || "";
  const value = String(filePath || "");
  if (cwd && value.toLowerCase().startsWith(cwd.toLowerCase())) {
    return value.slice(cwd.length).replace(/^[\\/]+/, "") || value;
  }
  return value;
}

function coalesceFileChanges(items) {
  const merged = [];
  const byPath = new Map();
  for (const item of items || []) {
    if (item?.type !== "fileChange") {
      merged.push(item);
      continue;
    }
    const fresh = [];
    for (const change of item.changes || []) {
      const index = byPath.get(change.path);
      if (index === undefined) {
        fresh.push(change);
        continue;
      }
      const target = merged[index];
      const existing = target.changes.find((entry) => entry.path === change.path);
      const wasDelete =
        (existing.kind && typeof existing.kind === "object" ? existing.kind.type : existing.kind) ===
        "delete";
      Object.assign(existing, change);
      if (wasDelete) existing.kind = { type: "update" };
    }
    if (fresh.length) {
      merged.push({ ...item, changes: fresh });
      for (const change of fresh) byPath.set(change.path, merged.length - 1);
    }
  }
  return merged;
}

function changeKindLabel(kind) {
  const value = typeof kind === "string" ? kind : kind?.type || kind?.kind || "update";
  if (value === "add" || value === "create" || value === "created") return "fileCreated";
  if (value === "delete" || value === "remove" || value === "deleted") return "fileDeleted";
  return "fileEdited";
}

function renderFileChange(item, turn) {
  const changes = item.changes || [];
  if (!changes.length) return "";
  const open = isExpanded(item.id);
  const rows = changes.map((change) => {
    const stats = fileChangeStats(change);
    const key = changeKindLabel(change.kind);
    return `<div class="file-main">
      <div class="file-ico">${ic("doc")}</div>
      <div class="file-info">
        <div class="file-title"><span class="path" title="${esc(change.path)}">${esc(
          t(key, { name: displayPath(change.path) }),
        )}</span></div>
        <div class="file-meta">${stats.add ? `<span class="stat-add">+${stats.add}</span>` : ""}${
          stats.del ? `<span class="stat-del">-${stats.del}</span>` : ""
        }</div>
      </div>
      <div class="file-actions">
        ${turn.status !== "inProgress" ? `<button class="btn subtle" data-revert-turn="${esc(turn.id)}">${ic("undo")}${esc(t("undo"))}</button>` : ""}
        <button class="btn" data-diff-item="${esc(item.id)}">${esc(t("diff"))}</button>
      </div>
    </div>
    ${open ? renderDiff(change.diff) : ""}`;
  });
  return `<div class="file-card">${rows.join("")}</div>`;
}

function renderActivity(item, icon, label, detail) {
  const open = isExpanded(item.id);
  const failed = item.status === "failed" || item.status === "declined" || item.success === false || Boolean(item.error) || item.result?.isError === true;
  const status = item.status === "inProgress" ? t("running") : "";
  const text = detail && typeof detail === "object" ? safeJson(detail) : detail;
  if(globalThis.nativeSteeringHost){const glyphName=({tool:'wrench-light-16',terminal:'terminal-light-16',globe:'globe-light-16',sparkle:'sparkles-light-16',pencil:'pencil-light-16'})[icon];return renderNativeActivity(item,null,label,text?'<div class="act-panel"><pre class="act-out" data-output="'+esc(item.id)+'">'+esc(String(text))+'</pre></div>':'',glyphName);}
  return `<div class="activity-row">
    <button class="activity${open ? " open" : ""}${failed ? " tool-failed" : ""}" data-toggle="${esc(item.id)}" aria-expanded="${open}">${ic(icon)}<span class="act-label">${esc(label)}</span>${status ? `<span class="work-status">${esc(status)}</span>` : ""}${ic("chevronRight", "chev")}</button>
  </div>
  ${open && text ? `<div class="act-panel" data-flow-key="${esc(`tool:${item.id}:body`)}"><pre class="act-out" data-output="${esc(item.id)}">${esc(String(text))}</pre></div>` : ""}`;
}

function imageViewSources(item) {
  return (Array.isArray(item.imagePaths) ? item.imagePaths : Array.isArray(item.paths) ? item.paths : [item.path || item.url]).filter(value => typeof value === 'string' && value);
}
function renderImageView(item, turn) {
  const sources=imageViewSources(item);
  return globalThis.nativeImagePreviewHost.html({...item,imagePaths:sources,imageCount:item.imageCount??sources.length},turn,state.activeThreadId||state.thread?.id);
}
function renderToolOutput(value, item) {
  const blocks = Array.isArray(value?.content) ? value.content : Array.isArray(value) ? value : null;
  if (!blocks) return '<pre class="act-out" data-output="'+esc(item.id)+'">'+esc(typeof value==='string'?value:safeJson(value))+'</pre>';
  return blocks.map((block,index)=>{
    if (block?.type === 'image') {
      const mime = block.mimeType || 'image/png', data = block.data || '';
      if (!/^image\/(png|jpe?g|gif|webp|bmp|svg\+xml|avif)$/i.test(mime) || !/^[a-z0-9+/=\s]+$/i.test(data)) return '<p class="tool-image-error">图像数据不可用</p>';
      return '<div class="tool-result-image" data-flow-key="'+esc(`tool:${item.id}:image:${index}`)+'"><img src="'+esc(`data:${mime};base64,${data.replace(/\s/g,'')}`)+'" alt="'+esc(LANG==='zh'?'工具输出图像':'Tool output image')+'" loading="lazy" decoding="async" referrerpolicy="no-referrer"></div>';
    }
    const text = block?.type === 'text' ? block.text : safeJson(block);
    return '<pre class="act-out" data-output="'+esc(index===0?item.id:`${item.id}:block:${index}`)+'">'+esc(text || '')+'</pre>';
  }).join('');
}
function renderToolActivity(item,turn) {
  const name = [item.server || item.namespace, item.tool || item.name].filter(Boolean).join(' · ') || '工具';
  const commandSource=item.type==='mcpToolCall'&&globalThis.nativeTranscript?.isCommandSource?.('server:'+item.server);
  const commandLabel=LANG==='zh'?(item.status==='inProgress'?'正在运行命令':item.status==='failed'?'命令运行失败':item.status==='interrupted'?'命令已停止':t('ranCommand')):(item.status==='inProgress'?'Running command':item.status==='failed'?'Command failed':item.status==='interrupted'?'Command stopped':t('ranCommand'));
  const label=item.type==='dynamicToolCall'&&globalThis.nativeTranscript?.dynamicToolLabel?nativeTranscript.dynamicToolLabel(item,{lang:LANG}):commandSource?commandLabel:t('calledTool',{tool:name});
  if(globalThis.nativeSteeringHost){const sections=[['Input',item.arguments],['Output',item.result??item.contentItems],['Error',item.error]];const details='<div class="act-panel">'+sections.filter(([,value])=>value!=null).map(([title,value])=>'<section class="tool-detail-section"><h4>'+esc(title==='Input'?(LANG==='zh'?'\u8f93\u5165':title):title==='Output'?(LANG==='zh'?'\u8f93\u51fa':title):(LANG==='zh'?'\u9519\u8bef':title))+'</h4>'+(title==='Output'?renderToolOutput(value,item):'<pre class="act-out" data-output="'+esc(item.id+':'+title)+'">'+esc(typeof value==='string'?value:safeJson(value))+'</pre>')+'</section>').join('')+(item.durationMs!=null?'<p class="tool-progress">'+esc((item.durationMs/1000).toFixed(1))+' s</p>':'')+'</div>';return renderNativeActivity(item,turn,label,details,commandSource?'terminal-light-16':'wrench-light-16');}
  let html = renderActivity(item,'tool',label,null);
  if (item.progressMessage && item.status === 'inProgress') html += '<div class="tool-progress">'+esc(item.progressMessage)+'</div>';
  if (!isExpanded(item.id)) return html;
  const sections = [['输入',item.arguments],['输出',item.result ?? item.contentItems],['错误',item.error]];
  return html + '<div class="act-panel" data-flow-key="'+esc('tool:'+item.id+':body')+'">'+sections.filter(([,value])=>value!=null).map(([label,value])=>'<section class="tool-detail-section"><h4>'+label+'</h4>'+(label==='输出'?renderToolOutput(value,item):'<pre class="act-out" data-output="'+esc(item.id+':'+label)+'">'+esc(typeof value==='string'?value:safeJson(value))+'</pre>')+'</section>').join('')+(item.durationMs!=null?'<p class="tool-progress">用时 '+esc((item.durationMs/1000).toFixed(1))+' 秒</p>':'')+'</div>';
}

function renderPlan(plan) {
  const rows = plan?.plan || plan?.steps || [];
  const explanation = plan?.explanation || "";
  if (!rows.length && !explanation) return "";
  const list = rows
    .map((step) => {
      const text = typeof step === "string" ? step : step.step || step.text || "";
      const done = step.status === "completed" || step.status === "done";
      return `<div class="plan-item${done ? " done" : ""}"><span class="box">${
        done ? ic("check") : ""
      }</span><span class="txt">${esc(text)}</span></div>`;
    })
    .join("");
  return `<div class="plan-card"><div class="plan-title">${esc(
    explanation || t("planTitle"),
  )}</div>${list}</div>`;
}

function renderDiff(diff) {
  const lines = String(diff || "").split("\n");
  return `<div class="diff-block">${lines
    .map((line) => {
      let cls = "";
      if (
        line.startsWith("+++") ||
        line.startsWith("---") ||
        line.startsWith("diff ") ||
        line.startsWith("index ")
      )
        cls = "meta";
      else if (line.startsWith("@@")) cls = "hunk";
      else if (line.startsWith("+")) cls = "add";
      else if (line.startsWith("-")) cls = "del";
      return `<div class="diff-line ${cls}">${esc(line) || " "}</div>`;
    })
    .join("")}</div>`;
}
