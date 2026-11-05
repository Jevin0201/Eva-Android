'use strict';
const fs=require('node:fs'),path=require('node:path'),readline=require('node:readline');
const {readJson,writeJson}=require('./atomic-json');
const context=require('./android-context');
const {createNativeHeartbeat}=require('./native-heartbeat');
const home=process.argv[2];
if(!home||!path.isAbsolute(home))throw Error('Missing private scheduler directory');
let ancestor=path.parse(home).root;
for(const part of path.resolve(home).slice(ancestor.length).split(path.sep)){ancestor=path.join(ancestor,part);if(fs.existsSync(ancestor)&&fs.lstatSync(ancestor).isSymbolicLink())throw Error('调度目录不能经过符号链接');}
fs.mkdirSync(home,{recursive:true});
const lock=path.join(home,'android-scheduler.lock');
try{const old=JSON.parse(fs.readFileSync(lock,'utf8'));try{process.kill(old.pid,0);throw Error('Scheduler already running');}catch(e){if(e.code!=='ESRCH')throw e;}fs.unlinkSync(lock);}catch(e){if(e.code!=='ENOENT')throw e;}
fs.writeFileSync(lock,JSON.stringify({pid:process.pid}),{flag:'wx',mode:0o600});
const bindingFile=path.join(home,'android-bindings.json');
if(fs.existsSync(bindingFile)&&fs.lstatSync(bindingFile).isSymbolicLink())throw Error('任务模型绑定不能使用符号链接');
let bindings=readJson(bindingFile,{}),sequence=0;
const threads=new Map(),pending=new Map();
const send=value=>process.stdout.write(JSON.stringify(value)+'\n');
async function request(method,params){
 const owner=context.getStore(),binding=context.snapshotBinding(owner,threads,bindings,params.threadId);
 if(['thread/start','thread/resume','turn/start'].includes(method)&&!binding)throw Error('定时任务缺少固定模型绑定');
 if(binding&&params.threadId)threads.set(params.threadId,binding);
 if(method==='thread/start'&&owner){
  const interrupted=manager.history(owner.automationId).filter(row=>row.status==='INTERRUPTED'&&row.threadId).slice(-1);
  for(const row of interrupted){
   const previous=await request('thread/read',{threadId:row.threadId,includeTurns:false});
   if(previous.thread?.id!==row.threadId)throw Error('上次定时任务状态尚未确认，未创建新回合');
   if(previous.thread?.status?.type==='active')throw Error('上次定时任务仍在内核运行，请先核对对应会话');
  }
 }
 const id=++sequence;
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{pending.delete(id);reject(Error('定时任务内核受理状态未知，未自动重发'));},60000);
  pending.set(id,{resolve:result=>{clearTimeout(timer);if(result?.thread?.id&&binding)threads.set(result.thread.id,binding);resolve(result);},reject:error=>{clearTimeout(timer);reject(error);}});
  send({type:'kernel',id,method,params,binding});
 });
}
let schedulerTick=null;
const androidTimers={setInterval(fn,ms){schedulerTick=fn;return setInterval(fn,ms);},clearInterval,setTimeout,clearTimeout};
const manager=createNativeHeartbeat({timers:androidTimers,runtimeHome:home,officialHome:home+'-excluded-official',request,isReady:()=>true,getThreadState:async()=>({isEligible:false}),onChange:()=>send({type:'changed'})});
// Desktop invalidation preserves run history as interrupted. A process restart never replays an old accepted turn.
manager.invalidate();
const timezoneFile=path.join(home,'android-timezone.json');
if(fs.existsSync(timezoneFile)&&fs.lstatSync(timezoneFile).isSymbolicLink())throw Error('时区状态不能使用符号链接');
let timezone=readJson(timezoneFile,null);
function configureTimezone(id){
 if(typeof id!=='string'||id.length>128||/[\u0000-\u0020]/.test(id))throw Error('手机时区无效');
 new Intl.DateTimeFormat('en-US',{timeZone:id}).format(new Date());
 process.env.TZ=id;
 if(timezone?.id!==id){
  for(const row of manager.list().filter(row=>row.status==='ACTIVE')){
   const next=manager.store.schedule.nextWithJitter({automation:row,now:Date.now()});
   manager.store.postpone(row.id,next?.nextRunAt??null,next?.nextRunNominalAt??null);
  }
  timezone={id};writeJson(timezoneFile,timezone);
 }
 return {environmentTimezone:process.env.TZ,resolvedTimezone:Intl.DateTimeFormat().resolvedOptions().timeZone,offsetMinutes:-new Date().getTimezoneOffset()};
}
configureTimezone(process.env.TZ||Intl.DateTimeFormat().resolvedOptions().timeZone);
let commands=Promise.resolve();
async function command(operation,value={}){
 if(operation==='timezone')return configureTimezone(value.id);
 if(operation==='tick'){await manager.start();if(schedulerTick)await schedulerTick();return {ticked:true};}
 if(operation==='enable'){await manager.start();return {enabled:true};}
 if(operation==='disable'){manager.invalidate();return {enabled:false};}
 if(operation==='list')return manager.list().map(row=>({...row,androidBinding:bindings[row.id]}));
 if(operation==='history')return manager.history(value.id);
 if(operation==='create'||operation==='update'){
  if(operation==='create'&&manager.list().length>=100)throw Error('最多保存100个定时任务');
  if(typeof value.prompt==='string'&&value.prompt.length>32768)throw Error('任务提示超过32768字符');
  const input={...value};delete input.androidBinding;
  const binding=value.androidBinding;
  if(!binding||typeof binding.model!=='string'||!binding.model.trim()||typeof binding.provider!=='string'||!binding.provider.trim())throw Error('请选择固定提供商和模型');
  if(operation==='update'&&manager.history(value.id).some(r=>r.status==='IN_PROGRESS'))throw Error('任务运行中，不能修改模型或任务');
  input.threadMode='new';input.model=binding.model;
  const result=await manager[operation](input);
  bindings[result.id]={automationId:result.id,taskName:result.name,provider:binding.provider,model:binding.model,approvalPolicy:'on-request',approvalsReviewer:'user',sandboxPolicy:{type:'readOnly'}};
  writeJson(bindingFile,bindings);return {...result,androidBinding:bindings[result.id]};
 }
 if(operation==='remove'){
  if(manager.history(value.id).some(r=>r.status==='IN_PROGRESS'))throw Error('任务运行中，请先停止对应会话');
  const result=manager.remove(value.id);delete bindings[value.id];writeJson(bindingFile,bindings);return {result};
 }
 if(operation==='status')return {...configureTimezone(process.env.TZ),running:true,blockers:manager.getRestartBlockers()};
 if(operation==='runNow')return manager.runNow(value.id);
 throw Error('未知定时任务操作');
}
const lines=readline.createInterface({input:process.stdin});
lines.on('line',line=>{
 if(line.length>4*1024*1024)return;
 let row;try{row=JSON.parse(line);}catch{return;}
 if(row.type==='reply'){
  const job=pending.get(row.id);if(!job)return;pending.delete(row.id);
  row.error?job.reject(Error(row.error)):job.resolve(row.result);return;
 }
 if(row.type==='notification'){manager.observe(row.method,row.params);return;}
 if(row.type==='command')commands=commands.then(async()=>{try{send({type:'result',id:row.id,result:await command(row.operation,row.value)});}catch(e){send({type:'result',id:row.id,error:e.message});}});
});
lines.on('close',()=>{manager.dispose();process.exit(0);});
process.on('SIGTERM',()=>{manager.dispose();process.exit(0);});
send({type:'ready'});
process.on('exit',()=>{try{if(JSON.parse(fs.readFileSync(lock,'utf8')).pid===process.pid)fs.unlinkSync(lock);}catch{}});
