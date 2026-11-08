'use strict';
// Back up and freeze the composer before replacing the APK. Any failure aborts here.
const fs=require('fs'),path=require('path'),cp=require('child_process');
function assertIdle(state){if(state.busy||state.running||state.pending)throw Error('仍有发送或任务正在进行，已取消安装');}
function assertRuntimeIdle(run,pkg){for(const name of ['RuntimeSetupService','TaskExecutionService']){const state=run(['shell','dumpsys','activity','services',pkg+'/.'+name]);if(/isForeground=true/.test(state))throw Error('任务、排版或组件安装仍在进行，已取消会重启应用的操作');}}
async function main(){
 const adb=process.env.EVA_ADB;if(!adb)throw Error('Set EVA_ADB to the Android platform-tools adb path');
 const apk=path.resolve(process.argv[2]||'probe/build/macos/eva-upgrade.apk');if(!fs.existsSync(apk))throw Error('Signed APK does not exist');
 const run=args=>cp.execFileSync(adb,args,{encoding:'utf8'}),pkg='ai.eva.android.probe';
 assertRuntimeIdle(run,pkg);
 const pid=run(['shell','pidof',pkg]).trim().split(/\s+/)[0];try{run(['forward','--remove','tcp:9223'])}catch{}run(['forward','tcp:9223','localabstract:webview_devtools_remote_'+pid]);
 const {chromium}=require('playwright-core');const browser=await chromium.connectOverCDP('http://127.0.0.1:9223');let page,locked=false;
 try{
  page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url()==='https://eva.invalid/index.html');if(!page)throw Error('Eva chat page unavailable');await page.waitForFunction(()=>typeof kernelBusy!=='undefined'&&typeof data!=='undefined',null,{timeout:15000});
  const check=await page.evaluate(()=>({busy:kernelBusy,running:[...data.chats,...data.drafts].filter(c=>c.running).length,pending:[...data.chats,...data.drafts].filter(c=>c.pending).length}));assertIdle(check);
  const snapshot=await page.evaluate(()=>{
   if(kernelBusy||[...data.chats,...data.drafts].some(c=>c.running||c.pending))throw Error('发送状态已变化，取消安装');
   const old={send:kernelSend,navigate,refresh:refreshKernelControls,render};window.__evaUpgradeUndo=()=>{kernelSend=old.send;navigate=old.navigate;refreshKernelControls=old.refresh;render=old.render;const input=document.querySelector('#prompt');if(input)input.readOnly=false;refreshKernelControls();};
   const lock=()=>{const input=document.querySelector('#prompt');if(input)input.readOnly=true;for(const b of document.querySelectorAll('[data-task-primary],[data-action="kernel-send"],[data-action="kernel-steer"]'))b.disabled=true;if(document.querySelector('.foot'))document.querySelector('.foot').textContent='正在更新 Eva，请稍候…';};
   kernelSend=()=>{};navigate=action=>{if(action==='kernel-send'||action==='kernel-steer')return;return old.navigate(action)};refreshKernelControls=()=>{old.refresh();lock()};render=()=>{old.render();lock()};lock();
   const raw=JSON.stringify(data);if(!EvaHost.save(raw)){window.__evaUpgradeUndo();throw Error('保存失败，取消安装');}return raw;
  });locked=true;
  const folder=path.resolve('artifacts/upgrade-backups');fs.mkdirSync(folder,{recursive:true});const file=path.join(folder,Date.now()+'-before-install.json');fs.writeFileSync(file,snapshot);console.log('已保存升级前完整快照：'+file);
  const result=cp.spawnSync(adb,['install','-r',apk],{stdio:'inherit'});if(result.error)throw result.error;if(result.status!==0)throw Error('APK覆盖安装失败，未执行后续启动');
  locked=false;run(['shell','am','start','-n',pkg+'/.ShellActivity']);console.log('APK已保留数据覆盖安装并启动');
 }catch(error){if(locked&&page)try{await page.evaluate(()=>window.__evaUpgradeUndo?.())}catch{}throw error;}
 finally{await browser.close();}
}
module.exports={assertIdle,assertRuntimeIdle};if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1});
