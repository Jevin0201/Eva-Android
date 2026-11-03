'use strict';
// Local EVA adapter. Kernel protocols remain marketplace/add, plugin/install,
// config/value/write and mcpServer/oauth/login (protocol/ts/v2). Standalone plugin
// archives get an explicit local marketplace wrapper; plugin contents are unmodified.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const {pipeline}=require('node:stream/promises');
const MAX_ARCHIVE=104857600,MAX_EXPANDED=268435456,MAX_FILES=10000;
function name(value){if(typeof value!=='string'||! /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(value))throw Error('名称只支持字母、数字、下划线和连字符');return value;}
function relative(value){if(typeof value!=='string'||!value||value.includes('\\')||value.includes('\0')||/^[a-zA-Z]:/.test(value)||value.startsWith('/'))throw Error('压缩包包含不安全的路径');const pieces=value.split('/');if(pieces.includes('..'))throw Error('压缩包包含越界路径');return pieces.filter(x=>x&&x!=='.').join('/');}
async function extractArchive(file,destination){
 const stat=fs.statSync(file);if(!stat.isFile()||stat.size>MAX_ARCHIVE||! /\.(zip|tar\.gz|tgz)$/i.test(file))throw Error('请选择不超过 100 MB 的 ZIP、TAR.GZ 或 TGZ 插件压缩包');
 let total=0,count=0;const seen=new Set();
 async function entry(raw,type,stream,declaredSize,permissions=0){
  const rel=relative(raw);if(!rel)return stream.resume();if(++count>MAX_FILES)throw Error('压缩包文件过多');const key=rel.normalize('NFC').toLowerCase();if(seen.has(key))throw Error('压缩包包含重名路径');seen.add(key);
  if(!['file','directory'].includes(type))throw Error('插件压缩包不支持符号链接、硬链接或特殊文件');const target=path.join(destination,rel);
  if(type==='directory'){fs.mkdirSync(target,{recursive:true});stream.resume();return;}
  if(declaredSize>MAX_EXPANDED-total)throw Error('插件解压大小超过 256 MB');fs.mkdirSync(path.dirname(target),{recursive:true});
  const meter=new (require('node:stream').Transform)({transform(chunk,_encoding,done){total+=chunk.length;if(total>MAX_EXPANDED)return done(Error('插件解压大小超过 256 MB'));done(null,chunk);}});
  await pipeline(stream,meter,fs.createWriteStream(target,{flags:'wx',mode:permissions&0o111?0o700:0o600}));
 }
 if(/\.zip$/i.test(file)){
  const archive=await require('unzipper').Open.file(file);
  for(const item of archive.files){const mode=(item.externalFileAttributes>>>16)&0xf000;if(mode&&mode!==0x8000&&mode!==0x4000)throw Error('插件压缩包包含链接或特殊文件');await entry(item.path,item.type==='Directory'?'directory':'file',item.stream(),item.uncompressedSize,item.externalFileAttributes>>>16);}
 }else{
  const archive=require('tar-stream').extract();let failure;
  archive.on('entry',(header,stream,next)=>{entry(header.name,header.type,stream,header.size,header.mode).then(()=>next(),error=>{failure=error;archive.destroy(error);});});
  try{await pipeline(fs.createReadStream(file),zlib.createGunzip(),archive);}catch(error){throw failure||error;}
 }
 return {files:count,bytes:total};
}
function pluginRoots(root){const found=[];function visit(dir,depth){if(depth>3)return;if(fs.existsSync(path.join(dir,'.codex-plugin/plugin.json'))){found.push(dir);return;}for(const item of fs.readdirSync(dir,{withFileTypes:true}))if(item.isDirectory()&&item.name!=='.git')visit(path.join(dir,item.name),depth+1);}visit(root,0);return found;}
function validateManifest(root){
 const file=path.join(root,'.codex-plugin/plugin.json'),manifest=JSON.parse(fs.readFileSync(file,'utf8'));name(manifest.name);
 // Native plugins reference content within their own root. Reject archive escapes
 // before handing the untouched manifest to the kernel's authoritative validator.
 for(const field of ['skills','mcpServers','hooks']){const values=typeof manifest[field]==='string'?[manifest[field]]:Array.isArray(manifest[field])?manifest[field]:[];for(const value of values)if(typeof value==='string')relative(value);}
 return manifest;
}
function mcpConfig(input){
 const key=name(input.name),config={enabled:true};
 if(input.config){
  if(typeof input.config!=='object'||Array.isArray(input.config))throw Error('MCP 配置格式错误');
  const value=Object.fromEntries(Object.entries(input.config).filter(([,v])=>v!==undefined)),allowed=new Set(['command','args','env','env_vars','cwd','url','bearer_token_env_var','http_headers','env_http_headers','enabled']);
  if(typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!allowed.has(k)))throw Error('MCP 配置含不支持的字段');
  if(value.url&&value.command)throw Error('MCP 地址和命令不可同时设置');
  mcpConfig({name:key,transport:value.url?'http':'stdio',url:value.url,bearerTokenEnvVar:value.bearer_token_env_var,command:value.command,args:value.args,env:value.env});
  for(const field of ['env_vars'])if(value[field]!=null&&(!Array.isArray(value[field])||value[field].some(v=>typeof v!=='string'||! /^[A-Za-z_][A-Za-z0-9_]*$/.test(v))))throw Error('环境变量名称无效');
  if(value.cwd!=null&&(typeof value.cwd!=='string'||!path.isAbsolute(value.cwd)||value.cwd.includes('\0')))throw Error('MCP 工作目录必须是绝对路径');
  for(const field of ['http_headers','env_http_headers'])if(value[field]!=null){if(typeof value[field]!=='object'||Array.isArray(value[field]))throw Error('MCP 请求头格式错误');for(const [k,v]of Object.entries(value[field]))if(!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(k)||typeof v!=='string'||/[\r\n\0]/.test(v)||(field==='env_http_headers'&&!/^[A-Za-z_][A-Za-z0-9_]*$/.test(v)))throw Error('MCP 请求头格式错误');}
  if(value.enabled!=null&&typeof value.enabled!=='boolean')throw Error('MCP enabled 必须为布尔值');
  return {name:key,config:{enabled:true,...value}};
 }
 if(input.transport==='stdio'){
  if(typeof input.command!=='string'||!input.command.trim()||/[\r\n\0]/.test(input.command))throw Error('请输入有效的 MCP 启动命令');
  if(input.args!=null&&(!Array.isArray(input.args)||input.args.some(arg=>typeof arg!=='string'||arg.includes('\0'))))throw Error('MCP 参数必须是字符串数组');config.command=input.command.trim();config.args=input.args||[];
  if(input.env){if(typeof input.env!=='object'||Array.isArray(input.env))throw Error('环境变量格式错误');config.env={};for(const [key,value]of Object.entries(input.env)){if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)||typeof value!=='string'||value.includes('\0'))throw Error('环境变量格式错误');config.env[key]=value;}}
 }else if(input.transport==='http'){
  let url;try{url=new URL(input.url);}catch{throw Error('请输入有效的 MCP 地址');}if(!['http:','https:'].includes(url.protocol)||!url.hostname||url.username||url.password||/[\s\\\x00-\x1f]/.test(input.url))throw Error('MCP 地址必须是 HTTP 或 HTTPS 且不能包含凭据');config.url=input.url.trim();
  if(input.bearerTokenEnvVar){if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(input.bearerTokenEnvVar))throw Error('令牌环境变量名称无效');config.bearer_token_env_var=input.bearerTokenEnvVar;}
 }else throw Error('不支持的 MCP 传输方式');
 return {name:key,config};
}
class LocalPluginAuthoring{
 constructor({home,request}){if(!path.isAbsolute(home)||typeof request!=='function')throw Error('本地插件配置无效');this.home=home;this.request=request;this.busy=false;}
 async addMarketplace(params){const {createPluginAddServices}=await import('../renderer/native-plugin-add/service-adapter.mjs');const services=createPluginAddServices({safeGet(){},safePost(){},headersForAccount(){}}),normalized=services.normalizeMarketplace({source:params.source,refName:params.refName||'',sparsePaths:Array.isArray(params.sparsePaths)?params.sparsePaths.join('\n'):params.sparsePaths||''});if(!normalized?.source)throw Error('请输入插件市场来源');return this.request('marketplace/add',normalized);}
 async importArchive(file){
  if(this.busy)throw Error('上一项插件导入尚未完成');this.busy=true;let stage,registered=false,currentPlugin;const installed=[];
  try{
   const base=path.join(this.home,'local-plugin-imports');fs.mkdirSync(base,{recursive:true,mode:0o700});if(fs.lstatSync(base).isSymbolicLink())throw Error('插件导入目录不可为链接');stage=fs.mkdtempSync(path.join(base,'import-'));const content=path.join(stage,'content');fs.mkdirSync(content);const extracted=await extractArchive(file,content),roots=pluginRoots(content);if(!roots.length)throw Error('压缩包中未找到 .codex-plugin/plugin.json');const manifests=roots.map(validateManifest);if(new Set(manifests.map(x=>x.name)).size!==manifests.length)throw Error('压缩包中的插件名称重复');
   const market='eva-import-'+crypto.randomBytes(6).toString('hex'),meta=path.join(stage,'.agents/plugins');fs.mkdirSync(meta,{recursive:true});fs.writeFileSync(path.join(meta,'marketplace.json'),JSON.stringify({name:market,plugins:roots.map((root,i)=>({name:manifests[i].name,source:{source:'local',path:'./'+path.relative(stage,root).split(path.sep).join('/')},policy:{installation:'AVAILABLE',authentication:'ON_USE'}}))},null,2)+'\n',{mode:0o600});
   const added=await this.request('marketplace/add',{source:stage});registered=true;const listing=await this.request('plugin/list',{marketplaceKinds:['local'],forceRefetch:true});const source=listing.marketplaces?.find(x=>x.name===market||x.name===added.marketplaceName);if(!source?.path)throw Error('内核未确认导入的插件市场');
   for(const manifest of manifests){currentPlugin=manifest.name;const result=await this.request('plugin/install',{pluginName:manifest.name,marketplacePath:source.path});installed.push({name:manifest.name,result});}
   return {marketplaceName:source.name,marketplacePath:source.path,installed,extracted};
  }catch(error){if(installed.length){const cause=error;error=new Error('插件包未全部安装：已安装 '+installed.map(x=>x.name).join('、')+'；失败插件 '+currentPlugin+'。'+cause.message,{cause});error.code='PARTIAL_PLUGIN_IMPORT';error.installedPluginNames=installed.map(x=>x.name);error.failedPluginName=currentPlugin;}if(stage&&!registered)fs.rmSync(stage,{recursive:true,force:true});throw error;}finally{this.busy=false;}
 }
 async addMcp(input){if(this.mcpBusy)throw Error('上一项 MCP 配置尚未保存');this.mcpBusy=true;try{const {name:key,config}=mcpConfig(input),current=await this.request('config/read',{includeLayers:true});if(Object.prototype.hasOwnProperty.call(current.config?.mcp_servers||{},key))throw Error('已存在同名 MCP，请在设置中编辑现有配置');
  const configPath=path.join(this.home,'config.toml'),layer=current.layers?.find(x=>x.name?.type==='user'&&x.name.file===configPath&&!x.name.profile);
  const saved=await this.request('config/value/write',{...(layer?.version?{expectedVersion:layer.version}:{}),keyPath:'mcp_servers.'+key,value:config,mergeStrategy:'replace',filePath:path.join(this.home,'config.toml')});
  let reloadError=null;try{await this.request('config/mcpServer/reload',null);}catch{reloadError='配置已保存，但 MCP 刷新失败，请在设置中重试。';}return {name:key,saved,reloadError};
 }finally{this.mcpBusy=false;}}
 // Explicit local adapter for the retained hosted creation form. No cloud identity.
 async createMcp(input){
  if(!input||typeof input.name!=='string'||!input.name.trim()||input.name.length>128)throw Error('请输入不超过 128 字符的名称');
  if(input.description!=null&&(typeof input.description!=='string'||input.description.length>4096))throw Error('说明过长');
  if(!input.target?.mcp_url||Object.keys(input.target).some(k=>k!=='mcp_url'))throw Error('本地连接仅支持服务器 URL；OpenAI 隧道尚未接入');
  if(!['NONE','OAUTH','MIXED'].includes(input.authentication))throw Error('当前本地连接不支持此认证方式');
  if(input.oauthSettings!=null)throw Error('本地内核尚不支持此页面的手动 OAuth 配置，请关闭高级设置并使用服务器自动发现');
  if(input.icon!=null)throw Error('本地 MCP 图标上传尚未接入');
  const displayName=input.name.trim(),key='eva_'+crypto.createHash('sha256').update(displayName).digest('hex').slice(0,24);
  const normalized=mcpConfig({name:key,transport:'http',url:input.target.mcp_url});
  const saved=await this.addMcp({name:key,config:normalized.config});
  const meta={id:key,name:displayName,description:input.description||'',target:{mcp_url:normalized.config.url},authentication:input.authentication,scope:'local',createdAt:new Date().toISOString()};
  const dir=path.join(this.home,'local-mcp-metadata');
  try{fs.mkdirSync(dir,{recursive:true,mode:0o700});if(fs.lstatSync(dir).isSymbolicLink())throw Error('metadata directory is symlink');fs.writeFileSync(path.join(dir,key+'.json'),JSON.stringify(meta,null,2)+'\n',{flag:'wx',mode:0o600});}
  catch{throw Error('MCP 配置已保存，但名称与说明记录失败；请到设置检查现有连接，勿重复创建');}
  return {...meta,reloadError:saved.reloadError,requiresAuthorization:input.authentication!=='NONE'};
 }
 async connectMcp(input){
  const key=name(input?.id),file=path.join(this.home,'local-mcp-metadata',key+'.json');
  const meta=JSON.parse(fs.readFileSync(file,'utf8'));
  if(meta.id!==key)throw Error('MCP 连接记录不匹配');
  if(meta.authentication==='NONE')return {id:key,authorizationRequired:false};
  const result=await this.oauth(key);
  return {id:key,authorizationRequired:true,...result};
 }
 async snapshot(){const current=await this.request('config/read',{includeLayers:false});return {scope:'local',accountRequired:false,marketplace:true,archive:true,mcp:true,mcpServerNames:Object.keys(current.config?.mcp_servers||{})};}
 async oauth(nameValue){return this.request('mcpServer/oauth/login',{name:name(nameValue),timeoutSecs:180});}
}
module.exports={LocalPluginAuthoring,extractArchive,validateManifest,mcpConfig};
