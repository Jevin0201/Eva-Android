const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {spawn}=require('node:child_process'),{once}=require('node:events'),readline=require('node:readline');
const {chromium,launchOptions}=require('./browser-test-env.cjs');
(async()=>{
 const dir=fs.mkdtempSync(path.resolve('artifacts/browser-recovery-'));
 let browser,worker,server;
 try{
  browser=await chromium.launchPersistentContext(path.join(dir,'profile'),{...launchOptions(),args:['--remote-debugging-port=0']});
  const p=browser.pages()[0];await p.setContent('<h1>Fixture course list</h1><input type=password aria-label="Password"><button onclick="window.clicks=(window.clicks||0)+1">Continue</button>');
  await p.evaluate(()=>window.__evaNativeTab='fixture');
  const devPort=Number(fs.readFileSync(path.join(dir,'profile','DevToolsActivePort'),'utf8').split(/\r?\n/)[0]);
  const dev=await (await fetch('http://127.0.0.1:'+devPort+'/json/version')).json();
  let unavailable=true;
  server=http.createServer((req,res)=>{
   const answer=(code,v)=>{const b=JSON.stringify(v);res.writeHead(code,{'Content-Type':'application/json','Content-Length':Buffer.byteLength(b)});res.end(b);};
   if(req.url==='/host'){req.resume();answer(200,{active:'fixture',tabs:[{id:'fixture',title:'Fixture',url:'about:blank'}]});}
   else if(req.url==='/json/version')answer(unavailable?503:200,dev);
   else answer(404,{error:'Unexpected fixture route'});
  });
  const net=require('node:net');
  server.on('upgrade',(req,socket,head)=>{
   const tunnel=net.connect(devPort,'127.0.0.1',()=>{
    tunnel.write(req.method+' '+req.url+' HTTP/1.1\r\n'+req.rawHeaders.reduce((s,h,i)=>i%2?s+h+'\r\n':s+h+': ','')+'\r\n');
    if(head.length)tunnel.write(head);socket.pipe(tunnel).pipe(socket);
   });
   tunnel.on('error',()=>socket.destroy());socket.on('error',()=>tunnel.destroy());socket.once('close',()=>tunnel.destroy());
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  worker=spawn(process.execPath,['probe/assets/desktop-browser/android-worker.mjs','http://127.0.0.1:'+server.address().port],{env:{...process.env,EVA_BROWSER_ROOT:dir}});
  worker.stderr.pipe(process.stderr);
  const pending=new Map();let next=0;
  readline.createInterface({input:worker.stdout}).on('line',line=>{
   const value=JSON.parse(line),call=pending.get(value.id);if(!call)return;
   if(value.stage){call.stages.push(value.stage);return;}
   pending.delete(value.id);clearTimeout(call.timer);call.resolve({...value,stages:call.stages});
  });
  function call(tool,args={}){
   return new Promise((resolve,reject)=>{
    const id=String(++next),timer=setTimeout(()=>{pending.delete(id);reject(Error(tool+' did not return a terminal reply'));},15000);
    pending.set(id,{resolve,timer,stages:[]});
    worker.stdin.write(JSON.stringify({id,session:'fixture',tool,args})+'\n');
   });
  }
  const unavailableRead=await call('browser_cdp',{method:'Page.getFrameTree'});
  assert.match(unavailableRead.error,/503/);assert(unavailableRead.stages.includes('发现 WebView 调试端点'));
  unavailable=false;
  const recovered=await call('browser_cdp',{method:'Page.getFrameTree'});
  assert.ifError(recovered.error);assert(JSON.stringify(recovered.result).includes('frameTree'));
  assert(recovered.stages.includes('匹配当前浏览器标签'));
  const snapshot=await call('browser_snapshot');assert.ifError(snapshot.error);
  assert(JSON.stringify(snapshot.result).includes('Fixture course list'));
  const testPassword='test-only-browser-password';
  const acted=await call('browser_act',{steps:[{action:'type',selector:'input',text:testPassword},{action:'click',selector:'button'}]});
  assert.ifError(acted.error);assert.equal(await p.evaluate(()=>window.clicks),1);
  assert.equal(await p.locator('input').inputValue(),testPassword);
  const after=await call('browser_snapshot');assert.ifError(after.error);
  assert(!JSON.stringify(after.result).includes(testPassword),'snapshot must omit password value');
  console.log('PASS endpoint failure diagnostic; recovered CDP read; snapshot and password masking; batched input and single click');
 }finally{
  if(worker&&worker.exitCode===null&&worker.signalCode===null){const exited=once(worker,'exit');worker.kill();await exited;}
  server?.closeAllConnections();server?.close();await browser?.close();
  const real=fs.realpathSync(dir),base=fs.realpathSync('artifacts');
  if(path.dirname(real)===base&&path.basename(real).startsWith('browser-recovery-'))fs.rmSync(real,{recursive:true,maxRetries:3,retryDelay:100});
 }
})().catch(error=>{console.error(error);process.exitCode=1});
