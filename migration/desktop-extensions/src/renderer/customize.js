/* Customization workspace. Catalogs are read from the kernel; no shared configuration writes. */
const customization = { query: {plugins:'',skills:''}, tab:'public', scope:'user', category:null, limit:120, loading:false, sequence:0, plugins:null, skills:null, errors:[] };
const customizeInert = new Map();
const customizeChinese = {values:{},busy:false,error:'',timer:null,enabled:false};
const customizeDataCache={};
const customizePersonalCache=new WeakMap();
function customizeScope(){return JSON.stringify([state.thread?.cwd||state.cwd||'',state.meta?.codexHome||'']);}
function customizeCatalogUpdated(){customization.loadedAt=0;if(customization.pending){customization.refreshQueued=true;return;}if(state.customize)loadCustomization();}
const CUSTOMIZE_NAMES_ZH={'eva-word':'Word','eva-pdf':'PDF','eva-excel':'Excel','eva-ppt':'PPT','local-browser-network':'本地浏览器联动与抓包','codex-with-chatgpt':'Codex 与 ChatGPT 协作','ui-image-to-code':'截图与网站转代码','imagegen':'图像生成','openai-docs':'OpenAI 文档','review-agent':'代码审查助手','skill-creator':'技能创建器','skill-installer':'技能安装器'};
function customizeTextId(item){return item.id?'plugin:'+item.id:'skill:'+item.name;}
function customizeSourceName(item){return item.interface?.displayName || (item.name||'').replace(/[-_]/g,' ').replace(/\b\w/g,c=>c.toUpperCase());}
function isChineseCatalogText(text){const chinese=(text.match(/[\u3400-\u9fff]/g)||[]).length,words=(text.match(/\b[a-zA-Z]{3,}\b/g)||[]).length;return chinese>0&&(words<=8||chinese>words*3);}

