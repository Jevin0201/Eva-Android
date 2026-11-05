'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium,launchOptions}=require('./browser-test-env.cjs');
(async()=>{const browser=await chromium.launch(launchOptions());try{
 const page=await browser.newPage(),png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');let reads=0;
 const client='window.testImageRpc=(()=>{const module={exports:{}};'+fs.readFileSync('migration/eva-0.2.7-desktop/stream/original-image-rpc-core.cjs','utf8')+';return module.exports;})();';
 await page.route('https://eva.invalid/**',route=>{const path=new URL(route.request().url()).pathname;
  if(path==='/test')return route.fulfill({contentType:'text/html',body:'<script src="/desktop-stream-image-bridge.js"></script><script src="/client.js"></script>'});
  if(path==='/client.js')return route.fulfill({contentType:'text/javascript',body:client});
  if(path==='/generated-image'){reads++;return route.fulfill({contentType:'image/png',body:png});}
  return route.fulfill({contentType:'text/javascript',body:fs.readFileSync('probe/assets/desktop-stream-image-bridge.js')});
 });
 await page.goto('https://eva.invalid/test');
 const result=await page.evaluate(async()=>{
  const channel=new MessageChannel(),remote=testImageRpc.connect(channel.port1,{});
  window.postMessage({type:'connect-app-host',port:channel.port2},location.origin,[channel.port2]);
  const image=await remote.workspaceFiles.readBinary({hostId:'local',path:'/root/eva-workspace/photo.png',conversationId:'thread'});
  const tooLarge=await remote.workspaceFiles.readBinary({path:'/root/eva-workspace/photo.png',maxBytes:2});let denied=false;
  try{await remote.workspaceFiles.readBinary({path:'/root/eva-workspace/../auth.json'});}catch{denied=true;}
  EvaDesktopImageBridge.dispose();return {image,tooLarge,denied};
 });
 assert.equal(result.image.contentsBase64,png.toString('base64'));assert.equal(result.image.mimeType,'image/png');assert.equal(result.tooLarge.contentsBase64,null);assert.equal(result.denied,true);assert.equal(reads,2);
 console.log('PASS desktop original CapnWeb client/server handshake, workspace image bytes/MIME, maxBytes and traversal rejection over actual MessagePort');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
