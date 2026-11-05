import * as React from "react";
import {a as e,n as t,o as n,r,t as i} from "./original-rolldown-runtime.mjs";
// EVA adapter: share the host React instance; all selected motion bodies remain verbatim.
const o=()=>React;
var Zce=i((e=>{var t=Symbol.for(`react.transitional.element`),n=Symbol.for(`react.fragment`);function r(e,n,r){var i=null;if(r!==void 0&&(i=``+r),n.key!==void 0&&(i=``+n.key),`key`in n)for(var a in r={},n)a!==`key`&&(r[a]=n[a]);else r=n;return n=r.ref,{$$typeof:t,type:e,key:i,ref:n===void 0?null:n,props:r}}e.Fragment=n,e.jsx=r,e.jsxs=r}));
var Y=i(((e,t)=>{t.exports=Zce()}));
function qM(e,t){e.indexOf(t)===-1&&e.push(t)}
function JM(e,t){let n=e.indexOf(t);n>-1&&e.splice(n,1)}
var YM;
function XM(){return(XM=t((()=>{YM=(e,t,n)=>n>t?t:n<e?e:n})))()}
var ZM;
var QM;
function $M(){return($M=t((()=>{ZM=()=>{},QM=()=>{}})))()}
var eN;
function tN(){return(tN=t((()=>{eN={}})))()}
var nN;
function rN(){return(rN=t((()=>{nN=e=>/^-?(?:\d+(?:\.\d+)?|\.\d+)$/u.test(e)})))()}
var iN;
function aN(){return(aN=t((()=>{iN=e=>typeof e==`object`&&!!e})))()}
var oN;
function sN(){return(sN=t((()=>{oN=e=>/^0[^.\s]+$/u.test(e)})))()}
function SNe(e){let t;return()=>(t===void 0&&(t=e()),t)}
var cN;
function lN(){return(lN=t((()=>{cN=e=>e})))()}
var uN;
function dN(){return(dN=t((()=>{uN=(...e)=>e.reduce((e,t)=>n=>t(e(n)))})))()}
var fN;
function pN(){return(pN=t((()=>{fN=(e,t,n)=>{let r=t-e;return r?(n-e)/r:1}})))()}
var mN;
function hN(){return(hN=t((()=>{mN=class{constructor(){this.subscriptions=[]}add(e){return qM(this.subscriptions,e),()=>JM(this.subscriptions,e)}notify(e,t,n){let r=this.subscriptions.length;if(r){if(r===1)this.subscriptions[0](e,t,n);else for(let i=0;i<r;i++){let r=this.subscriptions[i];r&&r(e,t,n)}}}getSize(){return this.subscriptions.length}clear(){this.subscriptions.length=0}}})))()}
var gN;
var _N;
function vN(){return(vN=t((()=>{gN=e=>e*1e3,_N=e=>e/1e3})))()}
var yN;
function bN(){return(bN=t((()=>{yN=(e,t)=>t?1e3/t*e:0})))()}
function TNe(e,t,n,r,i){let a,o,s=0;do o=t+(n-t)/2,a=SN(o,r,i)-e,a>0?n=o:t=o;while(Math.abs(a)>ENe&&++s<DNe);return o}
function xN(e,t,n,r){if(e===t&&n===r)return cN;let i=t=>TNe(t,0,1,e,n);return e=>e===0||e===1?e:SN(i(e),t,r)}
var SN;
var ENe;
var DNe;
function CN(){return(CN=t((()=>{lN(),SN=(e,t,n)=>(((1-3*n+3*t)*e+(3*n-6*t))*e+3*t)*e,ENe=1e-7,DNe=12})))()}
var wN;
function TN(){return(TN=t((()=>{wN=e=>t=>t<=.5?e(2*t)/2:(2-e(2*(1-t)))/2})))()}
var EN;
function DN(){return(DN=t((()=>{EN=e=>t=>1-e(1-t)})))()}
var ON;
var kN;
var AN;
function jN(){return(jN=t((()=>{CN(),TN(),DN(),ON=xN(.33,1.53,.69,.99),kN=EN(ON),AN=wN(kN)})))()}
var MN;
function NN(){return(NN=t((()=>{jN(),MN=e=>e>=1?1:(e*=2)<1?.5*kN(e):.5*(2-2**(-10*(e-1)))})))()}
var PN;
var FN;
var IN;
function LN(){return(LN=t((()=>{TN(),DN(),PN=e=>1-Math.sin(Math.acos(e)),FN=EN(PN),IN=wN(PN)})))()}
var ONe;
var kNe;
var RN;
function zN(){return(zN=t((()=>{CN(),ONe=xN(.42,0,1,1),kNe=xN(0,0,.58,1),RN=xN(.42,0,.58,1)})))()}
var BN;
function VN(){return(VN=t((()=>{BN=e=>Array.isArray(e)&&typeof e[0]!=`number`})))()}
var UN;
function WN(){return(WN=t((()=>{UN=e=>Array.isArray(e)&&typeof e[0]==`number`})))()}
var GN;
var jNe;
var KN;
function qN(){return(qN=t((()=>{$M(),lN(),NN(),jN(),LN(),CN(),zN(),WN(),GN={linear:cN,easeIn:ONe,easeInOut:RN,easeOut:kNe,circIn:PN,circInOut:IN,circOut:FN,backIn:kN,backInOut:AN,backOut:ON,anticipate:MN},jNe=e=>typeof e==`string`,KN=e=>{if(UN(e)){QM(e.length===4,`Cubic bezier arrays must contain four numerical values.`,`cubic-bezier-length`);let[t,n,r,i]=e;return xN(t,n,r,i)}return jNe(e)?(QM(GN[e]!==void 0,`Invalid easing type '${e}'`,`invalid-easing-type`),GN[e]):e}})))()}
var JN;
function MNe(){return(MNe=t((()=>{JN=[`setup`,`read`,`resolveKeyframes`,`preUpdate`,`update`,`preRender`,`render`,`postRender`]})))()}
function NNe(e){let t=new Set,n=new Set,r=!1,i=!1,a=new WeakSet,o={delta:0,timestamp:0,isProcessing:!1};function s(t){a.has(t)&&(c.schedule(t),e()),t(o)}let c={schedule:(e,i=!1,o=!1)=>{let s=o&&r?t:n;return i&&a.add(e),s.add(e),e},cancel:e=>{n.delete(e),a.delete(e)},process:e=>{if(o=e,r){i=!0;return}r=!0;let a=t;t=n,n=a,t.forEach(s),t.clear(),r=!1,i&&(i=!1,c.process(e))}};return c}
function PNe(e,t){let n=!1,r=!0,i={delta:0,timestamp:0,isProcessing:!1},a=()=>n=!0,o=JN.reduce((e,t)=>(e[t]=NNe(a),e),{}),{setup:s,read:c,resolveKeyframes:l,preUpdate:u,update:d,preRender:f,render:p,postRender:m}=o,h=()=>{let a=eN.useManualTiming,o=a?i.timestamp:performance.now();n=!1,a||(i.delta=r?1e3/60:Math.max(Math.min(o-i.timestamp,FNe),1)),i.timestamp=o,i.isProcessing=!0,s.process(i),c.process(i),l.process(i),u.process(i),d.process(i),f.process(i),p.process(i),m.process(i),i.isProcessing=!1,n&&t&&(r=!1,e(h))},g=()=>{n=!0,r=!0,i.isProcessing||e(h)};return{schedule:JN.reduce((e,t)=>{let r=o[t];return e[t]=(e,t=!1,i=!1)=>(n||g(),r.schedule(e,t,i)),e},{}),cancel:e=>{for(let t=0;t<JN.length;t++)o[JN[t]].cancel(e)},state:i,steps:o}}
var FNe;
function YN(){return(YN=t((()=>{tN(),MNe(),FNe=40})))()}
var XN;
var ZN;
var QN;
var $N;
function eP(){return(eP=t((()=>{lN(),YN(),{schedule:XN,cancel:ZN,state:QN,steps:$N}=PNe(typeof requestAnimationFrame<`u`?requestAnimationFrame:cN,!0)})))()}
function INe(){tP=void 0}
var tP;
var nP;
function rP(){return(rP=t((()=>{tN(),eP(),nP={now:()=>(tP===void 0&&nP.set(QN.isProcessing||eN.useManualTiming?QN.timestamp:performance.now()),tP),set:e=>{tP=e,queueMicrotask(INe)}}})))()}
function LNe(e){return typeof e==`string`&&e.split(`/*`)[0].includes(`var(--`)}
var iP;
var aP;
var RNe;
var oP;
var zNe;
function sP(){return(sP=t((()=>{iP=e=>t=>typeof t==`string`&&t.startsWith(e),aP=iP(`--`),RNe=iP(`var(--`),oP=e=>RNe(e)?zNe.test(e.split(`/*`)[0].trim()):!1,zNe=/var\(--(?:[\w-]+\s*|[\w-]+\s*,(?:\s*[^)(\s]|\s*\((?:[^)(]|\([^)(]*\))*\))+\s*)\)$/iu})))()}
var cP;
var lP;
var uP;
function dP(){return(dP=t((()=>{XM(),cP={test:e=>typeof e==`number`,parse:parseFloat,transform:e=>e},lP={...cP,transform:e=>YM(0,1,e)},uP={...cP,default:1}})))()}
var fP;
function pP(){return(pP=t((()=>{fP=e=>Math.round(e*1e5)/1e5})))()}
var mP;
function hP(){return(hP=t((()=>{mP=/-?(?:\d+(?:\.\d+)?|\.\d+)/gu})))()}
function BNe(e){return e==null}
var VNe;
function HNe(){return(HNe=t((()=>{VNe=/^(?:#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\))$/iu})))()}
var gP;
var _P;
function vP(){return(vP=t((()=>{hP(),HNe(),gP=(e,t)=>n=>!!(typeof n==`string`&&VNe.test(n)&&n.startsWith(e)||t&&!BNe(n)&&Object.prototype.hasOwnProperty.call(n,t)),_P=(e,t,n)=>r=>{if(typeof r!=`string`)return r;let[i,a,o,s]=r.match(mP);return{[e]:parseFloat(i),[t]:parseFloat(a),[n]:parseFloat(o),alpha:s===void 0?1:parseFloat(s)}}})))()}
var UNe;
var yP;
var bP;
function xP(){return(xP=t((()=>{XM(),dP(),pP(),vP(),UNe=e=>YM(0,255,e),yP={...cP,transform:e=>Math.round(UNe(e))},bP={test:gP(`rgb`,`red`),parse:_P(`red`,`green`,`blue`),transform:({red:e,green:t,blue:n,alpha:r=1})=>`rgba(`+yP.transform(e)+`, `+yP.transform(t)+`, `+yP.transform(n)+`, `+fP(lP.transform(r))+`)`}})))()}
function WNe(e){let t=``,n=``,r=``,i=``;return e.length>5?(t=e.substring(1,3),n=e.substring(3,5),r=e.substring(5,7),i=e.substring(7,9)):(t=e.substring(1,2),n=e.substring(2,3),r=e.substring(3,4),i=e.substring(4,5),t+=t,n+=n,r+=r,i+=i),{red:parseInt(t,16),green:parseInt(n,16),blue:parseInt(r,16),alpha:i?parseInt(i,16)/255:1}}
var SP;
function CP(){return(CP=t((()=>{xP(),vP(),SP={test:gP(`#`),parse:WNe,transform:bP.transform}})))()}
var wP;
var TP;
var EP;
var DP;
var GNe;
var KNe;
var OP;
function kP(){return(kP=t((()=>{wP=e=>({test:t=>typeof t==`string`&&t.endsWith(e)&&t.split(` `).length===1,parse:parseFloat,transform:t=>`${t}${e}`}),TP=wP(`deg`),EP=wP(`%`),DP=wP(`px`),GNe=wP(`vh`),KNe=wP(`vw`),OP={...EP,parse:e=>EP.parse(e)/100,transform:e=>EP.transform(e*100)}})))()}
var AP;
function jP(){return(jP=t((()=>{dP(),kP(),pP(),vP(),AP={test:gP(`hsl`,`hue`),parse:_P(`hue`,`saturation`,`lightness`),transform:({hue:e,saturation:t,lightness:n,alpha:r=1})=>`hsla(`+Math.round(e)+`, `+EP.transform(fP(t))+`, `+EP.transform(fP(n))+`, `+fP(lP.transform(r))+`)`}})))()}
var MP;
function NP(){return(NP=t((()=>{CP(),jP(),xP(),MP={test:e=>bP.test(e)||SP.test(e)||AP.test(e),parse:e=>bP.test(e)?bP.parse(e):AP.test(e)?AP.parse(e):SP.parse(e),transform:e=>typeof e==`string`?e:e.hasOwnProperty(`red`)?bP.transform(e):AP.transform(e),getAnimatableNone:e=>{let t=MP.parse(e);return t.alpha=0,MP.transform(t)}}})))()}
var qNe;
function JNe(){return(JNe=t((()=>{qNe=/(?:#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\))/giu})))()}
function YNe(e){return isNaN(e)&&typeof e==`string`&&(e.match(mP)?.length||0)+(e.match(qNe)?.length||0)>0}
function PP(e){let t=e.toString(),n=[],r={color:[],number:[],var:[]},i=[],a=0;return{values:n,split:t.replace(nPe,e=>(MP.test(e)?(r.color.push(a),i.push(IP),n.push(MP.parse(e))):e.startsWith(tPe)?(r.var.push(a),i.push(ePe),n.push(e)):(r.number.push(a),i.push(FP),n.push(parseFloat(e))),++a,LP)).split(LP),indexes:r,types:i}}
function XNe(e){return PP(e).values}
function ZNe({split:e,types:t}){let n=e.length;return r=>{let i=``;for(let a=0;a<n;a++)if(i+=e[a],r[a]!==void 0){let e=t[a];i+=e===FP?fP(r[a]):e===IP?MP.transform(r[a]):r[a]}return i}}
function QNe(e){return ZNe(PP(e))}
function $Ne(e){let t=PP(e);return ZNe(t)(t.values.map((e,n)=>iPe(e,t.split[n])))}
var FP;
var IP;
var ePe;
var tPe;
var LP;
var nPe;
var rPe;
var iPe;
var RP;
function zP(){return(zP=t((()=>{NP(),JNe(),hP(),pP(),FP=`number`,IP=`color`,ePe=`var`,tPe=`var(`,LP="${}",nPe=/var\s*\(\s*--(?:[\w-]+\s*|[\w-]+\s*,(?:\s*[^)(\s]|\s*\((?:[^)(]|\([^)(]*\))*\))+\s*)\)|#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\)|-?(?:\d+(?:\.\d+)?|\.\d+)/giu,rPe=e=>typeof e==`number`?0:MP.test(e)?MP.getAnimatableNone(e):e,iPe=(e,t)=>typeof e==`number`?t?.trim().endsWith(`/`)?e:0:rPe(e),RP={test:YNe,parse:XNe,createTransformer:QNe,getAnimatableNone:$Ne}})))()}
function BP(e,t,n){return n<0&&(n+=1),n>1&&--n,n<1/6?e+(t-e)*6*n:n<1/2?t:n<2/3?e+(t-e)*(2/3-n)*6:e}
function aPe({hue:e,saturation:t,lightness:n,alpha:r}){e/=360,t/=100,n/=100;let i=0,a=0,o=0;if(!t)i=a=o=n;else{let r=n<.5?n*(1+t):n+t-n*t,s=2*n-r;i=BP(s,r,e+1/3),a=BP(s,r,e),o=BP(s,r,e-1/3)}return{red:Math.round(i*255),green:Math.round(a*255),blue:Math.round(o*255),alpha:r}}
function VP(e,t){return n=>n>0?t:e}
var HP;
function UP(){return(UP=t((()=>{HP=(e,t,n)=>e+(t-e)*n})))()}
function oPe(e){let t=cPe(e);if(ZM(!!t,`'${e}' is not an animatable color. Use the equivalent color code instead.`,`color-not-animatable`),!t)return!1;let n=t.parse(e);return t===AP&&(n=aPe(n)),n}
var WP;
var sPe;
var cPe;
var GP;
function lPe(){return(lPe=t((()=>{$M(),CP(),jP(),xP(),UP(),WP=(e,t,n)=>{let r=e*e,i=n*(t*t-r)+r;return i<0?0:Math.sqrt(i)},sPe=[SP,bP,AP],cPe=e=>sPe.find(t=>t.test(e)),GP=(e,t)=>{let n=oPe(e),r=oPe(t);if(!n||!r)return VP(e,t);let i={...n};return e=>(i.red=WP(n.red,r.red,e),i.green=WP(n.green,r.green,e),i.blue=WP(n.blue,r.blue,e),i.alpha=HP(n.alpha,r.alpha,e),bP.transform(i))}})))()}
function uPe(e,t){return KP.has(e)?n=>n<=0?e:t:n=>n>=1?t:e}
var KP;
function dPe(){return(dPe=t((()=>{KP=new Set([`none`,`hidden`])})))()}
function fPe(e,t){return n=>HP(e,t,n)}
function qP(e){return typeof e==`number`?fPe:typeof e==`string`?oP(e)?VP:MP.test(e)?GP:gPe:Array.isArray(e)?pPe:typeof e==`object`?MP.test(e)?GP:mPe:VP}
function pPe(e,t){let n=[...e],r=n.length,i=e.map((e,n)=>qP(e)(e,t[n]));return e=>{for(let t=0;t<r;t++)n[t]=i[t](e);return n}}
function mPe(e,t){let n={...e,...t},r={};for(let i in n)e[i]!==void 0&&t[i]!==void 0&&(r[i]=qP(e[i])(e[i],t[i]));return e=>{for(let t in r)n[t]=r[t](e);return n}}
function hPe(e,t){let n=[],r={color:0,var:0,number:0};for(let i=0;i<t.values.length;i++){let a=t.types[i],o=e.indexes[a][r[a]],s=e.values[o]??0;n[i]=s,r[a]++}return n}
var gPe;
function _Pe(){return(_Pe=t((()=>{dN(),$M(),sP(),NP(),zP(),lPe(),UP(),dPe(),gPe=(e,t)=>{let n=RP.createTransformer(t),r=PP(e),i=PP(t);return r.indexes.var.length===i.indexes.var.length&&r.indexes.color.length===i.indexes.color.length&&r.indexes.number.length>=i.indexes.number.length?KP.has(e)&&!i.values.length||KP.has(t)&&!r.values.length?uPe(e,t):uN(pPe(hPe(r,i),i.values),n):(ZM(!0,`Complex values '${e}' and '${t}' too different to mix. Ensure all colors are of the same type, and that each contains the same quantity of number and color values. Falling back to instant transition.`,`complex-values-different`),VP(e,t))}})))()}
function JP(e,t,n){return typeof e==`number`&&typeof t==`number`&&typeof n==`number`?HP(e,t,n):qP(e)(e,t)}
function YP(){return(YP=t((()=>{_Pe(),UP()})))()}
var vPe;
function yPe(){return(yPe=t((()=>{rP(),eP(),vPe=e=>{let t=({timestamp:t})=>e(t);return{start:(e=!0)=>XN.update(t,e),stop:()=>ZN(t),now:()=>QN.isProcessing?QN.timestamp:nP.now()}}})))()}
var XP;
function ZP(){return(ZP=t((()=>{XP=(e,t,n=10)=>{let r=``,i=Math.max(Math.round(t/n),2);for(let t=0;t<i;t++)r+=Math.round(e(t/(i-1))*1e4)/1e4+`, `;return`linear(${r.substring(0,r.length-2)})`}})))()}
function QP(e){let t=0,n=e.next(t);for(;!n.done&&t<2e4;)t+=50,n=e.next(t);return t>=2e4?1/0:t}
var $P;
function eF(){return(eF=t((()=>{$P=2e4})))()}
function tF(e,t=100,n){let r=n({...e,keyframes:[0,t]}),i=Math.min(QP(r),$P);return{type:`keyframes`,ease:e=>r.next(i*e).value/t,duration:_N(i)}}
function nF(){return(nF=t((()=>{vN(),eF()})))()}
function rF(e,t){return e*Math.sqrt(1-t*t)}
function bPe(e,t,n){let r=n;for(let n=1;n<wPe;n++)r-=e(r)/t(r);return r}
function xPe({duration:e=aF.duration,bounce:t=aF.bounce,velocity:n=aF.velocity,mass:r=aF.mass}){let i,a;ZM(e<=gN(aF.maxDuration),`Spring duration must be 10 seconds or less`,`spring-duration-limit`);let o=1-t;o=YM(aF.minDamping,aF.maxDamping,o),e=YM(aF.minDuration,aF.maxDuration,_N(e)),o<1?(i=t=>{let r=t*o,i=r*e,a=r-n,s=rF(t,o),c=Math.exp(-i);return oF-a/s*c},a=t=>{let r=t*o*e,a=r*n+n,s=o**2*t**2*e,c=Math.exp(-r),l=rF(t**2,o);return(-i(t)+oF>0?-1:1)*((a-s)*c)/l}):(i=t=>-.001+Math.exp(-t*e)*((t-n)*e+1),a=t=>Math.exp(-t*e)*((n-t)*(e*e)));let s=5/e,c=bPe(i,a,s);if(e=gN(e),isNaN(c))return{stiffness:aF.stiffness,damping:aF.damping,duration:e};{let t=c**2*r;return{stiffness:t,damping:o*2*Math.sqrt(r*t),duration:e}}}
function SPe(e,t){return t.some(t=>e[t]!==void 0)}
function CPe(e){let t={velocity:aF.velocity,stiffness:aF.stiffness,damping:aF.damping,mass:aF.mass,isResolvedFromDuration:!1,...e};if(!SPe(e,EPe)&&SPe(e,TPe)){if(t.velocity=0,e.visualDuration){let n=e.visualDuration,r=2*Math.PI/(n*1.2),i=r*r,a=2*YM(.05,1,1-(e.bounce||0))*Math.sqrt(i);t={...t,mass:aF.mass,stiffness:i,damping:a}}else{let n=xPe({...e,velocity:0});t={...t,...n,mass:aF.mass},t.isResolvedFromDuration=!0}}return t}
function iF(e=aF.visualDuration,t=aF.bounce){let n=typeof e==`object`?e:{visualDuration:e,keyframes:[0,1],bounce:t},{restSpeed:r,restDelta:i}=n,a=n.keyframes[0],o=n.keyframes[n.keyframes.length-1],s={done:!1,value:a},{stiffness:c,damping:l,mass:u,duration:d,velocity:f,isResolvedFromDuration:p}=CPe({...n,velocity:-_N(n.velocity||0)}),m=f||0,h=l/(2*Math.sqrt(c*u)),g=o-a,_=_N(Math.sqrt(c/u)),v=Math.abs(g)<5;r||=v?aF.restSpeed.granular:aF.restSpeed.default,i||=v?aF.restDelta.granular:aF.restDelta.default;let y,b,x,S,C,w;if(h<1)x=rF(_,h),S=(m+h*_*g)/x,y=e=>{let t=Math.exp(-h*_*e);return o-t*(S*Math.sin(x*e)+g*Math.cos(x*e))},C=h*_*S+g*x,w=h*_*g-S*x,b=e=>Math.exp(-h*_*e)*(C*Math.sin(x*e)+w*Math.cos(x*e));else if(h===1){y=e=>o-Math.exp(-_*e)*(g+(m+_*g)*e);let e=m+_*g;b=t=>Math.exp(-_*t)*(_*e*t-m)}else{let e=_*Math.sqrt(h*h-1);y=t=>{let n=Math.exp(-h*_*t),r=Math.min(e*t,300);return o-n*((m+h*_*g)*Math.sinh(r)+e*g*Math.cosh(r))/e};let t=(m+h*_*g)/e,n=h*_*t-g*e,r=h*_*g-t*e;b=t=>{let i=Math.exp(-h*_*t),a=Math.min(e*t,300);return i*(n*Math.sinh(a)+r*Math.cosh(a))}}let T={calculatedDuration:p&&d||null,velocity:e=>gN(b(e)),next:e=>{if(!p&&h<1){let t=Math.exp(-h*_*e),n=Math.sin(x*e),a=Math.cos(x*e),c=o-t*(S*n+g*a),l=gN(t*(C*n+w*a));return s.done=Math.abs(l)<=r&&Math.abs(o-c)<=i,s.value=s.done?o:c,s}let t=y(e);if(p)s.done=e>=d;else{let n=gN(b(e));s.done=Math.abs(n)<=r&&Math.abs(o-t)<=i}return s.value=s.done?o:t,s},toString:()=>{let e=Math.min(QP(T),$P),t=XP(t=>T.next(e*t).value,e,30);return e+`ms `+t},toTransition:()=>{}};return T}
var aF;
var wPe;
var oF;
var TPe;
var EPe;
function sF(){return(sF=t((()=>{vN(),XM(),$M(),ZP(),eF(),nF(),aF={stiffness:100,damping:10,mass:1,velocity:0,duration:800,bounce:.3,visualDuration:.3,restSpeed:{granular:.01,default:2},restDelta:{granular:.005,default:.5},minDuration:.01,maxDuration:10,minDamping:.05,maxDamping:1},wPe=12,oF=.001,TPe=[`duration`,`bounce`],EPe=[`stiffness`,`damping`,`mass`],iF.applyToOptions=e=>{let t=tF(e,100,iF);return e.ease=t.ease,e.duration=gN(t.duration),e.type=`keyframes`,e}})))()}
function DPe(e,t,n){let r=Math.max(t-OPe,0);return yN(n-e(r),t-r)}
var OPe;
function cF(){return(cF=t((()=>{bN(),OPe=5})))()}
function lF({keyframes:e,velocity:t=0,power:n=.8,timeConstant:r=325,bounceDamping:i=10,bounceStiffness:a=500,modifyTarget:o,min:s,max:c,restDelta:l=.5,restSpeed:u}){let d=e[0],f={done:!1,value:d},p=e=>s!==void 0&&e<s||c!==void 0&&e>c,m=e=>s===void 0?c:c===void 0||Math.abs(s-e)<Math.abs(c-e)?s:c,h=n*t,g=d+h,_=o===void 0?g:o(g);_!==g&&(h=_-d);let v=e=>-h*Math.exp(-e/r),y=e=>_+v(e),b=e=>{let t=v(e),n=y(e);f.done=Math.abs(t)<=l,f.value=f.done?_:n},x,S,C=e=>{p(f.value)&&(x=e,S=iF({keyframes:[f.value,m(f.value)],velocity:DPe(y,e,f.value),damping:i,stiffness:a,restDelta:l,restSpeed:u}))};return C(0),{calculatedDuration:null,next:e=>{let t=!1;return!S&&x===void 0&&(t=!0,b(e),C(e)),x!==void 0&&e>=x?S.next(e-x):(!t&&b(e),f)}}}
function uF(){return(uF=t((()=>{sF(),cF()})))()}
function kPe(e,t,n){let r=[],i=n||eN.mix||JP,a=e.length-1;for(let n=0;n<a;n++){let a=i(e[n],e[n+1]);if(t){let e=Array.isArray(t)?t[n]||cN:t;a=uN(e,a)}r.push(a)}return r}
function dF(e,t,{clamp:n=!0,ease:r,mixer:i}={}){let a=e.length;if(QM(a===t.length,`Both input and output ranges must be the same length`,`range-length`),a===1)return()=>t[0];if(a===2&&t[0]===t[1])return()=>t[1];let o=e[0]===e[1];e[0]>e[a-1]&&(e=[...e].reverse(),t=[...t].reverse());let s=kPe(t,r,i),c=s.length,l=n=>{if(o&&n<e[0])return t[0];let r=0;if(c>1)for(;r<e.length-2&&!(n<e[r+1]);r++);let i=fN(e[r],e[r+1],n);return s[r](i)};return n?t=>l(YM(e[0],e[a-1],t)):l}
function fF(){return(fF=t((()=>{$M(),XM(),tN(),lN(),dN(),pN(),YP()})))()}
function APe(e,t){let n=e[e.length-1];for(let r=1;r<=t;r++){let i=fN(0,t,r);e.push(HP(n,1,i))}}
function pF(){return(pF=t((()=>{pN(),UP()})))()}
function jPe(e){let t=[0];return APe(t,e.length-1),t}
function mF(){return(mF=t((()=>{pF()})))()}
function MPe(e,t){return e.map(e=>e*t)}
function NPe(e,t){return e.map(()=>t||RN).splice(0,e.length-1)}
function hF({duration:e=300,keyframes:t,times:n,ease:r=`easeInOut`}){let i=BN(r)?r.map(KN):KN(r),a={done:!1,value:t[0]},o=dF(MPe(n&&n.length===t.length?n:jPe(t),e),t,{ease:Array.isArray(i)?i:NPe(t,i)});return{calculatedDuration:e,next:t=>(a.value=o(t),a.done=t>=e,a)}}
function gF(){return(gF=t((()=>{zN(),VN(),qN(),fF(),mF()})))()}
function _F(e,{repeat:t,repeatType:n=`loop`},r,i=1){let a=e.filter(PPe),o=i<0||t&&n!==`loop`&&t%2==1?0:a.length-1;return!o||r===void 0?a[o]:r}
var PPe;
function vF(){return(vF=t((()=>{PPe=e=>e!==null})))()}
function FPe(e){typeof e.type==`string`&&(e.type=IPe[e.type])}
var IPe;
function yF(){return(yF=t((()=>{uF(),gF(),sF(),IPe={decay:lF,inertia:lF,tween:hF,keyframes:hF,spring:iF}})))()}
var bF;
function xF(){return(xF=t((()=>{bF=class{constructor(){this.updateFinished()}get finished(){return this._finished}updateFinished(){this._finished=new Promise(e=>{this.resolve=e})}notifyFinished(){this.resolve()}then(e,t){return this.finished.then(e,t)}}})))()}
var LPe;
var SF;
function CF(){return(CF=t((()=>{dN(),XM(),vN(),rP(),YP(),yPe(),uF(),gF(),eF(),cF(),vF(),yF(),xF(),LPe=e=>e/100,SF=class extends bF{constructor(e){super(),this.state=`idle`,this.startTime=null,this.isStopped=!1,this.currentTime=0,this.holdTime=null,this.playbackSpeed=1,this.delayState={done:!1,value:void 0},this.stop=()=>{let{motionValue:e}=this.options;e&&e.updatedAt!==nP.now()&&this.tick(nP.now()),this.isStopped=!0,this.state!==`idle`&&(this.teardown(),this.options.onStop?.())},this.options=e,this.initAnimation(),this.play(),e.autoplay===!1&&this.pause()}initAnimation(){let{options:e}=this;FPe(e);let{type:t=hF,repeat:n=0,repeatDelay:r=0,repeatType:i,velocity:a=0}=e,{keyframes:o}=e,s=t||hF;s!==hF&&typeof o[0]!=`number`&&(this.mixKeyframes=uN(LPe,JP(o[0],o[1])),o=[0,100]);let c=s({...e,keyframes:o});i===`mirror`&&(this.mirroredGenerator=s({...e,keyframes:[...o].reverse(),velocity:-a})),c.calculatedDuration===null&&(c.calculatedDuration=QP(c));let{calculatedDuration:l}=c;this.calculatedDuration=l,this.resolvedDuration=l+r,this.totalDuration=this.resolvedDuration*(n+1)-r,this.generator=c}updateTime(e){let t=Math.round(e-this.startTime)*this.playbackSpeed;this.currentTime=this.holdTime===null?t:this.holdTime}tick(e,t=!1){let{generator:n,totalDuration:r,mixKeyframes:i,mirroredGenerator:a,resolvedDuration:o,calculatedDuration:s}=this;if(this.startTime===null)return n.next(0);let{delay:c=0,keyframes:l,repeat:u,repeatType:d,repeatDelay:f,type:p,onUpdate:m,finalKeyframe:h}=this.options;this.speed>0?this.startTime=Math.min(this.startTime,e):this.speed<0&&(this.startTime=Math.min(e-r/this.speed,this.startTime)),t?this.currentTime=e:this.updateTime(e);let g=this.currentTime-c*(this.playbackSpeed>=0?1:-1),_=this.playbackSpeed>=0?g<0:g>r;this.currentTime=Math.max(g,0),this.state===`finished`&&this.holdTime===null&&(this.currentTime=r);let v=this.currentTime,y=n;if(u){let e=Math.min(this.currentTime,r)/o,t=Math.floor(e),n=e%1;!n&&e>=1&&(n=1),n===1&&t--,t=Math.min(t,u+1),t%2&&(d===`reverse`?(n=1-n,f&&(n-=f/o)):d===`mirror`&&(y=a)),v=YM(0,1,n)*o}let b;_?(this.delayState.value=l[0],b=this.delayState):b=y.next(v),i&&!_&&(b.value=i(b.value));let{done:x}=b;!_&&s!==null&&(x=this.playbackSpeed>=0?this.currentTime>=r:this.currentTime<=0);let S=this.holdTime===null&&(this.state===`finished`||this.state===`running`&&x);return S&&p!==lF&&(b.value=_F(l,this.options,h,this.speed)),m&&m(b.value),S&&this.finish(),b}then(e,t){return this.finished.then(e,t)}get duration(){return _N(this.calculatedDuration)}get iterationDuration(){let{delay:e=0}=this.options||{};return this.duration+_N(e)}get time(){return _N(this.currentTime)}set time(e){e=gN(e),this.currentTime=e,this.startTime===null||this.holdTime!==null||this.playbackSpeed===0?this.holdTime=e:this.driver&&(this.startTime=this.driver.now()-e/this.playbackSpeed),this.driver?this.driver.start(!1):(this.startTime=0,this.state=`paused`,this.holdTime=e,this.tick(e))}getGeneratorVelocity(){let e=this.currentTime;if(e<=0)return this.options.velocity||0;if(this.generator.velocity)return this.generator.velocity(e);let t=this.generator.next(e).value;return DPe(e=>this.generator.next(e).value,e,t)}get speed(){return this.playbackSpeed}set speed(e){let t=this.playbackSpeed!==e;t&&this.driver&&this.updateTime(nP.now()),this.playbackSpeed=e,t&&this.driver&&(this.time=_N(this.currentTime))}play(){if(this.isStopped)return;let{driver:e=vPe,startTime:t}=this.options;this.driver||=e(e=>this.tick(e)),this.options.onPlay?.();let n=this.driver.now();this.state===`finished`?(this.updateFinished(),this.startTime=n):this.holdTime===null?this.startTime||=t??n:this.startTime=n-this.holdTime,this.state===`finished`&&this.speed<0&&(this.startTime+=this.calculatedDuration),this.holdTime=null,this.state=`running`,this.driver.start()}pause(){this.state=`paused`,this.updateTime(nP.now()),this.holdTime=this.currentTime}complete(){this.state!==`running`&&this.play(),this.state=`finished`,this.holdTime=null}finish(){this.notifyFinished(),this.teardown(),this.state=`finished`,this.options.onComplete?.()}cancel(){this.holdTime=null,this.startTime=0,this.tick(0),this.teardown(),this.options.onCancel?.()}teardown(){this.state=`idle`,this.stopDriver(),this.startTime=this.holdTime=null}stopDriver(){this.driver&&=(this.driver.stop(),void 0)}sample(e){return this.startTime=0,this.tick(e,!0)}attachTimeline(e){return this.options.allowFlatten&&(this.options.type=`keyframes`,this.options.ease=`linear`,this.initAnimation()),this.driver?.stop(),e.observe(this)}}})))()}
function RPe(e){for(let t=1;t<e.length;t++)e[t]??(e[t]=e[t-1])}
function wF(e){return+!!e.includes(`scale`)}
function TF(e,t){if(!e||e===`none`)return wF(t);let n=e.match(/^matrix3d\(([-\d.e\s,]+)\)$/u),r,i;if(n)r=VPe,i=n;else{let t=e.match(/^matrix\(([-\d.e\s,]+)\)$/u);r=BPe,i=t}if(!i)return wF(t);let a=r[t],o=i[1].split(`,`).map(zPe);return typeof a==`function`?a(o):o[a]}
function zPe(e){return parseFloat(e.trim())}
var EF;
var DF;
var BPe;
var OF;
var kF;
var AF;
var jF;
var VPe;
var HPe;
function MF(){return(MF=t((()=>{EF=e=>e*180/Math.PI,DF=e=>{let t=EF(Math.atan2(e[1],e[0]));return OF(t)},BPe={x:4,y:5,translateX:4,translateY:5,scaleX:0,scaleY:3,scale:e=>(Math.abs(e[0])+Math.abs(e[3]))/2,rotate:DF,rotateZ:DF,skewX:e=>EF(Math.atan(e[1])),skewY:e=>EF(Math.atan(e[2])),skew:e=>(Math.abs(e[1])+Math.abs(e[2]))/2},OF=e=>(e%=360,e<0&&(e+=360),e),kF=DF,AF=e=>Math.sqrt(e[0]*e[0]+e[1]*e[1]),jF=e=>Math.sqrt(e[4]*e[4]+e[5]*e[5]),VPe={x:12,y:13,z:14,translateX:12,translateY:13,translateZ:14,scaleX:AF,scaleY:jF,scale:e=>(AF(e)+jF(e))/2,rotateX:e=>OF(EF(Math.atan2(e[6],e[5]))),rotateY:e=>OF(EF(Math.atan2(-e[2],e[0]))),rotateZ:kF,rotate:kF,skewX:e=>EF(Math.atan(e[4])),skewY:e=>EF(Math.atan(e[1])),skew:e=>(Math.abs(e[1])+Math.abs(e[4]))/2},HPe=(e,t)=>{let{transform:n=`none`}=getComputedStyle(e);return TF(n,t)}})))()}
var NF;
var PF;
function FF(){return(FF=t((()=>{NF=[`transformPerspective`,`x`,`y`,`z`,`translateX`,`translateY`,`translateZ`,`scale`,`scaleX`,`scaleY`,`rotate`,`rotateX`,`rotateY`,`rotateZ`,`skew`,`skewX`,`skewY`],PF=new Set([...NF,`pathRotation`])})))()}
function UPe(e){let t=[];return GPe.forEach(n=>{let r=e.getValue(n);r!==void 0&&(t.push([n,r.get()]),r.set(+!!n.startsWith(`scale`)))}),t}
var IF;
var WPe;
var GPe;
var LF;
function RF(){return(RF=t((()=>{MF(),FF(),dP(),kP(),IF=e=>e===cP||e===DP,WPe=new Set([`x`,`y`,`z`]),GPe=NF.filter(e=>!WPe.has(e)),LF={width:({x:e},{paddingLeft:t=`0`,paddingRight:n=`0`,boxSizing:r})=>{let i=e.max-e.min;return r===`border-box`?i:i-parseFloat(t)-parseFloat(n)},height:({y:e},{paddingTop:t=`0`,paddingBottom:n=`0`,boxSizing:r})=>{let i=e.max-e.min;return r===`border-box`?i:i-parseFloat(t)-parseFloat(n)},top:(e,{top:t})=>parseFloat(t),left:(e,{left:t})=>parseFloat(t),bottom:({y:e},{top:t})=>parseFloat(t)+(e.max-e.min),right:({x:e},{left:t})=>parseFloat(t)+(e.max-e.min),x:(e,{transform:t})=>TF(t,`x`),y:(e,{transform:t})=>TF(t,`y`)},LF.translateX=LF.x,LF.translateY=LF.y})))()}
function KPe(){if(VF){let e=Array.from(zF).filter(e=>e.needsMeasurement),t=new Set(e.map(e=>e.element)),n=new Map;t.forEach(e=>{let t=UPe(e);t.length&&(n.set(e,t),e.render())}),e.forEach(e=>e.measureInitialState()),t.forEach(e=>{e.render();let t=n.get(e);t&&t.forEach(([t,n])=>{e.getValue(t)?.set(n)})}),e.forEach(e=>e.measureEndState()),e.forEach(e=>{e.suspendedScrollY!==void 0&&window.scrollTo(0,e.suspendedScrollY)})}VF=!1,BF=!1,zF.forEach(e=>e.complete(HF)),zF.clear()}
function qPe(){zF.forEach(e=>{e.readKeyframes(),e.needsMeasurement&&(VF=!0)})}
function JPe(){HF=!0,qPe(),KPe(),HF=!1}
var zF;
var BF;
var VF;
var HF;
var UF;
function WF(){return(WF=t((()=>{RF(),eP(),zF=new Set,BF=!1,VF=!1,HF=!1,UF=class{constructor(e,t,n,r,i,a=!1){this.state=`pending`,this.isAsync=!1,this.needsMeasurement=!1,this.unresolvedKeyframes=[...e],this.onComplete=t,this.name=n,this.motionValue=r,this.element=i,this.isAsync=a}scheduleResolve(){this.state=`scheduled`,this.isAsync?(zF.add(this),BF||(BF=!0,XN.read(qPe),XN.resolveKeyframes(KPe))):(this.readKeyframes(),this.complete())}readKeyframes(){let{unresolvedKeyframes:e,name:t,element:n,motionValue:r}=this;if(e[0]===null){let i=r?.get(),a=e[e.length-1];if(i!==void 0)e[0]=i;else if(n&&t){let r=n.readValue(t,a);r!=null&&(e[0]=r)}e[0]===void 0&&(e[0]=a),r&&i===void 0&&r.set(e[0])}RPe(e)}setFinalKeyframe(){}measureInitialState(){}renderEndStyles(){}measureEndState(){}complete(e=!1){this.state=`complete`,this.onComplete(this.unresolvedKeyframes,this.finalKeyframe,e),zF.delete(this)}cancel(){this.state===`scheduled`&&(zF.delete(this),this.state=`pending`)}resume(){this.state===`pending`&&this.scheduleResolve()}}})))()}
var YPe;
function XPe(){return(XPe=t((()=>{YPe=e=>e.startsWith(`--`)})))()}
function ZPe(e,t,n){YPe(t)?e.style.setProperty(t,n):e.style[t]=n}
function GF(){return(GF=t((()=>{XPe()})))()}
var QPe;
function $Pe(){return($Pe=t((()=>{QPe={}})))()}
function eFe(e,t){let n=SNe(e);return()=>QPe[t]??n()}
function KF(){return(KF=t((()=>{$Pe()})))()}
var tFe;
function nFe(){return(nFe=t((()=>{KF(),tFe=eFe(()=>window.ScrollTimeline!==void 0,`scrollTimeline`)})))()}
var qF;
function JF(){return(JF=t((()=>{KF(),qF=eFe(()=>{try{document.createElement(`div`).animate({opacity:0},{easing:`linear(0, 1)`})}catch{return!1}return!0},`linearEasing`)})))()}
var YF;
function XF(){return(XF=t((()=>{YF=([e,t,n,r])=>`cubic-bezier(${e}, ${t}, ${n}, ${r})`})))()}
var ZF;
function rFe(){return(rFe=t((()=>{XF(),ZF={linear:`linear`,ease:`ease`,easeIn:`ease-in`,easeOut:`ease-out`,easeInOut:`ease-in-out`,circIn:YF([0,.65,.55,1]),circOut:YF([.55,0,1,.45]),backIn:YF([.31,.01,.66,-.59]),backOut:YF([.33,1.53,.69,.99])}})))()}
function iFe(e,t){if(e)return typeof e==`function`?qF()?XP(e,t):`ease-out`:UN(e)?YF(e):Array.isArray(e)?e.map(e=>iFe(e,t)||ZF.easeOut):ZF[e]}
function aFe(){return(aFe=t((()=>{WN(),JF(),ZP(),XF(),rFe()})))()}
function oFe(e,t,n,{delay:r=0,duration:i=300,repeat:a=0,repeatType:o=`loop`,ease:s=`easeOut`,times:c}={},l=void 0){let u={[t]:n};c&&(u.offset=c);let d=iFe(s,i);Array.isArray(d)&&(u.easing=d);let f={delay:r,duration:i,easing:Array.isArray(d)?`linear`:d,fill:`both`,iterations:a+1,direction:o===`reverse`?`alternate`:`normal`};return l&&(f.pseudoElement=l),e.animate(u,f)}
function sFe(){return(sFe=t((()=>{aFe()})))()}
function QF(e){return typeof e==`function`&&`applyToOptions`in e}
function cFe({type:e,...t}){return QF(e)&&qF()?e.applyToOptions(t):(t.duration??=300,t.ease??=`easeOut`,t)}
function lFe(){return(lFe=t((()=>{JF()})))()}
var $F;
function eI(){return(eI=t((()=>{$M(),vN(),lN(),GF(),nFe(),vF(),xF(),sFe(),lFe(),$F=class extends bF{constructor(e){if(super(),this.finishedTime=null,this.isStopped=!1,this.manualStartTime=null,!e)return;let{element:t,name:n,keyframes:r,pseudoElement:i,allowFlatten:a=!1,finalKeyframe:o,onComplete:s}=e;this.isPseudoElement=!!i,this.allowFlatten=a,this.options=e,QM(typeof e.type!=`string`,`Mini animate() doesn't support "type" as a string.`,`mini-spring`);let c=cFe(e);this.animation=oFe(t,n,r,c,i),c.autoplay===!1&&this.animation.pause(),this.animation.onfinish=()=>{if(this.finishedTime=this.time,!i){let e=_F(r,this.options,o,this.speed);this.updateMotionValue&&this.updateMotionValue(e),ZPe(t,n,e),this.animation.cancel()}s?.(),this.notifyFinished()}}play(){this.isStopped||(this.manualStartTime=null,this.animation.play(),this.state===`finished`&&this.updateFinished())}pause(){this.animation.pause()}complete(){this.animation.finish?.()}cancel(){try{this.animation.cancel()}catch{}}stop(){if(this.isStopped)return;this.isStopped=!0;let{state:e}=this;e!==`idle`&&e!==`finished`&&(this.updateMotionValue?this.updateMotionValue():this.commitStyles(),this.isPseudoElement||this.cancel())}commitStyles(){let e=this.options?.element;!this.isPseudoElement&&e?.isConnected&&this.animation.commitStyles?.()}get duration(){let e=this.animation.effect?.getComputedTiming?.().duration||0;return _N(Number(e))}get iterationDuration(){let{delay:e=0}=this.options||{};return this.duration+_N(e)}get time(){return _N(Number(this.animation.currentTime)||0)}set time(e){let t=this.finishedTime!==null;this.manualStartTime=null,this.finishedTime=null,this.animation.currentTime=gN(e),t&&this.animation.pause()}get speed(){return this.animation.playbackRate}set speed(e){e<0&&(this.finishedTime=null),this.animation.playbackRate=e}get state(){return this.finishedTime===null?this.animation.playState:`finished`}get startTime(){return this.manualStartTime??Number(this.animation.startTime)}set startTime(e){this.manualStartTime=this.animation.startTime=e}attachTimeline({timeline:e,rangeStart:t,rangeEnd:n,observe:r}){return this.allowFlatten&&this.animation.effect?.updateTiming({easing:`linear`}),this.animation.onfinish=null,e&&tFe()?(this.animation.timeline=e,t&&(this.animation.rangeStart=t),n&&(this.animation.rangeEnd=n),cN):r(this)}}})))()}
function uFe(e){return e in tI}
function dFe(e){typeof e.ease==`string`&&uFe(e.ease)&&(e.ease=tI[e.ease])}
var tI;
function fFe(){return(fFe=t((()=>{LN(),jN(),NN(),tI={anticipate:MN,backInOut:AN,circInOut:IN}})))()}
var nI;
var pFe;
function mFe(){return(mFe=t((()=>{XM(),rP(),GF(),CF(),eI(),yF(),fFe(),nI=10,pFe=class extends $F{constructor(e){dFe(e),FPe(e),super(e),e.startTime!==void 0&&e.autoplay!==!1&&(this.startTime=e.startTime),this.options=e}updateMotionValue(e){let{motionValue:t,onUpdate:n,onComplete:r,element:i,...a}=this.options;if(!t)return;if(e!==void 0){t.set(e);return}let o=new SF({...a,autoplay:!1}),s=Math.max(nI,nP.now()-this.startTime),c=YM(0,nI,s-nI),l=o.sample(s).value,{name:u}=this.options;i&&u&&ZPe(i,u,l),t.setWithVelocity(o.sample(Math.max(0,s-c)).value,l,c),o.stop()}}})))()}
var rI;
function hFe(){return(hFe=t((()=>{zP(),rI=(e,t)=>t!==`zIndex`&&!!(typeof e==`number`||Array.isArray(e)||typeof e==`string`&&(RP.test(e)||e===`0`)&&!e.startsWith(`url(`))})))()}
function gFe(e){let t=e[0];if(e.length===1)return!0;for(let n=0;n<e.length;n++)if(e[n]!==t)return!0}
function _Fe(e,t,n,r){let i=e[0];if(i===null)return!1;if(t===`display`||t===`visibility`)return!0;let a=e[e.length-1],o=rI(i,t),s=rI(a,t);return ZM(o===s,`You are trying to animate ${t} from "${i}" to "${a}". "${o?a:i}" is not an animatable value.`,`value-not-animatable`),!o||!s?!1:gFe(e)||(n===`spring`||QF(n))&&r}
function vFe(){return(vFe=t((()=>{$M(),hFe()})))()}
function iI(e){e.duration=0,e.type=`keyframes`}
var aI;
function oI(){return(oI=t((()=>{aI=new Set([`opacity`,`clipPath`,`filter`,`transform`])})))()}
function yFe(e){for(let t=0;t<e.length;t++)if(typeof e[t]==`string`&&bFe.test(e[t]))return!0;return!1}
var bFe;
function xFe(){return(xFe=t((()=>{bFe=/^(?:oklch|oklab|lab|lch|color|color-mix|light-dark)\(/})))()}
function SFe(e){let{motionValue:t,name:n,repeatDelay:r,repeatType:i,damping:a,type:o,keyframes:s}=e;if(!(t?.owner?.current instanceof HTMLElement))return!1;let{onUpdate:c,transformTemplate:l}=t.owner.getProps();return wFe()&&n&&(aI.has(n)||CFe.has(n)&&yFe(s))&&(n!==`transform`||!l)&&!c&&!r&&i!==`mirror`&&a!==0&&o!==`inertia`}
var CFe;
var wFe;
function TFe(){return(TFe=t((()=>{oI(),xFe(),CFe=new Set([`color`,`backgroundColor`,`outlineColor`,`fill`,`stroke`,`borderColor`,`borderTopColor`,`borderRightColor`,`borderBottomColor`,`borderLeftColor`]),wFe=SNe(()=>Object.hasOwnProperty.call(Element.prototype,`animate`))})))()}
var EFe;
var DFe;
function OFe(){return(OFe=t((()=>{tN(),lN(),rP(),CF(),vF(),WF(),mFe(),vFe(),xF(),TFe(),EFe=40,DFe=class extends bF{constructor({autoplay:e=!0,delay:t=0,type:n=`keyframes`,repeat:r=0,repeatDelay:i=0,repeatType:a=`loop`,keyframes:o,name:s,motionValue:c,element:l,...u}){super(),this.stop=()=>{this._animation&&(this._animation.stop(),this.stopTimeline?.()),this.keyframeResolver?.cancel()},this.createdAt=nP.now();let d={autoplay:e,delay:t,type:n,repeat:r,repeatDelay:i,repeatType:a,name:s,motionValue:c,element:l,...u},f=l?.KeyframeResolver||UF;this.keyframeResolver=new f(o,(e,t,n)=>this.onKeyframesResolved(e,t,d,!n),s,c,l),this.keyframeResolver?.scheduleResolve()}onKeyframesResolved(e,t,n,r){this.keyframeResolver=void 0;let{name:i,type:a,velocity:o,delay:s,isHandoff:c,onUpdate:l}=n;this.resolvedAt=nP.now();let u=!0;_Fe(e,i,a,o)||(u=!1,(eN.instantAnimations||!s)&&l?.(_F(e,n,t)),e[0]=e[e.length-1],iI(n),n.repeat=0);let d={startTime:r?this.resolvedAt&&this.resolvedAt-this.createdAt>EFe?this.resolvedAt:this.createdAt:void 0,finalKeyframe:t,...n,keyframes:e},f=u&&!c&&SFe(d),p=d.motionValue?.owner?.current,m;if(f)try{m=new pFe({...d,element:p})}catch{m=new SF(d)}else m=new SF(d);m.finished.then(()=>{this.notifyFinished()}).catch(cN),this.pendingTimeline&&=(this.stopTimeline=m.attachTimeline(this.pendingTimeline),void 0),this._animation=m}get finished(){return this._animation?this.animation.finished:this._finished}then(e,t){return this.finished.finally(e).then(()=>{})}get animation(){return this._animation||(this.keyframeResolver?.resume(),JPe()),this._animation}get duration(){return this.animation.duration}get iterationDuration(){return this.animation.iterationDuration}get time(){return this.animation.time}set time(e){this.animation.time=e}get speed(){return this.animation.speed}get state(){return this.animation.state}set speed(e){this.animation.speed=e}get startTime(){return this.animation.startTime}attachTimeline(e){return this._animation?this.stopTimeline=this.animation.attachTimeline(e):this.pendingTimeline=e,()=>this.stop()}play(){this.animation.play()}pause(){this.animation.pause()}complete(){this.animation.complete()}cancel(){this._animation&&this.animation.cancel(),this.keyframeResolver?.cancel()}}})))()}
function PFe(e,t,n,r=0,i=1){let a=Array.from(e).sort((e,t)=>e.sortNodePosition(t)).indexOf(t),o=e.size,s=(o-1)*r;return typeof n==`function`?n(a,o):i===1?a*r:s-a*r}
function sI(e,t){return new uI(e,t)}
var cI;
var FFe;
var lI;
var uI;
function dI(){return(dI=t((()=>{hN(),bN(),rP(),eP(),cI=30,FFe=e=>!isNaN(parseFloat(e)),lI={current:void 0},uI=class{constructor(e,t={}){this.canTrackVelocity=null,this.events={},this.updateAndNotify=e=>{let t=nP.now();if(this.updatedAt!==t&&this.setPrevFrameValue(),this.prev=this.current,this.setCurrent(e),this.current!==this.prev&&(this.events.change?.notify(this.current),this.dependents))for(let e of this.dependents)e.dirty()},this.hasAnimated=!1,this.setCurrent(e),this.owner=t.owner}setCurrent(e){this.current=e,this.updatedAt=nP.now(),this.canTrackVelocity===null&&e!==void 0&&(this.canTrackVelocity=FFe(this.current))}setPrevFrameValue(e=this.current){this.prevFrameValue=e,this.prevUpdatedAt=this.updatedAt}onChange(e){return this.on(`change`,e)}on(e,t){this.events[e]||(this.events[e]=new mN);let n=this.events[e].add(t);return e===`change`?()=>{n(),XN.read(()=>{this.events.change.getSize()||this.stop()})}:n}clearListeners(){for(let e in this.events)this.events[e].clear()}attach(e,t){this.passiveEffect=e,this.stopPassiveEffect=t}set(e){this.passiveEffect?this.passiveEffect(e,this.updateAndNotify):this.updateAndNotify(e)}setWithVelocity(e,t,n){this.set(t),this.prev=void 0,this.prevFrameValue=e,this.prevUpdatedAt=this.updatedAt-n}jump(e,t=!0){this.updateAndNotify(e),this.prev=e,this.prevUpdatedAt=this.prevFrameValue=void 0,t&&this.stop(),this.stopPassiveEffect&&this.stopPassiveEffect()}dirty(){this.events.change?.notify(this.current)}addDependent(e){this.dependents||=new Set,this.dependents.add(e)}removeDependent(e){this.dependents&&this.dependents.delete(e)}get(){return lI.current&&lI.current.push(this),this.current}getPrevious(){return this.prev}getVelocity(){let e=nP.now();if(!this.canTrackVelocity||this.prevFrameValue===void 0||e-this.updatedAt>cI)return 0;let t=Math.min(this.updatedAt-this.prevUpdatedAt,cI);return yN(parseFloat(this.current)-parseFloat(this.prevFrameValue),t)}start(e){return this.stop(),new Promise(t=>{this.hasAnimated=!0,this.animation=e(t),this.events.animationStart&&this.events.animationStart.notify()}).then(()=>{this.events.animationComplete&&this.events.animationComplete.notify(),this.clearAnimation()})}stop(){this.animation&&(this.animation.stop(),this.events.animationCancel&&this.events.animationCancel.notify()),this.clearAnimation()}isAnimating(){return!!this.animation}clearAnimation(){delete this.animation}destroy(){this.dependents?.clear(),this.events.destroy?.notify(),this.clearListeners(),this.stop(),this.stopPassiveEffect&&this.stopPassiveEffect()}}})))()}
function fI(e,t){if(e?.inherit&&t){let{inherit:n,...r}=e;return{...t,...r}}return e}
function pI(e,t){let n=e?.[t]??e?.default??e;return n===e?n:fI(n,e)}
function mI(){return(mI=t((()=>{})))()}
var IFe;
var LFe;
var RFe;
var zFe;
var BFe;
function VFe(){return(VFe=t((()=>{FF(),IFe={type:`spring`,stiffness:500,damping:25,restSpeed:10},LFe=e=>({type:`spring`,stiffness:550,damping:e===0?2*Math.sqrt(550):30,restSpeed:10}),RFe={type:`keyframes`,duration:.8},zFe={type:`keyframes`,ease:[.25,.1,.35,1],duration:.3},BFe=(e,{keyframes:t})=>t.length>2?RFe:PF.has(e)?e.startsWith(`scale`)?LFe(t[1]):IFe:zFe})))()}
function HFe(e){for(let t in e)if(!UFe.has(t))return!0;return!1}
var UFe;
function WFe(){return(WFe=t((()=>{UFe=new Set([`when`,`delay`,`delayChildren`,`staggerChildren`,`staggerDirection`,`repeat`,`repeatType`,`repeatDelay`,`from`,`elapsed`])})))()}
var hI;
function gI(){return(gI=t((()=>{vN(),tN(),OFe(),CF(),mI(),VFe(),vF(),WFe(),eP(),hI=(e,t,n,r={},i,a)=>o=>{let s=pI(r,e)||{},c=s.delay||r.delay||0,{elapsed:l=0}=r;l-=gN(c);let u={keyframes:Array.isArray(n)?n:[null,n],ease:`easeOut`,velocity:t.getVelocity(),...s,delay:-l,onUpdate:e=>{t.set(e),s.onUpdate&&s.onUpdate(e)},onComplete:()=>{o(),s.onComplete&&s.onComplete()},name:e,motionValue:t,element:a?void 0:i};HFe(s)||Object.assign(u,BFe(e,u)),u.duration&&=gN(u.duration),u.repeatDelay&&=gN(u.repeatDelay),u.from!==void 0&&(u.keyframes[0]=u.from);let d=!1;if((u.type===!1||u.duration===0&&!u.repeatDelay)&&(iI(u),u.delay===0&&(d=!0)),(eN.instantAnimations||eN.skipAnimations||i?.shouldSkipAnimations||s.skipAnimations)&&(d=!0,iI(u),u.delay=0),u.allowFlatten=!s.type&&!s.ease,d&&!a&&t.get()!==void 0){let e=_F(u.keyframes,s);if(e!==void 0){XN.update(()=>{u.onUpdate(e),u.onComplete()});return}}return s.isSync?new SF(u):new DFe(u)}})))()}
function GFe(e){let t=qFe.exec(e);if(!t)return[,];let[,n,r,i]=t;return[`--${n??r}`,i]}
function KFe(e,t,n=1){QM(n<=JFe,`Max CSS variable fallback depth detected in property "${e}". This may indicate a circular fallback dependency.`,`max-css-var-depth`);let[r,i]=GFe(e);if(!r)return;let a=window.getComputedStyle(t).getPropertyValue(r);if(a){let e=a.trim();return nN(e)?parseFloat(e):e}return oP(i)?KFe(i,t,n+1):i}
var qFe;
var JFe;
function YFe(){return(YFe=t((()=>{$M(),rN(),sP(),qFe=/^var\(--(?:([\w-]+)|([\w-]+), ?([a-zA-Z\d ()%#.,-]+))\)/u,JFe=4})))()}
function XFe(e){let t=[{},{}];return e?.values.forEach((e,n)=>{t[0][n]=e.get(),t[1][n]=e.getVelocity()}),t}
function _I(e,t,n,r){if(typeof t==`function`){let[i,a]=XFe(r);t=t(n===void 0?e.custom:n,i,a)}if(typeof t==`string`&&(t=e.variants&&e.variants[t]),typeof t==`function`){let[i,a]=XFe(r);t=t(n===void 0?e.custom:n,i,a)}return t}
function vI(e,t,n){let r=e.getProps();return _I(r,t,n===void 0?r.custom:n,e)}
function yI(){return(yI=t((()=>{})))()}
var bI;
function xI(){return(xI=t((()=>{FF(),bI=new Set([`width`,`height`,`top`,`left`,`right`,`bottom`,...NF])})))()}
var SI;
function CI(){return(CI=t((()=>{SI=e=>Array.isArray(e)})))()}
function QFe(e,t,n){e.hasValue(t)?e.getValue(t).set(n):e.addValue(t,sI(n))}
function $Fe(e){return SI(e)?e[e.length-1]||0:e}
function wI(e,t){let{transitionEnd:n={},transition:r={},...i}=vI(e,t)||{};i={...i,...n};for(let t in i)QFe(e,t,$Fe(i[t]))}
function TI(){return(TI=t((()=>{dI(),yI(),CI()})))()}
var EI;
function DI(){return(DI=t((()=>{EI=e=>!!(e&&e.getVelocity)})))()}
function eIe(e){return!!(EI(e)&&e.add)}
function tIe(){return(tIe=t((()=>{DI()})))()}
function OI(e,t){let n=e.getValue(`willChange`);if(eIe(n))return n.add(t);if(!n&&eN.WillChange){let n=new eN.WillChange(`auto`);e.addValue(`willChange`,n),n.add(t)}}
function kI(){return(kI=t((()=>{tN(),tIe()})))()}
function AI(e){return e.replace(/([A-Z])/g,e=>`-${e.toLowerCase()}`)}
var nIe;
var jI;
function MI(){return(MI=t((()=>{nIe=`framerAppearId`,jI=`data-`+AI(nIe)})))()}
function rIe(e){return e.props[jI]}
function NI(){return(NI=t((()=>{MI()})))()}
function iIe({protectedKeys:e,needsAnimating:t},n){let r=e.hasOwnProperty(n)&&t[n]!==!0;return t[n]=!1,r}
function PI(e,t,{delay:n=0,transitionOverride:r,type:i}={}){let{transition:a,transitionEnd:o,...s}=t,c=e.getDefaultTransition();a=a?fI(a,c):c;let l=a?.reduceMotion,u=a?.skipAnimations;r&&(a=r);let d=[],f=i&&e.animationState&&e.animationState.getState()[i],p=a?.path;p&&p.animateVisualElement(e,s,a,n,d);for(let t in s){let r=e.getValue(t,e.latestValues[t]??null),i=s[t];if(i===void 0||f&&iIe(f,t))continue;let o={delay:n,...pI(a||{},t)};u&&(o.skipAnimations=!0);let c=r.get();if(c!==void 0&&!r.isAnimating()&&!Array.isArray(i)&&i===c&&!o.velocity){XN.update(()=>r.set(i));continue}let p=!1;if(window.MotionHandoffAnimation){let n=rIe(e);if(n){let e=window.MotionHandoffAnimation(n,t,XN);e!==null&&(o.startTime=e,p=!0)}}OI(e,t);let m=l??e.shouldReduceMotion;r.start(hI(t,r,i,m&&bI.has(t)?{type:!1}:o,e,p));let h=r.animation;h&&d.push(h)}if(o){let t=()=>XN.update(()=>{o&&wI(e,o)});d.length?Promise.all(d).then(t):t()}return d}
function FI(){return(FI=t((()=>{mI(),xI(),TI(),kI(),NI(),gI(),eP()})))()}
function II(e,t,n={}){let r=vI(e,t,n.type===`exit`?e.presenceContext?.custom:void 0),{transition:i=e.getDefaultTransition()||{}}=r||{};n.transitionOverride&&(i=n.transitionOverride);let a=r?()=>Promise.all(PI(e,r,n)):()=>Promise.resolve(),o=e.variantChildren&&e.variantChildren.size?(r=0)=>{let{delayChildren:a=0,staggerChildren:o,staggerDirection:s}=i;return aIe(e,t,r,a,o,s,n)}:()=>Promise.resolve(),{when:s}=i;if(s){let[e,t]=s===`beforeChildren`?[a,o]:[o,a];return e().then(()=>t())}return Promise.all([a(),o(n.delay)])}
function aIe(e,t,n=0,r=0,i=0,a=1,o){let s=[];for(let c of e.variantChildren)c.notify(`AnimationStart`,t),s.push(II(c,t,{...o,delay:n+(typeof r==`function`?0:r)+PFe(e.variantChildren,c,r,i,a)}).then(()=>c.notify(`AnimationComplete`,t)));return Promise.all(s)}
function oIe(){return(oIe=t((()=>{yI(),FI()})))()}
function sIe(e,t,n={}){e.notify(`AnimationStart`,t);let r;if(Array.isArray(t)){let i=t.map(t=>II(e,t,n));r=Promise.all(i)}else if(typeof t==`string`)r=II(e,t,n);else{let i=typeof t==`function`?vI(e,t,n.custom):t;r=Promise.all(PI(e,i,n))}return r.then(()=>{e.notify(`AnimationComplete`,t)})}
function LI(){return(LI=t((()=>{yI(),FI(),oIe()})))()}
var cIe;
function lIe(){return(lIe=t((()=>{cIe={test:e=>e===`auto`,parse:e=>e}})))()}
var RI;
function zI(){return(zI=t((()=>{RI=e=>t=>t.test(e)})))()}
var BI;
var VI;
function HI(){return(HI=t((()=>{lIe(),dP(),kP(),zI(),BI=[cP,DP,EP,TP,KNe,GNe,cIe],VI=e=>BI.find(RI(e))})))()}
function uIe(e){return typeof e==`number`?e===0:e===null||e===`none`||e===`0`||oN(e)}
function dIe(){return(dIe=t((()=>{sN()})))()}
function fIe(e){let[t,n]=e.slice(0,-1).split(`(`);if(t===`drop-shadow`)return e;let[r]=n.match(mP)||[];if(!r)return e;let i=n.replace(r,``),a=+!!pIe.has(t);return r!==n&&(a*=100),t+`(`+a+i+`)`}
var pIe;
var mIe;
var UI;
function WI(){return(WI=t((()=>{zP(),hP(),pIe=new Set([`brightness`,`contrast`,`saturate`,`opacity`]),mIe=/\b([a-z-]*)\(.*?\)/gu,UI={...RP,getAnimatableNone:e=>{let t=e.match(mIe);return t?t.map(fIe).join(` `):e}}})))()}
var GI;
function KI(){return(KI=t((()=>{zP(),GI={...RP,getAnimatableNone:e=>{let t=RP.parse(e);return RP.createTransformer(e)(t.map(e=>typeof e==`number`?0:typeof e==`object`?{...e,alpha:1}:e))}}})))()}
var qI;
function hIe(){return(hIe=t((()=>{dP(),qI={...cP,transform:Math.round}})))()}
var gIe;
function _Ie(){return(_Ie=t((()=>{dP(),kP(),gIe={rotate:TP,pathRotation:TP,rotateX:TP,rotateY:TP,rotateZ:TP,scale:uP,scaleX:uP,scaleY:uP,scaleZ:uP,skew:TP,skewX:TP,skewY:TP,distance:DP,translateX:DP,translateY:DP,translateZ:DP,x:DP,y:DP,z:DP,perspective:DP,transformPerspective:DP,opacity:lP,originX:OP,originY:OP,originZ:DP}})))()}
var JI;
function YI(){return(YI=t((()=>{hIe(),dP(),kP(),_Ie(),JI={borderWidth:DP,borderTopWidth:DP,borderRightWidth:DP,borderBottomWidth:DP,borderLeftWidth:DP,borderRadius:DP,borderTopLeftRadius:DP,borderTopRightRadius:DP,borderBottomRightRadius:DP,borderBottomLeftRadius:DP,width:DP,maxWidth:DP,height:DP,maxHeight:DP,top:DP,right:DP,bottom:DP,left:DP,inset:DP,insetBlock:DP,insetBlockStart:DP,insetBlockEnd:DP,insetInline:DP,insetInlineStart:DP,insetInlineEnd:DP,padding:DP,paddingTop:DP,paddingRight:DP,paddingBottom:DP,paddingLeft:DP,paddingBlock:DP,paddingBlockStart:DP,paddingBlockEnd:DP,paddingInline:DP,paddingInlineStart:DP,paddingInlineEnd:DP,margin:DP,marginTop:DP,marginRight:DP,marginBottom:DP,marginLeft:DP,marginBlock:DP,marginBlockStart:DP,marginBlockEnd:DP,marginInline:DP,marginInlineStart:DP,marginInlineEnd:DP,fontSize:DP,backgroundPositionX:DP,backgroundPositionY:DP,...gIe,zIndex:qI,fillOpacity:lP,strokeOpacity:lP,numOctaves:qI}})))()}
var vIe;
var XI;
function ZI(){return(ZI=t((()=>{NP(),WI(),KI(),YI(),vIe={...JI,color:MP,backgroundColor:MP,outlineColor:MP,fill:MP,stroke:MP,borderColor:MP,borderTopColor:MP,borderRightColor:MP,borderBottomColor:MP,borderLeftColor:MP,filter:UI,WebkitFilter:UI,mask:GI,WebkitMask:GI},XI=e=>vIe[e]})))()}
function yIe(e,t){let n=XI(e);return bIe.has(n)||(n=RP),n.getAnimatableNone?n.getAnimatableNone(t):void 0}
var bIe;
function QI(){return(QI=t((()=>{zP(),WI(),KI(),ZI(),bIe=new Set([UI,GI])})))()}
function xIe(e,t,n){let r=0,i;for(;r<e.length&&!i;){let t=e[r];typeof t==`string`&&!SIe.has(t)&&PP(t).values.length&&(i=e[r]),r++}if(i&&n)for(let r of t)e[r]=yIe(n,i)}
var SIe;
function CIe(){return(CIe=t((()=>{zP(),QI(),SIe=new Set([`auto`,`none`,`0`])})))()}
var wIe;
function TIe(){return(TIe=t((()=>{xI(),HI(),YFe(),sP(),WF(),dIe(),CIe(),RF(),wIe=class extends UF{constructor(e,t,n,r,i){super(e,t,n,r,i,!0)}readKeyframes(){let{unresolvedKeyframes:e,element:t,name:n}=this;if(!t||!t.current)return;super.readKeyframes();for(let n=0;n<e.length;n++){let r=e[n];if(typeof r==`string`&&(r=r.trim(),oP(r))){let i=KFe(r,t.current);i!==void 0&&(e[n]=i),n===e.length-1&&(this.finalKeyframe=r)}}if(this.resolveNoneKeyframes(),!bI.has(n)||e.length!==2)return;let[r,i]=e,a=VI(r),o=VI(i);if(LNe(r)!==LNe(i)&&LF[n]){this.needsMeasurement=!0;return}if(a!==o){if(IF(a)&&IF(o))for(let t=0;t<e.length;t++){let n=e[t];typeof n==`string`&&(e[t]=parseFloat(n))}else LF[n]&&(this.needsMeasurement=!0)}}resolveNoneKeyframes(){let{unresolvedKeyframes:e,name:t}=this,n=[];for(let t=0;t<e.length;t++)(e[t]===null||uIe(e[t]))&&n.push(t);n.length&&xIe(e,n,t)}measureInitialState(){let{element:e,unresolvedKeyframes:t,name:n}=this;if(!e||!e.current)return;n===`height`&&(this.suspendedScrollY=window.pageYOffset),this.measuredOrigin=LF[n](e.measureViewportBox(),window.getComputedStyle(e.current)),t[0]=this.measuredOrigin;let r=t[t.length-1];r!==void 0&&e.getValue(n,r).jump(r,!1)}measureEndState(){let{element:e,name:t,unresolvedKeyframes:n}=this;if(!e||!e.current)return;let r=e.getValue(t);r&&r.jump(this.measuredOrigin,!1);let i=n.length-1,a=n[i];n[i]=LF[t](e.measureViewportBox(),window.getComputedStyle(e.current)),a!==null&&this.finalKeyframe===void 0&&(this.finalKeyframe=a),this.removedTransforms?.length&&this.removedTransforms.forEach(([t,n])=>{e.getValue(t).set(n)}),this.resolveNoneKeyframes()}}})))()}
var $I;
function eL(){return(eL=t((()=>{$I=[`borderTopLeftRadius`,`borderTopRightRadius`,`borderBottomRightRadius`,`borderBottomLeftRadius`]})))()}
function tL(e,t,n){if(e==null)return[];if(e instanceof EventTarget)return[e];if(typeof e==`string`){let r=document;t&&(r=t.current);let i=n?.[e]??r.querySelectorAll(e);return i?Array.from(i):[]}return Array.from(e).filter(e=>e!=null)}
var nL;
function rL(){return(rL=t((()=>{nL=(e,t)=>t&&typeof e==`number`?t.transform(e):e})))()}
function iL(e){return iN(e)&&`offsetHeight`in e&&!(`ownerSVGElement`in e)}
function aL(){return(aL=t((()=>{aN()})))()}
var oL;
var EIe;
function sL(){return(sL=t((()=>{YN(),{schedule:oL,cancel:EIe}=PNe(queueMicrotask,!1)})))()}
function DIe(){return cL.x||cL.y}
var cL;
function lL(){return(lL=t((()=>{cL={x:!1,y:!1}})))()}
function OIe(e){return e===`x`||e===`y`?cL[e]?null:(cL[e]=!0,()=>{cL[e]=!1}):cL.x||cL.y?null:(cL.x=cL.y=!0,()=>{cL.x=cL.y=!1})}
function uL(){return(uL=t((()=>{lL()})))()}
function kIe(e,t){let n=tL(e),r=new AbortController;return[n,{passive:!0,...t,signal:r.signal},()=>r.abort()]}
function dL(){return(dL=t((()=>{})))()}
function AIe(e){return!(e.pointerType===`touch`||DIe())}
function jIe(e,t,n={}){let[r,i,a]=kIe(e,n);return r.forEach(e=>{let n=!1,r=!1,a,o=()=>{e.removeEventListener(`pointerleave`,u)},s=e=>{a&&=(a(e),void 0),o()},c=e=>{n=!1,window.removeEventListener(`pointerup`,c),window.removeEventListener(`pointercancel`,c),r&&(r=!1,s(e))},l=()=>{n=!0,window.addEventListener(`pointerup`,c,i),window.addEventListener(`pointercancel`,c,i)},u=e=>{if(e.pointerType!==`touch`){if(n){r=!0;return}s(e)}};e.addEventListener(`pointerenter`,n=>{if(!AIe(n))return;r=!1;let o=t(e,n);typeof o==`function`&&(a=o,e.addEventListener(`pointerleave`,u,i))},i),e.addEventListener(`pointerdown`,l,i)}),a}
function fL(){return(fL=t((()=>{lL(),dL()})))()}
var pL;
function MIe(){return(MIe=t((()=>{pL=(e,t)=>t?e===t||pL(e,t.parentElement):!1})))()}
var mL;
function hL(){return(hL=t((()=>{mL=e=>e.pointerType===`mouse`?typeof e.button!=`number`||e.button<=0:e.isPrimary!==!1})))()}
function NIe(e){return FIe.has(e.tagName)||e.isContentEditable===!0}
function PIe(e){return IIe.has(e.tagName)||e.isContentEditable===!0}
var FIe;
var IIe;
function gL(){return(gL=t((()=>{FIe=new Set([`BUTTON`,`INPUT`,`SELECT`,`TEXTAREA`,`A`]),IIe=new Set([`INPUT`,`SELECT`,`TEXTAREA`])})))()}
var _L;
function vL(){return(vL=t((()=>{_L=new WeakSet})))()}
function LIe(e){return t=>{t.key===`Enter`&&e(t)}}
function yL(e,t){e.dispatchEvent(new PointerEvent(`pointer`+t,{isPrimary:!0,bubbles:!0}))}
var RIe;
function zIe(){return(zIe=t((()=>{vL(),RIe=(e,t)=>{let n=e.currentTarget;if(!n)return;let r=LIe(()=>{if(_L.has(n))return;yL(n,`down`);let e=LIe(()=>{yL(n,`up`)});n.addEventListener(`keyup`,e,t),n.addEventListener(`blur`,()=>yL(n,`cancel`),t)});n.addEventListener(`keydown`,r,t),n.addEventListener(`blur`,()=>n.removeEventListener(`keydown`,r),t)}})))()}
function BIe(e){return mL(e)&&!DIe()}
function VIe(e,t,n={}){let[r,i,a]=kIe(e,n),o=e=>{let r=e.currentTarget;if(!BIe(e)||bL.has(e))return;_L.add(r),n.stopPropagation&&bL.add(e);let a=t(r,e),o={...i,capture:!0},s=(e,t)=>{window.removeEventListener(`pointerup`,c,o),window.removeEventListener(`pointercancel`,l,o),_L.has(r)&&_L.delete(r),BIe(e)&&typeof a==`function`&&a(e,{success:t})},c=e=>{s(e,r===window||r===document||n.useGlobalTarget||pL(r,e.target))},l=e=>{s(e,!1)};window.addEventListener(`pointerup`,c,o),window.addEventListener(`pointercancel`,l,o)};return r.forEach(e=>{(n.useGlobalTarget?window:e).addEventListener(`pointerdown`,o,i),iL(e)&&(e.addEventListener(`focus`,e=>RIe(e,i)),!NIe(e)&&!e.hasAttribute(`tabindex`)&&(e.tabIndex=0))}),a}
var bL;
function xL(){return(xL=t((()=>{aL(),lL(),MIe(),hL(),dL(),gL(),zIe(),vL(),bL=new WeakSet})))()}
function SL(e){return iN(e)&&`ownerSVGElement`in e}
function CL(){return(CL=t((()=>{aN()})))()}
function HIe({target:e,borderBoxSize:t}){wL.get(e)?.forEach(n=>{n(e,{get width(){return KIe(e,t)},get height(){return qIe(e,t)}})})}
function UIe(e){e.forEach(HIe)}
function WIe(){typeof ResizeObserver>`u`||(TL=new ResizeObserver(UIe))}
function GIe(e,t){TL||WIe();let n=tL(e);return n.forEach(e=>{let n=wL.get(e);n||(n=new Set,wL.set(e,n)),n.add(t),TL?.observe(e)}),()=>{n.forEach(e=>{let n=wL.get(e);n?.delete(t),n?.size||TL?.unobserve(e)})}}
var wL;
var TL;
var EL;
var KIe;
var qIe;
function JIe(){return(JIe=t((()=>{CL(),wL=new WeakMap,EL=(e,t,n)=>(r,i)=>i&&i[0]?i[0][e+`Size`]:SL(r)&&`getBBox`in r?r.getBBox()[t]:r[n],KIe=EL(`inline`,`width`,`offsetWidth`),qIe=EL(`block`,`height`,`offsetHeight`)})))()}
function YIe(){OL=()=>{let e={get width(){return window.innerWidth},get height(){return window.innerHeight}};DL.forEach(t=>t(e))},window.addEventListener(`resize`,OL)}
function XIe(e){return DL.add(e),OL||YIe(),()=>{DL.delete(e),!DL.size&&typeof OL==`function`&&(window.removeEventListener(`resize`,OL),OL=void 0)}}
var DL;
var OL;
function ZIe(){return(ZIe=t((()=>{DL=new Set})))()}
function QIe(e,t){return typeof e==`function`?XIe(e):GIe(e,t)}
function $Ie(){return($Ie=t((()=>{JIe(),ZIe()})))()}
var kL;
function eLe(){return(eLe=t((()=>{kL={value:null,addProjectionMetrics:null}})))()}
function tLe(e){return SL(e)&&e.tagName===`svg`}
function AL(){return(AL=t((()=>{CL()})))()}
function nLe(e,t){if(e===`first`)return 0;{let n=t-1;return e===`last`?n:n/2}}
function rLe(e=.1,{startDelay:t=0,from:n=0,ease:r}={}){return(i,a)=>{let o=typeof n==`number`?n:nLe(n,a),s=e*Math.abs(o-i);if(r){let t=a*e;s=KN(r)(s/t)*t}return t+s}}
function aLe(...e){let t=!Array.isArray(e[0]),n=t?0:-1,r=e[0+n],i=e[1+n],a=e[2+n],o=e[3+n],s=dF(i,a,o);return t?s(r):s}
var uLe;
var dLe;
function fLe(){return(fLe=t((()=>{NP(),zP(),HI(),zI(),uLe=[...BI,MP,RP],dLe=e=>uLe.find(RI(e))})))()}
var ML;
var NL;
var PL;
var FL;
function IL(){return(IL=t((()=>{ML=()=>({translate:0,scale:1,origin:0,originPoint:0}),NL=()=>({x:ML(),y:ML()}),PL=()=>({min:0,max:0}),FL=()=>({x:PL(),y:PL()})})))()}
var LL;
function RL(){return(RL=t((()=>{LL=new WeakMap})))()}
function zL(e){return typeof e==`object`&&!!e&&typeof e.start==`function`}
function BL(e){return typeof e==`string`||Array.isArray(e)}
var VL;
var HL;
function UL(){return(UL=t((()=>{VL=[`animate`,`whileInView`,`whileFocus`,`whileHover`,`whileTap`,`whileDrag`,`exit`],HL=[`initial`,...VL]})))()}
function WL(e){return zL(e.animate)||HL.some(t=>BL(e[t]))}
function GL(e){return!!(WL(e)||e.variants)}
function KL(){return(KL=t((()=>{UL()})))()}
function hLe(e,t,n){for(let r in t){let i=t[r],a=n[r];if(EI(i))e.addValue(r,i);else if(EI(a))e.addValue(r,sI(i,{owner:e}));else if(a!==i){if(e.hasValue(r)){let t=e.getValue(r);t.liveStyle===!0?t.jump(i):t.hasAnimated||t.set(i)}else{let t=e.getStaticValue(r);e.addValue(r,sI(t===void 0?i:t,{owner:e}))}}}for(let r in n)t[r]===void 0&&e.removeValue(r);return t}
function gLe(){return(gLe=t((()=>{dI(),DI()})))()}
var qL;
var JL;
function YL(){return(YL=t((()=>{qL={current:null},JL={current:!1}})))()}
function XL(){if(JL.current=!0,_Le){if(window.matchMedia){let e=window.matchMedia(`(prefers-reduced-motion)`),t=()=>qL.current=e.matches;e.addEventListener(`change`,t),t()}else qL.current=!1}}
var _Le;
function ZL(){return(ZL=t((()=>{YL(),_Le=typeof window<`u`})))()}
function QL(e){eR=e}
function vLe(){return eR}
var $L;
var eR;
var tR;
function nR(){return(nR=t((()=>{vN(),rN(),sN(),hN(),WF(),eI(),oI(),sL(),rP(),IL(),dI(),zP(),QI(),fLe(),DI(),RL(),KL(),FF(),gLe(),ZL(),YL(),eP(),$L=[`AnimationStart`,`AnimationComplete`,`Update`,`BeforeLayoutMeasure`,`LayoutMeasure`,`LayoutAnimationStart`,`LayoutAnimationComplete`],eR={},tR=class{scrapeMotionValuesFromProps(e,t,n){return{}}constructor({parent:e,props:t,presenceContext:n,reducedMotionConfig:r,skipAnimations:i,blockInitialAnimation:a,visualState:o},s={}){this.current=null,this.children=new Set,this.isVariantNode=!1,this.isControllingVariants=!1,this.shouldReduceMotion=null,this.shouldSkipAnimations=!1,this.values=new Map,this.KeyframeResolver=UF,this.features={},this.valueSubscriptions=new Map,this.prevMotionValues={},this.hasBeenMounted=!1,this.events={},this.propEventSubscriptions={},this.notifyUpdate=()=>this.notify(`Update`,this.latestValues),this.render=()=>{this.current&&(this.triggerBuild(),this.renderInstance(this.current,this.renderState,this.props.style,this.projection))},this.renderScheduledAt=0,this.scheduleRender=()=>{let e=nP.now();this.renderScheduledAt<e&&(this.renderScheduledAt=e,XN.render(this.render,!1,!0))};let{latestValues:c,renderState:l}=o;this.latestValues=c,this.baseTarget={...c},this.initialValues=t.initial?{...c}:{},this.renderState=l,this.parent=e,this.props=t,this.presenceContext=n,this.depth=e?e.depth+1:0,this.reducedMotionConfig=r,this.skipAnimationsConfig=i,this.options=s,this.blockInitialAnimation=!!a,this.isControllingVariants=WL(t),this.isVariantNode=GL(t),this.isVariantNode&&(this.variantChildren=new Set),this.manuallyAnimateOnMount=!!(e&&e.current);let{willChange:u,...d}=this.scrapeMotionValuesFromProps(t,{},this);for(let e in d){let t=d[e];c[e]!==void 0&&EI(t)&&t.set(c[e])}}mount(e){if(this.hasBeenMounted)for(let e in this.initialValues)this.values.get(e)?.jump(this.initialValues[e]),this.latestValues[e]=this.initialValues[e];this.current=e,LL.set(e,this),this.projection&&!this.projection.instance&&this.projection.mount(e),this.parent&&this.isVariantNode&&!this.isControllingVariants&&(this.removeFromVariantTree=this.parent.addVariantChild(this)),this.values.forEach((e,t)=>this.bindToMotionValue(t,e)),this.reducedMotionConfig===`never`?this.shouldReduceMotion=!1:this.reducedMotionConfig===`always`?this.shouldReduceMotion=!0:(JL.current||XL(),this.shouldReduceMotion=qL.current),this.shouldSkipAnimations=this.skipAnimationsConfig??!1,this.parent?.addChild(this),this.update(this.props,this.presenceContext),this.hasBeenMounted=!0}unmount(){this.projection&&this.projection.unmount(),ZN(this.notifyUpdate),ZN(this.render),this.valueSubscriptions.forEach(e=>e()),this.valueSubscriptions.clear(),this.removeFromVariantTree&&this.removeFromVariantTree(),this.parent?.removeChild(this);for(let e in this.events)this.events[e].clear();for(let e in this.features){let t=this.features[e];t&&(t.unmount(),t.isMounted=!1)}this.current=null}addChild(e){this.children.add(e),this.enteringChildren??=new Set,this.enteringChildren.add(e)}removeChild(e){this.children.delete(e),this.enteringChildren&&this.enteringChildren.delete(e)}bindToMotionValue(e,t){if(this.valueSubscriptions.has(e)&&this.valueSubscriptions.get(e)(),t.accelerate&&aI.has(e)&&this.current instanceof HTMLElement){let{factory:n,keyframes:r,times:i,ease:a,duration:o}=t.accelerate,s=new $F({element:this.current,name:e,keyframes:r,times:i,ease:a,duration:gN(o)}),c=n(s);this.valueSubscriptions.set(e,()=>{c(),s.cancel()});return}let n=PF.has(e);n&&this.onBindTransform&&this.onBindTransform();let r=t.on(`change`,t=>{this.latestValues[e]=t,this.props.onUpdate&&XN.preRender(this.notifyUpdate),n&&this.projection&&(this.projection.isTransformDirty=!0),this.scheduleRender()}),i;typeof window<`u`&&window.MotionCheckAppearSync&&(i=window.MotionCheckAppearSync(this,e,t)),this.valueSubscriptions.set(e,()=>{r(),i&&i()})}sortNodePosition(e){return!this.current||!this.sortInstanceNodePosition||this.type!==e.type?0:this.sortInstanceNodePosition(this.current,e.current)}updateFeatures(){let e=`animation`;for(e in eR){let t=eR[e];if(!t)continue;let{isEnabled:n,Feature:r}=t;if(!this.features[e]&&r&&n(this.props)&&(this.features[e]=new r(this)),this.features[e]){let t=this.features[e];t.isMounted?t.update():(t.mount(),t.isMounted=!0)}}}triggerBuild(){this.build(this.renderState,this.latestValues,this.props)}measureViewportBox(){return this.current?this.measureInstanceViewportBox(this.current,this.props):FL()}getStaticValue(e){return this.latestValues[e]}setStaticValue(e,t){this.latestValues[e]=t}update(e,t){(e.transformTemplate||this.props.transformTemplate)&&this.scheduleRender(),this.prevProps=this.props,this.props=e,this.prevPresenceContext=this.presenceContext,this.presenceContext=t;for(let t=0;t<$L.length;t++){let n=$L[t];this.propEventSubscriptions[n]&&(this.propEventSubscriptions[n](),delete this.propEventSubscriptions[n]);let r=e[`on`+n];r&&(this.propEventSubscriptions[n]=this.on(n,r))}this.prevMotionValues=hLe(this,this.scrapeMotionValuesFromProps(e,this.prevProps||{},this),this.prevMotionValues),this.handleChildMotionValue&&this.handleChildMotionValue()}getProps(){return this.props}getVariant(e){return this.props.variants?this.props.variants[e]:void 0}getDefaultTransition(){return this.props.transition}getTransformPagePoint(){return this.props.transformPagePoint}getClosestVariantNode(){return this.isVariantNode?this:this.parent?this.parent.getClosestVariantNode():void 0}addVariantChild(e){let t=this.getClosestVariantNode();if(t)return t.variantChildren&&t.variantChildren.add(e),()=>t.variantChildren.delete(e)}addValue(e,t){let n=this.values.get(e);t!==n&&(n&&this.removeValue(e),this.bindToMotionValue(e,t),this.values.set(e,t),this.latestValues[e]=t.get())}removeValue(e){this.values.delete(e);let t=this.valueSubscriptions.get(e);t&&(t(),this.valueSubscriptions.delete(e)),delete this.latestValues[e],this.removeValueFromRenderState(e,this.renderState)}hasValue(e){return this.values.has(e)}getValue(e,t){if(this.props.values&&this.props.values[e])return this.props.values[e];let n=this.values.get(e);return n===void 0&&t!==void 0&&(n=sI(t===null?void 0:t,{owner:this}),this.addValue(e,n)),n}readValue(e,t){let n=this.latestValues[e]!==void 0||!this.current?this.latestValues[e]:this.getBaseTargetFromProps(this.props,e)??this.readValueFromInstance(this.current,e,this.options);return n!=null&&(typeof n==`string`&&(nN(n)||oN(n))?n=parseFloat(n):!dLe(n)&&RP.test(t)&&(n=yIe(e,t)),this.setBaseTarget(e,EI(n)?n.get():n)),EI(n)?n.get():n}setBaseTarget(e,t){this.baseTarget[e]=t}getBaseTarget(e){let{initial:t}=this.props,n;if(typeof t==`string`||typeof t==`object`){let r=_I(this.props,t,this.presenceContext?.custom);r&&(n=r[e])}if(t&&n!==void 0)return n;let r=this.getBaseTargetFromProps(this.props,e);return r!==void 0&&!EI(r)?r:this.initialValues[e]!==void 0&&n===void 0?void 0:this.baseTarget[e]}on(e,t){return this.events[e]||(this.events[e]=new mN),this.events[e].add(t)}notify(e,...t){this.events[e]&&this.events[e].notify(...t)}scheduleRenderMicrotask(){oL.render(this.render)}}})))()}
var rR;
function iR(){return(iR=t((()=>{DI(),TIe(),nR(),rR=class extends tR{constructor(){super(...arguments),this.KeyframeResolver=wIe}sortInstanceNodePosition(e,t){return e.compareDocumentPosition(t)&2?1:-1}getBaseTargetFromProps(e,t){let n=e.style;return n?n[t]:void 0}removeValueFromRenderState(e,{vars:t,style:n}){delete t[e],delete n[e]}handleChildMotionValue(){this.childSubscription&&(this.childSubscription(),delete this.childSubscription);let{children:e}=this.props;EI(e)&&(this.childSubscription=e.on(`change`,e=>{this.current&&(this.current.textContent=`${e}`)}))}}})))()}
var aR;
function oR(){return(oR=t((()=>{aR=class{constructor(e){this.isMounted=!1,this.node=e}update(){}}})))()}
function sR({top:e,left:t,right:n,bottom:r}){return{x:{min:t,max:n},y:{min:e,max:r}}}
function yLe({x:e,y:t}){return{top:t.min,right:e.max,bottom:t.max,left:e.min}}
function bLe(e,t){if(!t)return e;let n=t({x:e.left,y:e.top}),r=t({x:e.right,y:e.bottom});return{top:n.y,left:n.x,bottom:r.y,right:r.x}}
function cR(e){return e===void 0||e===1}
function lR({scale:e,scaleX:t,scaleY:n}){return!cR(e)||!cR(t)||!cR(n)}
function uR(e){return lR(e)||SLe(e)||e.z||e.rotate||e.rotateX||e.rotateY||e.skewX||e.skewY}
function SLe(e){return CLe(e.x)||CLe(e.y)}
function CLe(e){return e&&e!==`0%`}
function dR(e,t,n){return n+t*(e-n)}
function wLe(e,t,n,r,i){return i!==void 0&&(e=dR(e,i,r)),dR(e,n,r)+t}
function fR(e,t=0,n=1,r,i){e.min=wLe(e.min,t,n,r,i),e.max=wLe(e.max,t,n,r,i)}
function TLe(e,{x:t,y:n}){fR(e.x,t.translate,t.scale,t.originPoint),fR(e.y,n.translate,n.scale,n.originPoint)}
function ELe(e,t,n,r=!1){let i=n.length;if(!i)return;t.x=t.y=1;let a,o;for(let s=0;s<i;s++){a=n[s],o=a.projectionDelta;let{visualElement:i}=a.options;i&&i.props.style&&i.props.style.display===`contents`||(r&&a.options.layoutScroll&&a.scroll&&a!==a.root&&(pR(e.x,-a.scroll.offset.x),pR(e.y,-a.scroll.offset.y)),o&&(t.x*=o.x.scale,t.y*=o.y.scale,TLe(e,o)),r&&uR(a.latestValues)&&mR(e,a.latestValues,a.layout?.layoutBox))}t.x<gR&&t.x>hR&&(t.x=1),t.y<gR&&t.y>hR&&(t.y=1)}
function pR(e,t){e.min+=t,e.max+=t}
function DLe(e,t,n,r,i=.5){fR(e,t,n,HP(e.min,e.max,i),r)}
function OLe(e,t){return typeof e==`string`?parseFloat(e)/100*(t.max-t.min):e}
function mR(e,t,n){let r=n??e;DLe(e.x,OLe(t.x,r.x),t.scaleX,t.scale,t.originX),DLe(e.y,OLe(t.y,r.y),t.scaleY,t.scale,t.originY)}
var hR;
var gR;
function _R(){return(_R=t((()=>{UP(),hR=.999999999999,gR=1.0000000000001})))()}
function kLe(e,t){return sR(bLe(e.getBoundingClientRect(),t))}
function ALe(e,t,n){let r=kLe(e,n),{scroll:i}=t;return i&&(pR(r.x,i.offset.x),pR(r.y,i.offset.y)),r}
function vR(){return(vR=t((()=>{_R()})))()}
function jLe(e,t,n){let r=``,i=!0;for(let a=0;a<NLe;a++){let o=NF[a],s=e[o];if(s===void 0)continue;let c=!0;if(typeof s==`number`)c=s===+!!o.startsWith(`scale`);else{let e=parseFloat(s);c=o.startsWith(`scale`)?e===1:e===0}if(!c||n){let e=nL(s,JI[o]);if(!c){i=!1;let t=MLe[o]||o;r+=`${t}(${e}) `}n&&(t[o]=e)}}let a=e.pathRotation;return a&&(i=!1,r+=`rotate(${nL(a,JI.pathRotation)}) `),r=r.trim(),n?r=n(t,i?``:r):i&&(r=`none`),r}
var MLe;
var NLe;
function PLe(){return(PLe=t((()=>{rL(),YI(),FF(),MLe={x:`translateX`,y:`translateY`,z:`translateZ`,transformPerspective:`perspective`},NLe=NF.length})))()}
function yR(e,t,n){let{style:r,vars:i,transformOrigin:a}=e,o=!1,s=!1;for(let e in t){let n=t[e];if(PF.has(e)){o=!0;continue}if(aP(e)){i[e]=n;continue}{let t=nL(n,JI[e]);e.startsWith(`origin`)?(s=!0,a[e]=t):r[e]=t}}if(t.transform||(o||n?r.transform=jLe(t,e.transform,n):r.transform&&=`none`),s){let{originX:e=`50%`,originY:t=`50%`,originZ:n=0}=a;r.transformOrigin=`${e} ${t} ${n}`}}
function bR(){return(bR=t((()=>{rL(),YI(),FF(),sP(),PLe()})))()}
function FLe(e,{style:t,vars:n},r,i){let a=e.style,o;for(o in t)a[o]=t[o];for(o in i?.applyProjectionStyles(a,r),n)a.setProperty(o,n[o])}
function ILe(e,t){return t.max===t.min?0:e/(t.max-t.min)*100}
var xR;
function LLe(){return(LLe=t((()=>{kP(),xR={correct:(e,t)=>{if(!t.target)return e;if(typeof e==`string`){if(DP.test(e))e=parseFloat(e);else return e}return`${ILe(e,t.target.x)}% ${ILe(e,t.target.y)}%`}}})))()}
var RLe;
function zLe(){return(zLe=t((()=>{zP(),UP(),RLe={correct:(e,{treeScale:t,projectionDelta:n})=>{let r=e,i=RP.parse(e);if(i.length>5)return r;let a=RP.createTransformer(e),o=typeof i[0]==`number`?0:1,s=n.x.scale*t.x,c=n.y.scale*t.y;i[0+o]/=s,i[1+o]/=c;let l=HP(s,c,.5);return typeof i[2+o]==`number`&&(i[2+o]/=l),typeof i[3+o]==`number`&&(i[3+o]/=l),a(i)}}})))()}
var SR;
function CR(){return(CR=t((()=>{eL(),LLe(),zLe(),SR={borderRadius:{...xR,applyTo:[...$I]},borderTopLeftRadius:xR,borderTopRightRadius:xR,borderBottomLeftRadius:xR,borderBottomRightRadius:xR,boxShadow:RLe}})))()}
function wR(e,{layout:t,layoutId:n}){return PF.has(e)||e.startsWith(`origin`)||(t||n!==void 0)&&(!!SR[e]||e===`opacity`)}
function TR(){return(TR=t((()=>{FF(),CR()})))()}
function ER(e,t,n){let r=e.style,i=t?.style,a={};if(!r)return a;for(let t in r)(EI(r[t])||i&&EI(i[t])||wR(t,e)||n?.getValue(t)?.liveStyle!==void 0)&&(a[t]=r[t]);return a}
function DR(){return(DR=t((()=>{DI(),TR()})))()}
function BLe(e){return window.getComputedStyle(e)}
var OR;
function kR(){return(kR=t((()=>{sP(),FF(),MF(),vR(),iR(),bR(),DR(),OR=class extends rR{constructor(){super(...arguments),this.type=`html`,this.renderInstance=FLe}readValueFromInstance(e,t){if(PF.has(t))return this.projection?.isProjecting?wF(t):HPe(e,t);{let n=BLe(e),r=(aP(t)?n.getPropertyValue(t):n[t])||0;return typeof r==`string`?r.trim():r}}measureInstanceViewportBox(e,{transformPagePoint:t}){return kLe(e,t)}build(e,t,n){yR(e,t,n.transformTemplate)}scrapeMotionValuesFromProps(e,t,n){return ER(e,t,n)}}})))()}
function WLe(e,t,n=1,r=0,i=!0){e.pathLength=1;let a=i?GLe:KLe;e[a.offset]=`${-r}`,e[a.array]=`${t} ${n}`}
var GLe;
var KLe;
function qLe(){return(qLe=t((()=>{GLe={offset:`stroke-dashoffset`,array:`stroke-dasharray`},KLe={offset:`strokeDashoffset`,array:`strokeDasharray`}})))()}
function AR(e,{attrX:t,attrY:n,attrScale:r,pathLength:i,pathSpacing:a=1,pathOffset:o=0,...s},c,l,u){if(yR(e,s,l),c){e.style.viewBox&&(e.attrs.viewBox=e.style.viewBox);return}e.attrs=e.style,e.style={};let{attrs:d,style:f}=e;d.transform&&(f.transform=d.transform,delete d.transform),(f.transform||d.transformOrigin)&&(f.transformOrigin=d.transformOrigin??`50% 50%`,delete d.transformOrigin),f.transform&&(f.transformBox=u?.transformBox??`fill-box`,delete d.transformBox);for(let e of JLe)d[e]!==void 0&&(f[e]=d[e],delete d[e]);t!==void 0&&(d.x=t),n!==void 0&&(d.y=n),r!==void 0&&(d.scale=r),i!==void 0&&WLe(d,i,a,o,!1)}
var JLe;
function jR(){return(jR=t((()=>{bR(),qLe(),JLe=[`offsetDistance`,`offsetPath`,`offsetRotate`,`offsetAnchor`]})))()}
var MR;
function NR(){return(NR=t((()=>{MR=new Set([`baseFrequency`,`diffuseConstant`,`kernelMatrix`,`kernelUnitLength`,`keySplines`,`keyTimes`,`limitingConeAngle`,`markerHeight`,`markerWidth`,`numOctaves`,`targetX`,`targetY`,`surfaceScale`,`specularConstant`,`specularExponent`,`stdDeviation`,`tableValues`,`viewBox`,`gradientTransform`,`pathLength`,`startOffset`,`textLength`,`lengthAdjust`])})))()}
var PR;
function FR(){return(FR=t((()=>{PR=e=>typeof e==`string`&&e.toLowerCase()===`svg`})))()}
function YLe(e,t,n,r){FLe(e,t,void 0,r);for(let n in t.attrs)e.setAttribute(MR.has(n)?n:AI(n),t.attrs[n])}
function XLe(){return(XLe=t((()=>{NR()})))()}
function IR(e,t,n){let r=ER(e,t,n);for(let n in e)if(EI(e[n])||EI(t[n])){let t=NF.indexOf(n)===-1?n:`attr`+n.charAt(0).toUpperCase()+n.substring(1);r[t]=e[n]}return r}
function LR(){return(LR=t((()=>{DI(),FF(),DR()})))()}
var RR;
function zR(){return(zR=t((()=>{FF(),ZI(),IL(),iR(),jR(),NR(),FR(),XLe(),LR(),RR=class extends rR{constructor(){super(...arguments),this.type=`svg`,this.isSVGTag=!1,this.measureInstanceViewportBox=FL}getBaseTargetFromProps(e,t){return e[t]}readValueFromInstance(e,t){if(PF.has(t)){let e=XI(t);return e&&e.default||0}return t=MR.has(t)?t:AI(t),e.getAttribute(t)}scrapeMotionValuesFromProps(e,t,n){return IR(e,t,n)}build(e,t,n){AR(e,t,this.isSVGTag,n.transformTemplate,n.style)}renderInstance(e,t,n,r){YLe(e,t,n,r)}mount(e){this.isSVGTag=PR(e.tagName),super.mount(e)}}})))()}
function ZLe(e){if(!e)return;if(!e.isControllingVariants){let t=e.parent&&ZLe(e.parent)||{};return e.props.initial!==void 0&&(t.initial=e.props.initial),t}let t={};for(let n=0;n<QLe;n++){let r=HL[n],i=e.props[r];(BL(i)||i===!1)&&(t[r]=i)}return t}
var QLe;
function $Le(){return($Le=t((()=>{UL(),QLe=HL.length})))()}
function eRe(e,t){if(!Array.isArray(t))return!1;let n=t.length;if(n!==e.length)return!1;for(let r=0;r<n;r++)if(t[r]!==e[r])return!1;return!0}
function tRe(e){return t=>Promise.all(t.map(({animation:t,options:n})=>sIe(e,t,n)))}
function nRe(e){let t=tRe(e),n=iRe(),r=!0,i=!1,a=t=>(n,r)=>{let i=vI(e,r,t===`exit`?e.presenceContext?.custom:void 0);if(i){let{transition:e,transitionEnd:t,...r}=i;n={...n,...r,...t}}return n};function o(n){t=n(e)}function s(o){let{props:s}=e,c=ZLe(e.parent)||{},l=[],u=new Set,d={},f=1/0;for(let t=0;t<oRe;t++){let p=aRe[t],m=n[p],h=s[p]===void 0?c[p]:s[p],g=BL(h),_=p===o?m.isActive:null;_===!1&&(f=t);let v=h===c[p]&&h!==s[p]&&g;if(v&&(r||i)&&e.manuallyAnimateOnMount&&(v=!1),m.protectedKeys={...d},!m.isActive&&_===null||!h&&!m.prevProp||zL(h)||typeof h==`boolean`)continue;if(p===`exit`&&m.isActive&&_!==!0){m.prevResolvedValues&&(d={...d,...m.prevResolvedValues});continue}let y=rRe(m.prevProp,h),b=y||p===o&&m.isActive&&!v&&g||t>f&&g,x=!1,S=Array.isArray(h)?h:[h],C=S.reduce(a(p),{});_===!1&&(C={});let{prevResolvedValues:w={}}=m,T={...w,...C},E=t=>{b=!0,u.has(t)&&(x=!0,u.delete(t)),m.needsAnimating[t]=!0;let n=e.getValue(t);n&&(n.liveStyle=!1)};for(let e in T){let t=C[e],n=w[e];if(d.hasOwnProperty(e))continue;let r=!1;r=SI(t)&&SI(n)?!eRe(t,n)||y:t!==n,r?t==null?u.add(e):E(e):t!==void 0&&u.has(e)?E(e):m.protectedKeys[e]=!0}m.prevProp=h,m.prevResolvedValues=C,m.isActive&&(d={...d,...C}),(r||i)&&e.blockInitialAnimation&&(b=!1);let D=v&&y;b&&(!D||x)&&l.push(...S.map(t=>{let n={type:p};if(typeof t==`string`&&(r||i)&&!D&&e.manuallyAnimateOnMount&&e.parent){let{parent:r}=e,i=vI(r,t);if(r.enteringChildren&&i){let{delayChildren:t}=i.transition||{};n.delay=PFe(r.enteringChildren,e,t)}}return{animation:t,options:n}}))}if(u.size){let t={};if(typeof s.initial!=`boolean`){let n=vI(e,Array.isArray(s.initial)?s.initial[0]:s.initial);n&&n.transition&&(t.transition=n.transition)}u.forEach(n=>{let r=e.getBaseTarget(n),i=e.getValue(n);i&&(i.liveStyle=!0),t[n]=r??null}),l.push({animation:t})}let p=!!l.length;return r&&(s.initial===!1||s.initial===s.animate)&&!e.manuallyAnimateOnMount&&(p=!1),r=!1,i=!1,p?t(l):Promise.resolve()}function c(t,r){if(n[t].isActive===r)return Promise.resolve();e.variantChildren?.forEach(e=>e.animationState?.setActive(t,r)),n[t].isActive=r;let i=s(t);for(let e in n)n[e].protectedKeys={};return i}return{animateChanges:s,setActive:c,setAnimateFunction:o,getState:()=>n,reset:()=>{n=iRe(),i=!0}}}
function rRe(e,t){return typeof t==`string`?t!==e:Array.isArray(t)?!eRe(t,e):!1}
function BR(e=!1){return{isActive:e,protectedKeys:{},needsAnimating:{},prevResolvedValues:{}}}
function iRe(){return{animate:BR(!0),whileInView:BR(),whileHover:BR(),whileTap:BR(),whileDrag:BR(),whileFocus:BR(),exit:BR()}}
var aRe;
var oRe;
function VR(){return(VR=t((()=>{LI(),$Le(),CI(),yI(),UL(),aRe=[...VL].reverse(),oRe=VL.length})))()}
function HR(e,t){e.min=t.min,e.max=t.max}
function UR(e,t){HR(e.x,t.x),HR(e.y,t.y)}
function sRe(e,t){e.translate=t.translate,e.scale=t.scale,e.originPoint=t.originPoint,e.origin=t.origin}
function WR(e){return e.max-e.min}
function cRe(e,t,n){return Math.abs(e-t)<=n}
function lRe(e,t,n,r=.5){e.origin=r,e.originPoint=HP(t.min,t.max,e.origin),e.scale=WR(n)/WR(t),e.translate=HP(n.min,n.max,e.origin)-e.originPoint,(e.scale>=pRe&&e.scale<=mRe||isNaN(e.scale))&&(e.scale=1),(e.translate>=hRe&&e.translate<=gRe||isNaN(e.translate))&&(e.translate=0)}
function GR(e,t,n,r){lRe(e.x,t.x,n.x,r?r.originX:void 0),lRe(e.y,t.y,n.y,r?r.originY:void 0)}
function uRe(e,t,n,r=0){e.min=(r?HP(n.min,n.max,r):n.min)+t.min,e.max=e.min+WR(t)}
function dRe(e,t,n,r){uRe(e.x,t.x,n.x,r?.x),uRe(e.y,t.y,n.y,r?.y)}
function fRe(e,t,n,r=0){let i=r?HP(n.min,n.max,r):n.min;e.min=t.min-i,e.max=e.min+WR(t)}
function KR(e,t,n,r){fRe(e.x,t.x,n.x,r?.x),fRe(e.y,t.y,n.y,r?.y)}
var pRe;
var mRe;
var hRe;
var gRe;
function qR(){return(qR=t((()=>{UP(),pRe=.9999,mRe=1.0001,hRe=-.01,gRe=.01})))()}
function _Re(e,t,n,r,i){return e-=t,e=dR(e,1/n,r),i!==void 0&&(e=dR(e,1/i,r)),e}
function vRe(e,t=0,n=1,r=.5,i,a=e,o=e){if(EP.test(t)&&(t=parseFloat(t),t=HP(o.min,o.max,t/100)-o.min),typeof t!=`number`)return;let s=HP(a.min,a.max,r);e===a&&(s-=t),e.min=_Re(e.min,t,n,s,i),e.max=_Re(e.max,t,n,s,i)}
function yRe(e,t,[n,r,i],a,o){vRe(e,t[n],t[r],t[i],t.scale,a,o)}
function bRe(e,t,n,r){yRe(e.x,t,xRe,n?n.x:void 0,r?r.x:void 0),yRe(e.y,t,SRe,n?n.y:void 0,r?r.y:void 0)}
var xRe;
var SRe;
function CRe(){return(CRe=t((()=>{UP(),kP(),_R(),xRe=[`x`,`scaleX`,`originX`],SRe=[`y`,`scaleY`,`originY`]})))()}
function wRe(e){return e.translate===0&&e.scale===1}
function TRe(e){return wRe(e.x)&&wRe(e.y)}
function ERe(e,t){return e.min===t.min&&e.max===t.max}
function DRe(e,t){return ERe(e.x,t.x)&&ERe(e.y,t.y)}
function ORe(e,t){return Math.round(e.min)===Math.round(t.min)&&Math.round(e.max)===Math.round(t.max)}
function kRe(e,t){return ORe(e.x,t.x)&&ORe(e.y,t.y)}
function ARe(e){return WR(e.x)/WR(e.y)}
function jRe(e,t){return e.translate===t.translate&&e.scale===t.scale&&e.originPoint===t.originPoint}
function MRe(){return(MRe=t((()=>{qR()})))()}
function JR(e){return[e(`x`),e(`y`)]}
function PRe(e,t,n){let r=``,i=e.x.translate/t.x,a=e.y.translate/t.y,o=n?.z||0;if((i||a||o)&&(r=`translate3d(${i}px, ${a}px, ${o}px) `),(t.x!==1||t.y!==1)&&(r+=`scale(${1/t.x}, ${1/t.y}) `),n){let{transformPerspective:e,rotate:t,pathRotation:i,rotateX:a,rotateY:o,skewX:s,skewY:c}=n;e&&(r=`perspective(${e}px) ${r}`),t&&(r+=`rotate(${t}deg) `),i&&(r+=`rotate(${i}deg) `),a&&(r+=`rotateX(${a}deg) `),o&&(r+=`rotateY(${o}deg) `),s&&(r+=`skewX(${s}deg) `),c&&(r+=`skewY(${c}deg) `)}let s=e.x.scale*t.x,c=e.y.scale*t.y;return(s!==1||c!==1)&&(r+=`scale(${s}, ${c})`),r||`none`}
function FRe(e,t,n,r,i,a){i?(e.opacity=HP(0,n.opacity??1,zRe(r)),e.opacityExit=HP(t.opacity??1,0,BRe(r))):a&&(e.opacity=HP(t.opacity??1,n.opacity??1,r));for(let i=0;i<RRe;i++){let a=$I[i],o=IRe(t,a),s=IRe(n,a);(o!==void 0||s!==void 0)&&(o||=0,s||=0,o===0||s===0||XR(o)===XR(s)?(e[a]=Math.max(HP(YR(o),YR(s),r),0),(EP.test(s)||EP.test(o))&&(e[a]+=`%`)):e[a]=s)}(t.rotate||n.rotate)&&(e.rotate=HP(t.rotate||0,n.rotate||0,r))}
function IRe(e,t){return e[t]===void 0?e.borderRadius:e[t]}
function LRe(e,t,n){return r=>r<e?0:r>t?1:n(fN(e,t,r))}
var RRe;
var YR;
var XR;
var zRe;
var BRe;
function VRe(){return(VRe=t((()=>{UP(),kP(),pN(),LN(),lN(),eL(),RRe=$I.length,YR=e=>typeof e==`string`?parseFloat(e):e,XR=e=>typeof e==`number`||DP.test(e),zRe=LRe(0,.5,FN),BRe=LRe(.5,.95,cN)})))()}
function HRe(e,t,n){let r=EI(e)?e:sI(e);return r.start(hI(``,r,t,n)),r.animation}
function ZR(){return(ZR=t((()=>{gI(),dI(),DI()})))()}
function QR(e,t,n,r={passive:!0}){return e.addEventListener(t,n,r),()=>e.removeEventListener(t,n,r)}
var WRe;
function GRe(){return(GRe=t((()=>{WRe=(e,t)=>e.depth-t.depth})))()}
var KRe;
function qRe(){return(qRe=t((()=>{GRe(),KRe=class{constructor(){this.children=[],this.isDirty=!1}add(e){qM(this.children,e),this.isDirty=!0}remove(e){JM(this.children,e),this.isDirty=!0}forEach(e){this.isDirty&&this.children.sort(WRe),this.isDirty=!1,this.children.forEach(e)}}})))()}
function JRe(e,t){let n=nP.now(),r=({timestamp:i})=>{let a=i-n;a>=t&&(ZN(r),e(a-t))};return XN.setup(r,!0),()=>ZN(r)}
function YRe(){return(YRe=t((()=>{rP(),eP()})))()}
function $R(e){return EI(e)?e.get():e}
function ez(){return(ez=t((()=>{DI()})))()}
var XRe;
function ZRe(){return(ZRe=t((()=>{XRe=class{constructor(){this.members=[]}add(e){qM(this.members,e);for(let t=this.members.length-1;t>=0;t--){let n=this.members[t];if(n===e||n===this.lead||n===this.prevLead)continue;let r=n.instance;(!r||r.isConnected===!1)&&!n.snapshot&&(JM(this.members,n),n.unmount())}e.scheduleRender()}remove(e){if(JM(this.members,e),e===this.prevLead&&(this.prevLead=void 0),e===this.lead){let e=this.members[this.members.length-1];e&&this.promote(e)}}relegate(e){for(let t=this.members.indexOf(e)-1;t>=0;t--){let e=this.members[t];if(e.isPresent!==!1&&e.instance?.isConnected!==!1)return this.promote(e),!0}return!1}promote(e,t){let n=this.lead;if(e!==n&&(this.prevLead=n,this.lead=e,e.show(),n)){n.updateSnapshot(),e.scheduleRender();let{layoutDependency:r}=n.options,{layoutDependency:i}=e.options;(r===void 0||r!==i)&&(e.resumeFrom=n,t&&(n.preserveOpacity=!0),n.snapshot&&(e.snapshot=n.snapshot,e.snapshot.latestValues=n.animationValues||n.latestValues),e.root?.isUpdating&&(e.isLayoutDirty=!0)),e.options.crossfade===!1&&n.hide()}}exitAnimationComplete(){this.members.forEach(e=>{e.options.onExitComplete?.(),e.resumingFrom?.options.onExitComplete?.()})}scheduleRender(){this.members.forEach(e=>e.instance&&e.scheduleRender(!1))}removeLeadSnapshot(){this.lead?.snapshot&&(this.lead.snapshot=void 0)}}})))()}
var tz;
function nz(){return(nz=t((()=>{tz={hasAnimatedSinceResize:!0,hasEverUpdated:!1}})))()}
function rz(e,t,n,r){let{latestValues:i}=t;i[e]&&(n[e]=i[e],t.setStaticValue(e,0),r&&(r[e]=0))}
function QRe(e){if(e.hasCheckedOptimisedAppear=!0,e.root===e)return;let{visualElement:t}=e.options;if(!t)return;let n=rIe(t);if(window.MotionHasOptimisedAnimation(n,`transform`)){let{layout:t,layoutId:r}=e.options;window.MotionCancelOptimisedAnimation(n,`transform`,XN,!(t||r))}let{parent:r}=e;r&&!r.hasCheckedOptimisedAppear&&QRe(r)}
function $Re({attachResizeListener:e,defaultParent:t,measureScroll:n,checkIsScrollRoot:r,resetTransform:i}){return class{constructor(e={},n=t?.()){this.id=wze++,this.animationId=0,this.animationCommitId=0,this.children=new Set,this.options={},this.isTreeAnimating=!1,this.isAnimationBlocked=!1,this.isLayoutDirty=!1,this.isProjectionDirty=!1,this.isSharedProjectionDirty=!1,this.isTransformDirty=!1,this.updateManuallyBlocked=!1,this.updateBlockedByResize=!1,this.isUpdating=!1,this.isSVG=!1,this.needsReset=!1,this.shouldResetTransform=!1,this.hasCheckedOptimisedAppear=!1,this.treeScale={x:1,y:1},this.eventHandlers=new Map,this.hasTreeAnimated=!1,this.layoutVersion=0,this.updateScheduled=!1,this.scheduleUpdate=()=>this.update(),this.projectionUpdateScheduled=!1,this.checkUpdateFailed=()=>{this.isUpdating&&(this.isUpdating=!1,this.clearAllSnapshots())},this.updateProjection=()=>{this.projectionUpdateScheduled=!1,kL.value&&(iz.nodes=iz.calculatedTargetDeltas=iz.calculatedProjections=0),this.nodes.forEach(nze),this.nodes.forEach(dze),this.nodes.forEach(fze),this.nodes.forEach(rze),kL.addProjectionMetrics&&kL.addProjectionMetrics(iz)},this.resolvedRelativeTargetAt=0,this.linkedParentVersion=0,this.hasProjected=!1,this.isVisible=!0,this.animationProgress=0,this.sharedNodes=new Map,this.latestValues=e,this.root=n?n.root||n:this,this.path=n?[...n.path,n]:[],this.parent=n,this.depth=n?n.depth+1:0;for(let e=0;e<this.path.length;e++)this.path[e].shouldResetTransform=!0;this.root===this&&(this.nodes=new KRe)}addEventListener(e,t){return this.eventHandlers.has(e)||this.eventHandlers.set(e,new mN),this.eventHandlers.get(e).add(t)}notifyListeners(e,...t){let n=this.eventHandlers.get(e);n&&n.notify(...t)}hasListeners(e){return this.eventHandlers.has(e)}mount(t){if(this.instance)return;this.isSVG=SL(t)&&!tLe(t),this.instance=t;let{layoutId:n,layout:r,visualElement:i}=this.options;if(i&&!i.current&&i.mount(t),this.root.nodes.add(this),this.parent&&this.parent.children.add(this),this.root.hasTreeAnimated&&(r||n)&&(this.isLayoutDirty=!0),e){let n,r=0,i=()=>this.root.updateBlockedByResize=!1;XN.read(()=>{r=window.innerWidth}),e(t,()=>{let e=window.innerWidth;e!==r&&(r=e,this.root.updateBlockedByResize=!0,n&&n(),n=JRe(i,250),tz.hasAnimatedSinceResize&&(tz.hasAnimatedSinceResize=!1,this.nodes.forEach(uze)))})}n&&this.root.registerSharedNode(n,this),this.options.animate!==!1&&i&&(n||r)&&this.addEventListener(`didUpdate`,({delta:e,hasLayoutChanged:t,hasRelativeLayoutChanged:n,layout:r})=>{if(this.isTreeAnimationBlocked()){this.target=void 0,this.relativeTarget=void 0;return}let a=this.options.transition||i.getDefaultTransition()||Tze,{onLayoutAnimationStart:o,onLayoutAnimationComplete:s}=i.getProps(),c=!this.targetLayout||!kRe(this.targetLayout,r),l=!t&&n;if(this.options.layoutRoot||this.resumeFrom||l||t&&(c||!this.currentAnimation)){this.resumeFrom&&(this.resumingFrom=this.resumeFrom,this.resumingFrom.resumingFrom=void 0);let t={...pI(a,`layout`),onPlay:o,onComplete:s};(i.shouldReduceMotion||this.options.layoutRoot)&&(t.delay=0,t.type=!1),this.startAnimation(t),this.setAnimationOrigin(e,l,t.path)}else t||uze(this),this.isLead()&&this.options.onExitComplete&&this.options.onExitComplete();this.targetLayout=r})}unmount(){this.options.layoutId&&this.willUpdate(),this.root.nodes.remove(this);let e=this.getStack();e&&e.remove(this);let{layoutId:t}=this.options;if(t&&e&&!e.members.length){let{root:n}=this;XN.postRender(()=>{n.sharedNodes.get(t)===e&&!e.members.length&&n.sharedNodes.delete(t)})}this.parent&&this.parent.children.delete(this),this.instance=void 0,this.eventHandlers.clear(),ZN(this.updateProjection)}blockUpdate(){this.updateManuallyBlocked=!0}unblockUpdate(){this.updateManuallyBlocked=!1}isUpdateBlocked(){return this.updateManuallyBlocked||this.updateBlockedByResize}isTreeAnimationBlocked(){return this.isAnimationBlocked||this.parent&&this.parent.isTreeAnimationBlocked()||!1}startUpdate(){this.isUpdateBlocked()||(this.isUpdating=!0,this.nodes&&this.nodes.forEach(pze),this.animationId++)}getTransformTemplate(){let{visualElement:e}=this.options;return e&&e.getProps().transformTemplate}willUpdate(e=!0){if(this.root.hasTreeAnimated=!0,this.root.isUpdateBlocked()){this.options.onExitComplete&&this.options.onExitComplete();return}if(window.MotionCancelOptimisedAnimation&&!this.hasCheckedOptimisedAppear&&QRe(this),!this.root.isUpdating&&this.root.startUpdate(),this.isLayoutDirty)return;this.isLayoutDirty=!0;for(let e=0;e<this.path.length;e++){let t=this.path[e];t.shouldResetTransform=!0,(typeof t.latestValues.x==`string`||typeof t.latestValues.y==`string`)&&(t.isLayoutDirty=!0),t.updateScroll(`snapshot`),t.options.layoutRoot&&t.willUpdate(!1)}let{layoutId:t,layout:n}=this.options;if(t===void 0&&!n)return;let r=this.getTransformTemplate();this.prevTransformTemplateValue=r?r(this.latestValues,``):void 0,this.updateSnapshot(),e&&this.notifyListeners(`willUpdate`)}update(){if(this.updateScheduled=!1,this.isUpdateBlocked()){let e=this.updateBlockedByResize;this.unblockUpdate(),this.updateBlockedByResize=!1,this.clearAllSnapshots(),e&&this.nodes.forEach(oze),this.nodes.forEach(aze);return}if(this.animationId<=this.animationCommitId){this.nodes.forEach(sze);return}this.animationCommitId=this.animationId,this.isUpdating?(this.isUpdating=!1,this.nodes.forEach(cze),this.nodes.forEach(lze),this.nodes.forEach(eze),this.nodes.forEach(tze)):this.nodes.forEach(sze),this.clearAllSnapshots();let e=nP.now();QN.delta=YM(0,1e3/60,e-QN.timestamp),QN.timestamp=e,QN.isProcessing=!0,$N.update.process(QN),$N.preRender.process(QN),$N.render.process(QN),QN.isProcessing=!1}didUpdate(){this.updateScheduled||(this.updateScheduled=!0,oL.read(this.scheduleUpdate))}clearAllSnapshots(){this.nodes.forEach(ize),this.sharedNodes.forEach(mze)}scheduleUpdateProjection(){this.projectionUpdateScheduled||(this.projectionUpdateScheduled=!0,XN.preRender(this.updateProjection,!1,!0))}scheduleCheckAfterUnmount(){XN.postRender(()=>{this.isLayoutDirty?this.root.didUpdate():this.root.checkUpdateFailed()})}updateSnapshot(){!this.snapshot&&this.instance&&(this.snapshot=this.measure(),this.snapshot&&!WR(this.snapshot.measuredBox.x)&&!WR(this.snapshot.measuredBox.y)&&(this.snapshot=void 0))}updateLayout(){if(!this.instance||(this.updateScroll(),!(this.options.alwaysMeasureLayout&&this.isLead())&&!this.isLayoutDirty))return;if(this.resumeFrom&&!this.resumeFrom.instance)for(let e=0;e<this.path.length;e++)this.path[e].updateScroll();let e=this.layout;this.layout=this.measure(!1),this.layoutVersion++,this.layoutCorrected||=FL(),this.isLayoutDirty=!1,this.projectionDelta=void 0,this.notifyListeners(`measure`,this.layout.layoutBox);let{visualElement:t}=this.options;t&&t.notify(`LayoutMeasure`,this.layout.layoutBox,e?e.layoutBox:void 0)}updateScroll(e=`measure`){let t=!!(this.options.layoutScroll&&this.instance);if(this.scroll&&this.scroll.animationId===this.root.animationId&&this.scroll.phase===e&&(t=!1),t&&this.instance){let t=r(this.instance);this.scroll={animationId:this.root.animationId,phase:e,isRoot:t,offset:n(this.instance),wasRoot:this.scroll?this.scroll.isRoot:t}}}resetTransform(){if(!i)return;let e=this.isLayoutDirty||this.shouldResetTransform||this.options.alwaysMeasureLayout,t=this.projectionDelta&&!TRe(this.projectionDelta),n=this.getTransformTemplate(),r=n?n(this.latestValues,``):void 0,a=r!==this.prevTransformTemplateValue;e&&this.instance&&(t||uR(this.latestValues)||a)&&(i(this.instance,r),this.shouldResetTransform=!1,this.scheduleRender())}measure(e=!0){let t=this.measurePageBox(),n=this.removeElementScroll(t);return e&&(n=this.removeTransform(n)),bze(n),{animationId:this.root.animationId,measuredBox:t,layoutBox:n,latestValues:{},source:this.id}}measurePageBox(){let{visualElement:e}=this.options;if(!e)return FL();let t=e.measureViewportBox();if(!(this.scroll?.wasRoot||this.path.some(Sze))){let{scroll:e}=this.root;e&&(pR(t.x,e.offset.x),pR(t.y,e.offset.y))}return t}removeElementScroll(e){let t=FL();if(UR(t,e),this.scroll?.wasRoot)return t;for(let n=0;n<this.path.length;n++){let r=this.path[n],{scroll:i,options:a}=r;r!==this.root&&i&&a.layoutScroll&&(i.wasRoot&&UR(t,e),pR(t.x,i.offset.x),pR(t.y,i.offset.y))}return t}applyTransform(e,t=!1,n){let r=n||FL();UR(r,e);for(let e=0;e<this.path.length;e++){let n=this.path[e];!t&&n.options.layoutScroll&&n.scroll&&n!==n.root&&(pR(r.x,-n.scroll.offset.x),pR(r.y,-n.scroll.offset.y)),uR(n.latestValues)&&mR(r,n.latestValues,n.layout?.layoutBox)}return uR(this.latestValues)&&mR(r,this.latestValues,this.layout?.layoutBox),r}removeTransform(e){let t=FL();UR(t,e);for(let e=0;e<this.path.length;e++){let n=this.path[e];if(!uR(n.latestValues))continue;let r;n.instance&&(lR(n.latestValues)&&n.updateSnapshot(),r=FL(),UR(r,n.measurePageBox())),bRe(t,n.latestValues,n.snapshot?.layoutBox,r)}return uR(this.latestValues)&&bRe(t,this.latestValues),t}setTargetDelta(e){this.targetDelta=e,this.root.scheduleUpdateProjection(),this.isProjectionDirty=!0}setOptions(e){this.options={...this.options,...e,crossfade:e.crossfade===void 0||e.crossfade}}clearMeasurements(){this.scroll=void 0,this.layout=void 0,this.snapshot=void 0,this.prevTransformTemplateValue=void 0,this.targetDelta=void 0,this.target=void 0,this.isLayoutDirty=!1}forceRelativeParentToResolveTarget(){this.relativeParent&&this.relativeParent.resolvedRelativeTargetAt!==QN.timestamp&&this.relativeParent.resolveTargetDelta(!0)}resolveTargetDelta(e=!1){let t=this.getLead();this.isProjectionDirty||=t.isProjectionDirty,this.isTransformDirty||=t.isTransformDirty,this.isSharedProjectionDirty||=t.isSharedProjectionDirty;let n=!!this.resumingFrom||this!==t;if(!(e||n&&this.isSharedProjectionDirty||this.isProjectionDirty||this.parent?.isProjectionDirty||this.attemptToResolveRelativeTarget||this.root.updateBlockedByResize))return;let{layout:r,layoutId:i}=this.options;if(!this.layout||!(r||i))return;this.resolvedRelativeTargetAt=QN.timestamp;let a=this.getClosestProjectingParent();a&&this.linkedParentVersion!==a.layoutVersion&&!a.options.layoutRoot&&this.removeRelativeTarget(),!this.targetDelta&&!this.relativeTarget&&(this.options.layoutAnchor!==!1&&a&&a.layout?this.createRelativeTarget(a,this.layout.layoutBox,a.layout.layoutBox):this.removeRelativeTarget()),(this.relativeTarget||this.targetDelta)&&(this.target||(this.target=FL(),this.targetWithTransforms=FL()),this.relativeTarget&&this.relativeTargetOrigin&&this.relativeParent&&this.relativeParent.target?(this.forceRelativeParentToResolveTarget(),dRe(this.target,this.relativeTarget,this.relativeParent.target,this.options.layoutAnchor||void 0)):this.targetDelta?(this.resumingFrom?this.applyTransform(this.layout.layoutBox,!1,this.target):UR(this.target,this.layout.layoutBox),TLe(this.target,this.targetDelta)):UR(this.target,this.layout.layoutBox),this.attemptToResolveRelativeTarget&&(this.attemptToResolveRelativeTarget=!1,this.options.layoutAnchor!==!1&&a&&!!a.resumingFrom==!!this.resumingFrom&&!a.options.layoutScroll&&a.target&&this.animationProgress!==1?this.createRelativeTarget(a,this.target,a.target):this.relativeParent=this.relativeTarget=void 0),kL.value&&iz.calculatedTargetDeltas++)}getClosestProjectingParent(){if(!(!this.parent||lR(this.parent.latestValues)||SLe(this.parent.latestValues)))return this.parent.isProjecting()?this.parent:this.parent.getClosestProjectingParent()}isProjecting(){return!!((this.relativeTarget||this.targetDelta||this.options.layoutRoot)&&this.layout)}createRelativeTarget(e,t,n){this.relativeParent=e,this.linkedParentVersion=e.layoutVersion,this.forceRelativeParentToResolveTarget(),this.relativeTarget=FL(),this.relativeTargetOrigin=FL(),KR(this.relativeTargetOrigin,t,n,this.options.layoutAnchor||void 0),UR(this.relativeTarget,this.relativeTargetOrigin)}removeRelativeTarget(){this.relativeParent=this.relativeTarget=void 0}calcProjection(){let e=this.getLead(),t=!!this.resumingFrom||this!==e,n=!0;if((this.isProjectionDirty||this.parent?.isProjectionDirty)&&(n=!1),t&&(this.isSharedProjectionDirty||this.isTransformDirty)&&(n=!1),this.resolvedRelativeTargetAt===QN.timestamp&&(n=!1),n)return;let{layout:r,layoutId:i}=this.options;if(this.isTreeAnimating=!!(this.parent&&this.parent.isTreeAnimating||this.currentAnimation||this.pendingAnimation),this.isTreeAnimating||(this.targetDelta=this.relativeTarget=void 0),!this.layout||!(r||i))return;UR(this.layoutCorrected,this.layout.layoutBox);let a=this.treeScale.x,o=this.treeScale.y;ELe(this.layoutCorrected,this.treeScale,this.path,t),e.layout&&!e.target&&(this.treeScale.x!==1||this.treeScale.y!==1)&&(e.target=e.layout.layoutBox,e.targetWithTransforms=FL());let{target:s}=e;if(!s){this.prevProjectionDelta&&(this.createProjectionDeltas(),this.scheduleRender());return}!this.projectionDelta||!this.prevProjectionDelta?this.createProjectionDeltas():(sRe(this.prevProjectionDelta.x,this.projectionDelta.x),sRe(this.prevProjectionDelta.y,this.projectionDelta.y)),GR(this.projectionDelta,this.layoutCorrected,s,this.latestValues),(this.treeScale.x!==a||this.treeScale.y!==o||!jRe(this.projectionDelta.x,this.prevProjectionDelta.x)||!jRe(this.projectionDelta.y,this.prevProjectionDelta.y))&&(this.hasProjected=!0,this.scheduleRender(),this.notifyListeners(`projectionUpdate`,s)),kL.value&&iz.calculatedProjections++}hide(){this.isVisible=!1}show(){this.isVisible=!0}scheduleRender(e=!0){if(this.options.visualElement?.scheduleRender(),e){let e=this.getStack();e&&e.scheduleRender()}this.resumingFrom&&!this.resumingFrom.instance&&(this.resumingFrom=void 0)}createProjectionDeltas(){this.prevProjectionDelta=NL(),this.projectionDelta=NL(),this.projectionDeltaWithTransform=NL()}setAnimationOrigin(e,t=!1,n){let r=this.snapshot,i=r?r.latestValues:{},a={...this.latestValues},o=NL();(!this.relativeParent||!this.relativeParent.options.layoutRoot)&&(this.relativeTarget=this.relativeTargetOrigin=void 0),this.attemptToResolveRelativeTarget=!t;let s=FL(),c=(r?r.source:void 0)!==(this.layout?this.layout.source:void 0),l=this.getStack(),u=!l||l.members.length<=1,d=!(!c||u||this.options.crossfade!==!0||this.path.some(vze));this.animationProgress=0;let f,p=n?.interpolateProjection(e);this.mixTargetDelta=t=>{let n=t/1e3,r=p?.(n);r?(o.x.translate=r.x,o.x.scale=HP(e.x.scale,1,n),o.x.origin=e.x.origin,o.x.originPoint=e.x.originPoint,o.y.translate=r.y,o.y.scale=HP(e.y.scale,1,n),o.y.origin=e.y.origin,o.y.originPoint=e.y.originPoint):(hze(o.x,e.x,n),hze(o.y,e.y,n)),this.setTargetDelta(o),this.relativeTarget&&this.relativeTargetOrigin&&this.layout&&this.relativeParent&&this.relativeParent.layout&&(KR(s,this.layout.layoutBox,this.relativeParent.layout.layoutBox,this.options.layoutAnchor||void 0),_ze(this.relativeTarget,this.relativeTargetOrigin,s,n),f&&DRe(this.relativeTarget,f)&&(this.isProjectionDirty=!1),f||=FL(),UR(f,this.relativeTarget)),c&&(this.animationValues=a,FRe(a,i,this.latestValues,n,d,u)),r&&r.rotate!==void 0&&(this.animationValues||=a,this.animationValues.pathRotation=r.rotate),this.root.scheduleUpdateProjection(),this.scheduleRender(),this.animationProgress=n},this.mixTargetDelta(this.options.layoutRoot?1e3:0)}startAnimation(e){this.notifyListeners(`animationStart`),this.currentAnimation?.stop(),this.resumingFrom?.currentAnimation?.stop(),this.pendingAnimation&&=(ZN(this.pendingAnimation),void 0),this.pendingAnimation=XN.update(()=>{tz.hasAnimatedSinceResize=!0,this.motionValue||=sI(0),this.motionValue.jump(0,!1),this.currentAnimation=HRe(this.motionValue,[0,1e3],{...e,velocity:0,isSync:!0,onUpdate:t=>{this.mixTargetDelta(t),e.onUpdate&&e.onUpdate(t)},onComplete:()=>{e.onComplete&&e.onComplete(),this.completeAnimation()}}),this.resumingFrom&&(this.resumingFrom.currentAnimation=this.currentAnimation),this.pendingAnimation=void 0})}completeAnimation(){this.resumingFrom&&(this.resumingFrom.currentAnimation=void 0,this.resumingFrom.preserveOpacity=void 0);let e=this.getStack();e&&e.exitAnimationComplete(),this.resumingFrom=this.currentAnimation=this.animationValues=void 0,this.notifyListeners(`animationComplete`)}finishAnimation(){this.currentAnimation&&(this.mixTargetDelta&&this.mixTargetDelta(Cze),this.currentAnimation.stop()),this.completeAnimation()}applyTransformsToTarget(){let e=this.getLead(),{targetWithTransforms:t,target:n,layout:r,latestValues:i}=e;if(t&&n&&r){if(this!==e&&this.layout&&r&&xze(this.options.animationType,this.layout.layoutBox,r.layoutBox)){n=this.target||FL();let t=WR(this.layout.layoutBox.x);n.x.min=e.target.x.min,n.x.max=n.x.min+t;let r=WR(this.layout.layoutBox.y);n.y.min=e.target.y.min,n.y.max=n.y.min+r}UR(t,n),mR(t,i),GR(this.projectionDeltaWithTransform,this.layoutCorrected,t,i)}}registerSharedNode(e,t){this.sharedNodes.has(e)||this.sharedNodes.set(e,new XRe),this.sharedNodes.get(e).add(t);let n=t.options.initialPromotionConfig;t.promote({transition:n?n.transition:void 0,preserveFollowOpacity:n&&n.shouldPreserveFollowOpacity?n.shouldPreserveFollowOpacity(t):void 0})}isLead(){let e=this.getStack();return!e||e.lead===this}getLead(){let{layoutId:e}=this.options;return e&&this.getStack()?.lead||this}getPrevLead(){let{layoutId:e}=this.options;return e?this.getStack()?.prevLead:void 0}getStack(){let{layoutId:e}=this.options;if(e)return this.root.sharedNodes.get(e)}promote({needsReset:e,transition:t,preserveFollowOpacity:n}={}){let r=this.getStack();r&&r.promote(this,n),e&&(this.projectionDelta=void 0,this.needsReset=!0),t&&this.setOptions({transition:t})}relegate(){let e=this.getStack();return e?e.relegate(this):!1}resetSkewAndRotation(){let{visualElement:e}=this.options;if(!e)return;let t=!1,{latestValues:n}=e;if((n.z||n.rotate||n.rotateX||n.rotateY||n.rotateZ||n.skewX||n.skewY)&&(t=!0),!t)return;let r={};n.z&&rz(`z`,e,r,this.animationValues);for(let t=0;t<az.length;t++)rz(`rotate${az[t]}`,e,r,this.animationValues),rz(`skew${az[t]}`,e,r,this.animationValues);e.render();for(let t in r)e.setStaticValue(t,r[t]),this.animationValues&&(this.animationValues[t]=r[t]);e.scheduleRender()}applyProjectionStyles(e,t){if(!this.instance||this.isSVG)return;if(!this.isVisible){e.visibility=`hidden`;return}let n=this.getTransformTemplate();if(this.needsReset){this.needsReset=!1,e.visibility=``,e.opacity=``,e.pointerEvents=$R(t?.pointerEvents)||``,e.transform=n?n(this.latestValues,``):`none`;return}let r=this.getLead();if(!this.projectionDelta||!this.layout||!r.target){this.options.layoutId&&(e.opacity=this.latestValues.opacity===void 0?1:this.latestValues.opacity,e.pointerEvents=$R(t?.pointerEvents)||``),this.hasProjected&&!uR(this.latestValues)&&(e.transform=n?n({},``):`none`,this.hasProjected=!1);return}e.visibility=``;let i=r.animationValues||r.latestValues;this.applyTransformsToTarget();let a=PRe(this.projectionDeltaWithTransform,this.treeScale,i);n&&(a=n(i,a)),e.transform=a;let{x:o,y:s}=this.projectionDelta;e.transformOrigin=`${o.origin*100}% ${s.origin*100}% 0`,e.opacity=r.animationValues?r===this?i.opacity??this.latestValues.opacity??1:this.preserveOpacity?this.latestValues.opacity:i.opacityExit:r===this?i.opacity===void 0?``:i.opacity:i.opacityExit===void 0?0:i.opacityExit;for(let t in SR){if(i[t]===void 0)continue;let{correct:n,applyTo:o,isCSSVariable:s}=SR[t],c=a===`none`?i[t]:n(i[t],r);if(o){let t=o.length;for(let n=0;n<t;n++)e[o[n]]=c}else s?this.options.visualElement.renderState.vars[t]=c:e[t]=c}this.options.layoutId&&(e.pointerEvents=r===this?$R(t?.pointerEvents)||``:`none`)}clearSnapshot(){this.resumeFrom=this.snapshot=void 0}resetTree(){this.root.nodes.forEach(e=>e.currentAnimation?.stop()),this.root.nodes.forEach(aze),this.root.sharedNodes.clear()}}}
function eze(e){e.updateLayout()}
function tze(e){let t=e.resumeFrom?.snapshot||e.snapshot;if(e.isLead()&&e.layout&&t&&e.hasListeners(`didUpdate`)){let{layoutBox:n,measuredBox:r}=e.layout,{animationType:i}=e.options,a=t.source!==e.layout.source;if(i===`size`)JR(e=>{let r=a?t.measuredBox[e]:t.layoutBox[e],i=WR(r);r.min=n[e].min,r.max=r.min+i});else if(i===`x`||i===`y`){let e=i===`x`?`y`:`x`;HR(a?t.measuredBox[e]:t.layoutBox[e],n[e])}else xze(i,t.layoutBox,n)&&JR(r=>{let i=a?t.measuredBox[r]:t.layoutBox[r],o=WR(n[r]);i.max=i.min+o,e.relativeTarget&&!e.currentAnimation&&(e.isProjectionDirty=!0,e.relativeTarget[r].max=e.relativeTarget[r].min+o)});let o=NL();GR(o,n,t.layoutBox);let s=NL();a?GR(s,e.applyTransform(r,!0),t.measuredBox):GR(s,n,t.layoutBox);let c=!TRe(o),l=!1;if(!e.resumeFrom){let r=e.getClosestProjectingParent();if(r&&!r.resumeFrom){let{snapshot:i,layout:a}=r;if(i&&a){let o=e.options.layoutAnchor||void 0,s=FL();KR(s,t.layoutBox,i.layoutBox,o);let c=FL();KR(c,n,a.layoutBox,o),kRe(s,c)||(l=!0),r.options.layoutRoot&&(e.relativeTarget=c,e.relativeTargetOrigin=s,e.relativeParent=r)}}}e.notifyListeners(`didUpdate`,{layout:n,snapshot:t,delta:s,layoutDelta:o,hasLayoutChanged:c,hasRelativeLayoutChanged:l})}else if(e.isLead()){let{onExitComplete:t}=e.options;t&&t()}e.options.transition=void 0}
function nze(e){kL.value&&iz.nodes++,e.parent&&(e.isProjecting()||(e.isProjectionDirty=e.parent.isProjectionDirty),e.isSharedProjectionDirty||=!!(e.isProjectionDirty||e.parent.isProjectionDirty||e.parent.isSharedProjectionDirty),e.isTransformDirty||=e.parent.isTransformDirty)}
function rze(e){e.isProjectionDirty=e.isSharedProjectionDirty=e.isTransformDirty=!1}
function ize(e){e.clearSnapshot()}
function aze(e){e.clearMeasurements()}
function oze(e){e.isLayoutDirty=!0,e.updateLayout()}
function sze(e){e.isLayoutDirty=!1}
function cze(e){e.isAnimationBlocked&&e.layout&&!e.isLayoutDirty&&(e.snapshot=e.layout,e.isLayoutDirty=!0)}
function lze(e){let{visualElement:t}=e.options;t&&t.getProps().onBeforeLayoutMeasure&&t.notify(`BeforeLayoutMeasure`),e.resetTransform()}
function uze(e){e.finishAnimation(),e.targetDelta=e.relativeTarget=e.target=void 0,e.isProjectionDirty=!0}
function dze(e){e.resolveTargetDelta()}
function fze(e){e.calcProjection()}
function pze(e){e.resetSkewAndRotation()}
function mze(e){e.removeLeadSnapshot()}
function hze(e,t,n){e.translate=HP(t.translate,0,n),e.scale=HP(t.scale,1,n),e.origin=t.origin,e.originPoint=t.originPoint}
function gze(e,t,n,r){e.min=HP(t.min,n.min,r),e.max=HP(t.max,n.max,r)}
function _ze(e,t,n,r){gze(e.x,t.x,n.x,r),gze(e.y,t.y,n.y,r)}
function vze(e){return e.animationValues&&e.animationValues.opacityExit!==void 0}
function yze(e){e.min=sz(e.min),e.max=sz(e.max)}
function bze(e){yze(e.x),yze(e.y)}
function xze(e,t,n){return e===`position`||e===`preserve-aspect`&&!cRe(ARe(t),ARe(n),.2)}
function Sze(e){return e!==e.root&&e.scroll?.wasRoot}
var iz;
var az;
var Cze;
var wze;
var Tze;
var oz;
var sz;
function cz(){return(cz=t((()=>{hN(),XM(),lN(),ZR(),NI(),mI(),sL(),rP(),CR(),eLe(),YRe(),CL(),AL(),UP(),dI(),ez(),VRe(),_R(),qR(),CRe(),IL(),MRe(),ZRe(),qRe(),nz(),eP(),iz={nodes:0,calculatedTargetDeltas:0,calculatedProjections:0},az=[``,`X`,`Y`,`Z`],Cze=1e3,wze=0,Tze={duration:.45,ease:[.4,0,.1,1]},oz=e=>typeof navigator<`u`&&navigator.userAgent&&navigator.userAgent.toLowerCase().includes(e),sz=oz(`applewebkit/`)&&!oz(`chrome/`)?Math.round:cN})))()}
var Eze;
function Dze(){return(Dze=t((()=>{cz(),Eze=$Re({attachResizeListener:(e,t)=>QR(e,`resize`,t),measureScroll:()=>({x:document.documentElement.scrollLeft||document.body?.scrollLeft||0,y:document.documentElement.scrollTop||document.body?.scrollTop||0}),checkIsScrollRoot:()=>!0})})))()}
var lz;
var uz;
function dz(){return(dz=t((()=>{cz(),Dze(),lz={current:void 0},uz=$Re({measureScroll:e=>({x:e.scrollLeft,y:e.scrollTop}),defaultParent:()=>{if(!lz.current){let e=new Eze({});e.mount(window),e.setOptions({layoutScroll:!0}),lz.current=e}return lz.current},resetTransform:(e,t)=>{e.style.transform=t===void 0?`none`:t},checkIsScrollRoot:e=>window.getComputedStyle(e).position===`fixed`})})))()}
var jze=r({default:()=>Mze});
var Mze;
var Nze=t((()=>{throw Mze={},Error(`Could not resolve "@emotion/is-prop-valid" imported by "framer-motion". Is it installed?`)}));
var uBe;
var Wz;
function Gz(){return(Gz=t((()=>{uBe=o(),Wz=(0,uBe.createContext)({})})))()}
function Kz(e){let t=(0,dBe.useRef)(null);return t.current===null&&(t.current=e()),t.current}
var dBe;
function qz(){return(qz=t((()=>{dBe=o()})))()}
var fBe;
function pBe(){return(pBe=t((()=>{fBe=typeof window<`u`})))()}
var Jz;
var Yz;
function Xz(){return(Xz=t((()=>{Jz=o(),pBe(),Yz=fBe?Jz.useLayoutEffect:Jz.useEffect})))()}
var mBe;
var Zz;
function Qz(){return(Qz=t((()=>{mBe=o(),Zz=(0,mBe.createContext)(null)})))()}
var hBe;
var $z;
function eB(){return(eB=t((()=>{hBe=o(),$z=(0,hBe.createContext)({transformPagePoint:e=>e,isStatic:!1,reducedMotion:`never`})})))()}
function gBe(e,t){if(typeof e==`function`)return e(t);e!=null&&(e.current=t)}
function _Be(...e){return t=>{let n=!1,r=e.map(e=>{let r=gBe(e,t);return!n&&typeof r==`function`&&(n=!0),r});if(n)return()=>{for(let t=0;t<r.length;t++){let n=r[t];typeof n==`function`?n():gBe(e[t],null)}}}}
function vBe(...e){return yBe.useCallback(_Be(...e),e)}
var yBe;
function bBe(){return(bBe=t((()=>{yBe=n(o(),1)})))()}
function xBe({children:e,isPresent:t,anchorX:n,anchorY:r,root:i,pop:a}){let o=(0,nB.useId)(),s=(0,nB.useRef)(null),c=(0,nB.useRef)({width:0,height:0,top:0,left:0,right:0,bottom:0,direction:`ltr`}),{nonce:l}=(0,nB.useContext)($z),u=vBe(s,e.props?.ref??e?.ref);return(0,nB.useInsertionEffect)(()=>{let{width:e,height:u,top:d,left:f,right:p,bottom:m,direction:h}=c.current;if(t||a===!1||!s.current||!e||!u)return;let g=h===`rtl`,_=n===`left`?g?`right: ${p}`:`left: ${f}`:g?`left: ${f}`:`right: ${p}`,v=r===`bottom`?`bottom: ${m}`:`top: ${d}`;s.current.dataset.motionPopId=o;let y=document.createElement(`style`);l&&(y.nonce=l);let b=i??document.head;return b.appendChild(y),y.sheet&&y.sheet.insertRule(`
          [data-motion-pop-id="${o}"] {
            position: absolute !important;
            width: ${e}px !important;
            height: ${u}px !important;
            ${_}px !important;
            ${v}px !important;
          }
        `),()=>{s.current?.removeAttribute(`data-motion-pop-id`),b.contains(y)&&b.removeChild(y)}},[t]),(0,SBe.jsx)(CBe,{isPresent:t,childRef:s,sizeRef:c,pop:a,children:a===!1?e:tB.cloneElement(e,{ref:u})})}
var SBe;
var tB;
var nB;
var CBe;
function wBe(){return(wBe=t((()=>{SBe=Y(),aL(),tB=n(o(),1),nB=o(),eB(),bBe(),CBe=class extends tB.Component{getSnapshotBeforeUpdate(e){let t=this.props.childRef.current;if(iL(t)&&e.isPresent&&!this.props.isPresent&&this.props.pop!==!1){let e=t.offsetParent,n=iL(e)&&e.offsetWidth||0,r=iL(e)&&e.offsetHeight||0,i=getComputedStyle(t),a=this.props.sizeRef.current;a.height=parseFloat(i.height),a.width=parseFloat(i.width),a.top=t.offsetTop,a.left=t.offsetLeft,a.right=n-a.width-a.left,a.bottom=r-a.height-a.top,a.direction=i.direction}return null}componentDidUpdate(){}render(){return this.props.children}}})))()}
function TBe(){return new Map}
var rB;
var EBe;
var iB;
var DBe;
function OBe(){return(OBe=t((()=>{rB=Y(),EBe=n(o(),1),iB=o(),Qz(),qz(),Xz(),wBe(),DBe=({children:e,initial:t,isPresent:n,onExitComplete:r,custom:i,presenceAffectsLayout:a,mode:o,anchorX:s,anchorY:c,root:l})=>{let u=Kz(TBe),d=(0,iB.useId)(),f=(0,iB.useRef)(n),p=(0,iB.useRef)(r);Yz(()=>{f.current=n,p.current=r});let m=!0,h=(0,iB.useMemo)(()=>(m=!1,{id:d,initial:t,isPresent:n,custom:i,onExitComplete:e=>{u.set(e,!0);for(let e of u.values())if(!e)return;r&&r()},register:e=>(u.set(e,!1),()=>{u.delete(e),!f.current&&!u.size&&p.current?.()})}),[n,u,r]);return a&&m&&(h={...h}),(0,iB.useMemo)(()=>{u.forEach((e,t)=>u.set(t,!1))},[n]),EBe.useEffect(()=>{!n&&!u.size&&r&&r()},[n]),e=(0,rB.jsx)(xBe,{pop:o===`popLayout`,isPresent:n,anchorX:s,anchorY:c,root:l,children:e}),(0,rB.jsx)(Zz.Provider,{value:h,children:e})}})))()}
function aB(e=!0){let t=(0,oB.useContext)(Zz);if(t===null)return[!0,null];let{isPresent:n,onExitComplete:r,register:i}=t,a=(0,oB.useId)();(0,oB.useEffect)(()=>{if(e)return i(a)},[e]);let o=(0,oB.useCallback)(()=>e&&r&&r(a),[a,r,e]);return!n&&r?[!1,o]:[!0]}
function kBe(){return ABe((0,oB.useContext)(Zz))}
function ABe(e){return e===null||e.isPresent}
var oB;
function sB(){return(sB=t((()=>{oB=o(),Qz()})))()}
function jBe(e){let t=[];return cB.Children.forEach(e,e=>{(0,cB.isValidElement)(e)&&t.push(e)}),t}
var cB;
var lB;
function MBe(){return(MBe=t((()=>{cB=o(),lB=e=>e.key||``})))()}
var uB;
var dB;
var fB;
function pB(){return(pB=t((()=>{uB=Y(),dB=o(),Gz(),qz(),Xz(),OBe(),sB(),MBe(),fB=({children:e,custom:t,initial:n=!0,onExitComplete:r,presenceAffectsLayout:i=!0,mode:a=`sync`,propagate:o=!1,anchorX:s=`left`,anchorY:c=`top`,root:l})=>{let[u,d]=aB(o),f=(0,dB.useMemo)(()=>jBe(e),[e]),p=o&&!u?[]:f.map(lB),m=(0,dB.useRef)(!0),h=(0,dB.useRef)(f),g=Kz(()=>new Map),_=(0,dB.useRef)(new Set),[v,y]=(0,dB.useState)(f),[b,x]=(0,dB.useState)(f);Yz(()=>{m.current=!1,h.current=f;for(let e=0;e<b.length;e++){let t=lB(b[e]);p.includes(t)?(g.delete(t),_.current.delete(t)):g.get(t)!==!0&&g.set(t,!1)}},[b,p.length,p.join(`-`)]);let S=[];if(f!==v){let e=[...f];for(let t=0;t<b.length;t++){let n=b[t],r=lB(n);p.includes(r)||(e.splice(t,0,n),S.push(n))}return a===`wait`&&S.length&&(e=S),x(jBe(e)),y(f),null}let{forceRender:C}=(0,dB.useContext)(Wz);return(0,uB.jsx)(uB.Fragment,{children:b.map(e=>{let v=lB(e),y=o&&!u?!1:f===b||p.includes(v);return(0,uB.jsx)(DBe,{isPresent:y,initial:!m.current||n?void 0:!1,custom:t,presenceAffectsLayout:i,mode:a,root:l,onExitComplete:y?void 0:()=>{if(_.current.has(v))return;if(g.has(v))_.current.add(v),g.set(v,!0);else return;let e=!0;g.forEach(t=>{t||(e=!1)}),e&&(C?.(),x(h.current),o&&d?.(),r&&r())},anchorX:s,anchorY:c,children:e},v)})})}})))()}
function IBe(){let e=(0,LBe.useRef)(!1);return Yz(()=>(e.current=!0,()=>{e.current=!1}),[]),e}
var LBe;
function RBe(){return(RBe=t((()=>{LBe=o(),Xz()})))()}
function zBe(){let e=IBe(),[t,n]=(0,mB.useState)(0),r=(0,mB.useCallback)(()=>{e.current&&n(t+1)},[t]);return[(0,mB.useCallback)(()=>XN.postRender(r),[r]),t]}
var mB;
function hB(){return(hB=t((()=>{eP(),mB=o(),RBe()})))()}
var WBe;
var vB;
function yB(){return(yB=t((()=>{WBe=o(),vB=(0,WBe.createContext)({strict:!1})})))()}
function GBe(){if(xB)return;let e={};for(let t in bB)e[t]={isEnabled:e=>bB[t].some(t=>!!e[t])};QL(e),xB=!0}
function KBe(){return GBe(),vLe()}
var bB;
var xB;
function SB(){return(SB=t((()=>{nR(),bB={animation:[`animate`,`variants`,`whileHover`,`whileTap`,`exit`,`whileInView`,`whileFocus`,`whileDrag`],exit:[`exit`],drag:[`drag`,`dragControls`],focus:[`whileFocus`],hover:[`whileHover`,`onHoverStart`,`onHoverEnd`],tap:[`whileTap`,`onTap`,`onTapStart`,`onTapCancel`],pan:[`onPan`,`onPanStart`,`onPanSessionStart`,`onPanEnd`],inView:[`whileInView`,`onViewportEnter`,`onViewportLeave`],layout:[`layout`,`layoutId`]},xB=!1})))()}
function qBe(e){let t=KBe();for(let n in e)t[n]={...t[n],...e[n]};QL(t)}
function JBe(){return(JBe=t((()=>{nR(),SB()})))()}
function CB(e){return e.startsWith(`while`)||e.startsWith(`drag`)&&e!==`draggable`||e.startsWith(`layout`)||e.startsWith(`onTap`)||e.startsWith(`onPan`)||e.startsWith(`onLayout`)||YBe.has(e)}
var YBe;
function XBe(){return(XBe=t((()=>{YBe=new Set(`animate.exit.variants.initial.style.values.variants.transition.transformTemplate.custom.inherit.onBeforeLayoutMeasure.onAnimationStart.onAnimationComplete.onUpdate.onDragStart.onDrag.onDragEnd.onMeasureDragConstraints.onDirectionLock.onDragTransitionEnd._dragX._dragY.onHoverStart.onHoverEnd.onViewportEnter.onViewportLeave.globalTapTarget.propagate.ignoreStrict.viewport`.split(`.`))})))()}
function ZBe(e){typeof e==`function`&&(wB=t=>t.startsWith(`on`)?!CB(t):e(t))}
function QBe(e,t,n){let r={};for(let i in e)(i!==`values`||typeof e.values!=`object`)&&(EI(e[i])||(wB(i)||n===!0&&CB(i)||!t&&!CB(i)||e.draggable&&i.startsWith(`onDrag`))&&(r[i]=e[i]));return r}
var wB;
function TB(){return(TB=t((()=>{DI(),XBe(),wB=e=>!CB(e);try{ZBe((Nze(),e(jze)).default)}catch{}})))()}
var nVe;
var DB;
function OB(){return(OB=t((()=>{nVe=o(),DB=(0,nVe.createContext)({})})))()}
function rVe(e,t){if(WL(e)){let{initial:t,animate:n}=e;return{initial:t===!1||BL(t)?t:void 0,animate:BL(n)?n:void 0}}return e.inherit===!1?{}:t}
function iVe(){return(iVe=t((()=>{KL()})))()}
function aVe(e){let{initial:t,animate:n}=rVe(e,(0,kB.useContext)(DB));return(0,kB.useMemo)(()=>({initial:t,animate:n}),[oVe(t),oVe(n)])}
function oVe(e){return Array.isArray(e)?e.join(` `):e}
var kB;
function sVe(){return(sVe=t((()=>{kB=o(),OB(),iVe()})))()}
var AB;
function jB(){return(jB=t((()=>{AB=()=>({style:{},transform:{},transformOrigin:{},vars:{}})})))()}
function cVe(e,t,n){for(let r in t)!EI(t[r])&&!wR(r,n)&&(e[r]=t[r])}
function lVe({transformTemplate:e},t){return(0,fVe.useMemo)(()=>{let n=AB();return yR(n,t,e),Object.assign({},n.vars,n.style)},[t])}
function uVe(e,t){let n=e.style||{},r={};return cVe(r,n,e),Object.assign(r,lVe(e,t)),r}
function dVe(e,t){let n={},r=uVe(e,t);return e.drag&&e.dragListener!==!1&&(n.draggable=!1,r.userSelect=r.WebkitUserSelect=r.WebkitTouchCallout=`none`,r.touchAction=e.drag===!0?`none`:`pan-${e.drag===`x`?`y`:`x`}`),e.tabIndex===void 0&&(e.onTap||e.onTapStart||e.whileTap)&&(n.tabIndex=0),n.style=r,n}
var fVe;
function MB(){return(MB=t((()=>{DI(),TR(),bR(),fVe=o(),jB()})))()}
var NB;
function PB(){return(PB=t((()=>{jB(),NB=()=>({...AB(),attrs:{}})})))()}
function pVe(e,t,n,r){let i=(0,mVe.useMemo)(()=>{let n=NB();return AR(n,t,PR(r),e.transformTemplate,e.style),{...n.attrs,style:{...n.style}}},[t]);if(e.style){let t={};cVe(t,e.style,e),i.style={...t,...i.style}}return i}
var mVe;
function hVe(){return(hVe=t((()=>{jR(),FR(),mVe=o(),MB(),PB()})))()}
var gVe;
function _Ve(){return(_Ve=t((()=>{gVe=[`animate`,`circle`,`defs`,`desc`,`ellipse`,`g`,`image`,`line`,`filter`,`marker`,`mask`,`metadata`,`path`,`pattern`,`polygon`,`polyline`,`rect`,`stop`,`switch`,`symbol`,`svg`,`text`,`tspan`,`use`,`view`]})))()}
function FB(e){return typeof e!=`string`||e.includes(`-`)?!1:!!(gVe.indexOf(e)>-1||/[A-Z]/u.test(e))}
function IB(){return(IB=t((()=>{_Ve()})))()}
function vVe(e,t,n,{latestValues:r},i,a=!1,o){let s=(o??FB(e)?pVe:dVe)(t,r,i,e),c=QBe(t,typeof e==`string`,a),l=e===LB.Fragment?{}:{...c,...s,ref:n},{children:u}=t,d=(0,LB.useMemo)(()=>EI(u)?u.get():u,[u]);return(0,LB.createElement)(e,{...l,children:d})}
var LB;
function yVe(){return(yVe=t((()=>{DI(),LB=o(),MB(),hVe(),TB(),IB()})))()}
function bVe({scrapeMotionValuesFromProps:e,createRenderState:t},n,r,i){return{latestValues:xVe(n,r,i,e),renderState:t()}}
function xVe(e,t,n,r){let i={},a=r(e,{});for(let e in a)i[e]=$R(a[e]);let{initial:o,animate:s}=e,c=WL(e),l=GL(e);t&&l&&!c&&e.inherit!==!1&&(o===void 0&&(o=t.initial),s===void 0&&(s=t.animate));let u=n?n.initial===!1:!1;u||=o===!1;let d=u?s:o;if(d&&typeof d!=`boolean`&&!zL(d)){let t=Array.isArray(d)?d:[d];for(let n=0;n<t.length;n++){let r=_I(e,t[n]);if(r){let{transitionEnd:e,transition:t,...n}=r;for(let e in n){let t=n[e];if(Array.isArray(t)){let e=u?t.length-1:0;t=t[e]}t!==null&&(i[e]=t)}for(let t in e)i[t]=e[t]}}}return i}
var RB;
var zB;
function BB(){return(BB=t((()=>{ez(),KL(),RB=o(),OB(),Qz(),qz(),zB=e=>(t,n)=>{let r=(0,RB.useContext)(DB),i=(0,RB.useContext)(Zz),a=()=>bVe(e,t,r,i);return n?a():Kz(a)}})))()}
var SVe;
function CVe(){return(CVe=t((()=>{DR(),BB(),jB(),SVe=zB({scrapeMotionValuesFromProps:ER,createRenderState:AB})})))()}
var wVe;
function TVe(){return(TVe=t((()=>{LR(),BB(),PB(),wVe=zB({scrapeMotionValuesFromProps:IR,createRenderState:NB})})))()}
var EVe;
function DVe(){return(DVe=t((()=>{EVe=Symbol.for(`motionComponentSymbol`)})))()}
function OVe(e,t,n){let r=(0,VB.useRef)(n);(0,VB.useInsertionEffect)(()=>{r.current=n});let i=(0,VB.useRef)(null);return(0,VB.useCallback)(n=>{n&&e.onMount?.(n),t&&(n?t.mount(n):t.unmount(),n&&t.values.forEach((e,n)=>{t.latestValues[n]=e.get()}));let a=r.current;if(typeof a==`function`){if(n){let e=a(n);typeof e==`function`&&(i.current=e)}else i.current?(i.current(),i.current=null):a(n)}else a&&(a.current=n)},[t])}
var VB;
function kVe(){return(kVe=t((()=>{VB=o()})))()}
var AVe;
var HB;
function UB(){return(UB=t((()=>{AVe=o(),HB=(0,AVe.createContext)({})})))()}
function WB(e){return e&&typeof e==`object`&&Object.prototype.hasOwnProperty.call(e,`current`)}
function jVe(e,t,n,r,i,a){let{visualElement:o}=(0,GB.useContext)(DB),s=(0,GB.useContext)(vB),c=(0,GB.useContext)(Zz),l=(0,GB.useContext)($z),u=l.reducedMotion,d=l.skipAnimations,f=(0,GB.useRef)(null),p=(0,GB.useRef)(!1);r||=s.renderer,!f.current&&r&&(f.current=r(e,{visualState:t,parent:o,props:n,presenceContext:c,blockInitialAnimation:c?c.initial===!1:!1,reducedMotionConfig:u,skipAnimations:d,isSVG:a}),p.current&&f.current&&(f.current.manuallyAnimateOnMount=!0));let m=f.current,h=(0,GB.useContext)(HB);m&&!m.projection&&i&&(m.type===`html`||m.type===`svg`)&&MVe(f.current,n,i,h);let g=(0,GB.useRef)(!1);(0,GB.useInsertionEffect)(()=>{m&&g.current&&m.update(n,c)});let _=n[jI],v=(0,GB.useRef)(!!_&&typeof window<`u`&&!window.MotionHandoffIsComplete?.(_)&&window.MotionHasOptimisedAnimation?.(_));return Yz(()=>{p.current=!0,m&&(g.current||m.update(n,c),g.current=!0,window.MotionIsMounted=!0,m.updateFeatures(),m.scheduleRenderMicrotask(),v.current&&m.animationState&&m.animationState.animateChanges())}),(0,GB.useEffect)(()=>{m&&(!v.current&&m.animationState&&m.animationState.animateChanges(),v.current&&=(queueMicrotask(()=>{window.MotionHandoffMarkAsComplete?.(_)}),!1),m.enteringChildren=void 0)}),m}
function MVe(e,t,n,r){let{layoutId:i,layout:a,drag:o,dragConstraints:s,layoutScroll:c,layoutRoot:l,layoutAnchor:u,layoutCrossfade:d}=t;e.projection=new n(e.latestValues,t[`data-framer-portal-id`]?void 0:NVe(e.parent)),e.projection.setOptions({layoutId:i,layout:a,alwaysMeasureLayout:!!o||s&&WB(s),visualElement:e,animationType:typeof a==`string`?a:`both`,initialPromotionConfig:r,crossfade:d,layoutScroll:c,layoutRoot:l,layoutAnchor:u})}
function NVe(e){if(e)return e.options.allowProjection===!1?NVe(e.parent):e.projection}
var GB;
function PVe(){return(PVe=t((()=>{MI(),GB=o(),yB(),eB(),OB(),Qz(),UB(),Xz()})))()}
function KB(e,{forwardMotionProps:t=!1,type:n}={},r,i){r&&qBe(r);let a=n?n===`svg`:FB(e),o=a?wVe:SVe;function s(n,s){let c,l={...(0,JB.useContext)($z),...n,layoutId:FVe(n)},{isStatic:u}=l,d=aVe(n),f=o(n,u);if(!u&&typeof window<`u`){IVe(l,r);let t=LVe(l);c=t.MeasureLayout,d.visualElement=jVe(e,f,l,i,t.ProjectionNode,a)}return(0,qB.jsxs)(DB.Provider,{value:d,children:[c&&d.visualElement?(0,qB.jsx)(c,{visualElement:d.visualElement,...l}):null,vVe(e,n,OVe(f,d.visualElement,s),f,u,t,a)]})}s.displayName=`motion.${typeof e==`string`?e:`create(${e.displayName??e.name??``})`}`;let c=(0,JB.forwardRef)(s);return c[EVe]=e,c}
function FVe({layoutId:e}){let t=(0,JB.useContext)(Wz).id;return t&&e!==void 0?t+`-`+e:e}
function IVe(e,t){(0,JB.useContext)(vB).strict}
function LVe(e){let{drag:t,layout:n}=KBe();if(!t&&!n)return{};let r={...t,...n};return{MeasureLayout:t?.isEnabled(e)||n?.isEnabled(e)?r.MeasureLayout:void 0,ProjectionNode:r.ProjectionNode}}
var qB;
var JB;
function RVe(){return(RVe=t((()=>{qB=Y(),JB=o(),Gz(),yB(),eB(),OB(),sVe(),yVe(),IB(),CVe(),TVe(),SB(),JBe(),DVe(),kVe(),PVe()})))()}
function zVe(e,t){if(typeof Proxy>`u`)return KB;let n=new Map,r=(n,r)=>KB(n,r,e,t);return new Proxy((e,t)=>r(e,t),{get:(i,a)=>a===`create`?r:(n.has(a)||n.set(a,KB(a,void 0,e,t)),n.get(a))})}
function BVe(){return(BVe=t((()=>{RVe()})))()}
var VVe;
var HVe;
function UVe(){return(UVe=t((()=>{zR(),kR(),VVe=o(),IB(),HVe=(e,t)=>t.isSVG??FB(e)?new RR(t):new OR(t,{allowProjection:e!==VVe.Fragment})})))()}
var WVe;
function GVe(){return(GVe=t((()=>{oR(),VR(),WVe=class extends aR{constructor(e){super(e),e.animationState||=nRe(e)}updateAnimationControlsSubscription(){let{animate:e}=this.node.getProps();zL(e)&&(this.unmountControls=e.subscribe(this.node))}mount(){this.updateAnimationControlsSubscription()}update(){let{animate:e}=this.node.getProps(),{animate:t}=this.node.prevProps||{};e!==t&&this.updateAnimationControlsSubscription()}unmount(){this.node.animationState.reset(),this.unmountControls?.()}}})))()}
var KVe;
var qVe;
function JVe(){return(JVe=t((()=>{oR(),yI(),KVe=0,qVe=class extends aR{constructor(){super(...arguments),this.id=KVe++,this.isExitComplete=!1}update(){if(!this.node.presenceContext)return;let{isPresent:e,onExitComplete:t}=this.node.presenceContext,{isPresent:n}=this.node.prevPresenceContext||{};if(!this.node.animationState||e===n)return;if(e&&n===!1){if(this.isExitComplete){let{initial:e,custom:t}=this.node.getProps();if(typeof e==`string`||typeof e==`object`&&e&&!Array.isArray(e)){let n=vI(this.node,e,t);if(n){let{transition:e,transitionEnd:t,...r}=n;for(let e in r)this.node.getValue(e)?.jump(r[e])}}this.node.animationState.reset(),this.node.animationState.animateChanges()}else this.node.animationState.setActive(`exit`,!1);this.isExitComplete=!1;return}let r=this.node.animationState.setActive(`exit`,!e);t&&!e&&r.then(()=>{this.isExitComplete=!0,t(this.id)})}mount(){let{register:e,onExitComplete:t,isPresent:n}=this.node.presenceContext||{};if(n!==!1){t&&t(this.id),e&&(this.unmount=e(this.id));return}let r=!0,i=e?.(this.id);t&&queueMicrotask(()=>{r&&this.node.presenceContext?.isPresent===!1&&t(this.id)}),this.unmount=()=>{r=!1,i?.()}}unmount(){}}})))()}
var YVe;
function XVe(){return(XVe=t((()=>{GVe(),JVe(),YVe={animation:{Feature:WVe},exit:{Feature:qVe}}})))()}
function YB(e){return{point:{x:e.pageX,y:e.pageY}}}
var ZVe;
function XB(){return(XB=t((()=>{hL(),ZVe=e=>t=>mL(t)&&e(t,YB(t))})))()}
function ZB(e,t,n,r){return QR(e,t,ZVe(n),r)}
function QB(){return(QB=t((()=>{XB()})))()}
var $B;
function eV(){return(eV=t((()=>{$B=({current:e})=>e?e.ownerDocument.defaultView:null})))()}
function QVe(e,t){let n=tV(e.x,t.x),r=tV(e.y,t.y);return Math.sqrt(n**2+r**2)}
var tV;
function $Ve(){return($Ve=t((()=>{tV=(e,t)=>Math.abs(e-t)})))()}
function nV(e,t){return t?{point:t(e.point)}:e}
function eHe(e,t){return{x:e.x-t.x,y:e.y-t.y}}
function rV({point:e},t){return{point:e,delta:eHe(e,nHe(t)),offset:eHe(e,tHe(t)),velocity:rHe(t,.1)}}
function tHe(e){return e[0]}
function nHe(e){return e[e.length-1]}
function rHe(e,t){if(e.length<2)return{x:0,y:0};let n=e.length-1,r=null,i=nHe(e);for(;n>=0&&(r=e[n],!(i.timestamp-r.timestamp>gN(t)));)n--;if(!r)return{x:0,y:0};r===e[0]&&e.length>2&&i.timestamp-r.timestamp>gN(t)*2&&(r=e[1]);let a=_N(i.timestamp-r.timestamp);if(a===0)return{x:0,y:0};let o={x:(i.x-r.x)/a,y:(i.y-r.y)/a};return o.x===1/0&&(o.x=0),o.y===1/0&&(o.y=0),o}
var iV;
var aV;
function oV(){return(oV=t((()=>{eP(),hL(),dN(),vN(),QB(),XB(),$Ve(),iV=new Set([`auto`,`scroll`]),aV=class{constructor(e,t,{transformPagePoint:n,contextWindow:r=window,dragSnapToOrigin:i=!1,distanceThreshold:a=3,element:o}={}){if(this.startEvent=null,this.lastMoveEvent=null,this.lastMoveEventInfo=null,this.lastRawMoveEventInfo=null,this.handlers={},this.contextWindow=window,this.scrollPositions=new Map,this.removeScrollListeners=null,this.onElementScroll=e=>{this.handleScroll(e.target)},this.onWindowScroll=()=>{this.handleScroll(window)},this.updatePoint=()=>{if(!(this.lastMoveEvent&&this.lastMoveEventInfo))return;this.lastRawMoveEventInfo&&(this.lastMoveEventInfo=nV(this.lastRawMoveEventInfo,this.transformPagePoint));let e=rV(this.lastMoveEventInfo,this.history),t=this.startEvent!==null,n=QVe(e.offset,{x:0,y:0})>=this.distanceThreshold;if(!t&&!n)return;let{point:r}=e,{timestamp:i}=QN;this.history.push({...r,timestamp:i});let{onStart:a,onMove:o}=this.handlers;t||(a&&a(this.lastMoveEvent,e),this.startEvent=this.lastMoveEvent),o&&o(this.lastMoveEvent,e)},this.handlePointerMove=(e,t)=>{this.lastMoveEvent=e,this.lastRawMoveEventInfo=t,this.lastMoveEventInfo=nV(t,this.transformPagePoint),XN.update(this.updatePoint,!0)},this.handlePointerUp=(e,t)=>{this.end();let{onEnd:n,onSessionEnd:r,resumeAnimation:i}=this.handlers;if((this.dragSnapToOrigin||!this.startEvent)&&i&&i(),!(this.lastMoveEvent&&this.lastMoveEventInfo))return;let a=rV(e.type===`pointercancel`?this.lastMoveEventInfo:nV(t,this.transformPagePoint),this.history);this.startEvent&&n&&n(e,a),r&&r(e,a)},!mL(e))return;this.dragSnapToOrigin=i,this.handlers=t,this.transformPagePoint=n,this.distanceThreshold=a,this.contextWindow=r||window;let s=nV(YB(e),this.transformPagePoint),{point:c}=s,{timestamp:l}=QN;this.history=[{...c,timestamp:l}];let{onSessionStart:u}=t;u&&u(e,rV(s,this.history));let d={passive:!0,capture:!0};this.removeListeners=uN(ZB(this.contextWindow,`pointermove`,this.handlePointerMove,d),ZB(this.contextWindow,`pointerup`,this.handlePointerUp,d),ZB(this.contextWindow,`pointercancel`,this.handlePointerUp,d)),o&&this.startScrollTracking(o)}startScrollTracking(e){let t=e.parentElement;for(;t;){let e=getComputedStyle(t);(iV.has(e.overflowX)||iV.has(e.overflowY))&&this.scrollPositions.set(t,{x:t.scrollLeft,y:t.scrollTop}),t=t.parentElement}this.scrollPositions.set(window,{x:window.scrollX,y:window.scrollY}),window.addEventListener(`scroll`,this.onElementScroll,{capture:!0}),window.addEventListener(`scroll`,this.onWindowScroll),this.removeScrollListeners=()=>{window.removeEventListener(`scroll`,this.onElementScroll,{capture:!0}),window.removeEventListener(`scroll`,this.onWindowScroll)}}handleScroll(e){let t=this.scrollPositions.get(e);if(!t)return;let n=e===window,r=n?{x:window.scrollX,y:window.scrollY}:{x:e.scrollLeft,y:e.scrollTop},i={x:r.x-t.x,y:r.y-t.y};(i.x!==0||i.y!==0)&&(n?this.lastMoveEventInfo&&(this.lastMoveEventInfo.point.x+=i.x,this.lastMoveEventInfo.point.y+=i.y):this.history.length>0&&(this.history[0].x-=i.x,this.history[0].y-=i.y),this.scrollPositions.set(e,r),XN.update(this.updatePoint,!0))}updateHandlers(e){this.handlers=e}end(){this.removeListeners&&this.removeListeners(),this.removeScrollListeners&&this.removeScrollListeners(),this.scrollPositions.clear(),ZN(this.updatePoint)}}})))()}
function iHe(e,{min:t,max:n},r){return t!==void 0&&e<t?e=r?HP(t,e,r.min):Math.max(e,t):n!==void 0&&e>n&&(e=r?HP(n,e,r.max):Math.min(e,n)),e}
function aHe(e,t,n){return{min:t===void 0?void 0:e.min+t,max:n===void 0?void 0:e.max+n-(e.max-e.min)}}
function oHe(e,{top:t,left:n,bottom:r,right:i}){return{x:aHe(e.x,n,i),y:aHe(e.y,t,r)}}
function sHe(e,t){let n=t.min-e.min,r=t.max-e.max;return t.max-t.min<e.max-e.min&&([n,r]=[r,n]),{min:n,max:r}}
function cHe(e,t){return{x:sHe(e.x,t.x),y:sHe(e.y,t.y)}}
function lHe(e,t){let n=.5,r=WR(e),i=WR(t);return i>r?n=fN(t.min,t.max-r,e.min):r>i&&(n=fN(e.min,e.max-i,t.min)),YM(0,1,n)}
function uHe(e,t){let n={};return t.min!==void 0&&(n.min=t.min-e.min),t.max!==void 0&&(n.max=t.max-e.min),n}
function dHe(e=sV){return e===!1?e=0:e===!0&&(e=sV),{x:fHe(e,`left`,`right`),y:fHe(e,`top`,`bottom`)}}
function fHe(e,t,n){return{min:pHe(e,t),max:pHe(e,n)}}
function pHe(e,t){return typeof e==`number`?e:e[t]||0}
var sV;
function mHe(){return(mHe=t((()=>{UP(),qR(),pN(),XM(),sV=.35})))()}
function hHe(e){let t=!0;return()=>{if(t){t=!1;return}e()}}
function gHe(e,t,n){let r=QIe(e,hHe(n)),i=QIe(t,hHe(n));return()=>{r(),i()}}
function cV(e,t,n){return(t===!0||t===e)&&(n===null||n===e)}
function _He(e,t=10){let n=null;return Math.abs(e.y)>t?n=`y`:Math.abs(e.x)>t&&(n=`x`),n}
var vHe;
var yHe;
function bHe(){return(bHe=t((()=>{IL(),eP(),vR(),kI(),gI(),UP(),uL(),kP(),qR(),$Ie(),gL(),$M(),QB(),XB(),eV(),oV(),mHe(),vHe=new WeakMap,yHe=class{constructor(e){this.openDragLock=null,this.isDragging=!1,this.currentDirection=null,this.originPoint={x:0,y:0},this.constraints=!1,this.hasMutatedConstraints=!1,this.elastic=FL(),this.latestPointerEvent=null,this.latestPanInfo=null,this.visualElement=e}start(e,{snapToCursor:t=!1,distanceThreshold:n}={}){let{presenceContext:r}=this.visualElement;if(r&&r.isPresent===!1)return;let i=e=>{t&&this.snapToCursor(YB(e).point),this.stopAnimation()},a=(e,t)=>{let{drag:n,dragPropagation:r,onDragStart:i}=this.getProps();if(n&&!r&&(this.openDragLock&&this.openDragLock(),this.openDragLock=OIe(n),!this.openDragLock))return;this.latestPointerEvent=e,this.latestPanInfo=t,this.isDragging=!0,this.currentDirection=null,this.resolveConstraints(),this.visualElement.projection&&(this.visualElement.projection.isAnimationBlocked=!0,this.visualElement.projection.target=void 0),JR(e=>{let t=this.getAxisMotionValue(e).get()||0;if(EP.test(t)){let{projection:n}=this.visualElement;if(n&&n.layout){let r=n.layout.layoutBox[e];r&&(t=WR(r)*(parseFloat(t)/100))}}this.originPoint[e]=t}),i&&XN.update(()=>i(e,t),!1,!0),OI(this.visualElement,`transform`);let{animationState:a}=this.visualElement;a&&a.setActive(`whileDrag`,!0)},o=(e,t)=>{this.latestPointerEvent=e,this.latestPanInfo=t;let{dragPropagation:n,dragDirectionLock:r,onDirectionLock:i,onDrag:a}=this.getProps();if(!n&&!this.openDragLock)return;let{offset:o}=t;if(r&&this.currentDirection===null){this.currentDirection=_He(o),this.currentDirection!==null&&i&&i(this.currentDirection);return}this.updateAxis(`x`,t.point,o),this.updateAxis(`y`,t.point,o),this.visualElement.render(),a&&XN.update(()=>a(e,t),!1,!0)},s=(e,t)=>{this.latestPointerEvent=e,this.latestPanInfo=t,this.stop(e,t),this.latestPointerEvent=null,this.latestPanInfo=null},c=()=>{let{dragSnapToOrigin:e}=this.getProps();(e||this.constraints)&&this.startAnimation({x:0,y:0})},{dragSnapToOrigin:l}=this.getProps();this.panSession=new aV(e,{onSessionStart:i,onStart:a,onMove:o,onSessionEnd:s,resumeAnimation:c},{transformPagePoint:this.visualElement.getTransformPagePoint(),dragSnapToOrigin:l,distanceThreshold:n,contextWindow:$B(this.visualElement),element:this.visualElement.current})}stop(e,t){let n=e||this.latestPointerEvent,r=t||this.latestPanInfo,i=this.isDragging;if(this.cancel(),!i||!r||!n)return;let{velocity:a}=r;this.startAnimation(a);let{onDragEnd:o}=this.getProps();o&&XN.postRender(()=>o(n,r))}cancel(){this.isDragging=!1;let{projection:e,animationState:t}=this.visualElement;e&&(e.isAnimationBlocked=!1),this.endPanSession();let{dragPropagation:n}=this.getProps();!n&&this.openDragLock&&(this.openDragLock(),this.openDragLock=null),t&&t.setActive(`whileDrag`,!1)}endPanSession(){this.panSession&&this.panSession.end(),this.panSession=void 0}updateAxis(e,t,n){let{drag:r}=this.getProps();if(!n||!cV(e,r,this.currentDirection))return;let i=this.getAxisMotionValue(e),a=this.originPoint[e]+n[e];this.constraints&&this.constraints[e]&&(a=iHe(a,this.constraints[e],this.elastic[e])),i.set(a)}resolveConstraints(){let{dragConstraints:e,dragElastic:t}=this.getProps(),n=this.visualElement.projection&&!this.visualElement.projection.layout?this.visualElement.projection.measure(!1):this.visualElement.projection?.layout,r=this.constraints;e&&WB(e)?this.constraints||=this.resolveRefConstraints():this.constraints=e&&n?oHe(n.layoutBox,e):!1,this.elastic=dHe(t),r!==this.constraints&&!WB(e)&&n&&this.constraints&&!this.hasMutatedConstraints&&JR(e=>{this.constraints!==!1&&this.getAxisMotionValue(e)&&(this.constraints[e]=uHe(n.layoutBox[e],this.constraints[e]))})}resolveRefConstraints(){let{dragConstraints:e,onMeasureDragConstraints:t}=this.getProps();if(!e||!WB(e))return!1;let n=e.current;QM(n!==null,"If `dragConstraints` is set as a React ref, that ref must be passed to another component's `ref` prop.",`drag-constraints-ref`);let{projection:r}=this.visualElement;if(!r||!r.layout)return!1;r.root&&(r.root.scroll=void 0,r.root.updateScroll());let i=ALe(n,r.root,this.visualElement.getTransformPagePoint()),a=cHe(r.layout.layoutBox,i);if(t){let e=t(yLe(a));this.hasMutatedConstraints=!!e,e&&(a=sR(e))}return a}startAnimation(e){let{drag:t,dragMomentum:n,dragElastic:r,dragTransition:i,dragSnapToOrigin:a,onDragTransitionEnd:o}=this.getProps(),s=this.constraints||{},c=JR(o=>{if(!cV(o,t,this.currentDirection))return;let c=s&&s[o]||{};(a===!0||a===o)&&(c={min:0,max:0});let l=r?200:1e6,u=r?40:1e7,d={type:`inertia`,velocity:n?e[o]:0,bounceStiffness:l,bounceDamping:u,timeConstant:750,restDelta:1,restSpeed:10,...i,...c};return this.startAxisValueAnimation(o,d)});return Promise.all(c).then(o)}startAxisValueAnimation(e,t){let n=this.getAxisMotionValue(e);return OI(this.visualElement,e),n.start(hI(e,n,0,t,this.visualElement,!1))}stopAnimation(){JR(e=>this.getAxisMotionValue(e).stop())}getAxisMotionValue(e){let t=`_drag${e.toUpperCase()}`;return this.visualElement.getProps()[t]||this.visualElement.getValue(e,this.visualElement.latestValues[e]??0)}snapToCursor(e){JR(t=>{let{drag:n}=this.getProps();if(!cV(t,n,this.currentDirection))return;let{projection:r}=this.visualElement,i=this.getAxisMotionValue(t);if(r&&r.layout){let{min:n,max:a}=r.layout.layoutBox[t],o=i.get()||0;i.set(e[t]-HP(n,a,.5)+o)}})}scalePositionWithinConstraints(){if(!this.visualElement.current)return;let{drag:e,dragConstraints:t}=this.getProps(),{projection:n}=this.visualElement;if(!WB(t)||!n||!this.constraints)return;this.stopAnimation();let r={x:0,y:0};JR(e=>{let t=this.getAxisMotionValue(e);if(t&&this.constraints!==!1){let n=t.get();r[e]=lHe({min:n,max:n},this.constraints[e])}});let{transformTemplate:i}=this.visualElement.getProps();this.visualElement.current.style.transform=i?i({},``):`none`,n.root&&n.root.updateScroll(),n.updateLayout(),this.constraints=!1,this.resolveConstraints(),JR(t=>{if(!cV(t,e,null))return;let n=this.getAxisMotionValue(t),{min:i,max:a}=this.constraints[t];n.set(HP(i,a,r[t]))}),this.visualElement.render()}addListeners(){if(!this.visualElement.current)return;vHe.set(this.visualElement,this);let e=this.visualElement.current,t=ZB(e,`pointerdown`,t=>{let{drag:n,dragListener:r=!0}=this.getProps(),i=t.target,a=i!==e&&PIe(i);n&&r&&!a&&this.start(t)}),n,r=()=>{let{dragConstraints:t}=this.getProps();WB(t)&&t.current&&(this.constraints=this.resolveRefConstraints(),n||=gHe(e,t.current,()=>this.scalePositionWithinConstraints()))},{projection:i}=this.visualElement,a=i.addEventListener(`measure`,r);i&&!i.layout&&(i.root&&i.root.updateScroll(),i.updateLayout()),XN.read(r);let o=QR(window,`resize`,()=>this.scalePositionWithinConstraints()),s=i.addEventListener(`didUpdate`,(({delta:e,hasLayoutChanged:t})=>{this.isDragging&&t&&(JR(t=>{let n=this.getAxisMotionValue(t);n&&(this.originPoint[t]+=e[t].translate,n.set(n.get()+e[t].translate))}),this.visualElement.render())}));return()=>{o(),t(),a(),s&&s(),n&&n()}}getProps(){let e=this.visualElement.getProps(),{drag:t=!1,dragDirectionLock:n=!1,dragPropagation:r=!1,dragConstraints:i=!1,dragElastic:a=sV,dragMomentum:o=!0}=e;return{...e,drag:t,dragDirectionLock:n,dragPropagation:r,dragConstraints:i,dragElastic:a,dragMomentum:o}}}})))()}
var xHe;
function SHe(){return(SHe=t((()=>{oR(),lN(),bHe(),xHe=class extends aR{constructor(e){super(e),this.removeGroupControls=cN,this.removeListeners=cN,this.controls=new yHe(e)}mount(){let{dragControls:e}=this.node.getProps();e&&(this.removeGroupControls=e.subscribe(this.controls)),this.removeListeners=this.controls.addListeners()||cN}update(){let{dragControls:e}=this.node.getProps(),{dragControls:t}=this.node.prevProps||{};e!==t&&(this.removeGroupControls(),e&&(this.removeGroupControls=e.subscribe(this.controls)))}unmount(){this.removeGroupControls(),this.removeListeners(),this.controls.isDragging||this.controls.endPanSession()}}})))()}
var lV;
var CHe;
function wHe(){return(wHe=t((()=>{oR(),eP(),lN(),QB(),eV(),oV(),lV=e=>(t,n)=>{e&&XN.update(()=>e(t,n),!1,!0)},CHe=class extends aR{constructor(){super(...arguments),this.removePointerDownListener=cN}onPointerDown(e){this.session=new aV(e,this.createPanHandlers(),{transformPagePoint:this.node.getTransformPagePoint(),contextWindow:$B(this.node)})}createPanHandlers(){let{onPanSessionStart:e,onPanStart:t,onPan:n,onPanEnd:r}=this.node.getProps();return{onSessionStart:lV(e),onStart:lV(t),onMove:lV(n),onEnd:(e,t)=>{delete this.session,r&&XN.postRender(()=>r(e,t))}}}mount(){this.removePointerDownListener=ZB(this.node.current,`pointerdown`,e=>this.onPointerDown(e))}update(){this.session&&this.session.updateHandlers(this.createPanHandlers())}unmount(){this.removePointerDownListener(),this.session&&this.session.end()}}})))()}
function THe(e){let[t,n]=aB(),r=(0,uV.useContext)(Wz);return(0,EHe.jsx)(DHe,{...e,layoutGroup:r,switchLayoutGroup:(0,uV.useContext)(HB),isPresent:t,safeToRemove:n})}
var EHe;
var uV;
var dV;
var DHe;
function fV(){return(fV=t((()=>{EHe=Y(),nz(),eP(),sL(),uV=o(),sB(),Gz(),UB(),dV=!1,DHe=class extends uV.Component{componentDidMount(){let{visualElement:e,layoutGroup:t,switchLayoutGroup:n,layoutId:r}=this.props,{projection:i}=e;i&&(t.group&&t.group.add(i),n&&n.register&&r&&n.register(i),dV&&i.root.didUpdate(),i.addEventListener(`animationComplete`,()=>{this.safeToRemove()}),i.setOptions({...i.options,layoutDependency:this.props.layoutDependency,onExitComplete:()=>this.safeToRemove()})),tz.hasEverUpdated=!0}getSnapshotBeforeUpdate(e){let{layoutDependency:t,visualElement:n,drag:r,isPresent:i}=this.props,{projection:a}=n;return a?(a.isPresent=i,e.layoutDependency!==t&&a.setOptions({...a.options,layoutDependency:t}),dV=!0,r||e.layoutDependency!==t||t===void 0||e.isPresent!==i?a.willUpdate():this.safeToRemove(),e.isPresent!==i&&(i?a.promote():a.relegate()||XN.postRender(()=>{let e=a.getStack();(!e||!e.members.length)&&this.safeToRemove()})),null):null}componentDidUpdate(){let{visualElement:e,layoutAnchor:t}=this.props,{projection:n}=e;n&&(n.options.layoutAnchor=t,n.root.didUpdate(),oL.postRender(()=>{!n.currentAnimation&&n.isLead()&&this.safeToRemove()}))}componentWillUnmount(){let{visualElement:e,layoutGroup:t,switchLayoutGroup:n}=this.props,{projection:r}=e;dV=!0,r&&(r.scheduleCheckAfterUnmount(),t&&t.group&&t.group.remove(r),n&&n.deregister&&n.deregister(r))}safeToRemove(){let{safeToRemove:e}=this.props;e&&e()}render(){return null}}})))()}
var OHe;
function kHe(){return(kHe=t((()=>{SHe(),wHe(),fV(),dz(),OHe={pan:{Feature:CHe},drag:{Feature:xHe,ProjectionNode:uz,MeasureLayout:THe}}})))()}
function AHe(e,t,n){let{props:r}=e;e.animationState&&r.whileHover&&e.animationState.setActive(`whileHover`,n===`Start`);let i=r[`onHover`+n];i&&XN.postRender(()=>i(t,YB(t)))}
var jHe;
function MHe(){return(MHe=t((()=>{oR(),fL(),eP(),XB(),jHe=class extends aR{mount(){let{current:e}=this.node;e&&(this.unmount=jIe(e,(e,t)=>(AHe(this.node,t,`Start`),e=>AHe(this.node,e,`End`))))}unmount(){}}})))()}
var NHe;
function PHe(){return(PHe=t((()=>{oR(),dN(),NHe=class extends aR{constructor(){super(...arguments),this.isActive=!1}onFocus(){let e=!1;try{e=this.node.current.matches(`:focus-visible`)}catch{e=!0}e&&this.node.animationState&&(this.node.animationState.setActive(`whileFocus`,!0),this.isActive=!0)}onBlur(){this.isActive&&this.node.animationState&&(this.node.animationState.setActive(`whileFocus`,!1),this.isActive=!1)}mount(){this.unmount=uN(QR(this.node.current,`focus`,()=>this.onFocus()),QR(this.node.current,`blur`,()=>this.onBlur()))}unmount(){}}})))()}
function FHe(e,t,n){let{props:r}=e;if(e.current instanceof HTMLButtonElement&&e.current.disabled)return;e.animationState&&r.whileTap&&e.animationState.setActive(`whileTap`,n===`Start`);let i=r[`onTap`+(n===`End`?``:n)];i&&XN.postRender(()=>i(t,YB(t)))}
var IHe;
function LHe(){return(LHe=t((()=>{oR(),xL(),eP(),XB(),IHe=class extends aR{mount(){let{current:e}=this.node;if(!e)return;let{globalTapTarget:t,propagate:n}=this.node.props;this.unmount=VIe(e,(e,t)=>(FHe(this.node,t,`Start`),(e,{success:t})=>FHe(this.node,e,t?`End`:`Cancel`)),{useGlobalTarget:t,stopPropagation:n?.tap===!1})}unmount(){}}})))()}
function RHe({root:e,...t}){let n=e||document;mV.has(n)||mV.set(n,{});let r=mV.get(n),i=JSON.stringify(t);return r[i]||(r[i]=new IntersectionObserver(VHe,{root:e,...t})),r[i]}
function zHe(e,t,n){let r=RHe(t);return pV.set(e,n),r.observe(e),()=>{pV.delete(e),r.unobserve(e)}}
var pV;
var mV;
var BHe;
var VHe;
function HHe(){return(HHe=t((()=>{pV=new WeakMap,mV=new WeakMap,BHe=e=>{let t=pV.get(e.target);t&&t(e)},VHe=e=>{e.forEach(BHe)}})))()}
function UHe({viewport:e={}},{viewport:t={}}={}){return n=>e[n]!==t[n]}
var WHe;
var GHe;
function KHe(){return(KHe=t((()=>{oR(),HHe(),WHe={some:0,all:1},GHe=class extends aR{constructor(){super(...arguments),this.hasEnteredView=!1,this.isInView=!1}startObserver(){this.stopObserver?.();let{viewport:e={}}=this.node.getProps(),{root:t,margin:n,amount:r=`some`,once:i}=e,a={root:t?t.current:void 0,rootMargin:n,threshold:typeof r==`number`?r:WHe[r]},o=e=>{let{isIntersecting:t}=e;if(this.isInView===t||(this.isInView=t,i&&!t&&this.hasEnteredView))return;t&&(this.hasEnteredView=!0),this.node.animationState&&this.node.animationState.setActive(`whileInView`,t);let{onViewportEnter:n,onViewportLeave:r}=this.node.getProps(),a=t?n:r;a&&a(e)};this.stopObserver=zHe(this.node.current,a,o)}mount(){this.startObserver()}update(){if(typeof IntersectionObserver>`u`)return;let{props:e,prevProps:t}=this.node;[`amount`,`margin`,`root`].some(UHe(e,t))&&this.startObserver()}unmount(){this.stopObserver?.(),this.hasEnteredView=!1,this.isInView=!1}}})))()}
var qHe;
function JHe(){return(JHe=t((()=>{MHe(),PHe(),LHe(),KHe(),qHe={inView:{Feature:GHe},tap:{Feature:IHe},focus:{Feature:NHe},hover:{Feature:jHe}}})))()}
var YHe;
function XHe(){return(XHe=t((()=>{dz(),fV(),YHe={layout:{ProjectionNode:uz,MeasureLayout:THe}}})))()}
var ZHe;
function QHe(){return(QHe=t((()=>{XVe(),kHe(),JHe(),XHe(),ZHe={...YVe,...qHe,...OHe,...YHe}})))()}
var hV;
function gV(){return(gV=t((()=>{UVe(),BVe(),QHe(),hV=zVe(ZHe,HVe)})))()}
function _V(e){let t=Kz(()=>sI(e)),{isStatic:n}=(0,vV.useContext)($z);if(n){let[,n]=(0,vV.useState)(e);(0,vV.useEffect)(()=>t.on(`change`,n),[])}return t}
var vV;
function yV(){return(yV=t((()=>{dI(),vV=o(),eB(),qz()})))()}
function nUe(e,t){let n=_V(t()),r=()=>n.set(t());return r(),Yz(()=>{let t=()=>XN.preRender(r,!1,!0),n=e.map(e=>e.on(`change`,t));return r(),()=>{n.forEach(e=>e()),ZN(r)}}),n}
function rUe(e){lI.current=[],e();let t=nUe(lI.current,e);return lI.current=void 0,t}
function xV(e,t,n,r){if(typeof e==`function`)return rUe(e);if(n!==void 0&&!Array.isArray(n)&&typeof t!=`function`)return oUe(e,t,n,r);let i=typeof t==`function`?t:aLe(t,n,r),a=Array.isArray(e)?aUe(e,i):aUe([e],([e])=>i(e)),o=Array.isArray(e)?void 0:e.accelerate;return o&&!o.isTransformed&&typeof t!=`function`&&Array.isArray(n)&&r?.clamp!==!1&&(a.accelerate={...o,times:t,keyframes:n,isTransformed:!0,...r?.ease?{ease:r.ease}:{}}),a}
function aUe(e,t){let n=Kz(()=>[]);return nUe(e,()=>{n.length=0;let r=e.length;for(let t=0;t<r;t++)n[t]=e[t].get();return t(n)})}
function oUe(e,t,n,r){let i=Kz(()=>Object.keys(n)),a=Kz(()=>({}));for(let o of i)a[o]=xV(e,t,n[o],r);return a}
function dUe(){!JL.current&&XL();let[e]=(0,fUe.useState)(qL.current);return e}
var fUe;
function pUe(){return(pUe=t((()=>{YL(),ZL(),fUe=o()})))()}
function qUe(){let e=(0,JUe.useContext)(Zz);return e?e.custom:void 0}
var JUe;
function YUe(){return(YUe=t((()=>{JUe=o(),Qz()})))()}
function eWe(){return tWe}
function tWe(e){lz.current&&(lz.current.isUpdating=!1,lz.current.blockUpdate(),e&&e())}
function AV(){return(AV=t((()=>{dz()})))()}
function sWe(){let[e,t]=zBe(),n=eWe(),r=(0,MV.useRef)(-1);return(0,MV.useEffect)(()=>{XN.postRender(()=>XN.postRender(()=>{t===r.current&&(eN.instantAnimations=!1)}))},[t]),i=>{n(()=>{eN.instantAnimations=!0,e(),i(),r.current=t+1})}}
var MV;
function cWe(){return(cWe=t((()=>{eP(),tN(),MV=o(),AV(),hB()})))()}
gV();
UVe();
BVe();
QHe();
pB();
Qz();
zR();
kR();
IB();
RVe();
XVe();
kHe();
JHe();
XHe();
Gz();
qz();
Xz();
OBe();
sB();
MBe();
YL();
pUe();
qN();
YUe();
yV();
eB();
cWe();
tN();
FF();
ZI();
IL();
iR();
jR();
NR();
FR();
XLe();
LR();
sP();
MF();
vR();
bR();
DR();
_Ve();
yB();
OB();
sVe();
yVe();
CVe();
TVe();
SB();
JBe();
DVe();
kVe();
PVe();
GVe();
JVe();
SHe();
wHe();
fV();
dz();
MHe();
PHe();
LHe();
KHe();
pBe();
wBe();
ZL();
$M();
lN();
NN();
jN();
LN();
CN();
zN();
WN();
dI();
hB();
eP();
AV();
NP();
WI();
KI();
YI();
DI();
TIe();
nR();
qLe();
_R();
rL();
PLe();
TR();
iVe();
MB();
hVe();
TB();
BB();
jB();
PB();
MI();
UB();
oR();
VR();
yI();
bHe();
QB();
eV();
oV();
nz();
sL();
cz();
Dze();
fL();
XB();
dN();
xL();
HHe();
aL();
bBe();
TN();
DN();
hN();
bN();
rP();
pN();
XM();
RBe();
YN();
CP();
jP();
xP();
zP();
hP();
hIe();
dP();
kP();
_Ie();
xI();
HI();
YFe();
WF();
dIe();
CIe();
RF();
vN();
rN();
sN();
eI();
oI();
QI();
fLe();
RL();
KL();
gLe();
UP();
CR();
XBe();
ez();
LI();
$Le();
CI();
UL();
kI();
gI();
uL();
qR();
$Ie();
gL();
mHe();
hL();
$Ve();
ZR();
NI();
mI();
eLe();
YRe();
CL();
AL();
VRe();
CRe();
MRe();
ZRe();
qRe();
lL();
dL();
MIe();
zIe();
vL();
aN();
MNe();
vP();
pP();
JNe();
lIe();
zI();
GF();
nFe();
vF();
xF();
sFe();
lFe();
eL();
LLe();
zLe();
FI();
oIe();
tIe();
OFe();
CF();
VFe();
WFe();
JIe();
ZIe();
GRe();
HNe();
XPe();
KF();
aFe();
JF();
TI();
mFe();
vFe();
TFe();
YP();
yPe();
uF();
gF();
eF();
cF();
yF();
lPe();
_Pe();
$Pe();
ZP();
XF();
rFe();
fFe();
hFe();
xFe();
sF();
VN();
fF();
mF();
dPe();
nF();
pF();
export {hV as motion,fB as AnimatePresence,dUe as useReducedMotion,rLe as stagger,kBe as isPresent,Zz as PresenceContext,qUe as presenceCustom,_V as useMotionValue,xV as useTransform,sWe as useInstantTransition,eWe as useInstantLayoutTransition};
