'use strict';
// Android persistence/window adapter. Model control markup and behavior live in
// the extracted desktop composer functions, not in a separately drawn sheet.
window.desktopModelControl=(()=>{
 let state=null,control=null,dismiss=null,resize=null,closeCallback=null;
 const baseReadProviders=readProviders;
 readProviders=function(){
  const previous=data.providerDefaults||Object.fromEntries((modelConfig.providers||[]).map(p=>[p.id,p.model]));baseReadProviders();
  data.providerDefaults||={};let changed=false;
  for(const p of modelConfig.providers||[]){
   const old=previous[p.id];
   for(const c of [...(data.chats||[]),...(data.drafts||[])]){
    if(c.providerId!==p.id)continue;
    const followed=c.providerDefaultModel||old;
    if(!c.providerDefaultModel&&followed){c.providerDefaultModel=followed;changed=true;}
    let legacyDeepSeek=false;try{legacyDeepSeek=new URL(p.url).hostname==='api.deepseek.com'&&p.model==='deepseek-flash'&&c.model==='deepseek-v4.1-flash';}catch{}
    if(!c.running&&!kernelBusy&&(legacyDeepSeek||(followed&&followed!==p.model&&c.model===followed))){c.model=p.model;c.effort=p.effort||null;c.serviceTier=null;changed=true;}
    // Keep the old baseline during an active turn so it can be reconciled later.
    if(!c.running&&!kernelBusy){if(c.providerDefaultModel!==p.model)changed=true;c.providerDefaultModel=p.model;}
   }
   const saved=data.providerSelections?.[p.id];if(old&&old!==p.model&&saved?.model===old){delete data.providerSelections[p.id];changed=true;}
   if(data.providerDefaults[p.id]!==p.model)changed=true;data.providerDefaults[p.id]=p.model;
  }
  if(changed)scheduleKernelSave();
 };
 // Old merged native catalogs can still contain API-only metadata. It must never become an OpenAI account choice.
 const accountModels=models=>(models||[]).filter(m=>!m.hidden&&!/^deepseek(?:[-_]|$)/i.test(m.model||m.id||m.slug||''));
 const providers=()=>modelConfig.providers.map(p=>({...p,baseUrl:p.url,displayName:p.displayName||p.model}));
 const labels={none:'无',minimal:'极低',low:'低',medium:'中',high:'高',xhigh:'更高',max:'最高',ultra:'极高'};
 const EFFORT_LABELS=Object.fromEntries(Object.keys(labels).map(k=>[k,k]));
 const root=()=>document.querySelector('#menu-root')||document.body.appendChild(Object.assign(document.createElement('div'),{id:'menu-root'}));
 const anchor=()=>document.querySelector('[data-action="kernel-models"]');
 function close(){const callback=closeCallback;closeCallback=null;if(dismiss)document.removeEventListener('pointerdown',dismiss,true);if(resize){window.removeEventListener('resize',resize);window.visualViewport?.removeEventListener('resize',resize);}dismiss=resize=null;root().replaceChildren();anchor()?.setAttribute('aria-expanded','false');callback?.();}
 function position(menu){const a=anchor();if(!a||!menu.isConnected)return;const r=a.getBoundingClientRect(),box=menu.getBoundingClientRect();menu.style.left=Math.max(6,Math.min(innerWidth-box.width-6,r.right-box.width))+'px';menu.style.top=Math.max(6,r.top-box.height-8)+'px';}
 function openMenu(items,options={}){
  close();const menu=document.createElement('div');menu.className='menu';menu.setAttribute('role','menu');menu.setAttribute('aria-label','模型与推理强度');root().append(menu);
  for(const item of items){if(item.heading){const label=document.createElement('div');label.className='menu-label';label.textContent=item.label;menu.append(label);continue;}const button=document.createElement('button');button.type='button';button.className='menu-item'+(item.disabled?' disabled':'');button.disabled=!!item.disabled;button.setAttribute('role','menuitem');button.innerHTML=`<span class="mi-ico">${item.checked?ic('check','mi-check'):''}</span><span class="mi-label">${esc(item.label)}</span>`;button.onclick=e=>{e.stopPropagation();close();item.action?.();};menu.append(button);}
  closeCallback=options.onClose;position(menu);anchor()?.setAttribute('aria-expanded','true');
  dismiss=e=>{if(!menu.contains(e.target)&&!anchor()?.contains(e.target))close();};document.addEventListener('pointerdown',dismiss,true);
  resize=()=>position(menu);window.addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);
 }
 function commit(){
  if(!state||kernelBusy||active()?.running)return;
  const providerId=state.provider||'openai',selection={providerId,model:state.model,effort:state.effort,serviceTier:state.provider?'':(data.modelTiers||{})[state.model]||''};
  const c=active();if(c){if(c.providerId!==selection.providerId||c.model!==selection.model)for(const stamp of loadedKernelThreads)if(stamp.split('|')[0]===c.kernelThread?.id)loadedKernelThreads.delete(stamp);Object.assign(c,selection);scheduleKernelSave();}
  else if(providerId==='openai'){EvaHost.accountChoice(selection.model,selection.effort||'',selection.serviceTier);}
  else if(modelConfig.active!==providerId){EvaHost.providerChoice(providerId);}
  data.providerSelections||={};data.providerSelections[providerId]={model:selection.model,effort:selection.effort,serviceTier:selection.serviceTier};
  scheduleKernelSave();readProviders();
  const button=anchor();if(button){const p=state.providers.find(p=>p.id===state.provider),m=state.models.find(m=>(m.model||m.id)===state.model);button.innerHTML=esc(p?.displayName||m?.displayName||state.model)+cloudComposerIcons.down;}
 }
 function ic(kind,cls=''){return kind==='check'?`<svg class="${cls}" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m3 8 3 3 7-7" stroke="currentColor" stroke-width="1.5"/></svg>`:cloudComposerIcons[kind]||'';}
 function open(models){
  close();const c=active(),p=selectedProvider(c);if(!p||!anchor())return false;
  state={provider:p.id==='openai'?null:p.id,model:c?.model||p.model,effort:c?.effort||p.effort||'high',providers:providers(),models:accountModels(models),thread:c?.kernelThread||null,cwd:c?.projectId||'',running:!!c?.running,pendingSend:kernelBusy,sideChatEphemeral:false};
  const store={get:(key,fallback)=>key==='codex.serviceTiers'?(data.modelTiers||{}):fallback,set:(key,value)=>{if(key==='codex.serviceTiers')data.modelTiers=value;}};
  const els={get modelButton(){return anchor()}};
  control=createDesktopModelControl({preserveThreadOnProviderChange:true,state,els,store,t:key=>labels[key]||({models:'模型'})[key]||key,esc,clamp:(v,min,max)=>Math.max(min,Math.min(max,v)),openMenu,closeMenu:close,renderComposer:commit,modelEntries:()=>modelConfig.account?.loggedIn?state.models:[],startNewThread:()=>{data.active=null;data.projectId=c?.projectId||'';state.thread=null;route='home';render();},toast:message=>{kernelNotice=message;refreshKernelControls();},openSettings:()=>{close();EvaHost.open('models')},ic,EFFORT_LABELS});
  const efforts=control.availableEfforts();if(!efforts.includes(state.effort))state.effort=efforts.includes('high')?'high':efforts[0]||null;
  control.openModelMenu();return true;
 }
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&root().children.length){close();anchor()?.focus();}});
 function refresh(models){if(!state||!control||!document.querySelector('#menu-root .menu'))return;const power=!!document.querySelector('#menu-root .model-control'),c=active(),p=selectedProvider(c);state.models=accountModels(models);state.providers=providers();if(p){state.provider=p.id==='openai'?null:p.id;state.model=c?.model||p.model;state.effort=c?.effort||p.effort||'high';}power?control.openModelMenu():control.openModelList();}
 return {open,close,refresh,isOpen:()=>!!document.querySelector('#menu-root .menu')};
})();
