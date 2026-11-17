'use strict';
(()=>{
 let epoch=0,busy=false,query='',filter='all';
 let draft={name:'',kind:'http',address:'',args:'[]',replace:false};
 const call=p=>kernelCall('android/mcp',p);
 const live=(id,root)=>id===epoch&&settingPage==='mcp'&&root?.isConnected;
 const oauth=new EvaMcpAuthLifecycle((method,params)=>kernelCall(method,params||{}),value=>{if(settingPage==='mcp')notice(value.message);});
 function notice(text,root=document.querySelector('#mcp-page')){const el=root?.querySelector('#mcp-notice');if(el)el.textContent=text;}
 function lock(root,value){root?.querySelectorAll('button,input,select,textarea').forEach(el=>{el.disabled=value;});root?.setAttribute('aria-busy',String(value));}
 function formatStatus(r){const runtime=typeof r.runtimeStatus==='string'?r.runtimeStatus:r.runtimeStatus?.type;const state=({connected:'已连接',connecting:'连接中',disconnected:'未连接',failed:'连接失败',error:'连接失败',disabled:'已停用'})[runtime]||'连接状态未知';const auth=({authorized:'已授权',authenticated:'已授权',notLoggedIn:'未授权',unauthorized:'未授权',unsupported:'无需此类授权',pending:'等待授权',oAuth:'OAuth 已授权',bearerToken:'密钥已授权'})[r.authStatus]||'授权状态未知';return `${state} · 授权：${auth} · 工具：${Object.keys(r.tools||{}).join('、')||'未发现'}${r.toolsError?' · 工具发现失败':''}`;}
 function panel(title){const p=modelPanel(title);p.classList.add('eva-desktop-dialog');return p;}
 async function mutation(fn,id,root,surface){
  if(busy||!live(id,root))return;
  busy=true;lock(root,true);lock(surface,true);notice('正在处理…',root);
  const status=text=>{notice(text,root);if(surface?.isConnected){const el=surface.querySelector('[data-mcp-notice]');if(el)el.textContent=text;}};
  try{
   const result=await fn();if(!live(id,root))return;
   if(result?.loggedOut)status('已退出此连接的本地授权。');
   else if(result?.credentialOpened)status('已打开原生密钥设置；返回后刷新列表。');
   else if(result?.opened)status('已打开 Eva 浏览器授权；完成后返回并测试连接。');
   else if(result?.keep)status(result.message||'检查完成，请查看结果。');
   else{if(surface?.isConnected)closeModelPanel();await open();notice('已保存并请求重载；请测试连接确认可用性。');}
  }catch(e){if(live(id,root))status('操作失败：'+e.message);}
  finally{busy=false;if(settingPage==='mcp')lock(document.querySelector('#mcp-page'),false);if(surface?.isConnected)lock(surface,false);}
 }
 function management(id,root){
  const p=panel('MCP 管理');
  p.innerHTML=`<section class="mcp-add-form"><h3>本地连接配置</h3><label class="field">名称<input id="mcp-name" autocomplete="off" placeholder="my-server" value="${esc(draft.name)}"></label><label class="field">连接方式<select id="mcp-kind"><option value="http">远程 HTTPS</option><option value="stdio">本地命令</option></select></label><label class="field"><span id="mcp-address-label">HTTPS 地址</span><input id="mcp-address" autocomplete="off" value="${esc(draft.address)}"></label><label class="field" id="mcp-args-field" hidden>命令参数（JSON 数组）<textarea id="mcp-args">${esc(draft.args)}</textarea></label><label><input type="checkbox" id="mcp-replace" ${draft.replace?'checked':''}>替换同名连接</label><p class="customize-muted">本地命令在手机运行，需先安装依赖。密钥通过连接详情的安全输入页设置。</p><button id="mcp-save" class="btn primary">保存连接</button><p data-mcp-notice role="status"></p></section>`;
  const q=s=>p.querySelector(s);q('#mcp-kind').value=draft.kind;
  const snapshot=()=>{draft={name:q('#mcp-name').value,kind:q('#mcp-kind').value,address:q('#mcp-address').value,args:q('#mcp-args').value,replace:q('#mcp-replace').checked};};
  const transport=()=>{const local=q('#mcp-kind').value==='stdio';q('#mcp-args-field').hidden=!local;q('#mcp-address-label').textContent=local?'本地命令':'HTTPS 地址';};
  p.addEventListener('input',snapshot);q('#mcp-kind').onchange=()=>{transport();snapshot();};transport();
  q('#mcp-save').onclick=()=>mutation(async()=>{snapshot();const address=draft.address.trim();const value=await call({action:'save',name:draft.name.trim(),transport:draft.kind,...(draft.kind==='http'?{url:address}:{command:address,args:JSON.parse(draft.args)}),replace:draft.replace});draft={name:'',kind:'http',address:'',args:'[]',replace:false};return value;},id,root,p);
 }
 function detail(s,id,root){
  const p=panel(s.name),local=s.transport!=='http';
  p.innerHTML=`<div class="customize-detail"><span class="customize-icon">${extensionIcon('mcp')}</span><p>${local?'在手机运行的本地 MCP 服务':'通过 HTTPS 连接的远程 MCP 服务'}</p><dl><dt>状态</dt><dd>${s.enabled?'已启用':'已停用'} · 连接尚未检查</dd><dt>授权</dt><dd>${s.hasCredential?'已保存密钥':'未设置静态密钥'}，请根据服务要求测试或授权</dd></dl><div class="provider-buttons">${[['status','测试连接'],['resources','资源'],['toggle',s.enabled?'停用':'启用'],['login','授权 / 重新授权'],['cancel','取消授权'],['logout','退出授权'],...(!local?[['credential',s.hasCredential?'更换/清除密钥':'设置密钥']]:[]),['remove','删除']].map(([op,label])=>`<button class="btn${op==='remove'?' danger':''}" data-op="${op}">${label}</button>`).join('')}</div><p data-mcp-notice role="status"></p><div data-mcp-result></div></div>`;
  const target=p.querySelector('[data-mcp-result]');
  p.querySelectorAll('[data-op]').forEach(button=>button.onclick=()=>{
   const action=button.dataset.op;
   if(action==='logout'&&!confirm('退出 '+s.name+' 的本地授权？'))return;
   if(action==='remove'&&!confirm('删除 MCP 连接 '+s.name+'？'))return;
   mutation(async()=>{
    const response=await call({action,name:s.name,enabled:!s.enabled});
    if(action==='login')oauth.started(s.name,null,response.loginId);
    if(action==='cancel')return {keep:true,message:response.cancelled?'已请求取消授权，等待内核确认。':response.committing?'授权结果处理中，请等待确认。':'没有进行中的授权。'};
    if(!live(id,root)||!target.isConnected)return {keep:true};
    if(action==='resources'){
     target.replaceChildren();
     for(const server of response.data||[])for(const resource of server.resources||[]){
      const button=document.createElement('button');button.className='btn';button.textContent=resource.name||resource.uri;
      button.onclick=()=>mutation(async()=>{const value=await call({action:'resourceRead',name:s.name,uri:resource.uri});if(!live(id,root)||!target.isConnected)return {keep:true};let preview=target.querySelector('pre');if(!preview){preview=document.createElement('pre');target.append(preview);}preview.textContent=(value.contents||[]).map(c=>c.binary?'[二进制资源，暂不预览]':c.text+(c.truncated?'[内容截断]':'')).join('\n');return {keep:true};},id,root,p);target.append(button);
     }
     if(!target.children.length)target.textContent='没有公开资源';return {keep:true};
    }
    if(action==='status'){target.textContent=(response.data||[]).map(formatStatus).join('\n')||'没有返回连接信息';return {keep:true};}
    return response;
   },id,root,p);
  });
 }
 async function open(){
  const current=++epoch;settingPage='mcp';
  document.querySelector('#screen').innerHTML=`<header class="app-head">${control('back','返回','desktop-extensions-back')}<strong>技能与插件</strong><span data-desktop-status role="status"></span></header><div class="desktop-extensions"><main class="customize-page" id="mcp-page" data-kind="mcp"><div class="customize-content">${extensionTabs('mcp')}${extensionToolbar({searchId:'mcp-search',label:'搜索 MCP',value:query,refresh:'id="mcp-refresh"',settings:`<button type="button" class="icon-btn" id="mcp-settings" title="管理设置" aria-label="管理设置">${icon('settings')}</button>`,add:'id="mcp-add" aria-haspopup="menu"'})}<div class="customize-tabs" aria-label="MCP 来源">${[['all','全部'],['http','远程'],['stdio','本地']].map(([key,label])=>`<button data-mcp-filter="${key}" class="${filter===key?'selected':''}" aria-pressed="${filter===key}">${label}</button>`).join('')}</div><p id="mcp-notice" class="customize-muted" role="status">正在读取目录…</p><section class="customize-section"><h3>已添加的 MCP</h3><div id="mcp-servers" class="customize-grid"></div></section></div></main></div>`;
  const root=document.querySelector('#mcp-page'),q=s=>root.querySelector(s);
  q('#mcp-refresh').onclick=open;q('#mcp-settings').onclick=()=>management(current,root);
  globalThis.EvaPluginAddHost?.mount(q('#mcp-add'));
  let servers=[];
  function paint(){
   if(!live(current,root))return;
   const rows=servers.filter(s=>(filter==='all'||s.transport===filter)&&(s.name+' '+s.transport).toLowerCase().includes(query.trim().toLowerCase()));
   q('#mcp-servers').innerHTML=rows.map((s,i)=>`<article class="customize-card"><button class="customize-card-main" data-mcp-detail="${i}"><span class="customize-icon">${extensionIcon('mcp')}</span><span class="customize-card-copy"><strong>${esc(s.name)}</strong><span>${s.transport==='http'?'远程 HTTPS':'手机本地命令'} · ${s.enabled?'已启用':'已停用'}</span></span></button><button class="customize-card-action" data-mcp-detail="${i}" aria-label="管理 ${esc(s.name)}">${icon('more')}</button></article>`).join('')||'<p class="customize-empty">'+(servers.length?'没有匹配的 MCP':'尚未添加 MCP')+'</p>';
   root.querySelectorAll('[data-mcp-detail]').forEach(b=>b.onclick=()=>detail(rows[Number(b.dataset.mcpDetail)],current,root));
  }
  q('#mcp-search').oninput=e=>{query=e.target.value;paint();};
  root.querySelectorAll('[data-mcp-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.mcpFilter;root.querySelectorAll('[data-mcp-filter]').forEach(n=>{n.classList.toggle('selected',n===b);n.setAttribute('aria-pressed',String(n===b));});paint();});
  lock(root,busy);
  try{const result=await call({action:'list'});if(!live(current,root))return;servers=result.servers||[];paint();notice('',root);lock(root,busy);}
  catch(e){if(live(current,root)){notice('读取失败：'+e.message+'；点击“刷新”重试。',root);q('#mcp-notice').classList.add('customize-error');}}
 }
 const prior=settingsGo;settingsGo=function(page){if(page==='mcp'){open();return;}if(settingPage==='mcp')epoch++;prior(page);};
 const oldEvent=kernelEvent;kernelEvent=function(e){oldEvent(e);oauth.observe(e.method,e.params||{}).catch(()=>{if(settingPage==='mcp')notice('授权状态验证失败，请测试连接确认。');});if(e.method==='android/mcpChanged'&&settingPage==='mcp'&&!busy&&!document.querySelector('#eva-panel'))open();};
 window.openMcpSettings=open;
})();
