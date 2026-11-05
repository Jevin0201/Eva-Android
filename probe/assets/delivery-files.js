'use strict';
// Adapted from the shipped Codex artifact-list layout; native code owns file access.
window.evaDeliveryFiles=(()=>{
 const root='/root/eva-workspace/',linkCache=new Map(),expanded=new Set();
 function path(href,cwd=root){
  if(typeof href!=='string'||/[\u0000-\u001f]/.test(href))return null;
  if(/^[a-z][a-z0-9+.-]*:/i.test(href)||href.startsWith('//')||href.startsWith('#'))return null;
  try{const base=cwd.replace(/\/$/,'')+'/';const u=new URL(href,'https://eva.invalid'+base);if(u.origin!=='https://eva.invalid')return null;const decoded=decodeURIComponent(u.pathname);if(!decoded.startsWith(root)||decoded.split('/').some(p=>p==='..'||p==='.')||decoded.includes('\\'))return null;return decoded;}catch{return null;}
 }
 function links(text,cwd){const key=cwd+'\n'+text;if(linkCache.has(key))return linkCache.get(key);const found=new Map();for(const link of EvaDeliverySource.scanLinks(text||'')){if(link.syntax!=='link')continue;const p=path(link.destination,cwd);if(p&&!found.has(p))found.set(p,{path:p,name:p.split('/').pop()});}const result=[...found.values()];if((text||'').length<100000){if(linkCache.size>=32)linkCache.delete(linkCache.keys().next().value);linkCache.set(key,result);}return result;}
 const href=p=>root+p.slice(root.length).split('/').map(encodeURIComponent).join('/');
 function files(turn,cwd){const found=new Map();for(const item of turn.items||[]){if(item.type!=='agentMessage'||item.phase==='commentary')continue;for(const file of links(itemText(item),cwd))found.set(file.path,file);}return [...found.values()];}
 const category=name=>({pptx:'PowerPoint 演示文稿',ppt:'PowerPoint 演示文稿',pdf:'PDF 文档',docx:'Word 文档',xlsx:'Excel 工作簿',csv:'CSV 表格',md:'Markdown 文档',html:'HTML 页面',zip:'ZIP 压缩文件',png:'PNG 图片',jpg:'JPEG 图片',jpeg:'JPEG 图片',svg:'SVG 图片'})[name.split('.').pop().toLowerCase()]||'文件';
 const fileIcon="<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" fill=\"currentColor\" viewBox=\"0 0 24 24\"><path fill-rule=\"evenodd\" d=\"M7 2a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V8.828a3 3 0 0 0-.879-2.12l-3.828-3.83A3 3 0 0 0 13.172 2H7Zm5 2H7a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9h-3a3 3 0 0 1-3-3V4Zm5.586 4H15a1 1 0 0 1-1-1V4.414L17.586 8Z\" clip-rule=\"evenodd\"/></svg>\n";
 const downloadIcon='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3v11m-4-4 4 4 4-4M5 15v4.5a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5V15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
 function previewKind(name){return window.EvaDesktopPreviewTypes?.classifyLocalPreview(name)||window.EvaDesktopPreviewTypes?.artifactImportKind({file_name:name})||'file';}
 function cards(turn,cwd){const rows=files(turn,cwd);if(!rows.length)return '';const key=turn.id||rows.map(f=>f.path).join('|'),open=expanded.has(key);return '<section class="delivery-files" aria-label="交付文件">'+rows.map((f,i)=>`<div class="delivery-file" data-preview-kind="${esc(previewKind(f.name))}"${i>=3&&!open?' hidden':''}><a class="delivery-file-open" href="${esc(href(f.path))}" aria-label="预览 ${esc(f.name)}" title="${esc(f.name)}">${fileIcon}<span class="delivery-file-info"><span class="delivery-file-name">${esc(f.name)}</span><span class="delivery-file-type-label">${esc(category(f.name))}</span><span class="delivery-file-hover-label" aria-hidden="true">打开文件</span></span></a><button type="button" class="delivery-file-save" data-action="delivery-save:${esc(encodeURIComponent(f.path))}" aria-label="下载 ${esc(f.name)}" title="下载">${downloadIcon}</button></div>`).join('')+(rows.length>3?`<button type="button" class="delivery-file-more" data-action="delivery-more:${esc(encodeURIComponent(key))}" aria-expanded="${open}"><span aria-hidden="true">${open?'⌃':'⌄'}</span>${open?'收起':`还有 ${rows.length-3} 个文件`}</button>`:'')+'</section>';}
 function decorate(html,turn,cwd){if(typeof document==='undefined'||!files(turn,cwd).length)return html;const template=document.createElement('template');template.innerHTML=html;
  // Standalone file-link paragraphs become the resource list, with no second bare-link list.
  const delivered=new Set(files(turn,cwd).map(f=>f.path));for(const node of template.content.querySelectorAll('.turn-final .assistant.markdown p,.turn-final .assistant.markdown li')){
   const copy=node.cloneNode(true);let count=0;for(const a of copy.querySelectorAll('a[href]'))if(delivered.has(path(a.getAttribute('href'),cwd))){a.remove();count++;}for(const br of copy.querySelectorAll('br'))br.remove();if(count&&!copy.querySelector('img,code,pre')&&/^[\s·•,，、;；]*$/.test(copy.textContent))node.remove();
  }
  for(const node of template.content.querySelectorAll('.turn-final .assistant.markdown li,.turn-final .assistant.markdown ul,.turn-final .assistant.markdown ol'))if(!node.textContent.trim()&&!node.querySelector('img,video,audio,code'))node.remove();
  for(const node of template.content.querySelectorAll('.turn-final .assistant.markdown'))if(!node.textContent.trim()&&!node.querySelector('img,video,audio'))node.remove();
  return template.innerHTML;
 }
 function toggle(key){if(expanded.has(key))expanded.delete(key);else{if(expanded.size>=64)expanded.delete(expanded.values().next().value);expanded.add(key);}}
 return {path,links,cards,decorate,toggle,previewKind};
})();
(()=>{const previous=mobileFlow.turn;mobileFlow.turn=function(turn){const cwd=typeof active==='function'?(active()?.kernelThread?.cwd||('/root/eva-workspace'+(active()?.projectId?'/projects/'+active().projectId:''))):'/root/eva-workspace';return evaDeliveryFiles.decorate(previous.call(this,turn),turn,cwd)+evaDeliveryFiles.cards(turn,cwd);};
 const prior=navigate;navigate=function(action){if(action.startsWith('delivery-save:')){const path=evaDeliveryFiles.path(decodeURIComponent(action.slice(14)));if(path)EvaHost.exportWorkspaceFile(path);return;}if(action.startsWith('delivery-more:')){const key=decodeURIComponent(action.slice(14));evaDeliveryFiles.toggle(key);const c=active();if(c){for(const turn of c.kernelThread?.turns||[])completedTurnHtml.delete(turn);updateKernelFlow(c);}return;}return prior(action);};
})();
// Initial completed-turn caches can precede this optional renderer.
if(typeof active==='function'&&typeof updateKernelFlow==='function'){
 const current=active();if(current?.kernelThread){for(const turn of current.kernelThread.turns||[])completedTurnHtml.delete(turn);if(!settingPage&&['home','chat'].includes(route))updateKernelFlow(current);}
}
