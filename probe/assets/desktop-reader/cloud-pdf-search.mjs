import {EventBus,PDFFindController,FindState} from './vendor/pdf-viewer-current.mjs';
// REA In in pdf-preview-panel: same find controller, options and text-layer mapping.
export function createPdfSearch(pdf,getPage,setPage){
 const bus=new EventBus(),controller=new PDFFindController({eventBus:bus,linkService:{get pagesCount(){return pdf.numPages;},get page(){return getPage();},set page(value){setPage(value);},get rotation(){return 0},isPageVisible:()=>true}});
 const bar=document.getElementById('search-bar'),input=document.getElementById('search-input'),count=document.getElementById('search-count');let query='',detach=null,closed=false;
 controller.setDocument(pdf);
 function dispatch(type='',previous=false){bus.dispatch('find',{query,type,findPrevious:previous,caseSensitive:false,entireWord:false,highlightAll:true,matchDiacritics:false});}
 const matches=({matchesCount:m})=>{if(!query){count.textContent='';return;}if(m)count.textContent=m.total?m.current+' / '+m.total:'未找到';};
 const state=event=>{if(event.state===FindState.PENDING)count.textContent='搜索中…';else matches(event);};
 bus.on('updatefindmatchescount',matches);bus.on('updatefindcontrolstate',state);
 function open(){if(closed)return;bar.hidden=false;input.focus();input.select();if(query)dispatch('highlightallchange');}
 function close(){bar.hidden=true;bus.dispatch('findbarclose',{});document.getElementById('find').focus();}
 input.oninput=()=>{query=input.value;count.textContent=query?'搜索中…':'';dispatch();};
 input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();dispatch('again',e.shiftKey);}else if(e.key==='Escape'){e.preventDefault();close();}};
 document.getElementById('search-prev').onclick=()=>dispatch('again',true);document.getElementById('search-next').onclick=()=>dispatch('again');document.getElementById('search-close').onclick=close;document.getElementById('find').onclick=open;
 const key=e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='f'){e.preventDefault();open();}};document.addEventListener('keydown',key);
 function register(pageIndex,layer){detach?.();const update=()=>{const starts=controller.highlightMatches?controller.pageMatches?.[pageIndex]||[]:[],lengths=controller.pageMatchesLength?.[pageIndex]||[],selected=controller.selected;let offset=0,active=null;for(const [i,div]of layer.textDivs.entries()){const text=layer.textContentItemsStr[i];div.replaceChildren();let end=0;for(let j=0;j<starts.length;j++){const from=Math.max(0,starts[j]-offset),to=Math.min(text.length,starts[j]+lengths[j]-offset);if(from>=to)continue;div.append(text.slice(end,from));const mark=document.createElement('mark');mark.className='pdfFindMatch';mark.textContent=text.slice(from,to);if(selected?.pageIdx===pageIndex&&selected.matchIdx===j){mark.dataset.active='';active??=mark;}div.append(mark);end=to;}div.append(text.slice(end));offset+=text.length;}if(active&&selected)controller.scrollMatchIntoView({element:active,selectedLeft:0,pageIndex,matchIndex:selected.matchIdx});};const event=e=>{if(e.pageIndex===-1||e.pageIndex===pageIndex)update();};bus.on('updatetextlayermatches',event);update();detach=()=>{bus.off('updatetextlayermatches',event);detach=null;};}
 return {eventBus:bus,controller,register,unregister:()=>detach?.(),destroy(){closed=true;detach?.();bus.dispatch('findbarclose',{});controller.setDocument(null);bus.off('updatefindmatchescount',matches);bus.off('updatefindcontrolstate',state);document.removeEventListener('keydown',key);}};
}
