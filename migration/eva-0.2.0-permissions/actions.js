/* Codex clone — data loading, actions, notifications, wiring, boot */


/* ---------- data ---------- */

let historyRequestEpoch = 0;
const transcriptStreamBoundary=globalThis.streamState.createBoundary();

async function cuaConfigOption() {
  try {
    const cfg = await window.api.cuaConfig();
    return cfg ? { config: { "mcp_servers.cua_repl": { ...cfg, enabled: store.get("codex.cua", "1") === "1" } } } : {};
  } catch {
    return {};
  }
}

function mergeTurn(existing, incoming) {
  return globalThis.streamState.mergeTurn(existing,incoming);
}

function synchronizePendingTurn(threadId,turnId){
  const checkpoint=transcriptStreamBoundary.checkpoint(threadId,turnId);
  if(!checkpoint.size)return;
  const thread=state.thread,epoch=historyRequestEpoch,key=JSON.stringify([threadId,turnId]);
  const requests=state.streamSyncRequests||(state.streamSyncRequests=new Map());
  const running=requests.get(key);
  if(running?.epoch===epoch&&running.thread===thread)return;
  const token={epoch,thread};requests.set(key,token);
  const current=()=>requests.get(key)===token&&epoch===historyRequestEpoch&&state.thread===thread&&state.activeThreadId===threadId;
  showConversationError({message:'部分输出正在同步，请稍候。'});
  const notice=state.conversationError;
  if(notice)notice.streamSyncKey=key;
  Promise.resolve().then(()=>api.call('thread/read',{threadId,includeTurns:true})).then(response=>{
    if(!current())return;
    if(response.thread?.id!==threadId)throw Error('同步响应不属于当前对话。');
    const snapshot=response.thread?.turns?.find(turn=>turn.id===turnId),turn=findTurn(turnId);
    if(!turn)return;
    for(const [id,through]of checkpoint){
      const item=snapshot?.items?.find(item=>item.id===id);
      if(!item)continue;
      const live=turn.items?.find(item=>item.id===id);
      if(live){transcriptStreamBoundary.attach({threadId,turnId,itemId:id},live);continue;}
      const recovered={...item};
      transcriptStreamBoundary.attach({threadId,turnId,itemId:id},recovered,{source:'completion',through});
      const merged=globalThis.streamState.mergeTurn(turn,{...turn,items:(snapshot.items||[]).map(row=>row.id===id?recovered:turn.items?.find(i=>i.id===row.id)||row)});
      turn.items=merged.items;
    }
    if(transcriptStreamBoundary.checkpoint(threadId,turnId).size)throw Error('部分输出尚未同步，请重新打开此对话重试。');
    if(state.conversationError===notice)state.conversationError=null;
    scheduleTranscript();renderComposer();
  }).catch(error=>{
    if(!current())return;
    if(!transcriptStreamBoundary.checkpoint(threadId,turnId).size){if(state.conversationError===notice)state.conversationError=null;renderComposer();return;}
    if(state.conversationError===notice)showConversationError({message:'部分输出尚未同步，请重新打开此对话重试。'},{kind:'retry-open',threadId});
    if(typeof runtimeWarnings!=='undefined')runtimeWarnings.record?.(String(error.message||error),{key:'stream-sync:'+key});
  }).finally(()=>{if(requests.get(key)===token)requests.delete(key);});
}

function threadPreviewScope(){return JSON.stringify([state.meta?.codexHome||'',state.settingsData?.account?.account?.email||'']);}
function rememberThreadPreview(){
  const thread=state.thread;if(!thread?.id||state.loadingThread||!thread.turns?.length)return;
  const cache=state.threadPreviewCache||(state.threadPreviewCache=new Map()),text=JSON.stringify(thread);if(text.length>1024*1024)return;
  cache.delete(thread.id);cache.set(thread.id,{scope:threadPreviewScope(),at:Date.now(),size:text.length,thread:JSON.parse(text)});
  let bytes=[...cache.values()].reduce((n,v)=>n+v.size,0);while(cache.size>6||bytes>4*1024*1024){const id=cache.keys().next().value;bytes-=cache.get(id).size;cache.delete(id);}
}
function cachedThreadPreview(id){const value=state.threadPreviewCache?.get(id);return value&&value.scope===threadPreviewScope()&&Date.now()-value.at<120000?value.thread:null;}
function submittedUserTurn(turn,submission=state.submittingMessage){
  if(!turn||!submission||submission.threadId!==state.activeThreadId)return turn;
  return mergeTurn({id:turn.id,items:[{id:'submitted:'+submission.id,type:'userMessage',content:submission.input,_raeSubmitted:true}]},turn);
}
function conversationErrorText(error){
  const raw=String(error?.message||error).replace(/^Error invoking remote method '[^']+': Error: /,'');
  if(/missing source rollout|invalid paginated history lineage/i.test(raw))return '此对话的分页历史依赖不完整，请重试加载；已有记录已保留。';
  const quota=quotaFailureText(raw);if(quota)return quota;
  if(/is archived|archived.*unarchive/i.test(raw))return '此对话已归档，恢复后才能继续。';
  if(/not materialized yet/.test(raw))return '此聊天尚无消息记录。输入内容后即可开始。';
  if(/not found|does not exist/i.test(raw))return '未找到此对话，它可能已被移除。请刷新对话列表。';
  if(/timed out|timeout|network|fetch failed/i.test(raw))return '连接超时，输入内容已保留。请先核对是否已经发送，再决定是否重试。';
  if(/unauthorized|authentication|401|403|login/i.test(raw))return '账户或服务授权失效，请在设置中检查登录与模型服务。';
  return /[\u3400-\u9fff]/.test(raw)?raw:'请求未完成，输入内容已保留。请在运行记录中查看详细原因。';
}
function showConversationError(error,action){
  state.conversationError={message:conversationErrorText(error),raw:String(error?.message||error),threadId:state.activeThreadId,turnId:state.activeTurnId||state.thread?.turns?.at(-1)?.id,action};
  if(typeof runtimeWarnings!=='undefined')runtimeWarnings.record(String(error?.message||error),{key:'conversation-error:'+conversationErrorText(error)});
  renderComposer();
}

function saveTurnConnections(){try{if(typeof sessionStorage!=='undefined')sessionStorage.setItem('codex-rae.turnConnections',JSON.stringify([...(state.turnConnections||[])].slice(-200)));}catch{}}
function recordTurnConnection(params,kind,message){
  const threadId=params?.threadId,turnId=params?.turnId||(threadId===state.activeThreadId?state.activeTurnId:null);
  if(!threadId||!turnId)return false;
  const key=JSON.stringify([threadId,turnId]);state.turnConnections||=new Map();
  const old=state.turnConnections.get(key),turn=threadId===state.activeThreadId?state.thread?.turns?.find(t=>t.id===turnId):null;
  if(old?.finished||['completed','interrupted'].includes(turn?.status)||kind!=='failed'&&turn?.status==='failed')return true;
  const count=String(message).match(/^Reconnecting(?:\.{3}|…)?\s*(\d+)\/(\d+)\s*$/i);
  const text=kind==='retry'?(count?`正在重新连接…（第 ${Number(count[1])}/${Number(count[2])} 次）`:'连接暂时中断，正在重试…'):kind==='fallback'?'WebSocket 连接未成功，已切换为 HTTPS，正在继续连接…':kind==='failed'?'本次回复未完成，详细原因见错误信息或提示记录。':'连接已恢复，正在继续生成。';
  state.turnConnections.set(key,{kind,text,finished:false});
  while(state.turnConnections.size>200)state.turnConnections.delete(state.turnConnections.keys().next().value);
  saveTurnConnections();
  if(threadId===state.activeThreadId)scheduleTranscript();
  return true;
}
function finishTurnConnection(params){
  const key=JSON.stringify([params?.threadId,params?.turn?.id]),entry=state.turnConnections?.get(key);if(!entry)return;
  state.turnConnections.set(key,{...entry,kind:params.turn.status==='failed'?'failed':'finished',text:params.turn.status==='failed'?'本次回复未完成，详细原因见错误信息或提示记录。':entry.text,finished:true});
  saveTurnConnections();
}
function recoverTurnConnection(params){
  const key=JSON.stringify([params?.threadId,params?.turnId]);
  const entry=state.turnConnections?.get(key);
  // New progress acknowledges recovery; no permanent recovered footer is needed.
  if(entry&&!entry.finished&&['retry','fallback','recovered'].includes(entry.kind)){
    state.turnConnections.delete(key);saveTurnConnections();
    if(params.threadId===state.activeThreadId)scheduleTranscript();
  }
}

function syncRunningTurnFromTranscript() {
  const active = (state.thread?.turns || []).findLast(turn => turn.status === 'inProgress');
  state.running = !!active;
  state.activeTurnId = active?.id || null;
}

async function refreshThreads() {
  const sequence = state.threadListRequestSequence = (state.threadListRequestSequence || 0) + 1;
  state.loadingMoreThreads = false;
  state.threadListCursor = null;
  state.threadListParams = null;
  state.threadListError = null;
  state.threads = withActiveSidebarThread(state.threads);
  renderSidebar();
  try {
    const params = { limit: 200, sortKey: "updated_at", sortDirection: "desc", modelProviders: [] };
    if (state.searchTerm.trim()) params.searchTerm = state.searchTerm.trim();
    if (state.view === "archived") params.archived = true;
    const [response, sections] = await Promise.all([
      api.call("thread/list", params),
      api.call("threadSection/list", { limit: 100 }).catch(() => ({ data: [] })),
    ]);
    if (sequence !== state.threadListRequestSequence) return;
    state.threadListParams = params;
    state.threadListCursor = response.nextCursor || null;
    state.threads = withActiveSidebarThread(response.data);
    state.sections = sections?.data || [];
    renderSidebar();
    syncTabTitles();
  } catch (error) {
    console.warn("thread/list failed", error);
    if (sequence === state.threadListRequestSequence) { state.threadListError = '对话列表加载失败，请重试'; renderSidebar(); }
  }
}

// A freshly created persistent chat can precede the kernel's history index.
// Keep its real start/resume metadata visible while that index catches up.
function withActiveSidebarThread(rows) {
  const listed=uniqueThreadRows(rows),active=state.thread;
  if(state.view==='archived'||state.searchTerm.trim()||!active?.id||active.id!==state.activeThreadId||active.ephemeral||state.ephemeral||state.sideChatEphemeral||listed.some(row=>row.id===active.id))return listed;
  const {turns,...row}=active;
  row.cwd=active.cwd||state.cwd;
  row.updatedAt=row.updatedAt||row.createdAt||Math.floor(Date.now()/1000);
  return uniqueThreadRows([row,...listed]);
}

async function loadMoreThreads() {
  if (!state.threadListCursor || state.loadingMoreThreads || !state.threadListParams) return;
  const sequence = state.threadListRequestSequence;
  state.loadingMoreThreads = true;
  renderSidebar();
  try {
    const response = await api.call('thread/list', {...state.threadListParams, cursor:state.threadListCursor});
    if (sequence !== state.threadListRequestSequence) return;
    state.threads = uniqueThreadRows([...state.threads, ...(response.data || [])]);
    state.threadListCursor = response.nextCursor || null;
    syncTabTitles();
  } catch (error) {
    if (sequence === state.threadListRequestSequence) toast('加载更多对话失败：' + error.message);
  } finally {
    if (sequence === state.threadListRequestSequence) { state.loadingMoreThreads = false; renderSidebar(); }
  }
}

