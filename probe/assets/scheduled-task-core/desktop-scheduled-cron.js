'use strict';
// EVA host adapter around the pinned original ul and Ooe functions. The local
// host deliberately supplies only its own private workspace and read-only policy.
const os=require('node:os'),crypto=require('node:crypto');
const createDispatch=require('./native-cron-runner-original.cjs');
const createTurn=require('./native-cron-turn-original.cjs');
const {instructions}=require('./native-scheduled-support-original.cjs');
const policy=()=>({approvalPolicy:'on-request',approvalsReviewer:'user',sandboxPolicy:{type:'readOnly'}});
function createPrivateCron({store,resolveModel,logger,onRecord,onFailed,onThread,onTurn}){
 const dl=t=>t.type==='legacy'?t.cwd:t.type==='project'?t.project.roots[0]:null;
 const unsupported=async()=>{throw Error('此本地定时任务不支持工作树或远程项目');};
 async function run({automation,appServerConnection,runTrigger}){
  const records=new Map();
  const Ooe=createTurn({foe:instructions,u:{Ut:x=>x},Kc:unsupported,l:{zt:()=>false},Pi:x=>x,i:{dr:()=> 'experimental.dynamic_tools',s:'auto',a:()=>null,gs:{},bs:x=>x},jt:()=>'',s:{Kt:({baseInstructions})=>baseInstructions,Sr:(id,key,name,cwd)=>{const row={automationId:id,id:key,name,cwd,status:'IN_PROGRESS',createdAt:Date.now()};records.set(key,row);onRecord(row)},Tr:(before,threadId)=>{const row=records.get(before);if(!row)return false;records.delete(before);records.set(threadId,{...row,id:threadId,threadId});onThread(before,threadId);return true},wr:(id)=>onFailed(id)},cl:policy,Soe:()=>null,zc:()=>{},Ic:async()=>({}),Hc:async()=>({}),boe:unsupported,koe:()=>{},xoe:async({sourceCwds})=>sourceCwds,rl:()=>logger,T:os,v:crypto,dl});
  const connection={...appServerConnection,
   async startThread(params){const value=await appServerConnection.startThread(params);if(!value?.thread?.id)throw Error('定时任务聊天创建失败');return value;},
   async startTurn(params,meta){const result=await appServerConnection.startTurn(params,meta);onTurn({automation,threadId:params.threadId,turnId:result?.turn?.id});return result;}
  };
  const dispatch=createDispatch({Yc:()=>null,Mi:async()=>({automationModel:automation.model??null}),i:{ma:resolveModel},rl:()=>logger,woe:async(targets,fn)=>{for(const target of targets)await fn(target)},Ooe,Doe:async()=>[],fl:async()=>false,dl,s:{vn:class extends Error{}}});
  await dispatch({automation,appServerConnection:connection,runTrigger,appVersion:'0.1.16',desktopFeatureAvailability:{workspaceDir:false},globalState:{update(){}},threadProjectAssignments:{setAssignment:unsupported,setProjectless:unsupported},settingsStore:{},appServerClient:{hostConfig:{id:'eva-local'}},requestGitWorker:unsupported,worktreeLifecycle:{},isPackaged:true,repoRoot:process.cwd()});
 }
 return {run,policy};
}
module.exports={createPrivateCron};
