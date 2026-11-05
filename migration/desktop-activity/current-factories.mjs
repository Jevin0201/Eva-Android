import uuN8 from "./current/uuN8.mjs";
import m0fb from "./current/m0fb.mjs";
import mmWO from "./current/mmWO.mjs";
import r9ev from "./current/r9ev.mjs";
import tHoD from "./current/tHoD.mjs";
import BI7J from "./current/BI7J.mjs";
import V8uZ from "./current/V8uZ.mjs";
import ltPT from "./current/ltPT.mjs";
import umSm from "./current/umSm.mjs";
import GRDa from "./current/GRDa.mjs";
import aqd9 from "./current/aqd9.mjs";
import h30a from "./current/h30a.mjs";
import hCjf from "./current/hCjf.mjs";
import RznG from "./current/RznG.mjs";
import nMdB from "./current/nMdB.mjs";
import wD9O from "./current/wD9O.mjs";
import q5qu from "./current/q5qu.mjs";
import irtZ from "./current/irtZ.mjs";
import o6bI from "./current/o6bI.mjs";
import ZYy5 from "./current/ZYy5.mjs";
import m8On from "./current/m8On.mjs";
import bIvi from "./current/bIvi.mjs";
import ekLq from "./current/ekLq.mjs";
import GOUF from "./current/GOUF.mjs";
import KqaT from "./current/KqaT.mjs";
import nsuH from "./current/nsuH.mjs";
import on57 from "./current/on57.mjs";
export function currentActivity({React,JSX,Compiler,motion}){
 const copyMessages={'CopyButton.copyTooltip':'复制','copyButton.copied':'已复制','copyButton.copiedAriaLabel':'已复制','copyButton.copy':'复制','copyButton.copyAriaLabel':'复制'};
 const factories={uuN8,m0fb,mmWO,on57,nsuH,r9ev,tHoD,BI7J,V8uZ,ltPT,umSm,GRDa,aqd9,h30a,hCjf,RznG,nMdB,wD9O,q5qu,irtZ,o6bI,ZYy5,m8On,bIvi,ekLq,GOUF,KqaT},cache={};
 const bindings={ABep:JSX,QosV:Compiler,zd8w:React,LIss:{P:motion},oyxz:{A:({id,defaultMessage,tagName='span'})=>React.createElement(tagName,null,copyMessages[id]||defaultMessage||id)},Wf1j:{A:()=>({formatMessage:({id,defaultMessage})=>copyMessages[id]||defaultMessage||id})},DNYL:{},GO7r:{},ygO2:{},UxN3:{}};
 function load(id){if(bindings[id])return bindings[id];if(cache[id])return cache[id].exports;if(!factories[id])throw Error('Missing original module '+id);const module={exports:{}};cache[id]=module;factories[id](module,module.exports,load);return module.exports;}
 load.d=(exports,getters,constants)=>{for(const [key,get]of Object.entries(getters||{}))Object.defineProperty(exports,key,{enumerable:true,get});if(constants)Object.assign(exports,constants);};load.j=899308;
 const Context=load('ZYy5').k,makeObserver=load('m8On').ub;
 function ResizeProvider({children}){const observer=React.useMemo(()=>makeObserver(),[]);React.useEffect(()=>()=>observer?.disconnect(),[observer]);return JSX.jsx(Context.Provider,{value:observer,children});}
 return {Shell:load('r9ev').d,ResizeProvider,classNames:load('on57').A,Copy:load('uuN8').i,CopyIcon:load('m0fb').A,CheckIcon:load('mmWO').A};
}
