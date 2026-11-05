'use strict';
// Imported history is readable without importing kernel IDs, credentials or files.
(()=>{
 const readonly=c=>!!c?.importedReadOnly;
 function notice(){if(!readonly(active())||!['home','chat'].includes(route)||settingPage)return;const input=$('#prompt');if(input){input.readOnly=true;input.placeholder='导入历史只读；请新建对话开始任务';input.setAttribute('aria-label','导入历史草稿（只读）');}
  for(const button of document.querySelectorAll('.composer [data-action="kernel-send"],.composer [data-action="kernel-steer"],.composer [data-action="kernel-stop"],.composer [data-action="kernel-models"],.composer [data-action="attach-menu"],.composer [data-action="tools"]')){button.disabled=true;button.setAttribute('aria-disabled','true');}
  if($('.foot'))$('.foot').textContent='导入历史（只读）· 不含工作区和附件文件 · 不会恢复或重新执行原任务';
 }
 const previousRender=render;render=function(){previousRender();notice();};
 const previousRefresh=refreshKernelControls;refreshKernelControls=function(){previousRefresh();notice();};
 const previousSend=kernelSend;kernelSend=function(){if(readonly(active())){kernelNotice='导入历史只读，请新建对话开始任务';refreshKernelControls();return;}return previousSend();};
 const previousCall=kernelCall;kernelCall=function(method,params={}){if(readonly(active())&&params.threadId===active().kernelThread?.id&&![...data.chats,...data.drafts].some(c=>!readonly(c)&&c.kernelThread?.id===params.threadId)&&['thread/read','thread/archive','thread/resume','turn/start','turn/steer','turn/interrupt'].includes(method))return Promise.reject(Error('导入历史不连接原内核会话'));return previousCall(method,params);};
 const previousEvent=kernelEvent;kernelEvent=function(event){const id=event.params?.threadId;if(id&&!event.ticket&&!event.id){const matching=[...data.chats,...data.drafts].filter(c=>c.kernelThread?.id===id);if(matching.length&&matching.every(readonly))return;}previousEvent(event);};
 function remove(c){const host=modelPanel('删除导入历史');host.innerHTML='<p>仅删除这条本地导入记录，不操作原内核会话或工作区。</p><button data-delete-imported>确认删除</button><button data-cancel-imported>取消</button>';host.querySelector('[data-cancel-imported]').onclick=closeModelPanel;host.querySelector('[data-delete-imported]').onclick=()=>{data.chats=data.chats.filter(x=>x.id!==c.id);data.drafts=data.drafts.filter(x=>x.id!==c.id);if(data.active===c.id){data.active=null;route='home';}saveKernel();closeModelPanel();render();};}
 const previousNavigate=navigate;navigate=function(action){
  if(action==='data-backup'){try{saveKernel();EvaHost.open('data-backup');}catch(e){kernelNotice=e.message;refreshKernelControls();}return;}
  if(action.startsWith('chat:')){const c=[...data.chats,...data.drafts].find(c=>c.id===action.slice(5));if(readonly(c)){data.active=c.id;data.projectId=c.projectId||'';settingPage=null;route='chat';$('#phone').classList.remove('drawer-open');closeModelPanel();persist();render();return;}}
  if(action==='delete-chat'||action.startsWith('delete-chat:')){const c=action==='delete-chat'?active():[...data.chats,...data.drafts].find(c=>c.id===action.slice(12));if(readonly(c)){remove(c);return;}}
  if(readonly(active())&&['kernel-send','kernel-steer','kernel-stop','save','kernel-models','attach-menu','attach-photos','attach-files'].includes(action)){notice();return;}
  previousNavigate(action);
 };
 notice();
})();
