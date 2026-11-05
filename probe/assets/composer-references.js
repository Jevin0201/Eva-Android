'use strict';
window.evaReferences=(()=>{
 const cache=new Map();let popup=null,epoch=0,choices=[],index=0,trigger=null;
 const cwd=c=>'/root/eva-workspace'+(c?.projectId?'/projects/'+c.projectId:'');
 const key=r=>r.kind+':'+r.path;
 function label(ref){
  const value=String(ref.displayName||ref.name||'');
  if(!/[:：]/.test(value))return value;
  const suffix=value.split(/[:：]/).filter(Boolean).pop()?.trim()||value;
  return /^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(suffix)?suffix.split('-').map(part=>part[0].toUpperCase()+part.slice(1)).join(' '):suffix;
 }
 // Desktop customizeIcon/message-reference icon rules, adapted to the Android media host.
 function iconCandidates(ref){
  const face=ref.interface||{},dark=$('#phone')?.classList.contains('dark');
  const names=ref.kind==='skill'?['iconSmall','composerIcon','logo','iconLarge']:['composerIcon','logo','iconSmall','iconLarge'];
  const variant=dark?'Dark':'Light';
  const local=names.flatMap(name=>[face[name+variant],face[name]]);
  const remote=names.flatMap(name=>[face[name+'Url'+variant],face[name+'Url']]);
  function media(value){
   if(typeof value!=='string'||!value.trim())return '';
   if(/^https:\/\//i.test(value))return 'https://eva.invalid/extension-icon?url='+encodeURIComponent(value)+'&revision='+encodeURIComponent(ref.iconRevision||'');
   let path=value;
   if(!path.startsWith('/')){
    if(!ref.iconBase||/^[a-z][a-z0-9+.-]*:/i.test(path))return '';
    const base=ref.iconBase.split('/').filter(Boolean),parts=[...base];
    for(const part of path.split('/')){
     if(!part||part==='.')continue;
     if(part==='..'){if(parts.length<=base.length)return '';parts.pop();}else parts.push(part);
    }
    path='/'+parts.join('/');
   }
   return path.startsWith('/root/')?'https://eva.invalid/extension-media?path='+encodeURIComponent(path):'';
  }
  // Finish trying local artwork before requesting remote artwork.
  const all=[...local,...remote].map(media).filter(Boolean);
  return [...new Set([...all.filter(url=>url.includes('/extension-media?')),...all.filter(url=>url.includes('/extension-icon?'))])];
 }
 function logo(ref){
  return `<span class="reference-logo" aria-hidden="true">${icon(ref.kind==='skill'?'library':'grid')}<img alt="" decoding="async" hidden></span>`;
 }
 function loadLogos(){
  popup?.querySelectorAll('[data-reference-pick]').forEach(button=>{
   const ref=choices[Number(button.dataset.referencePick)],image=button.querySelector('.reference-logo img');
   const candidates=iconCandidates(ref);let candidate=0;
   image.hidden=true;image.parentElement.classList.remove('has-logo');
   image.onload=()=>{image.hidden=false;image.parentElement.classList.add('has-logo')};
   image.onerror=()=>{image.hidden=true;image.parentElement.classList.remove('has-logo');if(candidate<candidates.length)image.src=candidates[candidate++];else image.removeAttribute('src')};
   if(candidates.length)image.src=candidates[candidate++];
  });
 }
 const themeObserver=new MutationObserver(()=>{if(popup)loadLogos()});
 if($('#phone'))themeObserver.observe($('#phone'),{attributes:true,attributeFilter:['class']});
 async function catalog(c,force=false,onUpdate=null,kinds=['plugin','skill']){const scope=cwd(c),parts={};const snapshot=()=>({items:[...new Map(Object.values(parts).flatMap(p=>p.items).map(r=>[key(r),r])).values()],warning:Object.values(parts).map(p=>p.warning).filter(Boolean).join('；'),loading:Object.keys(parts).length<kinds.length});const jobs=kinds.map(async kind=>{const method=kind==='plugin'?'plugin/installed':'skills/list',params={cwds:[scope]};try{const value=await (window.evaCapabilityReads?evaCapabilityReads.read(method,params,force):kernelCall(method,params));const items=[];if(kind==='plugin')for(const m of value.marketplaces||[])for(const x of m.plugins||[])if(x.installed&&x.enabled!==false)items.push({kind:'plugin',name:x.name||x.id,displayName:x.interface?.displayName||'',path:'plugin://'+x.id,description:x.interface?.shortDescription||x.description||'已安装插件',aliases:[x.id,x.name],interface:x.interface||{},iconRevision:x.localVersion||x.version||'',iconBase:typeof x.path==='string'&&x.path.startsWith('/root/')?x.path:''});if(kind==='skill')for(const group of value.data||[])for(const x of group.skills||[])if(x.enabled)items.push({kind:'skill',name:x.name,displayName:x.interface?.displayName||'',path:x.path,description:x.description||'技能',aliases:[x.interface?.displayName],interface:x.interface||{},iconBase:typeof x.path==='string'?x.path.slice(0,x.path.lastIndexOf('/')):'',iconRevision:x.version||''});parts[kind]={items:items.filter(r=>r.name&&r.path),warning:''};}catch(e){parts[kind]={items:[],warning:kind==='plugin'?'插件读取失败':'技能读取失败'};}onUpdate?.(snapshot());});await Promise.all(jobs);return snapshot();}
 function close(){epoch++;popup?.remove();popup=null;choices=[];trigger=null;const input=$('#prompt');input?.setAttribute('aria-expanded','false');input?.removeAttribute('aria-activedescendant');}
 function chips(){const area=$('.reference-chips');if(!area)return;area.innerHTML=(active()?.references||[]).map(r=>`<button type="button" data-reference-remove="${esc(r.id)}" aria-label="移除 ${esc(label(r))}">${esc(r.kind==='plugin'?'插件':r.kind==='skill'?'技能':'内置')} · ${esc(label(r))} <span aria-hidden="true">×</span></button>`).join('');}
 function add(ref,c=active()){if(!c)c=newLocalChat(data.projectId||'');c.references||=[];if(!c.references.some(r=>key(r)===key(ref)))c.references.push({...ref,id:crypto.randomUUID()});persist();chips();return c;}
 function apply(ref){const c=add(ref);close();settingPage=null;route='chat';data.active=c.id;closeModelPanel();render();$('#prompt')?.focus({preventScroll:true});}
 function pick(ref,c){if(active()!==c)return close();const input=$('#prompt');if(trigger&&input){const value=input.value,start=trigger.start,end=trigger.end;if(value.slice(start,end)!==trigger.token)return close();input.value=value.slice(0,start)+'@'+label(ref)+' '+value.slice(end);c.draft=input.value;input.focus({preventScroll:true});input.setSelectionRange(start+label(ref).length+2,start+label(ref).length+2);}add(ref,c);close();input?.dispatchEvent(new Event('input',{bubbles:true}));}
 function selection(){popup?.querySelectorAll('[role=option]').forEach((el,i)=>{el.setAttribute('aria-selected',String(i===index));if(i===index){$('#prompt')?.setAttribute('aria-activedescendant',el.id);el.scrollIntoView({block:'nearest'})}});}
 async function show(query='',token=null,onlySkill=false,force=false){close();const input=$('#prompt'),c=active()||newLocalChat(data.projectId||''),composer=$('.composer');if(!composer)return;trigger=token;const mine=++epoch;popup=document.createElement('div');popup.className='reference-picker';popup.id='reference-picker';popup.setAttribute('role','listbox');popup.setAttribute('aria-label','选择技能或插件');popup.innerHTML='<p role="status">正在读取技能与插件…</p>';composer.prepend(popup);input?.setAttribute('aria-expanded','true');const paint=result=>{if(mine!==epoch||active()!==c)return;const previous=choices[index];const q=query.toLocaleLowerCase();choices=result.items.filter(r=>(!onlySkill||r.kind==='skill')&&[r.name,label(r),r.description,...r.aliases||[]].join(' ').toLocaleLowerCase().includes(q));index=Math.max(0,choices.findIndex(r=>previous&&key(r)===key(previous)));popup.innerHTML=choices.map((r,i)=>`<button type="button" role="option" id="reference-option-${i}" aria-selected="${i===index}" data-reference-pick="${i}">${logo(r)}<span class="reference-copy"><strong>${esc(label(r))}</strong><small>${esc(r.description)}</small></span></button>`).join('')+`<p role="status">${esc([result.warning,result.loading?'插件与技能仍在读取，已返回的项目可先选择':(!choices.length?'没有匹配项。请先安装并启用技能或插件。':'')].filter(Boolean).join('；'))}</p><div class="reference-picker-actions"><button type="button" data-reference-manage>管理与添加</button><button type="button" data-reference-refresh>刷新列表</button><button type="button" data-reference-close>关闭</button></div>`;loadLogos();popup.querySelectorAll('[data-reference-pick]').forEach(b=>{b.onmousedown=e=>e.preventDefault();b.onclick=()=>pick(choices[Number(b.dataset.referencePick)],c)});popup.querySelector('[data-reference-manage]').onclick=()=>{close();settingsGo('extensions')};popup.querySelector('[data-reference-refresh]').onclick=()=>show(query,trigger,onlySkill,true);popup.querySelector('[data-reference-close]').onclick=close;};paint({items:[],warning:'',loading:true});try{await catalog(c,force,paint,onlySkill?['skill']:['skill','plugin']);}catch(e){if(mine===epoch)popup.innerHTML=`<p role="alert">${esc(e.message)}</p>`;}}
 function detect(input){const end=input.selectionStart,match=input.value.slice(0,end).match(/(?:^|\s)([@$])([^\s@$]*)$/u);if(!match){close();return}const token=match[1]+match[2];show(match[2],{start:end-token.length,end,token},match[1]==='$');}
 function mount(){close();if(settingPage||!['home','chat'].includes(route))return;const composer=$('.composer'),input=$('#prompt');if(!composer||!input)return;composer.insertAdjacentHTML('afterbegin','<div class="reference-chips" aria-label="本次对话选用的能力"></div>');const tools=$('.controls');if(tools){const button=document.createElement('button');button.className='reference-open';button.type='button';button.textContent='选用能力';button.setAttribute('aria-label','为当前任务选择技能与插件');button.onclick=()=>show();tools.insertBefore(button,tools.firstChild?.nextSibling||null);}chips();input.setAttribute('aria-controls','reference-picker');input.setAttribute('aria-autocomplete','list');input.addEventListener('input',e=>{if(!e.isComposing)detect(input)});input.addEventListener('compositionend',()=>detect(input));input.addEventListener('keydown',e=>{if(!popup||e.isComposing)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close()}else if(['ArrowDown','ArrowUp','Enter'].includes(e.key)&&choices.length){e.preventDefault();e.stopImmediatePropagation();if(e.key==='Enter')pick(choices[index],active());else{index=(index+(e.key==='ArrowDown'?1:-1)+choices.length)%choices.length;selection()}}},true);}
 async function inputs(refs,c){if(!refs.length)return [];const external=refs.filter(r=>r.kind!=='builtin'),available=external.length?(await catalog(c,true,null,[...new Set(external.map(r=>r.kind))])).items:[],out=[];for(const r of refs){if(r.kind==='builtin'){if(!['browser','office-runtime'].includes(r.path))throw Error('内置能力不可用，请重新选择');out.push({type:'text',text:'用户为本次任务明确选择 Eva 内置能力：'+r.name+'。请通过当前可用工具执行；如运行依赖或权限不足，明确说明。',text_elements:[]});continue;}const current=available.find(x=>key(x)===key(r));if(!current)throw Error('选中的“'+r.name+'”已停用、移除或读取失败。请移除标记或重新选择。');out.push({type:r.kind==='skill'?'skill':'mention',name:current.name,path:current.path});}return out;}
 document.addEventListener('click',e=>{const remove=e.target.closest('[data-reference-remove]');if(remove){const c=active();if(c)c.references=(c.references||[]).filter(r=>r.id!==remove.dataset.referenceRemove);persist();chips();return}if(popup&&!popup.contains(e.target)&&!e.target.closest('#prompt,.reference-open,[data-reference-refresh]'))close()});
 const previous=render;render=function(){previous();mount()};mount();
 return {apply,add,inputs,catalog,invalidate(){cache.clear();window.evaCapabilityReads?.invalidate()},close,selected:c=>(c?.references||[]).map(r=>({...r})),accepted(c,sent){const ids=new Set(sent.map(r=>r.id));c.references=(c.references||[]).filter(r=>!ids.has(r.id));if(c===active())chips()}};
})();