function syncTabTitles() {
  let changed = false;
  for (const tab of state.tabs) {
    const thread = state.threads.find((item) => item.id === tab.id);
    if (!thread) continue;
    const title = threadTitle(thread);
    if (title && title !== tab.title) {
      tab.title = title;
      changed = true;
    }
  }
  if (!changed) return;
  saveTabs();
  renderTabs();
}

async function createSection(name) {
  const trimmed = String(name || "").trim();
  if (!trimmed) return;
  try {
    await api.call("threadSection/create", { name: trimmed });
    await refreshThreads();
  } catch (error) {
    toast(error.message);
  }
}

async function renameSection(section, name) {
  const trimmed = String(name || "").trim();
  if (!trimmed || trimmed === section.name) return;
  try {
    await api.call("threadSection/update", { sectionId: section.id, name: trimmed });
    await refreshThreads();
  } catch (error) {
    toast(error.message);
  }
}

async function deleteSection(section) {
  try {
    await api.call("threadSection/delete", { sectionId: section.id });
    state.collapsedSections.delete(section.id);
    await refreshThreads();
  } catch (error) {
    toast(error.message);
  }
}

async function moveThreadToSection(thread, sectionId) {
  try {
    await api.call("threadSection/move", { threadId: thread.id, sectionId });
    await refreshThreads();
    if (state.thread?.id === thread.id) await openThread(thread.id, { keepNav: true });
  } catch (error) {
    toast(error.message);
  }
}

function openSectionPicker(thread, x, y) {
  const items = state.sections.map((section) => ({
    label: section.name,
    icon: thread.section?.id === section.id ? "check" : "folder",
    action: () => moveThreadToSection(thread, section.id),
  }));
  if (thread.section) {
    items.push({ separator: true });
    items.push({
      label: t("noSection"),
      icon: "x",
      action: () => moveThreadToSection(thread, null),
    });
  }
  openMenu(items.length ? items : [{ label: t("newSection"), icon: "plus", action: () => openSectionNameModal() }], {
    x,
    y,
  });
}

function openSectionMenu(section, x, y) {
  openMenu(
    [
      { label: t("newSection"), icon: "plus", action: () => openSectionNameModal() },
      {
        label: t("renameSection"),
        icon: "pencil",
        action: () => openSectionNameModal(section),
      },
      { separator: true },
      {
        label: t("deleteSection"),
        icon: "trash",
        danger: true,
        action: () => {
          state.modal = { kind: "deleteSection", section };
          renderOverlay();
        },
      },
    ],
    { x, y },
  );
}

function openSectionNameModal(section = null) {
  state.modal = { kind: "sectionName", section, value: section?.name || "" };
  renderOverlay();
}

let ratesSequence = 0;

async function readRateSnapshot() {
  const sequence = ++ratesSequence;
  try {
    const snapshot = await api.call("account/rateLimits/read", {});
    if (sequence === ratesSequence) {
      state.rates = snapshot;
      state.ratesUpdatedAt = Date.now();
      state.ratesError = null;
    }
    return snapshot;
  } catch (error) {
    if (sequence === ratesSequence) {
      state.rates = null;
      state.ratesError = error.message;
      state.ratesUpdatedAt = null;
    }
    throw error;
  }
}

async function refreshRates() {
  try {
    await readRateSnapshot();
    state.settingsData.rates = state.rates;
  } catch (error) {
    console.warn("rateLimits failed", error);
  } finally {
    renderRateBanner();
    globalThis.accountQuota?.sync();
    if (state.settingsOpen && state.settingsTab === "account") renderSettingsContent();
  }
}

async function loadModels() {
  globalThis.modelAccess?.refresh();
  try {
    const all=[],seen=new Set();let cursor=null,models;
    do {
      models=await api.call("model/list",{limit:100,...(cursor!=null?{cursor}:{})});
      all.push(...(models.data||[]));cursor=models.nextCursor??null;
      if(cursor!=null){if(seen.has(cursor))throw Error('模型目录分页游标重复');seen.add(cursor);}
    } while(cursor!=null);
    state.modelDiscovery=models?.discoveryStatus||null;
    state.models = all.filter((model) => !model.hidden && (model.model || model.id) !== "deepseek-flash");
    const ids = state.models.map((model) => model.model || model.id);
    if (!state.provider && (!state.model || !ids.includes(state.model))) {
      const preferred = state.models.find((model) => model.isDefault)?.model || ids[0] || null;
      state.model = state.model && ids.includes(state.model) ? state.model : preferred;
    }
    renderComposer();
  } catch (error) {
    console.warn("model/list failed", error);
  }
}

/* ---------- lifecycle ---------- */

function setView(view) {
  state.view = view;
  state.searchTerm = "";
  els.search.value = "";
  closeSettings();
  refreshThreads();
  render();
}

function setNav(threadId, push = true) {
  if (push) {
    state.navStack = state.navStack.slice(0, state.navIndex + 1);
    if (state.navStack[state.navStack.length - 1] !== threadId) state.navStack.push(threadId);
    state.navIndex = state.navStack.length - 1;
  }
  renderHead();
}

function cycleWindow(delta) {
  window.api?.cycleWindow?.(delta);
}

function openThreadInNewWindow(threadId) {
  const id = threadId || state.thread?.id || state.activeThreadId;
  if (!id) return;
  window.api?.newWindow?.(id);
}

function startNewThread(cwd, options = {}) {
  if(state.sideChatEphemeral){toast('请关闭当前临时聊天，再从主聊天创建新的侧边聊天。');return;}
  if (state.pendingSend) { toast(LANG === 'zh' ? '正在发送，请稍后再新建对话' : 'Wait for the message to finish sending'); return; }
  globalThis.composerDrafts?.save();
  if(typeof closeMention==='function')closeMention();
  state.conversationError=null;
  state.threadOpenFailed=false;
  closeCustomize(); closeAltPage(); closeSettings(); closeMenu();
  const wasArchived = state.view === 'archived';
  state.view = 'threads';
  historyRequestEpoch++;
  transcriptStreamBoundary.cancel();
  state.loadingThread = false;
  state.loadingOlder = false;
  if (cwd !== undefined) { state.cwd = cwd; store.set('codex-rae.draftCwd', cwd); }
  else state.cwd = state.thread ? (state.thread.projectless ? null : state.thread.cwd) : store.get('codex-rae.draftCwd', state.cwd ?? state.meta?.cwd);
  state.ephemeral = Boolean(options.ephemeral);
  state.activeThreadId = null;
  state.newDraftEpoch=(state.newDraftEpoch||0)+1;
  state.thread = null;
  state.running = false;
  state.activeTurnId = null;
  state.attachments = [];
  state.composerMentions=[];
  state.expanded.clear();
  state.olderCursor = null;
  state.goal = null;
  state.tokenUsage = null;
  state.plans.clear();
  state.diffs.clear();
  document.title = "Eva";
  store.set("codex.thread", null);
  globalThis.composerDrafts?.restore();
  setNav(null, false);
  render();
  if (wasArchived) refreshThreads();
  setTimeout(() => els.input.focus(), 0);
}

async function openThread(threadId, options = {}) {
  if(state.sideChatEphemeral)throw Error('临时侧边聊天不能切换为项目聊天。');
  if (state.pendingSend) { toast(LANG === 'zh' ? '正在发送，请稍后再切换对话' : 'Wait for the message to finish sending'); return; }
  if (!threadId) return;
  rememberThreadPreview();
  globalThis.composerDrafts?.save();
  if(typeof closeMention==='function')closeMention();
  state.conversationError=null;
  closeCustomize();
  const requestEpoch = ++historyRequestEpoch;
  transcriptStreamBoundary.begin(threadId,state.thread?.id===threadId?state.thread:cachedThreadPreview(threadId));
  closeSettings();
  state.loadingThread = true;
  state.threadOpenFailed=false;
  state.threadPreview=cachedThreadPreview(threadId);
  const retainedTurns=state.threadPreview?.turns||[];
  state.thread={...((state.threads||[]).find(t=>t.id===threadId)||state.threadPreview||{}),id:threadId,turns:[]};
  state.activeThreadId=threadId;
  state.running=false;state.activeTurnId=null;
  globalThis.composerDrafts?.restore();
  if(options.push!==false)setNav(threadId);
  state.loadingOlder = false;
  state.scrollReady = false;
  state.attachments = [];
  state.composerMentions=[];
  render();
  try {
    const readOnlyAgent=typeof subagentInteractionAllowed==='function'&&!subagentInteractionAllowed(state.thread);
    // Only prefetch history for a thread already loaded in this kernel. After
    // restarting the app, persisted threads must be resumed before turns/list.
    const earlyPage=readOnlyAgent?Promise.resolve(null):api.call('thread/loaded/list',{limit:100}).then(loaded=>{
      if(!loaded.data?.includes(threadId))return null;
      return api.call('thread/turns/list',{threadId,cursor:null,sortDirection:'desc',limit:10,itemsView:'full'});
    }).then(value=>{
      if(!value)return null;
      if(requestEpoch===historyRequestEpoch&&state.loadingThread&&value.data?.length){
        state.threadPreview={...(state.threads||[]).find(t=>t.id===threadId),id:threadId,turns:value.data.slice().reverse()};
        if(state.activeThreadId!==threadId){state.activeThreadId=threadId;state.thread={...state.threadPreview,turns:[]};}
        render();
      }
      return {value};
    }).catch(error=>({error}));
    const resume = readOnlyAgent?await api.call('thread/read',{threadId,includeTurns:true}):await api.call("thread/resume", {
      threadId,
      excludeTurns: true,
      ...(await cuaConfigOption()),
    });
    if (requestEpoch !== historyRequestEpoch) return;
    const thread = { ...resume.thread, turns: state.activeThreadId===threadId?(state.thread?.turns||[]):[] };
    state.thread = thread;
    state.ephemeral = false;
    state.activeThreadId = thread.id;
    globalThis.threadActivity?.read(thread.id);
    state.cwd = resume.cwd || thread.cwd || state.cwd;
    globalThis.composerDrafts?.restore();
    if(!readOnlyAgent){
      if (resume.model) state.model = resume.model;
      state.provider = state.providers.some(p => p.id === resume.modelProvider) ? resume.modelProvider : null;
      if (resume.reasoningEffort) state.effort = resume.reasoningEffort;
      state.mode = modeFromResume(resume);
    }
    state.running = thread.status?.type === "active";
    state.activeTurnId = null;
    state.expanded.clear();
    state.plans.clear();
    state.diffs.clear();
    state.goal = null;
    state.tokenUsage = null;
    state.olderCursor = resume.turnsBackwardsCursor || null;
    state.expandedProjects.add(projectKey(state.cwd));
    document.title = threadTitle(thread)+' — Eva';
    store.set("codex.thread", thread.id);
    renderHead();
    if (state.filePanelOpen) refreshFileTree();

    const early=resume.turnsBackwardsCursor?null:await earlyPage;
    const page = (readOnlyAgent?{data:(resume.thread.turns||[]).slice().reverse(),nextCursor:null}:early?.value) || await api.call("thread/turns/list", {
      threadId,
      cursor: resume.turnsBackwardsCursor || null,
      sortDirection: "desc",
      limit: 10,
      itemsView: "full",
    }).catch(error=>{if(String(error.message).includes(`thread ${threadId} is not materialized yet; thread/turns/list is unavailable before first user message`))return {data:[],nextCursor:null};throw error;});
    if (requestEpoch !== historyRequestEpoch) return;
    const turns = (page.data || []).slice().reverse();
    // Notifications can arrive while this older history snapshot is in flight.
    // Preserve those items/deltas and terminal statuses instead of replacing them.
    // REA Windows DDe/TDe retain already observed items when resume supplies a
    // partial snapshot. Keep this thread's in-memory items only for loaded turns;
    // pagination must not append unloaded turns or manufacture execution state.
    const previous=new Map(retainedTurns.map(turn=>[turn.id,turn]));
    const byId = new Map(turns.map(turn => [turn.id,mergeTurn(previous.get(turn.id),turn)]));
    for (const live of state.thread.turns || []) byId.set(live.id,globalThis.streamState.mergeTurn(byId.get(live.id),live,{order:'existing'}));
    state.thread.turns = [...byId.values()];
    for(const event of transcriptStreamBoundary.finish(state.thread))handleTranscriptNotification(event);
    globalThis.runtimeRecovery?.normalize(state.thread);
    ensureTab(state.thread);
    state.olderCursor = page.nextCursor || null;
    syncRunningTurnFromTranscript();
    state.loadingThread = false;
    state.threadPreview=null;
    rememberThreadPreview();
    render();
    requestAnimationFrame(() => {
      if (requestEpoch !== historyRequestEpoch) return;
      els.threadScroll.scrollTop = els.threadScroll.scrollHeight;
      rememberTranscriptViewport();
      setTimeout(() => {
        if (requestEpoch !== historyRequestEpoch) return;
        state.lastScrollTop = els.threadScroll.scrollTop;
        state.scrollReady = true;
      }, 120);
    });
    loadGoal();
  } catch (error) {
    if (requestEpoch !== historyRequestEpoch) return;
    if(state.thread?.id===threadId)for(const event of transcriptStreamBoundary.finish(state.thread))handleTranscriptNotification(event);
    else transcriptStreamBoundary.cancel(threadId);
    state.loadingThread = false;
    state.threadPreview=null;
    globalThis.composerDrafts?.restore();
    state.threadOpenFailed=true;
    render();
    if(/is archived|archived.*unarchive/i.test(error.message)){
      if(typeof removeTab==='function')removeTab(threadId);
      if(typeof renderTabs==='function')renderTabs();
      showConversationError(error,{kind:'unarchive',threadId});
    }else {state.threadOpenFailed=true;showConversationError(error,{kind:'retry-open',threadId});}
  }
}

