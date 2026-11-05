'use strict';
window.mobileFlow=(()=>{
 const expanded=new Map(),processes=new Map(),outputs=new Map(),markdownCache=new Map();
 function prose(text){if(markdownCache.has(text))return markdownCache.get(text);const html=markdown.render(text);if(text.length<100000){if(markdownCache.size>=32)markdownCache.delete(markdownCache.keys().next().value);markdownCache.set(text,html)}return html}
 function outputHtml(value){const text=display(value);return `<pre>${esc(text.slice(0,100000))}</pre>${text.length>100000?'<p class="preview-label">输出过长，当前展示前 100000 个字符。</p>':''}`;}
 const display=value=>typeof value==='string'?value:JSON.stringify(value,null,2);
 function item(i){
  if(['imageGeneration','image','imageView'].includes(i.type))return ''; // Render media once outside collapsed work.
  const agent=window.mobileSubagents?.item(i);if(agent!=null)return agent;
  if(i.type==='agentMessage')return `<div class="assistant markdown" data-flow-key="${esc(i.id||'assistant')}">${prose(itemText(i))}</div>`;
  if(i.type==='reasoning'&&!(i.summary||[]).some(x=>(typeof x==='string'?x:x.text||'').trim()))return '';
  if(i.type==='reasoning')return `<div class="tool-item" data-flow-key="${esc(i.id||'reasoning')}"><strong>思考</strong>${textBlock((i.summary||[]).map(x=>typeof x==='string'?x:x.text||'').join('\n'))}</div>`;
  if(i.type==='plan')return `<div class="tool-item" data-flow-key="${esc(i.id||'plan')}"><strong>计划</strong>${(i.plan||i.steps||[]).map(p=>`<p>${p.status==='completed'?'✓ ':''}${esc(p.step||p.text||'')}</p>`).join('')}</div>`;
  const title=({commandExecution:'执行命令',fileChange:'文件修改',mcpToolCall:'调用工具',dynamicToolCall:'调用工具',webSearch:'网页搜索',collabAgentToolCall:'子智能体',subAgentActivity:'子智能体',contextCompaction:'整理上下文',automaticApprovalReview:'操作审批'})[i.type]||'处理步骤';
  const detail=i.command||[i.server,i.tool||i.name].filter(Boolean).join(' · ')||i.query||itemText(i);
  const changes=(i.changes||[]).map(c=>`<p>${esc(c.path||'')} · ${esc(c.kind?.type||c.kind||'修改')}</p>`).join('');
  const result=i.aggregatedOutput??i.result??i.output??i.error;
  const failed=i.status==='failed'||i.status==='declined'||i.success===false||i.error||i.failure||i.result?.isError||i.exitCode!=null&&i.exitCode!==0,key='output:'+i.id;outputs.set(key,result);const open=expanded.get(key)===true;
  return `<div data-flow-key="${esc(i.id||'tool')}" class="tool-item ${failed?'tool-failed':''}"><div class="tool-line"><span class="tool-state" aria-label="${failed?'失败':'状态'}">${failed?'!':i.status==='inProgress'?'◌':'✓'}</span><strong>${esc(title)}</strong><small>${esc(failed?'未完成':({inProgress:'执行中',completed:'已完成'})[i.status]||i.status||'')}</small></div>${textBlock(detail)}${failed&&result?`<p class="model-error">${esc(display(result).slice(0,300))}</p>`:''}${changes}${result!=null?`<details class="tool-output" data-tool-output="${esc(key)}" ${open?'open':''}><summary>查看详情</summary><div class="tool-output-body">${open?outputHtml(result):''}</div></details>`:''}</div>`;
 }
 function groups(rows,fallback,scope){if(!rows)return (fallback||[]).map(item).join('');return rows.map(g=>{if(g.kind!=='activity')return (g.items||[g.item]).filter(Boolean).map(item).join('');const key=scope+':activity:'+g.key,open=expanded.has(key)?expanded.get(key):g.open;const hasChildren=g.items.some(i=>i.type!=='reasoning'||(i.summary||[]).some(x=>(typeof x==='string'?x:x.text||'').trim()));if(!hasChildren)return `<div class="mobile-native-activity" data-activity-state="${esc(g.state)}"><div class="activity-status">${icon('clock')}<span>${esc(g.label||'正在思考')}</span></div></div>`;processes.set(key,{items:g.items});return `<details class="mobile-native-activity" data-work-group="${esc(key)}" data-disclosure="${esc(key)}" data-activity-state="${esc(g.state)}" ${open?'open':''}><summary>${icon(g.state==='thinking'?'clock':'terminal')}<span>${esc(g.label||'处理过程')}</span>${icon('arrow')}</summary><div class="disclosure-content">${open?g.items.map(item).join(''):''}</div></details>`}).join('')}
 function body(value){return groups(value.groups,value.items,value.scope||'')}
 function turn(t){let out='';for(const b of t.mobileBlocks){if(b.kind==='user'){out+=window.evaUserAttachments?evaUserAttachments.html(b.item,t):`<div class="user-row" data-flow-key="${esc(b.item.id||b.key||'user')}"><div class="user-bubble">${textBlock(b.item.mobileText??itemText(b.item))}</div></div>`;continue}
 const persistent=groups(b.persistentGroups,b.persistent,b.key+':persistent'),final=groups(b.finalGroups,b.final,b.key+':final');
 const hasWork=b.workGroups?b.workGroups.length>0:b.work.length>0;
 if(hasWork){const value={groups:b.workGroups,items:b.work,scope:b.key};processes.set(b.key,value);if(b.collapsible){const open=expanded.has(b.key)?expanded.get(b.key):b.open;out+=`<div class="mobile-turn-process"><details class="activity" data-process="${esc(b.key)}" data-disclosure="${esc(b.key)}" ${open?'open':''}><summary>${esc(b.label||'处理过程')}${icon('arrow')}</summary><div class="process-body disclosure-content">${open?body(value):''}</div></details>${persistent}</div>`}else out+=persistent+`<div class="process-live">${body(value)}</div>`}else out+=persistent;out+=`<div class="turn-final">${final}</div>`}
 const delivered=new Set();for(const i of t.items||[]){if(!['imageGeneration','image','imageView'].includes(i.type))continue;const marker='data-generated-item="'+esc(i.id||'image')+'"';if(!out.includes(marker)&&!delivered.has(marker)){out+=window.generatedImages?.html(i)||'';delivered.add(marker)}}
 if(t.error)out+=`<p class="error">${esc(t.error.message||'执行失败')}</p>`;return out;
 }
 document.addEventListener('click',e=>{const summary=e.target.closest('details[data-disclosure]>summary');if(summary){const d=summary.parentElement;expanded.set(d.dataset.disclosure,!d.open)}});
 document.addEventListener('toggle',e=>{const d=e.target;if(d.matches?.('details[data-tool-output]')){expanded.set(d.dataset.toolOutput,d.open);const body=d.querySelector('.tool-output-body');if(d.open&&!body.childNodes.length)body.innerHTML=outputHtml(outputs.get(d.dataset.toolOutput));return;}if(!d.matches?.('details[data-disclosure]'))return;const content=d.querySelector(':scope > .disclosure-content');if(d.open&&content&&!content.childNodes.length)content.innerHTML=body(processes.get(d.dataset.disclosure)||{});window.mobileImages?.hydrate()},true);
 return {turn,retain(ids){for(const key of processes.keys())if(!ids.some(id=>key.startsWith(id+':')))processes.delete(key);if(outputs.size>500)outputs.clear();if(expanded.size>1000)expanded.clear()}};
})();
