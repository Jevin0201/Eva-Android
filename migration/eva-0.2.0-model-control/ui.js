/* Codex clone — menus, modals and approvals */
let menuDismiss = null;

function closeMenu() {
  const previous=state.menu;
  const onClose=state.menu?.options?.onClose;
  const active=document.activeElement,anchor=state.menu?.options?.anchor;
  if(active?.closest('.menu')&&anchor?.isConnected)anchor.focus({preventScroll:true});
  if (menuDismiss) document.removeEventListener('pointerdown', menuDismiss, true);
  menuDismiss = null;
  state.menu = null;
  previous?.resizeObserver?.disconnect();
  if(previous?.blurDismiss)window.removeEventListener('blur',previous.blurDismiss);
  if(previous?.native)api.nativeMenuClose?.().catch(()=>{});
  const root = document.getElementById("menu-root");
  if (root) root.innerHTML = "";
  onClose?.();
  $$(".tb-menu > button").forEach((button) => button.classList.remove("open"));
  if (typeof showBrowserNative === 'function') showBrowserNative();
}

function menuIntersectsBrowser(menu) {
  if(!state.browserOpen||!state.browserActive||!menu?.node?.isConnected)return false;
  const tab=typeof browserActiveTab==='function'?browserActiveTab():null;
  if(!tab||['home','files','terminal','agents'].includes(tab.kind)||els.browserPanel.classList.contains('hidden'))return false;
  const a=menu.node.getBoundingClientRect(),b=els.browserHost.getBoundingClientRect();
  return a.width>0&&a.height>0&&b.width>0&&b.height>0&&a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
}

function syncMenuBrowserLayer() {
  const entry=state.menu;
  if(!entry||entry.native)return false;
  const intersects=menuIntersectsBrowser(entry);
  if(intersects&&entry.items.length&&typeof api.nativeMenuPopup==='function'){
    entry.native=true;entry.blocksBrowser=false;entry.resizeObserver?.disconnect();entry.node.remove();
    const actions=new Map();let next=0;
    const serialize=rows=>rows.filter(Boolean).map(item=>{
      if(item.separator)return {separator:true};
      const key=String(++next);if(item.action)actions.set(key,item.action);
      return {key,label:item.label,enabled:!item.disabled&&!item.heading,...(typeof item.checked==='boolean'?{checked:item.checked}:{}),...(Array.isArray(item.children)?{children:serialize(item.children)}:{})};
    });
    Promise.resolve().then(()=>{
      if(state.menu!==entry)return null;
      return api.nativeMenuPopup(serialize(entry.items),entry.point);
    }).then(async key=>{
      if(state.menu!==entry)return;
      closeMenu();
      if(key)await actions.get(key)?.();
    }).catch(error=>{if(state.menu===entry)closeMenu();toast(shortError(error));});
    return false;
  }
  const wasBlocked=entry.blocksBrowser;
  entry.blocksBrowser=intersects;
  if(intersects&&!wasBlocked&&typeof hideBrowserNative==='function')hideBrowserNative();
  return intersects;
}

function openMenu(items, options = {}) {
  closeMenu();
  // Other embedded surfaces keep their existing modal-like menu treatment;
  // the browser view is hidden only when an HTML menu actually covers it.
  api.cloudLibraryHide?.();
  const menu = document.createElement("div");
  menu.className = "menu";
  menu.setAttribute('role','menu');
  const rect = options.rect || null;
  const x = options.x ?? (rect ? rect.left : 12);
  const y = options.y ?? (rect ? rect.bottom + 4 : 12);
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.style.visibility = "hidden";

  for (const item of items) {
    if (!item) continue;
    if (item.separator) {
      const sep = document.createElement("div");
      sep.className = "menu-sep";
      sep.setAttribute('role','separator');
      menu.appendChild(sep);
      continue;
    }
    if(item.quota){menu.appendChild(globalThis.accountQuota.renderWindow(item.quota));continue;}
    if (item.heading) {
      const label = document.createElement("div");
      label.className = "menu-label";
      label.textContent = item.label;
      menu.appendChild(label);
      continue;
    }
    const button = document.createElement("button");
    button.className = `menu-item${item.danger ? " danger" : ""}${item.disabled ? " disabled" : ""}`;
    button.disabled=!!item.disabled;
    button.setAttribute('role','menuitem');
    button.tabIndex=-1;
    if (item.title) button.title = item.title;
    const shortcut=item.commandId?globalThis.keybindingSettings?.label(item.commandId):item.shortcut;
    button.innerHTML = `
      <span class="mi-ico">${item.icon ? ic(item.icon) : item.checked ? ic("check", "mi-check") : ""}</span>
      <span class="mi-label">${esc(item.label)}</span>
      ${shortcut ? `<span class="mi-key">${esc(api.platform==='darwin'?shortcut.replaceAll('Ctrl+','⌘').replaceAll('Alt+F4','⌘W'):shortcut)}</span>` : ""}
      ${item.submenu ? `<span class="mi-submenu">${ic('chevronRight')}</span>` : ''}
    `;
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      if (item.disabled) return;
      closeMenu();
      item.action?.();
    });
    menu.appendChild(button);
  }

  document.getElementById("menu-root").appendChild(menu);
  const box = menu.getBoundingClientRect();
  const left = clamp(x, 6, window.innerWidth - box.width - 6);
  let top = y;
  if (top + box.height > window.innerHeight - 6) top = Math.max(6, y - box.height - 8);
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  menu.style.visibility = "visible";

  if (options.anchor) options.anchor.classList.add("open");
  state.menu = { items, options, node:menu, point:{x:left,y:top}, blocksBrowser:false };
  const entry=state.menu;
  entry.blurDismiss=()=>{if(state.menu===entry&&!entry.native)closeMenu();};
  window.addEventListener('blur',entry.blurDismiss);
  if(typeof ResizeObserver==='function'){
    entry.resizeObserver=new ResizeObserver(()=>{
      if(state.menu!==entry)return;
      syncMenuBrowserLayer();
      if(!entry.blocksBrowser&&typeof showBrowserNative==='function')showBrowserNative();
    });
    entry.resizeObserver.observe(menu);
  }
  syncMenuBrowserLayer();
  if(entry.native)return;
  menu.addEventListener('keydown',event=>{
    const entries=[...menu.querySelectorAll('button:not(:disabled)')],index=entries.indexOf(document.activeElement);
    if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();event.stopPropagation();const next=event.key==='Home'?0:event.key==='End'?entries.length-1:(index+(event.key==='ArrowDown'?1:-1)+entries.length)%entries.length;entries[next]?.focus();}
    else if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeMenu();}
    else if(event.key==='Tab')closeMenu();
  });
  menu.querySelector('button:not(:disabled)')?.focus({preventScroll:true});

  setTimeout(() => {
    if (!menu.isConnected) return;
    menuDismiss = event => { if (!menu.contains(event.target) && !options.anchor?.contains(event.target)) closeMenu(); };
    document.addEventListener('pointerdown', menuDismiss, true);
  }, 0);
}

