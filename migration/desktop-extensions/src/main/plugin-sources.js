'use strict';
const PERSONAL_KINDS=['created-by-me-remote','shared-with-me','workspace-directory'];
async function listPluginSources(request,params={}){
 if(params.marketplaceKinds)return request('plugin/list',params);
 const results=await Promise.allSettled([request('plugin/list',params),request('plugin/list',{...params,marketplaceKinds:PERSONAL_KINDS}),request('plugin/installed',{cwds:params.cwds||[]})]);
 const merged={marketplaces:[],marketplaceLoadErrors:[],featuredPluginIds:[]},byMarketplace=new Map();
 if(results.every(r=>r.status==='rejected'))throw results[0].reason;
 results.forEach((result,index)=>{
  if(result.status==='rejected'){merged.marketplaceLoadErrors.push({marketplaceName:['默认插件目录','个人云端插件','本机已安装插件'][index],message:'该来源暂时无法读取，请刷新重试'});return;}
  for(const market of result.value.marketplaces||[]){const key=JSON.stringify([market.name,market.path||null]),old=byMarketplace.get(key);if(!old){const entry={...market,plugins:[...(market.plugins||[])]};byMarketplace.set(key,entry);merged.marketplaces.push(entry);}else{const plugins=new Map(old.plugins.map(p=>[p.id,p]));for(const plugin of market.plugins||[])if(!plugins.has(plugin.id))plugins.set(plugin.id,plugin);old.plugins=[...plugins.values()];}}
  merged.marketplaceLoadErrors.push(...result.value.marketplaceLoadErrors||[]);merged.featuredPluginIds.push(...result.value.featuredPluginIds||[]);
 });
 const installed=new Map((results[2].status==='fulfilled'?results[2].value.marketplaces||[]:[]).flatMap(m=>m.plugins||[]).filter(p=>p.installed).map(p=>[p.id,p]));
 for(const market of merged.marketplaces)market.plugins=market.plugins.map(p=>installed.has(p.id)?{...p,...installed.get(p.id),interface:installed.get(p.id).interface||p.interface,version:p.version||installed.get(p.id).version}:p);
 merged.featuredPluginIds=[...new Set(merged.featuredPluginIds)];return merged;
}
module.exports={listPluginSources,PERSONAL_KINDS};
