/* REA worked-for-item-content: 1000ms wall clock, frozen completion, <1s threshold. */
(function(root){
  function label({status,startedAtMs,completedAtMs},locale='zh-CN',now=Date.now()){
    const zh=locale.startsWith('zh');
    if(status==='unknown'||!Number.isFinite(startedAtMs))return zh?'活动':'Activity';
    const elapsed=Math.max((completedAtMs??now)-startedAtMs,0),time=root.workDuration.format(elapsed,locale);
    if(status==='working')return elapsed<1000?(zh?'处理中':'Working'):(zh?'已处理 ':'Working for ')+time;
    if(status==='stopped')return zh?`你在 ${time} 后停止了`:`You stopped after ${time}`;
    return (zh?'用时 ':'Worked for ')+time;
  }
  let clock=null;
  function refresh(){
    const nodes=document.querySelectorAll('[data-work-timer]');let running=false;
    for(const node of nodes){const d=node.dataset,start=Number(d.workStarted),end=d.workCompleted===''?null:Number(d.workCompleted);const text=label({status:d.workStatus,startedAtMs:Number.isFinite(start)?start:null,completedAtMs:end},d.workLocale);if(node.textContent!==text)node.textContent=text;running||=d.workStatus==='working'&&end===null;}
    if(running&&document.visibilityState!=='hidden'){if(clock===null)clock=setInterval(refresh,1000);}else if(clock!==null){clearInterval(clock);clock=null;}
  }
  root.workTimer={label,refresh};
  if(typeof document!=='undefined'){document.addEventListener('visibilitychange',refresh);window.addEventListener('pagehide',()=>{clearInterval(clock);clock=null;});}
  if(typeof module==='object')module.exports=root.workTimer;
})(globalThis);
