/* Desktop transcript actions, with Android panel and clipboard services. */
window.EvaDesktopStreamActions={create(host){
 const state=host.state,renderOverlay=()=>host.renderOverlay(state.modal);
 const {esc,ic,finalAnswerItems,displayPath,renderDiff,t}=host.renderer;
 const copyText=host.copyText,modalShell=host.modalShell,closeModal=host.closeModal;
 const scheduleTranscript=host.scheduleTranscript;
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

function copyTurnText(turnId) {
  const turn = state.thread?.turns?.find(turn => turn.id === turnId);
  if (!turn) return;
  const text = finalAnswerItems(turn).map(item => item.text).join("\n\n").trim();
  copyText(text);
}

function modalDiff(dialog) {
  const body = dialog.files?.length
    ? dialog.files
        .map(
          (file) => `<div class="diff-file">
            <div class="diff-file-head">${ic("doc")}<span class="path" title="${esc(file.path)}">${esc(file.path)}</span></div>
            <div class="diff-file-body">${renderDiff(file.diff)}</div>
          </div>`,
        )
        .join("")
    : dialog.diff
      ? `<div class="diff-file"><div class="diff-file-body">${renderDiff(dialog.diff)}</div></div>`
      : `<p>${esc(t("noDiff"))}</p>`;
  const { overlay, modal } = modalShell({
    title: dialog.title || t("turnDiff"),
    body,
    foot: `<button class="btn" data-close="1">${esc(t("close"))}</button>`,
    wide: true,
  });
  modal.querySelector("[data-close]").addEventListener("click", closeModal);
  return overlay;
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
return {showTurnDiff,showItemDiff,copyTurnText,modalDiff,saveTurnConnections,recordTurnConnection,finishTurnConnection,recoverTurnConnection};}};
