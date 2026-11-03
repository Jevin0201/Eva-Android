// Exact shipped function bodies; declared imports are an explicit host boundary.
export function bindOriginalComponent(deps={}) {
const {e,r}=deps;
function t(e){let t=e.source.trim();if(t.length===0)return null;let n=e.refName.trim(),r=e.sparsePaths.split(/[\n,]+/).map(e=>e.trim()).filter(e=>e.length>0);return{source:t,refName:n.length>0?n:null,sparsePaths:r.length>0?r:null}}
async function n({forceReloadPlugins:e,onReloadError:t,params:n,sendAddMarketplace:r}){let i=await r(n);try{await e()}catch(e){return t(e),{kind:`reload-failed`,marketplaceName:i.marketplaceName}}return{alreadyAdded:i.alreadyAdded,kind:`added`,marketplaceName:i.marketplaceName}}
return {t,n};
}
