// Read-only structured selection; native code owns source identity and write authorization.
export function installReaderSelection({kind,office,frame,getModel,getSource}){
 let captured=null;
 const pack=(text,locator,selectionKind=kind)=>typeof text==='string'&&text.length<=16000?{kind:selectionKind,text,selectedText:text,locator}:null;
 function textSelection(){
  if(kind==='docx'){
   const doc=frame.contentDocument,selection=doc?.getSelection();if(!selection||selection.isCollapsed||!selection.rangeCount)return null;
   const range=selection.getRangeAt(0),element=node=>node.nodeType===1?node:node.parentElement,a=element(range.startContainer)?.closest('p'),b=element(range.endContainer)?.closest('p');
   const paragraphs=[...doc.querySelectorAll('#document section.docx p')],start=paragraphs.indexOf(a),end=paragraphs.indexOf(b);if(start<0||end<start)return null;
   const offset=(p,node,value)=>{const r=doc.createRange();r.selectNodeContents(p);r.setEnd(node,value);return r.toString().length;};
   const text=selection.toString(),page=[...doc.querySelectorAll('section.docx')].indexOf(a.closest('section.docx'))+1;
   return text.trim()?pack(text,{page,paragraphStart:start,paragraphEnd:end,startOffset:offset(a,range.startContainer,range.startOffset),endOffset:offset(b,range.endContainer,range.endOffset),quote:text}):null;
  }
  if(kind==='markdown'){
   const selection=document.getSelection();if(!selection||selection.isCollapsed||!office.contains(selection.anchorNode)||!office.contains(selection.focusNode))return null;
   const text=selection.toString(),source=getSource(),start=source.indexOf(text);if(!text.trim()||start<0||source.indexOf(text,start+1)>=0)return null;
   return pack(text,{startLine:source.slice(0,start).split('\n').length,endLine:source.slice(0,start+text.length).split('\n').length,startOffset:start,endOffset:start+text.length,quote:text});
  }return null;
 }
 const activeTextSelection=()=>{try{const selection=kind==='docx'?frame.contentDocument?.getSelection():kind==='markdown'?document.getSelection():null;return selection&&!selection.isCollapsed&&selection.rangeCount;}catch{return false;}};
 const remember=()=>{if(activeTextSelection())captured=textSelection();};document.addEventListener('selectionchange',remember);
 frame.addEventListener('load',()=>{try{frame.contentDocument?.addEventListener('selectionchange',remember);}catch{}});
 office.addEventListener('change',event=>{if(event.composedPath().some(n=>n?.matches?.('.toolbar select')))captured=null;});
 office.addEventListener('click',event=>{
  const path=event.composedPath(),root=office.shadowRoot,model=getModel();if(!model||!root)return;
  const index=Number(root.querySelector('.toolbar select')?.value)||0;
  const cell=path.find(n=>n?.dataset?.officeCell!==undefined);
  if(cell&&model.kind==='spreadsheet'){
   const [row,col]=cell.dataset.officeCell.split(':').map(Number);let c=col+1,label='';for(;c;c=Math.floor((c-1)/26))label=String.fromCharCode(65+(c-1)%26)+label;
   const value=String(model.sheets[index]?.rows[row]?.[col]??'');captured=pack(value,{sheetName:model.sheets[index].name,row,col,cellRange:label+(row+1),currentValue:value},'xlsx');
   root.querySelectorAll('[data-reader-selected]').forEach(n=>n.removeAttribute('data-reader-selected'));cell.dataset.readerSelected='true';
  }
  const shape=path.find(n=>n?.dataset?.officeElement!==undefined);
  if(shape&&model.kind==='presentation'){
   const item=Number(shape.dataset.officeElement),element=model.slides[index]?.elements[item],text=String(element?.text||'');if(element?.type!=='text'||!text.trim()){captured=null;root.querySelectorAll('[data-reader-selected]').forEach(n=>n.removeAttribute('data-reader-selected'));return;}captured=pack(text,{slide:index+1,shape:item,currentValue:text},'pptx');
   root.querySelectorAll('[data-reader-selected]').forEach(n=>n.removeAttribute('data-reader-selected'));shape.dataset.readerSelected='true';
  }
 });
 window.evaReaderSelection=()=>{try{
  if(activeTextSelection()){captured=textSelection();return captured;}
  if(captured&&(captured.kind==='xlsx'||captured.kind==='pptx')){
   const root=office.shadowRoot,model=getModel(),index=Number(root?.querySelector('.toolbar select')?.value),selected=root?.querySelector('[data-reader-selected]');
   const sameScope=captured.kind==='xlsx'?model?.kind==='spreadsheet'&&model.sheets[index]?.name===captured.locator.sheetName:model?.kind==='presentation'&&index+1===captured.locator.slide;
   // A page change rebuilds content even if its native select event cannot cross Shadow DOM.
   const sameNode=captured.kind==='xlsx'?selected?.dataset.officeCell===captured.locator.row+':'+captured.locator.col:selected?.dataset.officeElement===String(captured.locator.shape);
   if(!sameScope||!sameNode)captured=null;
  }
  return captured;
 }catch{return null;}};
}
