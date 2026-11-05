// Unchanged Windows Codex Markdown output-link scanner. Host resolves filesystem paths.
(()=>{const zvs=new Set(` !"#$%&'()*+,-./:;<=>?@[\\]^_\`{|}~`);
function mvs(e){if(e==null||!e.includes(`](`))return[];let t=[],n=null;for(let r of e.split(/\r?\n/u)){let e=Tvs(r);if(e!=null){n=n==null?e:null;continue}n??hvs(t,r)}return t}
function hvs(e,t){let n=0;for(;n<t.length;){if(t[n]==="`"){let r=_vs(t,n);if(r!=null){let t=gvs(r.value);t!=null&&e.push(t),n=r.nextIndex;continue}}let r=t[n]===`!`&&t[n+1]===`[`?n+1:n;if(t[r]===`[`){let i=vvs(t,r);if(i!=null){e.push({label:i.label,destination:i.destination,syntax:r===n?`link`:`image`}),n=i.nextIndex;continue}}n+=1}}
function gvs(e){let t=e.trim(),n=vvs(t,0);return n==null||n.nextIndex!==t.length?null:{label:n.label,destination:n.destination,syntax:`inline-code`}}
function _vs(e,t){let n=wvs(e,t,"`"),r="`".repeat(n),i=e.indexOf(r,t+n);return i===-1?null:{value:e.slice(t+n,i),nextIndex:i+n}}
function vvs(e,t){let n=yvs(e,t+1);if(n==null||e[n.nextIndex]!==`(`)return null;let r=bvs(e,n.nextIndex+1);return r==null?null:{label:n.value.trim(),destination:r.value,nextIndex:r.nextIndex}}
function yvs(e,t){let n=[],r=0,i=t;for(;i<e.length;){let t=e[i];if(t===`
`||t===`\r`)return null;if(t===`\\`){n.push(e[i+1]??t),i+=e[i+1]==null?1:2;continue}if(t===`[`){r+=1,n.push(t),i+=1;continue}if(t===`]`){if(r===0)return{value:n.join(``),nextIndex:i+1};--r,n.push(t),i+=1;continue}n.push(t),i+=1}return null}
function bvs(e,t){let n=Cvs(e,t);if(e[n]===`<`)return xvs(e,n+1);let r=[],i=0;for(;n<e.length;){let t=e[n];if(t===`
`||t===`\r`)return null;if(t===`\\`&&zvs.has(e[n+1]??``)){r.push(e[n+1]??t),n+=e[n+1]==null?1:2;continue}if(t===`(`){i+=1,r.push(t),n+=1;continue}if(t===`)`){if(i===0)return{value:r.join(``).trim(),nextIndex:n+1};--i,r.push(t),n+=1;continue}if((t===` `||t===`	`)&&i===0){let t=e[Cvs(e,n)];if(t===`"`||t===`'`||t===`(`)return Svs(e,n,r.join(``).trim())}r.push(t),n+=1}return null}
function xvs(e,t){let n=[],r=t;for(;r<e.length;){let t=e[r];if(t===`
`||t===`\r`)return null;if(t===`\\`&&zvs.has(e[r+1]??``)){n.push(e[r+1]??t),r+=e[r+1]==null?1:2;continue}if(t===`>`)return Svs(e,r+1,n.join(``).trim());n.push(t),r+=1}return null}
function Svs(e,t,n){let r=Cvs(e,t);for(;r<e.length;){let t=e[r];if(t===`
`||t===`\r`)return null;if(t===`\\`){r+=e[r+1]==null?1:2;continue}if(t===`)`)return{value:n,nextIndex:r+1};r+=1}return null}
function Cvs(e,t){let n=t;for(;e[n]===` `||e[n]===`	`;)n+=1;return n}
function wvs(e,t,n){let r=0;for(;e[t+r]===n;)r+=1;return r}
function Tvs(e){let t=e.match(/^ {0,3}(`{3,}|~{3,})/u);return t==null?null:t[1]?.startsWith("`")?"`":`~`}
globalThis.EvaDeliverySource={scanLinks:mvs};})();
