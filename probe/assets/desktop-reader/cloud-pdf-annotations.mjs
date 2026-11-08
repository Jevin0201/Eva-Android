import {AnnotationLayer} from './vendor/pdf-current.mjs';

// Use the shipped PDF.js annotation renderer; the host owns navigation only.
export async function renderPdfAnnotations({pdf,pdfPage,viewport,container,getPage,setPage,token}){
 const jump=async destination=>{const dest=typeof destination==='string'?await pdf.getDestination(destination):destination;if(!Array.isArray(dest))return;const ref=dest[0],index=typeof ref==='number'?ref:await pdf.getPageIndex(ref);if(Number.isInteger(index)&&index>=0&&index<pdf.numPages)setPage(index+1);};
 const links={get pagesCount(){return pdf.numPages;},get page(){return getPage();},set page(value){setPage(value);},externalLinkEnabled:true,isInPresentationMode:false,
  addLinkAttributes(anchor,url){let valid=false;try{valid=['http:','https:','mailto:'].includes(new URL(url).protocol);}catch{}
   anchor.href=valid?url:'#';anchor.rel='noopener noreferrer';anchor.onclick=event=>{event.preventDefault();if(valid)parent.postMessage({type:'pdf-preview-link',token,url},'*');return false;};},
  goToDestination:dest=>void jump(dest).catch(()=>{}),getDestinationHash:()=> '#',getAnchorUrl:value=>value,
  setHash(hash){const value=Number(new URLSearchParams(hash.replace(/^#/,'' )).get('page'));if(value)setPage(value);},
  executeNamedAction(action){const target={NextPage:getPage()+1,PrevPage:getPage()-1,FirstPage:1,LastPage:pdf.numPages}[action];if(target)setPage(target);},eventBus:{dispatch(){}}
 };
 const layer=new AnnotationLayer({div:container,page:pdfPage,viewport:viewport.clone({dontFlip:true}),linkService:links,annotationStorage:pdf.annotationStorage});
 await layer.render({annotations:await pdfPage.getAnnotations({intent:'display'}),renderForms:false,enableScripting:false,enableComment:false,hasJSActions:false});
 return layer;
}