function openTitlebarMenu(button) {
  const rect = button.getBoundingClientRect();
  const key = button.dataset.menu;
  const menus = {
    file: [
      { label: t("newChat"), commandId: "newTask", action: () => startNewThread() },
      {
        label: LANG === "zh" ? "新建临时聊天" : "New temporary chat",
        action: () => startNewThread(undefined, { ephemeral: true }),
      },
      { label: LANG === "zh" ? "打开项目文件夹…" : "Open project folder…", commandId: "openFolder", action: () => pickProject() },
      { label: t("openInNewWindow"), action: () => openThreadInNewWindow() },
      { separator: true },
      { label: t("settings"), commandId: "settings", action: () => openSettings() },
      { separator: true },
      { label: LANG === "zh" ? "关闭窗口" : "Close window", shortcut: "Alt+F4", action: () => window.api?.closeWindow?.() },
    ],
    edit: [
      { label: LANG === "zh" ? "撤销" : "Undo", shortcut: "Ctrl+Z", action: () => window.api?.edit?.("undo") },
      { label: LANG === "zh" ? "重做" : "Redo", shortcut: api.platform==='darwin'?'⌘⇧Z':'Ctrl+Y', action: () => window.api?.edit?.("redo") },
      { separator: true },
      { label: LANG === "zh" ? "剪切" : "Cut", shortcut: "Ctrl+X", action: () => window.api?.edit?.("cut") },
      { label: LANG === "zh" ? "复制" : "Copy", shortcut: "Ctrl+C", action: () => window.api?.edit?.("copy") },
      { label: LANG === "zh" ? "粘贴" : "Paste", shortcut: "Ctrl+V", action: () => window.api?.edit?.("paste") },
      { separator: true },
      { label: LANG === "zh" ? "全选" : "Select all", shortcut: "Ctrl+A", action: () => window.api?.edit?.("selectAll") },
    ],
    view: [
      { label: LANG === "zh" ? "切换侧边栏" : "Toggle sidebar", commandId: "toggleSidebar", action: () => toggleSidebar() },
      { label: t("search"), commandId: "searchChats", action: () => setSearchVisible(true) },
      {
        label: LANG === "zh" ? "在对话中查找" : "Find in conversation",
        commandId: "findInThread",
        action: () => openFind(),
      },
      { separator: true },
      {
        label: t("terminal"),
        commandId: "toggleTerminal",
        checked: state.bottomPanelOpen,
        action: () => toggleBottomPanel(),
      },
      {
        label: t("files"),
        commandId: "toggleFileTreePanel",
        checked: state.filePanelOpen,
        action: () => toggleFilePanel(),
      },
      {
        label: t("browser"),
        commandId: "stepWorkspaceLayout",
        checked: state.browserOpen,
        action: () => toggleBrowserPanel(),
      },
      { label: t("nextWindow"), action: () => cycleWindow(1) },
      { separator: true },
      { label: LANG === "zh" ? "重新加载" : "Reload", shortcut: "Ctrl+R", action: () => location.reload() },
      { label: LANG === "zh" ? "开发者工具" : "Developer tools", shortcut: "Ctrl+Shift+I", action: () => window.api?.toggleDevTools?.() },
      { separator: true },
      { label: LANG === "zh" ? "实际大小" : "Actual size", shortcut: "Ctrl+0", action: () => window.api?.zoom?.(0) },
      { label: LANG === "zh" ? "放大" : "Zoom in", shortcut: "Ctrl+=", action: () => window.api?.zoom?.(1) },
      { label: LANG === "zh" ? "缩小" : "Zoom out", shortcut: "Ctrl+-", action: () => window.api?.zoom?.(-1) },
    ],
    help: [
      { label: LANG === "zh" ? "Codex 文档" : "Codex documentation", action: () => window.open("https://developers.openai.com/codex", "_blank") },
      { label: LANG === "zh" ? "协议参考" : "Protocol reference", action: () => window.open("https://github.com/openai/codex", "_blank") },
      { separator: true },
      { label: LANG === "zh" ? "关于 Codex" : "About Codex", action: () => openSettings("about") },
    ],
  };
  openMenu(menus[key] || [], { rect, anchor: button });
}

