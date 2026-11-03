/* Codex clone — composer, rate limit banner, mention + slash menus */

function codexModelDisplayName(value){return String(value||'').replace(/^(GPT-\d+(?:\.\d+)?)-(Sol|Luna|Astra|Terra)$/i,(_all,version,family)=>version.toUpperCase()+' '+family[0].toUpperCase()+family.slice(1).toLowerCase());}
function codexFastTier(model=state.models.find(m=>(m.model||m.id)===state.model)){return state.provider?null:(model?.serviceTiers||[]).find(t=>t.id==='priority'||/^fast$/i.test(t.name||''))||null;}
function codexSelectedServiceTier(){const tier=codexFastTier();return tier&&store.get('codex.serviceTiers',{})[state.model]===tier.id?tier.id:null;}

function renderComposer() {
  if(globalThis.cloudComposerIcons&&!els.composer.dataset.originalIcons){
    els.send.innerHTML=cloudComposerIcons.send;els.stop.innerHTML=cloudComposerIcons.stop;els.attach.innerHTML=cloudComposerIcons.plus;
    document.getElementById('mic').innerHTML=cloudComposerIcons.microphone;els.modelButton.querySelector('svg').outerHTML=cloudComposerIcons.down;els.composer.dataset.originalIcons='true';
  }
  const errorBox=document.getElementById('conversation-error-status'),failure=state.conversationError;
  const duplicateFailure=!!failure&&!failure.action&&(!failure.threadId||failure.threadId===state.activeThreadId)&&(state.thread?.turns||[]).some(turn=>(!failure.turnId||turn.id===failure.turnId)&&turn.error&&quotaFailureText(turn.error.message)&&(quotaFailureText(failure.raw||failure.message)||failure.message==='请求未完成，输入内容已保留。请在运行记录中查看详细原因。'));
  errorBox.classList.toggle('hidden',!failure||duplicateFailure);errorBox.querySelector('span').textContent=failure?.message||'';
  const restore=errorBox.querySelector('[data-conversation-restore]');restore.classList.toggle('hidden',!['unarchive','retry-open'].includes(failure?.action?.kind));restore.textContent=failure?.action?.kind==='retry-open'?'重试加载':'恢复对话';restore.disabled=state.pendingSend;
  restore.onclick=async()=>{restore.disabled=true;try{if(failure.action.kind==='unarchive')await api.call('thread/unarchive',{threadId:failure.action.threadId});state.conversationError=null;await openThread(failure.action.threadId);}catch(error){showConversationError(error,failure.action);}finally{restore.disabled=false;}};
  errorBox.querySelector('[data-conversation-dismiss]').onclick=()=>{state.conversationError=null;renderComposer();};
  document.getElementById('connection-status')?.classList.toggle('hidden', !state.connectionError);
  document.getElementById('send-recovery-status')?.classList.toggle('hidden', !globalThis.sendReceipts?.blocked());
  const context = document.getElementById('new-chat-context');
  context.classList.toggle('hidden', !!state.thread || state.loadingThread);
  const projectButton = document.getElementById('new-chat-project');
  projectButton.disabled = state.pendingSend || state.booting || state.loadingThread;
  els.input.readOnly = state.pendingSend || state.loadingThread;
  els.modeButton.disabled = state.pendingSend || state.running;
  els.modelButton.disabled = state.pendingSend;
  projectButton.innerHTML = `${ic(state.cwd===null?'chat':'folder')}<span>${esc(newChatProjectName())}</span>`;
  projectButton.title = state.cwd || '不在项目中工作';
  const removeProject=document.getElementById('new-chat-no-project');
  removeProject.hidden=state.cwd===null;removeProject.disabled=projectButton.disabled;
  const mode = MODES[state.mode] || MODES.auto;
  els.modeIcon.innerHTML = ic(mode.icon, mode.tone ? "mode-lock" : "");
  els.modeLabel.textContent = LANG==='zh'&&state.mode==='full'?'完全访问':t(mode.label);
  els.modeButton.classList.add('permission-chip');
  els.modeButton.classList.toggle('full-access',state.mode==='full');
  els.modeButton.title=state.mode==='full'?t('fullDesc'):state.mode==='assisted'?t('assistedDesc'):state.mode==='read'?t('readDesc'):t('autoDesc');

  const model = state.models.find((entry) => (entry.model || entry.id) === state.model);
  const effort = t(EFFORT_LABELS[state.effort] || "effortHigh");
  const provider = state.providers.find(p => p.id === state.provider);
  const preparing=typeof composerAttachmentsPending==='function'&&composerAttachmentsPending();
  els.attach.disabled = state.pendingSend||!!preparing;
  els.attach.title = "添加文件和更多内容";
  const pickerOpen=!!document.querySelector('#menu-root .model-control');
  els.modelButton.classList.toggle('reasoning-picker-open',pickerOpen);
  els.modelButton.setAttribute('aria-expanded',String(pickerOpen));
  const modelBlocked=!state.provider&&globalThis.modelAccess&&!modelAccess.ready();
  els.modelButton.title=modelBlocked?modelAccess.label():'选择模型和推理强度';
  els.modelButton.setAttribute('aria-label',modelBlocked?modelAccess.label():'选择模型和推理强度');
  els.modelLabel.innerHTML=modelBlocked?'<span class="model-name">'+esc(modelAccess.label())+'</span>':pickerOpen?'<span class="model-placeholder">选择推理强度</span>':`${codexSelectedServiceTier()?'<span class="model-fast-indicator">'+cloudComposerIcons.fast+'</span>':''}<span class="model-name">${esc(provider?.displayName || codexModelDisplayName(model?.displayName || model?.model || state.model) || "选择模型")}</span><span class="model-effort">${esc(effort)}</span>`;

  els.input.placeholder = state.running ? t("steer") : !state.thread ? (LANG === 'zh' ? '随心输入' : 'Ask anything') : t("placeholder");
  els.stop.classList.toggle("hidden", !state.running);
  els.send.classList.toggle("hidden", state.running&&!els.input.value.trim()&&!state.attachments.length);
  els.send.title=state.running?(globalThis.followUps?.mode()==='queue'?'排队发送 · ⌘⇧Enter 立即引导':'引导当前任务 · ⌘⇧Enter 排队发送'):'发送';
  els.send.disabled = (!els.input.value.trim()&&!state.attachments.length) || state.pendingSend || state.loadingThread || state.threadOpenFailed || !!preparing || !!state.connectionError || !!globalThis.sendReceipts?.blocked();

  els.attachments.innerHTML=state.attachments.map((file,index)=>'<div class="attachment '+(composerAttachmentIsImage(file)?'':'attachment-file')+'" title="'+esc(file.path||file.name)+'">'+(composerAttachmentIsImage(file)?'<img src="'+esc(file.url||mediaUrl(file.path))+'" alt="'+esc(file.name)+'"/>':ic(file.kind==='directory'?'folder':'doc'))+'<span class="att-name">'+esc(file.name)+'</span><button class="att-x" data-remove-attachment="'+index+'" aria-label="移除附件 '+esc(file.name)+'">'+ic('x')+'</button></div>').join('')+validComposerMentions(els.input.value).map(ref=>'<button class="composer-reference" type="button" data-remove-reference="'+esc(ref.path)+'" data-reference-start="'+ref.start+'" title="'+esc(ref.path)+'">'+(globalThis.builtinPluginIcon?.(ref)?'<img src="'+esc(builtinPluginIcon(ref))+'" width="16" height="16" alt=""/>':ic(ref.kind==='plugin'?'plugin':ref.kind==='skill'?'layers':'doc'))+'<span>'+esc(ref.name)+'</span>'+ic('x')+'</button>').join('');
  els.attachments.classList.toggle('hidden',!state.attachments.length&&!validComposerMentions(els.input.value).length);
  if(preparing){els.attachments.classList.remove('hidden');els.attachments.insertAdjacentHTML('beforeend','<span class="pop-empty" role="status">正在添加附件…</span>');}
  state.composerRefsKey=JSON.stringify(validComposerMentions(els.input.value).map(m=>m.path));
  if(typeof renderComposerInlineReferences==='function')renderComposerInlineReferences();

  globalThis.followUps?.render();
  renderGoalBar();
  renderRateBanner();

  els.turnStatus.textContent = state.running ? t("running") : "";
  const total = state.tokenUsage?.totalTokens;
  els.tokenUsage.textContent = total ? `${Number(total).toLocaleString()} tokens` : "";
  if(typeof renderSubagentComposerContext==='function')renderSubagentComposerContext();
}

