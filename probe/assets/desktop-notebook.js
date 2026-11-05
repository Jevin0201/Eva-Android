import {mountNotebook} from './desktop-notebook-bundle.js';

// Android owns the read-only document transport. Notebook cells/output are desktop components.
const markdown = window.markdownit({html: false, linkify: false});
window.EvaNativeSteering = {
 mountPreview(node, {text}) {
  node.innerHTML = markdown.render(text);
  return {dispose() { node.replaceChildren(); }};
 }
};
function restoreViewport(host, savedTop) {
 const target = Number.isSafeInteger(savedTop) && savedTop > 0 ? savedTop : 0;
 const scroller = document.scrollingElement;
 let restoring = true;
 let frame = 0;
 const events = new AbortController();
 const save = () => {
  frame = 0;
  if (!restoring) window.PreviewHost.saveViewport?.(Math.round(scroller.scrollTop));
 };
 const scheduleSave = () => { if (!frame) frame = requestAnimationFrame(save); };
 const restore = () => {
  if (!restoring || scroller.scrollHeight - scroller.clientHeight < target) return;
  scroller.scrollTop = target;
  restoring = false;
  resize.disconnect();
  changes.disconnect();
  scheduleSave();
 };
 const cancelRestore = () => { restoring = false; resize.disconnect(); changes.disconnect(); scheduleSave(); };
 // Explicit reading intent takes precedence while React or output images are laying out.
 window.addEventListener('wheel', cancelRestore, {passive: true, signal: events.signal});
 window.addEventListener('touchstart', cancelRestore, {passive: true, signal: events.signal});
 window.addEventListener('keydown', event => {
  if (['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key)) cancelRestore();
 }, {signal: events.signal});
 window.addEventListener('scroll', scheduleSave, {passive: true, signal: events.signal});
 const resize = new ResizeObserver(restore);
 resize.observe(document.documentElement);
 resize.observe(host);
 const changes = new MutationObserver(restore);
 changes.observe(host.shadowRoot || host, {subtree: true, childList: true, characterData: true});
 restore();
 return () => {
  if (frame) cancelAnimationFrame(frame);
  save();
  events.abort();
  resize.disconnect();
  changes.disconnect();
 };
}
let dispose;
let disposeViewport;
try {
 const result = JSON.parse(window.PreviewHost.readNotebook());
 if (!result.ok) throw Error(result.error || 'Notebook 读取失败');
 const text = result.text;
 if (typeof text !== 'string' || !text.trim()) throw Error('Notebook 文件为空或读取失败');
 JSON.parse(text);
 const host = document.getElementById('notebook');
 dispose = mountNotebook(host, {text, cwd: '/root/eva-workspace'});
 disposeViewport = restoreViewport(host, result.viewport);
 document.getElementById('status').hidden = true;
 document.documentElement.dataset.notebookReady = 'true';
} catch (error) {
 const status = document.getElementById('status');
 status.setAttribute('role', 'alert');
 status.textContent = '无法预览 Notebook：' + error.message;
}
window.addEventListener('pagehide', () => { disposeViewport?.(); dispose?.(); }, {once: true});
