'use strict';
// Preserve the pinned vendor bundle and existing Android adaptations. Regenerate
// only the original adapter's clipboard binding, guarded by unique anchors.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const bundle=path.join(root,'probe/assets/desktop-stream/native-steering/bundle.js');
let text=fs.readFileSync(bundle,'utf8');
const newline=text.includes('\r\n')?'\r\n':'\n';text=text.replace(/\r\n/g,'\n');
const marker='// src/renderer/native-steering/adapter.jsx\nvar combinedMessages =';
assert.equal(text.split(marker).length,2,'unique native adapter boundary');
const at=text.indexOf(marker),prefix=text.slice(0,at);
let adapter=text.slice(at);
const begin='// BEGIN EVA ANDROID CLIPBOARD HOST',end='// END EVA ANDROID CLIPBOARD HOST';
const helper=begin+'\n'+fs.readFileSync(path.join(root,'migration/desktop-steering/clipboard-host.js'),'utf8').trim()+'\n'+end+'\n';
if(adapter.includes(begin)){
 assert.equal(adapter.split(begin).length,2);assert.equal(adapter.split(end).length,2);
 const first=adapter.indexOf(begin),last=adapter.indexOf(end)+end.length;
 adapter=adapter.slice(0,first)+helper.trimEnd()+adapter.slice(last);
}else{
 assert.equal(adapter.split('function initialize() {').length,2);
 adapter=adapter.replace('function initialize() {',helper+'function initialize() {');
}
const old=`writeClipboard: async (payload) => {
    try {
      if (typeof payload === "string") await navigator.clipboard.writeText(payload);
      else await navigator.clipboard.write([new ClipboardItem(Object.fromEntries(Object.entries(payload).map(([type, text]) => [type, new Blob([text], { type })])))]);
      return true;
    } catch (error) {
      console.error("Message clipboard write failed:", error);
      return false;
    }
  }`;
const binding='writeClipboard: writeAndroidMessageClipboard';
if(!adapter.includes(binding)){
 assert.equal(adapter.split(old).length,2,'original message clipboard callback must match');
 adapter=adapter.replace(old,binding);
}else assert.equal(adapter.split(binding).length,2);
fs.writeFileSync(bundle,(prefix+adapter).replace(/\n/g,newline));
const rpc='rpc-7528198897e2.js';
fs.copyFileSync(path.join(root,'migration/desktop-steering',rpc),path.join(root,'probe/assets/desktop-stream/native-steering',rpc));
console.log('Generated Android message clipboard binding and Markdown lazy clipboard module');
