// Mobile rendering for common OOXML charts; source values are never recomputed.
const NS='http://www.w3.org/2000/svg',palette=['#2563eb','#14b8a6','#f59e0b','#e879a8','#8b5cf6','#64748b'];
function svgNode(name,attributes={},text){const n=document.createElementNS(NS,name);for(const [k,v] of Object.entries(attributes))n.setAttribute(k,String(v));if(text!==undefined)n.textContent=text;return n;}
export function renderSheetVisuals(content,entry,scale=1,table=null){
 if(!table&&!entry.charts?.length&&!entry.images?.length)return;
 const gallery=document.createElement('section');gallery.className='sheet-visuals';gallery.setAttribute('aria-label','工作表图表与图片');
 for(const chart of entry.charts||[]){
  const card=document.createElement('article');card.className='chart-card';const title=document.createElement('h3');title.textContent=chart.title||'工作表图表';card.append(title);
  const series=(chart.series||[]).slice(0,16),categories=series.find(s=>s.categories?.length)?.categories||[];
  const count=Math.max(categories.length,...series.map(s=>s.values?.length||0),0),type=chart.supported===false?'unsupported':chart.type;
  const svg=svgNode('svg',{viewBox:'0 0 360 230',role:'img','aria-label':title.textContent});svg.style.width='100%';
  const text=(x,y,value,anchor='middle')=>svg.append(svgNode('text',{x,y,'font-size':10,fill:'#475569','text-anchor':anchor},value));
  const warnings=[...(chart.warnings||[])];const values=series.flatMap(s=>s.values||[]).filter(v=>typeof v==='number'&&Number.isFinite(v));
  const valid=v=>typeof v==='number'&&Number.isFinite(v);
  if(!['bar','line','pie'].includes(type)||!values.length||!count){warnings.push(!values.length?'图表暂无已计算数据；未缓存值不会按零显示':'此图表类型尚未支持，请查看原文件');}
  else if(type==='pie'){
   const row=series[0],sum=(row.values||[]).filter(v=>valid(v)&&v>0).reduce((a,b)=>a+b,0);let angle=-Math.PI/2;
   if(!sum)warnings.push('饼图没有可显示的正数数据');
   else (row.values||[]).forEach((value,i)=>{if(!valid(value)||value<=0)return;const next=angle+value/sum*Math.PI*2,color=palette[i%palette.length];if(value===sum)svg.append(svgNode('circle',{cx:112,cy:108,r:82,fill:color}));else svg.append(svgNode('path',{d:`M112 108 L${112+82*Math.cos(angle)} ${108+82*Math.sin(angle)} A82 82 0 ${next-angle>Math.PI?1:0} 1 ${112+82*Math.cos(next)} ${108+82*Math.sin(next)} Z`,fill:color}));angle=next;if(i<10){svg.append(svgNode('rect',{x:216,y:22+i*19,width:9,height:9,fill:color}));text(232,31+i*19,String(categories[i]||i+1).slice(0,12)+' '+Math.round(value/sum*100)+'%','start');}});
  }else{
   const min=Math.min(0,...values),max=Math.max(0,...values),span=max-min||1,y=v=>190-(v-min)/span*160,left=44,width=302;
   for(let i=0;i<=4;i++){const v=min+span*i/4;svg.append(svgNode('line',{x1:left,y1:y(v),x2:350,y2:y(v),stroke:'#e2e8f0'}));text(left-5,y(v)+3,Number(v.toPrecision(3)).toLocaleString(),'end');}
   const step=width/count;
   for(let i=0;i<count;i++)if(count<8||i%Math.ceil(count/6)===0){const label=String(categories[i]||i+1),x=left+(i+.5)*step;const t=svgNode('text',{x,y:208,'font-size':9,fill:'#475569','text-anchor':'middle'});t.append(svgNode('title',{},label));const chunk=/[\u3400-\u9fff]/.test(label)?6:12;for(let j=0;j<Math.min(label.length,12);j+=chunk)t.append(svgNode('tspan',{x,dy:j?11:0},label.slice(j,j+chunk)));svg.append(t);}
   series.forEach((row,s)=>{const color=palette[s%palette.length];let segment=[];const flush=()=>{if(segment.length)svg.append(svgNode('polyline',{points:segment.join(' '),fill:'none',stroke:color,'stroke-width':2}));segment=[];};(row.values||[]).forEach((value,i)=>{if(!valid(value)){flush();return;}const x=left+(i+.5)*step;if(type==='bar'){const w=Math.max(1,step*.8/series.length);svg.append(svgNode('rect',{x:left+i*step+step*.1+s*w,y:Math.min(y(0),y(value)),width:w*.9,height:Math.max(1,Math.abs(y(value)-y(0))),fill:color}));}else{segment.push(x+','+y(value));svg.append(svgNode('circle',{cx:x,cy:y(value),r:2.5,fill:color}));}});flush();});
  }
  if(values.length&&['bar','line','pie'].includes(type))card.append(svg);
  if(type!=='pie'){const legend=document.createElement('div');legend.className='chart-legend';series.forEach((s,i)=>{const label=document.createElement('span');label.style.color=palette[i%palette.length];label.textContent='● '+(s.name||'系列 '+(i+1));legend.append(label);});card.append(legend);}
  if(series.some(s=>(s.values||[]).some(v=>!valid(v))))warnings.push('部分数据未计算或为空；缺失值未按零绘制');
  for(const warning of new Set(warnings)){const p=document.createElement('p');p.className='chart-note';p.textContent=warning;card.append(p);}
  card._officeAnchor=chart.anchor;gallery.append(card);
 }
 for(const item of entry.images||[]){if(!/^data:image\/(png|jpeg|gif|webp);base64,/i.test(item.src||''))continue;const img=document.createElement('img');img.src=item.src;img.alt='工作表嵌入图片';img.style.maxWidth='100%';img.style.height='auto';img._officeAnchor=item.anchor||{from:{col:item.x||0,row:item.y||0},width:item.width,height:item.height};gallery.append(img);}
 if(!table){content.append(gallery);return;}
 const shell=document.createElement('div'),plane=document.createElement('div');shell.className='sheet-stage';plane.className='sheet-surface';shell.append(plane);plane.append(table);content.append(shell);
 let width=table.offsetWidth,height=table.offsetHeight;
 const header=table.rows[0],rows=table.rows;
 function column(col){const n=Math.max(0,Math.floor(col)),fraction=col-n,cells=header?.cells;if(cells?.[n+1])return cells[n+1].offsetLeft+cells[n+1].offsetWidth*fraction;let x=cells?.[1]?.offsetLeft||44;for(let c=0;c<n;c++)x+=cells?.[c+1]?.offsetWidth||entry.widths?.[c]||entry.defaultColumnWidth||86;return x+(entry.widths?.[n]||entry.defaultColumnWidth||86)*fraction;}
 function row(index){const n=Math.max(0,Math.floor(index)),fraction=index-n;if(rows[n+1])return rows[n+1].offsetTop+rows[n+1].offsetHeight*fraction;let y=rows[1]?.offsetTop||29;for(let r=0;r<n;r++)y+=rows[r+1]?.offsetHeight||(entry.heights?.[r]?entry.heights[r]*4/3:entry.defaultRowHeight||29);return y+(entry.heights?.[n]?entry.heights[n]*4/3:entry.defaultRowHeight||29)*fraction;}
 gallery.classList.add('sheet-overlays');plane.append(gallery);
 for(const child of gallery.children){const a=child._officeAnchor,from=a?.from,to=a?.to;let x,y,w,h;if(from){x=column(from.col||0)+(from.xOffset||0);y=row(from.row||0)+(from.yOffset||0);w=a.width||(to?column(to.col||0)+(to.xOffset||0)-x:480);h=a.height||(to?row(to.row||0)+(to.yOffset||0)-y:300);}else{x=0;y=height+12;w=480;h=300;child.setAttribute('aria-description','原文件未提供可定位锚点');}
  w=Math.max(80,Math.min(10000,w));h=Math.max(80,Math.min(10000,h));child.style.cssText+=';position:absolute;left:'+x+'px;top:'+y+'px;width:'+w+'px;height:'+h+'px;box-sizing:border-box';width=Math.max(width,x+w);height=Math.max(height,y+h);
 }
 plane.style.cssText='position:absolute;left:0;top:0;transform-origin:top left;width:'+width+'px;height:'+height+'px;transform:scale('+scale+')';shell.style.cssText='position:relative;width:'+width*scale+'px;height:'+height*scale+'px';

}

