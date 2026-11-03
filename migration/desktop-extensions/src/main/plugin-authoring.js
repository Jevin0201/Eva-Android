'use strict';
// EVA-owned transport adapter for the retained plugin creation functions.
// Routes/payloads: native-plugin-add/provenance.json. Credentials never cross IPC.
const fs=require('node:fs'),path=require('node:path');
const GATES=['2911503418','2712711964','521320455','1355972088','2401070674','1663164947'];
const GET=new Set(['/wham/accounts/check','/settings/user','/accounts/{account_id}/settings','/aip/connectors/mcp/tunnels','/aip/connectors/oauth_clients','/ps/plugins/workspace/created','/ps/plugins/canonical-app/{app_id}','/aip/connectors/{connector_id}','/aip/connectors/{connector_id}/link']);
const POST=new Set(['/aip/connectors/mcp/oauth_config','/aip/connectors/mcp','/public/plugins/workspace/upload-url','/public/plugins/workspace','/public/plugins/workspace/{plugin_id}']);
class PluginHttpError extends Error {constructor(status,message='插件服务请求失败',code){super(message);this.name='PluginHttpError';this.status=status;this.errorCode=code;}}
const identity=value=>{if(typeof value!=='string'||!value||value.length>300||/[\s/\\?#\x00-\x1f]/.test(value))throw Error('无效的插件服务标识');return value;};
function endpoint(method,route,options={}){
 if(!(method==='GET'?GET:POST).has(route))throw Error('不允许的插件接口');
 let result=route.replace(/\{(\w+)\}/g,(_,key)=>encodeURIComponent(identity(options.parameters?.path?.[key])));
 const query=options.parameters?.query||{},allowed=route==='/aip/connectors/oauth_clients'?['service']:route==='/ps/plugins/workspace/created'?['limit','pageToken']:[];
 const search=new URLSearchParams();for(const [key,value]of Object.entries(query)){if(!allowed.includes(key))throw Error('不允许的插件查询参数');if(value!=null){if(typeof value!=='string'&&typeof value!=='number')throw Error('无效的插件查询参数');if(String(value).length>4096)throw Error('插件查询参数过长');search.set(key,String(value));}}
 return result+(search.size?'?'+search:'');
}
class PluginAuthoring {
 constructor({content,readGates}){if(!content?.authorization||!content?.fetch)throw Error('EVA 账号服务不可用');this.content=content;this.readGates=readGates;this.uploadSessions=new Map();}
 async auth(expectedAccount,expectedScope){const auth=await this.content.authorization(),accountId=Object.entries(auth.headers).find(([key])=>key.toLowerCase()==='chatgpt-account-id')?.[1];if(!accountId)throw Error('登录账号缺少工作区标识，请重新登录');if(expectedAccount&&accountId!==expectedAccount||expectedScope&&auth.scope!==expectedScope)throw Error('账号已切换，插件操作已停止');return {...auth,accountId};}
 async request(method,route,options={},binding={}){
  const target=endpoint(method,route,options),auth=await this.auth(binding.accountId,binding.scope);
  for(const [key,value]of Object.entries(options.additionalHeaders||{})){if(key.toLowerCase()==='chatgpt-account-id'){if(value!==auth.accountId)throw Error('不能访问其他账号的插件');}else if(key.toLowerCase()==='x-openai-product-context'){if(value!=='CODEX')throw Error('无效的产品上下文');}else throw Error('不允许的插件请求头');}
  if(route==='/accounts/{account_id}/settings'&&options.parameters?.path?.account_id!==auth.accountId)throw Error('不能访问其他账号的工作区');
  const body=options.requestBody;if(body!==undefined&&JSON.stringify(body).length>1048576)throw Error('插件配置过大');
  const surface=options.surface||'plugin_management';if(!['plugin_management','other','connector_setup'].includes(surface))throw Error('无效的插件调用来源');
  let response;try{response=await this.content.fetch(this.content.origin+'/backend-api'+target,{method,headers:{...auth.headers,'content-type':'application/json','X-Codex-Surface':surface,...options.additionalHeaders?.['x-openai-product-context']?{'x-openai-product-context':'CODEX'}:{}},body:method==='POST'?JSON.stringify(body||{}):undefined,redirect:'error',signal:AbortSignal.timeout(30000)});}catch{const error=new PluginHttpError(0,'插件服务连接失败，请重试');error.errorKind='network';throw error;}
  await this.auth(auth.accountId,auth.scope);
  if(!response.ok){let code;try{const data=await response.json();const candidate=data.error?.code||data.detail?.error_code||data.code;if(typeof candidate==='string'&&/^[a-zA-Z0-9_.-]{1,100}$/.test(candidate))code=candidate;}catch{}throw new PluginHttpError(response.status,'插件服务请求失败（'+response.status+'）',code);}
  const data=response.status===204?{}:await response.json();
  if(route==='/public/plugins/workspace/upload-url'&&data.upload_url){this.uploadSessions.set(data.upload_url,{scope:auth.scope,accountId:auth.accountId,fileId:data.file_id,size:body?.size_bytes,name:body?.filename,mime:body?.mime_type,expires:Date.now()+300000});}
  return data;
 }
 async snapshot(){
  const auth=await this.auth(),binding={accountId:auth.accountId,scope:auth.scope},errors=[];
  const values=await Promise.allSettled([this.request('GET','/wham/accounts/check',{},binding),this.request('GET','/settings/user',{},binding),this.request('GET','/accounts/{account_id}/settings',{parameters:{path:{account_id:auth.accountId}}},binding)]);
  const [accounts,settings,workspaceSettings]=values.map((r,i)=>{if(r.status==='fulfilled')return r.value;errors.push({part:['accounts','settings','workspaceSettings'][i],message:r.reason.message});return null;});
  // Account response shapes are preserved; only select an exact id match.
  const candidates=Array.isArray(accounts)?accounts:Array.isArray(accounts?.accounts)?accounts.accounts:Object.values(accounts?.accounts||{});
  const entry=candidates.find(value=>value?.id===auth.accountId||value?.account?.id===auth.accountId),account=entry?.account||entry||null;
  let facts=null;if(this.readGates){try{facts=await this.readGates(binding);}catch{errors.push({part:'gates',message:'账号功能开关尚未读取'});}}
  await this.auth(auth.accountId,auth.scope);
  const gates={},readyGates=[];if(facts?.accountId===auth.accountId&&facts?.scope===auth.scope){for(const key of GATES)if(typeof facts.gates?.[key]==='boolean'){gates[key]=facts.gates[key];readyGates.push(key);}}
  return {accountId:auth.accountId,scope:auth.scope,account,settings,workspaceSettings,gates,readyGates,statsigWorkspaceId:facts?.accountId===auth.accountId?facts.workspaceId:undefined,capabilitiesReady:!!account&&!!settings&&GATES.every(key=>readyGates.includes(key)),errors};
 }
 async connectorStatus(connectorId,binding){identity(connectorId);const opts={surface:'connector_setup',parameters:{path:{connector_id:connectorId}},additionalHeaders:{'x-openai-product-context':'CODEX'}};const [connector,link]=await Promise.all([this.request('GET','/aip/connectors/{connector_id}',opts,binding),this.request('GET','/aip/connectors/{connector_id}/link',opts,binding)]);return {connector,link,ready:link?.auth_status==='ACTIVE'};}
 transport(binding){return {safeGet:(route,options)=>this.request('GET',route,options,binding),safePost:(route,options)=>this.request('POST',route,options,binding),HttpError:PluginHttpError,headersForAccount:accountId=>({'ChatGPT-Account-Id':accountId}),uploadChatGptFileBytes:(_unused,input)=>this.uploadBytes(input,binding)};}
 async uploadBytes({fileId,file,fileName,contentType,uploadUrl},binding={}){
  const auth=await this.auth(binding.accountId,binding.scope),session=this.uploadSessions.get(uploadUrl);
  if(!session||session.expires<Date.now()||session.scope!==auth.scope||session.fileId!==fileId||session.name!==fileName||session.size!==file.size)throw Error('上传会话已失效，请重新选择压缩包');
  const target=new URL(uploadUrl,this.content.origin),estuary=target.pathname.includes('/estuary/'),aws=[...target.searchParams.keys()].some(key=>key.toLowerCase()==='x-amz-algorithm');
  // The original PWr(undefined,...) follows FWr: no multipart or retry gate.
  // Native fetch replaces its XHR upload boundary. Never forward account headers
  // to a signed external blob destination, nor follow redirects with file bytes.
  let method='PUT',headers,body;
  if(estuary){throw Error('此上传地址需要 Estuary 传输，当前尚未绑定；未发送文件内容');}
  if(target.protocol!=='https:'||!['blob.core.windows.net','oaiusercontent.com','amazonaws.com'].some(domain=>target.hostname===domain||target.hostname.endsWith('.'+domain)))throw Error('不支持的插件上传来源');
  headers={'Content-Type':contentType||'application/octet-stream',...aws?{}:{'x-ms-blob-type':'BlockBlob','x-ms-version':'2020-04-08',...contentType?{'x-ms-blob-content-type':contentType}:{}}};
  body=Buffer.from(await file.arrayBuffer());if(body.length!==session.size)throw Error('文件在上传前发生变化');await this.auth(auth.accountId,auth.scope);
  let response;try{response=await this.content.uploadFetch(target.href,{method,headers,body,redirect:'error',signal:AbortSignal.timeout(120000)});}catch{throw new PluginHttpError(0,'插件文件上传失败，请重试');}await this.auth(auth.accountId,auth.scope);if(!response.ok)throw new PluginHttpError(response.status,'插件文件上传失败（'+response.status+'）');this.uploadSessions.delete(uploadUrl);
 }
 async uploadArchive(filePath,binding){
  // Call only with a main-process native file-dialog result, never a renderer path.
  if(typeof filePath!=='string'||!path.isAbsolute(filePath))throw Error('请选择插件压缩包');const stat=fs.statSync(filePath);if(!stat.isFile()||stat.size>104857600||! /\.(zip|tar\.gz|tgz)$/i.test(filePath))throw Error('请选择不超过 100 MB 的 ZIP、TAR.GZ 或 TGZ 文件');
  const auth=await this.auth(binding?.accountId,binding?.scope),bytes=fs.readFileSync(filePath);if(bytes.length!==stat.size)throw Error('文件发生变化，请重新选择');const file=new File([bytes],path.basename(filePath));
  const {createPluginAddServices}=await import('../renderer/native-plugin-add/service-adapter.mjs');return createPluginAddServices(this.transport({accountId:auth.accountId,scope:auth.scope})).uploadArchive(auth.accountId,file);
 }
}
module.exports={PluginAuthoring,PluginHttpError,endpoint};
