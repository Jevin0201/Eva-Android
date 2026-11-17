const {execFileSync}=require('child_process');
const {chromium}=require('playwright-core');
const fs=require('fs'),assert=require('assert/strict');
const adb='D:/Codex/模拟器/tools/android/platform-tools/adb.exe';
const run=(...a)=>execFileSync(adb,['-s','509655c7',...a],{encoding:'utf8'}).trim();
(async()=>{let browser,port;try{
 const pid=run('shell','pidof','ai.eva.android.acceptance').split(' ')[0];
 port=run('forward','tcp:0','localabstract:webview_devtools_remote_'+pid);
 browser=await chromium.connectOverCDP('http://127.0.0.1:'+port);
 const p=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().startsWith('https://eva.invalid/index.html'));
 assert(p);const before=await p.evaluate(()=>data.active);
 await p.evaluate(()=>{settingsGo('settings');navigate('settings-back');});
 const report=[];
 for(const how of ['system','header','gesture']){
  await p.evaluate(()=>{settingsGo('plugins');settingsGo('skills');settingsGo('mcp');settingsGo('plugins');settingsGo('mcp');});
  await p.waitForSelector('#mcp-page');
  if(how==='system')run('shell','input','keyevent','4');
  else if(how==='gesture'){
   const sizes=[...run('shell','wm','size').matchAll(/(\d+)x(\d+)/g)];const [w,h]=sizes.at(-1).slice(1).map(Number);
   run('shell','input','swipe',String(w-3),String(Math.round(h/2)),String(Math.round(w*.7)),String(Math.round(h/2)),'250');
  }else await p.locator('[data-action="desktop-extensions-back"]').click();
  await p.waitForFunction(()=>settingPage===null);
  assert.equal(await p.evaluate(()=>data.active),before);
  report.push(how+': repeated extension tabs → chat in one back');
 }
 await p.evaluate(()=>{settingsGo('settings');settingsGo('plugins');settingsGo('skills');settingsGo('mcp');});
 run('shell','input','keyevent','4');await p.waitForFunction(()=>settingPage==='settings');
 run('shell','input','keyevent','4');await p.waitForFunction(()=>settingPage===null);
 report.push('settings entry → settings → chat');
 await p.evaluate(()=>{settingsGo('settings');settingsGo('browser');settingsGo('permissions');settingsGo('appearance');});
 run('shell','input','keyevent','4');await p.waitForFunction(()=>settingPage==='settings');
 await p.evaluate(()=>navigate('settings-back'));await p.waitForFunction(()=>settingPage===null);
 report.push('sibling settings → settings, no operation replay');
 assert.equal(await p.evaluate(()=>data.active),before);
 fs.mkdirSync('artifacts/navigation-hierarchy-20261117',{recursive:true});fs.writeFileSync('artifacts/navigation-hierarchy-20261117/device.json',JSON.stringify(report,null,2));console.log(report.join('\n'));
}finally{if(browser)await browser.close();if(port)run('forward','--remove','tcp:'+port);}})().catch(e=>{console.error(e);process.exitCode=1});