function newChatProjectName() {
  if(state.cwd===null)return '不在项目中工作';
  const key = projectKey(state.cwd);
  return state.localProjects[key]?.name || basename(state.cwd) || (LANG === 'zh' ? '项目' : 'project');
}

function selectNewChatProject(path) {
  if (state.thread || state.running || state.pendingSend || state.booting) return;
  if(typeof closeMention==='function')closeMention();
  globalThis.composerDrafts?.save();
  try {
    localStorage.setItem(scopedStoreKey('codex-rae.draftCwd'), JSON.stringify(path));
    state.cwd = path;
    globalThis.composerDrafts?.save();
    renderSidebar(); renderHead(); renderTranscript(); renderComposer();
    if (state.filePanelOpen) refreshFileTree();
    els.input.focus();
  } catch (error) { toast(error.message); }
}

document.getElementById('new-chat-no-project').addEventListener('click',()=>selectNewChatProject(null));
document.getElementById('new-chat-project').addEventListener('click', event => {
  if (state.thread) return;
  const button = event.currentTarget, key = projectKey(state.cwd);
  const projects = collectProjects();
  const items = projects.map(group => ({ label: group.name, title: group.path, icon: group.key === key ? undefined : 'folder', checked: group.key === key, action: () => selectNewChatProject(group.path) }));
  items.unshift({label:'不在项目中工作',icon:'chat',checked:state.cwd===null,action:()=>selectNewChatProject(null)},{separator:true});
  if (state.cwd && !projects.some(g => g.key === key)) items.unshift({ label: newChatProjectName(), checked: true, action: () => selectNewChatProject(state.cwd) });
  items.push({ separator: true }, { label: LANG === 'zh' ? '打开项目文件夹…' : 'Open project folder…', icon: 'plus', action: async () => {
    try {
      const path = await api.pickFolder();
      if (!path || state.thread || state.running || state.pendingSend) return;
      addProjectToSidebar(path); selectNewChatProject(path);
    } catch (error) { toast(error.message); }
  } });
  openMenu(items, { rect: button.getBoundingClientRect(), anchor: button });
});