// Reuse chart data rendering inside the presentation's own positioned shape.
export function renderPresentationChart(host,chart,width,height){
 const holder=document.createElement('div');renderSheetVisuals(holder,{charts:[chart||{}]});
 const card=holder.querySelector('.chart-card');if(!card)return;
 host.classList.add('ppt-chart');host.dataset.readerNonText='true';host.setAttribute('aria-label',chart?.title||'幻灯片图表');
 const ratio=Math.max(.05,width/360);card.style.cssText='width:100%;height:100%;box-sizing:border-box;background:white;display:flex;flex-direction:column;border:0;border-radius:0;overflow:hidden;padding:'+8*ratio+'px';
 const heading=card.querySelector('h3');if(!chart?.title)heading.remove();heading.style.cssText='font-size:'+14*ratio+'px;line-height:1.2;margin:0 0 '+4*ratio+'px';
 const svg=card.querySelector('svg');if(svg)svg.setAttribute('aria-label',chart?.title||'幻灯片图表');if(svg)svg.style.cssText='width:100%;height:0;flex:1;min-height:0;min-width:0';
 const legend=card.querySelector('.chart-legend');if(legend)legend.style.cssText='display:flex;flex-wrap:wrap;gap:'+6*ratio+'px;font-size:'+10*ratio+'px';
 for(const note of card.querySelectorAll('.chart-note'))note.style.cssText='font-size:'+10*ratio+'px;line-height:1.2;margin:'+3*ratio+'px 0;color:#745523';
 host.append(card);
}
