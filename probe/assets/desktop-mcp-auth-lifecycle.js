// Desktop src/main/mcp-auth-lifecycle.js, unchanged core.
(()=>{const module={exports:{}};
'use strict';
class McpAuthLifecycle{
 constructor(request,onChange){this.request=request;this.onChange=onChange;this.attempts=new Map();this.jobs=new Map();this.completed=new Set();}
 key(name,threadId){return JSON.stringify([name,threadId||null]);}
 started(name,threadId,loginId){this.attempts.set(this.key(name,threadId),{loginId});}
 observe(method,p={}){
  if(method==='mcpServer/startupStatus/updated'&&p.status==='failed'&&p.failureReason==='reauthenticationRequired')this.onChange({name:p.name,threadId:p.threadId,state:'reauthenticationRequired',message:'插件服务授权已失效，请重新授权。'});
  if(method==='item/completed'&&p.item?.type==='mcpToolCall'&&p.item.result?._meta?.['mcp/www_authenticate'])this.onChange({name:p.item.server,threadId:p.threadId,state:'reauthenticationRequired',message:'插件服务要求重新授权；没有自动重复执行工具。'});
  if(method!=='mcpServer/oauthLogin/completed')return Promise.resolve();
  const key=this.key(p.name,p.threadId),attempt=this.attempts.get(key);if(attempt?.loginId&&p.loginId&&attempt.loginId!==p.loginId)return Promise.resolve();
  const completion=p.loginId&&JSON.stringify([key,p.loginId]);if(completion&&this.completed.has(completion))return Promise.resolve();
  if(this.jobs.has(key))return this.jobs.get(key);
  const job=this.complete(p).finally(()=>{this.jobs.delete(key);if(completion){this.completed.add(completion);if(this.completed.size>256)this.completed.delete(this.completed.values().next().value);}});this.jobs.set(key,job);return job;
 }
 async complete(p){
  if(!p.success){this.onChange({name:p.name,threadId:p.threadId,state:'notLoggedIn',message:'插件服务授权未完成或已取消。'});return;}
  try{
   await this.request('config/mcpServer/reload',null,10000);
   const result=await this.request('mcpServerStatus/list',{serverName:p.name,threadId:p.threadId||null,detail:'toolsAndAuthOnly',limit:100},10000),server=result.data?.find(s=>s.name===p.name);
   const authorized=['oAuth','bearerToken'].includes(server?.authStatus);
   this.onChange({name:p.name,threadId:p.threadId,state:authorized?'authorized':'unverified',runtimeStatus:server?.runtimeStatus||null,message:authorized?(server.runtimeStatus==='connected'?'插件服务授权和连接已更新。':'插件服务授权已保存，连接仍待验证。'):'授权回调已返回，但内核尚未确认有效授权，请刷新或重新授权。'});
  }catch{this.onChange({name:p.name,threadId:p.threadId,state:'unverified',message:'授权回调已返回，但服务重载或验证失败；没有标记为连接成功。'});}
 }
}
module.exports={McpAuthLifecycle};

window.EvaMcpAuthLifecycle=module.exports.McpAuthLifecycle;})();
