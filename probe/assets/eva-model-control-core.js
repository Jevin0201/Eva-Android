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
  openMenu([], { rect, anchor: els.modelButton });
  const panel = document.querySelector('#menu-root .menu');
  panel.classList.add('model-control');
  const efforts = availableEfforts();
  const index = Math.max(0, efforts.indexOf(state.effort));
  const effortLabel=()=>state.effort?t(EFFORT_LABELS[state.effort]||state.effort):(efforts.length?'模型默认':'接口未提供推理档位');
  const provider = state.providers.find(p => p.id === state.provider);
  const model = state.provider?provider?.models?.find(m=>m.id===state.model):state.models.find(m => (m.model || m.id) === state.model);
  const name = codexModelDisplayName(model?.name || model?.displayName || state.model) || t('models');
  panel.innerHTML = `<div class="model-control-top"><button type="button" class="model-control-bolt" data-fast-mode aria-label="启用快速模式" aria-pressed="false">${cloudComposerIcons.fast}</button><span class="model-control-effort">${esc(effortLabel())}</span><button data-reset-effort title="恢复默认推理强度" aria-label="恢复默认推理强度">${cloudComposerIcons.reset}</button></div><button class="model-control-name" data-open-model-list>${esc(name)}${cloudComposerIcons.right}</button><div class="model-control-slider"><div class="model-control-fill"></div><div class="model-control-ticks">${efforts.map(()=>'<i></i>').join('')}</div><input type="range" aria-label="推理强度" min="0" max="${Math.max(0,efforts.length-1)}" step="1" value="${index}" ${efforts.length<2 || state.running || state.saving ? 'disabled' : ''} /></div>`;
  const slider = panel.querySelector('input');
  const update = () => {
    const value = Math.max(0,efforts.indexOf(state.effort));
    slider.value = value;
    slider.setAttribute('aria-valuetext', effortLabel());
    panel.querySelector('.model-control-effort').textContent = effortLabel();
    const ratio=efforts.length>1?value/(efforts.length-1):0;
    // The native thumb travels width minus its own diameter, not the full track.
    panel.style.setProperty('--effort-position', `calc(14px + (100% - 28px) * ${ratio})`);
    panel.querySelectorAll('.model-control-ticks i').forEach((tick,i)=>tick.classList.toggle('filled',i<=value));
    const fast=panel.querySelector('[data-fast-mode]'),tier=codexFastTier(model),enabled=!!tier&&codexSelectedServiceTier()===tier.id;
    fast.disabled=state.running||state.pendingSend||state.saving||!tier;fast.setAttribute('aria-pressed',String(enabled));fast.setAttribute('aria-label',enabled?'切换为标准速度':'启用快速模式');fast.title=tier?(enabled?'快速模式已启用，点击恢复标准速度':'启用快速模式（更快响应，消耗更多用量）'):'当前模型或提供商不支持快速模式';
  };
  slider.addEventListener('input', () => {
    if (state.pendingSend || state.saving || state.running) return;
    state.effort = efforts[Number(slider.value)]; update();
  });
  slider.addEventListener('change', () => {
    if (state.pendingSend || state.saving || state.running) return;
    state.effort = efforts[Number(slider.value)];
    store.set('codex.effort',state.effort); renderComposer(); update();
  });
  panel.querySelector('[data-fast-mode]').onclick=()=>{const tier=codexFastTier(model);if(!tier||state.running||state.pendingSend||state.saving)return;const selected=store.get('codex.serviceTiers',{});selected[state.model]=codexSelectedServiceTier()===tier.id?null:tier.id;store.set('codex.serviceTiers',selected);renderComposer();update();};
  panel.querySelector('[data-reset-effort]').disabled = state.running || state.saving;
  panel.querySelector('[data-reset-effort]').addEventListener('click', () => {
    if (state.pendingSend || state.saving || state.running || !efforts.length) return;
    const preferred = model?.defaultReasoningEffort || model?.x_ofm_effort_default;
    state.effort = efforts.includes(preferred) ? preferred : null;
    store.set('codex.effort',state.effort);renderComposer();update();
  });
  panel.querySelector('[data-open-model-list]').addEventListener('click', openModelList);
  update();
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
  state.expandedProviders ||= {[state.provider || 'openai']: true};
  const group = (id, label, models, provider, disabled = false) => {
    const selected = (state.provider || 'openai') === id;
    const current = selected ? models.find(model => (model.model || model.id) === state.model) : null;
    items.push({
      group: true, id, label,
      description:state.providers.find(p=>p.id===id)?.managedBy==='dsh'?undefined:state.providers.find(p=>p.id===id)?.description,
      onRefresh:state.providers.find(p=>p.id===id)?.managedBy==='dsh'?()=>window.EvaHost?.refreshDshModels?.():null,
      current: selected ? (current?.name || current?.displayName || state.model) : '',
      expanded: !!state.expandedProviders[id],
      onToggle: expanded => { state.expandedProviders[id] = expanded; },
      children: models.map(model => {
        const modelId = model.model || model.id;
        return {
          label: codexModelDisplayName(model.name || model.displayName || modelId),
          checked: selected && state.model === modelId,
          disabled,
          action: () => { selectProviderModel(provider, modelId); openModelMenu(); },
        };
      }),
    });
  };
  group('openai', 'OpenAI', modelEntries().filter(model=>model.visible!==false), null, !!blocked);
  for (const provider of state.providers) {
    const models = Array.isArray(provider.models) ? provider.models : [{id: provider.model, name: provider.displayName || provider.model, ...provider.modelPreferences?.[provider.model]}];
    group(provider.id, provider.name, models.filter(model => model.id && model.visible !== false), provider.id);
  }
  items.push({ label: "管理 API 提供商…", action: () => openSettings("models") });
  openMenu(items, { rect, anchor: els.modelButton });
}

function selectProviderModel(provider, model) {
  if(!provider&&globalThis.modelAccess&&!modelAccess.ready()){openModelList();return false;}
  if(provider&&state.sideChatEphemeral){toast('侧边 GPT 聊天使用当前 ChatGPT 账号的模型。');return;}
  if (state.running || state.pendingSend || state.saving) { toast("请先完成或停止当前回合再切换模型"); return; }
  const entry = state.providers.find(p => p.id === provider);
  if (provider && !entry) { toast("提供商已删除，请重新选择"); return; }
  if (provider !== state.provider && state.thread && !adapter.preserveThreadOnProviderChange) {
    startNewThread(state.cwd);
    toast("已新建对话，使用所选提供商；原对话保留");
  }
  state.provider = provider;
  state.model = model;
  if (!availableEfforts().includes(state.effort)) state.effort = null;
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
  const model = state.provider?provider?.models?.find(m=>m.id===state.model):state.models.find(m => (m.model||m.id)===state.model);
  const values=model?.reasoningEfforts||model?.supportedReasoningEfforts||model?.x_ofm_efforts||[];
  return values.map(value=>typeof value==='string'?value:value.reasoningEffort).filter(value=>typeof value==='string'&&value);
}


return {openModelMenu,openModelList,availableEfforts};
};
