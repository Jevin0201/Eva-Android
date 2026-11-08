const bounded=(value,min,max,fallback)=>Number.isInteger(value)?Math.max(min,Math.min(max,value)):fallback;
export async function readTable(locator,command){
 return locator.evaluate((root,options)=>{
  const isTable=root instanceof HTMLTableElement;
  if(!isTable&&!root.matches('[role="table"],[role="grid"],[role="treegrid"]'))throw Error('Target must be an HTML table or ARIA table/grid');
  const rows=isTable?Array.from(root.rows):Array.from(root.querySelectorAll('[role="row"]')).filter(row=>row.closest('[role="table"],[role="grid"],[role="treegrid"]')===root);
  const number=(el,name,fallback)=>{const n=Number(el.getAttribute(name));return Number.isInteger(n)&&n>0?n:fallback;};
  const cells=row=>isTable?Array.from(row.cells):Array.from(row.querySelectorAll('[role="gridcell"],[role="cell"],[role="columnheader"],[role="rowheader"]')).filter(cell=>cell.closest('[role="row"]')===row);
  const totalRows=number(root,'aria-rowcount',rows.length),totalColumns=number(root,'aria-colcount',null);
  const columns=new Map();
  if(isTable){
   const occupied=new Map(),end=Math.min(rows.length,options.rowOffset+options.maxRows);
   for(let r=0;r<end;r++){
    let column=1;
    for(const cell of rows[r].cells){
     while((occupied.get(column)||0)>r)column++;
     if(r>=options.rowOffset)columns.set(cell,column);
     const span=cell.colSpan||1,height=cell.rowSpan===0?rows.length-r:cell.rowSpan;
     if(height>1)for(let c=column;c<column+span;c++)occupied.set(c,r+height);
     column+=span;
    }
   }
  }
  let textBudget=50000;
  return {kind:isTable?'html-table':root.getAttribute('role'),totalRows,totalColumns,renderedOnly:!isTable,renderedRowCount:rows.length,rowOffset:options.rowOffset,columnOffset:options.columnOffset,
   rows:rows.slice(options.rowOffset,options.rowOffset+options.maxRows).map((row,index)=>{const list=cells(row);return {rowIndex:number(row,'aria-rowindex',options.rowOffset+index+1),cellCount:list.length,cells:list.slice(options.columnOffset,options.columnOffset+options.maxColumns).map((cell,col)=>{
    const value=cell.innerText??cell.textContent??'',limit=Math.min(options.maxCellChars,textBudget);textBudget-=Math.min(limit,value.length);return {cellIndex:options.columnOffset+col+1,columnIndex:number(cell,'aria-colindex',columns.get(cell)||options.columnOffset+col+1),text:value.slice(0,limit),truncated:value.length>limit,header:cell.tagName==='TH'||/header$/.test(cell.getAttribute('role')||''),rowSpan:isTable?cell.rowSpan:Number(cell.getAttribute('aria-rowspan'))||1,columnSpan:isTable?cell.colSpan:Number(cell.getAttribute('aria-colspan'))||1,editable:cell.isContentEditable||!!cell.querySelector('input:not([readonly]):not([disabled]),textarea:not([readonly]):not([disabled]),[contenteditable="true"],[contenteditable="plaintext-only"]')};})};}),
   nextRowOffset:options.rowOffset+options.maxRows<rows.length?options.rowOffset+options.maxRows:null,
   note:!isTable?'Only currently rendered rows are read; virtualized/offscreen rows require scrolling and a fresh read.':undefined};
 },{rowOffset:bounded(command.rowOffset,0,1000000,0),columnOffset:bounded(command.columnOffset,0,100000,0),maxRows:Math.min(bounded(command.maxRows,1,100,20),Math.floor(1000/bounded(command.maxColumns,1,50,12))),maxColumns:bounded(command.maxColumns,1,50,12),maxCellChars:bounded(command.maxCellChars,1,2000,300)});
}
export async function editSurface(locator,command){
 const operation=command.editorAction||'read',timeout=bounded(command.timeoutMs,100,15000,5000);
 if(!['read','replace','insert'].includes(operation))throw Error('Unsupported editor action');
 const read=()=>locator.evaluate(element=>{
  const field=element instanceof HTMLTextAreaElement||element instanceof HTMLInputElement;
  const supported=element.isContentEditable||element instanceof HTMLTextAreaElement||element instanceof HTMLInputElement&&['text','search','url','email','tel'].includes(element.type);
  if(!supported)throw Error('Target is not a supported editable surface; inspect the actual editor input or contenteditable node');
  return {kind:field?'input':element.contentEditable==='plaintext-only'?'plaintext':'rich-text',text:field?element.value:element.innerText??element.textContent??'',readOnly:!!element.readOnly||!!element.disabled||element.getAttribute('aria-readonly')==='true'||element.getAttribute('aria-disabled')==='true'};
 });
 const before=await read();let verified=operation==='read';
 if(operation!=='read'){
  if(before.readOnly)throw Error('Editor is read-only or disabled');
  if(typeof command.text!=='string'||command.text.length>100000)throw Error('Editor text must be a string of at most 100000 characters');
  if(operation==='replace')await locator.fill(command.text,{timeout});
  else{
   await locator.focus({timeout});
   const selection=await locator.evaluate(element=>{
    if('selectionStart' in element)return {start:element.selectionStart,end:element.selectionEnd};
    const range=getSelection();return {inside:!!range?.anchorNode&&element.contains(range.anchorNode)&&!!range?.focusNode&&element.contains(range.focusNode)};
   });
   if(selection.inside===false)throw Error('Editor selection is outside the target; focus the desired insertion point first');
   await locator.page().keyboard.insertText(command.text);
  }
  // Allow framework input handlers to commit before reading back; never replay edits.
  await locator.evaluate(()=>{});
 }
 const after=await read(),normalize=text=>text.replace(/\r\n/g,'\n').replace(/\u00a0/g,' ');
 if(operation==='replace')verified=normalize(after.text)===normalize(command.text);
 if(operation==='insert')verified=normalize(after.text).includes(normalize(command.text))&&(command.text===''||after.text!==before.text);
 const limit=bounded(command.maxTextChars,1,50000,12000);
 return {...after,text:after.text.slice(0,limit),totalCharacters:after.text.length,truncated:after.text.length>limit,operation,verified,
  warning:verified?undefined:'Input was sent once but did not match readback. Inspect the editor and save state before retrying.',saveVerified:false};
}
