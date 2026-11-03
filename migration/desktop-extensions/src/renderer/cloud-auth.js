'use strict';
globalThis.cloudAuth=(()=>{
 let cached=null,pending=null,epoch=0;
 function invalidate(){epoch++;cached=null;pending=null;}
 async function check(){if(cached&&Date.now()-cached.at<15000)return cached.signedIn;if(pending)return pending;const version=epoch,job=api.call('account/read',{}).then(value=>{const signedIn=value?.account?.type==='chatgpt';if(version===epoch)cached={at:Date.now(),signedIn};return signedIn;}).finally(()=>{if(pending===job)pending=null;});pending=job;return job;}
 function required(error){return /请登录\s*ChatGPT|登录已失效|先使用 OpenAI 账号登录|CHATGPT_LOGIN_REQUIRED/.test(String(error?.message||error||''));}
 function failed(error){if(!required(error))return false;cached={at:Date.now(),signedIn:false};return true;}
 function markup(detail='登录后即可查看此处的账号内容'){return '<div class="cloud-login-gate" role="status"><h2>请登录 ChatGPT</h2><p>'+esc(detail)+'</p><button type="button" class="btn primary" data-chatgpt-login>登录 ChatGPT</button></div>';}
 function signIn(){if(!state.settingsOpen||state.settingsTab!=='account')openSettings('account');}
 document.addEventListener('click',event=>{if(event.target.closest('[data-chatgpt-login]')){event.preventDefault();signIn();}});
 api.onNotification?.(({method})=>{if(['account/updated','account/login/completed'].includes(method)){invalidate();window.dispatchEvent(new Event('eva:chatgpt-auth-changed'));}});
 return {check,invalidate,required,failed,markup,signIn};
})();
