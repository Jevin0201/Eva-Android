/* Desktop diagnostics core with an Android UI and event adapter. */
(() => {
 function toast(text) {
  kernelNotice = text;
  refreshKernelControls();
 }
 function workspaceDialog(title, body) {
  document.querySelector('[data-runtime-diagnostics-dialog]')?.remove();
  const overlay = document.createElement('div');
  overlay.dataset.runtimeDiagnosticsDialog = '';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', title);
  overlay.style.cssText = 'position:fixed;inset:0;z-index:1000;background:var(--paper,#fff);color:var(--ink,#222);overflow:auto;padding:24px;box-sizing:border-box';
  const heading = document.createElement('h2');
  heading.textContent = title;
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '关闭';
  close.addEventListener('click', () => overlay.remove());
  const content = document.createElement('div');
  content.className = 'modal-body';
  content.style.overflowWrap = 'anywhere';
  content.innerHTML = body;
  overlay.append(close, heading, content);
  overlay.addEventListener('keydown', event => { if (event.key === 'Escape') overlay.remove(); });
  document.body.append(overlay);
  close.focus();
  return {modal: overlay};
 }
function quotaFailureText(raw){
 const text=String(raw?.message||raw||'');
 if(/usage.?limit|hit your.*limit|insufficient_quota|使用上限|额度/.test(text)){const reset=/try again at ([^.]+(?:AM|PM)?)/i.exec(text)?.[1]?.trim();return '当前账号的使用额度已用完。'+(reset?'可在 '+reset+' 后重试，也可在账户用量设置中查看额度。':'请在账户用量设置中查看恢复时间或可用额度。');}
 if(/rate.?limit|too many requests/i.test(text))return '请求过于频繁，请稍后重试。';return null;
}
/* Keep known runtime diagnostics readable without changing shared configuration. */
const runtimeWarnings=(()=>{
 const seen=new Map();
 let records=[];try{if(typeof sessionStorage!=='undefined')records=JSON.parse(sessionStorage.getItem('codex-rae.diagnostics')||'[]');if(!Array.isArray(records))records=[];}catch{records=[];}
 function format(message){
  const text=String(message);
  const ignored=text.match(/Ignored unsupported project-local config keys in\s+([\s\S]+?config\.toml):\s*([\s\S]+?)(?:\.\s*If you want these settings to apply|$)/i);
  if(ignored){const keys=ignored[2].trim().replace(/\.$/,'');return `项目配置中的 ${keys} 设置未生效：内核仅允许在用户级配置中设置此项。复刻版不会自动修改官方 Codex 配置。`;}
  return text;
 }
 function record(message,options={}){
  const text=format(message),key=options.key||text,old=records.find(r=>r.key===key);
  if(old){old.at=Date.now();old.count++;old.text=text;}else records.push({key,text,at:Date.now(),count:1});
  records=records.slice(-100);try{if(typeof sessionStorage!=='undefined')sessionStorage.setItem('codex-rae.diagnostics',JSON.stringify(records));}catch{}
  return text;
 }
 function show(message,now=Date.now()){
  const text=record(message),previous=seen.get(text);
  // Ignored project-local settings do not require a user action in a chat.
  if(text!==String(message))return false;
  if(previous!==undefined&&now-previous<60000)return false;
  seen.set(text,now);if(seen.size>200)seen.delete(seen.keys().next().value);
  toast(text,6000);return true;
 }
 function open(){
  const body=records.length?records.slice().sort((a,b)=>b.at-a.at).map(r=>`<div class="diagnostic-row"><time>${new Date(r.at).toLocaleTimeString('zh-CN')}${r.count>1?' · '+r.count+' 次':''}</time><p>${esc(r.text)}</p></div>`).join(''):'<p>本窗口暂无提示记录。</p>';
  const {modal}=workspaceDialog('提示记录',body);modal.querySelector('.modal-body')?.setAttribute('aria-live','polite');
 }
 return {format,show,record,open,entries:()=>records.map(r=>({...r}))};
})();

 const previousEvent = kernelEvent;
 kernelEvent = function(event) {
  const params = event.params || {};
  const raw = event.error || (event.method === 'warning' || event.method === 'error' ? params.message || params.error?.message : null);
  if (raw) {
   const text = String(raw.message || raw);
   if (event.method !== 'warning') runtimeWarnings.record(text, {key: event.ticket ? 'rpc:' + text : event.method + ':' + (params.threadId || '') + ':' + (params.turnId || '') + ':' + text});
   if (event.method === 'warning') runtimeWarnings.show(text);
   if (event.method === 'error') toast(quotaFailureText(text) || text);
  }
  if (event.ticket && event.error) {
   const friendly = quotaFailureText(event.error);
   if (friendly) event = {...event, error: friendly};
  }
  return previousEvent(event);
 };
 const previousNavigate = navigate;
 navigate = function(action) {
  if (action === 'runtime-diagnostics') { runtimeWarnings.open(); return; }
  return previousNavigate(action);
 };
 window.evaRuntimeDiagnostics = {open: runtimeWarnings.open, entries: runtimeWarnings.entries, formatFailure: quotaFailureText};
})();
