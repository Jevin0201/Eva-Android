'use strict';
// Exercise user-facing setup and stop controls, including a cold process restart.
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const {chromium} = require('playwright-core');
const {assertIdle} = require('./install-upgrade-checked.cjs');
const adb = process.env.EVA_ADB;
if (!adb) throw Error('Set EVA_ADB');
const pkg = 'ai.eva.android.probe';
const sizes = [...cp.execFileSync(adb, ['shell', 'wm', 'size'], {encoding: 'utf8'}).matchAll(/size:\s*(\d+)x(\d+)/g)];
assert(sizes.length, 'Phone resolution unavailable');
const phoneSize = sizes[sizes.length - 1];
const backgroundPattern = new RegExp('DisplayDeviceInfo\\{"eva-agent"[^\\n]*' + phoneSize[1] + ' x ' + phoneSize[2]);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const run = args => cp.execFileSync(adb, args, {encoding: 'utf8', timeout: 25000});
let browser, page;

async function connect() {
 const pid = run(['shell', 'pidof', pkg]).trim().split(/\s+/)[0];
 run(['forward', 'tcp:9223', 'localabstract:webview_devtools_remote_' + pid]);
 browser = await chromium.connectOverCDP('http://127.0.0.1:9223');
 page = browser.contexts().flatMap(context => context.pages()).find(p => p.url() === 'https://eva.invalid/index.html');
 assert(page, 'Eva main page unavailable');
 await page.waitForFunction(() => typeof data !== 'undefined' && typeof kernelBusy !== 'undefined');
 assertIdle(await page.evaluate(() => ({busy: kernelBusy, running: [...data.chats, ...data.drafts].filter(c => c.running || c.pending).length})));
}
async function snapshot() {
 const raw = run(['exec-out', 'uiautomator', 'dump', '/dev/tty']);
 const xml = raw.slice(raw.indexOf('<?xml'), raw.lastIndexOf('</hierarchy>') + 12);
 return page.evaluate(xml => [...new DOMParser().parseFromString(xml, 'text/xml').querySelectorAll('node')].map(node => ({
  text: node.getAttribute('text'), checked: node.getAttribute('checked'), bounds: node.getAttribute('bounds')
 })), xml);
}
async function waitForState(enabled) {
 const deadline = Date.now() + 35000;
 let state;
 do {
  // UiAutomator temporarily suppresses normal accessibility services. Observe
  // system state here so the readiness check cannot disconnect Eva itself.
  const prefs = preferences();
  const accessibility = run(['shell', 'dumpsys', 'accessibility']);
  const displays = run(['shell', 'dumpsys', 'display']);
  state = {
   keep: /name="keepEnabled" value="true"/.test(prefs),
   bound: /Bound services:\{Service\[label=Eva 手机控制/.test(accessibility),
   background: backgroundPattern.test(displays)
  };
  if (enabled ? state.keep && state.bound && state.background : !state.keep && !state.background) return state;
  await pause(500);
 } while (Date.now() < deadline);
 throw Error('Control state did not settle: ' + JSON.stringify(state));
}
async function openControl() {
 await page.evaluate(() => EvaHost.open('phone-control'));
 await pause(500);
}
function preferences() {
 return run(['shell', 'run-as', pkg, 'cat', 'shared_prefs/eva-phone.xml']);
}
async function restart() {
 assert(await page.evaluate(() => EvaHost.save(JSON.stringify(data))), 'Save failed before restart');
 await browser.close();
 run(['shell', 'am', 'force-stop', pkg]);
 run(['shell', 'am', 'start', '-n', pkg + '/.ShellActivity']);
 await pause(1500);
 await connect();
}
async function main() {
 run(['shell', 'am', 'start', '-n', pkg + '/.ShellActivity']);
 await pause(700);
 await connect();
 const before = await page.evaluate(() => ({chats: data.chats.map(c => c.id), drafts: data.drafts.map(c => c.id)}));
 // Top-level phone button starts the same setup that is offered on the control page.
 await page.getByRole('button', {name: '一键启用手机能力', exact: true}).click();
 await waitForState(true);
 assert.match(preferences(), /name="keepEnabled" value="true"/);
 const enabled = Date.now();
 await restart();
 await openControl();
 await waitForState(true);
 const recoveredMs = Date.now() - enabled;
 const nodes = await snapshot();
 const toggle = nodes.find(n => n.text === '保持手机控制开启' && n.checked === 'true');
 assert(toggle, 'Keep control switch missing');
 const bounds = toggle.bounds.match(/\d+/g).map(Number);
 await waitForState(true);
 run(['shell', 'input', 'tap', String(bounds[2] - 60), String(Math.round((bounds[1] + bounds[3]) / 2))]);
 await waitForState(false);
 assert.match(preferences(), /name="keepEnabled" value="false"/);
 await restart();
 await openControl();
 await pause(3500);
 await waitForState(false);
 assert.match(preferences(), /name="keepEnabled" value="false"/);
 // Leave the requested final setup enabled through the normal single entry point.
 run(['shell', 'am', 'start', '-n', pkg + '/.ShellActivity']);
 await page.getByRole('button', {name: '一键启用手机能力', exact: true}).click();
 await waitForState(true);
 run(['shell', 'am', 'start', '-n', pkg + '/.ShellActivity']);
 const after = await page.evaluate(() => ({chats: data.chats.map(c => c.id), drafts: data.drafts.map(c => c.id)}));
 assert.deepEqual(after, before, 'Setup changed conversation IDs');
 const result = {passed: true, oneButton: true, coldRestartRecovery: true, recoveryMsIncludingRestart: recoveredMs,
  explicitStopPersists: true, finalEnabled: true, conversationIdsPreserved: true};
 fs.mkdirSync('artifacts/final-0.0.69', {recursive: true});
 fs.writeFileSync('artifacts/final-0.0.69/setup-lifecycle.json', JSON.stringify(result, null, 2));
 console.log(result);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); });
