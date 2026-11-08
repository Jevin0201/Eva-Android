'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const idPattern=/^br_[a-f0-9-]{36}$/;
class BrowserResultStore{
 constructor(root,{maxBytes=512*1024*1024,maxAgeMs=7*86400000,maintenanceIntervalMs=60000,now=Date.now}={}){
  if(!Number.isFinite(maxBytes)||maxBytes<1||!Number.isFinite(maxAgeMs)||maxAgeMs<0||!Number.isFinite(maintenanceIntervalMs)||maintenanceIntervalMs<0)throw Error('浏览器结果保留配置无效');
  this.root=path.resolve(root);this.maxBytes=maxBytes;this.maxAgeMs=maxAgeMs;this.maintenanceIntervalMs=maintenanceIntervalMs;this.now=now;this.lastMaintenance=-Infinity;this.writtenBytes=0;
 }
 directory(session){
  if(typeof session!=='string'||!session)throw Error('缺少浏览器会话标识');
  return path.join(this.root,crypto.createHash('sha256').update(session).digest('hex'));
 }
 save(session,value,details={}){
  const text=JSON.stringify(value),directory=this.directory(session),resultID='br_'+crypto.randomUUID();
  const bytes=Buffer.byteLength(text);
  if(bytes>Math.min(64*1024*1024,this.maxBytes))throw Error('浏览器结果超过单条保留上限，请定点查询');
  fs.mkdirSync(directory,{recursive:true});
  const file=path.join(directory,resultID+'.json'),temporary=file+'.tmp';
  try{fs.writeFileSync(temporary,text,{encoding:'utf8',flag:'wx',mode:0o600});fs.renameSync(temporary,file);}finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
  const retained={resultID,persisted:true,totalChars:text.length,sha256:crypto.createHash('sha256').update(text).digest('hex')};
  const metadata={format:'eva-browser-result/1',...retained,bytes,at:this.now(),url:typeof value?.url==='string'?value.url:undefined,title:typeof value?.title==='string'?value.title.slice(0,200):undefined,tool:details.tool};
  const meta=file+'.meta';try{fs.writeFileSync(meta+'.tmp',JSON.stringify(metadata),{flag:'wx',mode:0o600});fs.renameSync(meta+'.tmp',meta);}finally{if(fs.existsSync(meta+'.tmp'))fs.unlinkSync(meta+'.tmp');}
  this.writtenBytes+=bytes;
  if(this.now()-this.lastMaintenance>=this.maintenanceIntervalMs||this.writtenBytes>=64*1024*1024)this.maintain(resultID);
  return retained;
 }
 records(){
  const rows=[];
  for(const directory of fs.readdirSync(this.root,{withFileTypes:true})){
   if(!directory.isDirectory()||directory.isSymbolicLink()||!/^[a-f0-9]{64}$/.test(directory.name))continue;
   const base=path.join(this.root,directory.name);
   for(const file of fs.readdirSync(base)){
    if(!file.endsWith('.json.meta')||!idPattern.test(file.slice(0,-10)))continue;
    try{const meta=JSON.parse(fs.readFileSync(path.join(base,file),'utf8')),raw=path.join(base,file.slice(0,-5));if(meta.format==='eva-browser-result/1'&&meta.resultID===file.slice(0,-10)&&fs.lstatSync(raw).isFile()&&!fs.lstatSync(raw).isSymbolicLink())rows.push({...meta,file:raw});}catch{}
   }
  }
  return rows;
 }
 maintain(protectedID){
  const lock=path.join(this.root,'.maintenance.lock');let descriptor;
  try{descriptor=fs.openSync(lock,'wx',0o600);}catch(error){if(error.code==='EEXIST'){try{if(this.now()-fs.statSync(lock).mtimeMs>300000)fs.unlinkSync(lock);}catch{}return;}throw error;}
  try{
   const rows=this.records().sort((a,b)=>a.at-b.at),now=this.now();let total=rows.reduce((sum,row)=>sum+row.bytes,0);
   for(const row of rows){
    if(row.resultID===protectedID||now-row.at<=this.maxAgeMs&&total<=this.maxBytes)continue;
    const relative=path.relative(this.root,path.resolve(row.file));if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('浏览器结果清理路径无效');
    try{
     const bytes=fs.readFileSync(row.file);if(crypto.createHash('sha256').update(bytes).digest('hex')!==row.sha256)continue;
     fs.unlinkSync(row.file);fs.unlinkSync(row.file+'.meta');total-=row.bytes;
    }catch(error){if(error.code!=='ENOENT')throw error;}
   }
   this.lastMaintenance=now;this.writtenBytes=0;
  }finally{fs.closeSync(descriptor);try{fs.unlinkSync(lock);}catch(error){if(error.code!=='ENOENT')throw error;}}
 }
 read(session,command){
  if(!idPattern.test(command.resultID||''))throw Error('浏览器结果标识无效');
  let text;try{text=fs.readFileSync(path.join(this.directory(session),command.resultID+'.json'),'utf8');}catch(error){if(error.code==='ENOENT')throw Error('结果不存在或不属于当前浏览器会话');throw error;}
  const offset=command.offset??0,limit=command.maxResponseChars??6000;
  if(!Number.isInteger(offset)||offset<0||offset>text.length||!Number.isInteger(limit)||limit<1||limit>50000)throw Error('浏览器结果分页参数无效');
  const next=Math.min(offset+limit,text.length);
  return {resultID:command.resultID,persisted:true,format:'json',text:text.slice(offset,next),offset,nextOffset:next<text.length?next:null,totalChars:text.length,complete:next===text.length};
 }
 list(session,command={}){
  const directory=this.directory(session),offset=command.offset??0,limit=command.limit??20;
  if(!Number.isInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>100)throw Error('浏览器结果索引分页参数无效');
  let files;try{files=fs.readdirSync(directory).filter(file=>idPattern.test(file.slice(0,-5))&&file.endsWith('.json'));}catch(error){if(error.code==='ENOENT')return {records:[],total:0,nextOffset:null};throw error;}
  const rows=files.flatMap(file=>{try{const meta=JSON.parse(fs.readFileSync(path.join(directory,file+'.meta'),'utf8'));if(meta.format!=='eva-browser-result/1')return [];const {resultID,bytes,at,url,title,tool}=meta;return [{resultID,bytes,at,url,title,tool}];}catch{return [];}}).sort((a,b)=>b.at-a.at||a.resultID.localeCompare(b.resultID));
  return {records:rows.slice(offset,offset+limit),total:rows.length,nextOffset:offset+limit<rows.length?offset+limit:null};
 }
}
function projectBrowserResult(value,retained,{maxOutputChars=20000}={}){
 if(!value||typeof value!=='object'||Array.isArray(value))return {value,...retained};
 // Capability results already own their paging and late-operation pointers.
 // Persist their wrapper separately without replacing that protocol's fields.
 if(typeof value.resultID==='string'||typeof value.operationID==='string')return {...value,retainedResult:retained};
 const output={...value,...retained},changes=value.changes;
 if(changes){
  const fullText=changes.addedTruncated===true||value.snapshot?.nextTextOffset!==undefined&&!!(changes.url||changes.title)||changes.changed===true&&changes.controlsChanged!==true&&changes.scrolled!==true&&(!Array.isArray(changes.added)||!changes.added.length);
  output.changes={...changes,removed:undefined,removedCount:changes.removed?.length};
  if(fullText&&value.text)output.changes.added=undefined;
  else delete output.text;
  if(changes.changed===false)delete output.refs;
 }
 if(value.document){output.document={complete:false,sourceComplete:value.document.complete,blocksCount:value.document.blocks?.length,retained:true};}
 output.projection={textIncluded:typeof output.text==='string',refsIncluded:Array.isArray(output.refs),fullResultRetained:true};
 if(value.snapshot)output.snapshot={...value.snapshot,sourceTextComplete:value.snapshot.textComplete,sourceRefsComplete:value.snapshot.refsComplete,textComplete:typeof output.text==='string'&&value.snapshot.textComplete===true,refsComplete:Array.isArray(output.refs)&&value.snapshot.refsComplete===true,complete:typeof output.text==='string'&&Array.isArray(output.refs)&&value.snapshot.complete===true};
 if(JSON.stringify(output).length<=maxOutputChars)return output;
 if(typeof output.text==='string'&&output.text.length>6000){output.text=output.text.slice(0,6000);output.projection.textTruncated=true;if(output.snapshot){output.snapshot.textComplete=false;output.snapshot.complete=false;}}
 if(Array.isArray(output.refs)){
  output.refs=output.refs.slice();
  while(output.refs.length&&JSON.stringify(output).length>maxOutputChars)output.refs.pop();
  if(output.refs.length!==value.refs.length){output.projection={...output.projection,refsTruncated:true,returnedRefs:output.refs.length,totalRefs:value.refs.length};if(output.snapshot){output.snapshot.refsComplete=false;output.snapshot.complete=false;}}
 }
 if(JSON.stringify(output).length<=maxOutputChars)return output;
 return {tabId:value.tabId,url:value.url,title:value.title,execution:value.execution,...retained,projection:{fullResultRetained:true,truncated:true},summary:'完整浏览器结果已保留，请使用 browser_result 按 resultID 分页读取。'};
}
function browserCommandTimeout(name,command){
 if(name==='browser_dialog')return 2500;
 const requested=Number.isFinite(command?.timeoutMs)?Math.min(60000,Math.max(0,command.timeoutMs)):0;
 const expected=Number.isFinite(command?.expect?.timeoutMs)?Math.min(25000,Math.max(0,command.expect.timeoutMs)):0;
 return Math.max(35000,requested+expected+20000);
}
module.exports={BrowserResultStore,projectBrowserResult,browserCommandTimeout};
