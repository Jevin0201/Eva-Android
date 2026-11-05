const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
(async()=>{const code=fs.readFileSync('probe/assets/models.js','utf8');let calls=[],pending=new Map(),id=0;
const ctx={crypto:{randomUUID:()=>String(++id)},window:{},kernelPending:pending,setTimeout:()=>0,clearTimeout:()=>{},EvaHost:{kernelCall:(ticket,method,params)=>calls.push({ticket,method,params})}};vm.createContext(ctx);vm.runInContext(code.slice(code.indexOf('function dispatchKernelCall('),code.indexOf('let kernelSaveTimer;')),ctx);
const p=ctx.kernelCall('thread/read',{threadId:'t'}),q=ctx.kernelCall('thread/read',{threadId:'t'});assert.equal(p,q);assert.equal(calls.length,1);pending.get('1').resolve({thread:{id:'t'}});await p;await Promise.resolve();
const r=ctx.kernelCall('thread/read',{threadId:'t'});assert.equal(calls.length,2);pending.get('2').reject(Error('offline'));await assert.rejects(r,/offline/);await Promise.resolve();
const s=ctx.kernelCall('thread/read',{threadId:'t'});assert.equal(calls.length,3);pending.get('3').resolve({});await s;
const a=ctx.kernelCall('turn/start',{threadId:'t'}),b=ctx.kernelCall('turn/start',{threadId:'t'});assert.notEqual(a,b);assert.equal(calls.length,5);pending.get('4').resolve({});pending.get('5').resolve({});await Promise.all([a,b]);
console.log('PASS identical in-flight reads coalesce; settled/failed reads evict; mutations keep separate IDs');})().catch(e=>{console.error(e);process.exit(1)});
