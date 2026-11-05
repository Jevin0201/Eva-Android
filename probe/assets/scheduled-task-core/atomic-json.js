'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function readJson(file,fallback){
 try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch(error){
  if(error.code==='ENOENT')return structuredClone(fallback);
  try{const recovered=JSON.parse(fs.readFileSync(file+'.bak','utf8'));console.warn('配置已从有效备份恢复：'+path.basename(file));return recovered;}catch{}
  throw Error('配置文件损坏且没有有效备份：'+path.basename(file));
 }
}
function writeJson(file,value){
 fs.mkdirSync(path.dirname(file),{recursive:true});
 const temp=file+'.'+process.pid+'.'+crypto.randomBytes(5).toString('hex')+'.tmp';
 try{
  const fd=fs.openSync(temp,'wx',0o600);try{fs.writeFileSync(fd,JSON.stringify(value,null,2),'utf8');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  if(fs.existsSync(file)){try{JSON.parse(fs.readFileSync(file,'utf8'));fs.copyFileSync(file,temp+'.bak');fs.renameSync(temp+'.bak',file+'.bak');}catch(error){if(!(error instanceof SyntaxError))throw error;}}
  fs.renameSync(temp,file);
 }finally{for(const p of [temp,temp+'.bak'])if(fs.existsSync(p))fs.unlinkSync(p);}
 return value;
}
module.exports={readJson,writeJson};
