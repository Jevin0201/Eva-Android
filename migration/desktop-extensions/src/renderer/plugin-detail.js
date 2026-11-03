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
