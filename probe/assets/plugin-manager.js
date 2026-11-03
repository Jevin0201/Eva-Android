'use strict';
// Protocol adapter for Eva 0.2.0 customize.js / plugin-detail.js.
// Catalog text is untrusted and rendered as text, never as executable markup.
window.evaPlugins=(()=>{
 const state={items:[],markets:[],errors:[],query:'',busy:false,loaded:false,notice:'',selected:null,detail:null,remote:false};
 let epoch=0;
 const scope=()=>({cwds:['/root/eva-workspace'+(active()?.projectId?'/projects/'+active().projectId:'')]});
 const name=p=>p.interface?.displayName||p.name||p.id;
 const description=p=>p.interface?.shortDescription||p.description||'';
 const readParams=p=>({pluginName:p.name,...(p.marketplace.path?{marketplacePath:p.marketplace.path}:{remoteMarketplaceName:p.marketplace.name})});
 const pendingTasks=()=>kernelBusy||[...(data.chats||[]),...(data.drafts||[])].some(c=>c.running);
 function collect(catalog,installed){
  const rows=new Map(),markets=new Map();
  for(const value of [catalog,installed])for(const m of value?.marketplaces||[]){markets.set(m.path||m.name,m);for(const p of m.plugins||[])rows.set(p.id,{...rows.get(p.id),...p,marketplace:{name:m.name,path:m.path}});}
  state.markets=[...markets.values()];state.items=[...rows.values()].sort((a,b)=>Number(b.installed)-Number(a.installed)||name(a).localeCompare(name(b)));
  state.errors=[...(catalog?.marketplaceLoadErrors||[]),...(installed?.marketplaceLoadErrors||[])].map(e=>e.message||String(e));
 }
 function draw(){
  if(settingPage!=='plugins')return;
  const list=state.items.filter(p=>[name(p),p.name,description(p),p.marketplace.name,...(p.keywords||[])].join(' ').toLowerCase().includes(state.query.toLowerCase()));
  const detail=state.detail,p=state.items.find(p=>p.id===state.selected),blocked=p&&(p.availability==='DISABLED_BY_ADMIN'||p.installPolicy==='NOT_AVAILABLE');
  let body=`<div class="eva-plugin-tools"><input class="extension-search" aria-label="搜索插件" id="plugin-search" value="${esc(state.query)}" placeholder="搜索插件"><button data-plugin-refresh ${state.busy?'disabled':''}>刷新</button><button data-plugin-remote ${state.busy?'disabled':''}>在线目录</button></div><p role="status" id="plugin-notice">${esc(state.busy?'正在处理…':state.notice)}</p>${state.errors.map(e=>`<p class="model-error">${esc(e)}</p>`).join('')}`;
  if(p){body+=settingGroup(name(p),`<p>${esc(description(p))}</p><p class="preview-label">来源：${esc(p.marketplace.name)}<br>版本：${esc(p.localVersion||p.version||'未提供')}<br>状态：${p.installed?(p.enabled?'已安装并启用':'已安装，已停用'):'未安装'}</p>${blocked?'<p class="model-error">当前账号或管理员策略不允许安装／使用此插件。</p>':''}<div class="plugin-toolbar">${p.installed?`<button data-plugin-toggle ${state.busy||blocked?'disabled':''}>${p.enabled?'停用':'启用'}</button><button data-plugin-uninstall ${state.busy?'disabled':''}>卸载</button>`:`<button data-plugin-install ${state.busy||blocked?'disabled':''}>安装插件</button>`}<button data-plugin-apply ${!p.installed||p.enabled===false||blocked?'disabled':''}>应用到对话</button><button data-plugin-close>返回列表</button></div>${detail?`<p style="white-space:pre-wrap">${esc(detail.description||'')}</p>${componentList('技能',detail.skills,s=>s.interface?.displayName||s.name)}${componentList('MCP 服务',detail.mcpServers,s=>s)}${componentList('应用连接',detail.apps,a=>a.name||a.id)}${componentList('事件钩子',detail.hooks,h=>h.eventName||h.name||'钩子')}<p class="preview-label">安装不等于依赖和服务授权已就绪。MCP 连接状态请到 MCP 管理查看。</p>`:'<p class="preview-label">详情尚未加载，可刷新重试。</p>'}`);}
  else{const card=p=>`<article class="eva-plugin-card"><button class="eva-plugin-main" data-plugin-id="${esc(p.id)}"><span class="eva-plugin-logo">${extensionPluginLogo(p)}</span><span class="extension-copy"><strong>${esc(name(p))}</strong><small>${esc(description(p)||'暂无介绍')}</small></span></button><button class="eva-plugin-action" data-plugin-id="${esc(p.id)}" aria-label="${p.installed?'管理':'查看并安装'} ${esc(name(p))}">${p.installed?'···':'+'}</button></article>`;const builtins=[['browser','本地浏览器','在内置浏览器中打开网页、读取内容和操作页面','browser'],['excel','Excel','创建与读取表格 · 查看办公依赖状态','office-runtime'],['pdf','PDF','读取、生成与合并 PDF · 查看办公依赖状态','office-runtime'],['ppt','PPT','创建与修改演示文稿 · 查看办公依赖状态','office-runtime'],['word','Word','创建与修改文档 · 查看办公依赖状态','office-runtime']].filter(x=>(x[1]+' '+x[2]).toLowerCase().includes(state.query.toLowerCase()));const section=(title,items)=>items.length?`<section class="eva-plugin-section"><h3>${title}</h3><div class="eva-plugin-grid">${items.map(card).join('')}</div></section>`:'';body+=`<section class="eva-plugin-section"><h3>Eva 内置 · 无需登录 ChatGPT</h3><div class="eva-plugin-grid">${builtins.map(x=>`<article class="eva-plugin-card"><button class="eva-plugin-main" data-builtin-open="${x[3]}"><span class="eva-plugin-logo">${evaBuiltinArtwork[x[0]]}</span><span class="extension-copy"><strong>${x[1]}</strong><small>${x[2]}</small></span></button><button class="eva-plugin-native-label" data-builtin-apply="${x[3]}" data-builtin-name="${x[1]}">应用到对话</button></article>`).join('')}</div></section>`+section('已安装',list.filter(p=>p.installed))+section('可添加',list.filter(p=>!p.installed));if(!list.length)body+=`<p class="preview-label">${state.loaded?'没有匹配的插件。可加载在线目录或添加来源。':'正在读取插件…'}</p>`;}
  body+='<details class="extension-add"><summary>管理插件来源</summary>'+settingGroup('插件来源',`<label class="field">Git HTTPS 地址或手机工作区内路径<input id="plugin-source" placeholder="https://… 或 /root/eva-workspace/…"></label><button data-plugin-source-add ${state.busy?'disabled':''}>添加来源</button>${state.markets.map((m,i)=>`<div class="row"><span class="copy"><b>${esc(m.interface?.displayName||m.name)}</b><small>${esc(m.path||'在线目录')}</small></span>${m.path?`<button data-plugin-upgrade="${i}" ${state.busy?'disabled':''}>更新</button>`:''}</div>`).join('')}`)+'</details>';
  $('#screen').innerHTML=`<header class="app-head">${control('back','返回','settings-back')}<strong>技能与插件</strong><button class="eva-plugin-add" data-plugin-add>添加 ＋</button></header><div class="flow eva-customize">${extensionTabs('plugins')}<p class="eva-customize-intro">连接插件，让 Eva 在你的各类工具中协同工作</p>${body}</div>`;
  document.querySelectorAll('[data-builtin-apply]').forEach(b=>b.onclick=()=>window.evaReferences?.apply({kind:'builtin',name:b.dataset.builtinName,path:b.dataset.builtinApply}));
  document.querySelectorAll('[data-builtin-open]').forEach(b=>b.onclick=()=>EvaHost.open(b.dataset.builtinOpen));$('[data-plugin-add]').onclick=()=>{const source=$('.extension-add');source.open=true;source.scrollIntoView({block:'start',behavior:'smooth'});$('#plugin-source').focus()};
  $('#plugin-search').oninput=e=>{state.query=e.target.value;const pos=e.target.selectionStart;draw();$('#plugin-search').focus();$('#plugin-search').setSelectionRange(pos,pos);};
  $('[data-plugin-refresh]').onclick=()=>load(state.remote,true);$('[data-plugin-remote]').onclick=()=>load(true,true);
  document.querySelectorAll('[data-plugin-id]').forEach(b=>b.onclick=()=>select(b.dataset.pluginId));
  $('[data-plugin-apply]')?.addEventListener('click',()=>window.evaReferences?.apply({kind:'plugin',name:name(p),path:'plugin://'+p.id,description:description(p)}));
  $('[data-plugin-close]')?.addEventListener('click',()=>{state.selected=null;state.detail=null;draw();});
  $('[data-plugin-install]')?.addEventListener('click',()=>mutate('plugin/install',{...readParams(p),installAttemptId:crypto.randomUUID()},p.id,'install'));
  $('[data-plugin-toggle]')?.addEventListener('click',()=>mutate('config/value/write',{keyPath:'plugins.'+JSON.stringify(p.id)+'.enabled',value:!p.enabled,mergeStrategy:'replace'},p.id,!p.enabled?'enable':'disable'));
  $('[data-plugin-uninstall]')?.addEventListener('click',()=>{if(confirm('卸载插件“'+name(p)+'”？'))mutate('plugin/uninstall',{pluginId:p.id},p.id,'uninstall');});
  $('[data-plugin-source-add]').onclick=()=>{const source=$('#plugin-source').value.trim();if(!/^https:\/\/[^\s]+$/.test(source)&&(!/^\/root\/eva-workspace\/[^\0\r\n]+$/.test(source)||source.split('/').includes('..'))){state.notice='请输入 Git HTTPS 地址或手机工作区内的绝对路径。';draw();return;}mutate('marketplace/add',{source},null,'source');};
  document.querySelectorAll('[data-plugin-upgrade]').forEach(b=>b.onclick=()=>mutate('marketplace/upgrade',{marketplaceName:state.markets[Number(b.dataset.pluginUpgrade)].name},null,'upgrade'));
 }
 function componentList(title,rows,label){return rows?.length?`<h4>${esc(title)}</h4><ul>${rows.map(x=>`<li>${esc(label(x))}</li>`).join('')}</ul>`:'';}
 async function requestCatalog(remote,refresh){
  const installed=await (window.evaCapabilityReads?evaCapabilityReads.read('plugin/installed',scope(),refresh):kernelCall('plugin/installed',scope()));
  try{const catalog=await kernelCall('plugin/list',{...scope(),...(remote?{}:{marketplaceKinds:['local']}),forceRefetch:!!refresh&&remote});return {catalog,installed};}
  catch(e){return {catalog:{marketplaces:[],marketplaceLoadErrors:[{message:'目录读取失败：'+e.message}]},installed};}
 }
 async function load(remote=false,refresh=false){
  if(state.busy)return;const mine=++epoch;state.busy=true;state.notice='';state.remote=remote;draw();
  try{const {catalog,installed}=await requestCatalog(remote,refresh);if(mine!==epoch)return;collect(catalog,installed);state.loaded=true;if(state.selected)await readDetail(state.selected);}
  catch(e){state.notice='插件读取失败：'+e.message;}
  finally{if(mine===epoch){state.busy=false;draw();}}
 }
 async function readDetail(id){const p=state.items.find(p=>p.id===id);if(!p){state.selected=null;state.detail=null;return;}const result=await kernelCall('plugin/read',readParams(p));if(!result.plugin?.summary)throw Error('插件详情为空');state.detail=result.plugin;}
 async function select(id){if(state.busy)return;state.selected=id;state.detail=null;state.busy=true;state.notice='';draw();try{await readDetail(id);}catch(e){state.notice='详情读取失败：'+e.message;}finally{state.busy=false;draw();}}
 async function mutate(method,params,id,action){
  if(state.busy)return;if(pendingTasks()){state.notice='请先完成或停止当前任务，再修改插件。';draw();return;}
  state.busy=true;state.notice='';draw();
  try{
   const result=await kernelCall(method,params),{catalog,installed}=await requestCatalog(state.remote,true);collect(catalog,installed);window.evaReferences?.invalidate();state.loaded=true;
   const current=state.items.find(p=>p.id===id);
   if(action==='install'&&!current?.installed)throw Error('安装请求已返回，但内核尚未确认插件已安装；请刷新核对，不要重复安装。');
   if(action==='enable'&&!current?.enabled||action==='disable'&&current?.enabled)throw Error('内核返回的启停状态与请求不一致，可能受策略限制。');
   if(action==='uninstall'&&current?.installed)throw Error('内核仍报告插件已安装，请刷新核对。');
   if(result.errors?.length)throw Error(result.errors.map(e=>e.message).join('；'));
   state.notice=({install:'插件已安装',enable:'插件已启用',disable:'插件已停用',uninstall:'插件已卸载',source:'来源已添加',upgrade:'来源已更新'})[action]+'；新任务使用更新后的配置。';
   if(result.appsNeedingAuth?.length)state.notice+=' 仍需连接：'+result.appsNeedingAuth.map(a=>a.name||a.id).join('、')+'。';
   loadedKernelThreads.clear();if(state.selected)await readDetail(state.selected);
  }catch(e){state.notice='操作未完整确认：'+e.message;}
  finally{state.busy=false;draw();}
 }
 const previousSettings=settingsGo;settingsGo=function(page){if(page==='extensions')page='plugins';if(settingPage==='skills'&&page!=='skills'&&!window.skillManager.canLeave())return;if(page==='plugins'){settingPage='plugins';$('#phone').classList.remove('drawer-open');draw();load();return;}previousSettings(page);};
 return {open:()=>settingsGo('plugins'),load,state};
})();
