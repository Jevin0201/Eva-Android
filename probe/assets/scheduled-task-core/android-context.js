'use strict';
const {AsyncLocalStorage}=require('node:async_hooks');
const context=new AsyncLocalStorage();
// A definition may change while a timer run is awaiting its first kernel RPC.
// Capture once per original cron.run context; an owned thread has stronger identity.
context.snapshotBinding=function(owner,threads,definitions,threadId){
 const thread=threadId?threads.get(threadId):null;
 if(owner&&thread&&thread.automationId!==owner.automationId)throw Error('定时任务不能跨用其他任务的会话');
 if(owner&&!owner.binding){
  const value=thread||definitions[owner.automationId];
  if(!value)throw Error('定时任务缺少固定模型绑定');
  owner.binding=structuredClone({...value,taskName:owner.taskName??value.taskName});
 }
 return thread||(owner?owner.binding:null);
};
module.exports=context;
