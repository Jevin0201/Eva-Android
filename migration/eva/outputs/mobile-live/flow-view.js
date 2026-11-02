'use strict';
window.mobileFlow=(()=>{
 const expanded=new Map(),processes=new Map();
 const display=value=>typeof value==='string'?value:JSON.stringify(value,null,2);
 function item(i){
  if(i.type==='agentMessage')return `<div class="assistant markdown">${markdown.render(itemText(i))}</div>`;
  if(i.type==='reasoning')return `<div class="tool-item"><strong>思考</strong>${textBlock((i.summary||[]).map(x=>typeof x==='string'?x:x.text||'').join('\n'))}</div>`;
  if(i.type==='plan')return `<div class="tool-item"><strong>计划</strong>${(i.plan||i.steps||[]).map(p=>`<p>${p.status==='completed'?'✓ ':''}${esc(p.step||p.text||'')}</p>`).join('')}</div>`;
  const title=({commandExecution:'执行命令',fileChange:'文件修改',mcpToolCall:'调用工具',dynamicToolCall:'调用工具',webSearch:'网页搜索',collabAgentToolCall:'子智能体',subAgentActivity:'子智能体',contextCompaction:'整理上下文',automaticApprovalReview:'操作审批'})[i.type]||'处理步骤';
  const detail=i.command||[i.server,i.tool||i.name].filter(Boolean).join(' · ')||i.query||itemText(i);
  const changes=(i.changes||[]).map(c=>`<p>${esc(c.path||'')} · ${esc(c.kind?.type||c.kind||'修改')}</p>`).join('');
  const result=i.aggregatedOutput??i.result??i.output??i.error;
  return `<div class="tool-item"><strong>${esc(title)}</strong>${textBlock(detail)}${changes}<small>${esc(({inProgress:'执行中',completed:'已完成',failed:'失败',declined:'已拒绝'})[i.status]||i.status||'')}</small>${result!=null?`<details class="tool-output"><summary>查看结果</summary><pre>${esc(display(result))}</pre></details>`:''}</div>`;
 }
 function groups(rows,fallback,scope){if(!rows)return (fallback||[]).map(item).join('');return rows.map(g=>{if(g.kind!=='activity')return (g.items||[g.item]).filter(Boolean).map(item).join('');const key=scope+':activity:'+g.key,open=expanded.has(key)?expanded.get(key):g.open;processes.set(key,{items:g.items});return `<details class="mobile-native-activity" data-work-group="${esc(key)}" data-disclosure="${esc(key)}" data-activity-state="${esc(g.state)}" ${open?'open':''}><summary>${icon(g.state==='thinking'?'clock':'terminal')}<span>${esc(g.label||'处理过程')}</span>${icon('arrow')}</summary><div class="disclosure-content">${open?g.items.map(item).join(''):''}</div></details>`}).join('')}
 function body(value){return groups(value.groups,value.items,value.scope||'')}
 function turn(t){let out='';for(const b of t.mobileBlocks){if(b.kind==='user'){out+=`<div class="user-row"><div class="user-bubble">${window.mobileImages?.html(b.item)||''}${textBlock(b.item.mobileText??itemText(b.item))}</div></div>`;continue}
 const persistent=groups(b.persistentGroups,b.persistent,b.key+':persistent'),final=groups(b.finalGroups,b.final,b.key+':final');
 const hasWork=b.workGroups?b.workGroups.length>0:b.work.length>0;
 if(hasWork){const value={groups:b.workGroups,items:b.work,scope:b.key};processes.set(b.key,value);if(b.collapsible){const open=expanded.has(b.key)?expanded.get(b.key):b.open;out+=`<div class="mobile-turn-process"><details class="activity" data-process="${esc(b.key)}" data-disclosure="${esc(b.key)}" ${open?'open':''}><summary>${esc(b.label||'处理过程')}${icon('arrow')}</summary>${persistent?`<div class="mobile-persistent">${persistent}</div>`:''}<div class="process-body disclosure-content">${open?body(value):''}</div></details>${!open?persistent:''}</div>`}else out+=persistent+`<div class="process-live">${body(value)}</div>`}else out+=persistent;out+=`<div class="turn-final">${final}</div>`}
 if(t.error)out+=`<p class="error">${esc(t.error.message||'执行失败')}</p>`;return out;
 }
 document.addEventListener('click',e=>{const summary=e.target.closest('details[data-disclosure]>summary');if(summary){const d=summary.parentElement;expanded.set(d.dataset.disclosure,!d.open)}});
 document.addEventListener('toggle',e=>{const d=e.target;if(!d.matches?.('details[data-disclosure]'))return;const content=d.querySelector(':scope > .disclosure-content');if(d.open&&content&&!content.childNodes.length)content.innerHTML=body(processes.get(d.dataset.disclosure)||{});window.mobileImages?.hydrate()},true);
 return {turn};
})();
