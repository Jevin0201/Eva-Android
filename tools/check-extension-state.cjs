const {chromium}=require('playwright-core'),assert=require('assert/strict');
(async()=>{const b=await chromium.connectOverCDP('http://127.0.0.1:9223');try{const p=b.contexts()[0].pages().find(p=>p.url().includes('eva.invalid'));
console.log(await p.evaluate(async()=>{
 const skill='/root/.eva-codex/skills/eva-skill-acceptance/SKILL.md',id='eva-acceptance-plugin@eva-android-acceptance';
 const results={};
 for(const enabled of [false,true]){await kernelCall('skills/config/write',{path:skill,enabled});const r=await kernelCall('skills/list',{cwds:['/root/eva-workspace'],forceReload:true});if(r.data.flatMap(x=>x.skills).find(x=>x.path===skill)?.enabled!==enabled)throw Error('skill toggle mismatch');}results.skillToggle='PASS';
 for(const enabled of [false,true]){await kernelCall('config/value/write',{keyPath:'plugins.'+JSON.stringify(id)+'.enabled',value:enabled,mergeStrategy:'replace'});const r=await kernelCall('plugin/installed',{cwds:['/root/eva-workspace/projects/plugin-acceptance']});if(r.marketplaces.flatMap(m=>m.plugins).find(p=>p.id===id)?.enabled!==enabled)throw Error('plugin toggle mismatch');}results.pluginToggle='PASS';
 const r=await kernelCall('android/mcp',{action:'resources',name:'eva_acceptance'});results.resources=r;
 const read=await kernelCall('android/mcp',{action:'resourceRead',name:'eva_acceptance',uri:'eva-test://guide'});results.resourceRead=read;
 const memory=await kernelCall('android/memories/create',{id:'acceptance-memory.md',content:'用户为本次验收指定的记忆口令是 EVA_MEMORY_OK_9832。'});await kernelCall('android/memories/save',{id:memory.id,revision:memory.revision,content:memory.content+'\n此文件仅供验收。'});let conflict=false;try{await kernelCall('android/memories/save',{id:memory.id,revision:memory.revision,content:'stale overwrite'});}catch{conflict=true;}if(!conflict)throw Error('memory conflict accepted');results.memoryConflict='PASS';
 results.hooks=await kernelCall('hooks/list',{cwds:['/root/eva-workspace']});
 return results;
}));}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