function modeFromResume(resume) {
  const sandbox = resume?.sandbox;
  const type = typeof sandbox === "string" ? sandbox : sandbox?.type;
  if (type === "dangerFullAccess" || type === "danger-full-access") return "full";
  if (type === "readOnly" || type === "read-only") return "read";
  if(['auto_review','guardian_subagent'].includes(resume?.approvalsReviewer))return 'assisted';
  return "auto";
}

async function loadGoal() {
  if (!state.activeThreadId) return;
  const threadId = state.activeThreadId, requestEpoch = historyRequestEpoch;
  try {
    const response = await api.call("thread/goal/get", { threadId });
    if (state.activeThreadId !== threadId || requestEpoch !== historyRequestEpoch) return;
    state.goal = response.goal || null;
    renderGoalBar();
  } catch {
    if (state.activeThreadId === threadId && requestEpoch === historyRequestEpoch) state.goal = null;
  }
}

async function loadOlderTurns() {
  if (!state.olderCursor || state.loadingOlder || !state.activeThreadId) return;
  const threadId = state.activeThreadId;
  const requestEpoch = historyRequestEpoch;
  state.loadingOlder = true;
  renderTranscript();
  try {
    const page = await api.call("thread/turns/list", {
      threadId,
      cursor: state.olderCursor,
      sortDirection: "desc",
      limit: 20,
      itemsView: "full",
    });
    if (requestEpoch !== historyRequestEpoch || state.activeThreadId !== threadId || state.thread?.id !== threadId) return;
    const older = (page.data || []).slice().reverse();
    state.thread.turns = [...new Map([...older, ...state.thread.turns].map(t => [t.id, t])).values()];
    state.olderCursor = page.nextCursor || null;
  } catch (error) {
    if (requestEpoch === historyRequestEpoch && state.activeThreadId === threadId) toast(error.message);
  } finally {
    if (requestEpoch === historyRequestEpoch && state.activeThreadId === threadId) { state.loadingOlder = false; renderTranscript(); }
  }
}

/* ---------- commands ---------- */

async function pickImages() { return pickComposerAttachments(true); }

function openCreateProject() {
  closeMenu();
  state.modal = { kind: 'createProject', name: '', sources: [], initializeGit: false };
  renderOverlay();
}

async function pickProject() {
  try {
    if (api.localProjects?.openExisting) {
      const result = await api.localProjects.openExisting();
      if (!result || result.canceled || !result.project) return;
      acceptLocalProject(result.project);
    } else {
      const folder = await api.pickFolder();
      if (!folder) return;
      addProjectToSidebar(folder);
      startNewThread(folder);
      render();
    }
  } catch (error) { toast(error.message); }
}

function acceptLocalProject(project) {
  addProjectToSidebar(project.path || project.rootPaths[0], project);
  startNewThread(project.path || project.rootPaths[0]);
  render();
}

function addProjectToSidebar(folder, project = {}) {
  const key = projectKey(folder);
  const previous = state.localProjects[key];
  const next = { ...state.localProjects, [key]: { ...previous, ...project, name: previous?.name || project.name, path: folder, added: true, removed: false } };
  localStorage.setItem('codex-rae.projects', JSON.stringify(next));
  state.localProjects = next;
  state.collapsedProjects.delete(key);
  store.set('codex-rae.collapsedProjects', [...state.collapsedProjects]);
  state.expandedProjects.add(key);
  renderSidebar();
}

function openProjectCreationMenu(x, y) {
  openMenu([
    { label: '创建项目…', icon: 'plus', action: openCreateProject },
    { label: '打开项目文件夹…', icon: 'folder', action: pickProject },
  ], { x, y });
}

function focusProjects() {
  if (state.sidebarCollapsed) toggleSidebar();
  els.sidebarScroll.scrollTo({ top: 0, behavior: "smooth" });
}

function toggleSidebar() {
  state.sidebarCollapsed = !state.sidebarCollapsed;
  store.set("codex.sidebarCollapsed", state.sidebarCollapsed);
  renderSidebar();
}

async function setSearchVisible(visible) {
  if (visible) {
    els.searchWrap.classList.remove("hidden");
    els.search.focus();
    els.search.select();
  } else {
    els.searchWrap.classList.add("hidden");
    els.search.value = "";
    state.searchTerm = "";
    await refreshThreads();
  }
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    els.threadScroll.scrollTop = els.threadScroll.scrollHeight;
  });
}

function clearFindMarks() {
  document.querySelectorAll("#transcript mark.find-hit").forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    parent.replaceChild(document.createTextNode(mark.textContent || ""), mark);
    parent.normalize();
  });
  state.findHits = [];
  state.findIndex = 0;
}

function updateFindCount() {
  const count = document.querySelector(".find-count");
  if (!count) return;
  count.textContent = state.findHits.length
    ? `${state.findIndex + 1}/${state.findHits.length}`
    : "0/0";
}

function gotoFind(direction) {
  if (!state.findHits.length) return;
  state.findHits[state.findIndex]?.classList.remove("active");
  state.findIndex =
    (state.findIndex + direction + state.findHits.length) % state.findHits.length;
  const hit = state.findHits[state.findIndex];
  hit.classList.add("active");
  hit.scrollIntoView({ block: "center" });
  updateFindCount();
}

function runFind(query) {
  clearFindMarks();
  const needle = String(query || "").trim();
  if (!needle) {
    updateFindCount();
    return;
  }
  const lower = needle.toLowerCase();
  const walker = document.createTreeWalker(els.transcript, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      const parent = node.parentElement;
      if (!parent || parent.closest("script,style,mark.find-hit")) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const text = node.nodeValue || "";
    let index = text.toLowerCase().indexOf(lower);
    if (index < 0) continue;
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    while (index >= 0) {
      fragment.appendChild(document.createTextNode(text.slice(cursor, index)));
      const mark = document.createElement("mark");
      mark.className = "find-hit";
      mark.textContent = text.slice(index, index + needle.length);
      fragment.appendChild(mark);
      state.findHits.push(mark);
      cursor = index + needle.length;
      index = text.toLowerCase().indexOf(lower, cursor);
    }
    fragment.appendChild(document.createTextNode(text.slice(cursor)));
    node.parentNode?.replaceChild(fragment, node);
  }
  state.findIndex = 0;
  state.findHits[0]?.classList.add("active");
  state.findHits[0]?.scrollIntoView({ block: "center" });
  updateFindCount();
}

function closeFind() {
  state.findOpen = false;
  clearFindMarks();
  document.getElementById("find-bar")?.remove();
}

function openFind() {
  if (!state.thread) return;
  state.findOpen = true;
  let bar = document.getElementById("find-bar");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "find-bar";
    bar.className = "find-bar";
    bar.innerHTML = `
      <input class="find-input" id="find-input" placeholder="${esc(
        LANG === "zh" ? "在对话中查找" : "Find in conversation",
      )}" />
      <span class="find-count">0/0</span>
      <button class="find-btn" data-find="prev" title="${LANG === "zh" ? "上一个" : "Previous"}">↑</button>
      <button class="find-btn" data-find="next" title="${LANG === "zh" ? "下一个" : "Next"}">↓</button>
      <button class="find-btn" data-find="close" title="${esc(t("close"))}">×</button>`;
    els.app?.appendChild(bar);
    const input = bar.querySelector("#find-input");
    input.addEventListener("input", () => runFind(input.value));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        gotoFind(event.shiftKey ? -1 : 1);
      } else if (event.key === "Escape") {
        event.preventDefault();
        closeFind();
      }
    });
    bar.querySelector('[data-find="prev"]').addEventListener("click", () => gotoFind(-1));
    bar.querySelector('[data-find="next"]').addEventListener("click", () => gotoFind(1));
    bar.querySelector('[data-find="close"]').addEventListener("click", closeFind);
  }
  const input = bar.querySelector("#find-input");
  input.focus();
  input.select();
}