function openThreadMenu(thread, x, y) {
  const archived = state.view === "archived";
  openMenu(
    [
      {
        label: t("rename"),
        icon: "pencil",
        action: () => {
          state.modal = { kind: "rename", thread, value: threadTitle(thread) };
          renderOverlay();
        },
      },
      { label: t("openInNewWindow"), icon: "external", action: () => openThreadInNewWindow(thread.id) },
      { label: t("fork"), icon: "fork", action: () => forkThread(thread) },
      { label: t("compact"), icon: "archive", action: () => compactThread(thread) },
      {
        label: t("moveToSection"),
        icon: "layers",
        action: () => openSectionPicker(thread, x, y),
      },
      { separator: true },
      {
        label: archived ? t("unarchive") : t("archive"),
        icon: "archive",
        action: () => archiveThread(thread, !archived),
      },
      { label: t("copyId"), icon: "copy", action: () => copyText(thread.id) },
      {
        label: t("reveal"),
        icon: "folder",
        action: () => thread.cwd && window.api?.reveal?.(thread.cwd),
      },
      { separator: true },
      {
        label: t("delete"),
        icon: "trash",
        danger: true,
        action: () => {
          state.modal = { kind: "delete", thread };
          renderOverlay();
        },
      },
    ],
    { x, y },
  );
}

/* ---------- modals ---------- */

let nativeLightboxRecord=null;
function disposeNativeLightbox(){
  const record=nativeLightboxRecord;if(!record)return;
  nativeLightboxRecord=null;window.removeEventListener('eva-native-image-common-ready',record.mount);
  record.preview?.dispose();
}
function renderOverlay() {
  const root = els.modalRoot;
  if (!root) return;
  const approval = state.approvals.find(item=>item.kind!=="userInput");
  const lightbox=!approval&&state.modal?.kind==='lightbox';
  if(nativeLightboxRecord&&(!lightbox||nativeLightboxRecord.dialog!==state.modal))disposeNativeLightbox();
  if(lightbox&&nativeLightboxRecord?.host.isConnected){
    for(const element of [nativeLightboxRecord.preview?.element,nativeLightboxRecord.preview?.portalNode])if(element)element.dataset.theme=document.documentElement.dataset.theme||'light';
    renderQuestionComposer();hideBrowserNative?.();return;
  }
  for (const node of root.querySelectorAll(".eva-native-user-input")) globalThis.EvaNativeUserInput?.unmount(node);
  root.innerHTML = "";
  renderQuestionComposer();
  if((approval||state.modal)&&typeof hideBrowserNative==='function')hideBrowserNative();
  else if(typeof showBrowserNative==='function')showBrowserNative();
  if (approval) {
    root.appendChild(buildApproval(approval));
    return;
  }
  if (state.modal) root.appendChild(buildModal(state.modal));
}

// REA Work composer YI/Kr: questions live adjacent to the composer, rather than
// using the command/file approval modal shell. Ownership stays in approvals.
function renderQuestionComposer(){
  let host=document.getElementById('native-blocking-question-composer');
  if(!host){host=document.createElement('div');host.id='native-blocking-question-composer';host.className='eva-native-user-input relative flex flex-col gap-2 mb-2';host.dataset.codexWindowType='electron';els.composer.before(host);}
  const approval=state.approvals.find(item=>item.kind==='userInput'&&(!item.params?.threadId||item.params.threadId===state.activeThreadId));
  if(host._questionApproval!==approval){for(const node of host.querySelectorAll('.eva-native-user-input'))globalThis.EvaNativeUserInput?.unmount(node);host.replaceChildren();host._questionApproval=approval;if(approval)host.append(buildQuestion(approval));}
  host.hidden=!approval||state.loadingThread;
  globalThis.nativeUserInputHost?.hydrate();
}

function closeModal() {
  if (state.modal?.kind === "createProject" && state.modal.busy) return;
  const elicitationCancel=els.modalRoot.querySelector("[data-elicitation-cancel]");
  if(elicitationCancel){elicitationCancel.click();return;}
  const dialogCancel=els.modalRoot.querySelector('[data-browser-dialog-tab] [data-dialog-cancel]');
  if(dialogCancel){dialogCancel.click();return;}
  const uploadCancel=els.modalRoot.querySelector('[data-upload-tab] [data-cancel-upload]');
  if(uploadCancel){uploadCancel.click();return;}
  state.modal = null;
  renderOverlay();
}

function modalShell({ title, body, foot, wide = false, onClose }) {
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.addEventListener("pointerdown", (event) => {
    if (event.target === overlay) (onClose || closeModal)();
  });
  const modal = document.createElement("div");
  modal.className = `modal${wide ? " wide" : ""}`;
  modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.tabIndex=-1;
  modal.innerHTML = `
    <div class="modal-head"><h2>${esc(title)}</h2><button class="modal-close" aria-label="关闭对话框">${ic("x")}</button></div>
    <div class="modal-body">${body}</div>
    ${foot ? `<div class="modal-foot">${foot}</div>` : ""}
  `;
  modal.querySelector(".modal-close").addEventListener("click", onClose || closeModal);
  modal.querySelector('h2').id='dialog-title-'+Math.random().toString(36).slice(2);modal.setAttribute('aria-labelledby',modal.querySelector('h2').id);
  overlay.appendChild(modal);
  return { overlay, modal };
}

