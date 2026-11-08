// Real browser regression for legal default-namespace XLSX drawing XML.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const {chromium,launchOptions}=require('./browser-test-env.cjs');
const root=path.resolve(__dirname,'..');
const temporary=fs.mkdtempSync(path.join(root,'tmp/excel-preview-'));
const fixture=path.join(temporary,'drawings.xlsx');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const adapter=fs.readFileSync(path.join(root,'migration/desktop-reader/office-browser.mjs'),'utf8');
const deps=path.join(process.env.EVA_DESKTOP_SOURCE||'/Users/jevin/Documents/Codex/Eva-Source','node_modules');
const esbuild=require(path.join(deps,'esbuild'));
esbuild.buildSync({stdin:{contents:adapter.replace(' bytes=await spreadsheetDrawingBytes(bytes,archive);',''),resolveDir:deps},bundle:true,platform:'browser',format:'esm',outfile:path.join(temporary,'baseline.js')});
esbuild.buildSync({stdin:{contents:adapter+String.raw`
export async function inspectDrawings(bytes){
 const original=await zip(bytes),normalized=await spreadsheetDrawingBytes(bytes,original),rewritten=await zip(normalized),unchanged=[];
 if(original.files.size!==rewritten.files.size)throw Error('ZIP entries removed');
 let drawings=0,charts=0;
 for(const name of original.files.keys()){
  if(original.files.get(name).dir)continue;
  const before=await original.read(name),after=await rewritten.read(name);
  if(/^xl\/drawings\/[^/]+\.xml$/.test(name)){
   const a=xml(before),b=xml(after);
   for(const kind of ['pic','graphicFrame','oneCellAnchor','twoCellAnchor','chart','blip'])if(all(a,kind).length!==all(b,kind).length)throw Error('Drawing content lost: '+kind);
   drawings+=all(b,'pic').length;charts+=all(b,'chart').length;
  }else{if(!before.equals(after))throw Error('Untouched ZIP part changed: '+name);unchanged.push(name);}
 }
 const book=new(require('exceljs/dist/exceljs.min.js').Workbook)();await book.xlsx.load(normalized);
 return {pictures:drawings,charts,images:book.worksheets.flatMap(s=>s.getImages()).length,unchanged};
}
`,resolveDir:deps},bundle:true,platform:'browser',format:'esm',outfile:path.join(temporary,'inspect.js')});
execFileSync('python3',['-c',String.raw`
import sys,zipfile,re
from pathlib import Path
from openpyxl import Workbook
from openpyxl.chart import BarChart,Reference
from openpyxl.drawing.image import Image
from openpyxl.styles import Font,PatternFill
from PIL import Image as Pixels
base=Path(sys.argv[1]);Pixels.new('RGB',(12,8),(18,93,161)).save(base/'picture.png')
w=Workbook();s=w.active;s.title='城市运营'
s.append(['运营看板']);s.merge_cells('A1:D1');s['A1'].font=Font(bold=True,color='FF125DA1');s['A1'].fill=PatternFill('solid',fgColor='FFF2F7FF')
s.append(['区域','收入','完成率']);s.append(['北京',1200,.75]);s.append(['上海',1800,.9]);s['C3'].number_format='0.0%';s['D3']='=SUM(B3:B4)';s['D4']='=B4*2';s['D2']='公式系列';s.column_dimensions['B'].width=24
s.add_image(Image(base/'picture.png'),'F2');c=BarChart();c.title='区域收入';c.add_data(Reference(s,min_col=2,min_row=2,max_row=4),titles_from_data=True);c.set_categories(Reference(s,min_col=1,min_row=3,max_row=4));c.add_data(Reference(s,min_col=4,min_row=2,max_row=4),titles_from_data=True);s.add_chart(c,'F8');w.create_sheet('明细')['A1']='保留第二工作表';w.save(base/'original.xlsx')
with zipfile.ZipFile(base/'original.xlsx') as src,zipfile.ZipFile(base/'drawings.xlsx','w',zipfile.ZIP_DEFLATED) as out:
 for info in src.infolist():
  data=src.read(info.filename)
  if info.filename=='xl/worksheets/sheet1.xml':data=data.replace(b'<f>SUM(B3:B4)</f><v></v>',b'<f>SUM(B3:B4)</f><v>3000</v>')
  out.writestr(info,data)
with zipfile.ZipFile(base/'drawings.xlsx') as src,zipfile.ZipFile(base/'all-hidden.xlsx','w',zipfile.ZIP_DEFLATED) as out:
 for info in src.infolist():
  data=src.read(info.filename)
  if info.filename=='xl/workbook.xml':data=data.replace(b'state="visible"',b'state="hidden"')
  out.writestr(info,data)
with zipfile.ZipFile(base/'drawings.xlsx') as z:
 drawing=z.read('xl/drawings/drawing1.xml');assert b'<wsDr xmlns=' in drawing and b'<graphicFrame' in drawing and b'<pic>' in drawing
 print('fixture: default-namespace drawing with real image/chart, cached/uncached formulas, merges and styles')
`,temporary],{stdio:'inherit'});
const files=[fixture,...process.argv.slice(2).map(p=>path.resolve(p))];
const before=files.map(p=>hash(fs.readFileSync(p)));
const server=http.createServer((req,res)=>{const pathname=new URL(req.url,'http://localhost').pathname;try{if(pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<html><body></body></html>');return;}const testModule=['/baseline.js','/inspect.js'].includes(pathname);const target=path.join(testModule?temporary:path.join(root,'probe/assets/desktop-reader'),decodeURIComponent(pathname));assert(path.dirname(target)===(testModule?temporary:path.join(root,'probe/assets/desktop-reader')));res.setHeader('Content-Type','text/javascript');res.end(fs.readFileSync(target));}catch(e){res.statusCode=404;res.end(String(e));}});
(async()=>{let browser;try{await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch(launchOptions());const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}/`);
const baseline=await page.evaluate(async bytes=>{try{await(await import('/baseline.js')).readOffice(new Uint8Array(bytes),'fixture.xlsx');return null;}catch(error){return error.message;}},Array.from(fs.readFileSync(fixture)));
assert.match(baseline,/anchors/);console.log('PASS reproduced original anchors crash with normalization disabled');
const allHidden=await page.evaluate(async bytes=>{try{await(await import('/office-browser.js')).readOffice(new Uint8Array(bytes),'fixture.xlsx');return null;}catch(error){return error.message;}},Array.from(fs.readFileSync(path.join(temporary,'all-hidden.xlsx'))));assert.match(allHidden,/没有可见工作表/);
const preservation=await page.evaluate(async bytes=>(await import('/inspect.js')).inspectDrawings(new Uint8Array(bytes)),Array.from(fs.readFileSync(fixture)));
assert.equal(preservation.pictures,1);assert.equal(preservation.charts,1);assert.equal(preservation.images,1);assert(preservation.unchanged.includes('xl/charts/chart1.xml'));assert(preservation.unchanged.some(p=>p.startsWith('xl/media/')));console.log('PASS normalized drawings retain real ExcelJS image and byte-identical chart/media/relations');
for(let i=0;i<files.length;i++){const file=files[i];const model=await page.evaluate(async bytes=>{const {readOffice}=await import('/office-browser.js');return readOffice(new Uint8Array(bytes),'fixture.xlsx');},Array.from(fs.readFileSync(file)));assert.equal(model.kind,'spreadsheet');assert(model.sheets.length>0);if(i===0){assert.equal(model.sheets.length,2);const sheet=model.sheets[0];assert.equal(sheet.name,'城市运营');assert.equal(sheet.images.length,1);assert.match(sheet.images[0].src,/^data:image\/png;base64,/);assert.equal(sheet.images[0].width,12);assert.equal(sheet.images[0].anchor.from.col,5);assert.equal(sheet.images[0].anchor.from.row,1);assert.deepEqual(Buffer.from(sheet.images[0].src.split(',')[1],'base64'),fs.readFileSync(path.join(temporary,'picture.png')));assert.equal(sheet.charts.length,1);assert.equal(sheet.charts[0].type,'bar');assert.deepEqual(sheet.charts[0].series[1].values,[3000,null]);assert.match(sheet.charts[0].warnings.join(' '),/未缓存值不按零/);assert.equal(sheet.rows[2][0],'北京');assert.equal(sheet.rows[2][1],'1200');assert.equal(sheet.rows[2][2],'75.0%');assert.equal(sheet.rows[2][3],'3000');assert.equal(sheet.rows[3][3],'[公式未提供缓存值]');assert(sheet.merges.includes('A1:D1'));assert(sheet.styles[0][0].bold);assert.equal(model.sheets[1].rows[0][0],'保留第二工作表');}if(before[i]==='459dd74e46b237667df59e37d1433ba1d755208b123e7c792f5ec5d6c3dccbff'){
assert.deepEqual(model.sheets.map(s=>s.name),['Visible One','Visible Two']);assert(!JSON.stringify(model).includes('EVA_HIDDEN_SENTINEL'));assert(!JSON.stringify(model).includes('EVA_VERYHIDDEN_SENTINEL'));assert.equal(model.sheets[0].rows[1][1],'[公式未提供缓存值]');console.log('PASS direct source reading excludes hidden/veryHidden sheets without pretending to recalculate formulas');
}if(before[i]==='72d7e4f3b3a4ff6805a8d3f2819f6f5c2aceb86554ac264f6371fea3c246ba62'){
assert.deepEqual(model.sheets.map(s=>s.name),['明细数据','月度汇总','预算对比','可视化看板']);
assert.deepEqual(model.sheets.map(s=>s.rows.flat().filter(v=>v==='[公式未提供缓存值]').length),[0,724,41,5]);
const charts=model.sheets.flatMap(s=>s.charts);assert.deepEqual(charts.map(c=>c.type),['bar','bar','pie','line']);assert.deepEqual(charts.map(c=>[c.anchor.from.col,c.anchor.from.row]),[[7,2],[7,17],[15,2],[15,17]]);assert.deepEqual(charts.map(c=>Math.round(c.anchor.width)),[756,756,680,831]);assert.deepEqual(charts.map(c=>c.title),['月度营收趋势 (万元)','各商圈营收对比 (万元)','业态营收占比','月度关键指标趋势']);
const expected=JSON.parse(execFileSync('python3',['-c',String.raw`
import openpyxl,sys,json,re
w=openpyxl.load_workbook(sys.argv[1],data_only=True)
s=w['可视化看板'];out=[]
for chart in s._charts:
 series=[]
 for item in chart.series:
  reference=item.val.numRef.f
  sheet,area=reference.rsplit('!',1);sheet=sheet.strip("'").replace("''", "'")
  cells=w[sheet][area.replace('$','')]
  series.append([cell.value for row in cells for cell in row])
 out.append(series)
print(json.dumps(out))
`,file],{encoding:'utf8'}));
assert.deepEqual(charts.map(c=>c.series.map(s=>s.values)),expected);assert.equal(charts[3].series.length,4);assert.deepEqual(charts[0].series[0].values,[4580.3,5126.7,4892.1]);
console.log('PASS real dashboard: 4 sheets/4 charts, exact 7 series, 770 uncached formulas explicitly marked');
}assert.equal(hash(fs.readFileSync(file)),before[i]);console.log('PASS Excel preview cells/formulas/styles/merges and immutable input:',file);}assert.deepEqual(errors,[]);console.log('PASS no browser exceptions');}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));assert(path.dirname(temporary)===path.join(root,'tmp'));fs.rmSync(temporary,{recursive:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
