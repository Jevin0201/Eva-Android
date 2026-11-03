'use strict';
// Native voice sessions join the existing history without overwriting typed drafts.
window.importVoiceThreads=function(){
 if(typeof EvaHost.voiceThreads!=='function')return;
 let entries;try{entries=JSON.parse(EvaHost.voiceThreads())}catch{return}
 let changed=false;
 for(const c of entries){if(!c.kernelThread?.id||data.chats.some(x=>x.kernelThread?.id===c.kernelThread.id))continue;data.chats.push(c);changed=true;
  kernelCall('thread/read',{threadId:c.kernelThread.id,includeTurns:true}).then(r=>{c.kernelThread=r.thread;c.running=(r.thread.turns||[]).some(t=>t.status==='inProgress');scheduleKernelSave();if(active()===c&&!settingPage)render()}).catch(()=>{});
 }
 if(entries.length){try{saveKernel();if(typeof EvaHost.voiceThreadsImported==='function')EvaHost.voiceThreadsImported(JSON.stringify(entries.map(c=>c.kernelThread?.id).filter(Boolean)));}catch{kernelNotice='语音对话保存失败，请检查存储空间';}}
 if(changed)sidebar();
};
const beforeVoiceEvent=kernelEvent;
kernelEvent=function(e){if(e.method==='android/voiceThread')importVoiceThreads();beforeVoiceEvent(e);};
const beforeVoiceOpen=window.openPhoneTask;
window.openPhoneTask=function(thread){importVoiceThreads();beforeVoiceOpen(thread);};
const beforeVoiceNavigate=navigate;
navigate=function(action){
 if(action==='voice'){
  readProviders();const c=active(),p=selectedProvider(c);
  if(!p?.model){EvaHost.open('voice');return;}
  EvaHost.voiceOpen(JSON.stringify({providerId:p.id,model:c?.model||p.model,effort:c?.effort||p.effort||'',serviceTier:c?.serviceTier||p.serviceTier||'',permissionMode:window.evaPermissions?.current(c)||'auto',projectId:c?.projectId||''}));return;
 }
 beforeVoiceNavigate(action);
};
importVoiceThreads();
