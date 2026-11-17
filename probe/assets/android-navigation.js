
'use strict';
// Native back dispatch enters here, then follows the latest overlay owners.
(() => {
 // A section has one parent. Tabs, filters and sibling settings are not history.
 let parent=null;
 function settingsLocation(){
  if(['desktop-extensions','extensions','plugins','skills','mcp'].includes(settingPage))return 'extensions';
  return settingPage;
 }
 const openSettings=settingsGo;
 settingsGo=function(page){
  const before=settingsLocation();
  const result=openSettings(page);
  const after=settingsLocation();
  if(after!==before){
   if(!before||after==='settings')parent=null;
   else if(before==='settings')parent='settings';
   // Moving between siblings keeps their shared parent, never the previous tab.
  }
  return result;
 };
 function backSettings(){
  if(settingPage==='skills'&&window.skillManager&&!skillManager.canLeave())return;
  if(parent&&settingPage!=='settings'){settingsGo(parent);return;}
  parent=null;
  if(window.evaDesktopExtensions?.close)evaDesktopExtensions.close();
  else{window.EvaPluginAddHost?.detach();settingPage=null;render();}
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