function renderGoalBar() {
  const goal = state.goal;
  if (!goal || !goal.objective) {
    els.goalBar.classList.add("hidden");
    return;
  }
  els.goalBar.classList.remove("hidden");
  const progress = goal.tokenBudget
    ? `${Number(goal.tokensUsed || 0).toLocaleString()} / ${Number(goal.tokenBudget).toLocaleString()}`
    : t("goalProgress", { used: Number(goal.tokensUsed || 0).toLocaleString() });
  els.goalBar.innerHTML = `<span class="goal-ico">${ic("target")}</span>
    <span class="goal-text" title="${esc(goal.objective)}">${esc(goal.objective)}</span>
    <span class="goal-progress">${esc(progress)}</span>
    <button class="mini-btn" data-action="clear-goal" title="${esc(t("goalClear"))}">${ic("x")}</button>`;
}

function renderRateBanner() {
  const limits = state.rates?.rateLimits;
  const primary = limits?.primary;
  const blocked =
    state.rates?.ordinaryUsageAllowed === false || (state.rates?.ordinaryUsageAllowed == null && primary && primary.usedPercent >= 100);
  if (state.provider || !blocked || state.rateBannerDismissed) {
    els.rateBanner.classList.add("hidden");
    return;
  }
  const upsell = state.rates?.rateLimitUpsell;
  const resetsAt = upsell?.reset_at || primary?.resetsAt;
  const count = state.rates?.rateLimitResetCredits?.availableCount || 0;
  els.rateBanner.classList.remove("hidden");
  els.rateBanner.innerHTML = `<div class="rate-copy">
      <h3>${esc(upsell?.title && LANG === "en" ? upsell.title : t("rateTitle"))}</h3>
      <p>${esc(t("rateRetry", { time: resetsAt ? fmtTime(resetsAt) : "—" }))}</p>
    </div>
    <div class="rate-actions">
      ${count ? `<button class="pill" data-action="reset-credit">${esc(t("rateReset"))}</button>` : ""}
      <button class="pill primary" data-action="upgrade">${ic("sparkle")}${esc(t("rateUpgrade"))}</button>
    </div>`;
}

