// Android adapter, inserted by desktop-reader-mobile.py after retained desktop declarations.
let singlePageMode=false,sheetSelect=null;
function configureSheetNavigation(value){
 if(!Array.isArray(value)||value.length!==documentPdf.numPages||value.length>300||!value.every(name=>typeof name==='string'&&name.trim()&&[...name].length<=200&&!/[\u0000-\u001f\u007f-\u009f]/.test(name)))return;
 zoom=1;sheetSelect=document.createElement('select');sheetSelect.id='pdf-sheet-select';sheetSelect.setAttribute('aria-label','工作表');
 value.forEach((name,index)=>{const option=document.createElement('option');option.value=String(index+1);option.textContent=name;sheetSelect.append(option);});
 sheetSelect.onchange=()=>{page=Number(sheetSelect.value);render();};
 const header=document.querySelector('header');header.insertBefore(sheetSelect,header.firstChild);header.classList.add('sheet-navigation');
}
async function mountBoundedPdf(single){
 continuousActive=false;continuous?.destroy();continuous=null;version++;rendering?.cancel();textLayer?.cancel();await queue.catch(()=>{});search.unregister();
 status.hidden=true;continuousHost.hidden=false;document.getElementById('stage').hidden=true;
 continuous=await createContinuousPdf({pdf:documentPdf,host:continuousHost,eventBus:search.eventBus,findController:search.controller,token,single,initialZoom:zoom,
  onPage:value=>{page=value;pageInput.value=String(page);if(sheetSelect)sheetSelect.value=String(page);document.getElementById('prev').disabled=page===1;document.getElementById('next').disabled=page===documentPdf.numPages;parent.postMessage({type:'pdf-preview-page',token,pages:documentPdf.numPages,page},'*');},
  onScale:value=>{actualScale=value;document.getElementById('zoom-value').value=String(Math.round(value*100));}});
 continuousActive=true;singlePageMode=single;viewButton.textContent=single?'连续阅读':'单页阅读';continuous.refresh({page,zoom,fitPage,rotation});
}
viewButton.onclick=async()=>{if(!documentPdf||viewButton.disabled)return;viewButton.disabled=true;try{await mountBoundedPdf(!singlePageMode);}catch(error){status.hidden=false;status.textContent='PDF 阅读视图初始化失败，请返回重试。';console.error('Bounded PDF viewer failed',error);}finally{viewButton.disabled=false;}};
