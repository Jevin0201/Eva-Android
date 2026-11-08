// Rebuild the browser transport adapter from the authorized desktop source.
const fs=require('node:fs'),path=require('node:path');
const desktop=process.env.EVA_DESKTOP_SOURCE||'/Users/jevin/Documents/Codex/Eva-Source';
const deps=path.join(desktop,'node_modules');
let source=fs.readFileSync(path.join(desktop,'src/main/office-preview.js'),'utf8');
source=source.replace("const path=require('node:path'),{TextDecoder}=require('node:util'),{readPreviewFile}=require('./local-preview-files.cjs');",`const path={extname:s=>'.'+s.split('.').pop(),basename:s=>s.split('/').pop(),posix:{extname:s=>'.'+s.split('.').pop(),normalize:s=>{const out=[];for(const p of s.split('/')){if(p==='..')out.pop();else if(p&&p!=='.')out.push(p);}return out.join('/');},join:(...s)=>path.posix.normalize(s.join('/')),dirname:s=>s.split('/').slice(0,-1).join('/'),basename:s=>s.split('/').pop()}};
const {Buffer}=require('buffer/');
let inputBytes;
const readPreviewFile=async({filePath})=>({base64:Buffer.from(inputBytes).toString('base64'),path:filePath});`);
const start=source.indexOf('async function zip(bytes){'),end=source.indexOf('\nfunction xml(',start);
source=source.slice(0,start)+`async function zip(bytes){
 const archive=await require('jszip').loadAsync(bytes);const files=new Map();let size=0;
 const entries=Object.values(archive.files);if(entries.length>LIMIT.entries)throw Error('Office 压缩包包含过多条目');
 for(const f of entries){const n=f.unsafeOriginalName||f.name;if(n.startsWith('/')||n.includes('\\\\')||n.split('/').includes('..')||files.has(n))throw Error('Office 压缩包路径无效');size+=f._data?.uncompressedSize||0;if(size>LIMIT.inflated)throw Error('Office 解压内容超过预览限制');files.set(n,f);}
 const read=async name=>{const f=files.get(name);if(!f)throw Error('Office 内容缺失：'+name);const b=await f.async('uint8array');if(b.length>LIMIT.inflated||b.length!==(f._data?.uncompressedSize??b.length))throw Error('Office 压缩条目大小不一致');return Buffer.from(b);};
 for(const f of entries)if(!f.dir)await read(f.name);return {files,read};
}`+source.slice(end);
source=source.replace("require('exceljs')","require('exceljs/dist/exceljs.min.js')");
// ExcelJS matches drawing tags by their literal xdr:/a: prefixes rather than
// namespace URI. Valid OOXML from openpyxl uses a default drawing namespace.
// Canonicalize only drawing XML in an in-memory copy; retain every ZIP part,
// relationship, image and chart and never rewrite the user's workbook.
const presentationTransport=String.raw`
function pptPart(base,target){if(typeof target!=='string'||target.includes('\\')||target.includes(':'))return null;const part=path.posix.normalize(target.startsWith('/')?target.slice(1):path.posix.join(base,target));return part.startsWith('ppt/')?part:null;}
function ownShapeTransform(shape){return child(shape,'xfrm')||child(child(shape,'spPr'),'xfrm');}
function placeholder(shape){return first(shape,'ph');}
function inheritedShape(root,ph,master=false){
 if(!root||!ph)return null;const shapes=all(root,'sp').filter(shape=>placeholder(shape));
 let matches=ph.attrs.idx!==undefined&&!master?shapes.filter(shape=>(placeholder(shape).attrs.idx||'0')===ph.attrs.idx):[];
 if(matches.length===1)return matches[0];if(matches.length>1)return null;
 const type=ph.attrs.type||'obj';matches=shapes.filter(shape=>(placeholder(shape).attrs.type||'obj')===type);return matches.length===1?matches[0]:null;
}
function presentationGeometry(shape,width,height,layout,master){
 const ph=placeholder(shape),layoutShape=inheritedShape(layout,ph),masterShape=inheritedShape(master,placeholder(layoutShape||shape),true);
 for(const [candidate,geometrySource]of [[shape,'slide'],[layoutShape,'layout'],[masterShape,'master']]){
  const transform=candidate&&ownShapeTransform(candidate),offset=transform&&child(transform,'off'),extent=transform&&child(transform,'ext');
  if(!offset||!extent)continue;const w=number(extent.attrs.cx),h=number(extent.attrs.cy);if(w<=0||h<=0)continue;
  return {x:number(offset.attrs.x)/width,y:number(offset.attrs.y)/height,w:w/width,h:h/height,geometrySource,rotate:number(transform.attrs.rot)/60000};
 }return null;
}
function presentationChart(root){
 const plot=first(root,'plotArea'),groups=plot?.children.filter(node=>node.name.endsWith('Chart'))||[],title=all(child(first(root,'chart'),'title')||{children:[]},'t').map(n=>n.text).join('');
 if(groups.length!==1)return {type:'unsupportedCombination',title,series:[],supported:false,warnings:['复合图表尚不支持；未伪造图表数据或排版']};
 const group=groups[0],type={barChart:'bar',lineChart:'line',pieChart:'pie'}[group.name]||group.name,grouping=child(group,'grouping')?.attrs.val,barDirection=child(group,'barDir')?.attrs.val;
 let missing=false;const series=group.children.filter(node=>node.name==='ser').map((ser,index)=>{const names=chartData(null,child(ser,'tx')),categories=chartData(null,child(ser,'cat')||child(ser,'xVal')),values=chartData(null,child(ser,'val')||child(ser,'yVal'));missing||=names.missing||categories.missing||values.missing;const length=Math.max(categories.points.length,values.points.length);return {name:String(names.points[0]??('系列 '+(index+1))),categories:Array.from({length},(_,i)=>categories.points[i]==null?'':String(categories.points[i])),values:Array.from({length},(_,i)=>{const value=values.points[i];return value==null||value===''||typeof value==='object'||!Number.isFinite(Number(value))?null:Number(value);})};});
 const supported=['bar','line','pie'].includes(type)&&!(type==='bar'&&barDirection==='bar')&&!['stacked','percentStacked'].includes(grouping),warnings=[];
 if(missing||series.some(row=>row.values.some(v=>v===null)))warnings.push('图表缓存不完整；缺失值未按零显示');if(!supported)warnings.push('此图表类型或堆叠/方向尚未支持；未按普通柱线图替代');
 return {type,title,series,supported,grouping,barDirection,warnings};
}
async function presentation(archive){
 const root=xml(await archive.read('ppt/presentation.xml')),rels=relationMap(xml(await archive.read('ppt/_rels/presentation.xml.rels'))),size=first(root,'sldSz'),width=number(size?.attrs.cx,9144000),height=number(size?.attrs.cy,5143500);
 if(width<=0||height<=0)throw Error('幻灯片尺寸无效');const ids=all(root,'sldId');if(ids.length>LIMIT.slides)throw Error('幻灯片数量超过预览限制');let images=0;const slides=[],warnings=['原文件直接读取普通文本、图片及常见图表缓存；复杂母版样式、组合、SmartArt和动画仍有未支持项。'],cache=new Map();
 const readRoot=async part=>{if(!part||!archive.files.has(part))return null;if(!cache.has(part))cache.set(part,xml(await archive.read(part)));return cache.get(part);};
 const readRels=async part=>{const name=path.posix.join(path.posix.dirname(part),'_rels',path.posix.basename(part)+'.rels'),node=await readRoot(name);return node?relationMap(node):new Map();};
 const related=async(part,local,type)=>{const rows=[...local.values()].filter(rel=>rel.Type?.endsWith('/'+type)&&rel.TargetMode!=='External');if(rows.length!==1)return [null,null];const name=pptPart(path.posix.dirname(part),rows[0].Target);return [name,await readRoot(name)];};
 for(const [index,id]of ids.entries()){
  const rel=rels.get(id.attrs['r:id']);if(!rel||rel.TargetMode==='External')throw Error('幻灯片关系无效');const part=pptPart('ppt',rel.Target),slideRoot=await readRoot(part);if(!slideRoot)throw Error('幻灯片内容缺失');const local=await readRels(part),[layoutPart,layout]=await related(part,local,'slideLayout'),[masterPart,master]=layoutPart?await related(layoutPart,await readRels(layoutPart),'slideMaster'):[null,null];
  const slide={elements:[],unpositionedElements:[],warnings:[],background:rgb(first(first(slideRoot,'bg')||{children:[]},'srgbClr')?.attrs.val)||'#ffffff'};
  for(const shape of first(slideRoot,'spTree')?.children||[]){
   if(!['sp','pic','graphicFrame'].includes(shape.name)){if(shape.name==='grpSp')slide.warnings.push('组合形状尚未支持');continue;}
   const geometry=presentationGeometry(shape,width,height,layout,master),textValue=all(shape,'p').map(p=>all(p,'t').map(t=>t.text).join('')).join('\n');
   if(!geometry){slide.unpositionedElements.push({type:shape.name,text:textValue,reason:'未找到本页、布局或母版中的唯一原几何'});slide.warnings.push('部分元素原位置无法确定，未伪造满页位置');continue;}
   if(shape.name==='sp'){
    const props=child(shape,'spPr'),fill=props&&child(props,'solidFill'),line=props&&child(props,'ln'),style=first(shape,'rPr')||first(shape,'defRPr'),color=style&&first(style,'srgbClr');slide.elements.push({type:'text',text:textValue,...geometry,fontSize:number(style?.attrs.sz,1800)/100,bold:style?.attrs.b==='1',color:rgb(color?.attrs.val)||'#222222',fill:rgb(fill&&first(fill,'srgbClr')?.attrs.val),border:rgb(line&&first(line,'srgbClr')?.attrs.val),geometry:props&&first(props,'prstGeom')?.attrs.prst,align:first(shape,'pPr')?.attrs.algn||'l'});
   }else if(shape.name==='pic'){
    const imageRel=local.get(first(shape,'blip')?.attrs['r:embed']);if(!imageRel||imageRel.TargetMode==='External')continue;const target=pptPart(path.posix.dirname(part),imageRel.Target),ext=path.posix.extname(target||'').toLowerCase(),mime={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp'}[ext];if(!target?.startsWith('ppt/media/')||!mime)continue;const bytes=await archive.read(target);images+=bytes.length;if(images>LIMIT.images)throw Error('幻灯片图片超过预览限制');slide.elements.push({type:'image',src:'data:'+mime+';base64,'+bytes.toString('base64'),...geometry});
   }else{
    const link=first(shape,'chart'),chartRel=link&&local.get(link.attrs['r:id']);if(!chartRel||chartRel.TargetMode==='External'||!chartRel.Type?.endsWith('/chart')){slide.warnings.push('表格或非图表图形框尚未支持');continue;}const target=pptPart(path.posix.dirname(part),chartRel.Target),chartRoot=await readRoot(target);if(!target?.startsWith('ppt/charts/')||!chartRoot){slide.warnings.push('图表缓存内容缺失');continue;}const chart=presentationChart(chartRoot);slide.elements.push({type:'chart',...geometry,chart});
   }
  }
  for(const warning of new Set(slide.warnings))warnings.push('第'+(index+1)+'页：'+warning);slides.push(slide);
 }return {kind:'presentation',width,height,slides,warnings};
}
`;
const presentationStart=source.indexOf('async function presentation(archive){'),presentationEnd=source.indexOf('async function spreadsheet(bytes){',presentationStart);
if(presentationStart<0||presentationEnd<0)throw Error('Desktop Office presentation adapter source changed');
source=source.slice(0,presentationStart)+presentationTransport+'\n'+source.slice(presentationEnd);
const spreadsheetTransport=String.raw`
function canonicalDrawing(bytes){
 const parser=new(require('saxes').SaxesParser)({xmlns:true});let output='',nodes=0;const stack=[];
 const prefixes=new Map([['http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing','xdr'],['http://schemas.openxmlformats.org/drawingml/2006/main','a'],['http://schemas.openxmlformats.org/officeDocument/2006/relationships','r'],['http://www.w3.org/XML/1998/namespace','xml']]);
 const escape=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;').replace(/\r/g,'&#13;').replace(/\n/g,'&#10;').replace(/\t/g,'&#9;');
 const qualified=(node,used)=>{if(!node.uri)return node.local;if(!prefixes.has(node.uri))prefixes.set(node.uri,'eva'+prefixes.size);const prefix=prefixes.get(node.uri);if(prefix!=='xml')used.set(prefix,node.uri);return prefix+':'+node.local;};
 parser.on('doctype',()=>{throw Error('Office XML 不允许文档类型声明');});
 parser.on('opentag',node=>{if(++nodes>200000||stack.length>100)throw Error('Office XML 结构过大');const used=new Map(),name=qualified(node,used),attrs=[];for(const attribute of Object.values(node.attributes)){if(attribute.uri==='http://www.w3.org/2000/xmlns/')continue;attrs.push(qualified(attribute,used)+'="'+escape(attribute.value)+'"');}for(const [prefix,uri]of used)attrs.push('xmlns:'+prefix+'="'+escape(uri)+'"');output+='<'+name+(attrs.length?' '+attrs.join(' '):'')+'>';stack.push(name);});
 const textContent=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');parser.on('text',s=>{output+=textContent(s);});parser.on('cdata',s=>{output+=textContent(s);});parser.on('closetag',()=>{output+='</'+stack.pop()+'>';});parser.write(text(bytes)).close();return output;
}
async function spreadsheetDrawingBytes(bytes,archive){
 let copy;for(const name of archive.files.keys()){if(!/^xl\/drawings\/[^/]+\.xml$/.test(name))continue;const original=await archive.read(name),normalized=canonicalDrawing(original);if(normalized!==text(original)){copy||=await require('jszip').loadAsync(bytes);copy.file(name,normalized,{createFolders:false});}}
 return copy?await copy.generateAsync({type:'uint8array'}):bytes;
}
function xlsxPart(base,target){
 if(typeof target!=='string'||target.includes('\\')||target.includes(':'))return null;
 const resolved=path.posix.normalize(target.startsWith('/')?target.slice(1):path.posix.join(base,target));return resolved.startsWith('xl/')?resolved:null;
}
function chartReference(workbook,reference){
 if(!workbook)return null;const match=/^(?:'((?:[^']|'')+)'|([^!]+))!\$?([A-Z]+)\$?(\d+)(?::\$?([A-Z]+)\$?(\d+))?$/.exec(reference||'');if(!match)return null;
 const sheet=workbook.getWorksheet((match[1]||match[2]).replace(/''/g,"'"));if(!sheet)return null;
 const column=s=>[...s].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0),c1=column(match[3]),r1=Number(match[4]),c2=column(match[5]||match[3]),r2=Number(match[6]||match[4]);
 if(c1<1||r1<1||c2<c1||r2<r1||c2>LIMIT.columns||r2>LIMIT.rows||(c2-c1+1)*(r2-r1+1)>LIMIT.cells)return null;
 const result=[];for(let r=r1;r<=r2;r++)for(let c=c1;c<=c2;c++){let value=sheet.getCell(r,c).value;const formula=value&&typeof value==='object'&&('formula'in value||'sharedFormula'in value);if(formula)value=value.result;result.push({value:value??null,missing:!!formula&&value==null});}return result;
}
function chartData(workbook,node){
 if(!node)return {points:[],missing:false};const cache=first(node,'numCache')||first(node,'strCache')||first(node,'numLit')||first(node,'strLit');
 if(cache){const points=[],declared=number(first(cache,'ptCount')?.attrs.val);if(declared>LIMIT.cells)throw Error('图表数据超过预览限制');for(const pt of all(cache,'pt')){const index=number(pt.attrs.idx,-1);if(index<0||index>=LIMIT.cells)throw Error('图表数据索引无效');points[index]=first(pt,'v')?.text??null;}return {points:Array.from({length:Math.max(declared,points.length)},(_,i)=>points[i]??null),missing:false};}
 const reference=first(node,'f')?.text,values=chartReference(workbook,reference);
 if(values)return {points:values.map(v=>v.value),missing:values.some(v=>v.missing)};
 const direct=first(node,'v')?.text;return {points:direct==null?[]:[direct],missing:!!reference};
}
async function spreadsheetVisuals(workbook,archive){
 const result=new Map();let imageBytes=0,chartCount=0;
 for(const sheet of workbook.worksheets){const images=[];for(const placed of sheet.getImages()){const media=workbook.getImage(placed.imageId),mime={png:'image/png',jpeg:'image/jpeg',jpg:'image/jpeg',gif:'image/gif',webp:'image/webp'}[media?.extension];if(!mime||!media.buffer)continue;const bytes=Buffer.from(media.buffer);imageBytes+=bytes.length;if(imageBytes>LIMIT.images)throw Error('工作簿图片超过预览限制');const range=placed.range,tl=range.tl||{},br=range.br||{};const width=range.ext?.width||Math.max(1,((br.col??(tl.col+1))-tl.col)*80),height=range.ext?.height||Math.max(1,((br.row??(tl.row+1))-tl.row)*20),position=a=>a?{row:a.nativeRow??Math.floor(a.row||0),col:a.nativeCol??Math.floor(a.col||0),xOffset:(a.nativeColOff||0)/9525,yOffset:(a.nativeRowOff||0)/9525}:undefined;images.push({src:'data:'+mime+';base64,'+bytes.toString('base64'),x:tl.col||0,y:tl.row||0,width,height,anchor:{from:position(tl),to:position(range.br),width,height}});}result.set(sheet.name,{images,charts:[]});}
 const book=xml(await archive.read('xl/workbook.xml')),bookRels=relationMap(xml(await archive.read('xl/_rels/workbook.xml.rels')));
 for(const entry of all(book,'sheet')){const output=result.get(entry.attrs.name),rel=bookRels.get(entry.attrs['r:id']);if(!output||!rel||rel.TargetMode==='External')continue;const part=xlsxPart('xl',rel.Target);if(!part||!archive.files.has(part))continue;
  const sheet=xml(await archive.read(part)),drawing=first(sheet,'drawing'),relsPath=path.posix.join(path.posix.dirname(part),'_rels',path.posix.basename(part)+'.rels');if(!drawing||!archive.files.has(relsPath))continue;const local=relationMap(xml(await archive.read(relsPath))),drawingRel=local.get(drawing.attrs['r:id']);if(!drawingRel||drawingRel.TargetMode==='External')continue;const drawingPath=xlsxPart(path.posix.dirname(part),drawingRel.Target);if(!drawingPath||!archive.files.has(drawingPath))continue;
  const drawingRoot=xml(await archive.read(drawingPath)),drawingRelsPath=path.posix.join(path.posix.dirname(drawingPath),'_rels',path.posix.basename(drawingPath)+'.rels');if(!archive.files.has(drawingRelsPath))continue;const drawingRels=relationMap(xml(await archive.read(drawingRelsPath)));
  for(const anchor of first(drawingRoot,'wsDr')?.children||[]){const link=first(anchor,'chart'),chartRel=link&&drawingRels.get(link.attrs['r:id']);if(!chartRel||chartRel.TargetMode==='External'||!chartRel.Type?.endsWith('/chart'))continue;const chartPath=xlsxPart(path.posix.dirname(drawingPath),chartRel.Target);if(!chartPath||!archive.files.has(chartPath))continue;if(++chartCount>LIMIT.slides)throw Error('工作簿图表过多');const root=xml(await archive.read(chartPath)),plot=first(root,'plotArea'),title=all(child(first(root,'chart'),'title')||{children:[]},'t').map(n=>n.text).join(''),position=name=>{const node=child(anchor,name);return node?{row:number(child(node,'row')?.text),col:number(child(node,'col')?.text),xOffset:number(child(node,'colOff')?.text)/9525,yOffset:number(child(node,'rowOff')?.text)/9525}:undefined;};
   for(const group of plot?.children.filter(n=>n.name.endsWith('Chart'))||[]){let missing=false;const series=group.children.filter(n=>n.name==='ser').map((ser,index)=>{const names=chartData(workbook,child(ser,'tx')),categories=chartData(workbook,child(ser,'cat')||child(ser,'xVal')),values=chartData(workbook,child(ser,'val')||child(ser,'yVal'));missing||=names.missing||categories.missing||values.missing;return {name:String(names.points[0]??('系列 '+(index+1))),categories:categories.points.map(v=>v==null?'':String(v)),values:values.points.map(v=>v===null||v===''||typeof v==='object'||!Number.isFinite(Number(v))?null:Number(v))};});output.charts.push({type:{barChart:'bar',lineChart:'line',pieChart:'pie'}[group.name]||group.name,title,series,warnings:missing?['部分公式尚未计算；未缓存值不按零处理']:[],anchor:{from:position('from'),to:position('to'),width:child(anchor,'ext')?number(child(anchor,'ext').attrs.cx)/9525:undefined,height:child(anchor,'ext')?number(child(anchor,'ext').attrs.cy)/9525:undefined}});}
  }
 }return result;
}
`;
source=source.replace('async function spreadsheet(bytes){',spreadsheetTransport+'\nasync function spreadsheet(bytes,archive){\n bytes=await spreadsheetDrawingBytes(bytes,archive);');
source=source.replace('await spreadsheet(bytes);','await spreadsheet(bytes,archive);');
source=source.replace("let cells=0;const sheets=[];","let cells=0;const sheets=[];const visuals=await spreadsheetVisuals(workbook,archive);");
source=source.replace('for(const sheet of workbook.worksheets){if(sheet.rowCount',"for(const sheet of workbook.worksheets){if(sheet.state==='hidden'||sheet.state==='veryHidden')continue;if(sheet.state&&sheet.state!=='visible')throw Error('无法确认工作表可见性');if(sheet.rowCount");
source=source.replace(" }return {kind:'spreadsheet',sheets,warnings:"," }if(!sheets.length)throw Error('没有可见工作表');return {kind:'spreadsheet',sheets,warnings:");
source=source.replace('sheets.push({name:sheet.name,rows,styles,heights,','sheets.push({...visuals.get(sheet.name),name:sheet.name,rows,styles,heights,defaultRowHeight:(sheet.properties.defaultRowHeight||15)*96/72,defaultColumnWidth:Math.min(800,(sheet.properties.defaultColWidth||12)*7+10),');
source=source.replace('module.exports={readOfficePreview,delimited,LIMIT};',`export async function readOffice(bytes,filePath){if(bytes.byteLength>LIMIT.bytes)throw Error('Office 文件超过32 MiB限制');inputBytes=bytes;try{return await readOfficePreview({filePath});}finally{inputBytes=null;}}`);
fs.writeFileSync('migration/desktop-reader/office-browser.mjs',source);
const result=require(path.join(deps,'esbuild')).buildSync({stdin:{contents:source,resolveDir:deps,loader:'js'},bundle:true,format:'esm',platform:'browser',outfile:'probe/assets/desktop-reader/office-browser.js',legalComments:'inline',metafile:true});

 const packages=new Map();for(const input of Object.keys(result.metafile.inputs)){if(!input.includes('node_modules'))continue;let dir=path.dirname(path.resolve(input));while(!fs.existsSync(path.join(dir,'package.json'))&&dir!==path.dirname(dir))dir=path.dirname(dir);if(packages.has(dir)||!fs.existsSync(path.join(dir,'package.json')))continue;const p=JSON.parse(fs.readFileSync(path.join(dir,'package.json'),'utf8'));packages.set(dir,{name:p.name,version:p.version,license:p.license,notices:fs.readdirSync(dir).filter(n=>/^(license|notice|copying)/i.test(n)&&fs.statSync(path.join(dir,n)).isFile()).map(n=>({name:n,text:fs.readFileSync(path.join(dir,n),'utf8')}))});}fs.writeFileSync('probe/assets/desktop-reader/OFFICE_LICENSES.json',JSON.stringify([...packages.values()],null,2));require(path.join(deps,'esbuild')).buildSync({stdin:{contents:"import markdownit from 'markdown-it';import katex from 'katex';globalThis.markdownit=markdownit;globalThis.katex=katex;",resolveDir:desktop},bundle:true,format:'iife',outfile:'probe/assets/desktop-reader/markdown-deps.js',legalComments:'inline'});
