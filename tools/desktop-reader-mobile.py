"""Reproducible Android layout adaptation of authorized desktop source assets."""
from pathlib import Path

MARKDOWN_CLIPBOARD_HELPER = r''' async function copyReaderText(content){
  try{if(typeof navigator.clipboard?.writeText==='function'){await navigator.clipboard.writeText(content);return;}}catch{}
  const active=document.activeElement,selection=document.getSelection(),ranges=[];
  for(let i=0;selection&&i<selection.rangeCount;i++)ranges.push(selection.getRangeAt(i).cloneRange());
  const anchor=selection?.anchorNode,anchorOffset=selection?.anchorOffset,focus=selection?.focusNode,focusOffset=selection?.focusOffset;
  const inputSelection=active&&typeof active.selectionStart==='number'?[active.selectionStart,active.selectionEnd,active.selectionDirection]:null;
  const left=scrollX,top=scrollY,field=document.createElement('textarea');
  field.value=content;field.readOnly=true;field.tabIndex=-1;field.style.cssText='position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
  try{
   document.body.appendChild(field);field.focus({preventScroll:true});field.select();field.setSelectionRange(0,field.value.length);
   if(!document.execCommand('copy'))throw Error('Clipboard copy failed');
  }finally{
   field.remove();
   if(active?.isConnected){try{active.focus({preventScroll:true});}catch{}}
   if(selection){try{selection.removeAllRanges();for(const range of ranges)selection.addRange(range);if(anchor&&focus&&selection.setBaseAndExtent)selection.setBaseAndExtent(anchor,anchorOffset,focus,focusOffset);}catch{}}
   if(inputSelection&&active?.isConnected){try{active.setSelectionRange(...inputSelection);}catch{}}
   scrollTo(left,top);
  }
 }
'''


def adapt_markdown_clipboard(text):
 old='await navigator.clipboard.writeText(content);'
 assert text.count(old)==1, 'Desktop Markdown clipboard source changed'
 marker=' function hydrate(root)'
 assert text.count(marker)==1, 'Desktop Markdown hydration source changed'
 return text.replace(old,'await copyReaderText(content);').replace(marker,MARKDOWN_CLIPBOARD_HELPER+marker)


