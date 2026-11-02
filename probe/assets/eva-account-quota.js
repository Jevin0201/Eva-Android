/* Existing account/rateLimits snapshots, displayed directly in the logo menu. */
(function(root,factory){const exported=factory();if(typeof module==='object'&&module.exports)module.exports=exported;else {root.desktopQuota=exported;root.accountQuota=exported.createMenu();}})(globalThis,function(){
 'use strict';
 function quotaView(account,snapshot){
  if(account?.type!=='chatgpt')return null;
  const entries=snapshot?.rateLimitsByLimitId&&Object.keys(snapshot.rateLimitsByLimitId).length?Object.entries(snapshot.rateLimitsByLimitId):[['codex',snapshot?.rateLimits]];
  const plan=String(account.planType&&account.planType!=='unknown'?account.planType:snapshot?.rateLimits?.planType||account.planType||'unknown').toLowerCase();
  const pro=['pro','prolite','promax'].includes(plan),plus=plan==='plus';
  const buckets=entries.filter(([,bucket])=>bucket).map(([id,bucket])=>{
   const native=['primary','secondary'].flatMap((key)=>{const w=bucket[key];if(!w)return [];const mins=w.windowDurationMins??(key==='primary'?300:10080);return [{...w,mins}];});
   const windows=(pro?[10080]:plus?[300,10080]:[...new Set(native.map(w=>w.mins))]).map(mins=>{
    const w=native.find(w=>w.mins===mins),valid=typeof w?.usedPercent==='number'&&Number.isFinite(w.usedPercent),used=valid?Math.min(100,Math.max(0,w.usedPercent)):null;
    return {label:mins===300?'5 小时限额':mins===10080?'7 天限额':mins%60===0?`${mins/60} 小时限额`:`${mins} 分钟限额`,remaining:used===null?null:100-used,used,reset:typeof w?.resetsAt==='number'&&Number.isFinite(w.resetsAt)?w.resetsAt:null};
   });return {id,name:bucket.limitName||id,windows};
  });
  return {plan,planLabel:plan==='plus'?'Plus':pro?'Pro':plan==='unknown'?'OpenAI GPT':plan,buckets};
 }
 function resetLabel(seconds){return seconds?new Date(seconds>1e12?seconds:seconds*1000).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}):null;}
 function windowText(w){return w.label+' · '+(w.remaining===null?'额度暂不可用':`剩余 ${Math.round(w.remaining)}%`)+(w.reset?' · '+resetLabel(w.reset)+' 重置':'');}
 function createMenu(){
  let epoch=0,loading=false,serial=0,rendered='';
  const visible=()=>state.menu?.options?.accountQuotaToken;
  function items(){
   const view=quotaView(state.settingsData.account?.account,state.rates);
   const base=[{label:accountLabel(),heading:true}];
   if(view){base.push({separator:true},{heading:true,label:view.planLabel+' 额度'});
    if(state.ratesError)base.push({heading:true,label:'额度获取失败，请刷新重试'});
    else if(!view.buckets.length)base.push({heading:true,label:loading?'正在读取额度…':'额度数据暂不可用'});
    else for(const bucket of view.buckets){if(view.buckets.length>1)base.push({heading:true,label:bucket.name});for(const window of bucket.windows)base.push({heading:true,label:windowText(window),quota:window});if(!bucket.windows.length)base.push({heading:true,label:'额度数据暂不可用'});}
    base.push({label:loading?'正在刷新额度…':'刷新额度',icon:'refresh',disabled:loading,action:()=>{open(anchor());}},{separator:true});
   }
   base.push({label:t('settings'),icon:'gear',action:()=>openSettings('account')},{label:t('archive'),icon:'archive',action:()=>setView('archived')},{separator:true},{label:t('about'),icon:'info',action:()=>openSettings('about')});return base;
  }
  let button=null;
  const anchor=()=>button?.isConnected?button:document.querySelector('[data-rail="account"]');
  function draw(token){if(visible()!==token)return;const next=items(),hash=JSON.stringify(next);if(hash===rendered)return;rendered=hash;const b=anchor();if(!b)return;const focused=document.activeElement?.closest('#menu-root .menu')?document.activeElement.querySelector('.mi-label')?.textContent:null;const rect=b.getBoundingClientRect();openMenu(next,{x:rect.left,y:rect.top-8,anchor:b,accountQuotaToken:token});if(focused)[...document.querySelectorAll('#menu-root button:not(:disabled)')].find(node=>node.querySelector('.mi-label')?.textContent===focused)?.focus({preventScroll:true});}
  function sync(){const token=visible();if(token)draw(token);}
  function invalidate(){epoch++;loading=false;sync();}
  async function open(b){
   if(!b)return;button=b;const token=++serial,requestEpoch=++epoch;loading=true;rendered='';const rect=b.getBoundingClientRect();openMenu(items(),{x:rect.left,y:rect.top-8,anchor:b,accountQuotaToken:token});rendered=JSON.stringify(items());
   try{
    const response=await api.call('account/read',{});if(requestEpoch!==epoch)return;
    const previous=state.settingsData.account?.account;
    const oldIdentity=JSON.stringify(previous),newIdentity=JSON.stringify(response.account);
    if(oldIdentity!==newIdentity){ratesSequence++;state.rates=null;state.ratesUpdatedAt=null;state.ratesError=null;state.settingsData.rates=null;}
    state.settingsData.account=response;draw(token);
    if(response.account?.type==='chatgpt')await refreshRates();
   }catch(error){if(requestEpoch===epoch){state.settingsData.account={error:error.message};ratesSequence++;state.rates=null;state.ratesUpdatedAt=null;state.settingsData.rates=null;}}
   finally{if(requestEpoch===epoch){loading=false;draw(token);}}
  }
  function renderWindow(w){const root=document.createElement('section');root.className='account-quota-window';root.setAttribute('aria-label',w.label);const percent=w.remaining===null?null:Math.round(w.remaining),reset=resetLabel(w.reset);root.innerHTML='<div class="account-quota-heading"><span>'+esc(w.label)+'</span><strong>'+(percent===null?'暂不可用':'剩余 '+percent+'%')+'</strong></div>'+(percent===null?'':'<div class="account-quota-track" role="progressbar" aria-label="'+esc(w.label+'剩余额度')+'" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+w.remaining+'"><span style="width:'+w.remaining+'%"></span></div>')+'<div class="account-quota-reset">'+esc(reset?reset+' 重置':'重置时间暂不可用')+'</div>';return root;}
  return {open,sync,invalidate,renderWindow};
 }
 return {quotaView,windowText,createMenu};
});
