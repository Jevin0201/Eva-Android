'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const provenance=JSON.parse(fs.readFileSync('migration/eva-0.2.7-desktop/scheduled-tasks/SOURCE.json'));
for(const [name,entry] of Object.entries(provenance)){
 const asset=name==='native-scheduled-cron.js'?'desktop-scheduled-cron.js':name;
 const bytes=fs.readFileSync('probe/assets/scheduled-task-core/'+asset);
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),entry.sha256,'original desktop core '+name);
}
const host=fs.readFileSync('probe/src/KernelHost.java','utf8');
const method=host.slice(host.indexOf(' static JSONObject scheduledRequest'),host.indexOf(' final Context context;'));
assert.ok(method.includes('synchronized(kernel.startup){kernel.ensureStarted();}'));
assert.ok(method.includes('kernel=forThread(context,params.getString("threadId"))'));
assert.ok(method.includes('这个会话不属于定时任务'));
assert.ok(method.includes('"automationId"')&&method.includes('"eva-scheduled-routing"'));
assert.ok(method.includes('.put("cwd","/root/eva-workspace")'));
assert.ok(method.includes('.put("sandbox","read-only")'));
assert.ok(method.includes('.put("sandboxPolicy",new JSONObject().put("type","readOnly"))'));
assert.ok(!/kernel\.(?:params|applyPermissions)\(/.test(method),'scheduled read-only path bypasses writable UI presets');
const service=fs.readFileSync('probe/src/ScheduledTaskService.java','utf8');
assert.ok(service.includes('setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP'));
assert.ok(!service.includes('setExact'),'scheduler does not silently require exact-alarm authorization');
assert.ok(service.includes('row.optLong("nextRunAt",0)')&&service.includes('"ACTIVE".equals'));
assert.ok(service.includes('PowerManager.PARTIAL_WAKE_LOCK')&&service.includes('lock.acquire(120000)'));
const ui=fs.readFileSync('probe/src/ScheduledTaskActivity.java','utf8');
assert.ok(ui.includes('new ModelStore(this).publicConfig()'));
assert.ok(ui.includes('scheduledThreadId'));
assert.ok(ui.includes('ScheduledTaskService.cancelAlarm(this)'));
console.log('PASS unchanged desktop source provenance, Android read-only route contract, owning-thread guard, inexact idle wake and UI result/stop entry');
