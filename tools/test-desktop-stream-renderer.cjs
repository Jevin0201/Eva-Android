'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const desktop=path.resolve('migration/eva-0.2.7-desktop/stream');
const nativeCore=path.resolve('probe/assets/desktop-stream/native-transcript');
const names=['util.js','i18n.js','icons.js','composer-input.js','conversation-failures.js','render.js','transcript-dom.js'];
function environment(){
 const context={console};context.window=context;vm.createContext(context);
 for(const file of ['original-core.js','activity-core.js','statistics-core.js','disclosure-core.js','host.js'])vm.runInContext(fs.readFileSync(path.join(nativeCore,file),'utf8'),context);
 context.state={thread:{id:'thread',cwd:'/root/eva-workspace'},activeThreadId:'thread',cwd:'/root/eva-workspace',plans:new Map(),diffs:new Map(),expanded:new Set(),approvals:[],productMode:'codex',meta:{codexHome:'/root/.eva-codex'}};
 context.models=[];context.nativeSteeringHost={html(model){context.models.push(model);return `<native-slot data-kind="${model.kind||'user'}" data-item="${model.item.id}"></native-slot>`;}};
 context.workTimer={label:()=>''};context.workDuration={format:ms=>String(ms)};context.els={};context.api={};return context;
}
const original=environment(),adapted=environment();
vm.runInContext(names.map(n=>fs.readFileSync(path.join(desktop,n),'utf8')).join('\n')+'\nthis.renderer={renderTurn};',original);
vm.runInContext(fs.readFileSync('probe/assets/desktop-stream-renderer.js','utf8'),adapted);
adapted.renderer=adapted.EvaDesktopStream.create(adapted);
const fixtures=[
 {id:'plain',status:'completed',items:[{id:'u',type:'userMessage',content:[{type:'text',text:'请写一个小程序'}]},{id:'a',type:'agentMessage',phase:'final_answer',text:'## 完成\n\n生成了程序。'}]},
 {id:'working',status:'inProgress',items:[{id:'u',type:'userMessage',content:[{type:'text',text:'继续'}]},{id:'r',type:'reasoning',summary:[]},{id:'c',type:'commandExecution',command:'node app.js',status:'completed',aggregatedOutput:'ok',exitCode:0},{id:'p',type:'agentMessage',phase:'commentary',text:'正在验证功能。'},{id:'d',type:'dynamicToolCall',tool:'inspect_page',status:'inProgress',contentItems:[]}]},
 {id:'finished-tools',status:'completed',items:[{id:'c',type:'commandExecution',command:'echo ready',status:'completed',aggregatedOutput:'ready',exitCode:0},{id:'a',type:'agentMessage',phase:'final_answer',text:'已完成'}]},
 {id:'interrupted',status:'interrupted',items:[{id:'c',type:'commandExecution',command:'sleep 3',status:'inProgress'}]},
 {id:'failed',status:'failed',error:{message:'request timed out'},items:[{id:'c',type:'commandExecution',command:'exit 1',status:'completed',aggregatedOutput:'failed',exitCode:1}]}
];
for(const turn of fixtures){
 original.models=[];adapted.models=[];
 const expected=original.renderer.renderTurn(turn,false),actual=adapted.renderer.renderTurn(turn,false);
 // Android exposes copy once and opens changes from the result card.
 const withoutDesktopMenu=expected.replace(/<button class="mini-btn" data-turn-menu="[^"]*"[^>]*>[\s\S]*?<\/button>/g,'');
 assert.equal(actual,withoutDesktopMenu,turn.id+' preserves desktop content with compact Android actions');
 assert(!actual.includes('data-turn-menu='));
 assert.equal((actual.match(/data-copy-turn=/g)||[]).length,adapted.renderer.finalAnswerItems(turn).length&&turn.status!=='inProgress'?1:0);
 assert.equal(JSON.stringify(adapted.models),JSON.stringify(original.models),turn.id+' native model contract');
 assert(!actual.includes('mobile-turn-process'),'no mobile wrapper');
}
assert(fs.readFileSync('probe/assets/codex-message-adapter.js','utf8').includes('messagesDisabled'));
assert(fs.readFileSync('migration/desktop-activity/adapter.jsx','utf8').includes('bodyObserver.disconnect()'));
console.log('PASS complete desktop renderTurn HTML and native-model parity for text, live commands/commentary/dynamic tools, completion, interruption, failures; isolated closure and legacy lifecycle gates');

