'use strict';
// Android host adapter for Eva 0.2.0 renderThinking/shouldShowThinking and pending submission.
// See migration/eva-0.2.0-flow: desktop source retained with hashes; no new RPC semantics.
(()=>{
 const submissions=new WeakMap(),samples=[];
 function begin(c){submissions.set(c,{phase:'connecting',start:performance.now()});requestAnimationFrame(()=>{const s=submissions.get(c);if(s)s.paint=performance.now()-s.start;});}
 function stage(c,phase){const s=submissions.get(c);if(s)s.phase=phase;}
 function accept(c){const s=submissions.get(c);if(s){s.phase='accepted';s.accepted??=performance.now()-s.start;}}
 function observe(c,e){const s=submissions.get(c);if(e.method==='turn/started')accept(c);if(s&&/^item\//.test(e.method))s.firstEvent??=performance.now()-s.start;if(e.method==='turn/completed'&&s){samples.push({paintMs:s.paint,acceptedMs:s.accepted,firstEventMs:s.firstEvent,totalMs:performance.now()-s.start,status:e.params?.turn?.status});if(samples.length>30)samples.shift();submissions.delete(c);}}
 function blocked(c){return [...kernelApprovals.values()].some(a=>a.params?.threadId===c.kernelThread?.id)||!!document.querySelector('.agent-question-card');}
 function thinking(turn){
  if(!turn||turn.status!=='inProgress'||turn.error)return false;
  const last=(turn.items||[]).findLast(i=>!['userMessage','steeringUserMessage'].includes(i.type)&&i.hiddenInConversation!==true);
  if(!last)return true;
  if(last.type==='agentMessage')return !itemText(last).trim();
  // Desktop groups thinking/tool progress into one activity row, not a second spinner.
  if(last.type==='reasoning'||['commandExecution','dynamicToolCall','mcpToolCall','fileChange','webSearch','collabAgentToolCall','contextCompaction','imageGeneration'].includes(last.type))return false;
  return last.status!=='inProgress';
 }
 function html(c){if(!c?.running||blocked(c))return '';const turn=c.kernelThread?.turns?.findLast(t=>t.status==='inProgress'),s=submissions.get(c);let text='';
  if(c.pending&&!turn)text=s?.phase==='submitting'?'正在提交任务':'正在连接内核';else if(thinking(turn))text='正在思考';
  if(!text)return '';return `<div class="eva-thinking" data-flow-key="${esc((turn?.id||c.id)+':thinking')}" role="status" aria-live="polite"><span class="eva-thinking-text">${text}<span class="eva-thinking-sweep" aria-hidden="true"><span class="eva-thinking-highlight">${text}</span></span></span></div>`;
 }
 window.evaFlowFeedback={begin,stage,accept,observe,html,samples};
})();
