import {randomUUID} from 'node:crypto';
// Pair the ordered native opening/closed stream with Playwright's dialog events.
// The two CDP clients can deliver those events in either order.
export class DialogLifecycle{
 constructor({opened,closed}){this.onOpen=opened;this.onClose=closed;this.native=[];this.waiting=[];this.records=new WeakMap();this.current=null;}
 observe(dialog){const record={dialog,token:randomUUID(),done:false,announced:false};this.records.set(dialog,record);this.waiting.push(record);this.pair();if(!record.done){this.current=record;record.announced=true;this.onOpen(record);}return record;}
 opening(info){this.native.push({type:info.type,message:info.message||'',closed:false,record:null});this.pair();}
 closing(){const event=this.native.find(e=>!e.closed);if(!event)return;event.closed=true;if(event.record)this.complete(event.record);this.prune();}
 pair(){for(const event of this.native){if(event.record)continue;const index=this.waiting.findIndex(r=>r.dialog.type()===event.type&&r.dialog.message()===(event.message||''));if(index<0)continue;event.record=this.waiting.splice(index,1)[0];if(event.closed)this.complete(event.record);}this.prune();}
 prune(){this.native=this.native.filter(e=>!(e.closed&&e.record));if(this.native.length>100)this.native.splice(0,this.native.length-100);if(this.waiting.length>100)this.waiting.splice(0,this.waiting.length-100);}
 complete(record){if(!record||record.done)return;record.done=true;if(this.current===record)this.current=null;if(record.announced)this.onClose(record);}
 token(dialog){return this.records.get(dialog)?.token;}
 async decide(dialog,command){const record=this.records.get(dialog);if(!record||record.done)return {alreadyHandled:true};if(record.operation)return record.operation;
  record.operation=Promise.resolve().then(async()=>{let handled=false;try{if(record.done)return {alreadyHandled:true};if(command.decision==='accept')await dialog.accept(command.text||'');else await dialog.dismiss();handled=true;return {handled:true};}catch(error){if(!/already handled|No (?:JavaScript )?dialog (?:is showing|is open)/i.test(error.message))throw error;handled=true;return {alreadyHandled:true};}finally{if(handled)this.complete(record);}});
  try{return await record.operation;}finally{if(!record.done)record.operation=null;}
 }
}
