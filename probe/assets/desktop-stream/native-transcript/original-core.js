/* REA retained declarations from 773eaad4039291c80217d62c97711bb0e4b941fcf4429aaeeb3b04856c4e83ab; see provenance.json. */
(function(root){
'use strict';
function bindRenderGroups(classify){const O=classify;
function N(e,t=!0){let n=[],r=[],i=e=>{r.length!==0&&(n.push({type:`activity`,items:r,collapseWhenPossible:e}),r=[])};for(let a of e){if(a.type===`user-message`){i(!1),n.push({type:`user-message`,item:a});continue}if(a.type===`generated-image`){i(!1);let e=n.at(-1);e?.type===`generated-images`?e.items.push(a):n.push({type:`generated-images`,items:[a]});continue}if(a.type===`assistant-message`){i(t),n.push({type:`assistant-message`,item:a});continue}r.push(a)}return i(!1),n}
function F(e,t=!0,n,r){let i=[],a=N(e,t),o=-1;for(let[e,t]of a.entries())t.type===`user-message`&&(o=e);let s=0;for(let[e,t]of a.entries())switch(t.type){case`activity`:{let a=[],o=0,s=()=>{a.length!==0&&(i.push({type:`agent-activity`,key:I(`transcript-activity`,a,`${e}-${o}`,r),items:a,collapseWhenPossible:t.collapseWhenPossible}),a=[],o+=1)};for(let[r,o]of t.items.entries()){let c=t.items[r-1];if(o.type===`subagent-activity`&&!o.isMessage&&c?.type===`subagent-activity`&&!c.isMessage)continue;let l=o.type===`reasoning`||o.type===`automatic-approval-review`||o.type===`subagent-activity`?null:O(o);if(l?.grouping===`standalone`||n?.has(o)===!0){s(),i.push({type:`activity-item`,key:`transcript-activity-item-${L(o,`${e}-${r}`)}`,item:o});continue}if(o.type===`reasoning`||o.type===`automatic-approval-review`||l!=null){a.push(o);continue}s(),!(o.type===`turn-diff`||o.type===`subagent-activity`&&o.isMessage)&&i.push({type:`activity-item`,key:`transcript-activity-item-${L(o,`${e}-${r}`)}`,item:o})}s();break}case`assistant-message`:i.push({type:`assistant-message`,key:`transcript-assistant-${L(t.item,String(e))}`,item:t.item});break;case`generated-images`:i.push({type:`generated-images`,key:I(`transcript-generated-images`,t.items,String(e),r),items:t.items});break;case`user-message`:i.push({type:`user-message`,key:`transcript-user-${L(t.item,String(e))}`,item:t.item,isFirstUserMessage:s===0,isLastUserMessage:e===o}),s+=1}return i}
function I(e,t,n,r){let i=`${e}-${L(t[0],n)}`;if(r==null||r(i))return i;for(let i=1;i<t.length;i+=1){let a=`${e}-${L(t[i],n)}`;if(r(a))return a}return i}
function L(e,t){let n;return`searchItemId`in e&&e.searchItemId!=null?n=e.searchItemId:`sourceItemId`in e&&e.sourceItemId!=null?n=e.sourceItemId:`id`in e?n=e.id:`callId`in e?n=e.callId:`requestId`in e?n=e.requestId:`handoffId`in e&&(n=e.handoffId),n==null?t:`${e.type}:${typeof n}:${n}`}
return F;}
function bindCommandSelector(){
function t(e){for(let t=e.commandActions.length-1;t>=0;--t){let r=e.commandActions[t]?.command.trim()??``;if(r.length>0&&!n(r))return r}let t=e.command.trim();return n(t)?``:t}
function n(e){return/^(?:.*[/\\])?(?:bash|cmd(?:\.exe)?|fish|powershell(?:\.exe)?|pwsh(?:\.exe)?|sh|zsh)(?:\s|$)/i.test(e)}
return t;}
function bindWebSources(){
function Fvr({label:e,title:t=null,url:n}){try{let r=new URL(n);return r.protocol!==`http:`&&r.protocol!==`https:`||r.username!==``||r.password!==``?null:{label:e?.trim()||`${r.host.replace(/^www\./u,``)}${r.pathname}`,title:t?.trim()||null,url:r.href}}catch{return null}}
function LGn(e){return e.filter(e=>e!=null)}
const m=Fvr,v=LGn;
function q(e){let t=!1,n=0,r=[],i=[],a=new Set,o=new Set,s=e=>{let t=e.trim();t.length!==0&&(n+=1,!a.has(t)&&(a.add(t),r.push(t)))},c=e=>{let t=m({url:e});t==null||o.has(t.url)||(o.add(t.url),i.push(t))};for(let n=e.length-1;n>=0;--n){let r=e[n],i=v(r.items);for(let e=i.length-1;e>=0;--e){let n=i[e];if(n.type!==`webSearch`)continue;t=!0;let r=n.action;if(r==null)s(n.query);else if(r.type===`search`){let e=r.queries==null||r.queries.length===0?[r.query]:r.queries;for(let t of e)t!=null&&s(t)}else r.type===`openPage`||r.type===`findInPage`?r.url!=null&&c(r.url):s(n.query)}}return t?{queries:r,queryCount:n,viewedLinks:i}:null}
return {collect:q,normalizeLink:Fvr};}
const api={bindRenderGroups,bindCommandSelector,bindWebSources};
root.EvaNativeTranscriptCore=Object.freeze(api);
if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
