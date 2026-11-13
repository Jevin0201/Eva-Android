'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const streamState=require('../probe/assets/eva-stream-state.js');
const source=fs.readFileSync('probe/assets/kernel-paged-history.js','utf8');
const tick=()=>new Promise(setImmediate);
function fixture(failMetadata=false,failPage=false){
 let now=0;const jobs=[],calls=[];
 const c={id:'chat',kernelThread:{id:'thread',turns:[]}};
 const ctx={Promise,Map,Set,WeakMap,Error,streamState,settingPage:null,route:'chat',data:{chats:[c],drafts:[]},active:()=>c,esc:x=>x,kernelEvent(){},scheduleKernelSave(){},refreshKernelControls(){},updateKernelFlow(){},navigate(){},document:{querySelector:()=>null}};ctx.window=ctx;
 ctx.kernelCall=(method,params)=>{calls.push({method,params,at:now});return new Promise((resolve,reject)=>jobs.push({at:now+(method==='thread/read'?120:180),run(){if(method==='thread/read'){if(failMetadata)reject(Error('metadata unavailable'));else resolve({thread:{id:'thread'}});}else{if(failPage)reject(Error('page unavailable'));else resolve({data:[{id:'turn',status:'completed',items:[{id:'answer',type:'agentMessage',phase:'final_answer',text:'已保存回答'}]}],nextCursor:null});}}}));};
 vm.createContext(ctx);vm.runInContext(source,ctx);
 return {ctx,calls,async run(){let result,error,done=false;ctx.kernelCall('thread/read',{threadId:'thread',includeTurns:true}).then(v=>{result=v;done=true;},e=>{error=e;done=true;});await tick();while(jobs.length){jobs.sort((a,b)=>a.at-b.at);const job=jobs.shift();now=job.at;job.run();await tick();}assert(done);return {result,error,elapsed:now};}};
}
(async()=>{
 const f=fixture(),r=await f.run();
 assert.equal(r.error,undefined);assert.equal(r.result.thread.turns[0].items[0].text,'已保存回答');
 assert.equal(f.calls.length,2);assert.equal(f.calls[0].at,0);assert.equal(f.calls[1].at,0,'first summary page must start without waiting for metadata');
 assert.equal(r.elapsed,180,'first history page waits for the slower read, not the sum');
 assert.equal(f.calls[0].params.includeTurns,false);assert.equal(f.calls[1].params.itemsView,'summary');assert.equal(f.calls[1].params.limit,5);
 const unhandled=[];const onUnhandled=e=>unhandled.push(e);process.on('unhandledRejection',onUnhandled);
 try{for(const [metadata,page]of [[true,false],[false,true],[true,true]]){const failed=await fixture(metadata,page).run();assert(failed.error);await tick();}assert.deepEqual(unhandled,[]);}finally{process.removeListener('unhandledRejection',onUnhandled);}
 const result={passed:true,simulatedReadMs:{metadata:120,page:180,serialBefore:300,parallelAfter:r.elapsed},checks:['metadata and first summary page start together','summary limit and no full rollout preserved','either/both read failures reject without unhandled promises']};
 fs.mkdirSync('artifacts/chat-load-20261113',{recursive:true});fs.writeFileSync('artifacts/chat-load-20261113/latency.json',JSON.stringify(result,null,2));console.log('PASS '+JSON.stringify(result));
})().catch(error=>{console.error(error);process.exitCode=1;});
