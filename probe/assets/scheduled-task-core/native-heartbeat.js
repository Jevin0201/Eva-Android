'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {readJson,writeJson}=require('./atomic-json');
const {parse}=require('./native-heartbeat-toml-original.cjs');
const createSchedule=require('./native-heartbeat-schedule-original.cjs');
const createStore=require('./native-heartbeat-store-original.cjs');
const createOriginal=require('./native-heartbeat-original.cjs');
const heartbeatInstructions=require('./native-heartbeat-instructions-original.cjs');
const clone=value=>structuredClone(value);
const inside=(base,value)=>{const r=path.relative(base,value);return r===''||!path.isAbsolute(r)&&r!=='..'&&!r.startsWith('..'+path.sep);};
function privateDirectory(runtimeHome,officialHome=path.join(os.homedir(),'.codex')){
 if(typeof runtimeHome!=='string'||!path.isAbsolute(runtimeHome))throw Error('心跳任务需要EVA独立运行目录');
 const home=path.resolve(runtimeHome),official=path.resolve(officialHome);
 if(inside(official,home)||inside(home,official))throw Error('心跳任务目录不能使用正式版Codex数据');
 let current=path.parse(home).root;for(const part of home.slice(current.length).split(path.sep)){current=path.join(current,part);if(fs.existsSync(current)&&fs.lstatSync(current).isSymbolicLink())throw Error('心跳任务目录不能通过符号链接访问');}
 fs.mkdirSync(home,{recursive:true});return home;
}
function createHeartbeatStore({runtimeHome,officialHome,Date:Clock=Date}){
 const home=privateDirectory(runtimeHome,officialHome),root=path.join(home,'automations'),cacheFile=path.join(root,'.heartbeat-state.json');
 const schedule=createSchedule({runtimeHome:home,Date:Clock});let core;
 function safeRoot(){if(fs.existsSync(root)&&(!fs.lstatSync(root).isDirectory()||fs.lstatSync(root).isSymbolicLink()))throw Error('心跳任务目录无效');fs.mkdirSync(root,{recursive:true});}
 function filename(id){if(typeof id!=='string'||!id||id==='.'||id==='..'||/[\\/\0]/.test(id))throw Error('心跳任务ID无效');safeRoot();const dir=path.join(root,id);if(fs.existsSync(dir)&&(!fs.lstatSync(dir).isDirectory()||fs.lstatSync(dir).isSymbolicLink()))throw Error('心跳任务目录无效');const file=path.join(dir,'automation.toml');if(fs.existsSync(file)&&fs.lstatSync(file).isSymbolicLink())throw Error('心跳任务文件无效');return file;}
 function validate(value){
  if(!['heartbeat','cron'].includes(value?.kind)||typeof value.name!=='string'||!value.name.trim()||typeof value.prompt!=='string'||!value.prompt.trim()||(value.kind==='heartbeat'&&(typeof value.targetThreadId!=='string'||!value.targetThreadId.trim()))||!['ACTIVE','PAUSED'].includes(value.status)||!schedule.isValid(value.rrule))throw Error('心跳任务配置无效');
  if(value.name.length>250||[value.model,value.reasoningEffort].some(v=>v!=null&&(typeof v!=='string'||!v.trim()||/[\u0000-\u001f]/.test(v))))throw Error('定时任务模型或文本配置无效');
  if(value.notificationPolicy!=null&&value.notificationPolicy!=='failed_runs_only')throw Error('心跳通知策略无效');
  if(value.kind==='cron'&&(value.executionEnvironment!=='local'||value.target!=null||!Array.isArray(value.cwds)||value.cwds.length!==1||!path.isAbsolute(value.cwds[0])||inside(path.resolve(officialHome||path.join(os.homedir(),'.codex')),value.cwds[0])))throw Error('本地定时任务工作目录无效');
  for(const text of [value.name,value.prompt,value.targetThreadId||''])if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text))throw Error('心跳任务文本包含无效控制字符');
  return value;
 }
 function all(){safeRoot();const rows=[];for(const entry of fs.readdirSync(root,{withFileTypes:true})){if(!entry.isDirectory())continue;const file=filename(entry.name);if(!fs.existsSync(file))continue;const d=parse(fs.readFileSync(file,'utf8'));if(!['heartbeat','cron'].includes(d.kind))continue;if(d.version!==1||d.id!==entry.name)throw Error('心跳任务文件身份不匹配');rows.push(validate({id:d.id,kind:d.kind,name:d.name,prompt:d.prompt,status:d.status,...(d.kind==='heartbeat'?{targetThreadId:d.target_thread_id}:{cwds:d.cwds,target:null,executionEnvironment:d.execution_environment,autoArchive:d.auto_archive??false,localEnvironmentConfigPath:null}),rrule:d.rrule,model:d.model??null,reasoningEffort:d.reasoning_effort??null,notificationPolicy:d.notification_policy,createdAt:d.created_at,updatedAt:d.updated_at,nextRunAt:null,lastRunAt:null}));}return rows;}
 function cache(){safeRoot();if(fs.existsSync(cacheFile)&&fs.lstatSync(cacheFile).isSymbolicLink())throw Error('心跳运行状态文件无效');return readJson(cacheFile,{});}
 core=createStore({schedule,Date:Clock,all,allocateDirectories:()=>{safeRoot();return fs.readdirSync(root,{withFileTypes:true}).filter(entry=>entry.isDirectory()).map(entry=>entry.name);},readCache:id=>{const row=cache()[id];return row?{...row,cwds:row.kind==='cron'?JSON.stringify(row.cwds):'[]',targetType:null,projectId:null}:null;},writeCache:row=>{const data=cache();data[row.id]=clone(row);writeJson(cacheFile,data);},writeDefinition:row=>{validate(row);const file=filename(row.id);fs.mkdirSync(path.dirname(file),{recursive:true});const temp=file+'.eva-tmp';if(fs.existsSync(temp))fs.unlinkSync(temp);fs.writeFileSync(temp,core.serialize(row),{encoding:'utf8',mode:0o600,flag:'wx'});fs.renameSync(temp,file);}});
 return {...core,schedule,validate,root,remove(id){const existing=core.get(id);if(!existing)return 'not_found';fs.rmSync(path.dirname(filename(id)),{recursive:true});const data=cache();delete data[id];writeJson(cacheFile,data);return 'deleted';}};
}
function validThreadState(value){return value&&typeof value.threadId==='string'&&typeof value.isEligible==='boolean'&&typeof value.collaborationMode?.settings?.model==='string'&&value.collaborationMode.settings.model!==''&&value.permissions&&typeof value.permissions.approvalsReviewer==='string'&&value.permissions.approvalPolicy!=null&&['readOnly','workspaceWrite','dangerFullAccess','externalSandbox'].includes(value.permissions.sandboxPolicy?.type);}
function createNativeHeartbeat({runtimeHome,officialHome,request,isReady,getThreadState,onChange=()=>{},onNotify=()=>{},logger={warning:()=>{},debug:()=>{}},appServerVersion='0.160.0',Date:Clock=Date,timers={setInterval,clearInterval,setTimeout,clearTimeout}}){
 if(typeof request!=='function'||typeof isReady!=='function'||typeof getThreadState!=='function')throw TypeError('心跳任务缺少私有内核或会话状态适配器');
 const store=createHeartbeatStore({runtimeHome,officialHome,Date:Clock}),historyFile=path.join(store.root,'.scheduled-runs.json'),cronActive=new Set(),listeners=new Set(),principalListeners=new Set(),connectionListeners=new Set(),states=new Map(),pending=new Map(),turns=new Map(),texts=new Map();
 let scheduler=null,disposed=false,generation=0,connection;
 const change=()=>onChange(clone(store.list()));
 function history(){if(fs.existsSync(historyFile)&&fs.lstatSync(historyFile).isSymbolicLink())throw Error('定时任务历史文件无效');return readJson(historyFile,[]);}
 function updateHistory(fn){writeJson(historyFile,fn(history()).slice(-500));}
 function recordRun(row){updateHistory(rows=>[...rows,row]);change();}
 const cron=require('./native-scheduled-cron').createPrivateCron({store,resolveModel:args=>original.resolveModel(args),logger,onRecord:recordRun,onFailed:id=>updateHistory(rows=>rows.map(r=>r.id===id?{...r,status:'FAILED',completedAt:Clock.now()}:r)),onThread:(before,id)=>updateHistory(rows=>rows.map(r=>r.id===before?{...r,id,threadId:id}:r)),onTurn:()=>{}});
 async function runCron({automation,appServerConnection,runTrigger}){if(cronActive.has(automation.id))throw Error('这个定时任务仍在运行');cronActive.add(automation.id);try{return await cron.run({automation,appServerConnection,runTrigger});}catch(error){cronActive.delete(automation.id);updateHistory(rows=>rows.map(r=>r.automationId===automation.id&&r.status==='IN_PROGRESS'?{...r,status:'FAILED',completedAt:Clock.now(),error:error.message}:r));change();throw error;}}

 const nativeStore={nr:store.due,Gn:store.get,fr:store.update,ar:store.markRun,ur:store.postpone,Vn:store.initialize,Dr:()=>false,vn:class extends Error{}};
 const original=createOriginal({runCron,store:nativeStore,schedule:store.schedule,heartbeatInstructions,logger,appServerCapabilities:{serviceTierForTurn:true},Date:Clock,timers:{...timers,setInterval(fn,ms){return timers.setInterval(()=>refreshStates().then(fn).catch(error=>logger.warning('Heartbeat state refresh failed',{sensitive:{error}})),ms);}},resolvePermissions:()=>{throw Error('心跳任务权限尚未同步，请先打开目标聊天');}});
 function assertReady(expected=generation){if(disposed||generation!==expected||!isReady())throw new DOMException('EVA heartbeat connection changed','AbortError');}
 async function rpc(method,params,expected=generation){assertReady(expected);const result=await request(method,params);assertReady(expected);return result;}
 function subscribe(set,callback){set.add(callback);return()=>set.delete(callback);}
 function newConnection(){const expected=generation;return {
  appServerVersion,
  async readThread(id,options={}){return (await rpc('thread/read',{threadId:id,includeTurns:options?.includeTurns??false},expected)).thread;},
  async startThread(params){return rpc('thread/start',params,expected);},
  async resumeThread(id,options){return rpc('thread/resume',{threadId:id,...options},expected);},
  async listModels(params){return rpc('model/list',params,expected);},
  async getUserSavedConfiguration(cwd){return (await rpc('config/read',{cwd,includeLayers:false},expected)).config;},
  async getConfigRequirements(){return rpc('configRequirements/read',{},expected);},
  async getAuthMethod(){return (await rpc('account/read',{refreshToken:false},expected)).account?.type;},
  registerInternalNotificationHandler:callback=>subscribe(listeners,callback),registerInternalAuthenticatedPrincipalChangeHandler:callback=>subscribe(principalListeners,callback),registerInternalConnectionStateHandler:callback=>subscribe(connectionListeners,callback),
  notifyAutomationRunsUpdated:change,notifyAutomationRunTriggered:()=>{},
  async startTurn(params,metadata){
   assertReady(expected);if(metadata.automationKind==='cron'){const {sessionId,collaborationMode,...wire}=params;const row=store.list().find(a=>a.kind==='cron'&&params.input[0]?.text.includes('Automation ID: '+a.id+'\n'));if(!row)throw Error('定时任务身份无效');const result=await rpc('turn/start',wire,expected);if(!result?.turn?.id)throw Error('定时回合受理状态未知');turns.set(params.threadId+':'+result.turn.id,{automationId:row.id,threadId:params.threadId,notificationPolicy:metadata.notificationPolicy,kind:'cron',generation:expected});return result;}const fresh=await getThreadState(params.threadId);assertReady(expected);setThreadState({...fresh,threadId:params.threadId});const state=states.get(params.threadId);if(!validThreadState(state)||!state.isEligible)throw Error('心跳目标会话状态或权限尚未就绪');
   if(pending.has(params.threadId))throw Error('这个聊天的心跳请求正在提交');
   const automationId=store.list().find(a=>a.targetThreadId===params.threadId&&params.input[0]?.text.includes('<automation_id>'+a.id+'</automation_id>'))?.id;
   const record={automationId,threadId:params.threadId,notificationPolicy:metadata.notificationPolicy,kind:'heartbeat',generation:expected};pending.set(params.threadId,record);
   // additionalContext/collaborationMode belong to the official desktop manager, not EVA's pinned wire protocol.
   const {additionalContext,collaborationMode,cyberAccessProgram,sessionId,...wire}=params;
   wire.input=[{type:'text',text:additionalContext.heartbeat_instructions.value+'\n\n'+params.input[0].text,text_elements:[]}];
   wire.model=collaborationMode.settings.model;wire.effort=collaborationMode.settings.reasoning_effort??null;
   const definition=automationId?store.get(automationId):null;if(definition&&(definition.model!=null||definition.reasoningEffort!=null)){const models=[];let cursor=null;do{const page=await rpc('model/list',{includeHidden:true,cursor,limit:100},expected);models.push(...page.data);cursor=page.nextCursor??null;}while(cursor!=null);const selected=original.resolveModel({automation:{...definition,model:definition.model??wire.model,reasoningEffort:definition.reasoningEffort??wire.effort},models,defaultModel:wire.model});wire.model=selected.model;wire.effort=selected.reasoningEffort;}
   wire.approvalPolicy=state.permissions.approvalPolicy;wire.approvalsReviewer=state.permissions.approvalsReviewer;wire.sandboxPolicy=clone(state.permissions.sandboxPolicy);
   try{const result=await rpc('turn/start',wire,expected);if(!result?.turn?.id)throw Error('心跳回合受理状态未知');turns.set(params.threadId+':'+result.turn.id,record);recordRun({id:result.turn.id,turnId:result.turn.id,threadId:params.threadId,automationId,kind:'heartbeat',status:'IN_PROGRESS',createdAt:Clock.now()});return result;}finally{if(pending.get(params.threadId)===record)pending.delete(params.threadId);change();}
  }
 };}
 connection=newConnection();
 function setThreadState(value){if(typeof value?.threadId!=='string')throw Error('心跳会话状态无效');const normalized=validThreadState(value)?clone(value):{threadId:value.threadId,isEligible:false,reason:'state_unavailable'};states.set(value.threadId,normalized);scheduler?.setHeartbeatThreadRendererState(normalized);return validThreadState(normalized);}
 async function refreshStates(){if(disposed||!isReady())return;const expected=generation;for(const id of new Set(store.list().filter(a=>a.kind==='heartbeat').map(a=>a.targetThreadId))){try{const value=await getThreadState(id);assertReady(expected);setThreadState({...value,threadId:id});}catch(error){if(generation!==expected||disposed)return;setThreadState({threadId:id,isEligible:false,reason:'state_unavailable'});}}}
 function observe(method,params={}){
  const id=params.threadId,turnId=params.turnId??params.turn?.id,key=id&&turnId?id+':'+turnId:null;
  // The RPC response is the ownership proof. A simultaneous user turn in the same
  // thread must never inherit heartbeat notification rules from a pending request.
  const record=key?turns.get(key):null;let value=params;
  if(record){
   if(method==='item/agentMessage/delta')texts.set(key,(texts.get(key)||'')+(params.delta||''));
   if(method==='item/completed'&&params.item?.type==='agentMessage')texts.set(key,params.item.text||texts.get(key)||'');
   if(method==='turn/completed'){
    const final=params.turn?.items?.findLast(i=>i.type==='agentMessage')?.text??texts.get(key)??'';
    const result=record.result??original.notificationDecision({automationKind:record.kind||'heartbeat',notificationPolicy:record.notificationPolicy,lastAgentMessage:final,didCompleteSuccessfully:params.turn?.status==='completed'});
    value={...params,automationKind:record.kind||'heartbeat',automationNotificationDecision:result.decision,heartbeatAssistantMessage:result.heartbeatAssistantMessage};
    if(!record.completed){updateHistory(rows=>rows.map(r=>r.automationId===record.automationId&&r.threadId===id&&r.status==='IN_PROGRESS'?{...r,status:params.turn?.status==='completed'?'COMPLETED':'FAILED',description:final,completedAt:Clock.now(),turnId}:r));if(record.kind==='cron')cronActive.delete(record.automationId);if(result.decision==='NOTIFY')onNotify({threadId:id,turnId,automationId:record.automationId,message:result.heartbeatAssistantMessage?.notificationMessage||final,status:params.turn?.status});record.completed=true;record.result=result;change();}
    texts.delete(key);while(turns.size>500){const entry=[...turns].find(([,row])=>row.completed);if(!entry)break;turns.delete(entry[0]);}
   }
  }
  for(const listener of [...listeners])listener({method,params:value});
  if(method==='thread/archived'||method==='thread/deleted'){for(const item of store.list().filter(a=>a.targetThreadId===id))store.remove(item.id);change();}
  return value;
 }
 async function createTarget(value){
  const cwd=path.join(runtimeHome,'workspaces','automations');fs.mkdirSync(cwd,{recursive:true});
  const params={model:value.model??null,modelProvider:null,config:value.reasoningEffort?{model_reasoning_effort:value.reasoningEffort}:null,cwd,approvalPolicy:'on-request',approvalsReviewer:'user',sandbox:'read-only',developerInstructions:null,personality:null,ephemeral:false,experimentalRawEvents:false,serviceTier:null};
  const result=await rpc('thread/start',params);if(!result?.thread?.id||result.thread.ephemeral===true)throw Error('定时任务聊天创建失败');
  return result.thread.id;
 }
 async function target(id){const thread=(await rpc('thread/read',{threadId:id,includeTurns:false})).thread;if(thread?.id!==id||thread.ephemeral===true)throw Error('心跳任务需要已有的持久本地聊天');return thread;}
 function allowed(value,creating){const keys=creating?['name','prompt','rrule','targetThreadId','status','notificationPolicy','model','reasoningEffort','threadMode']:['id','name','prompt','rrule','targetThreadId','status','notificationPolicy','model','reasoningEffort','threadMode'];if(!value||typeof value!=='object'||Object.keys(value).some(key=>!keys.includes(key)))throw Error('心跳任务字段无效');}
 const api={
  list:()=>clone(store.list().map(row=>({...row,threadMode:row.kind==='cron'?'new':'same'}))),
  history:id=>clone(history().filter(r=>r.automationId===id)),
  async create(value){allowed(value,true);const {threadMode,...input}=value;store.validate({kind:'heartbeat',status:'ACTIVE',...input,targetThreadId:input.targetThreadId||'pending-private-thread'});if(threadMode!=null&&!['same','new'].includes(threadMode))throw Error('定时任务聊天模式无效');if(threadMode==='new'){const cwd=path.join(runtimeHome,'workspaces','automations');fs.mkdirSync(cwd,{recursive:true});const entry=store.create(store.validate({kind:'cron',status:'ACTIVE',model:null,reasoningEffort:null,...input,target:null,cwds:[cwd],executionEnvironment:'local'}));change();return clone(entry);}const targetThreadId=input.targetThreadId||await createTarget(input);await target(targetThreadId);const entry=store.create(store.validate({kind:'heartbeat',status:'ACTIVE',model:null,reasoningEffort:null,...input,targetThreadId}));change();await refreshStates();return clone(entry);},
  async update(value){allowed(value,false);const previous=store.get(value.id);if(!previous)throw Error('心跳任务不存在');const {threadMode,...input}=value;if(threadMode!=null&&threadMode!==(previous.kind==='cron'?'new':'same'))throw Error('已有任务不能更改聊天运行模式，请新建任务');const entry=store.validate({...previous,...input,kind:previous.kind});if(entry.kind==='heartbeat')await target(entry.targetThreadId);const result=store.update(entry);change();await refreshStates();return clone(result);},
  remove(id){const result=store.remove(id);change();return result;},
  async runNow(id){const automation=store.get(id);if(!automation)throw Error('心跳任务不存在');if(automation.kind==='cron'){if(cronActive.has(automation.id))throw Error('这个定时任务仍在运行');const next=store.schedule.nextWithJitter({automation,now:Clock.now()});store.markRun(automation.id,next?.nextRunAt??null,next?.nextRunNominalAt??null);return runCron({automation,appServerConnection:connection,runTrigger:'run_now'});}await refreshStates();const state=states.get(automation.targetThreadId);if(!validThreadState(state)||!state.isEligible)throw Error('请先打开目标聊天并处理等待中的输入或审批');return original.runNow({automation,appServerConnection:connection,collaborationMode:state.collaborationMode,permissions:state.permissions,isHostedAutomationAppAvailable:async()=>false});},
  async start(){if(disposed||scheduler||!isReady())return;const expected=generation;scheduler=original.createScheduler({appVersion:'0.1.15',appServerConnectionRegistry:{getConnection:()=>connection},appServerClient:{hostConfig:{id:'eva-local'}},isOnline:()=>false,deleteArchivedHeartbeat:async id=>api.remove(id)});await refreshStates();assertReady(expected);scheduler.start();scheduler.setLocalAutomationsCapability(true);},
  setThreadState,observe,refreshStates,
  shouldSuppress(method,params){return method==='turn/completed'&&(params.automationNotificationDecision==='DONT_NOTIFY'||params.heartbeatAssistantMessage?.decision==='DONT_NOTIFY');},
  getRestartBlockers:()=>[...scheduler?.getRestartBlockers()??[],...cronActive.size?['automation.cron']:[]],
  invalidate(){updateHistory(rows=>rows.map(r=>r.status==='IN_PROGRESS'?{...r,status:'INTERRUPTED',completedAt:Clock.now()}:r));generation++;scheduler?.dispose();scheduler=null;for(const fn of [...connectionListeners])fn('disconnected');for(const fn of [...principalListeners])fn();states.clear();pending.clear();turns.clear();texts.clear();cronActive.clear();connection=newConnection();},
  dispose(){api.invalidate();disposed=true;listeners.clear();principalListeners.clear();connectionListeners.clear();},store,original,
 };api.toolCall=require('./native-heartbeat-tools').createHeartbeatTools(api);return api;
}
module.exports={createNativeHeartbeat,createHeartbeatStore,validThreadState};
