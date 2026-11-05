
'use strict';
// Native back dispatch enters here, then follows the latest overlay owners.
(() => {
 const history=[];
 let restoring=false;
 function settingsLocation(){
  if(settingPage==='desktop-extensions'){
   const tab=document.querySelector('.eva-extension-tabs [aria-selected="true"]');
   return tab?.dataset.action?.slice(9)||'extensions';
  }
  return settingPage;
 }
 const openSettings=settingsGo;
 settingsGo=function(page){
  const before=settingsLocation();
  if(!before)history.length=0;
  const result=openSettings(page);
  const after=settingsLocation();
  if(after!==before){
   if(after==='settings')history.length=0;
   else if(!restoring&&before)history.push(before);
  }
  return result;
 };
 function backSettings(){
  if(settingPage==='settings'){
   history.length=0;settingPage=null;render();return;
  }
  const destination=history.at(-1)||'settings';
  const before=settingsLocation();
  restoring=true;
  try{settingsGo(destination);}finally{restoring=false;}
  if(settingsLocation()!==before&&history.at(-1)===destination)history.pop();
 }
 const go=navigate;
 navigate=function(action){
  if(action==='settings-back'){backSettings();return;}
  return go(action);
 };
 function closeOriginalImagePreview(){
  const roots=[document];
  while(roots.length){
   const root=roots.shift();
   const buttons=root.querySelectorAll('button[aria-label="关闭图片预览"],button[aria-label="Close image preview"]');
   for(const button of buttons){
    if(button.closest('[role="dialog"]')&&!button.disabled){button.click();return true;}
   }
   for(const element of root.querySelectorAll('*'))if(element.shadowRoot)roots.push(element.shadowRoot);
  }
  return false;
 }
 window.evaAndroidBack=()=>{
  if(document.documentElement.classList.contains('ime-visible')){
   window.evaHideKeyboard?.();return true;
  }
  if(closeOriginalImagePreview())return true;
  return window.evaBack?.()===true;
 };
})();
