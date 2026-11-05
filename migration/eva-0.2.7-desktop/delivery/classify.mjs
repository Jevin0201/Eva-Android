// Unchanged shipped local-file preview classification.
const Cpr=new Set([`avif`,`bmp`,`gif`,`ico`,`jpeg`,`jpg`,`png`,`tif`,`tiff`,`webp`]);
const wpr=new Set([`markdown`,`md`,`mdown`,`mdx`,`mkd`]);
const GWa=new Set([`tif`,`tiff`]);
const WWa=new Set([`aac`,`flac`,`m4a`,`mp3`,`mp4a`,`oga`,`ogg`,`opus`,`wav`]);
const iat=/\.html?$/i;
function qit(e){return iat.test(e)}
const Vn=qit;
function WP(e){let t=e.toLowerCase(),n=Math.max(t.lastIndexOf(`/`),t.lastIndexOf(`\\`)),r=n>=0?t.slice(n+1):t,i=r.lastIndexOf(`.`);return i>0&&i<r.length-1?r.slice(i+1):null}
function bpr(e){let t=WP(e);return t==null?`none`:t===`svg`?`toggle`:Cpr.has(t)?`always`:`none`}
function xpr(e){return WP(e)===`pdf`}
function Spr(e){let t=WP(e);return t!=null&&wpr.has(t)}
function zWa(e,t){let n=WP(e)?.replace(/ \(\d+\)$/u,``);return(t==null||t===`image`)&&n!=null&&GWa.has(n)}
function VWa(e){let t=WP(e);return t!=null&&WWa.has(t)}
function HWa(e){let t=WP(e);return t===`mp4`||t===`ogv`||t===`webm`}
function IWa(e,t){let n=zWa(e,t);return t===`image`&&!n?`image`:t===`pdf`?`pdf`:(t==null||t===`audio`)&&VWa(e)?`audio`:(t==null||t===`video`)&&HWa(e)?`video`:t!=null&&t!==`text`?null:t==null&&!n&&bpr(e)!==`none`?`image`:Spr(e)?`markdown`:Vn(e)?`html`:t==null&&xpr(e)?`pdf`:null}
export {IWa as classifyLocalPreview,WP as extension,bpr as imageMode};