function buildModal(dialog) {
  if(dialog.kind==='hooks')return hookSettings.modal(dialog);
  if (dialog.kind === "createProject") return modalCreateProject(dialog);
  if (dialog.kind === "project") return modalProject(dialog);
  if (dialog.kind === "rename") return modalRename(dialog);
  if (dialog.kind === "sectionName") return modalSectionName(dialog);
  if (dialog.kind === "deleteSection") return modalDeleteSection(dialog);
  if (dialog.kind === "delete") return modalConfirmDelete(dialog);
  if (dialog.kind === "revert") return modalRevert(dialog);
  if (dialog.kind === "review") return modalReview(dialog);
  if (dialog.kind === "goal") return modalGoal(dialog);
  if (dialog.kind === "resetCredit") return modalResetCredit(dialog);
  if (dialog.kind === "diff") return modalDiff(dialog);
  if (dialog.kind === "lightbox") return modalLightbox(dialog);
  return modalShell({ title: "Codex", body: "" }).overlay;
}

function modalCreateProject(dialog) {
  const { overlay, modal } = modalShell({
    title: '创建项目',
    body: `<form id="create-project-form"><div class="field"><label for="create-project-name">项目名称</label><input class="input" id="create-project-name" maxlength="120" placeholder="新项目" /></div><div class="field"><label>源文件夹</label><div class="project-create-sources"></div><button type="button" class="btn" data-pick-project-sources>${ic('plus')} 添加文件夹</button><p class="project-create-help">不添加文件夹时，将在“文稿/Eva”中创建新目录。当前任务使用第一个（主）文件夹作为工作目录；其他来源会保存在项目中。</p></div><label class="project-create-option"><input type="checkbox" data-project-git /> 为新建文件夹初始化 Git 仓库</label><label class="project-create-option"><input type="checkbox" data-project-consent /> 我允许 Eva 读取和编辑此项目的文件夹</label><div class="project-save-error" role="alert"></div></form>`,
    foot: `<button class="btn" data-close>${esc(t('cancel'))}</button><button class="btn primary" type="submit" form="create-project-form" data-create-project>创建项目</button>`,
  });
  const name = modal.querySelector('#create-project-name'), git = modal.querySelector('[data-project-git]'), consent = modal.querySelector('[data-project-consent]'), submit = modal.querySelector('[data-create-project]');
  name.value = dialog.name || ''; git.checked = !!dialog.initializeGit; consent.checked = !!dialog.confirmed;
  name.addEventListener('input', () => { dialog.name = name.value; });
  git.addEventListener('change', () => { dialog.initializeGit = git.checked; });
  consent.addEventListener('change', () => { dialog.confirmed = consent.checked; submit.disabled = !consent.checked; });
  submit.disabled = !consent.checked;
  const error = modal.querySelector('.project-save-error');
  function drawSources() {
    const list = modal.querySelector('.project-create-sources'); list.replaceChildren();
    dialog.sources.forEach((source, index) => {
      const row = document.createElement('div'); row.className = 'project-create-source';
      const label = document.createElement('span'); label.textContent = source; label.title = source; row.append(label);
      if (index > 0) { const primary = document.createElement('button'); primary.type = 'button'; primary.className = 'btn'; primary.textContent = '设为主'; primary.addEventListener('click', () => { dialog.sources.splice(index, 1); dialog.sources.unshift(source); drawSources(); }); row.append(primary); }
      if (index === 0) { const badge = document.createElement('small'); badge.textContent = '主'; row.append(badge); }
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'btn'; remove.textContent = '移除'; remove.setAttribute('aria-label', '移除 ' + source);
      remove.addEventListener('click', () => { dialog.sources.splice(index, 1); drawSources(); }); row.append(remove); list.append(row);
    });
    git.disabled = dialog.sources.length > 0;
  }
  drawSources();
  modal.querySelector('[data-pick-project-sources]').addEventListener('click', async () => {
    try { const sources = api.localProjects?.pickSources ? await api.localProjects.pickSources() : [await api.pickFolder()].filter(Boolean); if (!modal.isConnected) return; dialog.sources = [...new Set([...dialog.sources, ...sources])]; drawSources(); }
    catch (failure) { error.textContent = failure.message; }
  });
  modal.querySelector('[data-close]').addEventListener('click', closeModal);
  modal.querySelector('form').addEventListener('submit', async event => {
    event.preventDefault(); if (dialog.busy || !consent.checked) return;
    dialog.busy = true; error.textContent = '';
    modal.querySelectorAll('button,input').forEach(control => { control.disabled = true; }); submit.textContent = '正在创建…';
    try {
      if (!api.localProjects?.create) throw Error('当前版本的项目创建服务不可用，请重新安装最新版 Eva');
      const result = await api.localProjects.create({ name: name.value.trim(), sources: dialog.sources.slice(), initializeGit: !dialog.sources.length && git.checked, confirmed: true });
      if (result?.canceled) return;
      if (!result?.project) throw Error('项目创建未返回有效目录');
      dialog.busy = false; closeModal(); acceptLocalProject(result.project);
      if (result.gitWarning) toast(result.gitWarning);
    } catch (failure) { error.textContent = failure.message; }
    finally { dialog.busy = false; if (modal.isConnected) { modal.querySelectorAll('button,input').forEach(control => { control.disabled = false; }); git.disabled = dialog.sources.length > 0; submit.disabled = !consent.checked; submit.textContent = '创建项目'; } }
  });
  setTimeout(() => { if (name.isConnected) name.focus(); }, 0);
  return overlay;
}

