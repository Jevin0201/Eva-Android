const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync('probe/assets/models.js','utf8');
const code=source.slice(source.indexOf('let kernelPollTimer='),source.indexOf('let kernelHistoryOpenEpoch='));
let now=0,id=0,calls=0,queue=[],seen=[],fail=false;const timers=new Map();
const ctx={window:{},kernelDirty:new Set(),kernelDraining:false,settingPage:null,route:'home',active:()=>null,refreshKernelControls(){},updateKernelFlow(){},kernelEvent:e=>seen.push(e.id),EvaHost:{kernelDrain(){calls++;if(fail)throw Error('bridge unavailable');return JSON.stringify(queue.splice(0,200));}},setTimeout(fn,ms){timers.set(++id,{fn,at:now+ms});return id;},clearTimeout:id=>timers.delete(id)};
vm.createContext(ctx);vm.runInContext(code,ctx);
function advance(ms){const end=now+ms;for(;;){const next=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>end)break;now=next[1].at;timers.delete(next[0]);next[1].fn();}now=end;}
ctx.pollKernel();advance(60000);const idleCalls=calls;assert(idleCalls<=63);assert.equal(timers.size,1);
queue=Array.from({length:1301},(_,id)=>({id}));ctx.pollKernel();advance(0);assert.deepEqual(seen,Array.from({length:1301},(_,id)=>id));assert.equal(timers.size,1);
ctx.window.kernelPollingEnabled=false;const pausedCalls=calls;queue=[{id:1301}];advance(5000);assert.equal(calls,pausedCalls);assert.equal(queue.length,1);
ctx.window.kernelPollingEnabled=true;ctx.pollKernel();assert.equal(seen.at(-1),1301);
fail=true;ctx.pollKernel();advance(1000);fail=false;queue=[{id:1302}];advance(1000);assert.equal(seen.at(-1),1302);
for(let n=0;n<100;n++){queue.push({id:1303+n});ctx.pollKernel();}assert.equal(timers.size,1);assert.equal(seen.length,1403);
// Lost native notification still recovers through the bounded fallback.
advance(5000);queue=[{id:1403}];advance(1000);assert.equal(seen.at(-1),1403);
const result={idleBridgeCallsPerMinute:{before:400,after:idleCalls},reductionPercent:Math.round((1-idleCalls/400)*1000)/10,orderedEvents:seen.length,checks:['idle backoff','1301-event backlog','pause/resume','bridge failure recovery','signal timer coalescing','missed signal recovery']};
fs.mkdirSync('artifacts/performance-20261113',{recursive:true});fs.writeFileSync('artifacts/performance-20261113/polling-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
