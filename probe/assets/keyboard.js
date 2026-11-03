'use strict';
// Native IME ownership stays in ShellActivity; no draft or send state is changed here.
(()=>{
 let nativeVisible=false;
 const editing=()=>document.activeElement?.matches('textarea,input:not([type=checkbox]):not([type=radio]):not([type=range]),[contenteditable=true]');
 function hide(){
  const focused=document.activeElement;if(editing())focused.blur();
  nativeVisible=false;document.documentElement.classList.remove("ime-visible");window.EvaHost?.hideKeyboard?.();update();
 }
 function update(){
  let bar=document.querySelector('#eva-keyboard-toolbar');
  const target=document.querySelector('.dock');
  if(!target){bar?.remove();return;}
  if(!bar){bar=document.createElement('div');bar.id='eva-keyboard-toolbar';bar.innerHTML='<button type="button" aria-label="收起键盘"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="3" width="18" height="12" rx="2"/><path d="M6 7h1m3 0h1m3 0h1m3 0h1M7 11h10m-9 8 4 3 4-3"/></svg><span>收起键盘</span></button>';bar.querySelector('button').addEventListener('pointerdown',e=>e.preventDefault());bar.querySelector('button').onclick=hide;target.prepend(bar);}
  bar.hidden=!(nativeVisible||editing());
 }
 window.evaKeyboardState=state=>{const wasVisible=nativeVisible;nativeVisible=!!state?.visible;if(wasVisible&&!nativeVisible&&editing())document.activeElement.blur();document.documentElement.classList.toggle('ime-visible',nativeVisible);update();};
 window.evaHideKeyboard=hide;
 const back=window.evaBack;window.evaBack=()=>{if(nativeVisible){hide();return true}return back?.()||false;};
 const previousRender=render;render=function(){previousRender();update();};
 document.addEventListener('focusin',update);document.addEventListener('focusout',()=>queueMicrotask(update));
 update();
})();
