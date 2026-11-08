'use strict';
// Android layout around Eva's original quotaView/renderWindow and composer controls.
let panelEpoch=0,modelCatalog=[],pickerSelection=null;
const effortNames={disabled:'关闭',light:'轻量',balanced:'均衡',deep:'深入',none:'无',minimal:'极低',low:'低',medium:'中',high:'高',xhigh:'更高',max:'最高',ultra:'极高'};
function closeModelPanel(){window.closeAttachmentMenu?.();panelEpoch++;window.desktopModelControl?.close();document.querySelector('#eva-panel')?.remove()}
function modelPanel(title){closeModelPanel();const root=document.createElement('div');root.id='eva-panel';root.className='eva-panel-backdrop';if(typeof settingPage!=='undefined'&&settingPage){root.dataset.settingsSurface='true';if($('#phone').classList.contains('dark'))root.classList.add('settings-dark');}root.innerHTML=`<section class="eva-panel" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="sheet-handle"></div><header><strong>${esc(title)}</strong><button aria-label="关闭" data-panel-close>×</button></header><div class="panel-content"><p class="panel-muted">正在读取…</p></div></section>`;document.body.append(root);root.onclick=e=>{if(e.target===root||e.target.closest('[data-panel-close]'))closeModelPanel()};return root.querySelector('.panel-content')}
async function openAccountSheet(){const content=modelPanel('账号与额度'),epoch=panelEpoch;try{const result=await kernelCall('account/read',{refreshToken:false});if(epoch!==panelEpoch)return;const account=result.account;if(!account){content.innerHTML='<p class="panel-muted">登录后查看账号额度和可用模型。</p><button class="panel-primary" data-login>登录 OpenAI / ChatGPT</button>';content.querySelector('[data-login]').onclick=()=>{closeModelPanel();EvaHost.open('account')};return}content.innerHTML=`<div class="account-identity"><div class="account-avatar">${esc((account.email||'O')[0].toUpperCase())}</div><div><strong>${esc(account.email||'OpenAI 账号')}</strong><small>OpenAI / ChatGPT</small></div><span class="plan-badge">${esc(account.planType||'账号')}</span></div><div id="quota-windows"><p class="panel-muted">正在读取额度…</p></div><div class="panel-actions"><button data-refresh>刷新额度</button><button data-manage>管理登录</button></div>`;content.querySelector('[data-refresh]').onclick=openAccountSheet;content.querySelector('[data-manage]').onclick=()=>{closeModelPanel();EvaHost.open('account')};try{const snapshot=await kernelCall('account/rateLimits/read',{});if(epoch!==panelEpoch)return;const view=desktopQuota.quotaView(account,snapshot),host=content.querySelector('#quota-windows');host.replaceChildren();if(!view?.buckets.length){host.innerHTML='<p class="panel-muted">额度数据暂不可用，请刷新重试。</p>';return}content.querySelector('.plan-badge').textContent=view.planLabel;for(const bucket of view.buckets){if(view.buckets.length>1){const heading=document.createElement('h4');heading.textContent=bucket.name;host.append(heading)}for(const window of bucket.windows)host.append(accountQuota.renderWindow(window));}const extra=document.createElement('details');extra.className='quota-extra';extra.innerHTML='<summary>额度详情</summary>';const note=document.createElement('p');note.className='panel-muted';const groups=snapshot.rateLimitsByLimitId||{codex:snapshot.rateLimits};let lines=[];for(const [id,bucket] of Object.entries(groups)){const credits=bucket?.credits;if(credits)lines.push(id+' · '+(credits.unlimited?'额外额度不限额':credits.balance!=null?'额外额度余额 '+credits.balance:credits.hasCredits?'有额外额度，余额未提供':'无额外额度'));}if(typeof snapshot.ordinaryUsageAllowed==='boolean')lines.push('普通额度当前'+(snapshot.ordinaryUsageAllowed?'可用':'不可用'));lines.push('更新于 '+new Date().toLocaleTimeString());note.textContent=lines.join('\n');extra.append(note);host.append(extra);}catch(e){if(epoch===panelEpoch)content.querySelector('#quota-windows').innerHTML='<p class="panel-error">额度获取失败，请刷新重试。</p>';}}catch(e){if(epoch===panelEpoch)content.innerHTML='<p class="panel-error">账号读取失败，请稍后重试。</p>'}}
let accountCatalogIdentity='',accountCatalogEpoch=0,accountCatalogPending=null,accountCatalogLoadedPanel=-1;
function clearAccountModelReads(){
 if(typeof kernelReadCalls==='undefined')return;
 for(const key of kernelReadCalls.keys())if(key.startsWith('model/list:'))kernelReadCalls.delete(key);
}
window.evaAccountModels={load:()=>loadAccountModels(),invalidate(){accountCatalogLoadedPanel=-1;accountCatalogEpoch++;accountCatalogIdentity='';modelCatalog=[];clearAccountModelReads();if(desktopModelControl.isOpen())desktopModelControl.refresh([]);}};
function accountModelIdentity(account){
 if(!account)return '';
 const identity=account.id||account.accountId||account.email;
 return identity?JSON.stringify([account.type||'',identity,account.planType||'']):'';
}
async function openModelSheet(){
 if(window.EvaHost?.refreshLocalModelCatalog)EvaHost.refreshLocalModelCatalog();
 readProviders();
 if(kernelBusy||active()?.running){kernelNotice='请先完成或停止当前回合再切换模型';refreshKernelControls();return;}
 closeModelPanel();
 desktopModelControl.open([]);
 const selected=selectedProvider(active());
 if(selected?.id==='openai')return loadAccountModels();
}
function loadAccountModels(){
 if(accountCatalogPending?.panel===panelEpoch)return accountCatalogPending.promise;
 if(accountCatalogLoadedPanel===panelEpoch)return Promise.resolve();
 const panel=panelEpoch,promise=readAccountModels();
 accountCatalogPending={panel,promise};
 promise.finally(()=>{if(accountCatalogPending?.promise===promise)accountCatalogPending=null;});
 return promise;
}
async function readAccountModels(){
 const requestEpoch=panelEpoch,catalogEpoch=++accountCatalogEpoch;
 const current=()=>catalogEpoch===accountCatalogEpoch&&requestEpoch===panelEpoch;
 if(!modelConfig.account?.loggedIn){window.evaAccountModels.invalidate();return;}
 try{
  const result=await kernelCall('account/read',{refreshToken:false});
  if(!current())return;
  const identity=accountModelIdentity(result.account);
  if(!identity||identity!==accountCatalogIdentity){modelCatalog=[];clearAccountModelReads();}
  accountCatalogIdentity=identity;
  if(desktopModelControl.isOpen())desktopModelControl.refresh(modelCatalog);
  if(!result.account){window.evaAccountModels.invalidate();return;}
  const rows=[],models=new Set(),cursors=new Set();let cursor=null;
  do{
   const params={limit:100};if(cursor!==null)params.cursor=cursor;
   const page=await kernelCall('model/list',params);
   if(!current())return;
   if(!Array.isArray(page.data))throw Error('模型目录格式无效');
   for(const model of page.data){const id=model.model||model.id;if(model.hidden||!id||models.has(id))continue;models.add(id);rows.push(model);}
   cursor=page.nextCursor??null;
   if(cursor!==null){if(typeof cursor!=='string'||!cursor||cursors.has(cursor))throw Error('模型目录分页游标无效');cursors.add(cursor);}
  }while(cursor!==null);
  if(!current())return;
  modelCatalog=rows;accountCatalogLoadedPanel=requestEpoch;
  if(desktopModelControl.isOpen())desktopModelControl.refresh(modelCatalog);
 }catch(error){
  if(!current())return;
  kernelNotice='模型列表读取失败，请重试';refreshKernelControls();
 }
}

const prePanelNavigate=navigate;navigate=function(action){if(action==='kernel-models'){openModelSheet();return}if(action==='account-summary'||action==='account-manage'){openAccountSheet();return}prePanelNavigate(action)};
const prePanelSidebar=sidebar;sidebar=function(){prePanelSidebar();$('.side-footer').insertAdjacentHTML('afterbegin',row('pc','账号与额度','OpenAI / ChatGPT','account-summary'))};
const prePanelBack=window.evaBack;window.evaBack=()=>{if(window.desktopModelControl?.isOpen()){desktopModelControl.close();return true}if(document.querySelector('#eva-panel')){closeModelPanel();return true}return prePanelBack()};
const prePanelModelRefresh=window.modelRefresh;window.modelRefresh=()=>{prePanelModelRefresh();desktopModelControl.refresh(modelCatalog);};
render();