function autosize() {
  els.input.style.height = "auto";
  els.input.style.height = `${Math.min(els.input.scrollHeight, 220)}px`;
}

function updateSendState() {
  els.send.disabled = (!els.input.value.trim()&&!state.attachments.length) || state.pendingSend || state.loadingThread || state.threadOpenFailed || (typeof composerAttachmentsPending==='function'&&!!composerAttachmentsPending()) || !!state.connectionError || !!globalThis.sendReceipts?.blocked();
  autosize();
  if(typeof renderSubagentComposerContext==='function')renderSubagentComposerContext();
}

/* ---------- mode / model menus ---------- */

function openModeMenu() {
  if(state.sideChatEphemeral){toast('侧边聊天用于临时问答，保持只读；文件改动请回到主聊天。');return;}
  if(state.pendingSend||state.running)return;
  const rect = els.modeButton.getBoundingClientRect();
  openMenu([],{rect,anchor:els.modeButton});
  const menu=document.querySelector('#menu-root .menu');menu.classList.add('permission-menu');
  const modes=state.mode==='read'?['auto','assisted','full','read']:['auto','assisted','full'];
  const descriptions={auto:'autoDesc',assisted:'assistedDesc',full:'fullDesc',read:'readDesc'};
  menu.innerHTML=`<div class="permission-menu-head"><span>应如何批准 Codex 操作？</span><button data-permission-help>了解更多</button></div>${modes.map(key=>`<button class="permission-choice${key==='full'?' permission-danger':''}" data-permission-mode="${key}" role="menuitemradio" aria-checked="${key===state.mode}"><span class="permission-choice-icon">${ic(MODES[key].icon)}</span><span class="permission-choice-copy"><strong>${esc(t(MODES[key].label))}</strong><small>${esc(t(descriptions[key]))}</small></span><span class="permission-choice-check">${key===state.mode?ic('check'):''}</span></button>`).join('')}`;
  menu.querySelectorAll('[data-permission-mode]').forEach(button=>button.onclick=()=>{state.mode=button.dataset.permissionMode;store.set('codex.mode',state.mode);closeMenu();renderComposer();});
  menu.querySelector('[data-permission-help]').onclick=()=>{
    closeMenu();const {modal,close}=workspaceDialog('权限说明','<p>请求批准：工作区内可编辑，越界或联网操作由你批准。</p><p>帮我批准：使用内核 auto_review 审核权限请求，自动批准或拒绝；不会绕过内核沙箱。</p><p>完全访问权限：关闭内核沙箱和交互批准，仍受操作系统与服务权限约束。</p><button class="btn" data-read-only>切换为只读模式</button>');
    modal.querySelector('[data-read-only]').onclick=()=>{state.mode='read';store.set('codex.mode','read');renderComposer();close();};
  };
  const box=menu.getBoundingClientRect();menu.style.left=`${clamp(rect.left,6,innerWidth-box.width-6)}px`;menu.style.top=`${Math.max(6,rect.top-box.height-8)}px`;
}

