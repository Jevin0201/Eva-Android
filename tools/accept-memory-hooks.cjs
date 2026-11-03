const {chromium}=require('playwright-core'),fs=require('fs');
(async()=>{const b=await chromium.connectOverCDP('http://127.0.0.1:9223');try{const p=b.contexts()[0].pages().find(p=>p.url().includes('eva.invalid'));
await p.evaluate(()=>{const c={id:crypto.randomUUID(),title:'记忆与钩子验收',messages:[],draft:'',providerId:'openai',model:'gpt-6.1-terra',effort:'low',permissionMode:'full'};data.drafts.push(c);data.active=c.id;route='chat';settingPage=null;saveKernel();render();});
await p.locator('#prompt').fill('请读取 Eva 独立记忆目录中的 acceptance-memory.md，并只回复其中的验收记忆口令。不要修改任何文件。');await p.locator('[data-action=kernel-send]').click();await p.waitForFunction(()=>active()?.kernelThread?.turns?.length&&!active().running&&!kernelBusy,{},{timeout:120000});
const result=await p.evaluate(()=>({thread:active().kernelThread.id,turns:active().kernelThread.turns}));if(!result.turns.some(t=>t.items.some(i=>i.type==='agentMessage'&&i.text?.includes('EVA_MEMORY_OK_9832'))))throw Error('Memory marker missing');
fs.writeFileSync('artifacts/extensions/memory.json',JSON.stringify(result,null,2));console.log('PASS actual model memory read');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
