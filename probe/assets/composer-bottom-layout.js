'use strict';
// Existing permission logic owns its menu and transport. This adapter only places the control.
(() => {
 const disclaimer='Eva可能会出错，请核查重要信息';
 let observedFoot=null,statusObserver=null,statusKey='',statusIndex=0;
 function changeStatus(bar,text){
  const span=bar.querySelector('span');bar._nextText=text;
  if(span.textContent===text){clearTimeout(bar._fadeTimer);bar._fadeTimer=null;bar.classList.remove('is-changing');return;}
  if(!span.textContent||matchMedia('(prefers-reduced-motion: reduce)').matches){span.textContent=text;return;}
  if(bar._fadeTimer)return;
  bar.classList.add('is-changing');
  bar._fadeTimer=setTimeout(()=>{
   bar._fadeTimer=null;if(!bar.isConnected)return;
   span.textContent=bar._nextText;bar.classList.remove('is-changing');
  },160);
 }
 function paintStatus(){
  const dock=document.querySelector('.dock'),bar=dock?.querySelector('.composer-status-strip');if(!bar)return;
  const c=active(),raw=observedFoot?.textContent.trim()||'';
  const notices=[kernelNotice,c?.recoveryNotice,window.evaContextCompaction?.notice?.(),raw].filter(text=>text&&!['任务在此手机执行 · 模型在云端处理','Eva / Codex 内核 · 手机本地运行',disclaimer].includes(text)&&!/^(正在(?:运行|执行|发送|思考|处理|提交任务)|正在连接内核|处理中)[.…。]*$/.test(text.trim()));
  const rows=[...new Set([...notices,disclaimer])];
  const urgent=!!c?.recoveryState||kernelApprovals.size>0||rows.some(text=>/失败|错误|需要.*授权|需要.*确认/.test(text));
  const key=rows.join('\n');if(key!==statusKey){statusKey=key;statusIndex=0;}
  bar.hidden=!rows.length;bar.classList.toggle('has-updates',notices.length>0);bar.classList.toggle('needs-attention',urgent);
  const text=(urgent?(c?.recoveryNotice||rows.find(text=>/失败|错误|需要.*授权|需要.*确认/.test(text))||rows[0]):rows[statusIndex%rows.length])||'';
  changeStatus(bar,text);
  bar.title=text;bar.setAttribute('aria-label',text);
  bar.dataset.urgent=String(urgent);
 }
 setInterval(()=>{const bar=document.querySelector('.composer-status-strip');if(!document.hidden&&bar&&!bar.hidden&&bar.dataset.urgent!=='true'){statusIndex++;paintStatus();}},4000);
 function update() {
  if (settingPage || !['home','chat'].includes(route)) return;
  window.evaPermissions?.renderControl();
  window.desktopModelControl?.paintLabel();
  const dock=document.querySelector('.dock'),foot=dock?.querySelector('.foot');
  if(foot){
   let footer=dock.querySelector('.composer-footer');
   if(!footer){footer=document.createElement('div');footer.className='composer-footer';foot.before(footer);}
   let chip=footer.querySelector('.workspace-chip');
   if(!chip){chip=document.createElement('button');chip.type='button';chip.className='workspace-chip';chip.dataset.action='workspace-current';chip.innerHTML=icon('folder')+'<span></span>';footer.prepend(chip);}
   dock.querySelector('.composer-disclaimer')?.remove();
   let bar=dock.querySelector('.composer-status-strip');
   if(!bar){bar=document.createElement('button');bar.type='button';bar.className='composer-status-strip';bar.hidden=true;bar.innerHTML='<span></span>';bar.setAttribute('role','status');bar.onclick=()=>bar.classList.toggle('expanded');dock.querySelector('.composer').before(bar);}
   if(observedFoot!==foot){statusObserver?.disconnect();observedFoot=foot;statusObserver=new MutationObserver(paintStatus);statusObserver.observe(foot,{childList:true,subtree:true,characterData:true});}
   window.evaContextCompaction?.paint();
   paintStatus();
   const name=projectName(active()?.projectId||data.projectId);chip.querySelector('span').textContent=name;chip.title='打开'+name;chip.setAttribute('aria-label','打开工作区：'+name);
  }
  window.evaChatScroll?.sync(document.querySelector('.flow'));
 }
 const priorNavigate=navigate;
 navigate=function(action){if(action==='workspace-current'){const id=active()?.projectId||data.projectId;const error=EvaHost.revealWorkspaceFile(id?'projects/'+id:'');if(error){kernelNotice=error;refreshKernelControls();}return;}return priorNavigate(action);};
 const previousRefresh=refreshKernelControls;refreshKernelControls=function(){previousRefresh();update();};
 const previousRender=render;
 render=function(){previousRender();update();};
 window.visualViewport?.addEventListener('resize',update);
 window.addEventListener('resize',update);
 update();
})();
