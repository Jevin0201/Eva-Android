/* Native activity disclosure lifecycle, adapted to Eva's keyed DOM host. */
(() => {
  const transitions=new Map(),summariesByHost=new WeakMap(),animations=new WeakMap();
  const paint=()=>{if(typeof renderTranscript==='function')renderTranscript();};
  function disclosureState(id,expanded){return transitions.get(id)?.phase||(expanded?'expanded':'collapsed');}
  function finish(id,record){if(transitions.get(id)!==record)return;record.phase=record.phase==='closing'?'collapsed':'expanded';paint();}
  function preserveAnchor(button){
    const scroll=typeof els!=='undefined'?els.threadScroll:null;
    if(!scroll||typeof ResizeObserver!=='function')return ()=>{};
    const top=button.getBoundingClientRect().top,controller=new AbortController();
    const observer=new ResizeObserver(()=>{if(button.isConnected)scroll.scrollTop+=button.getBoundingClientRect().top-top;});
    observer.observe(button.closest('[data-turn]')||button.parentElement);
    const stop=()=>{observer.disconnect();controller.abort();clearTimeout(timer);};
    const timer=setTimeout(stop,350);
    for(const event of ['wheel','touchmove','pointerdown','keydown'])scroll.addEventListener(event,stop,{passive:true,signal:controller.signal});
    return stop;
  }
  function toggle(button){
    const id=button.dataset.toggle;
    if(!globalThis.nativeTranscript?.summarize||!id?.startsWith('work:')||!button.closest('.work-activity'))return false;
    const expanded=button.getAttribute('aria-expanded')==='true';
    transitions.get(id)?.stopAnchor?.();
    const owner=button.closest('[data-render-thread]')||button.closest('.work-activity').parentElement;
    const record={owner,phase:expanded?'closing':'opening',stopAnchor:preserveAnchor(button)};
    transitions.set(id,record);
    if(expanded){stateStore().delete(id);for(const child of button.closest('.work-activity').querySelectorAll('[data-toggle]'))stateStore().delete(child.dataset.toggle);}
    else stateStore().add(id);
    while(transitions.size>500){const first=transitions.keys().next().value;transitions.get(first)?.stopAnchor?.();transitions.delete(first);}
    paint();return true;
  }
  function stateStore(){return globalThis.state?.expanded||(typeof state!=='undefined'?state.expanded:new Set());}
  function hydrate(host){
    let summaries=summariesByHost.get(host);
    if(!summaries){summaries=new Map();summariesByHost.set(host,summaries);}
    const seen=new Set();
    for(const group of host.querySelectorAll('.work-activity[data-ui-id]')){
      const id=group.dataset.uiId,record=transitions.get(id),detail=group.querySelector(':scope > .work-details');seen.add(id);
      if(record?.owner===host&&detail&&['opening','closing'].includes(record.phase)&&animations.get(detail)!==record){
        const previous=animations.get(detail),currentHeight=detail.getBoundingClientRect().height;
        previous?.animation?.cancel();animations.set(detail,record);
        const closing=record.phase==='closing',height=detail.scrollHeight,startHeight=previous?currentHeight:0;
        const reduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
        if(!detail.animate||reduced){finish(id,record);continue;}
        detail.style.overflow='hidden';detail.style.pointerEvents=closing?'none':'';
        // Keep closing content mounted until the height transition finishes.
        const animation=detail.animate(closing?[{height:currentHeight+'px',opacity:1},{height:'0px',opacity:0}]:[{height:startHeight+'px',opacity:0},{height:height+'px',opacity:1}],{duration:180,easing:'ease-out'});
        record.animation=animation;
        animation.finished.then(()=>{detail.style.overflow='';detail.style.pointerEvents='';finish(id,record);}).catch(()=>{});
      }
      const label=group.querySelector('.act-label[data-summary-key]');if(!label)continue;
      // The renderer retains the desired text separately from the temporarily
      // displayed text, including when an unchanged keyed chunk is reused.
      const now=Date.now(),key=label.dataset.summaryKey,text=label.dataset.summaryText??label.textContent,previous=summaries.get(id);
      if(!previous){summaries.set(id,{key,text,at:now});continue;}
      if(previous.pending){clearTimeout(previous.pending);previous.pending=null;}
      const delay=group.dataset.activityState==='summary'?0:Math.max(0,1000-(now-previous.at));
      if(key!==previous.key&&delay){
        label.textContent=previous.text;
        previous.pending=setTimeout(()=>{if(label.isConnected&&label.dataset.summaryKey===key){label.textContent=text;summaries.set(id,{key,text,at:Date.now()});}},delay);
      }else summaries.set(id,{key,text,at:key===previous.key?previous.at:now});
    }
    for(const[id,record]of summaries)if(!seen.has(id)){clearTimeout(record.pending);summaries.delete(id);}
    for(const[id,record]of transitions)if((record.owner===host&&!seen.has(id))||record.owner?.isConnected===false){record.animation?.cancel();record.stopAnchor?.();transitions.delete(id);}
  }
  globalThis.activityDisclosure=Object.freeze({state:disclosureState,toggle,hydrate});
})();