function modalProject({ group, editing = false }) {
  const { overlay, modal } = modalShell({
    title: editing ? '编辑项目' : '项目属性',
    body: `<div class="field"><label>显示名称</label><input class="input" id="project-name" ${editing ? '' : 'readonly'} /></div><div class="field"><label>文件夹路径</label><input class="input" id="project-path" readonly /></div><p class="project-detail">已加载会话：${group.threads.length}<br>内核信任状态：${esc(group.trust || '未配置')}<br>显示名称仅用于 Eva，不重命名磁盘目录。路径由实际会话确定。</p><div class="project-save-error" role="alert"></div>`,
    foot: `<button class="btn" data-close>${esc(editing ? t('cancel') : t('close'))}</button>${editing ? `<button class="btn primary" data-save-project>${esc(t('save'))}</button>` : ''}`,
  });
  modal.querySelector('#project-name').value = group.name;
  modal.querySelector('#project-path').value = group.path;
  modal.querySelector('[data-close]').addEventListener('click', closeModal);
  if (editing) {
    const input = modal.querySelector('#project-name'); input.maxLength = 120;
    const save = () => {
      const name = input.value.trim();
      if (!name) { modal.querySelector('.project-save-error').textContent = '请输入项目显示名称'; input.focus(); return; }
      try {
        const next = { ...state.localProjects, [group.key]: { ...state.localProjects[group.key], path: group.path, name } };
        localStorage.setItem('codex-rae.projects', JSON.stringify(next));
        state.localProjects = next; closeModal(); renderSidebar();
      } catch (error) { modal.querySelector('.project-save-error').textContent = error.message; }
    };
    modal.querySelector('[data-save-project]').addEventListener('click', save);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
    setTimeout(() => { if (input.isConnected) { input.focus(); input.select(); } }, 0);
  }
  return overlay;
}

function modalRename(dialog) {
  const { overlay, modal } = modalShell({
    title: t("renameTitle"),
    body: `<div class="field"><label>${esc(t("renameSub"))}</label><input class="input" id="rename-input" /></div>`,
    foot: `<button class="btn" data-close="1">${esc(t("cancel"))}</button><button class="btn primary" id="rename-save">${esc(t("save"))}</button>`,
  });
  const input = modal.querySelector("#rename-input");
  input.value = dialog.value || "";
  setTimeout(() => {
    input.focus();
    input.select();
  }, 0);
  const save = async () => {
    const name = input.value.trim();
    if (!name) return;
    try {
      await window.api.call("thread/name/set", { threadId: dialog.thread.id, name });
      updateTabTitle(dialog.thread.id, name);
      if (state.thread?.id === dialog.thread.id) {
        state.thread.name = name;
        document.title = threadTitle(state.thread)+' — Eva';
      }
      closeModal();
      await refreshThreads();
    } catch (error) {
      toast(error.message);
    }
  };
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") save();
    if (event.key === "Escape") closeModal();
  });
  modal.querySelector("#rename-save").addEventListener("click", save);
  modal.querySelector("[data-close]").addEventListener("click", closeModal);
  return overlay;
}

function modalSectionName(dialog) {
  const editing = Boolean(dialog.section);
  const { overlay, modal } = modalShell({
    title: editing ? t("renameSection") : t("newSection"),
    body: `<div class="field"><label>${esc(t("sectionName"))}</label><input class="input" id="section-name-input" /></div>`,
    foot: `<button class="btn" data-close="1">${esc(t("cancel"))}</button><button class="btn primary" id="section-name-save">${esc(t("save"))}</button>`,
  });
  const input = modal.querySelector("#section-name-input");
  input.value = dialog.value || "";
  setTimeout(() => {
    input.focus();
    input.select();
  }, 0);
  const save = async () => {
    const name = input.value.trim();
    if (!name) return;
    closeModal();
    if (editing) await renameSection(dialog.section, name);
    else await createSection(name);
  };
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") save();
    if (event.key === "Escape") closeModal();
  });
  modal.querySelector("#section-name-save").addEventListener("click", save);
  modal.querySelector("[data-close]").addEventListener("click", closeModal);
  return overlay;
}

function modalDeleteSection(dialog) {
  const { overlay, modal } = modalShell({
    title: t("deleteSection"),
    body: `<p style="margin:0">${esc(t("deleteSectionBody"))}</p>`,
    foot: `<button class="btn" data-close="1">${esc(t("cancel"))}</button><button class="btn danger" id="confirm-delete-section">${esc(t("deleteAction"))}</button>`,
  });
  modal.querySelector("[data-close]").addEventListener("click", closeModal);
  modal.querySelector("#confirm-delete-section").addEventListener("click", async () => {
    closeModal();
    await deleteSection(dialog.section);
  });
  return overlay;
}

function modalConfirmDelete(dialog) {
  const { overlay, modal } = modalShell({
    title: t("deleteTitle"),
    body: `<p style="margin:0">${esc(t("deleteBody", { name: threadTitle(dialog.thread) }))}</p>`,
    foot: `<button class="btn" data-close="1">${esc(t("cancel"))}</button><button class="btn danger" id="confirm-delete">${esc(t("deleteAction"))}</button>`,
  });
  modal.querySelector("[data-close]").addEventListener("click", closeModal);
  modal.querySelector("#confirm-delete").addEventListener("click", async () => {
    try {
      await window.api.call("thread/delete", { threadId: dialog.thread.id });
      if (state.activeThreadId === dialog.thread.id) startNewThread();
      closeModal();
      await refreshThreads();
      toast(LANG === "zh" ? "已删除" : "Deleted");
    } catch (error) {
      toast(error.message);
    }
  });
  return overlay;
}

