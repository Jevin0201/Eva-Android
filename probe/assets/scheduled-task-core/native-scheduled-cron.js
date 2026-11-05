'use strict';
const context=require('./android-context');
const desktop=require('./desktop-scheduled-cron');
exports.createPrivateCron=options=>{
 const core=desktop.createPrivateCron(options);
 return {...core,run:input=>context.run({automationId:input.automation.id,taskName:input.automation.name},()=>core.run(input))};
};