def adapt(destination):
 path=destination/'cloud-markdown.js'
 path.write_text(adapt_markdown_clipboard(path.read_text(encoding='utf-8')),encoding='utf-8')
 def edit(name, old, new):
  path=destination/name;text=path.read_text();assert text.count(old)==1,(name,old[:80]);path.write_text(text.replace(old,new))
 for kind in ['docx','pdf']:
  path=destination/f'cloud-{kind}-frame.html';text=path.read_text();text=text.replace('<head>','<head><meta name="viewport" content="width=device-width,initial-scale=1">',1)
  if kind=='docx':text=text.replace("style-src 'unsafe-inline'", "style-src 'self' 'unsafe-inline'")
  path.write_text(text.replace('</head>','<link rel="stylesheet" href="./mobile-reader.css"></head>'))
 edit('cloud-docx-frame.js',"import * as docxPreview", "import {setupDocx,docxFitScale,alignDocxBody,applyDocxScale} from './mobile-layout.js';\nimport * as docxPreview")
 edit('cloud-docx-frame.js',"Math.max(.25,Math.min(1,(innerWidth-32)/pages[0].offsetWidth))",'docxFitScale(pages[currentPage-1]||pages[0],viewport)')
 edit('cloud-docx-frame.js',"root.style.setProperty('--scale',String(scale));","applyDocxScale(root,viewport,scale);")
 edit('cloud-docx-frame.js',"el('zoom-value').value=String(Math.round(scale*100));}","el('zoom-value').value=String(Math.round(scale*100));if(zoom===null)alignDocxBody(pages[currentPage-1]||pages[0],viewport,scale);}")
 edit('cloud-docx-frame.js','function setZoom(value){','function setZoom(value,pinch=false){if(pinch){cancelZoomNavigation();zoom=value;resize();return;}')
 edit('cloud-docx-frame.js',"pages=[...root.querySelectorAll('section.docx')];resize();","await document.fonts.ready;await Promise.all([...root.querySelectorAll('img')].map(img=>img.decode().catch(()=>{})));pages=[...root.querySelectorAll('section.docx')];resize();")
 edit('cloud-docx-frame.js',"parent.postMessage({type:'docx-preview-loaded'},'*');", "setupDocx({toolbar,viewport,root,getScale:()=>Number(root.dataset.scale||1),setScale:setZoom});parent.postMessage({type:'docx-preview-loaded'},'*');")
 edit('office-preview.js','export function mountOfficePreview',"import {renderSheetVisuals,renderPresentationChart} from './office-charts.js';\nimport {setupOffice} from './mobile-layout.js';\nexport function mountOfficePreview")
 edit('office-preview.js','        if (item.type === "image") {','        if(item.type === "chart"){renderPresentationChart(node,item.chart,item.w*fitted,item.h*fitted*model.height/model.width);node.dataset.readerNonText="true";}else if (item.type === "image") {')
 edit('office-preview.js','      content.append(createSlide(entry,fitted));',"      const stableSlide=createSlide(entry,fitted);stableSlide.dataset.renderScale=String(scale);content.append(stableSlide);if(entry.unpositionedElements?.length){const note=document.createElement('aside');note.className='empty';note.textContent='以下内容无法恢复原布局位置：'+entry.unpositionedElements.map(item=>item.text||item.chart?.title||'未定位对象').join('；');content.append(note);}")
 edit('office-preview.js','      table.style.zoom = String(scale);','      table.style.zoom = \"1\";')
 edit('office-preview.js','      content.append(table);','      renderSheetVisuals(content,entry,scale,table);')
 edit('office-preview.js','  minus.onclick = () => {',"""  function updateContentScale(value){
    scale=Math.max(.5,Math.min(2,value));
    const shell=content.querySelector('.sheet-stage'),plane=content.querySelector('.sheet-surface');
    if(shell&&plane){plane.style.transform='scale('+scale+')';shell.style.width=parseFloat(plane.style.width)*scale+'px';shell.style.height=parseFloat(plane.style.height)*scale+'px';}
    const slide=content.querySelector(':scope > .slide');if(slide)slide.style.zoom=String(scale/Number(slide.dataset.renderScale||1));
    zoom.textContent=Math.round(scale*100)+'%';minus.disabled=scale<=.5;plus.disabled=scale>=2;
  }
  minus.onclick = () => {""")
 edit('office-preview.js','    scale = Math.max(0.5, Math.round((scale - 0.1) * 10) / 10);\n    render();','    updateContentScale(Math.max(0.5, Math.round((scale - 0.1) * 10) / 10));')
 edit('office-preview.js','    scale = Math.min(2, Math.round((scale + 0.1) * 10) / 10);\n    render();','    updateContentScale(Math.min(2, Math.round((scale + 0.1) * 10) / 10));')
 edit('office-preview.js','if (model.kind === "presentation"){render();fitThumbnails();}', 'if (model.kind === "presentation"&&!content.dataset.readerPinching){render();fitThumbnails();}')
 edit('office-preview.js','  resize.observe(content);','  resize.observe(content);\n  const disposeMobile=setupOffice({root,style,bar,select,minus,plus,zoom,searchBar,query,thumbnails,content,getScale:()=>scale,setScale:updateContentScale});')
 edit('office-preview.js','    disposed = true;','    disposeMobile();disposed = true;')
 # Mature PDF.js viewers are used for BOTH modes; never allocate a full tall-page canvas.
 edit('cloud-pdf-continuous.mjs','token,onPage,onScale})','token,onPage,onScale,single=false,initialZoom=null})')
 edit('cloud-pdf-continuous.mjs','const {PDFViewer,PDFLinkService}','const {PDFViewer,PDFSinglePageViewer,PDFLinkService}')
 edit('cloud-pdf-continuous.mjs','const viewer=new PDFViewer({','const Viewer=single?PDFSinglePageViewer:PDFViewer;const viewer=new Viewer({')
 edit('cloud-pdf-continuous.mjs','enableScripting:false,','enableScripting:false,enableDetailCanvas:true,')
 edit('cloud-pdf-continuous.mjs',"viewer.currentScaleValue='page-width';resolve();", "viewer.currentScaleValue=initialZoom??'page-width';resolve();")
 edit('cloud-pdf-continuous.mjs',"eventBus.on('scalechanging',scaleChange);", "eventBus.on('scalechanging',scaleChange);const painted=event=>{const canvas=event.source?.canvas;if(canvas){canvas.dataset.evaPainted='true';canvas.dataset.evaDetail=String(!!event.isDetailView);}container.dataset.paintedPage=String(event.pageNumber);parent.postMessage({type:'pdf-preview-ready',token,pages:pdf.numPages,page:event.pageNumber},'*');if(event.isDetailView)container.dataset.detailRenders=String(Number(container.dataset.detailRenders||0)+1);};eventBus.on('pagerendered',painted);")
 edit('cloud-pdf-continuous.mjs',"destroy(){eventBus.off('pagechanging'", "destroy(){eventBus.off('pagerendered',painted);eventBus.off('pagechanging'")
 edit('cloud-pdf-continuous.mjs',"catch(error){eventBus.off('pagechanging'","catch(error){eventBus.off('pagerendered',painted);eventBus.off('pagechanging'")
 # Bound the dormant legacy path as defence in depth, in case another caller re-enables it.
 edit('cloud-pdf-frame.mjs','pixel=Math.min(devicePixelRatio||1,2);','pixel=Math.min(devicePixelRatio||1,2,8192/viewport.width,8192/viewport.height,Math.sqrt(4194304/(viewport.width*viewport.height)));')
 edit('cloud-pdf-frame.mjs','min="20" max="300"','min="1" max="300"')
 path=destination/'cloud-pdf-frame.mjs';text=path.read_text()
 start=text.index('viewButton.onclick=async()=>');end=text.index('const layoutStyle=',start)
 replacement=Path(__file__).with_name('desktop-reader-pdf-mobile.js').read_text()
 text=text[:start]+replacement+'\n'+text[end:]
 text=text.replace('Math.max(.2,','Math.max(.01,').replace('(zoom??actualScale)+delta','(zoom??actualScale)*(1+delta)')
 old="pageInput.max=String(documentPdf.numPages);await render();"
 assert text.count(old)==1
 text=text.replace(old,"pageInput.max=String(documentPdf.numPages);configureSheetNavigation(e.data.sheetNames);await mountBoundedPdf(false);")
 text+="\nimport {setupPdf} from './mobile-layout.js';setupPdf({getScale:()=>actualScale,setScale:async value=>{zoom=value;fitPage=false;await render();},getViewport:()=>continuousActive?document.getElementById('continuous-scroll'):document.getElementById('stage'),getSurface:()=>continuousActive?document.querySelector('#continuous-scroll .page[data-page-number=\"'+page+'\"]'):surface});\n"
 path.write_text(text)