async function sendMessage(options = {}) {
  if(options.questionReply)return globalThis.nativeUserInputHost?.sendReply(options.questionReply);
  if (state.booting || state.loadingThread) return;
  if(typeof subagentInteractionAllowed==='function'&&!subagentInteractionAllowed()){renderComposer();return false;}
  if(typeof composerAttachmentsPending==='function'&&composerAttachmentsPending()){showConversationError('附件正在准备，请等待添加完成后发送。');return false;}
  if (state.connectionError) { showConversationError('内核连接已断开，请恢复连接并核对会话历史。'); return false; }
  if (globalThis.sendReceipts?.blocked()) { toast('请先核对上一次发送的受理状态，避免重复执行。'); return false; }
  if(state.sideChatEphemeral&&!state.thread){toast('临时侧边聊天已失效，请关闭后重新创建。');return;}
  const rawText = els.input.value;
  const text = rawText.trim() || (state.attachments.length ? '请查看附件。' : '');
  if (!text || state.pendingSend || state.loadingThread || state.threadOpenFailed) return;
  const authContext=()=>JSON.stringify([state.activeThreadId,state.cwd,state.provider,state.model,state.mode,state.effort,els.input.value,state.attachments.map(file=>file.path||file.url||file.name)]);
  const beforeAuth=authContext();
  if(globalThis.modelAccess&&!await modelAccess.ensure(state.provider))return false;
  if(state.pendingSend||state.loadingThread||state.threadOpenFailed)return false;
  if(beforeAuth!==authContext()){toast('输入或聊天已更改，请重新发送');return false;}
  const attachments = state.attachments.slice();
  const composerMentions=(state.composerMentions||[]).slice();
  const sendReceiptId=globalThis.crypto?.randomUUID?.()||('ui-'+Date.now()+'-'+Math.random().toString(16).slice(2));
  const draftKey = globalThis.composerDrafts?.key();
  globalThis.composerDrafts?.save();
  // Authentication cannot mutate the draft; freeze the verified creation context before sending.
  const context = { cwd: state.thread?.cwd || state.cwd, projectless:!state.thread&&state.cwd===null, model: state.model, provider: state.provider, mode: state.mode, effort: state.effort, serviceTier:typeof codexSelectedServiceTier==='function'?codexSelectedServiceTier():null, ephemeral: state.ephemeral };
  if (attachments.some(composerAttachmentIsImage) && state.providers.find(p => p.id === state.provider)?.capabilities?.imageInput === false) {
    toast("当前模型尚未验证图像输入能力，请移除附件或切换模型"); return;
  }
  const followUpThreadId=state.activeThreadId,followUpTurnId=state.activeTurnId;
  const isFollowUp=state.running||globalThis.followUps?.hasPending(followUpThreadId);
  const followUpAction=isFollowUp?globalThis.followUps?.intent(options?.followUpAction):null;
  if(state.running&&followUpAction==='steer'&&!followUpTurnId){showConversationError('正在同步当前任务状态，请稍后再发送。');return false;}
  state.pendingSend = true;
  state.conversationError=null;
  if(!isFollowUp)state.pendingSubmission={id:sendReceiptId,threadId:state.activeThreadId,text,attachments,mentions:composerMentions};
  els.input.value = "";
  state.attachments = [];
  state.composerMentions=[];
  autosize();
  renderComposer();

  try {
    if(typeof renderTranscript==='function')renderTranscript();
    if(followUpAction==='queue'){
      const input=composerInput(text,attachments,composerMentions);
      globalThis.followUps?.beginPending({id:sendReceiptId,threadId:followUpThreadId,params:followUps.params(context,followUpThreadId,input),display:{text:rawText,attachments,mentions:composerMentions}});
      const queued=await api.call('rae/follow-up/enqueue',{id:sendReceiptId,threadId:followUpThreadId,params:followUps.params(context,followUpThreadId,input),display:{text:rawText,attachments,mentions:composerMentions},ephemeral:context.ephemeral});
      globalThis.followUps?.acceptedPending(followUpThreadId,sendReceiptId,queued.entry,queued.data);
      globalThis.composerDrafts?.clear(draftKey);state.pendingSend=false;state.pendingSubmission=null;state.submittingMessage=null;renderComposer();return {queued:true,threadId:followUpThreadId,id:queued.entry.id};
    }
    if (followUpAction==='steer' && state.running && state.activeThreadId && state.activeTurnId) {
      const input = composerInput(text,attachments,composerMentions);
      globalThis.steeringState?.begin({threadId:followUpThreadId,id:sendReceiptId,targetTurnId:followUpTurnId,input,attachments,restoreMessage:rawText,nativeTurns:state.thread?.turns});
      renderTranscript();scrollToBottom();
      const steeringResult=await api.call("turn/steer", {
        _raeRequestId:sendReceiptId,
        threadId: followUpThreadId,
        expectedTurnId: followUpTurnId,
        input,
      });
      globalThis.steeringState?.accepted(followUpThreadId,sendReceiptId,{targetTurnId:steeringResult?.turnId??followUpTurnId});
      globalThis.composerDrafts?.clear(draftKey);
      state.pendingSend = false;
      renderComposer();renderTranscript();
      return;
    }

    if (!state.thread) {
      const mode = MODES[context.mode] || MODES.auto;
      const started = await api.call("thread/start", {
        cwd: context.cwd || undefined,
        ...(context.projectless?{_raeProjectless:true,_raeProjectlessPrompt:text}:{}),
        model: context.model || undefined,
        modelProvider: context.provider || undefined,
        approvalPolicy: mode.approvalPolicy,
        approvalsReviewer: mode.approvalsReviewer || 'user',
        sandbox: mode.sandbox,
        ephemeral: context.ephemeral || undefined,
        ...(await cuaConfigOption()),
      });
      if (context.provider && started.modelProvider !== context.provider) throw new Error("内核返回了不同的提供商，已停止发送，请检查模型设置");
      if(started.approvalsReviewer&&started.approvalsReviewer!==(mode.approvalsReviewer||'user')&&!(context.mode==='assisted'&&started.approvalsReviewer==='guardian_subagent'))throw new Error('内核返回了不同的批准方式，已停止发送，请检查权限设置');
      const actualCwd = started.cwd || started.thread.cwd;
      if(context.projectless&&(!started.thread.projectless||!actualCwd))throw Error('无项目聊天的工作空间尚未确认，已停止发送');
      if (context.cwd && [started.cwd, started.thread.cwd].filter(Boolean).some(cwd => projectKey(cwd) !== projectKey(context.cwd))) throw new Error('内核返回了不同的项目目录，已停止发送，请重新选择项目');
      if (context.model && started.model && started.model !== context.model) throw new Error('内核返回了不同的模型，已停止发送，请检查模型设置');
      state.thread = { ...started.thread, turns: [] };
      state.activeThreadId = started.thread.id;
      ensureTab(state.thread);
      state.cwd = actualCwd || context.cwd;
      context.cwd=state.cwd;
      state.running = false;
      document.title = threadTitle(state.thread)+' — Eva';
      store.set("codex.thread", state.thread.id);
      setNav(state.thread.id);
      if(!state.thread.projectless)state.expandedProjects.add(projectKey(state.cwd));
      render();
      refreshThreads();
    }

    const input = composerInput(text,attachments,composerMentions);
    const mode = MODES[context.mode] || MODES.auto;
    state.submittingMessage={id:sendReceiptId,threadId:state.thread.id,input};
    const sandboxPolicy =
      mode.sandbox === "danger-full-access"
        ? { type: "dangerFullAccess" }
        : mode.sandbox === "read-only"
          ? { type: "readOnly", networkAccess: false }
          : {
              type: "workspaceWrite",
              writableRoots: [context.cwd],
              networkAccess: false,
              excludeTmpdirEnvVar: false,
              excludeSlashTmp: false,
            };
    const response = await api.call("turn/start", {
      _raeRequestId:sendReceiptId,
      _evaFirstRequest:rawText,
      threadId: state.thread.id,
      input,
      model: context.model || undefined,
      effort: context.effort || undefined,
      serviceTierForTurn: context.provider ? undefined : context.serviceTier || 'default',
      approvalPolicy: mode.approvalPolicy,
      approvalsReviewer: mode.approvalsReviewer || 'user',
      sandboxPolicy,
    });
    const turn = submittedUserTurn(response?.turn);
    if(turn?.id)state.pendingSubmission=null;
    if (turn?.id) { globalThis.composerDrafts?.clear(draftKey); globalThis.composerDrafts?.clear(globalThis.composerDrafts?.key()); }
    if (turn) {
      const index = (state.thread.turns || []).findIndex((entry) => entry.id === turn.id);
      if (index >= 0) state.thread.turns[index] = mergeTurn(state.thread.turns[index], turn);
      else state.thread.turns = [...(state.thread.turns || []), turn];
      const merged = state.thread.turns.find(entry => entry.id === turn.id);
      state.running = merged.status === 'inProgress';
      state.activeTurnId = state.running ? turn.id : null;
      render();
      scrollToBottom();
    }
    state.pendingSend = false;
    state.pendingSubmission=null;
    state.submittingMessage=null;
    renderComposer();
    return turn?.id ? {threadId:state.thread.id,turnId:turn.id} : false;
  } catch (error) {
    state.pendingSend = false;
    state.pendingSubmission=null;
    state.submittingMessage=null;
    const uncertain=/RAE_SEND_UNCERTAIN:([a-zA-Z0-9-]+)/.exec(error.message);
    const queueUnknown=followUpAction==='queue'&&/timed out|timeout|disconnected|connection closed|内核.*断开/i.test(error.message);
    if(followUpAction==='steer'){
      if(uncertain)globalThis.steeringState?.unknown(followUpThreadId,sendReceiptId,error.message);
      else globalThis.steeringState?.rejected(followUpThreadId,sendReceiptId);
    }
    if(followUpAction==='queue'){
      if(queueUnknown)globalThis.followUps?.unknownPending(followUpThreadId,sendReceiptId,error.message);
      else globalThis.followUps?.rejectedPending(followUpThreadId,sendReceiptId);
    }
    // The pre-send draft stays in its own chat until acceptance. Never replace
    // another chat's composer if navigation happened while the RPC was pending.
    if(!isFollowUp||state.activeThreadId===followUpThreadId){
      if(!els.input.value.trim()&&!state.attachments.length){els.input.value=rawText;state.attachments=attachments;state.composerMentions=composerMentions;}
    }
    if(uncertain)globalThis.sendReceipts?.hold(uncertain[1],sendReceiptId,followUpThreadId||state.activeThreadId,composerInput(text,attachments,composerMentions),rawText,attachments);
    globalThis.composerDrafts?.save();
    renderComposer();
    autosize();
    if(typeof renderTranscript==='function')renderTranscript();
    if(isFollowUp&&state.activeThreadId!==followUpThreadId)toast('原聊天的后续消息发送未确认，请返回该聊天检查草稿与记录。');
    else showConversationError(uncertain||queueUnknown?'发送受理状态未知，草稿已保留，请先核对，避免重复执行。':error);
    return false;
  }
}

async function stopTurn() {
  if (!state.activeThreadId || !state.activeTurnId) return;
  const threadId=state.activeThreadId,turnId=state.activeTurnId;
  try {
    await api.call("turn/interrupt", {
      threadId,
      turnId,
    });
    if(typeof stopSubagentDescendants==='function')stopSubagentDescendants(threadId).catch(error=>runtimeWarnings.record(String(error?.message||error)));
  } catch (error) {
    toast(error.message);
  }
}

async function forkThread(thread) {
  try {
    const result = await api.call("thread/fork", { threadId: thread.id });
    await refreshThreads();
    if (result?.thread?.id) await openThread(result.thread.id);
  } catch (error) {
    toast(t("forkFailed", { msg: error.message }));
  }
}

async function compactThread(thread) {
  if(!thread?.id)return;
  const token=globalThis.contextCompaction?.beginManual(thread.id);
  try {
    // A successful response only schedules compaction. Native item events own
    // completion, just as automatic compaction does.
    await api.call("thread/compact/start", { threadId: thread.id });
  } catch (error) {
    globalThis.contextCompaction?.failManual(thread.id,token);
    toast(error.message);
  }
}

async function archiveThread(thread, archived = true) {
  try {
    await api.call(archived ? "thread/archive" : "thread/unarchive", { threadId: thread.id });
    if (archived && state.activeThreadId === thread.id) startNewThread();
    await refreshThreads();
    toast(archived ? t("archive") : t("unarchive"));
  } catch (error) {
    toast(error.message);
  }
}

function copyText(text) {
  navigator.clipboard.writeText(String(text ?? "")).then(
    () => toast(t("copied")),
    () => toast(t("copyFailed")),
  );
}

function showTurnDiff(turnId) {
  const diff = state.diffs.get(turnId);
  if (diff) {
    state.modal = { kind: "diff", title: t("turnDiff"), diff };
    renderOverlay();
    return;
  }
  const turn = state.thread?.turns.find((entry) => entry.id === turnId);
  const files = [];
  for (const item of turn?.items || []) {
    if (item.type === "fileChange") {
      for (const change of item.changes || []) files.push({ path: displayPath(change.path), diff: change.diff });
    }
  }
  state.modal = { kind: "diff", title: t("turnDiff"), files };
  renderOverlay();
}

