'use strict';
// Android instrumentation restarts its target process. Save and check the live app first.
const cp = require('node:child_process');
const {chromium} = require('playwright-core');
const {assertIdle,assertRuntimeIdle} = require('./install-upgrade-checked.cjs');

async function main() {
 const adb = process.env.EVA_ADB;
 if (!adb) throw Error('Set EVA_ADB');
 const [check, ...args] = process.argv.slice(2);
 if (!['DesktopStreamCheck', 'ScheduledTaskCheck', 'AttachmentImportCheck', 'McpOAuthCheck','ApkInstallCheck','PhoneControlSetupCheck','PhoneAgentPreviewCheck','PhoneAgentDisplayCheck','RuntimeAuthoringCheck','PhoneRouteCheck','PhoneResourceSchedulerCheck','PhoneBatchCheck','ModelCheck','ModelRuntimeCheck','ModelSelectionStorageCheck','DependencyToolsCheck','ExecutionLeaseCheck','WorkspacePreviewChromeCheck','WorkspaceFinalPreviewCheck','ModularSetupCheck'].includes(check)) throw Error('Unknown isolated check');
 const pkg = 'ai.eva.android.probe';
 const run = args => cp.execFileSync(adb, args, {encoding: 'utf8'});
 assertRuntimeIdle(run,pkg);
 const scheduled = cp.spawnSync(adb, ['shell', 'run-as', pkg, 'cat', 'shared_prefs/eva-scheduled.xml'], {encoding: 'utf8'});
 if (scheduled.status === 0 && /<boolean\s+name="enabled"\s+value="true"/.test(scheduled.stdout)) throw Error('后台调度已开启，取消会重启进程的测试');
 const pid = run(['shell', 'pidof', pkg]).trim().split(/\s+/)[0];
 try { run(['forward', '--remove', 'tcp:9223']); } catch { }
 run(['forward', 'tcp:9223', 'localabstract:webview_devtools_remote_' + pid]);
 const browser = await chromium.connectOverCDP('http://127.0.0.1:9223');
 try {
  let page;
  const deadline = Date.now() + 15000;
  while (!page && Date.now() < deadline) {
   page = browser.contexts().flatMap(context => context.pages()).find(page => page.url() === 'https://eva.invalid/index.html');
   if (!page) await new Promise(resolve => setTimeout(resolve, 150));
  }
  if (!page) throw Error('Main Eva page unavailable');
  await page.waitForFunction(() => typeof kernelBusy !== 'undefined' && typeof data !== 'undefined');
  assertIdle(await page.evaluate(() => {
   pollKernel();
   return {busy: kernelBusy, running: [...data.chats, ...data.drafts].filter(chat => chat.running).length,
    pending: [...data.chats, ...data.drafts].filter(chat => chat.pending).length};
  }));
  await page.evaluate(() => {
   if (kernelBusy || [...data.chats, ...data.drafts].some(chat => chat.running || chat.pending)) throw Error('任务状态已变化，取消测试');
   if (!EvaHost.save(JSON.stringify(data))) throw Error('保存失败，取消测试');
   const send = kernelSend, go = navigate;
   window.__evaCheckUndo = () => { kernelSend = send; navigate = go; render(); };
   kernelSend = () => {};
   navigate = action => { if (!['kernel-send', 'kernel-steer'].includes(action)) return go(action); };
   const input = document.querySelector('#prompt');
   if (input) input.readOnly = true;
   for (const button of document.querySelectorAll('.controls button')) button.disabled = true;
  });
 } finally { await browser.close(); }
 let succeeded=false;
 try {
  const capture=['AttachmentImportCheck','McpOAuthCheck','ApkInstallCheck','PhoneControlSetupCheck','PhoneAgentPreviewCheck','PhoneAgentDisplayCheck','RuntimeAuthoringCheck','PhoneRouteCheck','PhoneResourceSchedulerCheck','PhoneBatchCheck','ModelCheck','ModelRuntimeCheck','ModelSelectionStorageCheck','DependencyToolsCheck','ExecutionLeaseCheck','WorkspacePreviewChromeCheck','WorkspaceFinalPreviewCheck','ModularSetupCheck'].includes(check);
  const result = cp.spawnSync(adb, ['shell', 'am', 'instrument', '-w', ...args, pkg + '/.' + check], capture?{encoding:'utf8'}:{stdio:'inherit'});
  if(capture){process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');const expected={AttachmentImportCheck:'PASS attachment native import',McpOAuthCheck:'PASS scoped loopback callback',ApkInstallCheck:'PASS read-only APK provider',ModelCheck:'PASS:',WorkspaceFinalPreviewCheck:'PASS direct original preview '}[check]||'PASS ';const failed=check==='WorkspaceFinalPreviewCheck'?/^(?:INSTRUMENTATION_FAILED|INSTRUMENTATION_RESULT: stream=FAIL direct original preview)/m.test(result.stdout):/INSTRUMENTATION_FAILED|FAIL |cleanupError/.test(result.stdout);if(!result.stdout.includes(expected)||failed)throw Error('Native check did not pass: '+check);}
  if (result.error) throw result.error;
  if (result.status !== 0) throw Error('Isolated check failed to run');
  succeeded=true;
 } finally {
  const launch=['shell','am','start','-n',pkg+'/.ShellActivity'];
  if(check==='WorkspaceFinalPreviewCheck'&&succeeded){const at=args.findIndex((value,index)=>value==='path'&&args[index-1]==='-e');if(at>=0&&args[at+1])launch.push('--es','page','file-preview','--es','preview-path',args[at+1]);}
  run(launch);
 }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
