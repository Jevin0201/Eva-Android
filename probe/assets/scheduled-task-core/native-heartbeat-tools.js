'use strict';
const tools=[{name:'automation_update',description:'管理当前EVA本地聊天的心跳任务。心跳定期唤醒已有聊天继续检查工作，状态不变时按结果保持安静。仅支持当前聊天的本地heartbeat；不支持cron、云任务或其他聊天。创建前需用户明确要求跟进，必须使用已同意的时间计划；任务完成或不再有用时删除同一个任务。',inputSchema:{type:'object',properties:{mode:{type:'string',enum:['view','create','update','delete']},id:{type:'string'},kind:{type:'string',enum:['heartbeat']},name:{type:'string'},prompt:{type:'string'},rrule:{type:'string',description:'用户同意的RRULE时间规则，如FREQ=MINUTELY;INTERVAL=10；不能自行猜测检查时间。'},status:{type:'string',enum:['ACTIVE','PAUSED']},notificationPolicy:{type:['string','null'],enum:['failed_runs_only',null]}},required:['mode'],additionalProperties:false}}];
function createHeartbeatTools(service){return async function toolCall(value,{threadId}={}){
 if(typeof threadId!=='string'||!threadId)throw Error('心跳工具缺少所属聊天');
 if(!value||typeof value!=='object'||Object.keys(value).some(key=>!Object.hasOwn(tools[0].inputSchema.properties,key)))throw Error('心跳工具参数无效');
 const {mode,id,kind,...input}=value;if(kind!==undefined&&kind!=='heartbeat')throw Error('仅支持本地心跳任务');
 const rows=service.list().filter(row=>row.targetThreadId===threadId);
 if(mode==='view')return {automations:id?rows.filter(row=>row.id===id):rows};
 if(mode==='create'){if(id!==undefined||!input.name||!input.prompt||!input.rrule)throw Error('创建心跳任务需要名称、检查内容和明确计划');return service.create({...input,targetThreadId:threadId});}
 if(!id||!rows.some(row=>row.id===id))throw Error('此心跳任务不属于当前聊天');
 if(mode==='update')return service.update({id,...input});
 if(mode==='delete'){if(Object.keys(input).length)throw Error('删除心跳任务不接受其他字段');return {status:service.remove(id)};}
 throw Error('未知心跳工具操作');
};}
module.exports={tools,createHeartbeatTools};
