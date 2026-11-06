'use strict';
// Modes and menu markup/styles migrated from Eva 0.2.0 util.js/composer.js.
window.evaPermissions=(()=>{
 const modes={read:{approvalPolicy:'never',approvalsReviewer:'user',sandbox:'read-only',label:'只读模式',icon:'shield',description:'仅查看文件，不修改工作区内容'},auto:{approvalPolicy:'on-request',approvalsReviewer:'user',sandbox:'workspace-write',label:'请求批准',icon:'approvalHand',description:'编辑外部文件和使用互联网前请求批准'},assisted:{approvalPolicy:'on-request',approvalsReviewer:'auto_review',sandbox:'workspace-write',label:'帮我批准',icon:'shield',description:'自动审核权限请求，风险操作会被拦截'},full:{approvalPolicy:'never',approvalsReviewer:'user',sandbox:'danger-full-access',label:'完全访问权限',icon:'shieldAlert',description:'可访问互联网和本机文件，不再请求批准'}};
 const paths={approvalHand:'<path d="M6 10V5a1.2 1.2 0 0 1 2.4 0v4-5a1.2 1.2 0 0 1 2.4 0v5-4a1.2 1.2 0 0 1 2.4 0v4-2a1.2 1.2 0 0 1 2.4 0v5c0 4-2 6-5 6-2 0-3.2-1-4.5-3L4 12c-1-1.6.7-3 2-2Z"/>',shield:'<path d="M10 3.2 16 5.4v4.4c0 3.4-2.4 5.9-6 7-3.6-1.1-6-3.6-6-7V5.4Z"/>',shieldAlert:'<path d="m10 2.5 6.5 3v5c0 3.5-3.5 6-6.5 7-3-1-6.5-3.5-6.5-7v-5Z"/><path d="M10 6v4m0 3h.01"/>',check:'<path d="m4 10 4 4 8-8"/>'};
 const ic=k=>`<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[k]||''}</svg>`;
 const current=c=>{const key=c?.permissionMode||data.permissionMode||'auto';return modes[key]?key:'auto'};
 function params(c,turn=false){const m=modes[current(c)],common={approvalPolicy:m.approvalPolicy,approvalsReviewer:m.approvalsReviewer};return turn?{...common,sandboxPolicy:m.sandbox==='danger-full-access'?{type:'dangerFullAccess'}:m.sandbox==='read-only'?{type:'readOnly'}:{type:'workspaceWrite',writableRoots:['/root/eva-workspace'+(c?.projectId?'/projects/'+c.projectId:'')],networkAccess:false,excludeTmpdirEnvVar:false,excludeSlashTmp:false}}:{...common,sandbox:m.sandbox};}
 function validate(result,c){const m=modes[current(c)];if(result.approvalPolicy!=null&&result.approvalPolicy!==m.approvalPolicy&&!(current(c)==='full'&&result.approvalPolicy==='on-request'&&result.approvalsReviewer==='user'&&result.sandbox?.type==='dangerFullAccess'))throw Error('内核返回了不同的批准策略，已停止发送，请检查权限设置');if(result.approvalsReviewer&&result.approvalsReviewer!==m.approvalsReviewer&&!(current(c)==='assisted'&&result.approvalsReviewer==='guardian_subagent'))throw Error('内核返回了不同的批准方式，已停止发送，请检查权限设置');const kind=result.sandbox?.type;if(kind&&kind!==(m.sandbox==='danger-full-access'?'dangerFullAccess':m.sandbox==='read-only'?'readOnly':'workspaceWrite'))throw Error('内核返回了不同的访问权限，已停止发送，请检查权限设置');}
 let dismiss,resize;
 function close(){document.querySelector('#menu-root .permission-menu')?.remove();if(dismiss)document.removeEventListener('pointerdown',dismiss,true);if(resize)window.removeEventListener('resize',resize);dismiss=resize=null;document.querySelector('[data-action=kernel-permissions]')?.setAttribute('aria-expanded','false');}
 function renderControl(){
  if(settingPage||!['home','chat'].includes(route))return;
  const controls=document.querySelector('.composer .controls');
  if(!controls)return;
  let button=document.querySelector('[data-action=kernel-permissions]');
  if(!button){
   button=document.createElement('button');button.type='button';button.dataset.action='kernel-permissions';
   button.setAttribute('aria-haspopup','menu');button.setAttribute('aria-expanded','false');
  }
  const attach=controls.querySelector('[data-action=attach-menu],[data-action=tools]');
  if(attach&&button.previousElementSibling!==attach)attach.after(button);
  else if(!attach&&button.parentElement!==controls)controls.prepend(button);
  document.querySelectorAll('.permission-row').forEach(row=>row.remove());
  const key=current(active()),mode=modes[key];
  button.className='permission-chip'+(key==='full'?' full-access':'');
  button.disabled=!!(kernelBusy||active()?.running);
  button.setAttribute('aria-label','执行权限：'+mode.label);
  button.title=mode.label;
  if(button.dataset.permissionIconMode!==key){button.innerHTML=ic(mode.icon);button.dataset.permissionIconMode=key;}
 }

 function open(){if(kernelBusy||active()?.running)return;closeModelPanel();close();const anchor=document.querySelector('[data-action=kernel-permissions]');if(!anchor)return;const root=document.querySelector('#menu-root')||document.body.appendChild(Object.assign(document.createElement('div'),{id:'menu-root'}));const menu=document.createElement('div');menu.className='menu permission-menu';menu.setAttribute('role','menu');menu.setAttribute('aria-label','执行权限');root.append(menu);const selected=current(active());menu.innerHTML=`<div class="permission-menu-head"><span>应如何批准 Eva 操作？</span><button data-permission-help>了解更多</button></div>${(selected==='read'?['auto','assisted','full','read']:['auto','assisted','full']).map(key=>`<button class="permission-choice${key==='full'?' permission-danger':''}" data-permission-mode="${key}" role="menuitemradio" aria-checked="${key===selected}"><span class="permission-choice-icon">${ic(modes[key].icon)}</span><span class="permission-choice-copy"><strong>${esc(modes[key].label)}</strong><small>${esc(modes[key].description)}</small></span><span class="permission-choice-check">${key===selected?ic('check'):''}</span></button>`).join('')}`;
  const choose=key=>{if(kernelBusy||active()?.running)return;const c=active();const next={...data,permissionMode:key,drafts:(data.drafts||[]).map(chat=>chat===c?{...chat,permissionMode:key}:chat),chats:data.chats.map(chat=>chat===c?{...chat,permissionMode:key}:chat)};if(EvaHost.save(JSON.stringify(next))===false){kernelNotice='权限选择保存失败，请重试';refreshKernelControls();return}data=next;close();renderControl();};
  menu.querySelectorAll('[data-permission-mode]').forEach(button=>button.onclick=()=>choose(button.dataset.permissionMode));
  menu.querySelector('[data-permission-help]').onclick=()=>{close();const host=modelPanel('权限说明');host.innerHTML='<p>请求批准：工作区内可编辑，越界或联网操作由你批准。</p><p>帮我批准：使用内核 auto_review 审核权限请求，自动批准或拒绝；不会绕过内核沙箱。需要审核模型可用，失败会显示错误。</p><p>完全访问权限：关闭内核沙箱和交互批准，仍受 Android 系统与服务权限约束。</p><button type="button" data-read-only>切换为只读模式</button>';host.querySelector('[data-read-only]').onclick=()=>{choose('read');closeModelPanel();};};
  resize=()=>{const rect=anchor.getBoundingClientRect(),box=menu.getBoundingClientRect();menu.style.left=Math.max(6,Math.min(rect.left,innerWidth-box.width-6))+'px';menu.style.top=Math.max(6,rect.top-box.height-8)+'px';};resize();anchor.setAttribute('aria-expanded','true');window.addEventListener('resize',resize);dismiss=e=>{if(!menu.contains(e.target)&&!anchor.contains(e.target))close()};document.addEventListener('pointerdown',dismiss,true);
 }
 const previousRender=render;render=function(){previousRender();renderControl()};const previousRefresh=refreshKernelControls;refreshKernelControls=function(){previousRefresh();renderControl()};const previousNavigate=navigate;navigate=function(action){if(action==='kernel-permissions'){open();return}close();previousNavigate(action)};const previousBack=window.evaBack;window.evaBack=()=>{if(document.querySelector('#menu-root .permission-menu')){close();return true}return previousBack()};document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
 return {modes,current,params,validate,open,close,renderControl};
})();
evaPermissions.renderControl();
