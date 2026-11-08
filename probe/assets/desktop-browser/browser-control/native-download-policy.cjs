'use strict';
const path=require('node:path');
let installed=false;
// Downloads belong to Eva's native session (will-download), not Playwright's
// temporary directory. This native engine rejects Browser.setDownloadBehavior
// for its default context. Ignore only that observed initialization refusal;
// navigation, file selection and all other protocol failures still propagate.
function install(){
 if(installed)return;
 const file=path.join(path.dirname(require.resolve('playwright-core/package.json')),'lib/server/chromium/crConnection.js');
 const {CRSession}=require(file),send=CRSession.prototype.send;
 CRSession.prototype.send=async function(method,params,...rest){
  try{return await send.call(this,method,params,...rest)}catch(error){
   if(method==='Browser.setDownloadBehavior'&&['deny','allowAndName'].includes(params?.behavior)&&params.browserContextId==null&&String(error.message).includes('Browser context management is not supported.'))return {};
   throw error;
  }
 };
 installed=true;
}
module.exports={install};