function modalRevert(dialog) {
  const { overlay, modal } = modalShell({
    title: t("revertTitle"),
    body: `<p style="margin:0">${esc(t("revertBody"))}</p>`,
    foot: `<button class="btn" data-close="1">${esc(t("cancel"))}</button><button class="btn danger" id="confirm-revert">${esc(t("confirm"))}</button>`,
  });
  modal.querySelector("[data-close]").addEventListener("click", closeModal);
  modal.querySelector("#confirm-revert").addEventListener("click", async () => {
    try {
      await window.api.call("thread/revert", {
        threadId: dialog.threadId,
        beforeTurnId: dialog.turnId,
      });
      closeModal();
      await openThread(dialog.threadId, { push: false });
    } catch (error) {
      toast(error.message);
    }
  });
  return overlay;
}

function modalReview(dialog) {
  const { overlay, modal } = modalShell({
    title: t("reviewTitle"),
    body: `
      <label class="radio-row"><input type="radio" name="review-target" value="uncommittedChanges" checked />
        <span class="r-main"><span class="r-title">${esc(t("reviewUncommitted"))}</span><span class="r-sub">${esc(t("reviewUncommittedSub"))}</span></span>
      </label>
      <label class="radio-row"><input type="radio" name="review-target" value="baseBranch" />
        <span class="r-main"><span class="r-title">${esc(t("reviewBranch"))}</span><span class="r-sub">${esc(t("reviewBranchSub"))}</span>
          <span class="r-extra"><input class="input" id="review-branch" placeholder="main" style="height:30px" /></span>
        </span>
      </label>
      <label class="radio-row"><input type="radio" name="review-target" value="commit" />
        <span class="r-main"><span class="r-title">${esc(t("reviewCommit"))}</span><span class="r-sub">${esc(t("reviewCommitSub"))}</span>
          <span class="r-extra"><input class="input" id="review-sha" placeholder="HEAD~1" style="height:30px" /></span>
        </span>
      </label>
      <label class="radio-row"><input type="radio" name="review-target" value="custom" />
        <span class="r-main"><span class="r-title">${esc(t("reviewCustom"))}</span><span class="r-sub">${esc(t("reviewCustomSub"))}</span>
          <span class="r-extra"><textarea class="textarea" id="review-instructions" style="min-height:64px"></textarea></span>
        </span>
      </label>
    `,
    foot: `<button class="btn" data-close="1">${esc(t("cancel"))}</button><button class="btn primary" id="start-review">${esc(t("reviewStart"))}</button>`,
  });
  modal.querySelector("[data-close]").addEventListener("click", closeModal);
  modal.querySelector("#start-review").addEventListener("click", async () => {
    const value = modal.querySelector('input[name="review-target"]:checked')?.value;
    let target;
    if (value === "baseBranch") {
      const branch = modal.querySelector("#review-branch").value.trim() || "main";
      target = { type: "baseBranch", branch };
    } else if (value === "commit") {
      const sha = modal.querySelector("#review-sha").value.trim();
      if (!sha) return toast(LANG === "zh" ? "请输入 commit SHA" : "Enter a commit SHA");
      target = { type: "commit", sha, title: null };
    } else if (value === "custom") {
      const instructions = modal.querySelector("#review-instructions").value.trim();
      if (!instructions) return toast(LANG === "zh" ? "请输入评审指令" : "Enter review instructions");
      target = { type: "custom", instructions };
    } else {
      target = { type: "uncommittedChanges" };
    }
    try {
      await window.api.call("review/start", {
        threadId: dialog.threadId,
        target,
        delivery: "inline",
      });
      closeModal();
      toast(t("reviewStarted"));
      state.running = true;
      render();
    } catch (error) {
      toast(error.message);
    }
  });
  return overlay;
}

function modalGoal(dialog) {
  const existing = state.goal;
  const { overlay, modal } = modalShell({
    title: t("goalTitle"),
    body: `
      <div class="field"><label>${esc(t("goalObjective"))}</label><textarea class="textarea" id="goal-objective" placeholder="${esc(t("goalPlaceholder"))}"></textarea></div>
      <div class="field"><label>${esc(t("goalBudget"))}</label><input class="input" id="goal-budget" type="number" min="0" /></div>
    `,
    foot: `<button class="btn" data-close="1">${esc(t("cancel"))}</button>${
      existing?.objective ? `<button class="btn danger" id="clear-goal">${esc(t("goalClear"))}</button>` : ""
    }<button class="btn primary" id="save-goal">${esc(t("goalSave"))}</button>`,
  });
  modal.querySelector("#goal-objective").value = existing?.objective || "";
  modal.querySelector("#goal-budget").value = existing?.tokenBudget || "";
  modal.querySelector("[data-close]").addEventListener("click", closeModal);
  modal.querySelector("#save-goal").addEventListener("click", async () => {
    const objective = modal.querySelector("#goal-objective").value.trim();
    if (!objective) return toast(LANG === "zh" ? "请输入目标" : "Enter an objective");
    const budgetRaw = modal.querySelector("#goal-budget").value.trim();
    try {
      const result = await window.api.call("thread/goal/set", {
        threadId: dialog.threadId,
        objective,
        status: "active",
        tokenBudget: budgetRaw ? Number(budgetRaw) : null,
      });
      state.goal =
        result.goal || {
          threadId: dialog.threadId,
          objective,
          tokensUsed: 0,
          tokenBudget: budgetRaw ? Number(budgetRaw) : null,
        };
      closeModal();
      render();
      toast(t("goalSaved"));
    } catch (error) {
      toast(error.message);
    }
  });
  const clear = modal.querySelector("#clear-goal");
  if (clear) {
    clear.addEventListener("click", async () => {
      try {
        await window.api.call("thread/goal/clear", { threadId: dialog.threadId });
        state.goal = null;
        closeModal();
        render();
      } catch (error) {
        toast(error.message);
      }
    });
  }
  return overlay;
}