function showItemDiff(itemId) {
  const turn = state.thread?.turns.find((entry) =>
    (entry.items || []).some((item) => item.id === itemId),
  );
  const item = turn?.items.find((entry) => entry.id === itemId);
  const files = (item?.changes || []).map((change) => ({ path: displayPath(change.path), diff: change.diff }));
  state.modal = { kind: "diff", title: t("diff"), files };
  renderOverlay();
}

function showLatestDiff() {
  const turns = state.thread?.turns || [];
  const withDiff = [...turns].reverse().find((turn) => state.diffs.has(turn.id));
  const target = withDiff || turns[turns.length - 1];
  if (!target) return toast(t("noDiff"));
  showTurnDiff(target.id);
}

function showRevert(threadId, turnId) {
  state.modal = { kind: "revert", threadId, turnId };
  renderOverlay();
}

function openReviewModal() {
  if (!state.activeThreadId) return toast(t("noDiff"));
  state.modal = { kind: "review", threadId: state.activeThreadId };
  renderOverlay();
}

function openGoalModal() {
  if (!state.activeThreadId) return toast(t("noDiff"));
  state.modal = { kind: "goal", threadId: state.activeThreadId };
  renderOverlay();
}

function renameCurrent() {
  if (!state.thread) return;
  state.modal = { kind: "rename", thread: state.thread, value: threadTitle(state.thread) };
  renderOverlay();
}

function compactCurrent() {
  if (state.thread) compactThread(state.thread);
}

function forkCurrent() {
  if (state.thread) forkThread(state.thread);
}

async function archiveCurrent() {
  const thread=state.thread;if(!thread)return;
  try{const context=await api.threadHeaderContext(thread.id);await archiveFromHeader(thread,context);}catch(error){toast(error.message,6000);}
}

function copyTurnText(turnId) {
  const turn = state.thread?.turns?.find(turn => turn.id === turnId);
  if (!turn) return;
  const text = finalAnswerItems(turn).map(item => item.text).join("\n\n").trim();
  copyText(text);
}

/* ---------- notifications ---------- */

function findTurn(turnId) {
  return state.thread?.turns.find((turn) => turn.id === turnId);
}

function upsertItem(turnId, item, {source='history'}={}) {
  if (!state.thread || !item) return;
  let turn = findTurn(turnId);
  if (!turn) {
    turn = { id: turnId, items: [], status: "inProgress" };
    state.thread.turns.push(turn);
  }
  turn.items = turn.items || [];
  if(item.type==='userMessage'&&!item._raeSubmitted){
    turn.items=globalThis.streamState.mergeTurn(turn,{id:turn.id,items:[item]},{source,order:'existing'}).items;
  }
  const index = turn.items.findIndex((entry) => entry.id === item.id);
  if (index >= 0) turn.items[index] = globalThis.streamState.mergeItem(turn.items[index],item,{source});
  else if(item.type==='userMessage'&&!turn.items.some(i=>i.type==='userMessage'))turn.items.unshift(item);
  else turn.items.push(item);
  transcriptStreamBoundary.attach({threadId:state.activeThreadId,turnId,itemId:item.id},turn.items.find(entry=>entry.id===item.id),{source});
  if(state.conversationError?.streamSyncKey===JSON.stringify([state.activeThreadId,turnId])&&!transcriptStreamBoundary.checkpoint(state.activeThreadId,turnId).size){state.conversationError=null;renderComposer();}
}

let transcriptTimer = null;
let transcriptRenderCost = 0;

function scheduleTranscript() {
  if (transcriptTimer) return;
  transcriptTimer = setTimeout(() => {
    transcriptTimer = null;
    const started=performance.now();
    renderTranscript();
    renderComposer();
    transcriptRenderCost=performance.now()-started;
  }, Math.max(24,Math.min(100,transcriptRenderCost)));
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  if (transcriptTimer) {
    clearTimeout(transcriptTimer);
    transcriptTimer = null;
  }
  renderTranscript();
  renderComposer();
  if (state.settingsData.account?.account?.type === "chatgpt") refreshRates();
});

window.addEventListener("focus", () => {
  if (state.settingsData.account?.account?.type === "chatgpt") refreshRates();
});
setInterval(() => {
  if (document.visibilityState === "visible" && state.settingsData.account?.account?.type === "chatgpt") refreshRates();
}, 60000);

function handleTranscriptNotification({ method, params }) {
  if(transcriptStreamBoundary.capture({method,params}))return;
  const streamField=/^item\/(?:agentMessage\/delta|plan\/delta|reasoning\/(?:summaryTextDelta|textDelta)|commandExecution\/outputDelta|fileChange\/outputDelta)$/.test(method);
  if(streamField&&params?.threadId===state.activeThreadId){
    recoverTurnConnection(params);
    const item=findTurn(params.turnId)?.items?.find(entry=>entry.id===params.itemId);
    transcriptStreamBoundary.delta(method,params,item);
    scheduleTranscript();return;
  }
  if(globalThis.threadActivity?.observe(method,params,document.visibilityState!=='hidden'&&document.hasFocus?.()!==false?state.activeThreadId:null))renderSidebar();
  switch (method) {
    case 'rae/worktrees/changed': globalThis.managedWorktreeSettings?.invalidate();if(state.settingsOpen&&state.settingsTab==='worktrees')managedWorktreeSettings.refresh();break;
    case 'rae/worktree/cwd-changed': if(params.threadId===state.activeThreadId&&state.thread){state.thread.cwd=params.cwd;state.cwd=params.cwd;renderHead();renderComposer();globalThis.workspaceProtection?.sync();}break;
    case 'rae/sidechat/cleanup': runtimeWarnings.record(params.message,{key:'sidechat-cleanup:'+params.threadId});globalThis.runtimeRecovery?.refresh();break;
    case 'rae/oauth/state':
      runtimeWarnings.record(params.message,{key:'oauth:'+params.name});state.settingsData.mcps=null;
      if(state.settingsOpen)loadSettingsData({refresh:true,keys:['mcps']}).then(()=>renderSettings()).catch(()=>{});
      if(params.state==='authorized'||params.state==='notLoggedIn')toast(params.message);break;
    case 'rae/catalog/updated': customizeCatalogUpdated();break;
    case 'skills/changed': customizeCatalogUpdated();break;
    case 'rae/catalog/refreshError': if(state.customize){customization.errors.push(params.message);renderCustomize();}break;
    case "thread/started": {
      const thread = params?.thread;
      if (thread && thread.id === state.activeThreadId && state.thread) {
        state.thread = { ...state.thread, ...thread, turns: state.thread.turns || [] };
      }
      refreshThreads();
      break;
    }
    case "thread/name/updated": {
      const name = params?.threadName ?? params?.name;
      if(typeof name!=='string')break;
      for(const thread of state.threads)if(thread.id===params.threadId)thread.name=name;
      if (params?.threadId === state.activeThreadId && state.thread) {
        state.thread.name = name;
        document.title = threadTitle(state.thread)+' — Eva';
        renderHead();
      }
      renderSidebar();refreshThreads();
      break;
    }
    case "thread/archived":
    case "thread/deleted":
    case "thread/unarchived": {
      refreshThreads();
      if(method!=="thread/unarchived"&&typeof removeTab==='function'){removeTab(params?.threadId);renderTabs();}
      if (method !== "thread/unarchived" && params?.threadId === state.activeThreadId) {
        startNewThread();
      }
      break;
    }
    case "thread/reverted": {
      if (params?.threadId === state.activeThreadId) openThread(state.activeThreadId, { push: false });
      break;
    }
    case "turn/started": {
      if (params?.threadId !== state.activeThreadId) break;
      const turn = submittedUserTurn(params.turn);
      if(state.pendingSubmission?.id===state.submittingMessage?.id)state.pendingSubmission=null;
      if (!turn) break;
      state.thread = state.thread || { id: state.activeThreadId, turns: [] };
      state.thread.turns = state.thread.turns || [];
      const index = state.thread.turns.findIndex((entry) => entry.id === turn.id);
      if (index >= 0) state.thread.turns[index] = mergeTurn(state.thread.turns[index], turn);
      else state.thread.turns.push(turn);
      for(const item of findTurn(turn.id)?.items||[])transcriptStreamBoundary.attach({threadId:params.threadId,turnId:turn.id,itemId:item.id},item);
      syncRunningTurnFromTranscript();
      scheduleTranscript();
      break;
    }
    case "turn/completed": {
      finishTurnConnection(params);
      if (params?.threadId !== state.activeThreadId) break;
      const turn = params.turn;
      state.thread = state.thread || {id:state.activeThreadId,turns:[]};
      state.thread.turns = state.thread.turns || [];
      if (turn) {
        const index = state.thread.turns.findIndex((entry) => entry.id === turn.id);
        if (index >= 0) state.thread.turns[index] = globalThis.streamState.mergeTurn(state.thread.turns[index],turn,{source:'completion'});
        else state.thread.turns.push(turn);
        for(const item of findTurn(turn.id)?.items||[])transcriptStreamBoundary.attach({threadId:params.threadId,turnId:turn.id,itemId:item.id},item,{source:turn.items?.some(row=>row.id===item.id)?'completion':'history'});
      }
      syncRunningTurnFromTranscript();
      // The send promise owns pendingSend. An older completion must not unlock
      // a newer in-flight submission or revive a terminal turn on late start.
      if (state.thread) ensureTab(state.thread);
      if(turn)synchronizePendingTurn(params.threadId,turn.id);
      refreshThreads();
      refreshRates();
      scheduleTranscript();
      break;
    }
    case "item/started":
    case "item/completed": {
      recoverTurnConnection(params);
      if (params?.threadId !== state.activeThreadId) break;
      upsertItem(params.turnId, params.item,{source:method==='item/completed'?'completion':'history'});
      globalThis.nativeUserInputHost?.observeItem(method,params);
      scheduleTranscript();
      break;
    }
    case "item/agentMessage/delta": {
      recoverTurnConnection(params);
      if (params?.threadId !== state.activeThreadId) break;
      const item = findTurn(params.turnId)?.items.find((entry) => entry.id === params.itemId);
      if (item) item.text = (item.text || "") + (params.delta || "");
      scheduleTranscript();
      break;
    }
    case "item/mcpToolCall/progress": {
      recoverTurnConnection(params);
      if(params?.threadId!==state.activeThreadId)break;
      const item=findTurn(params.turnId)?.items.find(entry=>entry.id===params.itemId);
      if(item)item.progressMessage=params.message;
      scheduleTranscript();break;
    }
    case "item/plan/delta": {
      recoverTurnConnection(params);
      if (params?.threadId !== state.activeThreadId) break;
      const item = findTurn(params.turnId)?.items.find((entry) => entry.id === params.itemId);
      if (item) item.text = (item.text || "") + (params.delta || "");
      scheduleTranscript();
      break;
    }
    case "item/reasoning/summaryPartAdded": {
      if (params?.threadId !== state.activeThreadId) break;
      const item = findTurn(params.turnId)?.items.find((entry) => entry.id === params.itemId);
      if (item) {
        item.summary = item.summary || [];
        item.summary[params.summaryIndex ?? item.summary.length] ??= "";
      }
      scheduleTranscript();
      break;
    }
    case "item/reasoning/summaryTextDelta":
    case "item/reasoning/textDelta": {
      recoverTurnConnection(params);
      if (params?.threadId !== state.activeThreadId) break;
      const item = findTurn(params.turnId)?.items.find((entry) => entry.id === params.itemId);
      if (!item) break;
      if (method === "item/reasoning/summaryTextDelta") {
        item.summary = item.summary || [];
        const index = params.summaryIndex ?? 0;
        item.summary[index] = (item.summary[index] || "") + (params.delta || "");
      } else {
        item.content = item.content || [];
        item.content[0] = (item.content[0] || "") + (params.delta || "");
      }
      scheduleTranscript();
      break;
    }
    case "item/commandExecution/outputDelta": {
      recoverTurnConnection(params);
      if (params?.threadId !== state.activeThreadId) break;
      const item = findTurn(params.turnId)?.items.find((entry) => entry.id === params.itemId);
      if (item) item.aggregatedOutput = (item.aggregatedOutput || "") + (params.delta || params.chunk || "");
      scheduleTranscript();
      break;
    }
    case "item/fileChange/outputDelta": {
      recoverTurnConnection(params);
      if (params?.threadId !== state.activeThreadId) break;
      const item = findTurn(params.turnId)?.items.find((entry) => entry.id === params.itemId);
      if (item) item.output = (item.output || "") + (params.delta || params.chunk || "");
      scheduleTranscript();
      break;
    }
    case "turn/diff/updated": {
      if (params?.threadId !== state.activeThreadId) break;
      if (params.turnId) state.diffs.set(params.turnId, params.diff || "");
      scheduleTranscript();
      break;
    }
    case "turn/plan/updated": {
      if (params?.threadId !== state.activeThreadId) break;
      state.plans.set(params.turnId, { explanation: params.explanation, plan: params.plan });
      scheduleTranscript();
      break;
    }
    case "thread/goal/updated": {
      if (params?.threadId !== state.activeThreadId) break;
      state.goal = params.goal || null;
      renderGoalBar();
      break;
    }
    case "thread/goal/cleared": {
      if (params?.threadId !== state.activeThreadId) break;
      state.goal = null;
      renderGoalBar();
      break;
    }
    case "thread/tokenUsage/updated": {
      if (params?.threadId !== state.activeThreadId) break;
      const usage = params.tokenUsage?.total || params.tokenUsage;
      state.tokenUsage = usage
        ? { totalTokens: usage.totalTokens ?? usage.total_tokens ?? null }
        : null;
      renderComposer();
      break;
    }
    case "thread/status/changed": {
      if (params?.threadId !== state.activeThreadId) break;
      const type = params.status?.type;
      state.running = type === "active";
      renderSidebar();
      renderComposer();
      break;
    }
    case "account/rateLimits/updated": {
      refreshRates();
      break;
    }
    case "account/login/completed": {
      completeChatgptLogin(params);
      break;
    }
    case "account/updated": {
      state.threadPreviewCache?.clear();state.threadPreview=null;
      refreshAccountState();
      break;
    }
    case "mcpServer/startupStatus/updated": {
      if (state.settingsOpen && state.settingsTab === "connections") loadSettingsData();
      break;
    }
    case "warning":
    case "guardianWarning":
    case "configWarning":
    case "deprecationNotice": {
      const message = params?.message || params?.warning || params?.summary;
      if(message){
        runtimeWarnings.record(message);
        if(/Falling back from WebSockets to HTTPS transport/i.test(message))recordTurnConnection(params,'fallback',message);
        else if(/^Reconnecting(?:\.{3}|…)?\s*\d+\/\d+/i.test(message))recordTurnConnection(params,'retry',message);
      }
      break;
    }
    case "error": {
      const message = params?.error?.message || params?.message || safeJson(params).slice(0, 300);
      runtimeWarnings.record(message,{key:'turn-error:'+params?.threadId+':'+params?.turnId});
      const retry=params?.willRetry===true||params?.willRetry!==false&&/^Reconnecting(?:\.{3}|…)?\s*\d+\/\d+/i.test(message);
      if(!recordTurnConnection(params,retry?'retry':'failed',message)&&!retry)showConversationError(params?.error||message);
      break;
    }
    default:
      break;
  }
}
api.onNotification(handleTranscriptNotification);

