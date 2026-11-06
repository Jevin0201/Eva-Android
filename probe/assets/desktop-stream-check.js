/* Test-only pressure driver. Loaded exclusively by DesktopStreamFixtureActivity. */
(() => {
 if(!window.TestHost)return;
 window.EVA_STREAM_MODE='desktop';window.kernelPollingEnabled=false;
 const errors=[];window.addEventListener('error',event=>errors.push(event.message));
 window.addEventListener('unhandledrejection',event=>errors.push(String(event.reason)));
 async function pressure(mode){

   route='chat';render();
   const durations=[],frameIntervals=[],previousUpdate=updateKernelFlow;let previousFrame=performance.now();
   updateKernelFlow=function(chat){const start=performance.now();try{return previousUpdate(chat);}finally{durations.push(performance.now()-start);}};
   const threadId='fixture-thread',turnId='live';
   const emit=(method,params)=>kernelEvent({method,params:{threadId,turnId,...params}});
   emit('turn/started',{turn:{id:turnId,status:'inProgress',items:[]}});
   emit('item/started',{item:{id:'live-agent',type:'agentMessage',phase:'commentary',text:'正文片段0000\n\n'}});
   emit('item/started',{item:{id:'live-command',type:'commandExecution',command:'fixture output',status:'inProgress',aggregatedOutput:''}});
   function text(root){let result=root?.textContent||'';function shadows(node){if(node.shadowRoot){result+=node.shadowRoot.textContent;for(const child of node.shadowRoot.children)shadows(child);}for(const child of node.children||[])shadows(child);}if(root)shadows(root);return result;}
   function openDetails(root){for(const button of root.querySelectorAll('button[aria-expanded="false"]'))button.click();for(const node of root.querySelectorAll('*'))if(node.shadowRoot)openDetails(node.shadowRoot);}
   function assistant(){const selectors=mode==='desktop'?'[data-native-steering]':'.assistant.markdown';return [...document.querySelectorAll(selectors)].find(node=>text(node).includes('正文片段0000'));}
   await new Promise((resolve,reject)=>{const until=performance.now()+5000;function wait(){if(assistant())resolve();else if(performance.now()>until)reject(Error('Streaming assistant host did not appear'));else requestAnimationFrame(wait);}wait();});
   const flow=document.querySelector('.flow'),originalAssistant=assistant(),originalShadow=originalAssistant.shadowRoot;
   let previousCount=1,frames=0,blankFrames=0,rebuilds=0,shadowRebuilds=0,regressions=0,flowRebuilds=0,readingTop=null,maxReadingDrift=0,finished=false;
   let largestCount=1;
   const sample=()=>{
    const now=performance.now();frameIntervals.push(now-previousFrame);previousFrame=now;const current=assistant();frames++;
    if(document.querySelector('.flow')!==flow)flowRebuilds++;
    if(!current)blankFrames++;
    else{
     if(current!==originalAssistant)rebuilds++;
     if(current===originalAssistant&&current.shadowRoot!==originalShadow)shadowRebuilds++;
     const count=new Set(text(current).match(/正文片段\d{4}/g)||[]).size;
     if(count<previousCount)regressions++;
     previousCount=count;largestCount=Math.max(largestCount,count);
    }
    if(readingTop!=null)maxReadingDrift=Math.max(maxReadingDrift,Math.abs(flow.scrollTop-readingTop));
    if(!finished)requestAnimationFrame(sample);
   };
   requestAnimationFrame(sample);
   let expected='正文片段0000\n\n',queue=[],lastFlush=performance.now();
   const flush=()=>{kernelDraining=true;try{for(const event of queue)kernelEvent(event);}finally{queue=[];kernelDraining=false;updateKernelFlow(active());refreshKernelControls();lastFlush=performance.now();}};
   for(let i=1;i<=540;i++){
    const content=(i%30===1?'```javascript\n':i%30===15?'```\n\n':'')+'正文片段'+String(i).padStart(4,'0')+' '+('payload '.repeat(3))+'\n';expected+=content;
    queue.push({method:'item/agentMessage/delta',params:{threadId,turnId,itemId:'live-agent',delta:content}});
    queue.push({method:'item/commandExecution/outputDelta',params:{threadId,turnId,itemId:'live-command',delta:'tool output '+i+'\n'}});
    if(performance.now()-lastFlush>=150)flush();
    if(i===120){
     flush();
     const layoutDeadline=performance.now()+5000;
     while(flow.scrollHeight-flow.clientHeight<600){
      if(performance.now()>layoutDeadline)throw Error('History layout did not become scrollable');
      await new Promise(resolve=>requestAnimationFrame(resolve));
     }
     flow.scrollTop=300;flow.dispatchEvent(new Event('scroll'));readingTop=flow.scrollTop;
    }
    if(i===450){readingTop=null;document.querySelector('.chat-scroll-bottom')?.click();}
    await new Promise(resolve=>setTimeout(resolve,16));
   }
   flush();
   const detailsDeadline=performance.now()+5000;
   do {openDetails(flow);await new Promise(resolve=>setTimeout(resolve,100));}
   while(!text(flow).includes('tool output 540')&&performance.now()<detailsDeadline);
   const finalText=text(assistant()),modelText=active().kernelThread.turns.find(t=>t.id===turnId).items.find(i=>i.id==='live-agent').text;
   finished=true;
   const sorted=[...durations].sort((a,b)=>a-b);
   const frameSorted=[...frameIntervals].sort((a,b)=>a-b);return {p95FrameMs:frameSorted[Math.floor(frameSorted.length*.95)]||0,maxFrameMs:Math.max(0,...frameIntervals),mode,frames,blankFrames,rebuilds,shadowRebuilds,regressions,flowRebuilds,largestCount,finalCount:new Set(finalText.match(/正文片段\d{4}/g)||[]).size,modelExact:modelText===expected,toolOutputVisible:text(flow).includes('tool output 540'),maxReadingDrift,finalBottomGap:flow.scrollHeight-flow.clientHeight-flow.scrollTop,updates:durations.length,p95UpdateMs:sorted[Math.floor(sorted.length*.95)]||0,maxUpdateMs:Math.max(0,...durations)};

 }
 async function run(){
  try{
   const deadline=performance.now()+30000;
   while(!window.evaDesktopStream?.enabled){if(performance.now()>deadline)throw Error('Desktop renderer did not initialize');await new Promise(resolve=>setTimeout(resolve,50));}
   const report=await pressure('desktop');
   const result=validate(report);result.pageErrors=errors;if(errors.length)result.passed=false;
   TestHost.done(JSON.stringify(result));
  }catch(error){TestHost.done(JSON.stringify({passed:false,error:String(error),stack:error.stack,pageErrors:errors}));}
 }
 function validate(report){

 const failures=[];
 function require(value,label){if(!value)failures.push(label);}
 for(const name of ['flowRebuilds','blankFrames','rebuilds','shadowRebuilds','regressions'])require(report[name]===0,name+' must be zero');
 require(report.finalCount===541,'all 541 fragments rendered');
 require(report.modelExact,'exact model contents');require(report.toolOutputVisible,'latest tool output visible');
 require(report.maxReadingDrift<3,'reading viewport remains stable');require(report.finalBottomGap<=25,'jump resumes bottom follow');
 require(report.frames>10,'actual rendering frames sampled');
 require(report.p95FrameMs<=100,'p95 frame interval <=100ms');
 return {passed:failures.length===0,report,failures};

 }
 window.addEventListener('load',()=>setTimeout(run,50),{once:true});
})();