function openModelMenu() {
  if (state.pendingSend) return;
  if(!state.provider&&globalThis.modelAccess&&!modelAccess.ready()){openModelList();return;}
  const rect = els.modelButton.getBoundingClientRect();
  openMenu([], { rect, anchor: els.modelButton, onClose:()=>renderComposer() });
  const panel = document.querySelector('#menu-root .menu');
  panel.classList.add('model-control');
  const efforts = availableEfforts();
  const index = Math.max(0, efforts.indexOf(state.effort));
  const provider = state.providers.find(p => p.id === state.provider);
  const model = state.models.find(m => (m.model || m.id) === state.model);
  const name = provider?.displayName || codexModelDisplayName(model?.displayName || state.model) || t('models');
  panel.innerHTML = `<div class="model-control-top"><button type="button" class="model-control-bolt" data-fast-mode aria-label="启用快速模式" aria-pressed="false">${cloudComposerIcons.fast}</button><span class="model-control-effort">${esc(t(EFFORT_LABELS[state.effort] || 'effortHigh'))}</span><button data-reset-effort title="恢复默认推理强度" aria-label="恢复默认推理强度">${cloudComposerIcons.reset}</button></div><button class="model-control-name" data-open-model-list>${esc(name)}${cloudComposerIcons.right}</button><div class="model-control-slider"><div class="model-control-fill"></div><div class="model-control-ticks">${efforts.map(()=>'<i></i>').join('')}</div><input type="range" aria-label="推理强度" min="0" max="${Math.max(0,efforts.length-1)}" step="1" value="${index}" ${efforts.length<2 || state.running ? 'disabled' : ''} /></div>`;
  const slider = panel.querySelector('input');
  const update = () => {
    const value = Math.max(0,efforts.indexOf(state.effort));
    slider.value = value;
    slider.setAttribute('aria-valuetext', t(EFFORT_LABELS[state.effort] || 'effortHigh'));
    panel.querySelector('.model-control-effort').textContent = t(EFFORT_LABELS[state.effort] || 'effortHigh');
    const ratio=efforts.length>1?value/(efforts.length-1):0;
    // The native thumb travels width minus its own diameter, not the full track.
    panel.style.setProperty('--effort-position', `calc(14px + (100% - 28px) * ${ratio})`);
    panel.querySelectorAll('.model-control-ticks i').forEach((tick,i)=>tick.classList.toggle('filled',i<=value));
    const fast=panel.querySelector('[data-fast-mode]'),tier=codexFastTier(model),enabled=!!tier&&codexSelectedServiceTier()===tier.id;
    fast.disabled=state.running||state.pendingSend||!tier;fast.setAttribute('aria-pressed',String(enabled));fast.setAttribute('aria-label',enabled?'切换为标准速度':'启用快速模式');fast.title=tier?(enabled?'快速模式已启用，点击恢复标准速度':'启用快速模式（更快响应，消耗更多用量）'):'当前模型或提供商不支持快速模式';
  };
  slider.addEventListener('input', () => {
    if (state.pendingSend || state.running) return;
    state.effort = efforts[Number(slider.value)]; store.set('codex.effort',state.effort); renderComposer(); update();
  });
  panel.querySelector('[data-fast-mode]').onclick=()=>{const tier=codexFastTier(model);if(!tier||state.running||state.pendingSend)return;const selected=store.get('codex.serviceTiers',{});selected[state.model]=codexSelectedServiceTier()===tier.id?null:tier.id;store.set('codex.serviceTiers',selected);renderComposer();update();};
  panel.querySelector('[data-reset-effort]').disabled = state.running;
  panel.querySelector('[data-reset-effort]').addEventListener('click', () => {
    if (state.pendingSend || state.running || !efforts.length) return;
    const preferred = model?.defaultReasoningEffort || 'medium';
    state.effort = efforts.includes(preferred) ? preferred : efforts[0];
    store.set('codex.effort',state.effort);renderComposer();update();
  });
  panel.querySelector('[data-open-model-list]').addEventListener('click', openModelList);
  update();
  renderComposer();
  const box = panel.getBoundingClientRect();
  panel.style.left = `${clamp(rect.right-box.width,6,innerWidth-box.width-6)}px`;
  panel.style.top = `${Math.max(6,rect.top-box.height-8)}px`;
}

