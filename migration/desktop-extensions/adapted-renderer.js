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
    const remoteRequest=(async()=>{const signedIn=await cloudAuth.check().catch(error=>{customization.errors.push('账号状态：'+customizeError(error));return true});if(epoch!==customization.sequence)return;customization.chatgptSignedIn=signedIn;await receive('plugins','plugin/list',{...cwdParams,forceRefetch:refreshRemote,...(!signedIn?{marketplaceKinds:['local']}: {})});})();
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
  const {modal,close}=workspaceDialog(customizeName(item),`<div class="customize-detail">${customizeIcon(item,kind)}<p data-customize-full>${esc(description)}</p><dl><dt>状态</dt><dd>${skill?(item.enabled?'已启用':'未启用'):(item.installed?'已安装':'未安装')}</dd><dt>来源</dt><dd>${esc(skill?(item.pluginId?'插件附带技能':scope[item.scope]||'其他技能'):customizePersonal(item)?'个人插件来源':item.source?.type==='remote'?'公开插件目录':'本地插件来源')}</dd>${skill?`<dt>文件</dt><dd>${esc(item.path)}</dd>`:''}</dl>${skill?'<button class="btn" data-customize-reveal>在文件夹中显示</button>':''}<p class="customize-muted">仅修改 Eva 的独立配置。新会话使用最新设置；已打开会话可刷新扩展配置后继续。</p><div class="provider-buttons">${skill?`<button class="btn primary" data-customize-use${!item.enabled?' disabled title="请先启用技能"':''}>使用技能</button>`:''}<button class="btn${skill?'':item.installed?' danger':' primary'}" data-customize-apply>${skill?(item.enabled?'停用技能':'启用技能'):item.installed?'卸载插件':'安装插件'}</button></div><p data-customize-status role="status"></p></div>`);
  modal.querySelector('[data-customize-use]')?.addEventListener('click',async e=>{const button=e.currentTarget;button.disabled=true;try{const result=await openSkillChat(item);if(result)close();else if(modal.isConnected){modal.querySelector('[data-customize-status]').textContent='未能准备技能草稿，请等待当前操作结束后重试';button.disabled=!item.enabled;}}catch(error){if(modal.isConnected){modal.querySelector('[data-customize-status]').textContent=customizeError(error);button.disabled=!item.enabled;}}});
  modal.querySelector('[data-customize-reveal]')?.addEventListener('click',()=>api.reveal(item.path).catch(e=>toast(shortError(e))));
  modal.querySelector('[data-customize-apply]').onclick=async e=>{e.currentTarget.disabled=true;modal.querySelector('[data-customize-status]').textContent='正在保存到复刻应用…';const done=skill?await customizeMutation('skills/config/write',{path:item.path,enabled:!item.enabled},item.enabled?'技能已停用':'技能已启用'):item.installed?await customizeMutation('plugin/uninstall',{pluginId:item.id},'插件已卸载'):await installCustomizePlugin(item);if(done)close();else e.target.disabled=false;};
  const long=item.interface?.longDescription||item.description||customizeRawDescription(item);
  if(long)modal.querySelector('[data-customize-full]').textContent=long;
  if(long&&customizeChinese.enabled)api.catalogChinese([{id:customizeTextId(item)+':full',name:customizeSourceName(item),description:long}]).then(result=>{const t=result[customizeTextId(item)+':full'];if(t&&modal.isConnected)modal.querySelector('[data-customize-full]').textContent=t.description;}).catch(()=>{if(modal.isConnected)modal.querySelector('[data-customize-status]').textContent='完整中文介绍暂时无法加载，请稍后重试';});
}
function customizeManagement(kind,add=false) {
  const skills=kind==='skills';
  const {modal}=workspaceDialog(add?(skills?'添加技能':'添加插件'):'自定义管理',`<p>插件、技能开关和缓存保存在本项目的独立配置目录中，不修改官方 Codex。</p><p class="customize-muted">默认显示来源提供的介绍。中文翻译按需使用已配置模型，可能产生用量；失败时保留原文。</p>${add&&!skills?'<label class="provider-field">插件来源（本地目录或 Git 仓库地址）<input class="input" data-customize-source placeholder="输入目录路径或 https://…"/></label><button class="btn primary" data-customize-source-add>添加来源</button><button class="btn" data-customize-source-pick>选择本地目录</button>':''}${add&&skills?'<p>选择包含 SKILL.md 的技能文件夹，将复制到复刻应用的个人技能目录。</p><button class="btn primary" data-customize-skill-import>选择技能文件夹并添加</button>':''}<div class="provider-buttons"><button class="btn" data-customize-location>打开独立配置目录</button><button class="btn" data-customize-restart>刷新扩展配置</button><button class="btn" data-customize-translate>重试中文介绍</button></div><p data-customize-status role="status"></p>`);
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

/* Plugin details use the kernel's full PluginDetail contract, not catalog placeholders. */
function pluginComposerInput(text){
  const mentions=[],seen=new Set();
  const clean=text.replace(/\[@([^\]\r\n]+)\]\((plugin:\/\/[^\s)]+)\)/g,(_all,name,path)=>{if(!seen.has(path)){seen.add(path);mentions.push({type:'mention',name,path});}return '@'+name;});
  return [{type:'text',text:clean,text_elements:[]},...mentions];
}
function pluginReadParams(item){return {pluginName:item.marketplace?.path?item.name:item.remotePluginId||item.id,...(item.marketplace?.path?{marketplacePath:item.marketplace.path}:{remoteMarketplaceName:item.marketplace?.name})};}
const pluginDetailCache=new Map();
function invalidatePluginDetailCache(){pluginDetailCache.clear();}
function readPluginDetail(item){
  const params=pluginReadParams(item),key=JSON.stringify([customizeScope(),params,item.id,item.localVersion,item.version,item.installed,item.enabled]);
  const existing=pluginDetailCache.get(key);if(existing&&Date.now()<existing.expires)return existing.promise;
  const cached={expires:Date.now()+30000};
  cached.promise=api.call('plugin/read',params).then(response=>{if(!response.plugin?.summary)throw Error('插件详情为空');return response;}).catch(error=>{if(pluginDetailCache.get(key)===cached)pluginDetailCache.delete(key);throw error;});
  pluginDetailCache.set(key,cached);while(pluginDetailCache.size>32)pluginDetailCache.delete(pluginDetailCache.keys().next().value);return cached.promise;
}
async function openPluginDetail(item){
  const page=document.getElementById('customize-page');
  const entry={item,loading:true,scroll:customization.detail?.scroll??page.scrollTop};
  customization.detail=entry;page.scrollTop=0;renderCustomize();
  try{const response=await readPluginDetail(item);entry.data=response.plugin;entry.item={...item,...response.plugin.summary};}
  catch(error){entry.error=customizeError(error);}
  finally{entry.loading=false;if(customization.detail===entry&&state.customize)renderCustomize();}
  if(entry.data&&customizeChinese.enabled)translatePluginDetail(entry);
}
function backPluginCatalog(){const top=customization.detail?.scroll||0;customization.detail=null;renderCustomize();document.getElementById('customize-page').scrollTop=top;}
async function translatePluginDetail(entry){
  const d=entry.data,s=entry.item,f=s.interface||{},items=[];
  const add=(id,text)=>{if(text&&!isChineseCatalogText(text))items.push({id,name:customizeSourceName(s),description:text});};
  add(s.id+':detail',d.description||f.longDescription||f.shortDescription);
  (f.defaultPrompt||[]).forEach((text,i)=>add(s.id+':prompt:'+i,text));
  for(const skill of d.skills||[]){const id=customizeTextId(skill),description=customizeRawDescription(skill);if(description&&!customizeChinese.values[id])items.push({id,name:customizeSourceName(skill),description});}
  if(!items.length)return;
  try{entry.translated={};for(let offset=0;offset<items.length;offset+=30){Object.assign(entry.translated,await api.catalogChinese(items.slice(offset,offset+30)));for(const skill of d.skills||[]){const id=customizeTextId(skill);if(entry.translated[id])customizeChinese.values[id]=entry.translated[id];}if(customization.detail!==entry||!state.customize)break;renderCustomize();}}
  catch{entry.translationError=true;if(customization.detail===entry&&state.customize)renderCustomize();}
}
function pluginDetailText(entry,id,text){return entry.translated?.[id]?.description||text||'暂无介绍';}
function renderPluginDetail(root){
  const entry=customization.detail,item=entry.item,d=entry.data,f=item.interface||{},name=customizeName(item);
  document.querySelectorAll('.customize-installed').forEach(b=>b.classList.toggle('selected',b.dataset.customizePlugin===item.id));
  root.innerHTML=`<nav class="plugin-breadcrumb" aria-label="插件导航"><button data-plugin-back>插件</button>${ic('chevronRight')}<span>${esc(name)}</span></nav><div class="plugin-detail-page">${entry.loading?'<p role="status" class="customize-muted">正在读取插件详情…</p>':entry.error?`<p role="alert" class="customize-error">${esc(entry.error)}</p><button class="btn" data-plugin-retry>重新加载</button>`:pluginDetailBody(entry)}</div>`;
  root.querySelector('[data-plugin-back]').onclick=backPluginCatalog;
  root.querySelector('[data-plugin-retry]')?.addEventListener('click',()=>openPluginDetail(item));
  if(!d)return;
  root.querySelector('[data-plugin-manage]').onclick=()=>managePluginDetail(entry);
  root.querySelector('[data-plugin-more]').onclick=()=>managePluginDetail(entry);
  root.querySelector('[data-plugin-try]').onclick=()=>tryPluginDetail(entry);
  root.querySelectorAll('[data-plugin-prompt]').forEach(b=>b.onclick=()=>tryPluginDetail(entry,Number(b.dataset.pluginPrompt)));
  root.querySelectorAll('[data-plugin-skill]').forEach(b=>b.onclick=()=>previewPluginSkill(entry,d.skills[Number(b.dataset.pluginSkill)]));
  root.querySelectorAll('[data-plugin-link]').forEach(b=>b.onclick=()=>api.openExternal(b.dataset.pluginLink).catch(e=>toast(customizeError(e))));
  root.querySelector('[data-plugin-translate]')?.addEventListener('click',()=>{entry.translationError=false;translatePluginDetail(entry);});
  root.querySelectorAll('.customize-icon img').forEach(img=>img.onerror=()=>{img.parentElement.innerHTML=ic('plugin');});
}
function pluginDetailBody(entry){
  const d=entry.data,s=entry.item,f=s.interface||{},name=customizeName(s),prompts=(f.defaultPrompt||[]).filter(Boolean).slice(0,3);
  const shots=[...(f.screenshots||[]).map(mediaUrl),...(f.screenshotUrls||[]).filter(u=>/^https?:\/\//i.test(u))];
  const label={skills:'技能',Interactive:'交互',Write:'写入',Read:'读取',Other:'其他','Developer Tools':'开发工具',Productivity:'效率',Communication:'沟通',Data:'数据'};
  const policy=s.installPolicy==='NOT_AVAILABLE'||s.availability==='DISABLED_BY_ADMIN';
  const link=(text,url)=>/^https?:\/\//i.test(url||'')?`<button class="plugin-info-link" data-plugin-link="${esc(url)}">${text}${ic('external')}</button>`:'不可用';
  const rows=[['功能',(f.capabilities||[]).map(c=>label[c]||c).join('、')||'未提供'],['开发者',f.developerName||'未提供'],['类别',label[f.category]||f.category||'其他'],['版本',s.localVersion||s.version||'未提供']];
  return `${customizeIcon(s)}<header class="plugin-detail-heading"><div><h1>${esc(name)}</h1><p>由 ${esc(f.developerName||'未知开发者')} 提供</p></div><div class="plugin-detail-actions"><button class="icon-btn" data-plugin-more aria-label="更多操作">${ic('more')}</button><button class="btn" data-plugin-manage>${ic('gear')}管理</button><button class="customize-add" data-plugin-try ${policy?'disabled':''}>${ic('chat')}${s.installed?'立即试用':'安装并试用'}</button></div></header>${policy?'<p class="customize-error">当前账户或管理策略不允许使用此插件。</p>':''}${prompts.length||shots.length?`<section class="plugin-preview" aria-label="插件使用示例">${shots[0]?`<img class="plugin-preview-background" src="${esc(shots[0])}" alt="插件预览"/>`:''}<div class="plugin-prompts">${prompts.map((p,i)=>`<button data-plugin-prompt="${i}" ${policy?'disabled':''}><span><strong>${esc(name)}</strong> ${esc(pluginDetailText(entry,s.id+':prompt:'+i,p))}</span><span class="plugin-prompt-arrow">${ic('arrowRight')}</span></button>`).join('')}</div></section>`:''}<p class="plugin-description">${esc(pluginDetailText(entry,s.id+':detail',d.description||f.longDescription||f.shortDescription))}</p>${entry.translationError?'<p class="customize-muted">翻译未完成，当前显示原始介绍。<button class="btn" data-plugin-translate>重试翻译</button></p>':''}${d.skills?.length?`<section class="plugin-detail-section"><h2>技能 <small>${d.skills.length}</small></h2><div class="customize-grid">${d.skills.map((skill,i)=>`<button class="customize-card-main plugin-skill" data-plugin-skill="${i}">${customizeIcon(skill,'skills')}<span class="customize-card-copy"><strong>${esc(customizeName(skill))}</strong><span>${esc(customizeDescription(skill))}</span></span></button>`).join('')}</div></section>`:''}${d.apps?.length?`<section class="plugin-detail-section"><h2>应用 <small>${d.apps.length}</small></h2><p class="customize-muted">服务授权状态由内核检查；安装插件不代表服务已授权。</p>${d.apps.map(app=>`<div class="plugin-resource"><strong>${esc(app.name)}</strong>${link('连接与管理',app.installUrl)}</div>`).join('')}</section>`:''}${d.mcpServers?.length?`<section class="plugin-detail-section"><h2>MCP 服务</h2>${d.mcpServers.map(server=>`<p>${esc(typeof server==='string'?server:server.name)}</p>`).join('')}</section>`:''}${d.hooks?.length?`<section class="plugin-detail-section"><h2>钩子 <small>${d.hooks.length}</small></h2><p class="customize-muted">此插件包含运行事件钩子，执行由独立内核管理。</p></section>`:''}<section class="plugin-detail-section"><h2>信息</h2><dl class="plugin-information">${rows.map(([k,v])=>`<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}<dt>网站</dt><dd>${link('访问网站',f.websiteUrl)}</dd>${f.privacyPolicyUrl?`<dt>隐私政策</dt><dd>${link('查看隐私政策',f.privacyPolicyUrl)}</dd>`:''}${f.termsOfServiceUrl?`<dt>服务条款</dt><dd>${link('查看服务条款',f.termsOfServiceUrl)}</dd>`:''}</dl></section>`;
}
function managePluginDetail(entry){
  const item=entry.item,{modal,close}=workspaceDialog('管理 '+customizeName(item),`<p>状态：${item.installed?(item.enabled?'已安装并启用':'已安装，已停用'):'未安装'}</p><p class="customize-muted">更改仅保存到复刻版独立配置。服务账户授权由对应服务管理。</p>${item.installed?'<button class="btn" data-plugin-toggle>'+ (item.enabled?'停用插件':'启用插件')+'</button><button class="btn danger" data-plugin-remove>卸载插件</button>':'<button class="btn primary" data-plugin-install>安装插件</button>'}<p role="status" data-plugin-status></p>`);
  const apply=async(fn)=>{modal.querySelectorAll('button').forEach(b=>b.disabled=true);const ok=await fn();if(ok){close();const latest=customizePlugins().find(p=>p.id===item.id);if(latest)openPluginDetail(latest);else backPluginCatalog();}else modal.querySelectorAll('button').forEach(b=>b.disabled=false);};
  modal.querySelector('[data-plugin-remove]')?.addEventListener('click',()=>apply(()=>customizeMutation('plugin/uninstall',{pluginId:item.id},'插件已卸载')));
  modal.querySelector('[data-plugin-install]')?.addEventListener('click',()=>apply(()=>installCustomizePlugin(item)));
  modal.querySelector('[data-plugin-toggle]')?.addEventListener('click',()=>apply(()=>customizeMutation('config/value/write',{keyPath:'plugins.'+JSON.stringify(item.id)+'.enabled',value:!item.enabled,mergeStrategy:'replace'},item.enabled?'插件已停用':'插件已启用')));
}
async function previewPluginSkill(entry,skill){
  const {modal}=workspaceDialog(customizeName(skill),'<div class="plugin-skill-preview"><p role="status">正在读取技能内容…</p></div>');
  const body=modal.querySelector('.plugin-skill-preview');
  try{
    let contents;
    if(skill.path){const file=await api.readFile(skill.path);if(file.kind!=='text')throw Error('技能文件不是可读取的文本');contents=file.text;}
    else if(entry.item.remotePluginId){contents=(await api.call('plugin/skill/read',{remoteMarketplaceName:entry.item.marketplace.name,remotePluginId:entry.item.remotePluginId,skillName:skill.name})).contents;}
    if(!contents)throw Error('当前插件没有提供该技能内容');
    if(!modal.isConnected)return;
    const live=customizeSkills().find(s=>s.path===skill.path);
    body.innerHTML=`<div class="plugin-skill-controls">${live?`<button class="btn" data-skill-toggle>${live.enabled?'停用技能':'启用技能'}</button>`:''}</div><p class="customize-muted">以下为实际 SKILL.md 内容，专业指令保留原文。</p><div class="md plugin-skill-content">${renderMarkdown(contents)}</div>`;
    body.querySelector('[data-skill-toggle]')?.addEventListener('click',async e=>{e.currentTarget.disabled=true;if(await customizeMutation('skills/config/write',{path:live.path,enabled:!live.enabled},live.enabled?'技能已停用':'技能已启用'))closeModal();else e.target.disabled=false;});
  }catch(error){if(modal.isConnected)body.innerHTML=`<p role="alert" class="customize-error">${esc(customizeError(error))}</p><button class="btn" data-skill-retry>重新读取</button>`;body.querySelector('[data-skill-retry]')?.addEventListener('click',()=>{closeModal();previewPluginSkill(entry,skill);});}
}
async function tryPluginDetail(entry,index){
  let item=entry.item;
  if(!item.installed){if(!await installCustomizePlugin(item))return;item=customizePlugins().find(p=>p.id===item.id)||item;}
  if(!item.enabled){toast('请先在管理中启用插件');return;}
  const prompts=item.interface?.defaultPrompt||[],original=index==null?prompts[0]||'':prompts[index]||'';
  const prompt=entry.translated?.[item.id+':prompt:'+(index??0)]?.description||original;
  await openPluginChat(item,prompt);
}

// Lazy local integration; opening Customize must not load the original UI at startup.
(()=>{
 let loading,host,target,epoch=0;
 const fail=error=>toast(error?.message||String(error),7000);
 async function draft(prompt){
  if(state.pendingSend||state.loadingThread)throw Error('当前消息正在处理，请稍后再创建插件');
  const cwd=state.thread?(state.thread.projectless?null:state.thread.cwd):state.cwd;
  startNewThread(cwd,{ephemeral:false});
  if(state.activeThreadId||state.pendingSend)throw Error('无法准备新聊天');
  els.input.value=prompt;state.composerMentions=[];renderComposer();autosize();globalThis.composerDrafts?.save();els.input.focus();
 }
 function recorder(){return {activeProject:null,availablePlugins:customizePlugins().map(plugin=>({plugin,marketplaceName:plugin.marketplace.name,displayName:customizeName(plugin)}))};}
 async function load(){
  if(host)return host;
  if(!loading)loading=(async()=>{
   await Promise.all([
    new Promise((resolve,reject)=>{const link=document.createElement('link');link.rel='stylesheet';link.href='native-plugin-add/host-adapter.css';link.onload=resolve;link.onerror=()=>{link.remove();reject(Error('插件运行环境样式加载失败'));};document.head.append(link);}),
    new Promise((resolve,reject)=>{const link=document.createElement('link');link.rel='stylesheet';link.href='native-plugin-add/controls.css';link.onload=resolve;link.onerror=()=>{link.remove();reject(Error('插件控件样式加载失败'));};document.head.append(link);}),
    new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='native-plugin-add/bundle.js';script.onload=resolve;script.onerror=()=>{script.remove();reject(Error('插件控件加载失败'));};document.head.append(script);})]);
   host=EvaNativePluginAdd.createPluginAddHost({onError:fail,openExternal:value=>api.openExternal(typeof value==='string'?value:value.url||value.href),
    refresh:refreshCustomizationAfterMutation,
    addMarketplace:params=>api.localPluginAuthoring('addMarketplace',params),
    importArchive:file=>api.importPluginFile(file),createMcp:params=>api.localPluginAuthoring('createMcp',params),onMcpCreated:async result=>{await refreshCustomizationAfterMutation();toast(result.requiresAuthorization?'MCP 已保存到本地设置，仍需在 MCP 设置中完成服务器授权。':'MCP 已保存到本地设置。');if(result.reloadError)fail(new Error(result.reloadError));},
    recorder,openRecorder:draft,
    enablePlugin:async id=>{await api.call('config/value/write',{keyPath:'plugins.'+JSON.stringify(id)+'.enabled',value:true,mergeStrategy:'replace'});await refreshCustomizationAfterMutation();},
    installRecorder:async({plugin})=>{const params={pluginName:plugin.name,...(plugin.marketplace.path?{marketplacePath:plugin.marketplace.path}:{remoteMarketplaceName:plugin.marketplace.name})};await api.call('plugin/install',params);await refreshCustomizationAfterMutation();},
    createPlugin:async()=>{const creator=customizePlugins().find(p=>p.name==='plugin-creator'&&p.installed&&p.enabled);if(creator){await openPluginChat(creator,'帮我创建一个可在 Eva 本地安装的插件。');return;}await draft('帮我创建一个可在 Eva 本地安装的插件。先确认我需要连接的工具与功能，使用当前配置的模型完成插件目录和清单。');}
   });document.querySelectorAll('.eva-native-plugin-add').forEach(n=>n.dataset.theme=$('#phone').classList.contains('dark')?'dark':'light');return host;
  })().catch(error=>{loading=null;throw error;});
  return loading;
 }
 globalThis.EvaPluginAddHost={mount(button){if(!button)return;const current=++epoch;
  // Replace the legacy button, so the original button is never nested inside it.
  const anchor=document.createElement('span');anchor.className='eva-native-plugin-add';anchor.dataset.pluginAddAnchor='';button.replaceWith(anchor);target=anchor;
  load().then(value=>{if(current===epoch&&target?.isConnected)value.mount(target);}).catch(fail);
 },detach(){epoch++;target=null;host?.detach();}};
})();


