'use strict';
// Existing permission logic owns its menu and transport. This adapter only places the control.
(() => {
 function update() {
  if (settingPage || !['home','chat'].includes(route)) return;
  window.evaPermissions?.renderControl();
  window.desktopModelControl?.paintLabel();
  const dock=document.querySelector('.dock'),foot=dock?.querySelector('.foot');
  if(foot){
   let footer=dock.querySelector('.composer-footer');
   if(!footer){footer=document.createElement('div');footer.className='composer-footer';foot.before(footer);footer.append(foot);}
   let chip=footer.querySelector('.workspace-chip');
   if(!chip){chip=document.createElement('button');chip.type='button';chip.className='workspace-chip';chip.dataset.action='workspace-current';chip.innerHTML=icon('folder')+'<span></span>';footer.prepend(chip);}
   const name=projectName(active()?.projectId||data.projectId);chip.querySelector('span').textContent=name;chip.title='打开'+name;chip.setAttribute('aria-label','打开工作区：'+name);
  }
  window.evaChatScroll?.sync(document.querySelector('.flow'));
 }
 const priorNavigate=navigate;
 navigate=function(action){if(action==='workspace-current'){const id=active()?.projectId||data.projectId;const error=EvaHost.revealWorkspaceFile(id?'projects/'+id:'');if(error){kernelNotice=error;refreshKernelControls();}return;}return priorNavigate(action);};
 const previousRender=render;
 render=function(){previousRender();update();};
 window.visualViewport?.addEventListener('resize',update);
 window.addEventListener('resize',update);
 update();
})();