api.onServerRequest((request) => {
  let kind = "other";
  if (
    request.method === "item/commandExecution/requestApproval" ||
    request.method === "execCommandApproval"
  ) {
    kind = "command";
  } else if (
    request.method === "item/fileChange/requestApproval" ||
    request.method === "applyPatchApproval"
  ) {
    kind = "fileChange";
  } else if (request.method === "item/tool/requestUserInput") {
    kind = "userInput";
  } else if (request.method === "mcpServer/elicitation/request") {
    kind = "elicitation";
  }
  state.approvals.push({ ...request, kind });
  renderOverlay();
});

api.onClosed((info) => {
  state.running = false;
  state.activeTurnId = null;
  state.connectionError = true;
  state.approvals = [];
  renderOverlay();
  runtimeWarnings.record(t("serverStopped", { code: info?.code ?? "?" }));
  renderComposer();
});

api.onBootError(({ message }) => {
  state.connectionError = true;
  runtimeWarnings.record(t("bootFailed", { msg: message }));
  renderComposer();
});

api.onReady?.(async () => { state.connectionError = null; await globalThis.runtimeRecovery?.refresh(); if(state.activeThreadId&&!state.pendingSend&&!state.sideChatEphemeral)await openThread(state.activeThreadId,{push:false});renderComposer(); });
document.getElementById('connection-restart').addEventListener('click', async () => {
  globalThis.composerDrafts?.save();
  try { await api.call('rae/runtime/recover'); } catch (error) { showConversationError('恢复连接失败，请检查内核状态后重试。');runtimeWarnings.record(error.message); }
});

/* ---------- wiring ---------- */

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if(event.defaultPrevented)return;
    // The original application menu consumes Escape in its own listener.
    // Its event must not dismiss the underlying customization route as well.
    if(globalThis.EvaNativeWorkspace?.desktopRoot(document.getElementById('native-desktop-header'))?.querySelector('#application-menu-content'))return;
    // The retained plugin controls own dismissal; do not close Customize beneath them.
    if(event.composedPath().some(node=>node?.classList?.contains('eva-native-plugin-add'))||document.querySelector('.eva-native-plugin-add [role="dialog"],.eva-native-plugin-add [role="menu"]'))return;
    if (state.modal || els.modalRoot.children.length) closeModal();
    else if (state.menu) closeMenu();
    else if (!els.filePreview.classList.contains("hidden")) closeFilePreview();
    else if (state.findOpen) closeFind();
    else if (state.settingsOpen) closeSettings();
    else if (state.customize&&customization.detail) backPluginCatalog();
    else if (state.customize) closeCustomize();
    else if (state.slash.open) closeSlash();
    else if (state.mention.open) closeMention();
  }
});

els.tbMenu.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-menu]");
  if (button) openTitlebarMenu(button);
});

els.navBack.addEventListener("click", () => {
  if(state.altPage==='sites'){closeAltPage();render();return;}
  if (state.settingsOpen) {
    closeSettings();
    return;
  }
  if (state.navIndex <= 0) return;
  state.navIndex -= 1;
  const id = state.navStack[state.navIndex];
  if (id) openThread(id, { push: false });
  else startNewThread();
  renderHead();
});

els.navForward.addEventListener("click", () => {
  if (state.navIndex >= state.navStack.length - 1) return;
  state.navIndex += 1;
  const id = state.navStack[state.navIndex];
  if (id) openThread(id, { push: false });
  renderHead();
});

els.tbSidebar.addEventListener("click", toggleSidebar);
els.headSidebar.addEventListener("click", toggleSidebar);

function toggleOutputs() {
  if (!state.thread) return;
  if (summaryDisplayMode() === 'overlay') state.summaryPopoverOpen = !state.summaryPopoverOpen;
  else {
    state.outputsOpen = !state.outputsOpen;
    store.set("codex.outputsOpen", state.outputsOpen);
  }
  state.summaryHover=false;
  renderOutputsPanel();
  globalThis.nativeWorkspace?.render();
}
let summaryStageWidth = 0;
function summaryDisplayMode() {
  const width=summaryStageWidth;
  const gutter=(width-736)/2;
  return gutter<180?'overlay':gutter<400?'shift':'gutter';
}
function dismissSummaryPopover(returnFocus=false) {
  if(!state.summaryPopoverOpen&&!state.summaryHover)return;
  state.summaryPopoverOpen=false;state.summaryHover=false;renderOutputsPanel();
  if(returnFocus)(globalThis.__summaryReturnFocus||document.getElementById('head-summary'))?.focus({preventScroll:true});
  globalThis.nativeWorkspace?.render();
}
document.addEventListener('pointerdown',event=>{
  if(!state.summaryPopoverOpen)return;
  if(event.composedPath().some(n=>n===els.outputsPanel||n===globalThis.__summaryReturnFocus||n?.id==='head-summary'||n?.getAttribute?.('aria-label')==='切换摘要'))return;
  dismissSummaryPopover();
});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&state.summaryPopoverOpen){dismissSummaryPopover(true);event.preventDefault();}});
new ResizeObserver(entries=>{const width=entries[0]?.contentRect.width||0;if(width===summaryStageWidth)return;summaryStageWidth=width;if(summaryDisplayMode()!=='overlay')state.summaryPopoverOpen=false;renderOutputsPanel();}).observe(document.querySelector('.conversation-stage'));
document.getElementById('head-summary').addEventListener('click', toggleOutputs);
let summaryHoverTimer;
const showSummaryHover=()=>{clearTimeout(summaryHoverTimer);if(!state.outputsOpen&&state.thread){state.summaryHover=true;renderOutputsPanel();}};
const hideSummaryHover=()=>{summaryHoverTimer=setTimeout(()=>{if(!state.outputsOpen){state.summaryHover=false;renderOutputsPanel();}},120);};
document.getElementById('head-summary').addEventListener('pointerenter',showSummaryHover);
document.getElementById('head-summary').addEventListener('pointerleave',hideSummaryHover);
els.outputsPanel.addEventListener('pointerenter',()=>clearTimeout(summaryHoverTimer));
els.outputsPanel.addEventListener('pointerleave',hideSummaryHover);
els.headOutputs.addEventListener('click', () => openWorkspaceHome());
els.outputsPanel.addEventListener("click", event => {
  if (event.target.closest('[data-new-output]')) { openCreateOutputMenu(event.target.closest('[data-new-output]')); return; }
  if (event.target.closest('[data-add-source]')) { pickImages(); return; }
  if (event.target.closest('[data-close-outputs]')) { toggleOutputs(); return; }
  const output = event.target.closest('[data-artifact-path], [data-artifact-url]');
  if (!output) return;
  const request = output.dataset.artifactPath ? openTranscriptFile(output.dataset.artifactPath) : api.openExternal(output.dataset.artifactUrl);
  request.catch(error => toast(error.message, 6000));
});

els.rail.addEventListener("click", (event) => {
  const button = event.target.closest("[data-rail]");
  if (!button) return;
  const key = button.dataset.rail;
    if (key === "new") startNewThread();
    else if (key === "chats") { closeCustomize(); state.sidebarCollapsed = false; store.set("codex.sidebarCollapsed", false); closeAltPage(); setView("threads"); }
    else if (["scheduled", "images", "library", "sites"].includes(key)) { closeSettings(); openAltPage(key); }
    else if (key === "review") { closeCustomize(); closeSettings(); closeAltPage(); openReviewModal(); }
    else if (key === "archived") { closeAltPage(); setView("archived"); }
  else if (key === "skills" || key === "plugins") openCustomize(key);
  else if (key === "projects") focusProjects();
  else if (key === "browser") toggleBrowserPanel();
  else if (key === "more") {
    const rect = button.getBoundingClientRect();
    openMenu(
      [
        { label: t("projects"), icon: "layers", action: () => { closeAltPage(); setView("threads"); focusProjects(); } },
        { label: t("archived"), icon: "archive", action: () => { closeAltPage(); setView("archived"); } },
        { label: t("browser"), icon: "globe", action: () => toggleBrowserPanel() },
        { label: t("addProject"), icon: "plus", action: () => pickProject() },
        { label: t("newSection"), icon: "folder", action: () => openSectionNameModal() },
        { separator: true },
        { label: t("settings"), icon: "gear", action: () => openSettings("account") },
        { label: t("skills"), icon: "sparkle", action: () => openSettings("skills") },
      ],
      { x: rect.right + 8, y: rect.top },
    );
  }
  else if (key === "settings") {
    if (state.settingsOpen) closeSettings();
    else openSettings("account");
  }
  else if (key === "account") {
    globalThis.accountQuota.open(button);
  }
});