function closeCustomize() {
  if (!state.customize) return;
  state.customize = null;
  globalThis.EvaPluginAddHost?.detach();
  document.body.classList.remove('customizing');
  document.getElementById('customize-sidebar').classList.add('hidden');
  document.getElementById('customize-page').classList.add('hidden');
  for(const [node,value]of customizeInert)node.inert=value;
  customizeInert.clear();
  renderSidebar();
  globalThis.nativeWorkspace?.render();
}
function openCustomize(kind='plugins') {
  if (!['plugins','skills'].includes(kind)) return;
  customization.detail=null;
  closeSettings();closeAltPage();closeMenu();
  if(state.browserOpen)toggleBrowserPanel(false);
  state.customize=kind;
  document.body.classList.add('customizing');
  for(const node of document.querySelector('.main').children)if(!['customize-page','banner'].includes(node.id)){if(!customizeInert.has(node))customizeInert.set(node,node.inert);node.inert=true;}
  renderSidebar();renderCustomize();
  globalThis.nativeWorkspace?.render();
  loadCustomization();
}
function loadCustomization(refresh=false,refreshRemote=false) {
  if(refresh||refreshRemote)invalidatePluginDetailCache();
  const scope=customizeScope(),pending=customization.pending;
  if(pending?.scope===scope&&((!refresh&&!refreshRemote)||(pending.refresh===refresh&&pending.remote===refreshRemote)))return pending.promise;
  if(!refresh&&!refreshRemote&&customization.loadedScope===scope&&Date.now()-(customization.loadedAt||0)<15000&&customization.plugins&&customization.skills&&!customization.errors.length)return Promise.resolve();
  const epoch=++customization.sequence,cwds=[state.thread?.cwd||state.cwd].filter(Boolean),cwdParams=cwds.length?{cwds}:{},entry={scope,refresh,remote:refreshRemote};
  customization.pending=entry;
  const stamp=value=>JSON.stringify((value?.marketplaces||[]).flatMap(m=>(m.plugins||[]).filter(p=>p.installed).map(p=>[p.id,p.localVersion||p.version,p.enabled])));
  const previousStamp=stamp(customization.plugins),changedScope=customization.loadedScope!==scope;
  if(changedScope){customization.plugins=null;customization.skills=null;}
  customization.loading=true;customization.errors=[];renderCustomize();
  entry.promise=(async()=>{
    let pluginsChanged=false,catalogReady=false;
    const receive=async(key,method,params)=>{try{const value=await api.call(method,params);if(epoch!==customization.sequence)return;
      if(key==='plugins'){pluginsChanged=previousStamp!==stamp(value);catalogReady=true;}
      customization[key]=value;renderCustomize();
    }catch(error){if(epoch===customization.sequence)customization.errors.push(`${key==='skills'?'技能':'插件'}：${customizeError(error)}`);}};
    const skillsRequest=receive('skills','skills/list',{...cwdParams,forceReload:refresh});
    const installedRequest=(refresh||customization.plugins)&&customization.chatgptSignedIn!==false?Promise.resolve():api.call('plugin/installed',cwdParams).then(value=>{if(epoch!==customization.sequence||catalogReady)return;customization.plugins={...value,_raeInstalledOnly:true};renderCustomize();}).catch(()=>{});
    const remoteRequest=(async()=>{const signedIn=globalThis.cloudAuth?await cloudAuth.check().catch(()=>false):true;if(epoch!==customization.sequence)return;customization.chatgptSignedIn=signedIn;await receive('plugins','plugin/list',{...cwdParams,forceRefetch:refreshRemote,...(!signedIn?{marketplaceKinds:['local']}: {})});})();
    await Promise.all([skillsRequest,remoteRequest]);
    if(epoch!==customization.sequence)return;
    // Only a changed installed bundle set needs a scan after materialization.
    if(pluginsChanged){try{const value=await api.call('skills/list',{...(cwds.length?{cwds}:{}),forceReload:true});if(epoch===customization.sequence)customization.skills=value;}catch(error){if(epoch===customization.sequence)customization.errors.push('技能：'+customizeError(error));}}
    if(epoch!==customization.sequence)return;
    customization.loadedScope=scope;customization.loadedAt=Date.now();customization.loading=false;renderCustomize();
  })().finally(()=>{if(customization.pending===entry){customization.pending=null;if(customization.refreshQueued){customization.refreshQueued=false;customization.loadedAt=0;if(state.customize)loadCustomization();}}});
  return entry.promise;
}
function customizePlugins() {
  if(customizeDataCache.pluginSource===customization.plugins&&customizeDataCache.plugins)return customizeDataCache.plugins;
  const seen=new Set();
  const result=(customization.plugins?.marketplaces||[]).flatMap(m=>(m.plugins||[]).map(p=>({...p,marketplace:m}))).filter(p=>{if(seen.has(p.id))return false;seen.add(p.id);return true;});
  customizeDataCache.pluginSource=customization.plugins;return customizeDataCache.plugins=result;
}
function customizeSkills() {
  const context=JSON.stringify([state.meta?.sourceCodexHome,state.meta?.codexHome]);
  if(customizeDataCache.skillSource===customization.skills&&customizeDataCache.skillContext===context&&customizeDataCache.skills)return customizeDataCache.skills;
  const seen=new Set();
  const all=(customization.skills?.data||[]).flatMap(e=>e.skills||[]),source=projectKey((state.meta?.sourceCodexHome||'')+'/skills')+'\\',target=projectKey((state.meta?.codexHome||'')+'/skills')+'\\';
  const privatePaths=new Set(all.map(s=>projectKey(s.path)));
  const result=all.filter(s=>{const key=projectKey(s.path);if(key.startsWith(source)&&privatePaths.has(target+key.slice(source.length)))return false;if(seen.has(key))return false;seen.add(key);return true;}).sort((a,b)=>customizeSourceName(a).localeCompare(customizeSourceName(b)));
  customizeDataCache.skillSource=customization.skills;customizeDataCache.skillContext=context;return customizeDataCache.skills=result;
}
function isEvaBuiltin(item){return ['eva-word','eva-pdf','eva-excel','eva-ppt','local-browser-network'].includes(item.name)&&projectKey(item.path||'').startsWith(projectKey((state.meta?.codexHome||'')+'/skills/'));}
function customizeName(item) {
  return CUSTOMIZE_NAMES_ZH[item.name]||customizeChinese.values[customizeTextId(item)]?.name||customizeSourceName(item);
}
function customizeRawDescription(item){return item.interface?.shortDescription||item.shortDescription||item.interface?.longDescription||item.description||'';}
function customizeDescription(item) {return customizeChinese.values[customizeTextId(item)]?.description||customizeRawDescription(item)||'暂无介绍';}
function customizeIcon(item,kind='plugins') {
  const face=item.interface||{},local=face.logo||face.iconLarge||face.composerIcon||face.iconSmall;
  const remote=face.logoUrl||face.iconLargeUrl||face.composerIconUrl||face.iconSmallUrl;
  const src=local?mediaUrl(local):/^https?:\/\//i.test(remote||'')?remote:builtinPluginIcon(item);
  return `<span class="customize-icon">${src?`<img src="${esc(src)}" alt="" loading="lazy"/>`:ic(kind==='skills'?'codex':'plugin')}</span>`;
}
function customizePersonal(p) {if(customizePersonalCache.has(p))return customizePersonalCache.get(p);const personal=/created-by-me|personal/i.test(p.marketplace?.name||'') || /personal/i.test(JSON.stringify(p.shareContext||'')) || (p.source?.type!=='remote'&&!['openai-bundled','openai-primary-runtime'].includes(p.marketplace?.name));customizePersonalCache.set(p,personal);return personal;}
function customizeSidebar() {
  const root=document.getElementById('customize-sidebar');root.classList.remove('hidden');
  const installed=customizePlugins().filter(p=>p.installed&&(p.source?.type==='remote'||customizePersonal(p)));
  root.innerHTML=`<div class="customize-side-heading"><h2>自定义</h2><button class="icon-btn" data-customize-focus aria-label="搜索自定义">${ic('search')}</button></div><nav>${['plugins','skills'].map(k=>`<button class="customize-nav${state.customize===k?' selected':''}" data-customize-nav="${k}"${state.customize===k?' aria-current="page"':''}>${ic(k==='plugins'?'plugin':'layers')}<span>${k==='plugins'?'插件':'技能'}</span></button>`).join('')}</nav><div class="customize-side-installed"><h3>已安装</h3>${installed.map(p=>`<button class="customize-installed" data-customize-plugin="${esc(p.id)}">${customizeIcon(p)}<span>${esc(customizeName(p))}</span></button>`).join('')||`<p class="customize-muted">${customization.loading?'正在读取…':'暂无个人安装的插件'}</p>`}</div>`;
  root.querySelector('[data-customize-focus]').onclick=()=>document.getElementById('customize-search')?.focus();
  root.querySelectorAll('[data-customize-nav]').forEach(b=>b.onclick=()=>openCustomize(b.dataset.customizeNav));
  bindCustomizeDetails(root);
}
function customizeCard(item,kind) {
  const installed=kind==='skills'?item.enabled:item.installed;
  const id=kind==='skills'?item.path:item.id;
  return `<article class="customize-card"><button class="customize-card-main" data-customize-${kind==='skills'?'skill':'plugin'}="${esc(id)}">${customizeIcon(item,kind)}<span class="customize-card-copy"><strong>${esc(customizeName(item))}</strong><span title="${esc(customizeDescription(item))}">${esc(customizeDescription(item))}</span></span></button><button class="customize-card-action" data-customize-action="${kind}" data-customize-id="${esc(id)}" aria-label="${esc((kind==='skills'?(installed?'停用':'启用'):installed?'管理':'安装')+' '+customizeName(item))}" title="${kind==='skills'?(installed?'已启用，点击停用':'已停用，点击启用'):installed?'管理插件':'安装插件'}"${customization.mutating?' disabled':''}>${ic(installed?(kind==='skills'?'check':'more'):'plus')}</button></article>`;
}
function customizeSection(title,items,kind,category=null) {
  if(!items.length)return '';
  return `<section class="customize-section"><h3>${category?`<button data-customize-category="${esc(category)}">${esc(title)}${ic('chevronRight')}</button>`:esc(title)}</h3><div class="customize-grid">${items.map(p=>customizeCard(p,kind)).join('')}</div></section>`;
}
function renderCustomize() {
  if(!state.customize)return;
  customizeSidebar();
  const root=document.getElementById('customize-page'),kind=state.customize,isSkill=kind==='skills',query=customization.query[kind],q=query.trim().toLowerCase();
  const focused=document.activeElement?.id==='customize-search',caret=focused?document.activeElement.selectionStart:null;
  const top=root.scrollTop;root.classList.remove('hidden');root.dataset.kind=kind;
  if(customization.detail){renderPluginDetail(root);return;}
  let body='';
  const matches=p=>!q||[p.name,customizeName(p),customizeRawDescription(p),customizeDescription(p),p.interface?.category].join(' ').toLowerCase().includes(q);
  if(isSkill){
    const skills=customizeSkills().filter(s=>!s.pluginId&&!isEvaBuiltin(s)&&matches(s));
    body=customizeSection('已安装',skills,'skills');
    body+=`<div class="customize-tabs" aria-label="技能来源">${[['user','个人'],['system','系统'],['plugins','插件技能']].map(([v,l])=>`<button data-customize-scope="${v}" class="${customization.scope===v?'selected':''}" aria-pressed="${customization.scope===v}">${l}</button>`).join('')}</div>`;
    const scoped=customization.scope==='plugins'?customizeSkills().filter(s=>s.pluginId&&matches(s)):skills.filter(s=>s.scope===(customization.scope==='user'?'user':'system'));
    body+=`<div class="customize-grid customize-scope-grid">${scoped.slice(0,customization.limit).map(s=>customizeCard(s,'skills')).join('')||'<p class="customize-muted">没有匹配的技能</p>'}</div>`;
    if(scoped.length>customization.limit)body+='<button class="btn" data-customize-more>显示更多</button>';
  }else{
    body=`<div class="customize-tabs" aria-label="插件来源"><button data-customize-tab="public" class="${customization.tab==='public'?'selected':''}" aria-pressed="${customization.tab==='public'}">公开</button><button data-customize-tab="personal" class="${customization.tab==='personal'?'selected':''}" aria-pressed="${customization.tab==='personal'}">个人</button></div>`;
    const all=customizePlugins().filter(p=>matches(p)&&(customization.tab==='personal'?customizePersonal(p):!customizePersonal(p)&&p.source?.type==='remote')).filter(p=>!customization.category||(p.interface?.category||'其他')===customization.category);
    const rows=all.slice(0,customization.limit),groups=new Map();
    for(const p of all){const label=p.interface?.category||'其他';if(!groups.has(label))groups.set(label,[]);groups.get(label).push(p);}
    const labels={'Productivity':'效率','Developer Tools':'开发工具','Communication':'沟通','Design':'设计','Business':'商业','Education':'教育','Lifestyle':'生活方式','Engineering':'工程','Finance':'财务','Health':'健康','Travel':'旅行','Entertainment':'娱乐','Research':'研究','Writing':'写作','Data':'数据','Shopping':'购物','Utilities':'实用工具','Creativity':'创作','Social':'社交'};
    if(customization.category)body+=`<button class="customize-category-back" data-customize-category="">${ic('back')}全部分类</button>`;
    if(q||customization.category||customization.tab==='personal')body+=customizeSection(q?`搜索结果 · ${all.length}`:customization.category?(labels[customization.category]||'其他插件'):'个人插件',rows,'plugins');
    else {
      const featuredIds=customization.plugins?.featuredPluginIds||[];
      const featured=featuredIds.map(id=>all.find(p=>p.id===id||p.remotePluginId===id)).filter(Boolean);
      body+=customizeSection('热门',featured,'plugins');
      for(const [category,items]of groups)body+=customizeSection(labels[category]||'其他插件',items.slice(0,6),'plugins',category);
    }
    if(!rows.length)body+='<p class="customize-empty">没有匹配的插件</p>';
    if((q||customization.category||customization.tab==='personal')&&all.length>rows.length)body+='<button class="btn" data-customize-more>显示更多</button>';
    if(customization.plugins?._raeInstalledOnly)body=`<p class="customize-muted" role="status">${!customization.loading&&customization.errors.length?'已显示本地已安装插件；完整目录同步失败，请刷新重试。':'已安装插件已就绪，正在后台同步完整目录…'}</p>`+customizeSection('已安装',all.filter(p=>p.installed),'plugins');
  }
  const builtins=customizeSkills().filter(s=>isEvaBuiltin(s)&&matches(s));body=customizeSection('Eva 内置 · 无需登录 ChatGPT',builtins,'skills')+body;if(!isSkill&&customization.chatgptSignedIn===false){body=customizeSection('Eva 内置 · 无需登录 ChatGPT',builtins,'skills')+customizeSection('本地插件',customizePlugins().filter(matches),'plugins')+'<p class="customize-muted">本地插件可使用当前配置的模型；登录 ChatGPT 后可浏览账号提供的云端目录。</p>';}
  const sourceErrors=customization.plugins?.marketplaceLoadErrors||[];const errors=[...customization.errors,...(customization.operationError?[customization.operationError]:[])].filter(Boolean);if(sourceErrors.length)body='<details class="customize-source-status"><summary>有 '+sourceErrors.length+' 个来源尚未同步；已安装插件仍可使用</summary><p>'+sourceErrors.map(error=>esc(error.marketplaceName||'插件来源')+'：'+esc(customizeError(error.message||error.error||'暂时无法读取'))).join('<br>')+'</p><button class="btn" data-customize-source-retry>重新同步来源</button></details>'+body;
  root.innerHTML=`<div class="customize-content"><header class="customize-heading"><div><h1>${isSkill?'技能':'插件'}</h1><p>${isSkill?'通过任务专用技能扩展 Eva':'连接插件，让 Eva 在你的各类工具中协同工作'}</p></div><div class="customize-toolbar"><label class="customize-search">${ic('search')}<input id="customize-search" placeholder="搜索${isSkill?'技能':'插件'}" value="${esc(query)}"/></label><button class="icon-btn" data-customize-refresh title="刷新" aria-label="刷新"${customization.loading?' disabled':''}>${ic('refresh')}</button><button class="icon-btn" data-customize-settings title="管理设置" aria-label="管理设置">${ic('gear')}</button><button class="customize-add" data-customize-add>添加${isSkill?'':ic('chevron')}</button></div></header>${errors.map(e=>`<p class="customize-error" role="alert">${esc(e)}</p>`).join('')}${customization.loading&&!customization[kind]&&!builtins.length?'<p class="customize-muted" role="status">正在读取目录…</p>':body}</div>`;
  root.scrollTop=top;
  if(customization.plugins?._raeSnapshot){const note=document.createElement('p');note.className='customize-muted';note.setAttribute('role','status');note.textContent='正在显示本地目录快照，在线更新完成后自动同步。';root.querySelector('.customize-content').prepend(note);}
  const search=root.querySelector('#customize-search');search.oninput=()=>{const caret=search.selectionStart;customization.query[kind]=search.value;customization.limit=120;renderCustomize();const next=document.getElementById('customize-search');next.focus();next.setSelectionRange(caret,caret);};
  root.querySelector('[data-customize-source-retry]')?.addEventListener('click',()=>loadCustomization(true,true));
  root.querySelector('[data-customize-refresh]').onclick=()=>{customization.operationError='';loadCustomization(true,true);};
  root.querySelectorAll('[data-customize-tab]').forEach(b=>b.onclick=()=>{customization.tab=b.dataset.customizeTab;customization.category=null;root.scrollTop=0;renderCustomize();});
  root.querySelectorAll('[data-customize-category]').forEach(b=>b.onclick=()=>{customization.category=b.dataset.customizeCategory||null;root.scrollTop=0;renderCustomize();});
  root.querySelectorAll('[data-customize-scope]').forEach(b=>b.onclick=()=>{customization.scope=b.dataset.customizeScope;renderCustomize();});
  root.querySelector('[data-customize-more]')?.addEventListener('click',()=>{customization.limit+=120;renderCustomize();});
  root.querySelector('[data-customize-settings]').onclick=()=>customizeManagement(kind);
  if(kind==='plugins')globalThis.EvaPluginAddHost?.mount(root.querySelector('[data-customize-add]'));
  else root.querySelector('[data-customize-add]').onclick=()=>customizeManagement(kind,true);
  bindCustomizeDetails(root);
  root.querySelectorAll('.customize-icon img').forEach(img=>img.onerror=()=>{img.parentElement.innerHTML=ic(isSkill?'codex':'plugin');});
  if(focused){search.focus();search.setSelectionRange(caret,caret);}
  root.onscroll=()=>scheduleCustomizeChinese();
  scheduleCustomizeChinese();
}
function bindCustomizeDetails(root) {
  root.querySelectorAll('.customize-icon img').forEach(img=>img.onerror=()=>{img.parentElement.innerHTML=ic(state.customize==='skills'?'codex':'plugin');});
  root.querySelectorAll('[data-customize-plugin]').forEach(b=>b.onclick=()=>customizeDetail(customizePlugins().find(p=>p.id===b.dataset.customizePlugin),'plugins'));
  root.querySelectorAll('[data-customize-skill]').forEach(b=>b.onclick=()=>customizeDetail(customizeSkills().find(s=>s.path===b.dataset.customizeSkill),'skills'));
  root.querySelectorAll('[data-customize-action]').forEach(b=>b.onclick=()=>{const skill=b.dataset.customizeAction==='skills',item=skill?customizeSkills().find(s=>s.path===b.dataset.customizeId):customizePlugins().find(p=>p.id===b.dataset.customizeId);if(!item)return;if(skill)customizeMutation('skills/config/write',{path:item.path,enabled:!item.enabled},item.enabled?'技能已停用':'技能已启用');else if(item.installed)customizeDetail(item,'plugins');else installCustomizePlugin(item);});
}
function customizeDetail(item,kind) {
  if(!item)return;
  if(kind==='plugins'){if(state.customize!=='plugins')openCustomize('plugins');openPluginDetail(item);return;}
  const skill=kind==='skills',description=customizeDescription(item);
  const scope={user:'个人技能',repo:'项目技能',system:'系统技能',admin:'管理员技能'};
  const {modal,close}=workspaceDialog(customizeName(item),`<div class="customize-detail">${customizeIcon(item,kind)}<p data-customize-full>${esc(description)}</p><dl><dt>状态</dt><dd>${skill?(item.enabled?'已启用':'未启用'):(item.installed?'已安装':'未安装')}</dd><dt>来源</dt><dd>${esc(skill?(item.pluginId?'插件附带技能':scope[item.scope]||'其他技能'):customizePersonal(item)?'个人插件来源':item.source?.type==='remote'?'公开插件目录':'本地插件来源')}</dd>${skill?`<dt>文件</dt><dd>${esc(item.path)}</dd>`:''}</dl>${skill?'<button class="btn" data-customize-reveal>在文件夹中显示</button>':''}<p class="customize-muted">仅修改 Eva 的独立配置。新会话使用最新设置；已打开会话可重启复刻应用后继续。</p><div class="provider-buttons">${skill?`<button class="btn primary" data-customize-use${!item.enabled?' disabled title="请先启用技能"':''}>使用技能</button>`:''}<button class="btn${skill?'':item.installed?' danger':' primary'}" data-customize-apply>${skill?(item.enabled?'停用技能':'启用技能'):item.installed?'卸载插件':'安装插件'}</button></div><p data-customize-status role="status"></p></div>`);
  modal.querySelector('[data-customize-use]')?.addEventListener('click',async e=>{const button=e.currentTarget;button.disabled=true;try{const result=await openSkillChat(item);if(result)close();else if(modal.isConnected){modal.querySelector('[data-customize-status]').textContent='未能准备技能草稿，请等待当前操作结束后重试';button.disabled=!item.enabled;}}catch(error){if(modal.isConnected){modal.querySelector('[data-customize-status]').textContent=customizeError(error);button.disabled=!item.enabled;}}});
  modal.querySelector('[data-customize-reveal]')?.addEventListener('click',()=>api.reveal(item.path).catch(e=>toast(shortError(e))));
  modal.querySelector('[data-customize-apply]').onclick=async e=>{e.currentTarget.disabled=true;modal.querySelector('[data-customize-status]').textContent='正在保存到复刻应用…';const done=skill?await customizeMutation('skills/config/write',{path:item.path,enabled:!item.enabled},item.enabled?'技能已停用':'技能已启用'):item.installed?await customizeMutation('plugin/uninstall',{pluginId:item.id},'插件已卸载'):await installCustomizePlugin(item);if(done)close();else e.target.disabled=false;};
  const long=item.interface?.longDescription||item.description||customizeRawDescription(item);
  if(long)modal.querySelector('[data-customize-full]').textContent=long;
  if(long&&customizeChinese.enabled)api.catalogChinese([{id:customizeTextId(item)+':full',name:customizeSourceName(item),description:long}]).then(result=>{const t=result[customizeTextId(item)+':full'];if(t&&modal.isConnected)modal.querySelector('[data-customize-full]').textContent=t.description;}).catch(()=>{if(modal.isConnected)modal.querySelector('[data-customize-status]').textContent='完整中文介绍暂时无法加载，请稍后重试';});
}
function customizeManagement(kind,add=false) {
  const skills=kind==='skills';
  const {modal}=workspaceDialog(add?(skills?'添加技能':'添加插件'):'自定义管理',`<p>插件、技能开关和缓存保存在本项目的独立配置目录中，不修改官方 Codex。</p><p class="customize-muted">默认显示来源提供的介绍。中文翻译按需使用已配置模型，可能产生用量；失败时保留原文。</p>${add&&!skills?'<label class="provider-field">插件来源（本地目录或 Git 仓库地址）<input class="input" data-customize-source placeholder="输入目录路径或 https://…"/></label><button class="btn primary" data-customize-source-add>添加来源</button><button class="btn" data-customize-source-pick>选择本地目录</button>':''}${add&&skills?'<p>选择包含 SKILL.md 的技能文件夹，将复制到复刻应用的个人技能目录。</p><button class="btn primary" data-customize-skill-import>选择技能文件夹并添加</button>':''}<div class="provider-buttons"><button class="btn" data-customize-location>打开独立配置目录</button><button class="btn" data-customize-restart>重启复刻应用</button><button class="btn" data-customize-translate>重试中文介绍</button></div><p data-customize-status role="status"></p>`);
  modal.querySelector('[data-customize-location]').onclick=()=>api.reveal(state.meta.codexHome).catch(e=>toast(customizeError(e)));
  modal.querySelector('[data-customize-restart]').onclick=()=>api.providersRestart().catch(e=>toast(customizeError(e)));
  modal.querySelector('[data-customize-translate]').onclick=()=>{customizeChinese.enabled=true;customizeChinese.error='';modal.querySelector('[data-customize-status]').textContent='正在请求中文翻译；原始介绍仍可使用';scheduleCustomizeChinese();};
  const addSource=async source=>{if(!source?.trim())return;modal.querySelector('[data-customize-status]').textContent='正在添加插件来源…';await customizeMutation('marketplace/add',{source:source.trim()},'插件来源已添加');};
  modal.querySelector('[data-customize-source-add]')?.addEventListener('click',()=>addSource(modal.querySelector('[data-customize-source]').value));
  modal.querySelector('[data-customize-source-pick]')?.addEventListener('click',async()=>addSource(await api.pickFolder()));
  modal.querySelector('[data-customize-skill-import]')?.addEventListener('click',async()=>{try{const folder=await api.pickFolder();if(!folder)return;await api.importSkill(folder);await loadCustomization(true);modal.querySelector('[data-customize-status]').textContent='技能已添加，仅对复刻应用生效';}catch(e){modal.querySelector('[data-customize-status]').textContent=customizeError(e);}});
}
function customizeError(error){const message=String(error?.message||error);if(/HTTP 402/i.test(message))return '中文翻译服务额度不足，当前显示原始介绍；可在设置中检查提供商';if(/[\u3400-\u9fff]/.test(message))return message.replace(/^Error invoking remote method '[^']+': Error: /,'');if(/not found|does not exist/i.test(message))return '未找到插件、技能或来源，请刷新目录后重试';if(/timed? out|network|fetch|connect/i.test(message))return '网络连接失败或超时，请检查网络后重试';if(/denied|forbidden|unauthorized|401|403/i.test(message))return '访问被拒绝，请检查登录状态和服务权限';return '操作失败，内核未能完成请求。请检查来源、网络和权限后重试';}
async function refreshCustomizationAfterMutation(){
  const scope=customizeScope(),cwds=[state.thread?.cwd||state.cwd].filter(Boolean);
  const [plugins,skills]=await Promise.all([api.call('plugin/installed',cwds.length?{cwds}:{}),api.call('skills/list',{...(cwds.length?{cwds}:{}),forceReload:true})]);
  if(scope!==customizeScope())throw Error('项目已切换，请在当前项目重新确认操作结果');
  // Installation state comes from the kernel's local inventory. A slow online
  // directory must not hold a successful local switch or uninstall open.
  const installed=new Map((plugins.marketplaces||[]).flatMap(m=>(m.plugins||[]).map(p=>[p.id,p]))),seen=new Set();
  const marketplaces=(customization.plugins?.marketplaces||[]).map(m=>({...m,plugins:(m.plugins||[]).map(p=>{seen.add(p.id);return installed.has(p.id)?{...p,...installed.get(p.id)}:{...p,installed:false,enabled:false};})}));
  for(const m of plugins.marketplaces||[]){const additions=(m.plugins||[]).filter(p=>!seen.has(p.id));if(additions.length)marketplaces.push({...m,plugins:additions});}
  customization.sequence++;customization.pending=null;customization.refreshQueued=false;
  customization.plugins={...(customization.plugins||{}),marketplaces};customization.skills=skills;customization.loadedScope=scope;customization.loadedAt=0;
  invalidatePluginDetailCache();renderCustomize();
  // Reconcile public metadata in the background, keeping local results usable.
  loadCustomization(true).catch(()=>{});
}
async function customizeMutation(method,params,success){
  if(customization.mutating){toast('正在处理上一项操作，请稍候');return false;}
  customization.mutating=true;customization.operationError='';
  try{const result=await api.call(method,params);if(typeof invalidateComposerReferences==='function')invalidateComposerReferences();await refreshCustomizationAfterMutation();if(method==='skills/config/write'&&result.effectiveEnabled!==params.enabled)throw Error('该技能受插件或管理员策略限制，未能切换到所选状态');customization.notice=success+'，仅对复刻应用生效';if(result?.appsNeedingAuth?.length)customization.operationError='插件已安装，所需服务仍需登录授权；请打开插件详情完成连接';return true;}
  catch(error){customization.operationError=customizeError(error);renderCustomize();return false;}
  finally{customization.mutating=false;}
}
function installCustomizePlugin(item){const params={pluginName:item.name};if(item.marketplace.path)params.marketplacePath=item.marketplace.path;else params.remoteMarketplaceName=item.marketplace.name;return customizeMutation('plugin/install',params,'插件已安装');}
function scheduleCustomizeChinese(){clearTimeout(customizeChinese.timer);customizeChinese.timer=setTimeout(loadCustomizeChinese,120);}
async function loadCustomizeChinese(){
  if(!state.customize||!customizeChinese.enabled||customizeChinese.busy||customizeChinese.error)return;
  const items=[],seen=new Set(),page=document.getElementById('customize-page');
  for(const node of document.querySelectorAll('#customize-page .customize-card-main, #customize-sidebar [data-customize-plugin]')){
    const rect=node.getBoundingClientRect();if(rect.bottom<0||rect.top>innerHeight+200)continue;
    const item=node.dataset.customizeSkill?customizeSkills().find(s=>s.path===node.dataset.customizeSkill):customizePlugins().find(p=>p.id===node.dataset.customizePlugin);if(!item)continue;
    const id=customizeTextId(item),description=customizeRawDescription(item);if(!description||customizeChinese.values[id]||seen.has(id))continue;seen.add(id);items.push({id,name:customizeSourceName(item),description});if(items.length>=24)break;
  }
  if(!items.length)return;
  customizeChinese.busy=true;
    try{const translated=await api.catalogChinese(items);Object.assign(customizeChinese.values,translated);if(items.some(i=>!translated[i.id]))customizeChinese.error='部分中文介绍尚未生成，请在管理中重试';if(state.customize)renderCustomize();}
  catch(error){customizeChinese.error=customizeError(error);if(state.customize)renderCustomize();}
  finally{customizeChinese.busy=false;if(state.customize&&!customizeChinese.error)scheduleCustomizeChinese();}
}

globalThis.addEventListener?.('eva:chatgpt-auth-changed',()=>{customization.loadedAt=0;if(state.customize)loadCustomization(true);});
