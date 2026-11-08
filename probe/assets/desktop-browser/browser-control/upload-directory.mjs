import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

// Electron lacks Chromium's directory enumeration delegate. Load authorized
// leaf files into a temporary native input, then transfer real File objects with
// directory-relative paths to the website's directory input.
export async function uploadDirectory(page,input,directory){
 const files=[];
 const visit=folder=>{for(const entry of fs.readdirSync(folder,{withFileTypes:true})){const file=path.join(folder,entry.name);if(entry.isSymbolicLink())throw Error('上传文件夹包含符号链接，请改选实际文件夹。');if(entry.isDirectory())visit(file);else if(entry.isFile())files.push(file);if(files.length>10000)throw Error('单次目录上传最多 10000 个文件。');}};visit(directory);
 if(!files.length)throw Error('所选文件夹中没有可上传文件。');
 const marker=randomUUID(),attribute='data-rae-directory-upload';
 const previous=await input.evaluate((node,{attribute,marker})=>{const previous=node.getAttribute(attribute);node.setAttribute(attribute,marker+'-target');const temp=node.ownerDocument.createElement('input');temp.type='file';temp.multiple=true;temp.hidden=true;temp.setAttribute(attribute,marker);node.ownerDocument.documentElement.append(temp);node[marker]=temp;return previous;},{attribute,marker});
 const frame=typeof input.ownerFrame==='function'?await input.ownerFrame():await input.elementHandle().then(handle=>handle.ownerFrame());
 let cdp;try{cdp=await page.context().newCDPSession(frame);}catch{cdp=await page.context().newCDPSession(page);}
 try{
  await cdp.send('DOM.getDocument',{depth:-1,pierce:true});
  const search=await cdp.send('DOM.performSearch',{query:`[${attribute}="${marker}"]`,includeUserAgentShadowDOM:true});
  try{
   if(search.resultCount!==1)throw Error('目录上传控件已变化，请重新选择文件夹。');
   const {nodeIds}=await cdp.send('DOM.getSearchResults',{searchId:search.searchId,fromIndex:0,toIndex:1});
   await cdp.send('DOM.setFileInputFiles',{nodeId:nodeIds[0],files});
  }finally{await cdp.send('DOM.discardSearchResults',{searchId:search.searchId}).catch(()=>{});}
  const expected=files.map(file=>({name:path.basename(file),size:fs.statSync(file).size,relative:path.join(path.basename(directory),path.relative(directory,file)).replaceAll('\\','/')}));
  const target=await cdp.send('DOM.performSearch',{query:`[${attribute}="${marker}-target"]`,includeUserAgentShadowDOM:true});
  try{
   if(target.resultCount!==1)throw Error('目录上传控件已变化。');
   const {nodeIds}=await cdp.send('DOM.getSearchResults',{searchId:target.searchId,fromIndex:0,toIndex:1});
   const {object}=await cdp.send('DOM.resolveNode',{nodeId:nodeIds[0]});
   // File expandos are world-local: preserve directory paths in the site's main
   // execution world, not Playwright's isolated utility world.
   const result=await cdp.send('Runtime.callFunctionOn',{objectId:object.objectId,functionDeclaration:function(expected,marker){
    const node=this,view=node.ownerDocument.defaultView,temp=node.ownerDocument.querySelector(`[data-rae-directory-upload="${marker}"]`),source=[...temp.files];
    if(source.length!==expected.length||source.some((file,i)=>file.name!==expected[i].name||file.size!==expected[i].size))throw Error('目录文件读取不完整，未替换原有附件。');
    const transfer=new view.DataTransfer();
    for(let i=0;i<source.length;i++){const file=new view.File([source[i]],source[i].name,{type:source[i].type,lastModified:source[i].lastModified});Object.defineProperty(file,'webkitRelativePath',{value:expected[i].relative,configurable:true});transfer.items.add(file);}
    node.files=transfer.files;
    for(let i=0;i<node.files.length;i++)Object.defineProperty(node.files[i],'webkitRelativePath',{value:expected[i].relative,configurable:true});
    const metadata=[...node.files].map(f=>({name:f.name,size:f.size,type:f.type,relativePath:f.webkitRelativePath}));
    node.dispatchEvent(new view.Event('input',{bubbles:true,composed:true}));node.dispatchEvent(new view.Event('change',{bubbles:true}));return metadata;
   }.toString(),arguments:[{value:expected},{value:marker}],returnByValue:true});
   if(result.exceptionDetails)throw Error('目录上传失败：'+(result.exceptionDetails.exception?.description||result.exceptionDetails.text));
   return result.result.value;
  }finally{await cdp.send('DOM.discardSearchResults',{searchId:target.searchId}).catch(()=>{});}
 }finally{
  await input.evaluate((node,{marker,attribute,previous})=>{node[marker]?.remove();delete node[marker];if(previous===null)node.removeAttribute(attribute);else node.setAttribute(attribute,previous);},{marker,attribute,previous}).catch(()=>{});await cdp.detach().catch(()=>{});
 }
}
