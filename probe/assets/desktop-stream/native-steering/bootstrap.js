'use strict';
// Eva owns transcript identity and mount lifetime; the recovered components own UI.
globalThis.nativeSteeringHost=(()=>{
 const models=new Map();let implementation;
 window.addEventListener('codex-message-from-view',event=>{
  const message=event.detail;if(event.__codexForwardedViaBridge||message?.type!=='open-in-browser')return;
  let url;try{url=new URL(message.url);if(!['https:','http:'].includes(url.protocol))return;}catch{return;}
  const request=message.useExternalBrowser?api.openExternal(url.href):globalThis.cloudLinks?.open(url.href);
  Promise.resolve(request).catch(error=>{if(typeof toast==='function')toast(error.message);else console.error(error);});
 });
 const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
 function html(model){
  const key=JSON.stringify([model.conversationId,model.turn?.id,model.item.id]);
  models.set(key,model);
  return '<div data-flow-key="'+escape('native-steering:'+key)+'" data-native-steering="'+escape(key)+'"'+(model.kind==='activity'?' data-native-owned-light-dom':'')+' data-steering-state="'+escape(model.delivery)+'"></div>';
 }
 function hydrate(root=document){
  implementation?.hydrate(root,models);
  const active=new Set([...document.querySelectorAll('[data-native-steering]')].map(node=>node.dataset.nativeSteering));
  // Collapsed original disclosures mount their children lazily. Keep models
  // reachable from those children until their owning transcript row disappears.
  for(const key of active){const html=models.get(key)?.detailsHTML;if(!html)continue;const fragment=document.createElement('template');fragment.innerHTML=html;for(const node of fragment.content.querySelectorAll('[data-native-steering]'))active.add(node.dataset.nativeSteering);}
  for(const key of models.keys())if(!active.has(key))models.delete(key);
 }
 function ready(value){implementation=value;hydrate();}
 return{html,hydrate,ready};
})();
