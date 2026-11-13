'use strict';
// Loaded only in the bundled Shell UI. Remote browser pages have no EvaHost.
window.evaClipboard=(()=>{
 function notice(message){kernelNotice=message;refreshKernelControls();}
 function selectionText(){
  let focused=document.activeElement;
  while(focused?.shadowRoot?.activeElement)focused=focused.shadowRoot.activeElement;
  if(focused?.matches('textarea,input')&&Number.isInteger(focused.selectionStart)&&focused.selectionEnd>focused.selectionStart)
   return focused.value.slice(focused.selectionStart,focused.selectionEnd);
  return (focused?.getRootNode()?.getSelection?.()||window.getSelection())?.toString()||'';
 }
 document.addEventListener('copy',event=>{
  if(event.defaultPrevented||typeof window.EvaHost?.copyText!=='function')return;
  const text=selectionText();if(!text)return;
  try{
   if(!EvaHost.copyText(text))throw Error('剪贴板暂不可用或文本过长');
   try{event.clipboardData?.setData('text/plain',text);}catch{}
   event.preventDefault();
  }catch(error){notice('复制失败：'+error.message);}
 });
 function paste(){
  const input=document.querySelector('#prompt');
  if(!input||settingPage||!['home','chat'].includes(route))return;
  if(typeof window.EvaHost?.clipboardPaste!=='function'){notice('请长按输入框使用系统粘贴');return;}
  let c=active();if(!c){const draft=input.value;c=newLocalChat();c.draft=draft;data.draft='';}
  const start=input.selectionStart,end=input.selectionEnd;
  try{
   const result=JSON.parse(EvaHost.clipboardPaste(c.id,c.projectId||''));
   if(result.error){notice(result.error);return;}
   if(typeof result.text==='string'&&result.text.length){
    input.focus({preventScroll:true});input.setRangeText(result.text,start,end,'end');
    input.dispatchEvent(new Event('input',{bubbles:true}));
    notice('');
   }else if(result.importing){notice('正在粘贴附件…');}
   else notice('剪贴板中没有可粘贴的内容');
  }catch(error){notice('粘贴失败，请重新复制后重试');}
 }
 return {paste};
})();
