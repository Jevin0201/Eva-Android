'use strict';
// Android WebView returns visual-viewport quads to CDP. Validate occlusion in DOM
// coordinates before dispatching the actual CDP pointer (which uses visual quads).
const path=require('node:path');
const {Locator}=require(path.join(path.dirname(require.resolve('playwright-core/package.json')),'lib/client/locator.js'));
const originals=Object.fromEntries(['click','dblclick','hover','check','uncheck'].map(k=>[k,Locator.prototype[k]]));
async function validate(locator){
 await locator.waitFor({state:'visible',timeout:5000});
 const state=await locator.evaluate(async e=>{
  e.scrollIntoView({block:'center',inline:'center'});
  const rect=e.getBoundingClientRect();await new Promise(requestAnimationFrame);const next=e.getBoundingClientRect();
  const x=next.x+next.width/2,y=next.y+next.height/2,root=e.getRootNode(),hit=root.elementFromPoint?.(x,y)||e.ownerDocument.elementFromPoint(x,y);
  return {ok:!!hit&&(e===hit||e.contains(hit))&&!e.disabled&&next.width>0&&next.height>0&&Math.abs(rect.x-next.x)<1&&Math.abs(rect.y-next.y)<1,scale:visualViewport?.scale||1};
 });if(!state.ok)throw Error('Android 点击前验证失败：控件被遮挡、不可用或仍在移动，请重新观察');return state;
}
for(const kind of ['click','dblclick','hover'])Locator.prototype[kind]=async function(options={}){const state=await validate(this);return originals[kind].call(this,{...options,...(state.scale!==1?{force:true}:{})});};
for(const kind of ['check','uncheck'])Locator.prototype[kind]=async function(options={}){const wanted=kind==='check';if(await this.isChecked()===wanted)return;await this.click(options);if(await this.isChecked()!==wanted)throw Error('勾选操作已发送但未验证，不要盲目重复');};

// CDP reads paths in Android's filesystem, while Node runs in Eva's Linux root.
if(process.env.EVA_ANDROID_ROOT){
 const {CRSession}=require(path.join(path.dirname(require.resolve('playwright-core/package.json')),'lib/server/chromium/crConnection.js'));
 const send=CRSession.prototype.send;
 CRSession.prototype.send=function(method,params,...rest){if(method==='DOM.setFileInputFiles'&&params?.files)params={...params,files:params.files.map(file=>file.startsWith('/root/')?process.env.EVA_ANDROID_ROOT+file:file)};return send.call(this,method,params,...rest);};
}
