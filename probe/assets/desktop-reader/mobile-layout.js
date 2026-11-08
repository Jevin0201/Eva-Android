// Android-only layout adapter. Desktop component logic remains in its source modules.
export function compactToolbar(bar, advanced) {
 const panel=document.createElement('div');panel.className='reader-options';panel.hidden=true;
 const more=document.createElement('button');more.type='button';more.textContent='更多';more.setAttribute('aria-label','更多阅读选项');more.setAttribute('aria-expanded','false');
 for(const node of advanced.filter(Boolean))panel.append(node);
 bar.append(more,panel);more.onclick=()=>{panel.hidden=!panel.hidden;more.setAttribute('aria-expanded',String(!panel.hidden));};
 bar.addEventListener('keydown',event=>{if(event.key==='Escape'){panel.hidden=true;more.setAttribute('aria-expanded','false');more.focus();}});
 const close=event=>{if(!bar.contains(event.target)){panel.hidden=true;more.setAttribute('aria-expanded','false');}};
 bar.getRootNode().addEventListener('pointerdown',close);
 return ()=>bar.getRootNode().removeEventListener('pointerdown',close);
}
export function bindContentPinch(viewport,getScale,setScale){
 let gesture=null;
 const point=touches=>{const [a,b]=touches,r=viewport.getBoundingClientRect();return {x:(a.clientX+b.clientX)/2-r.left,y:(a.clientY+b.clientY)/2-r.top,distance:Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY)};};
 const start=event=>{if(event.touches.length!==2)return;event.preventDefault();viewport.dataset.readerPinching='true';const p=point(event.touches),scale=getScale();const css=getComputedStyle(viewport),originX=parseFloat(css.paddingLeft)||0,originY=parseFloat(css.paddingTop)||0;gesture={...p,scale,originX,originY,left:viewport.scrollLeft,top:viewport.scrollTop,anchorX:(viewport.scrollLeft+p.x-originX)/scale,anchorY:(viewport.scrollTop+p.y-originY)/scale};};
 const move=event=>{if(!gesture||event.touches.length!==2)return;event.preventDefault();const p=point(event.touches);setScale(gesture.scale*p.distance/Math.max(1,gesture.distance),true);const actual=getScale();viewport.scrollLeft=gesture.anchorX*actual+gesture.originX-p.x;viewport.scrollTop=gesture.anchorY*actual+gesture.originY-p.y;};
 const end=()=>{gesture=null;delete viewport.dataset.readerPinching;};
 const cancel=()=>{if(gesture){setScale(gesture.scale,true);viewport.scrollLeft=gesture.left;viewport.scrollTop=gesture.top;}gesture=null;delete viewport.dataset.readerPinching;};
 viewport.style.touchAction='pan-x pan-y';viewport.addEventListener('touchstart',start,{passive:false});viewport.addEventListener('touchmove',move,{passive:false});viewport.addEventListener('touchend',end,{passive:true});viewport.addEventListener('touchcancel',cancel,{passive:true});
 return ()=>{viewport.removeEventListener('touchstart',start);viewport.removeEventListener('touchmove',move);viewport.removeEventListener('touchend',end);viewport.removeEventListener('touchcancel',cancel);};
}
export function docxFitScale(page,viewport){
 document.documentElement.style.setProperty('--reading-width',viewport.clientWidth+'px');
 return document.body.dataset.reading==='mobile'?1:Math.max(.25,Math.min(2,(viewport.clientWidth-16)/page.offsetWidth));
}
export function applyDocxScale(root,viewport,scale){
 let stage=root.parentElement;if(stage===viewport){stage=document.createElement('div');stage.className='docx-scale-stage';viewport.append(stage);stage.append(root);}
 for(const img of root.querySelectorAll('section.docx img'))if(img.parentElement.style.display==='inline-block'&&img.parentElement.children.length===1)img.parentElement.classList.add('docx-mobile-image');
 const pages=[...root.querySelectorAll('section.docx')];
 root.style.cssText+=';position:absolute;left:0;top:0;transform-origin:top left;zoom:1';
 const width=Math.max(1,...pages.map(page=>page.offsetWidth))+16;
 root.style.width=width+'px';root.style.transform='scale('+scale+')';
 stage.style.cssText='position:relative;width:'+width*scale+'px;height:'+root.offsetHeight*scale+'px;min-width:100%';
 root.dataset.scale=String(scale);
}
export function alignDocxBody(){/* Scale stage keeps the original page left edge reachable. */}
export function setupDocx({toolbar,viewport,root,getScale,setScale}){
 const el=id=>document.getElementById(id);document.body.dataset.reading='original';
 const bodyFit=document.createElement('button');bodyFit.textContent='手机阅读';bodyFit.onclick=()=>{document.body.dataset.reading='mobile';setScale(null);};
 const originalFit=el('fit');originalFit.textContent='原版页宽';originalFit.setAttribute('aria-label','原版页宽');originalFit.onclick=()=>{document.body.dataset.reading='original';setScale(null);};
 const percent=el('zoom-value').nextElementSibling;
 const disposeToolbar=compactToolbar(toolbar,[originalFit,bodyFit,el('out'),el('zoom-value'),percent,el('in')]);
 const disposePinch=bindContentPinch(viewport,getScale,(value,pinch)=>setScale(Math.max(.25,Math.min(3,value)),pinch));
 addEventListener('pagehide',()=>{disposeToolbar();disposePinch();},{once:true});
}
export function setupOffice({root,style,bar,select,minus,plus,zoom,searchBar,query,thumbnails,content,getScale,setScale}){
 style.textContent+=` .toolbar{position:relative;flex-wrap:nowrap;gap:4px;padding:4px 6px;min-height:40px;box-sizing:border-box}.toolbar select{flex:1;width:0;max-width:none;min-width:70px;height:36px}.toolbar button,.search button{min-height:36px;min-width:36px}.toolbar .reader-options{position:absolute;right:6px;top:100%;z-index:20;display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px;background:var(--panel,#fff);border:1px solid #ddd;box-shadow:0 4px 16px #0002;border-radius:8px;max-width:calc(100vw - 32px)}.reader-options[hidden],.search[hidden],.thumbnails[hidden]{display:none!important}.sheet th.row{position:sticky;left:0;top:auto;min-width:40px;z-index:2}.sheet tr:first-child th{z-index:3}[data-reader-selected]{outline:2px solid #2563eb;outline-offset:-2px}.content{padding:8px;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}.search{flex-wrap:nowrap;padding:4px 6px}.search input{width:0;min-width:0}.search output{min-width:0}.warning{max-height:30px;overflow:auto}.pages{min-width:0}.toolbar strong{display:none}.sheet-visuals{display:grid;gap:12px;margin-bottom:16px;max-width:720px}.chart-card{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:10px;overflow:auto;min-width:0;color:#202124}.sheet-overlays{position:absolute;inset:0;display:block;max-width:none;margin:0;pointer-events:none}.sheet-overlays>*{pointer-events:auto}.sheet-overlays .chart-card{border-radius:0;display:flex;flex-direction:column}.sheet-overlays .chart-card svg{min-width:0;flex:1;min-height:0}.chart-card h3{font-size:15px;margin:0 0 8px}.chart-card svg{display:block;min-width:300px}.chart-legend{display:flex;gap:10px;flex-wrap:wrap;font-size:11px}.reader-notes{flex-basis:100%;max-width:320px}.reader-notes .warning{max-height:none;white-space:normal}.chart-note{font-size:11px;color:#6b5630;margin:6px 0}`;
 searchBar.hidden=true;
 const find=document.createElement('button');find.textContent='搜索';find.setAttribute('aria-expanded','false');bar.append(find);find.onclick=()=>{searchBar.hidden=!searchBar.hidden;find.setAttribute('aria-expanded',String(!searchBar.hidden));if(!searchBar.hidden)query.focus();};
 const close=document.createElement('button');close.textContent='×';close.setAttribute('aria-label','关闭搜索');close.onclick=()=>{searchBar.hidden=true;find.setAttribute('aria-expanded','false');find.focus();};searchBar.append(close);
 const extra=[];const warnings=[...root.querySelectorAll('.warning')];if(warnings.length){const notes=document.createElement('details'),summary=document.createElement('summary');summary.textContent='预览说明';notes.className='reader-notes';notes.append(summary,...warnings);extra.push(notes);}
 if(thumbnails){thumbnails.hidden=true;const thumbs=document.createElement('button');thumbs.textContent='缩略图';thumbs.setAttribute('aria-expanded','false');thumbs.onclick=()=>{thumbnails.hidden=!thumbnails.hidden;thumbs.setAttribute('aria-expanded',String(!thumbnails.hidden));};extra.push(thumbs);}
 const range=document.createElement('input');range.type='range';range.min='.5';range.max='2';range.step='.01';range.value=String(getScale());range.setAttribute('aria-label','内容缩放');range.style.width='130px';
 const commit=value=>{setScale(Math.max(.5,Math.min(2,value)));range.value=String(getScale());};range.oninput=()=>commit(Number(range.value));
 const observeScale=new MutationObserver(()=>{range.value=String(getScale());});observeScale.observe(zoom,{childList:true,characterData:true,subtree:true});
 const disposePinch=bindContentPinch(content,getScale,commit);
 const disposeToolbar=compactToolbar(bar,[minus,range,zoom,plus,...extra]);
 const revealSearch=event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='f'){searchBar.hidden=false;find.setAttribute('aria-expanded','true');query.focus();}};root.addEventListener('keydown',revealSearch,true);
 return ()=>{disposePinch();observeScale.disconnect();disposeToolbar();root.removeEventListener('keydown',revealSearch,true);};
}
export function setupPdf({getScale,setScale,getViewport,getSurface}){
 document.body.classList.add('mobile-pdf');
 const bar=document.querySelector('header');if(!bar)return;
 const primary=new Set(['prev','page','count','next','find']);
 const disposeToolbar=compactToolbar(bar,[...bar.children].filter(node=>!primary.has(node.id)));
 let gesture=null,epoch=0;
 const center=touches=>{const [a,b]=touches;return {x:(a.clientX+b.clientX)/2,y:(a.clientY+b.clientY)/2,distance:Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY)};};
 const start=event=>{const viewport=getViewport(),surface=getSurface();if(event.touches.length!==2||!surface||!viewport?.contains(event.target))return;event.preventDefault();const p=center(event.touches),r=surface.getBoundingClientRect(),scale=getScale();gesture={...p,scale,next:scale,viewport,surface,left:viewport.scrollLeft,top:viewport.scrollTop,anchorX:(p.x-r.left)/scale,anchorY:(p.y-r.top)/scale};epoch++;};
 const move=event=>{if(!gesture||event.touches.length!==2)return;event.preventDefault();const p=center(event.touches);gesture.next=Math.max(.01,Math.min(3,gesture.scale*p.distance/Math.max(1,gesture.distance)));gesture.x=p.x;gesture.y=p.y;gesture.surface.style.transformOrigin='top left';gesture.surface.style.transform='scale('+gesture.next/gesture.scale+')';document.getElementById('zoom-value').value=String(Math.round(gesture.next*100));};
 const finish=async event=>{if(!gesture)return;const saved=gesture;gesture=null;saved.surface.style.transform='';if(event.type==='touchcancel'){saved.viewport.scrollLeft=saved.left;saved.viewport.scrollTop=saved.top;document.getElementById('zoom-value').value=String(Math.round(saved.scale*100));return;}const current=epoch;await setScale(saved.next);if(epoch!==current)return;await new Promise(requestAnimationFrame);const node=getSurface();if(!node)return;const r=node.getBoundingClientRect();saved.viewport.scrollLeft+=r.left+saved.anchorX*getScale()-saved.x;saved.viewport.scrollTop+=r.top+saved.anchorY*getScale()-saved.y;};
 document.addEventListener('touchstart',start,{passive:false});document.addEventListener('touchmove',move,{passive:false});document.addEventListener('touchend',finish,{passive:true});document.addEventListener('touchcancel',finish,{passive:true});
 addEventListener('pagehide',()=>{epoch++;disposeToolbar();document.removeEventListener('touchstart',start);document.removeEventListener('touchmove',move);document.removeEventListener('touchend',finish);document.removeEventListener('touchcancel',finish);},{once:true});
}