function openModelList() {
  const rect = els.modelButton.getBoundingClientRect();
  const items = [];
  const blocked=globalThis.modelAccess&&!modelAccess.ready();
  items.push({ label: blocked?(modelAccess.phase()==='signed-out'?'请先登录 OpenAI 后选择 GPT 模型':modelAccess.label()):t("models"), heading: true });
  if(blocked){items.push({label:modelAccess.phase()==='signed-out'?'登录 OpenAI':'重新检查登录状态',icon:'user',action:()=>{if(modelAccess.phase()==='signed-out')modelAccess.signIn();else modelAccess.refresh({force:true}).then(()=>openModelList());}});}
  for (const model of modelEntries()) {
    const id = model.model || model.id;
    items.push({
      label: codexModelDisplayName(model.displayName || id),
      checked: !blocked && !state.provider && state.model === id,
      disabled: !!blocked,
      action: () => { selectProviderModel(null, id); openModelMenu(); },
    });
  }
  for (const provider of state.providers) items.push({
    label: `${provider.displayName || provider.model}${provider.needsRestart ? "（需重启）" : ""}`,
    checked: state.provider === provider.id,
    action: () => { selectProviderModel(provider.id, provider.model); openModelMenu(); },
  });
  items.push({ label: "管理 API 提供商…", action: () => openSettings("models") });
  openMenu(items, { rect, anchor: els.modelButton });
}

function selectProviderModel(provider, model) {
  if(!provider&&globalThis.modelAccess&&!modelAccess.ready()){openModelList();return false;}
  if(provider&&state.sideChatEphemeral){toast('侧边 GPT 聊天使用当前 ChatGPT 账号的模型。');return;}
  if (state.running || state.pendingSend) { toast("请先完成或停止当前回合再切换模型"); return; }
  const entry = state.providers.find(p => p.id === provider);
  if (provider && (!entry || entry.needsRestart)) { toast("请先在模型设置中重启应用以启用 API Key"); return; }
  if (provider !== state.provider && state.thread) {
    startNewThread(state.cwd);
    toast("已新建对话，使用所选提供商；原对话保留");
  }
  state.provider = provider;
  state.model = model;
  if (!availableEfforts().includes(state.effort)) state.effort = availableEfforts()[0] || null;
  store.set("codex.provider", provider);
  store.set("codex.model", model);
  renderComposer();
}

function openEffortMenu() {
  const rect = els.reasoningButton.getBoundingClientRect();
  openMenu(
    availableEfforts().map((effort) => ({
      label: t(EFFORT_LABELS[effort]),
      checked: state.effort === effort,
      action: () => {
        state.effort = effort;
        store.set("codex.effort", effort);
        renderComposer();
      },
    })),
    { rect, anchor: els.reasoningButton },
  );
}

function availableEfforts() {
  const provider = state.providers.find(p => p.id === state.provider);
  if (provider && new URL(provider.baseUrl).hostname === "api.deepseek.com" && state.model === "deepseek-flash") return ["low", "high", "max"];
  const model = state.models.find(p => (p.model || p.id) === state.model);
  return model?.supportedReasoningEfforts?.map(p => p.reasoningEffort) || ["low", "medium", "high", "xhigh", "max", "ultra"];
}

/* Reference search and attachment interactions live in composer-references.js. */

/* ---------- slash commands ---------- */

const SLASH_COMMANDS = [
  { command: "/new", labelKey: "slashNew", action: () => startNewThread() },
  { command: "/review", labelKey: "slashReview", action: () => openReviewModal() },
  { command: "/compact", labelKey: "slashCompact", action: () => compactCurrent() },
  { command: "/goal", labelKey: "slashGoal", action: () => openGoalModal() },
  { command: "/fork", labelKey: "slashFork", action: () => forkCurrent() },
  { command: "/archive", labelKey: "slashArchive", action: () => archiveCurrent() },
  { command: "/settings", labelKey: "slashSettings", action: () => openSettings("account") },
  { command: "/model", labelKey: "slashModel", action: () => openModelMenu() },
  { command: "/diff", labelKey: "slashDiff", action: () => showLatestDiff() },
  { command: "/rename", labelKey: "slashRename", action: () => renameCurrent() },
];

