const assert=require('node:assert/strict');
const stream=require('../migration/eva/src/renderer/stream-state.js');
const boundary=stream.createBoundary(),p={threadId:'thread',turnId:'turn',itemId:'item'};
const item={id:'item',type:'agentMessage',text:''};
boundary.delta('item/agentMessage/delta',{...p,delta:'你好'},item);
boundary.delta('item/agentMessage/delta',{...p,delta:'你好'},item);
assert.equal(item.text,'你好你好'); // Ordinary repeated live text must not disappear.
const merged=stream.mergeTurn({id:'turn',status:'completed',items:[item]},{id:'turn',status:'inProgress',items:[{...item,text:'你'}]});
assert.equal(merged.status,'completed');assert.equal(merged.items[0].text,'你好你好');
const command={id:'cmd',type:'commandExecution'};
boundary.delta('item/commandExecution/outputDelta',{...p,itemId:'cmd',delta:'first\n'},null);
boundary.attach({...p,itemId:'cmd'},command);assert.equal(command.aggregatedOutput,'first\n');
boundary.begin('thread',{id:'thread',turns:[]});
boundary.capture({method:'item/agentMessage/delta',params:{...p,delta:'你好世界'}});
const replay=boundary.finish({id:'thread',turns:[{id:'turn',items:[{id:'item',text:'你好'}]}]});
assert.equal(replay[0].params.delta,'世界');
console.log('PASS: unmodified Eva stream-state; repeated deltas, completed-state protection, late tool output, snapshot overlap');
