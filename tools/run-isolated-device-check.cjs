'use strict';
// Android instrumentation restarts its target process. Save and check the live app first.
const cp = require('node:child_process');
const {chromium} = require('playwright-core');
const {assertIdle} = require('./install-upgrade-checked.cjs');

async function main() {
 const adb = process.env.EVA_ADB;
 if (!adb) throw Error('Set EVA_ADB');
 const [check, ...args] = process.argv.slice(2);
 if (!['DesktopStreamCheck', 'ScheduledTaskCheck', 'AttachmentImportCheck'].includes(check)) throw Error('Unknown isolated check');
 const pkg = 'ai.eva.android.probe';
 const run = args => cp.execFileSync(adb, args, {encoding: 'utf8'});
 const scheduled = cp.spawnSync(adb, ['shell', 'run-as', pkg, 'cat', 'shared_prefs/eva-scheduled.xml'], {encoding: 'utf8'});
 if (scheduled.status === 0 && /<boolean\s+name="enabled"\s+value="true"/.test(scheduled.stdout)) throw Error('后台调度已开启，取消会重启进程的测试');
 const pid = run(['shell', 'pidof', pkg]).trim().split(/\s+/)[0];
 try { run(['forward', '--remove', 'tcp:9223']); } catch { }
 run(['forward', 'tcp:9223', 'localabstract:webview_devtools_remote_' + pid]);
 const browser = await chromium.connectOverCDP('http://127.0.0.1:9223');
 try {
  const page = browser.contexts().flatMap(context => context.pages()).find(page => page.url() === 'https://eva.invalid/index.html');
  if (!page) throw Error('Main Eva page unavailable');
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
 try {
  const capture=check==='AttachmentImportCheck';
  const result = cp.spawnSync(adb, ['shell', 'am', 'instrument', '-w', ...args, pkg + '/.' + check], capture?{encoding:'utf8'}:{stdio:'inherit'});
  if(capture){process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');if(!/INSTRUMENTATION_CODE:\s*-1/.test(result.stdout||'')||!result.stdout.includes('PASS attachment native import')||result.stdout.includes('cleanupError'))throw Error('Attachment import native check did not pass');}
  if (result.error) throw result.error;
  if (result.status !== 0) throw Error('Isolated check failed to run');
 } finally {
  run(['shell', 'am', 'start', '-n', pkg + '/.ShellActivity']);
 }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
