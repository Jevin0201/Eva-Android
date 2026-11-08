import {installReaderSelection} from './reader-selection.js';
import {mountOfficePreview} from './office-preview.js';
const status=document.querySelector('#status'),frame=document.querySelector('iframe'),office=document.querySelector('#office');
const name=new URL(location.href).searchParams.get('name')||'',ext=name.split('.').pop().toLowerCase();
let sheetNames;try{const names=JSON.parse(new URL(location.href).searchParams.get('sheetNames'));if(Array.isArray(names)&&names.length>0&&names.length<=300&&names.every(n=>typeof n==='string'&&n.trim()&&[...n].length<=200&&!/[\u0000-\u001f\u007f-\u009f]/.test(n)))sheetNames=names;}catch{}
let dispose,disposed=false,model=null,sourceText='';
status.textContent='正在渲染文档…';document.body.dataset.readerState='rendering';
installReaderSelection({kind:['md','markdown'].includes(ext)?'markdown':ext,office,frame,getModel:()=>model,getSource:()=>sourceText});
function prepare(node){node.hidden=false;node.style.visibility='hidden';}
async function reveal(node){
 await document.fonts.ready;const images=[...node.querySelectorAll('img'),...(node.shadowRoot?.querySelectorAll('img')||[])];await Promise.all(images.map(img=>img.decode().catch(()=>{})));
 await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);if(disposed)return;node.style.visibility='visible';status.hidden=true;document.body.dataset.readerState='ready';
}
addEventListener('eva-preview-pause',()=>{for(const media of office.shadowRoot?.querySelectorAll('audio,video')||[])media.pause();});
addEventListener('pagehide',()=>{disposed=true;dispose?.();});
async function load(){
 if(['mp3','wav','ogg','m4a','aac','flac','mp4','webm','mkv','mov','m4v','3gp','oga','opus'].includes(ext)){
  const {mountMedia}=await import('./native-reader.js');prepare(office);
  dispose=mountMedia(office,{src:'/document',title:name,kind:['mp4','webm','mkv','mov','m4v','3gp'].includes(ext)?'video':'audio',onError:()=>{status.hidden=false;status.textContent='系统不支持此媒体编码或文件已损坏。';}});await reveal(office);return;
 }
 const response=await fetch('/document');if(!response.ok)throw Error('文件读取失败');const bytes=await response.arrayBuffer();if(disposed)return;
 if(['html','htm'].includes(ext)){
  const {mountHTML}=await import('./native-reader.js');
  window.api={previewRead:async({filePath})=>{const r=await fetch('/resource?path='+encodeURIComponent(filePath));if(!r.ok)throw Error('本地资源不可访问');const b=new Uint8Array(await r.arrayBuffer());let str='';for(let i=0;i<b.length;i+=8192)str+=String.fromCharCode(...b.subarray(i,i+8192));return {base64:btoa(str)};}};
  const controller=new AbortController();addEventListener('pagehide',()=>controller.abort(),{once:true});prepare(office);
  dispose=await mountHTML(office,{text:new TextDecoder().decode(bytes),path:'/local/'+name,resourceRoot:'/local',signal:controller.signal});await reveal(office);return;
 }
 if(['md','markdown'].includes(ext)){
  prepare(office);office.style.cssText='box-sizing:border-box;padding:16px;overflow:auto;visibility:hidden';sourceText=new TextDecoder().decode(bytes);office.innerHTML=cloudMarkdown.render(sourceText);for(const image of office.querySelectorAll('img[src]')){const url=new URL(image.getAttribute('src'),'https://local.invalid/local/'+encodeURIComponent(name));if(url.origin==='https://local.invalid'&&url.pathname.startsWith('/local/'))image.src='/resource?path='+encodeURIComponent(decodeURIComponent(url.pathname));}await cloudMarkdown.hydrate(office);await reveal(office);return;
 }
 if(['xlsx','pptx','csv','tsv'].includes(ext)){
  const {readOffice}=await import('./office-browser.js');model=await readOffice(bytes,name);if(disposed)return;
  prepare(office);dispose=mountOfficePreview(office,{model,title:name});await reveal(office);
 }else{
  const type=ext==='pdf'?'pdf':'docx';
  addEventListener('message',e=>{
   if(e.source!==frame.contentWindow||e.origin!==location.origin)return;
   if(e.data?.type===type+'-preview-loaded')frame.contentWindow.postMessage({type:type+'-preview',token:'android-reader',bytes,sheetNames:type==='pdf'?sheetNames:undefined},location.origin);
   if(e.data?.type===type+'-preview-ready')reveal(frame);
   if(e.data?.type===type+'-preview-error'){status.hidden=false;status.textContent='无法预览此文件，请返回重试或另存原文件。';}
  });
  prepare(frame);frame.src='./cloud-'+type+'-frame.html';
 }
}
load().catch(e=>{document.body.dataset.readerState='error';status.hidden=false;status.textContent='预览失败：'+e.message;});
