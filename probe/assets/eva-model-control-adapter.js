'use strict';
// Android persistence/window adapter. Model control markup and behavior live in
// the extracted desktop composer functions, not in a separately drawn sheet.
window.desktopModelControl=(()=>{
 let state=null,control=null,dismiss=null,resize=null,closeCallback=null,selectionSaving=null;
 window.evaModelSelectionReady=()=>selectionSaving||Promise.resolve();
 const accountModels=models=>(models||[]).filter(m=>!m.hidden).map(m=>({...m,...modelConfig.account?.modelPreferences?.[m.model||m.id]}));
 const providers=()=>modelConfig.providers.map(p=>{
  const catalog=Array.isArray(p.models)?p.models:(p.managedBy!=='dsh'&&p.model?[{id:p.model,name:p.model}]:[]);
  const entries=new Map(catalog.filter(m=>m.id).map(m=>[m.id,m]));
  for(const model of p.manualModels||[])if(model.id&&!entries.has(model.id))entries.set(model.id,model);
  const models=[...entries.values()].map(m=>({...m,...p.modelPreferences?.[m.id]}));
  return {...p,baseUrl:p.url,models};
 });
 const labels={disabled:'关闭',light:'轻量',balanced:'均衡',deep:'深入',none:'无',minimal:'极低',low:'低',medium:'中',high:'高',xhigh:'更高',max:'最高',ultra:'极高'};
 const EFFORT_LABELS=Object.fromEntries(Object.keys(labels).map(k=>[k,k]));
 const root=()=>document.querySelector('#menu-root')||document.body.appendChild(Object.assign(document.createElement('div'),{id:'menu-root'}));
 const anchor=()=>document.querySelector('[data-action="kernel-models"]');
 function close(){const callback=closeCallback;closeCallback=null;if(dismiss)document.removeEventListener('pointerdown',dismiss,true);if(resize){window.removeEventListener('resize',resize);window.visualViewport?.removeEventListener('resize',resize);}dismiss=resize=null;root().replaceChildren();anchor()?.setAttribute('aria-expanded','false');callback?.();}
 function position(menu){const a=anchor();if(!a||!menu.isConnected)return;const r=a.getBoundingClientRect();if(menu.classList.contains('model-provider-list'))menu.style.maxHeight=Math.max(100,r.top-12)+'px';const box=menu.getBoundingClientRect();menu.style.left=Math.max(6,Math.min(innerWidth-box.width-6,r.right-box.width))+'px';menu.style.top=Math.max(6,r.top-box.height-8)+'px';}
 function openMenu(items,options={}){
  close();const menu=document.createElement('div');menu.className='menu';menu.setAttribute('role','menu');menu.setAttribute('aria-label','模型与推理强度');root().append(menu);
  const appendItem=(item,parent)=>{
   if(item.heading){const label=document.createElement('div');label.className='menu-label';label.textContent=item.label;parent.append(label);return;}
   if(item.group){
    menu.classList.add('model-provider-list');
    const section=document.createElement('div');section.className='model-provider-group';section.dataset.providerGroup=item.id;
    const toggle=document.createElement('button');toggle.type='button';toggle.className='menu-item model-provider-toggle';toggle.setAttribute('role','menuitem');toggle.setAttribute('aria-expanded',String(item.expanded));
    toggle.innerHTML='<span class="provider-chevron" aria-hidden="true">›</span><span class="mi-label">'+esc(item.label)+'</span>'+(item.current?'<span class="provider-current">'+esc(item.current)+'</span>':'');
    const children=document.createElement('div');children.className='model-provider-models';children.hidden=!item.expanded;
    const populate=()=>{if(children.childElementCount)return;if(item.children.length)for(const child of item.children)appendItem(child,children);else{const empty=document.createElement('div');empty.className='menu-label';empty.textContent='暂无可选模型';children.append(empty);}};if(item.expanded)populate();
    toggle.onclick=e=>{e.stopPropagation();const expanded=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(expanded));if(expanded)populate();children.hidden=!expanded;item.onToggle(expanded);if(expanded&&item.id==='openai')window.evaAccountModels?.load?.();position(menu);};
    section.append(toggle);if(item.description){const note=document.createElement('div');note.className='menu-label';note.textContent=item.description;section.append(note);}if(item.onRefresh){const refresh=document.createElement('button');refresh.type='button';refresh.className='menu-item';refresh.textContent='重新检测可用模型';refresh.onclick=e=>{e.stopPropagation();item.onRefresh();};section.append(refresh);}section.append(children);parent.append(section);return;
   }
   const button=document.createElement('button');button.type='button';button.className='menu-item'+(item.disabled?' disabled':'')+(item.checked?' model-selected':'');button.disabled=!!item.disabled;button.setAttribute('role','menuitem');button.setAttribute('aria-current',item.checked?'true':'false');button.innerHTML=`<span class="mi-ico">${item.checked?ic('check','mi-check'):''}</span><span class="mi-label">${esc(item.label)}</span>`;button.onclick=e=>{e.stopPropagation();close();item.action?.();};parent.append(button);
  };
  for(const item of items)appendItem(item,menu);
  closeCallback=options.onClose;position(menu);anchor()?.setAttribute('aria-expanded','true');
  dismiss=e=>{if(!menu.contains(e.target)&&!anchor()?.contains(e.target))close();};document.addEventListener('pointerdown',dismiss,true);
  resize=()=>position(menu);window.addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);
 }
 function paintLabel(){
  const button=anchor(),p=selectedProvider(active());if(!button)return;
  const id=p?.model,entry=p?.id==='openai'?(typeof modelCatalog==='undefined'?[]:modelCatalog).find(m=>(m.model||m.id)===id):p?.models?.find(m=>m.id===id);
  const name=p?.modelPreferences?.[id]?.name||entry?.name||entry?.displayName||id||'连接模型';
  const unavailable=p?.unavailable?' · 不可用':'';
  const effort=p?.effort;
  button.innerHTML='<span class="model-name">'+esc(window.evaModelDisplayName(name)+unavailable)+'</span>'+(effort?'<span class="model-effort">'+esc(labels[effort]||effort)+'</span>':'')+cloudComposerIcons.down;
  button.title=(p?.name||p?.id||'')+' · '+(id||'未选择模型')+unavailable;
 }
 function commit(){
  if(!state||selectionSaving||kernelBusy||active()?.running||active()?.scheduledReadOnly)return false;
  const selection={providerId:state.provider||'openai',model:state.model,effort:state.effort||null,serviceTier:state.provider?null:state.serviceTiers[state.model]||null};
  const c=active(),previous=c?{...c}:data.composerSelection;
  if(c)Object.assign(c,selection);else data.composerSelection=selection;
  const request=new Promise((resolve,reject)=>{
   if(!EvaHost.saveModelSelection){try{EvaHost.save(JSON.stringify(data))===true?resolve(true):reject(Error('模型选择保存失败，请重试'));}catch(error){reject(error);}return;}
   const ticket=crypto.randomUUID(),timer=setTimeout(()=>{if(kernelPending.delete(ticket))reject(Error('模型选择保存超时，请重试'));},30000);
   kernelPending.set(ticket,{resolve,reject,timer});
   try{EvaHost.saveModelSelection(ticket,JSON.stringify({chatId:c?.id||null,selection}));}catch(error){kernelPending.delete(ticket);clearTimeout(timer);reject(error);}
  }).then(result=>{if(result!==true)throw Error('模型选择保存失败，请重试');});
  selectionSaving=request;state.saving=true;kernelNotice='正在保存模型选择…';refreshKernelControls();paintLabel();
  request.then(()=>{
   if(kernelNotice==='正在保存模型选择…')kernelNotice='';
   if(c)for(const stamp of loadedKernelThreads)if(stamp.split('|')[0]===c.kernelThread?.id)loadedKernelThreads.delete(stamp);
  },error=>{
   if(c){for(const key of Object.keys(selection)){if(Object.hasOwn(previous,key))c[key]=previous[key];else delete c[key];}}else{if(previous===undefined)delete data.composerSelection;else data.composerSelection=previous;}
   const selected=selectedProvider(active());state.provider=selected?.id==='openai'?null:(selected?.id||'');state.model=selected?.model||'';state.effort=selected?.effort||null;state.serviceTiers={[state.model]:selected?.serviceTier};kernelNotice=error.message;refreshKernelControls();
  }).finally(()=>{selectionSaving=null;state.saving=false;paintLabel();refreshKernelControls();if(document.querySelector('#menu-root .model-control'))control.openModelMenu();});
  return true;
 }
 function ic(kind,cls=''){return kind==='check'?`<svg class="${cls}" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m3 8 3 3 7-7" stroke="currentColor" stroke-width="1.5"/></svg>`:cloudComposerIcons[kind]||'';}
 function open(models){
  if(selectionSaving)return false;close();const c=active(),p=selectedProvider(c);if(!anchor())return false;
  state={provider:p?.id==='openai'?null:(p?.id||''),model:p?.model||'',effort:p?.effort||null,serviceTiers:{[p?.model]:p?.serviceTier},providers:providers(),models:accountModels(models),thread:c?.kernelThread||null,cwd:c?.projectId||'',running:!!c?.running,pendingSend:kernelBusy,sideChatEphemeral:false};
  const store={get:(key,fallback)=>key==='codex.serviceTiers'?state.serviceTiers:fallback,set:(key,value)=>{if(key==='codex.serviceTiers')state.serviceTiers=value;}};
  const els={get modelButton(){return anchor()}};
  control=createDesktopModelControl({preserveThreadOnProviderChange:true,state,els,store,t:key=>labels[key]||({models:'模型'})[key]||key,esc,clamp:(v,min,max)=>Math.max(min,Math.min(max,v)),openMenu,closeMenu:close,renderComposer:commit,modelEntries:()=>modelConfig.account?.loggedIn?state.models:[],startNewThread:()=>{data.active=null;data.projectId=c?.projectId||'';state.thread=null;route='home';render();},toast:message=>{kernelNotice=message;refreshKernelControls();},openSettings:()=>{close();EvaHost.open('models')},ic,EFFORT_LABELS});
  const efforts=control.availableEfforts();if(!efforts.includes(state.effort))state.effort=null;
  control.openModelMenu();return true;
 }
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&root().children.length){close();anchor()?.focus();}});
 function refresh(models){
  if(!state||!control)return;
  const nextProviders=providers(),providersChanged=JSON.stringify(nextProviders)!==JSON.stringify(state.providers);
  state.models=accountModels(models);state.providers=nextProviders;
  const menu=document.querySelector('#menu-root .menu');if(!menu)return;
  const power=menu.classList.contains('model-control');
  if(state.provider&&!providersChanged&&(!state.expandedProviders?.openai||power))return;
  const scroll=menu.scrollTop,c=active(),p=selectedProvider(c);
  if(p){state.provider=p.id==='openai'?null:p.id;state.model=c?.model||p.model;state.effort=p.effort||null;}
  power?control.openModelMenu():control.openModelList();const next=document.querySelector('#menu-root .menu');if(next)next.scrollTop=scroll;
 }

 return {open,close,refresh,paintLabel,isOpen:()=>!!document.querySelector('#menu-root .menu')};
})();
