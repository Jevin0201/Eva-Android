const {chromium}=require('playwright-core'),fs=require('fs');
(async()=>{const b=await chromium.connectOverCDP('http://127.0.0.1:9223');try{const p=b.contexts().flatMap(c=>c.pages()).find(p=>p.url().includes('eva.invalid'));
const token='office-model-'+Date.now();
const provider=process.env.EVA_ACCEPT_PROVIDER||'openai';
await p.evaluate(provider=>{const api=modelConfig.providers.find(p=>p.model.includes('deepseek'));const c={id:crypto.randomUUID(),title:'办公文档链路验收',messages:[],draft:'',providerId:provider==='openai'?'openai':api.id,model:provider==='openai'?'gpt-6.1-terra':api.model,effort:provider==='openai'?'low':'high',permissionMode:'full'};data.drafts.push(c);data.active=c.id;route='chat';settingPage=null;saveKernel();render();},provider);
await p.locator('#prompt').fill('请使用 Eva 手机内置办公工具，先检查 status 和 schema，然后在 /root/eva-workspace/'+token+'/ 下创建一份 PDF 和一份 Excel。PDF 标题和 Excel A1 都必须是 EVA_OFFICE_MODEL_6193，PDF 加一段中文“这是手机本地生成的验收文件”，Excel B2 是公式 SUM(1,2)。请实际生成后用 inspect 回读验证。不要安装依赖，不覆盖任何已有文件，不操作其他内容。最后回复文件路径及验收口令。');
await p.locator('[data-action=kernel-send]').click();await p.waitForFunction(()=>active()?.kernelThread?.turns?.length&&!active().running&&!kernelBusy,{},{timeout:180000});
const result=await p.evaluate(()=>({thread:active().kernelThread.id,turns:active().kernelThread.turns}));result.directory=token;fs.writeFileSync('artifacts/office/model-'+provider+'.json',JSON.stringify(result,null,2));if(!result.turns.some(t=>t.items.some(i=>i.type==='agentMessage'&&i.text?.includes('EVA_OFFICE_MODEL_6193'))))throw Error('Office marker missing');console.log('PASS model finished office task; independent file validation pending');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
