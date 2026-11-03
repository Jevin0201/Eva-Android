'use strict';
// Android adapter for desktop hook-settings.js: native hooks/list + scoped config edits.
window.evaHooks=(()=>{
 const state={owned:[],revision:'',events:[],editing:null,entries:[],busy:false,loaded:false,notice:'',error:''};
 const sources={user:'用户配置',project:'项目配置',plugin:'插件',system:'系统管理',mdm:'设备管理',cloudRequirements:'组织策略',cloudManagedConfig:'组织配置',legacyManagedConfigFile:'管理配置',legacyManagedConfigMdm:'设备管理',sessionFlags:'会话参数',unknown:'未知来源'};
 const trustLabels={trusted:'已信任',untrusted:'待信任',modified:'内容已改变，需重新信任',managed:'由管理员管理'};
 const query=()=>({cwds:['/root/eva-workspace'+(active()?.projectId?'/projects/'+active().projectId:'')]});
 const rows=()=>state.entries.flatMap(e=>(e.hooks||[]).map(h=>({...h,cwd:e.cwd})));
 const review=h=>h.trustStatus==='untrusted'||h.trustStatus==='modified';
 const managed=h=>h.isManaged||h.trustStatus==='managed';
 const command=h=>h.command||[h.server,h.tool].filter(Boolean).join(' / ')||h.handlerType;
 function draw(){
  if(settingPage!=='hooks')return;
  let body=`<button data-hooks-refresh ${state.busy?'disabled':''}>刷新</button><p class="preview-label">管理当前项目、用户配置和插件提供的生命周期钩子。命令钩子可能在内核沙箱外执行；信任前请检查完整命令和来源。</p><p role="status" id="hooks-notice">${esc(state.busy?'正在处理…':state.notice)}</p>${state.error?`<p role="alert" class="model-error">${esc(state.error)}</p>`:''}`;
  body+=editorHtml();
  let count=0;
  for(const entry of state.entries){
   let content='';for(const h of entry.hooks||[]){count++;const active=managed(h)||(h.enabled&&h.trustStatus==='trusted');
    content+=`<div class="hook-card" style="padding:12px 0;border-bottom:1px solid var(--border,#ddd)"><strong>${esc(h.eventName)}</strong><p class="preview-label">${esc(sources[h.source]||h.source||'未知来源')}${h.pluginId?' · '+esc(h.pluginId):''}<br>${esc(trustLabels[h.trustStatus]||h.trustStatus)} · ${active?'已启用':'未启用'}</p><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(command(h))}</pre><details><summary>配置详情</summary><p class="preview-label" style="overflow-wrap:anywhere">来源文件：${esc(h.sourcePath||'未提供')}<br>匹配条件：${esc(h.matcher||'全部')}<br>超时：${esc(h.timeoutSec)} 秒<br>当前指纹：${esc(h.currentHash||'未提供')}${h.statusMessage?'<br>'+esc(h.statusMessage):''}</p></details><div style="display:flex;gap:8px;margin-top:10px">${review(h)&&!managed(h)?`<button data-hook-trust="${esc(h.key)}" ${state.busy||!h.currentHash?'disabled':''}>检查并信任</button>`:''}<button data-hook-toggle="${esc(h.key)}" role="switch" aria-checked="${!!active}" ${state.busy||managed(h)||review(h)||h.trustStatus!=='trusted'?'disabled':''}>${active?'停用':'启用'}</button></div>${managed(h)?'<p class="preview-label">此钩子由管理员管理，不能在此更改。</p>':''}</div>`;
   }
   content+=(entry.warnings||[]).map(w=>`<p class="preview-label">${esc(w)}</p>`).join('');
   content+=(entry.errors||[]).map(e=>`<p role="alert" class="model-error">${esc(e.path||'')}：${esc(e.message)}</p>`).join('');
   if(content)body+=settingGroup(entry.cwd||'生命周期钩子',content);
  }
  if(!count)body+=`<p class="preview-label">${state.loaded?'当前范围没有钩子。钩子来自项目、用户配置或已安装插件；没有钩子时不会创建默认执行命令。':'正在读取钩子…'}</p>`;
  $('#screen').innerHTML=`<header class="app-head">${control('back','返回','settings-back')}<strong>生命周期钩子</strong></header><div class="flow">${body}</div>`;
  $('[data-hooks-refresh]').onclick=load;bindEditor();
  document.querySelectorAll('[data-hook-toggle]').forEach(b=>b.onclick=()=>{const h=rows().find(h=>h.key===b.dataset.hookToggle);if(h&&!managed(h)&&h.trustStatus==='trusted')mutate(h,{enabled:!h.enabled});});
  document.querySelectorAll('[data-hook-trust]').forEach(b=>b.onclick=()=>{const h=rows().find(h=>h.key===b.dataset.hookTrust);if(!h||managed(h)||!review(h)||!h.currentHash)return;if(confirm('信任以下钩子的当前内容？\n\n'+h.eventName+'\n'+command(h)+'\n\n来源：'+h.sourcePath+'\n指纹：'+h.currentHash))mutate(h,{trustedHash:h.currentHash});});
 }
 async function fetchRows(){const result=await kernelCall('hooks/list',query());if(!Array.isArray(result.data))throw Error('内核返回的钩子列表格式无效');state.entries=result.data;const own=await kernelCall('android/hooks',{action:'list'});state.owned=own.entries||[];state.revision=own.revision;state.events=own.events||[];state.loaded=true;}
 async function load(){if(state.busy)return;state.busy=true;state.error='';state.notice='';draw();try{await fetchRows();}catch(e){state.error='读取钩子失败：'+e.message;}finally{state.busy=false;draw();}}
 async function mutate(h,change){
  if(state.busy)return;if(kernelBusy||[...(data.chats||[]),...(data.drafts||[])].some(c=>c.running)){state.error='请先完成或停止正在执行的任务，再修改钩子。';draw();return;}
  state.busy=true;state.error='';state.notice='';draw();
  try{
   const prefix='hooks.state.'+JSON.stringify(h.key),edits=[];
   if(change.enabled!=null)edits.push({keyPath:prefix+'.enabled',value:change.enabled,mergeStrategy:'upsert'});
   if(change.trustedHash!=null)edits.push({keyPath:prefix+'.trusted_hash',value:change.trustedHash,mergeStrategy:'upsert'});
   const result=await kernelCall('config/batchWrite',{edits,filePath:null,expectedVersion:null,reloadUserConfig:true});
   await fetchRows();if(result.status==='okOverridden')throw Error('此设置被其他配置层覆盖，修改未生效。');
   const actual=rows().find(x=>x.key===h.key);if(!actual)throw Error('钩子已改变或已移除，请刷新后核对。');
   if(change.enabled!=null&&actual.enabled!==change.enabled)throw Error('内核启停状态与请求不一致，请检查管理策略和配置错误。');
   if(change.trustedHash!=null&&(actual.currentHash!==change.trustedHash||actual.trustStatus!=='trusted'))throw Error('内容已改变或信任未生效，请重新检查当前配置。');
   loadedKernelThreads.clear();state.notice=change.trustedHash!=null?'已信任当前内容；后续内容改变需要重新信任。':change.enabled?'钩子已启用。':'钩子已停用。';
  }catch(e){state.error='设置未完整确认：'+e.message;}
  finally{state.busy=false;draw();}
 }

 function editorHtml(){const e=state.editing;return settingGroup('手机创建的用户钩子',`<button data-hook-new ${state.busy?'disabled':''}>新建钩子</button>${state.owned.map((h,i)=>`<p>${esc(h.event)} <button data-hook-edit="${i}">编辑</button> <button data-hook-delete="${i}">删除</button></p>`).join('')}${e?`<label>事件<select id="hook-event" ${e.id?'disabled':''}>${state.events.map(event=>`<option ${event===e.event?'selected':''}>${esc(event)}</option>`).join('')}</select></label><label>匹配条件<input id="hook-matcher" value="${esc(e.matcher||'')}"></label><label>完整命令<textarea id="hook-command" style="width:100%;min-height:120px">${esc(e.command||'')}</textarea></label><label>超时（秒）<input id="hook-timeout" type="number" min="1" max="300" value="${e.timeout||10}"></label><button data-hook-save>保存声明</button><button data-hook-cancel>取消编辑</button><p>保存不会自动信任或执行。请检查下方内核列表中的完整命令与指纹。</p>`:''}`);}
 function bindEditor(){
  $('[data-hook-new]').onclick=()=>{if(state.editing&&!confirm('放弃当前编辑？'))return;state.editing={event:state.events[0],command:'',matcher:'',timeout:10};draw();};
  document.querySelectorAll('[data-hook-edit]').forEach(b=>b.onclick=()=>{if(state.editing&&!confirm('放弃当前编辑？'))return;state.editing={...state.owned[+b.dataset.hookEdit]};draw();});
  document.querySelectorAll('[data-hook-delete]').forEach(b=>b.onclick=()=>{const h=state.owned[+b.dataset.hookDelete];if(confirm('删除此手机创建的钩子？'))writeDeclaration('delete',h);});
  if(!state.editing)return;for(const [id,key]of [['hook-event','event'],['hook-command','command'],['hook-matcher','matcher'],['hook-timeout','timeout']])$('#'+id).oninput=e=>state.editing[key]=key==='timeout'?Number(e.target.value):e.target.value;
  $('[data-hook-cancel]').onclick=()=>{state.editing=null;draw();};$('[data-hook-save]').onclick=()=>writeDeclaration('save',state.editing);
 }
 async function writeDeclaration(action,entry){if(state.busy)return;if(kernelBusy||[...(data.chats||[]),...(data.drafts||[])].some(c=>c.running)){state.error='请先完成或停止正在执行的任务，再修改钩子。';draw();return;}state.busy=true;state.error='';draw();try{await kernelCall('android/hooks',{action,...entry,revision:state.revision});state.editing=null;loadedKernelThreads.clear();await fetchRows();state.notice='声明已保存，未自动信任；请检查下方命令和当前指纹。';}catch(e){state.error='修改失败：'+e.message;}finally{state.busy=false;draw();}}
 const previousSettings=settingsGo;settingsGo=function(page){if(page==='hooks'){settingPage='hooks';$('#phone').classList.remove('drawer-open');draw();load();return;}previousSettings(page);if(page==='settings')$('.flow').insertAdjacentHTML('afterbegin',settingGroup('自动执行',row('terminal','生命周期钩子','查看来源、启停和信任状态','settings:hooks')));};
 return {open:()=>settingsGo('hooks'),load,state};
})();