els.newThread.addEventListener("click", () => startNewThread());
els.searchToggle.addEventListener("click", () =>
  setSearchVisible(els.searchWrap.classList.contains("hidden")),
);
els.notifications.addEventListener("click", () => {
  runtimeWarnings.open();
});
els.searchClear.addEventListener("click", () => {
  els.search.value = "";
  state.searchTerm = "";
  refreshThreads();
  els.search.focus();
});

const searchDebounced = debounce(() => refreshThreads(), 220);
els.search.addEventListener("input", () => {
  state.searchTerm = els.search.value;
  searchDebounced();
});

els.workspaceName.addEventListener("click", () => productModes.menu());

els.sidebar.addEventListener("click", (event) => {
  const threadButton = event.target.closest("[data-thread]");
  if (threadButton) {
    openThread(threadButton.dataset.thread);
    return;
  }
  const sectionToggle = event.target.closest("[data-section-toggle]");
  if (sectionToggle) {
    const id = sectionToggle.dataset.sectionToggle;
    if (state.collapsedSections.has(id)) state.collapsedSections.delete(id);
    else state.collapsedSections.add(id);
    store.set('codex-rae.collapsedSections', [...state.collapsedSections]);
    renderSidebar();
    return;
  }
  const sectionMenu = event.target.closest("[data-section-menu]");
  if (sectionMenu) {
    const section = state.sections.find((entry) => entry.id === sectionMenu.dataset.sectionMenu);
    if (section) {
      const rect = sectionMenu.getBoundingClientRect();
      openSectionMenu(section, rect.left, rect.bottom + 4);
    }
    return;
  }
  const project = event.target.closest("[data-project]");
  if (project) {
    const key = project.dataset.project;
    if (state.collapsedProjects.has(key)) state.collapsedProjects.delete(key);
    else state.collapsedProjects.add(key);
    store.set("codex-rae.collapsedProjects", [...state.collapsedProjects]);
    renderSidebar();
    return;
  }
  const more = event.target.closest("[data-more-project]");
  if (more) {
    state.projectLimits[more.dataset.moreProject] = Number.MAX_SAFE_INTEGER;
    store.set("codex-rae.projectLimits", state.projectLimits);
    renderSidebar();
    return;
  }
  const less = event.target.closest("[data-less-project]");
  if (less) {
    state.projectLimits[less.dataset.lessProject] = 7;
    store.set("codex-rae.projectLimits", state.projectLimits);
    renderSidebar();
    return;
  }
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "create-project") openCreateProject();
  else if (action === "add-project") pickProject();
  else if (action === "new-section") openSectionNameModal();
  else if (action === "toggle-recent") {
    state.collapsedRecent = !state.collapsedRecent;
    store.set("codex-rae.collapsedRecent", state.collapsedRecent);
    renderSidebar();
  } else if (action === "back-threads") setView("threads");
});

els.sidebar.addEventListener("contextmenu", (event) => {
  const project = event.target.closest('[data-project]');
  if (project) {
    event.preventDefault();
    const group = collectProjects().find(g => g.key === project.dataset.project);
    if (group) openProjectMenu(group, event.clientX, event.clientY);
    return;
  }
  const section = event.target.closest('[data-section-toggle], [data-section-menu]');
  if (section) {
    event.preventDefault();
    const entry = state.sections.find(s => s.id === (section.dataset.sectionToggle || section.dataset.sectionMenu));
    if (entry) openSectionMenu(entry, event.clientX, event.clientY);
    return;
  }
  const threadButton = event.target.closest("[data-thread]");
  if (!threadButton) {
    if (event.target.closest('[data-project-section], #thread-list') || event.target === els.sidebar) {
      event.preventDefault(); openProjectCreationMenu(event.clientX, event.clientY);
    }
    return;
  }
  event.preventDefault();
  const thread = state.threads.find((entry) => entry.id === threadButton.dataset.thread);
  if (thread) openThreadMenu(thread, event.clientX, event.clientY);
});

function openProjectMenu(group, x, y) {
  openMenu([
    { label: group.name, heading: true },
    { label: '创建项目…', icon: 'plus', action: openCreateProject },
    { label: '打开项目文件夹…', icon: 'folder', action: pickProject },
    { label: t('newChat'), icon: 'compose', disabled: state.running, action: () => startNewThread(group.path) },
    { label: state.collapsedProjects.has(group.key) ? '展开项目' : '折叠项目', icon: 'folder', action: () => { document.querySelector(`[data-project="${CSS.escape(group.key)}"]`)?.click(); } },
    { separator: true },
    { label: '编辑项目…', icon: 'pencil', action: () => { state.modal = { kind: 'project', group, editing: true }; renderOverlay(); } },
    { label: '属性', icon: 'info', action: () => { state.modal = { kind: 'project', group }; renderOverlay(); } },
    { separator: true },
    { label: t('copyPath'), icon: 'copy', action: () => copyText(group.path) },
    { label: t('reveal'), icon: 'folder', action: () => api.reveal(group.path).catch(e => toast(e.message)) },
    { separator: true },
    { label: LANG === 'zh' ? '移除项目' : 'Remove project', icon: 'x', action: () => removeProject(group) },
  ], { x, y });
}

function removeProject(group) {
  try {
    // Retain a local tombstone: thread refresh and shared trust config must not re-add it.
    const next = { ...state.localProjects, [group.key]: { ...state.localProjects[group.key], path: group.path, removed: true } };
    localStorage.setItem('codex-rae.projects', JSON.stringify(next));
    state.localProjects = next;
    renderSidebar();
    toast(LANG === 'zh' ? '已移除项目。文件与会话保留，可通过“打开项目文件夹”重新添加。' : 'Project removed. Files and chats are kept; open the project folder to add it again.');
  } catch (error) { toast(error.message); }
}

els.crumbs.addEventListener("click", (event) => {
  if (event.target.closest('[data-action="project-menu"]')) {
    const rect = els.crumbs.getBoundingClientRect();
    openMenu(
      [
        { label: basename(state.cwd || ""), heading: true },
        { label: t("newChat"), icon: "compose", action: () => startNewThread() },
        { label: LANG === "zh" ? "打开项目文件夹…" : "Open project folder…", icon: "folder", action: () => pickProject() },
        { label: t("copyPath"), icon: "copy", action: () => copyText(state.cwd || "") },
        { label: t("reveal"), icon: "external", action: () => state.cwd && api.reveal?.(state.cwd) },
      ],
      { rect },
    );
  }
});

els.headDiff.addEventListener("click", () => showLatestDiff());

async function openThreadMore(anchor=els.headMore) {
  if (!state.thread) return;
  const thread=state.thread;
  const rect = anchor.getBoundingClientRect();
  openMenu([{label:'正在读取聊天操作…',disabled:true}],{rect,anchor});
  const loadingMenu=state.menu;
  let context;
  try{context=await api.threadHeaderContext(thread.id);}catch(error){if(state.menu===loadingMenu)openMenu([{label:error.message,disabled:true},{label:'重试',action:()=>openThreadMore(anchor)}],{rect,anchor});return;}
  if(state.thread?.id!==thread.id||state.menu!==loadingMenu)return;
  const isChild=!!(thread.parentThreadId||thread.source?.subAgent),ephemeral=thread.ephemeral===true;
  const forkItems=isChild||ephemeral||!context.canFork?[]:[{label:context.git.isWorktree?'在同一工作树中分叉':'在本地分叉',action:()=>forkFromHeader(thread,'local')},...(context.git.isGit?[{label:'在新工作树中分叉',action:()=>forkFromHeader(thread,'worktree')}]:[])];
  if(context.git.isWorktree&&!thread.projectless&&!ephemeral)forkItems.push({separator:true},{label:'在此工作树中新建聊天',action:()=>forkFromHeader(thread,'new-in-worktree')});
  const running=thread.turns?.some(turn=>turn.status==='inProgress');
  const canSchedule=!ephemeral&&!state.sideChatEphemeral&&(context.automation||context.eligibility.isEligible||running);
  openMenu(
    [
      { label: t("rename"), icon: "pencil", commandId:'renameThread', action: renameCurrent },
      { label: isThreadPinned(state.thread.id) ? '取消置顶' : '置顶', icon: 'pin', commandId:'toggleThreadPin', action: () => toggleThreadPinned(state.thread.id) },
      { separator: true },
      ...(!ephemeral&&!state.sideChatEphemeral?[{ label:'新建侧边聊天', icon:'plus', commandId:'openSideChat', action:()=>openSideChat() }]:[]),
      ...(forkItems.length?[{ label:'分叉', icon:'fork', submenu:true, action:()=>openMenu(forkItems,{rect,anchor}) }]:[]),
      ...(canSchedule?[{ label:context.automation?'编辑计划任务…':'添加计划任务…', icon:'clock',disabled:!context.automation&&!context.eligibility.isEligible, action:()=>openThreadAutomation(thread,context) }]:[]),
      { separator: true },
      ...(!ephemeral?[{label:'分享',icon:'external',disabled:!context.canFork,action:()=>openThreadShare(thread)}]:[]),
      {label:'复制',icon:'copy',submenu:true,action:()=>openMenu([{label:'复制会话 Markdown',commandId:'copyConversationMarkdown',action:()=>copyText(conversationMarkdown(thread))},{label:'复制深层链接',commandId:'copyDeeplink',action:()=>api.threadDeepLink(thread.id).then(copyText).catch(error=>toast(error.message))},{label:'复制项目路径',disabled:!thread.cwd,commandId:'copyWorkingDirectory',action:()=>copyText(thread.cwd||'')}],{rect,anchor})},
      { separator: true },
      {label:'在新窗口中打开',icon:'external',action:()=>openThreadInNewWindow()},
      { separator: true },
      { label: t("archive"), icon: "archive", commandId:'archiveThread', action:()=>archiveFromHeader(thread,context) },
    ],
    { rect, anchor },
  );
}
els.headMore.addEventListener("click",event=>{event.stopPropagation();openThreadMore()});

els.threadScroll.addEventListener("scroll", () => {
  const top = els.threadScroll.scrollTop;
  const scrolledUp = top < state.lastScrollTop - 8;
  state.lastScrollTop = top;
  // A delayed scroll event can arrive after React has changed layout. If its
  // position is already recorded, keep the paragraph anchor from before reflow.
  if(!transcriptViewportMemory||transcriptViewportMemory.threadId!==state.thread?.id||Math.abs(top-transcriptViewportMemory.top)>1)rememberTranscriptViewport();
  updateTranscriptNavigator();
  if (state.scrollReady && scrolledUp && top < 80 && state.olderCursor && !state.loadingOlder) {
    loadOlderTurns();
  }
});

