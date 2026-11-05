'use strict';
/* Opens scheduler-owned conversations without resuming them with interactive permissions. */
(() => {
 async function openThread(threadId) {
  try {
   const binding = JSON.parse(EvaHost.scheduledThreadBinding(threadId));
   if (!binding?.automationId) throw Error('定时任务会话绑定不存在');
   const result = await kernelCall('thread/read', {threadId, includeTurns: true});
   let chat = [...data.chats, ...data.drafts].find(row => row.kernelThread?.id === threadId);
   if (!chat) {
    chat = {id: crypto.randomUUID(), title: binding.taskName ? '定时 · ' + binding.taskName : result.thread.name || '定时任务', messages: [], draft: '', attachments: []};
    data.chats.push(chat);
   }
   Object.assign(chat, {
    kernelThread: result.thread, importedReadOnly: true, scheduledReadOnly: true,
    providerId: binding.provider, model: binding.model,
    running: result.thread.status?.type === 'active' || !!latestKernelTurn(result.thread)
   });
   data.active = chat.id;
   route = 'chat';
   settingPage = null;
   $('#phone').classList.remove('drawer-open');
   persist();
   render();
  } catch (error) {
   kernelNotice = '定时任务对话无法打开：' + error.message;
   refreshKernelControls();
  }
 }
 function controls() {
  const chat = active();
  if (!chat?.scheduledReadOnly || settingPage) return;
  const input = $('#prompt');
  if (input) {
   input.readOnly = true;
   input.placeholder = '定时任务对话 · 查看结果、处理审批或停止任务';
  }
  for (const button of document.querySelectorAll('[data-task-primary],.model,.permission-chip,[data-action="attach-menu"]')) button.disabled = true;
  const foot = document.querySelector('.foot');
  if (foot && !kernelNotice) foot.textContent = '任务按保存的模型和只读权限执行';
 }
 const previousSend = kernelSend;
 kernelSend = function() { if (!active()?.scheduledReadOnly) return previousSend(); };
 const previousControls = refreshKernelControls;
 refreshKernelControls = function() { previousControls(); controls(); };
 const previousRender = render;
 render = function() { previousRender(); controls(); };
 const previousNavigate = navigate;
 navigate = function(action) {
  if (active()?.scheduledReadOnly && ['kernel-send', 'kernel-steer'].includes(action)) return;
  return previousNavigate(action);
 };
 const previousEvent = kernelEvent;
 kernelEvent = function(event) {
  const params = event.params || {};
  if (event.method === 'turn/started' && params.threadId && typeof EvaHost.scheduledThreadBinding === 'function' &&
      ![...data.chats, ...data.drafts].some(chat => chat.kernelThread?.id === params.threadId)) {
   try {
    const binding = JSON.parse(EvaHost.scheduledThreadBinding(params.threadId));
    if (binding?.automationId) {
     data.chats.push({
      id: crypto.randomUUID(), title: binding.taskName ? '定时 · ' + binding.taskName : '定时任务', messages: [], draft: '', attachments: [],
      kernelThread: {id: params.threadId, cwd: '/root/eva-workspace', turns: []},
      importedReadOnly: true, scheduledReadOnly: true,
      providerId: binding.provider, model: binding.model, running: true
     });
     scheduleKernelSave();
    }
   } catch (error) {
    kernelNotice = '定时任务状态无法读取，请在运行历史中核对';
   }
  }
  return previousEvent(event);
 };
 window.evaScheduledTasks = {openThread};
})();
