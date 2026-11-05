'use strict';
// Owned conversation data and DOM ownership only. All image UI comes from REA-retained components.
globalThis.nativeImagePreviewHost=(()=>{
 const models=new Map(),previewRuntimes=new Set();let implementation,previewOpen=false;
 // Native child views are composited above DOM portals. Subscribe to the
 // retained preview's own lifecycle rather than guessing from portal markup.
 function trackPreview(runtime){
  if(previewRuntimes.has(runtime))return;
  previewRuntimes.add(runtime);
  const changed=()=>{
   const open=[...previewRuntimes].some(core=>core.isPreviewOpen());
   if(open===previewOpen)return;
   previewOpen=open;
   window.dispatchEvent(new CustomEvent('eva-native-image-preview-change',{detail:{open}}));
   if(open){if(typeof hideBrowserNative==='function')hideBrowserNative();}
   else if(typeof showBrowserNative==='function')showBrowserNative();
  };
  runtime.subscribePreview(changed);changed();
 }
 const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
 function html(item,turn,conversationId,kind='activity'){
  const key=JSON.stringify([conversationId,turn?.id,item.id]);
  models.set(key,{item,conversationId,kind});
  return '<div data-flow-key="'+escape('native-image:'+key)+'" data-native-image-activity="'+escape(key)+'"></div>';
 }
 function hydrate(root=document){
  if(!implementation)return;
  implementation.hydrate(root,models);
  const active=new Set([...document.querySelectorAll('[data-native-image-activity]')].map(node=>node.dataset.nativeImageActivity));
  for(const key of models.keys())if(!active.has(key))models.delete(key);
 }
 function ready(value){implementation=value;hydrate();}
 return{html,hydrate,ready,trackPreview,isPreviewOpen:()=>previewOpen};
})();