for (const eventName of ['load', 'error']) {
  els.transcript.addEventListener(eventName, event => {
    if (event.target.tagName === 'IMG') {
      if(event.target.closest('.message-reference-icon')){event.target.style.opacity=eventName==='load'?'1':'0';return;}
      const figure=event.target.closest('.artifact-image');
      if(figure){figure.classList.toggle('image-unavailable',eventName==='error');if(eventName==='error')transcriptMissingImages.add(figure.dataset.imagePath);else transcriptMissingImages.delete(figure.dataset.imagePath);}
      const upload=event.target.closest('.user-attachment');
      if(upload){upload.classList.toggle('image-unavailable',eventName==='error');if(eventName==='error')transcriptMissingImages.add(upload.dataset.imageSrc);else transcriptMissingImages.delete(upload.dataset.imageSrc);}
      restoreTranscriptAfterMedia();
    }
  }, true);
}

els.transcript.addEventListener("click", (event) => {
  const saveImage=event.target.closest('[data-save-generated]');
  if(saveImage){api.saveGeneratedImage(saveImage.dataset.saveGenerated).then(result=>{if(result?.path)toast(`图片已保存：${result.path}`);}).catch(error=>toast(error.message,6000));return;}
  const revealImage=event.target.closest('[data-reveal-generated]');
  if(revealImage){api.reveal(revealImage.dataset.revealGenerated).catch(error=>toast(error.message,6000));return;}
  const codeCopy = event.target.closest("[data-copy-code]");
  if (codeCopy) { copyText(codeCopy.closest('.code-block').querySelector('code').textContent); return; }
  const local = event.target.closest("[data-local-path]");
  if (local) { openTranscriptFile(local.dataset.localPath, local.dataset.fileLine); return; }
  const reference=event.target.closest('[data-message-ref-kind]');
  if(reference){const ref={kind:reference.dataset.messageRefKind,path:reference.dataset.messageRefPath};const show=()=>{const item=userMessageReferenceItem(ref);if(item)customizeDetail(item,ref.kind==='plugin'?'plugins':'skills');else showConversationError('此引用已保留，但当前目录中未找到对应插件或技能，请检查安装状态。');};if(userMessageReferenceItem(ref))show();else loadCustomization().then(show).catch(error=>showConversationError(customizeError(error)));return;}
  const artifact = event.target.closest("[data-artifact-path], [data-artifact-url]");
  if (artifact) {
    const request = artifact.dataset.artifactPath ? openTranscriptFile(artifact.dataset.artifactPath) : api.openExternal(artifact.dataset.artifactUrl);
    request.catch(error => toast(error.message, 6000));
    return;
  }
  const fileDiff = event.target.closest("[data-turn-file]");
  if (fileDiff) {
    const turn = state.thread?.turns?.find(turn => turn.id === fileDiff.dataset.turnFile);
    const path = fileDiff.dataset.changePath;
    const changes = turn?.items?.flatMap(item => item.type === "fileChange" ? item.changes || [] : []).filter(change => change.path === path) || [];
    state.modal = { kind: "diff", title: displayPath(path), files: changes.map(change => ({ path, diff: change.diff })) };
    renderOverlay(); return;
  }
  const turnMenu = event.target.closest("[data-turn-menu]");
  if (turnMenu) {
    openMenu([
      { label: t("copy"), icon: "copy", action: () => copyTurnText(turnMenu.dataset.turnMenu) },
      { label: t("diff"), icon: "doc", action: () => showTurnDiff(turnMenu.dataset.turnMenu) },
      { label: t("fork"), icon: "fork", action: forkCurrent },
    ], { rect: turnMenu.getBoundingClientRect(), anchor: turnMenu });
    return;
  }
  const toggle = event.target.closest("[data-toggle]");
  if (toggle) {
    const id = toggle.dataset.toggle;
    if(globalThis.activityDisclosure?.toggle(toggle))return;
    if (toggle.getAttribute('aria-expanded') === 'true') {
      state.expanded.delete(id);
      if (id.startsWith('work:')) for (const child of toggle.closest('.work-activity')?.querySelectorAll('[data-toggle]') || []) state.expanded.delete(child.dataset.toggle);
    } else state.expanded.add(id);
    renderTranscript({ anchor: { id, top: toggle.getBoundingClientRect().top } });
    return;
  }
  const copyTurn = event.target.closest("[data-copy-turn]");
  if (copyTurn) {
    copyTurnText(copyTurn.dataset.copyTurn);
    return;
  }
  const copyTextButton = event.target.closest("[data-copy-text]");
  if (copyTextButton) {
    copyText(copyTextButton.dataset.copyText);
    return;
  }
  const diffItem = event.target.closest("[data-diff-item]");
  if (diffItem) {
    showItemDiff(diffItem.dataset.diffItem);
    return;
  }
  const turnDiff = event.target.closest("[data-turn-diff]");
  if (turnDiff) {
    showTurnDiff(turnDiff.dataset.turnDiff);
    return;
  }
  const revert = event.target.closest("[data-revert-turn]");
  if (revert && state.thread) {
    showRevert(state.thread.id, revert.dataset.revertTurn);
    return;
  }
  const zoom = event.target.closest("[data-zoom]");
  if (zoom) {
    state.modal = { kind: "lightbox", src: zoom.dataset.zoom, alt: zoom.querySelector('img')?.alt };
    renderOverlay();
    return;
  }
  const suggest = event.target.closest("[data-suggest]");
  if (suggest) {
    els.input.value = suggest.dataset.suggest;
    autosize();
    updateSendState();
    els.input.focus();
  }
});

async function openTranscriptFile(path, line) {
  if(!line){const {classifyLocalPreview}=await import('./native-preview/classify.mjs');if(['video','audio','html','markdown','pdf'].includes(classifyLocalPreview(path))){openWorkspacePreview(path);return;}}
  if(!line&&/\.(ipynb|docx)$/i.test(path)){openWorkspacePreview(path);return;}
  const ext = /\.([a-z0-9]+)$/i.exec(path)?.[1]?.toLowerCase();
  if (["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "csv", "tsv", "zip", "7z", "tar", "gz", "mp3", "mp4", "wav", "html", "htm"].includes(ext)) {
    try { await api.artifactOpen(path); } catch (error) { toast(error.message, 6000); }
    return;
  }
  if (["png", "jpg", "jpeg", "webp", "gif", "bmp", "svg"].includes(ext)) {
    state.modal = { kind: "lightbox", src: mediaUrl(path) }; renderOverlay(); return;
  }
  await openFilePreview({ path });
  if (line) {
    const body = els.filePreview.querySelector('.fpv-body');
    if (body) body.scrollTop = (Number(line) - 1) * (parseFloat(getComputedStyle(body).lineHeight) || 20);
  }
}

els.send.addEventListener("click", sendMessage);
els.stop.addEventListener("click", stopTurn);

els.input.addEventListener("keydown", (event) => {
  if(event.key==='Enter'&&event.shiftKey&&(event.metaKey||event.ctrlKey)&&!event.isComposing&&(state.running||globalThis.followUps?.hasPending(state.activeThreadId))){
    event.preventDefault();sendMessage({followUpAction:followUps.mode()==='queue'?'steer':'queue'});return;
  }
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    sendMessage();
  }
});

els.attachments.addEventListener("click", (event) => {
  const ref=event.target.closest("[data-remove-reference]");if(ref){const item=validComposerMentions(els.input.value).find(m=>m.path===ref.dataset.removeReference&&m.start===Number(ref.dataset.referenceStart));if(item)removeComposerReference(item);return;}
  const remove = event.target.closest("[data-remove-attachment]");
  if (!remove) return;
  state.attachments.splice(Number(remove.dataset.removeAttachment), 1);
  globalThis.composerDrafts?.save();
  renderComposer();
});

els.rateBanner.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "upgrade") window.open("https://chatgpt.com/explore/pro", "_blank");
  else if (action === "reset-credit") {
    state.modal = { kind: "resetCredit" };
    renderOverlay();
  }
});

els.goalBar.addEventListener("click", async (event) => {
  if (!event.target.closest('[data-action="clear-goal"]')) return;
  if (!state.activeThreadId) return;
  try {
    await api.call("thread/goal/clear", { threadId: state.activeThreadId });
    state.goal = null;
    renderGoalBar();
  } catch (error) {
    toast(error.message);
  }
});

/* ---------- boot ---------- */

async function boot() {
  const mark=name=>globalThis.performance?.mark?.("eva.boot."+name);
  mark("start");
  try {
    const meta = await api.meta();
    mark("meta-ready");
    state.meta = meta;
    const bootQuery = new URLSearchParams(location.search);
    state.sideChatEphemeral=bootQuery.get('ephemeral')==='1';
    document.body.classList.toggle('sidechat', bootQuery.has('sidechat'));
    state.cwd = bootQuery.get('cwd') || meta.cwd || null;
    if(bootQuery.has('sidechat')){
      if(bootQuery.get('model'))state.model=store.get('codex.model',bootQuery.get('model'));
      if(bootQuery.get('provider'))state.provider=store.get('codex.provider',bootQuery.get('provider'));
    }

    try {
      const configResponse = await api.call("config/read", {});
      state.config = configResponse.config || configResponse;
      if (!store.get("codex.model", null) && state.config?.model) state.model = state.config.model;
      if (!store.get("codex.effort", null) && state.config?.model_reasoning_effort)
        state.effort = state.config.model_reasoning_effort;
    } catch (error) {
      console.warn("config/read failed", error);
    }

    mark("config-ready");
    state.providers = await api.providersList();
    mark("providers-ready");
    // Account quota is informational; a slow service must not hold the chat closed.
    refreshRates();
    await Promise.all([loadModels(), refreshThreads()]);
    mark("models-and-history-ready");

    const queryThread = bootQuery.get("thread");
    const last = bootQuery.has("browserUrl")?null:queryThread || store.get("codex.thread", null);
    if(bootQuery.get('ephemeral')==='1'){
      const result=await api.call('thread/read',{threadId:queryThread,includeTurns:false});
      if(!result.thread?.ephemeral)throw Error('临时侧边聊天已失效，请重新创建。');
      state.thread={...result.thread,turns:[],name:bootQuery.has('pluginChat')?'插件试用（临时）':'侧边 GPT 聊天（临时）'};
      state.activeThreadId=result.thread.id;state.ephemeral=true;if(!bootQuery.has('pluginChat'))state.mode='read';
      state.model=bootQuery.get('model');state.provider=bootQuery.has('pluginChat')?bootQuery.get('provider')||null:null;
      state.olderCursor=null;state.running=false;state.activeTurnId=null;
    } else if (last && state.threads.some((thread) => thread.id === last)) {
      await openThread(last, { push: false });
      state.navStack = [last];
      state.navIndex = 0;
      renderHead();
    } else if (last) {
      try {
        await openThread(last, { push: false });
      } catch {
        startNewThread();
      }
    } else {
      startNewThread(bootQuery.has('sidechat') ? bootQuery.get('cwd') || undefined : meta.defaultProjectless ? store.get('codex-rae.draftCwd', null) : undefined);
    }
    mark("conversation-ready");
    render();
    if(bootQuery.has('pluginChat')&&bootQuery.has('prefill')){els.input.value=bootQuery.get('prefill');autosize();}
    bindPanels();
    bindBrowser();
    bindTabStrip();
  } catch (error) {
    state.connectionError=true;showConversationError('应用连接未能建立，请检查内核状态后恢复连接。');runtimeWarnings.record(error.message);
  } finally {
    state.booting = false;
    mark("interactive");
    const browserUrl=new URLSearchParams(location.search).get('browserUrl');
    if(browserUrl){
      toggleBrowserPanel(true,{createInitial:false});
      await newBrowserTab(browserUrl);
    }else globalThis.productModes?.restore();
    globalThis.runtimeRecovery?.refresh();
    renderComposer();
    await globalThis.nativeWorkspace?.reveal();
    mark("revealed");
  }
}

boot();