const changed={id:'changed',status:'completed',items:[{id:'f',type:'fileChange',status:'completed',changes:[{path:'/root/eva-workspace/settings.js',kind:'update',diff:'@@ -1 +1 @@\n-old\n+new'}]},{id:'a',type:'agentMessage',phase:'final_answer',text:'已完成'}]};
const changedHtml=adapted.renderer.renderTurn(changed,false);
assert(changedHtml.includes('class="turn-changes-summary" data-turn-diff="changed"'));
assert(!changedHtml.includes('data-revert-turn='),'file summary cannot suggest unsupported file undo');
assert.equal((changedHtml.match(/data-turn-diff=/g)||[]).length,1);
assert(!adapted.renderer.renderTurn({id:'empty',status:'completed',items:[]},false).includes('turn-changes-summary'));
assert(!adapted.renderer.renderTurn({...changed,status:'inProgress'},false).includes('turn-changes-summary'));
adapted.state.diffs.set('net-empty','');
assert(!adapted.renderer.renderTurn({...changed,id:'net-empty'},false).includes('turn-changes-summary'));
console.log('PASS compact answer actions, direct change summary, no-change/running/empty-net-diff visibility');

// The modern transcript installs its own registry after the legacy projection loads.
vm.runInContext(fs.readFileSync('probe/assets/eva-flow-projection.js','utf8'),adapted);
const hostSource=fs.readFileSync('probe/assets/desktop-stream-host.js','utf8');
assert(hostSource.includes('EvaFlowProjection.registerPhoneTools(window.nativeTranscript)'));
adapted.EvaFlowProjection.registerPhoneTools(adapted.nativeTranscript);
for(const [tool,running,done,failed] of [
 ['eva_phone_steps','正在执行手机步骤','执行了手机步骤','手机步骤未完成'],
 ['eva_phone_route','正在处理手机路线','处理了手机路线','手机路线未完成'],
 ['eva_wechat','正在操作微信','操作了微信','微信操作失败']
]){
 const item={id:tool,type:'dynamicToolCall',tool,status:'inProgress',arguments:{steps:[{action:'observe'}]},contentItems:[]};
 const turn={id:tool,status:'inProgress',items:[item]};
 adapted.models=[];
 adapted.renderer.renderTurn(turn,false);
 assert(adapted.models.some(model=>model.text===running),tool+' active native activity label');
 const history={...turn,status:'completed',items:[{...item,status:'completed',success:true,contentItems:[{type:'inputText',text:'执行记录'}]},{id:'final-'+tool,type:'agentMessage',phase:'final_answer',text:'已处理'}]};
 const collapsed=adapted.renderer.renderTurn(history,false);
 const processKey=collapsed.match(/data-process="([^"]+)"/)?.[1];
 assert(processKey,'completed tools retain a process disclosure');
 adapted.state.expanded.add(processKey);
 adapted.models=[];
 const html=adapted.renderer.renderTurn(history,false),models=JSON.stringify(adapted.models);
 assert(adapted.models.some(model=>model.text===done),tool+' completed label');
 assert(models.includes('执行记录'),tool+' tool results retained');
 adapted.models=[];
 assert.equal(adapted.renderer.renderTurn(JSON.parse(JSON.stringify(history)),false),html,'serialized history restores HTML');
 assert.equal(JSON.stringify(adapted.models),models,'serialized history restores native activity models');
 adapted.models=[];
 adapted.renderer.renderTurn({...history,items:[{...history.items[0],success:false},history.items[1]]},false);
 assert(adapted.models.some(model=>model.text===failed),tool+' failure label');
}
console.log('PASS modern phone batch/route/WeChat dynamic-tool labels, native details and history restoration');