function modalResetCredit() {
  const count = state.rates?.rateLimitResetCredits?.availableCount || 0;
  const { overlay, modal } = modalShell({
    title: t("resetConfirmTitle"),
    body: `<p style="margin:0">${esc(t("resetConfirmBody", { count }))}</p>`,
    foot: `<button class="btn" data-close="1">${esc(t("cancel"))}</button><button class="btn primary" id="do-reset">${esc(t("rateReset"))}</button>`,
  });
  modal.querySelector("[data-close]").addEventListener("click", closeModal);
  modal.querySelector("#do-reset").addEventListener("click", async () => {
    try {
      const result = await window.api.call("account/rateLimitResetCredit/consume", {
        idempotencyKey: crypto.randomUUID(),
      });
      closeModal();
      toast(result.outcome === "reset" ? t("resetDone") : result.outcome);
      await refreshRates();
    } catch (error) {
      toast(t("resetFail", { msg: error.message }));
    }
  });
  return overlay;
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

function modalLightbox(dialog) {
  const host=document.createElement('div');host.dataset.nativeImageModal='';
  const record={dialog,host,preview:null,mount:null};
  record.mount=()=>{
    if(nativeLightboxRecord!==record||record.preview)return;
    const original=globalThis.EvaOriginalCommonImagePreview;
    if(!original)return;
    window.removeEventListener('eva-native-image-common-ready',record.mount);
    try{record.preview=original.mount(host,{src:dialog.src,alt:dialog.alt,filename:dialog.filename,onClose:()=>queueMicrotask(()=>{if(state.modal===dialog)closeModal();})});}
    catch(error){host.setAttribute('role','alert');host.textContent=shortError(error);}
  };
  nativeLightboxRecord=record;
  if(globalThis.EvaOriginalCommonImagePreview)record.mount();
  else window.addEventListener('eva-native-image-common-ready',record.mount);
  return host;
}

/* ---------- approvals ---------- */

function buildApproval(approval) {
  if (approval.kind === "userInput") return buildQuestion(approval);
  if (approval.kind === "elicitation") return buildElicitation(approval);
  const params = approval.params || {};
  const isCommand = approval.kind === "command";
  const title = isCommand ? t("apCommand") : t("apFile");
  const subtitle = params.reason || (isCommand ? t("apCommandSub") : t("apFileSub"));
  const detail = isCommand
    ? Array.isArray(params.command)
      ? params.command.join(" ")
      : params.command || ""
    : params.grantRoot
      ? t("apGrant", { path: params.grantRoot })
      : t("apReview");
  const { overlay, modal } = modalShell({
    title,
    body: `<p style="margin:0 0 10px;color:var(--muted)">${esc(subtitle)}</p><pre style="margin:0;background:var(--code-bg);border:1px solid var(--border);border-radius:8px;padding:10px;font-family:var(--mono);font-size:12px;white-space:pre-wrap;word-break:break-all">${esc(detail)}</pre>`,
    foot: `<button class="btn danger" id="ap-decline">${esc(t("decline"))}</button><button class="btn" id="ap-session">${esc(t("allowSession"))}</button><button class="btn primary" id="ap-once">${esc(t("allowOnce"))}</button>`,
    onClose: () => {},
  });
  const decide = (decision) => {
    const index=state.approvals.indexOf(approval);if(index<0)return;state.approvals.splice(index,1);
    window.api.respond(approval.id, { decision });
    render();
  };
  modal.querySelector("#ap-decline").addEventListener("click", () => decide("decline"));
  modal.querySelector("#ap-session").addEventListener("click", () => decide("acceptForSession"));
  modal.querySelector("#ap-once").addEventListener("click", () => decide("accept"));
  return overlay;
}

function buildQuestion(approval) {
  const overlay=document.createElement('div');overlay.innerHTML='<div data-native-question></div><p role="alert" data-question-error></p>';const modal=overlay;
  const node = modal.querySelector('[data-native-question]');
  const questions = approval.params?.questions || [];
  const model = () => ({key:String(approval.id),questions,draft:approval.questionDraft,isSubmitting:!!approval.questionSubmitting});
  const bridge = {
    draft(draft) { approval.questionDraft = draft; },
    async dismiss(){
      if(approval.questionSubmitting||!state.approvals.includes(approval))return;
      approval.questionSubmitting=true;globalThis.EvaNativeUserInput.render(node,model(),bridge);
      try{
        // Original Kr replies empty only for onboarding/auto-resolution owners.
        // This native server request is neither; dismissal interrupts its turn.
        await api.call('turn/interrupt',{threadId:approval.params.threadId,turnId:approval.params.turnId});
      }catch(error){approval.questionSubmitting=false;modal.querySelector('[data-question-error]').textContent=shortError(error);globalThis.EvaNativeUserInput.render(node,model(),bridge);}
    },
    async submit(result) {
      if (approval.questionSubmitting || !state.approvals.includes(approval)) return;
      approval.questionSubmitting = true;
      globalThis.EvaNativeUserInput.render(node, model(), bridge);
      try {
        await api.respond(approval.id, result);
        const index = state.approvals.indexOf(approval);
        if (index >= 0) state.approvals.splice(index, 1);
        renderOverlay();
      } catch (error) {
        approval.questionSubmitting = false;
        modal.querySelector('[data-question-error]').textContent = shortError(error);
        globalThis.EvaNativeUserInput.render(node, model(), bridge);
      }
    },
  };
  globalThis.EvaNativeUserInput.render(node, model(), bridge);
  return overlay;
}

// MCP forms are a separate protocol from command/file approvals. Never infer a
// grant from the chat mode: native app permissions require an explicit response.
function buildElicitation(approval) {
  const params=approval.params||{},schema=params.requestedSchema||{};
  const formMode=['form','openai/form','openaiForm'].includes(params.mode);
  const fields=Object.entries(schema.properties||{}),required=new Set(schema.required||[]);
  const {overlay,modal}=modalShell({
    title:'应用访问授权',
    body:'<p data-elicitation-message style="white-space:pre-wrap"></p><p data-elicitation-server class="muted"></p><div data-elicitation-risk style="white-space:pre-wrap"></div><form data-elicitation-form></form><p data-elicitation-error role="alert"></p>',
    foot:'<button class="btn" data-elicitation-cancel>取消</button><button class="btn danger" data-elicitation-decline>拒绝</button><button class="btn primary" data-elicitation-accept>允许</button>',
    onClose:()=>respond('cancel'),
  });
  modal.querySelector('[data-elicitation-message]').textContent=params.message||'该工具请求你的授权。';
  modal.querySelector('[data-elicitation-server]').textContent='请求来源：'+(params.serverName||'MCP');
  const metadata=params._meta;
  const risk=[];
  function collectRisk(value,depth=0){
    if(!value||typeof value!=='object'||depth>3)return;
    for(const [key,item]of Object.entries(value)){
      if(typeof item==='string'&&/risk|warning|message|description/i.test(key))risk.push(item);
      else if(item&&typeof item==='object')collectRisk(item,depth+1);
    }
  }
  collectRisk(metadata);
  modal.querySelector('[data-elicitation-risk]').textContent=[...new Set(risk)].join('\n');
  const form=modal.querySelector('form'),error=modal.querySelector('[data-elicitation-error]'),controls=[];
  let supported=formMode&&params.requestedSchema!==null&&typeof params.requestedSchema==='object'&&!Array.isArray(schema)&&(schema.type===undefined||schema.type==='object')&&[...required].every(key=>Object.hasOwn(schema.properties||{},key));
  for(const [key,field]of fields){
    if(!field||typeof field!=='object'){supported=false;continue;}
    const row=document.createElement('div');row.className='field';
    const label=document.createElement('label');label.textContent=(field.title||key)+(required.has(key)?' *':'');row.append(label);
    let input,choices=field.oneOf||field.enum?.map((value,index)=>({const:value,title:field.enumNames?.[index]||value}));
    if(field.type==='boolean'){
      // A select distinguishes an unanswered optional boolean from false.
      input=document.createElement('select');
      for(const [value,text]of [['','请选择'],['true','是'],['false','否']])input.add(new Option(text,value));
      if(typeof field.default==='boolean')input.value=String(field.default);
    }else if(field.type==='string'&&choices){
      input=document.createElement('select');input.add(new Option('请选择',''));
      for(const option of choices)input.add(new Option(option.title||String(option.const),String(option.const)));
      if(field.default!==undefined)input.value=field.default;
    }else if(['string','number','integer'].includes(field.type)){
      input=document.createElement('input');input.type=field.type==='string'?'text':'number';
      if(field.type==='string'){
        if(['email','uri','date','date-time'].includes(field.format))input.type={email:'email',uri:'url',date:'date','date-time':'datetime-local'}[field.format];
        if(field.minLength!==undefined)input.minLength=field.minLength;
        if(field.maxLength!==undefined)input.maxLength=field.maxLength;
      }else{
        input.step=field.type==='integer'?'1':'any';
        if(field.minimum!==undefined)input.min=field.minimum;
        if(field.maximum!==undefined)input.max=field.maximum;
      }
      if(field.default!==undefined)input.value=field.default;
    }else{supported=false;continue;}
    input.className='input';input.required=required.has(key);input.id='elicitation-field-'+controls.length;
    label.htmlFor=input.id;row.append(input);
    if(field.description){const note=document.createElement('p');note.className='muted';note.textContent=field.description;row.append(note);}
    form.append(row);controls.push({key,field,input});
  }
  if(!supported)error.textContent='此请求使用暂不支持的授权表单，请取消或拒绝。';
  modal.querySelector('[data-elicitation-accept]').disabled=!supported;
  let answered=false;
  function respond(action){
    if(answered)return;
    let content=null;
    if(action==='accept'){
      if(!supported||!form.reportValidity())return;
      content=Object.create(null);
      for(const {key,field,input}of controls){
        if(input.value==='')continue;
        if(field.type==='string'&&field.minLength!==undefined&&input.value.length<field.minLength){error.textContent=(field.title||key)+'长度不足';return;}
        content[key]=field.type==='boolean'?input.value==='true':['number','integer'].includes(field.type)?Number(input.value):input.value;
      }
    }
    answered=true;
    const index=state.approvals.findIndex(item=>item.id===approval.id);
    if(index>=0)state.approvals.splice(index,1);
    window.api.respond(approval.id,{action,content,_meta:null});
    render();
  }
  form.addEventListener('submit',event=>event.preventDefault());
  modal.querySelector('[data-elicitation-cancel]').onclick=()=>respond('cancel');
  modal.querySelector('[data-elicitation-decline]').onclick=()=>respond('decline');
  modal.querySelector('[data-elicitation-accept]').onclick=()=>respond('accept');
  return overlay;
}
