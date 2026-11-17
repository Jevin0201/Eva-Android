const {execFileSync}=require('child_process');
const {chromium}=require('playwright-core');
const fs=require('fs');
const adb='D:/Codex/模拟器/tools/android/platform-tools/adb.exe';
const run=(...args)=>execFileSync(adb,['-s','509655c7',...args],{encoding:'utf8'}).trim();
(async()=>{
 let browser,port;
 try{
  const pid=run('shell','pidof','ai.eva.android.acceptance').split(' ')[0];
  if(!/^\d+$/.test(pid))throw Error('Acceptance app not running');
  port=run('forward','tcp:0','localabstract:webview_devtools_remote_'+pid);
  browser=await chromium.connectOverCDP('http://127.0.0.1:'+port,{timeout:15000});
  const page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().startsWith('https://eva.invalid/index.html'));
  if(!page)throw Error('Acceptance WebView not found');
  const report=[];
  for(const kind of ['plugins','skills','mcp']){
   console.log('Checking '+kind);await page.evaluate(k=>settingsGo(k),kind);
   await page.waitForSelector('[data-action="settings:'+kind+'"][aria-selected="true"]',{timeout:20000});
   await page.waitForSelector('.eva-native-plugin-add button[aria-haspopup="menu"]',{timeout:20000});
   await page.waitForFunction(()=>settingPage==='mcp'?!document.querySelector('#mcp-notice')?.textContent.includes('正在读取'):!evaDesktopExtensions.state.loading,null,{timeout:20000});
   report.push(await page.evaluate(k=>({kind:k,title:document.querySelector('.app-head strong')?.textContent,tabs:[...document.querySelectorAll('.customize-tabs button')].map(n=>n.textContent),cards:document.querySelectorAll('.customize-card').length,activeKind:document.querySelector('.customize-page')?.dataset.kind,pluginSkillFilter:typeof evaReferences.isPluginSkill,overflow:document.documentElement.scrollWidth>innerWidth}),kind));
   fs.writeFileSync('artifacts/extensions-full-ui-20261117/device-'+kind+'.png',execFileSync(adb,['-s','509655c7','exec-out','screencap','-p']));
   await page.locator('.eva-native-plugin-add button[aria-haspopup="menu"]').click();
   await page.waitForSelector('.eva-native-plugin-add [role=menu]');
   report[report.length-1].menu=await page.locator('.eva-native-plugin-add [role=menu]').innerText();
   fs.writeFileSync('artifacts/extensions-full-ui-20261117/device-'+kind+'-menu.png',execFileSync(adb,['-s','509655c7','exec-out','screencap','-p']));
   await page.getByText('添加自定义 MCP 服务器',{exact:true}).last().click();
   await page.waitForSelector('.eva-native-plugin-add [role=dialog]');
   report[report.length-1].mcpDialog=await page.locator('.eva-native-plugin-add [role=dialog]').isVisible();
   await page.getByRole('button',{name:'取消',exact:true}).last().click();await page.waitForSelector('.eva-native-plugin-add [role=dialog]',{state:'hidden'});
  }
  await page.evaluate(()=>settingsGo('skills'));
  const visibility=await page.evaluate(async()=>{const raw=await kernelCall('skills/list',{cwds:['/root/eva-workspace']});const all=(raw.data||[]).flatMap(g=>g.skills||[]);const owned=all.filter(evaReferences.isPluginSkill);const result=await evaReferences.catalog(null);const leaked=result.items.filter(r=>r.kind==='skill'&&owned.some(s=>s.path===r.path));return {totalSkills:all.length,pluginSkills:owned.length,visibleSkills:result.items.filter(r=>r.kind==='skill').length,visiblePlugins:result.items.filter(r=>r.kind==='plugin').length,leaked:leaked.length,warning:result.warning};});
  if(visibility.leaked)throw Error('Plugin skill leaked into reference catalog');
  fs.writeFileSync('artifacts/extensions-full-ui-20261117/device-visibility.json',JSON.stringify(visibility,null,2));
  console.log('Visibility',visibility);
  fs.writeFileSync('artifacts/extensions-full-ui-20261117/device-check.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
 }finally{if(browser)await browser.close();if(port)run('forward','--remove','tcp:'+port);}
})().catch(e=>{console.error(e);process.exitCode=1});