function closeSlash() {
  state.slash.open = false;
  els.slashPop.classList.add("hidden");
  els.slashPop.innerHTML = "";
}

function updateSlashMenu() {
  const value = els.input.value;
  const cursor = els.input.selectionStart ?? value.length;
  const before = value.slice(0, cursor);
  const match = /^\/([^\s]*)$/.exec(before);
  if (!match) {
    closeSlash();
    return;
  }
  const query = match[1].toLowerCase();
  const items = SLASH_COMMANDS.filter((entry) =>
    entry.command.slice(1).toLowerCase().startsWith(query),
  );
  if (!items.length) {
    closeSlash();
    return;
  }
  state.slash.open = true;
  state.slash.items = items;
  state.slash.index = Math.min(state.slash.index, items.length - 1);
  els.slashPop.classList.remove("hidden");
  els.slashPop.innerHTML = items
    .map(
      (entry, index) =>
        `<button class="pop-item${index === state.slash.index ? " sel" : ""}" data-slash-index="${index}">
          <span class="pop-ico">${ic("code")}</span>
          <span class="pop-main"><span class="pop-name">${esc(entry.command)}</span><span class="pop-sub">${esc(t(entry.labelKey))}</span></span>
        </button>`,
    )
    .join("");
}

function runSlash(index) {
  const entry = state.slash.items[index];
  if (!entry) return;
  els.input.value = "";
  closeSlash();
  updateSendState();
  entry.action();
}

/* ---------- composer events ---------- */

els.input.addEventListener("input", () => {
  updateSendState();
  if(JSON.stringify(validComposerMentions(els.input.value).map(m=>m.path))!==state.composerRefsKey)renderComposer();
  detectMention();
  updateSlashMenu();
});

els.input.addEventListener("keydown", (event) => {
  if(event.isComposing)return;
  if (state.mention.open && !els.mentionPop.classList.contains("hidden")) {
    const count = state.mention.items.length;
    if (event.key === "ArrowDown" && count) {
      event.preventDefault();
      state.mention.userNavigated=true;
      state.mention.index = (state.mention.index + 1) % count;
      renderMentionPop();
      return;
    }
    if (event.key === "ArrowUp" && count) {
      event.preventDefault();
      state.mention.userNavigated=true;
      state.mention.index = (state.mention.index - 1 + count) % count;
      renderMentionPop();
      return;
    }
    if ((event.key === "Enter" || event.key === "Tab") && !event.shiftKey && count) {
      event.preventDefault();
      event.stopImmediatePropagation();
      chooseMention(state.mention.index);
      return;
    }
    if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();event.stopImmediatePropagation();return;}
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeMention();
      return;
    }
  }

  if (state.slash.open && !els.slashPop.classList.contains("hidden")) {
    const count = state.slash.items.length;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      state.slash.index = (state.slash.index + 1) % count;
      updateSlashMenu();
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      state.slash.index = (state.slash.index - 1 + count) % count;
      updateSlashMenu();
      return;
    }
    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      event.stopImmediatePropagation();
      runSlash(state.slash.index);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeSlash();
      return;
    }
  }
});

els.mentionPop.addEventListener("click", (event) => {
  const button = event.target.closest("[data-mention-index]");
  if (button) chooseMention(Number(button.dataset.mentionIndex));
});

els.slashPop.addEventListener("click", (event) => {
  const button = event.target.closest("[data-slash-index]");
  if (button) runSlash(Number(button.dataset.slashIndex));
});

els.modeButton.addEventListener("click", (event) => {
  event.stopPropagation();
  openModeMenu();
});

els.modelButton.addEventListener("click", (event) => {
  event.stopPropagation();
  if(document.querySelector('#menu-root .model-control'))closeMenu();else openModelMenu();
});

els.attach.addEventListener("click", event => openComposerContextMenu(event.currentTarget));
els.mic.addEventListener("click", () => toast("语音输入尚未接入 Realtime 协议"));
