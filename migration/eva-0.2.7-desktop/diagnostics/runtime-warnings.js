/* Keep known runtime diagnostics readable without changing shared configuration. */
const runtimeWarnings=(()=>{
 const seen=new Map();
 let records=[];try{if(typeof sessionStorage!=='undefined')records=JSON.parse(sessionStorage.getItem('codex-rae.diagnostics')||'[]');if(!Array.isArray(records))records=[];}catch{records=[];}
 function format(message){
  const text=String(message);
  const ignored=text.match(/Ignored unsupported project-local config keys in\s+([\s\S]+?config\.toml):\s*([\s\S]+?)(?:\.\s*If you want these settings to apply|$)/i);
  if(ignored){const keys=ignored[2].trim().replace(/\.$/,'');return `项目配置中的 ${keys} 设置未生效：内核仅允许在用户级配置中设置此项。复刻版不会自动修改官方 Codex 配置。`;}
  return text;
 }
 function record(message,options={}){
  const text=format(message),key=options.key||text,old=records.find(r=>r.key===key);
  if(old){old.at=Date.now();old.count++;old.text=text;}else records.push({key,text,at:Date.now(),count:1});
  records=records.slice(-100);try{if(typeof sessionStorage!=='undefined')sessionStorage.setItem('codex-rae.diagnostics',JSON.stringify(records));}catch{}
  return text;
 }
 function show(message,now=Date.now()){
  const text=record(message),previous=seen.get(text);
  // Ignored project-local settings do not require a user action in a chat.
  if(text!==String(message))return false;
  if(previous!==undefined&&now-previous<60000)return false;
  seen.set(text,now);if(seen.size>200)seen.delete(seen.keys().next().value);
  toast(text,6000);return true;
 }
 function open(){
  const body=records.length?records.slice().sort((a,b)=>b.at-a.at).map(r=>`<div class="diagnostic-row"><time>${new Date(r.at).toLocaleTimeString('zh-CN')}${r.count>1?' · '+r.count+' 次':''}</time><p>${esc(r.text)}</p></div>`).join(''):'<p>本窗口暂无提示记录。</p>';
  const {modal}=workspaceDialog('提示记录',body);modal.querySelector('.modal-body')?.setAttribute('aria-live','polite');
 }
 return {format,show,record,open,entries:()=>records.map(r=>({...r}))};
})();
