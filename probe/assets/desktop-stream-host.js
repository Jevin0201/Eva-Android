import './desktop-stream/native-steering/bundle.js';
import './desktop-stream/native-image-preview/common.js';
'use strict';
/* Android services and paged history for the complete desktop transcript renderer. */
(() => {
 if (window.EVA_STREAM_MODE === 'legacy') return;
 EvaFlowProjection.registerPhoneTools(window.nativeTranscript);
 const workspace = '/root/eva-workspace/';
 const state = {
  productMode: 'codex', thread: null, activeThreadId: null, cwd: workspace,
  meta: {codexHome: '/root/.eva-codex'}, plans: new Map(), diffs: new Map(),
  turnConnections: new Map(), expanded: new Set(), viewedLinks: new Set(),
  approvals: [], settingsData: {}, composerMentions: [], running: false
 };
 const els = {};
 let scheduledFrame = 0;
 let scheduledChat = null;
 function notice(error) {
  kernelNotice = error?.message || String(error);
  refreshKernelControls();
 }
 function copyClipboardText(text) {
  try {
   if (typeof text !== 'string' || !text.length) { notice('没有可复制的文字'); return false; }
   if (EvaHost.copyText(text) !== true) throw Error('复制失败，请重试');
   return true;
  } catch { notice('复制失败，请重试'); return false; }
 }
 const copyFeedback = new WeakMap();
 function paintCopied(button) {
  button.innerHTML=renderer.ic('check');button.setAttribute('aria-label','已复制');button.setAttribute('title','已复制');
  button.dataset.copySucceeded='true';
 }
 function copied(button) {
  if (copyFeedback.has(button)) return;
  const old={html:button.innerHTML,label:button.getAttribute('aria-label'),title:button.getAttribute('title')};
  paintCopied(button);
  copyFeedback.set(button,setTimeout(()=>{
   copyFeedback.delete(button);
   if (!button.isConnected) return;
   button.innerHTML=old.html;
   for(const [key,value] of [['aria-label',old.label],['title',old.title]])value===null?button.removeAttribute(key):button.setAttribute(key,value);
   delete button.dataset.copySucceeded;
  },1500));
 }
 function relativePath(value) {
  if (typeof value !== 'string' || /[\u0000-\u001f]/.test(value)) throw Error('文件路径无效');
  const path = value.replace(/\\/g, '/');
  const resolved = new URL(path, 'https://eva.invalid' + state.cwd.replace(/\/?$/, '/'));
  const decoded = decodeURIComponent(resolved.pathname);
  if (resolved.origin !== 'https://eva.invalid' || !decoded.startsWith(workspace)) throw Error('文件不在工作区内');
  return decoded.slice(workspace.length);
 }
 const services = {
  platform: 'android',
  call: (method, params) => kernelCall(method, params),
  openExternal: async href => {
   const url = new URL(href);
   if (!['https:', 'http:'].includes(url.protocol)) throw Error('链接类型不可用');
   EvaHost.openUrl(url.href);
  },
  reveal: async path => {
   const error = EvaHost.revealWorkspaceFile(relativePath(path));
   if (error) throw Error(error);
  },
  workspaceFileAction: async (action, path) => {
   const relative = relativePath(path);
   if (action === 'save-copy') EvaHost.exportWorkspaceFile(relative);
   else if (action === 'open-system') {
    const error = EvaHost.previewWorkspaceFile(relative);
    if (error) throw Error(error);
   } else throw Error('文件操作不可用');
   return {success: true};
  }
 };
 Object.assign(window.api ||= {}, services);
 window.cloudLinks ||= {open: href=>services.openExternal(href)};
 window.toast ||= notice;
 window.openTranscriptFile = path => services.workspaceFileAction('open-system', path);
 let imagePreview = null;
 function closeImage() {
  if (!imagePreview) return;
  imagePreview.instance.dispose();
  imagePreview.host.remove();
  imagePreview = null;
 }
 const previousBack = window.evaBack;
 window.evaBack = () => {
  if (imagePreview) { closeImage(); return true; }
  return previousBack?.() || false;
 };
 let desktopAgents;
 const renderer = EvaDesktopStream.create({
  state, els, api: window.api, workTimer: window.workTimer, workDuration: window.workDuration,
  mediaUrl: path => 'https://eva.invalid/generated-image?path=' + encodeURIComponent(path),
  transcriptBackgroundAgents: turn => [...(window.mobileSubagents?.references([turn])?.values() || [])]
   .map(agent => ({...agent, conversationId: agent.id, parentTurnKey: turn.id, displayName: globalThis.nativeTranscript?.agentName(agent.path)||agent.path?.split('/').at(-1)||'子智能体', status: ['completed', 'idle', 'interrupted', 'errored', 'shutdown'].includes(agent.status) ? 'done' : ['running','pendingInit'].includes(agent.status)?'active':'unknown'})).filter(agent=>agent.status!=='unknown'),
  renderAgentActivity: (item, turn) => desktopAgents?.renderAgentActivity(item, turn) || '',
  renderTranscript: () => {
   const flow = document.querySelector('.flow.desktop-stream-host');
   if (active() && flow) updateKernelFlow(active());
  },
  newChatProjectName: () => projectName(active()?.projectId)
 });
 desktopAgents=EvaDesktopSubagents.create({state,renderer});
 const actions = EvaDesktopStreamActions.create({
  state, renderer,
  scheduleTranscript: () => window.evaDesktopStream?.request(active()),
  copyText: copyClipboardText,
  closeModal: () => closeModelPanel(),
  modalShell: ({title, body, foot}) => {
   const modal = modelPanel(title);
   modal.classList.add('desktop-stream-host', 'turn-diff-panel');
   modal.innerHTML = body + (foot || '');
   return {modal, overlay: modal.parentElement};
  },
  renderOverlay: dialog => actions.modalDiff(dialog)
 });
 window.patchTranscriptDOM = (root, html, threadId, chunks) => renderer.patchTranscriptDOM(root, html, threadId, chunks);
 window.evaCodexMessages?.disable();
 window.evaOriginalActivity?.disable();
 window.activityDisclosure = EvaDesktopDisclosure.create({state, els, renderTranscript: () => {
  const flow = document.querySelector('.flow.desktop-stream-host');
  if (active() && flow) updateKernelFlow(active());
 }});

 function pendingUserMessage(chat) {
  if (!chat.pending) return null;
  const display = chat.pendingAttachmentDisplay?.pending === chat.pending ? chat.pendingAttachmentDisplay : null;
  const attachments = display?.attachments || chat.attachments || [];
  const text = display?.text ?? chat.pending;
  const content = [{type: 'text', text: localAttachmentText(text, attachments)}];
  return {id: 'pending:' + chat.id, type: 'userMessage', content};
 }
 function pendingMessage(chat) {
  const item = pendingUserMessage(chat);
  if (!item) return '';
  return renderer.renderUserMessage(item, {id: 'pending:' + chat.id}) +
   '<div class="turn-progress" role="status">正在发送…</div>';
 }
 function render(chat, flow) {
  if (active() !== chat) return;
  if (scheduledFrame) cancelAnimationFrame(scheduledFrame);
  scheduledFrame = 0;
  scheduledChat = null;
  const follow = window.evaChatScroll?.before(flow, chat.id);
  flow.classList.remove('welcome');
  flow.classList.add('desktop-stream-host');
  flow.dataset.theme = document.documentElement.dataset.theme || 'light';
  flow.id = 'thread-scroll';
  let transcript = flow.querySelector(':scope > #transcript');
  if (!transcript) {
   transcript = document.createElement('div');
   transcript.id = 'transcript';
   // Old message roots have already been disposed by the explicit mode switch.
   flow.replaceChildren(transcript);
  }
  els.transcript = transcript;
  els.threadScroll = flow;
  state.thread = chat.kernelThread || {id: 'pending:' + chat.id, turns: []};
  state.activeThreadId = state.thread.id;
  state.cwd = state.thread.cwd || workspace + (chat.projectId ? 'projects/' + chat.projectId : '');
  state.running = !!chat.running;
  state.approvals = [...kernelApprovals.values()].filter(row => row.params?.threadId === state.thread.id);
  if (window.agentQuestions?.hasPending?.(state.thread.id)) state.approvals.push({params: {threadId: state.thread.id}});
  const turns = state.thread.turns || [];
  const limit = flowHistoryLimits.get(chat) || 5;
  const chunks = [];
  const pendingUser = pendingUserMessage(chat);
  // The accepted turn can arrive before its userMessage echo. Render the local
  // message inside that turn so desktop thinking/activity follows the prompt.
  const pendingTurn = pendingUser ? turns.findLast(turn => {
   if (chat.pendingSend?.turnId) return turn.id === chat.pendingSend.turnId;
   if (chat.pendingSend?.baseTurnIds) return !chat.pendingSend.baseTurnIds.includes(turn.id);
   return turn.status === 'inProgress' && !(turn.items || []).some(item => item.type === 'userMessage');
  }) : null;
  if(state.thread.androidTurnsCursor)chunks.push('<button class="load-older" data-action="kernel-history-older">加载更早回合</button>');
  if (turns.length > limit) chunks.push('<button class="load-older" data-action="kernel-history-more">加载更早回合</button>');
  for (const turn of turns.slice(-limit)) {
   const needsUserEcho = turn === pendingTurn && !(turn.items || []).some(item => item.type === 'userMessage');
   const visibleTurn = needsUserEcho ? {...turn, items: [pendingUser, ...(turn.items || [])]} : turn;
   let html = renderer.renderTurn(visibleTurn, false);
   if (turn.androidSummary && turn.androidActivity?.hasActivity === true &&
       !(turn.items || []).some(item => !['userMessage', 'steeringUserMessage', 'agentMessage', 'reasoning'].includes(item.type))) {
    html += '<button class="load-older" data-desktop-history-turn="' + esc(turn.id) + '">查看执行过程</button>';
   }
   chunks.push(html);
  }
  if (!pendingTurn) chunks.push(pendingMessage(chat));
  for (const [key, approval] of kernelApprovals) if (approval.params?.threadId === state.thread.id) {
   chunks.push('<article class="kernel-approval"><b>操作需要确认</b><pre>' +
    esc(approval.params.command || approval.params.reason || approval.method) + '</pre>' +
    '<button data-action="kernel-approve:' + esc(key) + '">允许本次</button>' +
    '<button data-action="kernel-deny:' + esc(key) + '">拒绝</button></article>');
  }
  renderer.patchTranscriptDOM(transcript, chunks.join(''), state.thread.id, chunks);
  // Keyed transcript reconciliation can repaint a copied button during a late
  // event. Preserve its existing feedback deadline without starting a new one.
  for (const button of transcript.querySelectorAll('[data-copy-turn],[data-copy-code],[data-copy-text]')) if(copyFeedback.has(button))paintCopied(button);
  if (follow) flow.scrollTop = flow.scrollHeight;
  window.evaChatScroll?.after(flow);
  window.evaDesktopActivity?.paint();
 }

 document.addEventListener('click', async event => {
  const flow = event.target.closest?.('.flow.desktop-stream-host');
  if (!flow) return;
  const chat = active();
  const zoom = event.target.closest('[data-zoom],[data-image-src]');
  if (zoom) {
   closeImage();
   const host = document.createElement('div');
   host.setAttribute('role', 'dialog');
   host.setAttribute('aria-label', '图片预览');
   // The original preview owns its portal overlay and stacking.
   host.style.cssText = 'position:relative;z-index:1100';
   document.body.append(host);
   try {
    const instance = EvaOriginalCommonImagePreview.mount(host, {
     src: zoom.dataset.zoom || zoom.dataset.imageSrc,
     alt: zoom.querySelector('img')?.alt || '图片',
     onClose: () => queueMicrotask(closeImage)
    });
    imagePreview = {host, instance};
   } catch (error) { host.remove(); notice(error); }
   return;
  }
  const saved = event.target.closest('[data-save-generated],[data-reveal-generated]');
  if (saved) {
   try {
    if (saved.dataset.saveGenerated) await services.workspaceFileAction('save-copy', saved.dataset.saveGenerated);
    else await services.reveal(saved.dataset.revealGenerated);
   } catch (error) { notice(error); }
   return;
  }
  const toggle = event.target.closest('[data-toggle]');
  if (toggle) {
   if (window.activityDisclosure.toggle(toggle)) return;
   const key = toggle.dataset.toggle;
   renderer.setExpanded(key, !state.expanded.has(key));
   render(chat, flow);
   return;
  }
  const lazy = event.target.closest('[data-desktop-history-turn]');
  if (lazy) {
   lazy.disabled = true;
   try { await evaKernelHistory.loadItems(chat, lazy.dataset.desktopHistoryTurn); }
   catch (error) { if (!error.staleHistory) notice(error); }
   finally { if (lazy.isConnected) lazy.disabled = false; }
   return;
  }
  const file = event.target.closest('[data-artifact-path],[data-local-path]');
  if (file) {
   event.preventDefault();
   try { await window.openTranscriptFile(file.dataset.artifactPath || file.dataset.localPath); }
   catch (error) { notice(error); }
   return;
  }
  const copy = event.target.closest('[data-copy-turn]');
  if (copy) {
   if (!copyFeedback.has(copy) && actions.copyTurnText(copy.dataset.copyTurn)) copied(copy);
   return;
  }
  const code = event.target.closest('[data-copy-code]');
  const text = event.target.closest('[data-copy-text]');
  if (code || text) {
   if (copyFeedback.has(code || text)) return;
   const content = code ? code.closest('.code-block')?.querySelector('code')?.textContent : text.dataset.copyText;
   if (copyClipboardText(content)) copied(code || text);
   return;
  }
  const diff = event.target.closest('[data-turn-diff],[data-diff-item]');
  if (diff) {
   if (diff.dataset.turnDiff) actions.showTurnDiff(diff.dataset.turnDiff);
   else actions.showItemDiff(diff.dataset.diffItem);
   return;
  }
  const changedFile = event.target.closest('[data-turn-file]');
  if (changedFile) {
   const turn = chat.kernelThread?.turns?.find(row => row.id === changedFile.dataset.turnFile);
   const path = changedFile.dataset.changePath;
   const files = (turn?.items || []).flatMap(item => item.type === 'fileChange' ? item.changes || [] : [])
    .filter(change => change.path === path).map(change => ({path, diff: change.diff}));
   actions.modalDiff({title: path, files});
   return;
  }

 });
 function request(chat) {
  scheduledChat = chat;
  if (scheduledFrame) return;
  scheduledFrame = requestAnimationFrame(() => {
   const target = scheduledChat;
   scheduledFrame = 0;
   scheduledChat = null;
   if (target === active() && !settingPage && ['home', 'chat'].includes(route)) updateKernelFlow(target);
  });
 }
 window.evaDesktopStream = {enabled: true, render, request, renderer, state};
 const previousEvent = kernelEvent;
 kernelEvent = function(event) {
  previousEvent(event);
  const params = event.params || {};
  if (!params.threadId) return;
  const chat = active();
  state.thread = chat?.kernelThread || null;
  state.activeThreadId = state.thread?.id || null;
  state.activeTurnId = state.thread?.turns?.findLast(turn => turn.status === 'inProgress')?.id || null;
  if (event.method === 'turn/plan/updated' && params.turnId) {
   state.plans.set(params.turnId, {explanation: params.explanation, plan: params.plan});
   if (params.threadId === state.activeThreadId) request(chat);
  }
  if (event.method === 'turn/diff/updated' && params.turnId) {
   state.diffs.set(params.turnId, params.diff || '');
   if (params.threadId === state.activeThreadId) request(chat);
  }
  const message = params.error?.message || params.message || params.warning || params.summary;
  if (event.method === 'error' && message) {
   const retry = params.willRetry === true || params.willRetry !== false && /^Reconnecting(?:\.{3}|…)?\s*\d+\/\d+/i.test(message);
   actions.recordTurnConnection(params, retry ? 'retry' : 'failed', message);
  } else if (message && ['warning', 'guardianWarning', 'configWarning', 'deprecationNotice'].includes(event.method)) {
   if (/Falling back from WebSockets to HTTPS transport/i.test(message)) actions.recordTurnConnection(params, 'fallback', message);
   else if (/^Reconnecting(?:\.{3}|…)?\s*\d+\/\d+/i.test(message)) actions.recordTurnConnection(params, 'retry', message);
  } else if (event.method === 'turn/completed') actions.finishTurnConnection(params);
  else if (event.method?.startsWith('item/')) actions.recoverTurnConnection(params);
 };
 const current = active();
 if (current?.kernelThread || current?.pending) updateKernelFlow(current);
})();
