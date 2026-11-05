'use strict';
const assert=require('node:assert/strict');
const context=require('../probe/assets/scheduled-task-core/android-context');
(async()=>{
 const definitions={task:{automationId:'task',provider:'old-provider',model:'old-model',sandboxPolicy:{type:'readOnly'}}},threads=new Map();
 let release,entered;
 const wait=new Promise(resolve=>release=resolve),ready=new Promise(resolve=>entered=resolve);
 const active=context.run({automationId:'task'},async()=>{
  const first=context.snapshotBinding(context.getStore(),threads,definitions);
  entered();await wait;
  const next=context.snapshotBinding(context.getStore(),threads,definitions);
  threads.set('accepted-thread',first);
  const owned=context.snapshotBinding(context.getStore(),threads,definitions,'accepted-thread');
  return {first,next,owned};
 });
 await ready;
 // The original manager normally blocks editing after IN_PROGRESS, but a timer's
 // first model lookup precedes that record. Emulate an edit while its RPC waits.
 definitions.task={automationId:'task',provider:'new-provider',model:'new-model',sandboxPolicy:{type:'readOnly'}};
 release();const result=await active;
 assert.equal(result.first.model,'old-model');assert.equal(result.next.model,'old-model');assert.equal(result.owned.provider,'old-provider');
 const future=context.run({automationId:'task'},()=>context.snapshotBinding(context.getStore(),threads,definitions));
 assert.equal(future.model,'new-model');
 const sameThread=context.run({automationId:'task'},()=>context.snapshotBinding(context.getStore(),threads,definitions,'accepted-thread'));
 assert.equal(sameThread.model,'old-model');
 assert.throws(()=>context.run({automationId:'other'},()=>context.snapshotBinding(context.getStore(),threads,definitions,'accepted-thread')),/不能跨用/);
 console.log('PASS actual async-context binding adapter: edit during awaited RPC preserves active provider/model; next run uses new model; owned thread wins; cross-task rejected');
})().catch(error=>{console.error(error);process.exitCode=1;});
