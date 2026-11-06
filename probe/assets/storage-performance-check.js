/* Isolated on-device serialization benchmark. Uses synthetic histories only. */
(() => {
 if(!window.TestHost)return;
 window.kernelPollingEnabled=false;
 async function run(){
  try{
   const deadline=performance.now()+30000;
   while(!window.evaDesktopStream?.enabled){
    if(performance.now()>deadline)throw Error('Renderer initialization timed out');
    await new Promise(resolve=>setTimeout(resolve,50));
   }
   const conversation=active();
   conversation.draft='draft '.repeat(16000);
   data.chats.push({id:'large-inactive-history',messages:[],kernelThread:{id:'inactive',turns:[{id:'past',items:[{type:'agentMessage',text:'x'.repeat(18*1024*1024)}]}]}});
   const fullTimes=[],partialTimes=[];let fullBytes=0,partialBytes=0;
   const native=window.EvaHost;
   window.EvaHost={
    save:()=>true,
    saveLater:value=>{fullBytes=value.length;},
    saveCheckpoint:(ticket,value)=>{fullBytes=value.length;kernelEvent({ticket,result:{}});},
    saveConversationCheckpoint:(ticket,value)=>{partialBytes=value.length;kernelEvent({ticket,result:{}});},
    settings:()=>native.settings(),providers:()=>native.providers(),kernelDrain:()=>'[]'
   };
   for(let i=0;i<9;i++){
    let start=performance.now();serializeUiState(data);fullTimes.push(performance.now()-start);
    start=performance.now();await checkpointBeforeSend(conversation);partialTimes.push(performance.now()-start);
   }
   fullBytes=serializeUiState(data).length;
   const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
   const report={fullPayloadCharacters:fullBytes,conversationPayloadCharacters:partialBytes,fullMedianMs:median(fullTimes),conversationMedianMs:median(partialTimes),samples:9};
   report.payloadReduction=1-partialBytes/fullBytes;
   TestHost.done(JSON.stringify({passed:report.payloadReduction>.98&&report.conversationMedianMs<report.fullMedianMs,report}));
  }catch(error){TestHost.done(JSON.stringify({passed:false,error:String(error)}));}
 }
 window.addEventListener('load',()=>setTimeout(run,50),{once:true});
})();
