// Same display-name formatter as desktop composer.js; IDs remain untouched.
window.evaModelDisplayName=function(value){return String(value||'').replace(/^(GPT-\d+(?:\.\d+)?)-(Sol|Luna|Astra|Terra)$/i,(_all,version,family)=>version.toUpperCase()+' '+family[0].toUpperCase()+family.slice(1).toLowerCase());};
// Extracted with an Android provider-switch policy hook from user-provided Eva 0.2.0 composer.js. See migration/eva-0.2.0-model-control/source.json.
window.createDesktopModelControl=function(adapter){
const {state,els,store,t,esc,clamp,openMenu,closeMenu,renderComposer,modelEntries,startNewThread,toast,openSettings,ic,EFFORT_LABELS}=adapter;
const codexModelDisplayName=window.evaModelDisplayName;
function codexFastTier(model=state.models.find(m=>(m.model||m.id)===state.model)){return state.provider?null:(model?.serviceTiers||[]).find(t=>t.id==='priority'||/^fast$/i.test(t.name||''))||null;}
function codexSelectedServiceTier(){const tier=codexFastTier();return tier&&store.get('codex.serviceTiers',{})[state.model]===tier.id?tier.id:null;}

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
  if (provider !== state.provider && state.thread && !adapter.preserveThreadOnProviderChange) {
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


return {openModelMenu,openModelList,availableEfforts};
};
