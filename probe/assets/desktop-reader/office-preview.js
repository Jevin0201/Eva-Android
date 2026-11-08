import {renderSheetVisuals,renderPresentationChart} from './office-charts.js';
import {setupOffice} from './mobile-layout.js';
export function mountOfficePreview(host, { model, title = model.fileName || "Office 预览" }) {
  const root = host.attachShadow({ mode: "open" }), style = document.createElement("style");
  style.textContent = `:host{height:100%;display:block;color:#202124;font:13px/1.5 system-ui,sans-serif}.viewer{height:100%;display:flex;flex-direction:column;background:#f4f5f7}.toolbar{display:flex;align-items:center;gap:8px;padding:8px;background:white;border-bottom:1px solid #dadce0}.toolbar strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}button,select{font:inherit;padding:4px 8px;border:1px solid #dadce0;border-radius:6px;background:white;color:inherit}button:disabled{opacity:.4}.content{overflow:auto;flex:1;padding:16px}.warning{padding:5px 10px;font-size:11px;background:#fff8df}.sheet{border-collapse:collapse;background:white;transform-origin:top left}td,th{border:1px solid #dfe1e5;padding:4px 8px;white-space:pre-wrap;min-width:70px;max-width:400px;overflow-wrap:anywhere}th{background:#f1f3f4;position:sticky;top:0;font-weight:500}th.row{min-width:28px}.slide{position:relative;background:white;box-shadow:0 2px 8px #0002;overflow:hidden;flex:none}.slide>*{position:absolute;box-sizing:border-box;white-space:pre-wrap;overflow:hidden}.slide img{object-fit:contain}.empty{padding:30px;text-align:center;color:#666}`;
  root.append(style);
  style.textContent += `:host{color:var(--text,#202124)}.viewer{background:var(--bg,#f4f5f7)}.toolbar{background:var(--panel,var(--bg,#fff));border-color:var(--border,#dadce0)}button,select{background:var(--panel,var(--bg,#fff));border-color:var(--border,#dadce0)}.sheet{color:#202124}.warning{color:#5a4200}.content{min-height:0;box-sizing:border-box}`;
  style.textContent += `.toolbar{flex-wrap:wrap}.toolbar select{min-width:0;max-width:min(100%,240px)}.toolbar button{flex-shrink:0}`;
  const viewer = document.createElement("section");
  viewer.className = "viewer";
  const bar = document.createElement("div");
  bar.className = "toolbar";
  bar.setAttribute("aria-label", title + "阅读控制");
  const select = document.createElement("select");
  select.setAttribute("aria-label", model.kind === "presentation" ? "幻灯片" : "工作表");
  const entries = model.kind === "presentation" ? model.slides : model.sheets;
  entries.forEach((entry, i) => {
    const option = document.createElement("option");
    option.value = String(i);
    option.textContent = model.kind === "presentation" ? "幻灯片 " + (i + 1) : entry.name;
    select.append(option);
  });
  bar.append(select);
  const minus = document.createElement("button"), plus = document.createElement("button"), zoom = document.createElement("span");
  minus.textContent = "−";
  minus.setAttribute("aria-label", "缩小");
  plus.textContent = "+";
  plus.setAttribute("aria-label", "放大");
  bar.append(minus, zoom, plus);
  style.textContent+=`.search{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:6px 8px;border-bottom:1px solid var(--border,#ddd)}.search input{min-width:80px;flex:1;width:100px;font:inherit;padding:5px 7px;border:1px solid var(--border,#ccc);border-radius:5px;background:var(--panel,var(--bg,#fff));color:inherit}.search output{font-size:11px;min-width:50px}.office-match{outline:2px solid #d1a800;outline-offset:-2px}.office-match-active{outline:3px solid #2674de;outline-offset:-3px}.pages{display:flex;flex:1;min-height:0}.thumbnails{width:140px;flex:none;overflow:auto;border-right:1px solid var(--border,#ddd);padding:6px;box-sizing:border-box}.thumbnails button{display:block;width:100%;padding:5px;margin-bottom:6px;text-align:center}.thumbnails button[aria-current=true]{outline:2px solid #2674de;outline-offset:-2px}.thumbnails .slide{pointer-events:none;box-shadow:none}.thumbnails .slide>*{pointer-events:none}.content{min-width:0}.thumb-number{display:block;font-size:11px;margin-top:3px}@media(max-width:600px){.thumbnails{width:90px;padding:4px}.thumbnails button{padding:3px}}`;
  const searchBar=document.createElement('div');searchBar.className='search';searchBar.setAttribute('role','search');
  const query=document.createElement('input');query.type='search';query.placeholder='搜索文件内容';query.setAttribute('aria-label','搜索文件内容');query.title='按单元格或文本框定位匹配项';
  const previous=document.createElement('button'),next=document.createElement('button'),status=document.createElement('output');previous.textContent='↑';previous.setAttribute('aria-label','上一个匹配');next.textContent='↓';next.setAttribute('aria-label','下一个匹配');status.setAttribute('aria-live','polite');searchBar.append(query,previous,next,status);
  const content = document.createElement("div");
  content.className = "content";
  content.setAttribute("role", "region");
  content.setAttribute("aria-label", "文件预览");
  content.tabIndex=0;
  const focusContent=event=>{if(!event.target.closest?.('input,select,button,a'))content.focus({preventScroll:true});};
  content.addEventListener('pointerdown',focusContent);
  style.textContent+=`.thumbnail-frame{position:relative;width:100%;overflow:hidden}.thumbnail-frame>.slide{position:absolute;left:0;top:0;transform-origin:top left}`;
  const pages=document.createElement('div');pages.className='pages';
  const thumbnails=model.kind==='presentation'?document.createElement('nav'):null;
  if(thumbnails){thumbnails.className='thumbnails';thumbnails.setAttribute('aria-label','幻灯片缩略导航');pages.append(thumbnails);}
  pages.append(content);viewer.append(bar,searchBar,pages);
  for (const warning of model.warnings || []) {
    const note = document.createElement("div");
    note.className = "warning";
    note.textContent = warning;
    viewer.append(note);
  }
  root.append(viewer);
  let scale = 1, disposed = false,searchTimer=null,matches=[],matchIndex=-1;
  const searchEntries=[];
  const address=value=>{const match=/^([A-Z]+)(\d+)$/.exec(value);if(!match)return null;let col=0;for(const c of match[1])col=col*26+c.charCodeAt(0)-64;return {r:Number(match[2])-1,c:col-1};};
  entries.forEach((entry,page)=>{
    if(model.kind==='presentation')entry.elements.forEach((item,index)=>{if(item.type!=='image'&&item.text)searchEntries.push({page,key:String(index),text:item.text.toLocaleLowerCase()});});
    else{const merged=[];for(const range of entry.merges||[]){const [a,b]=range.split(':').map(address);if(a&&b)merged.push({a,b});}entry.rows.forEach((row,r)=>row.forEach((value,c)=>{if(merged.some(({a,b})=>r>=a.r&&r<=b.r&&c>=a.c&&c<=b.c&&(r!==a.r||c!==a.c)))return;if(value)searchEntries.push({page,key:r+':'+c,text:String(value).toLocaleLowerCase()});}));}
  });
  function locateMatch(){
    if(!matches.length){status.textContent=query.value?'无匹配':'输入内容搜索';previous.disabled=next.disabled=true;return;}
    previous.disabled=next.disabled=false;status.textContent=(matchIndex+1)+' / '+matches.length+' 项';
    const match=matches[matchIndex];select.value=String(match.page);render();
    content.querySelector('.office-match-active')?.scrollIntoView({block:'center',inline:'center'});
  }
  function search(){if(disposed)return;clearTimeout(searchTimer);searchTimer=null;const needle=query.value.toLocaleLowerCase();matches=needle?searchEntries.filter(entry=>entry.text.includes(needle)):[];matchIndex=matches.length?0:-1;if(matches.length)locateMatch();else{render();status.textContent=needle?'无匹配':'输入内容搜索';previous.disabled=next.disabled=true;}}
  function moveMatch(delta){if(!matches.length)return;matchIndex=(matchIndex+delta+matches.length)%matches.length;locateMatch();}
  query.oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(search,80);};previous.onclick=()=>moveMatch(-1);next.onclick=()=>moveMatch(1);
  function keys(event){if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='f'&&!event.altKey){event.preventDefault();event.stopPropagation();query.focus();query.select();}else if(event.target===query&&event.key==='Enter'){event.preventDefault();if(searchTimer)search();else moveMatch(event.shiftKey?-1:1);}else if(event.target===query&&event.key==='Escape'){event.preventDefault();query.value='';search();content.focus();}}
  root.addEventListener('keydown',keys,true);status.textContent='输入内容搜索';previous.disabled=next.disabled=true;
  function createSlide(entry,fitted) {
      const slide = document.createElement("div");
      slide.className = "slide";
      slide.style.width = fitted + "px";
      slide.style.height = fitted * model.height / model.width + "px";
      slide.style.backgroundColor = entry.background || "#ffffff";
      entry.elements.forEach((item, index) => {
        const node = document.createElement(item.type === "image" ? "img" : "div");
        node.dataset.officeElement=String(index);
        node.style.left = item.x * 100 + "%";
        node.style.top = item.y * 100 + "%";
        node.style.width = item.w * 100 + "%";
        node.style.height = item.h * 100 + "%";
        if(item.type === "chart"){renderPresentationChart(node,item.chart,item.w*fitted,item.h*fitted*model.height/model.width);node.dataset.readerNonText="true";}else if (item.type === "image") {
          node.src = item.src;
          node.alt = "幻灯片图片";
        } else {
          node.textContent = item.text;
          node.style.fontSize = item.fontSize * fitted / (model.width / 914400 * 72) + "px";
          node.style.fontWeight = item.bold ? "700" : "400";
          node.style.color = item.color;
          if (item.fill) node.style.backgroundColor = item.fill;
          if (item.border) node.style.border = "1px solid " + item.border;
          if (item.geometry === "ellipse") node.style.borderRadius = "50%";
          if (item.geometry === "roundRect") node.style.borderRadius = "10%";
          if (item.geometry === "triangle") node.style.clipPath = "polygon(50% 0,100% 100%,0 100%)";
          if (item.rotate) node.style.transform = "rotate(" + item.rotate + "deg)";
          node.style.textAlign = { ctr: "center", r: "right", l: "left" }[item.align] || "left";
        }
        slide.append(node);
      });
      return slide;
  }
  function render() {
    if (disposed) return;
    content.replaceChildren();
    zoom.textContent = Math.round(scale * 100) + "%";
    minus.disabled = scale <= 0.5;
    plus.disabled = scale >= 2;
    if (!entries.length) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "文件中没有可显示的内容";
      content.append(empty);
      return;
    }
    const entry = entries[Number(select.value) || 0];
    if(thumbnails)thumbnails.querySelectorAll('[data-slide-index]').forEach(button=>button.setAttribute('aria-current',String(Number(button.dataset.slideIndex)===Number(select.value||0))));
    if (model.kind === "spreadsheet") {
      const table = document.createElement("table");
      table.className = "sheet";
      table.style.zoom = "1";
      const width = Math.max(0, ...entry.rows.map((r) => r.length)), spans = /* @__PURE__ */ new Map(), hidden = /* @__PURE__ */ new Set();
      const position = (address) => {
        const m = /^([A-Z]+)(\d+)$/.exec(address);
        if (!m) return null;
        let c = 0;
        for (const letter of m[1]) c = c * 26 + letter.charCodeAt(0) - 64;
        return { r: Number(m[2]) - 1, c: c - 1 };
      };
      for (const range of entry.merges || []) {
        const [a, b] = range.split(":").map(position);
        if (!a || !b || b.r >= entry.rows.length || b.c >= width) continue;
        spans.set(a.r + ":" + a.c, { rows: b.r - a.r + 1, cols: b.c - a.c + 1 });
        for (let r = a.r; r <= b.r; r++) for (let c = a.c; c <= b.c; c++) if (r !== a.r || c !== a.c) hidden.add(r + ":" + c);
      }
      const header = document.createElement("tr");
      header.append(document.createElement("th"));
      for (let c = 0; c < width; c++) {
        const th = document.createElement("th");
        let n = c + 1, label = "";
        while (n) {
          n--;
          label = String.fromCharCode(65 + n % 26) + label;
          n = Math.floor(n / 26);
        }
        th.textContent = label;
        if (entry.widths?.[c]) th.style.minWidth = entry.widths[c] + "px";
        header.append(th);
      }
      table.append(header);
      entry.rows.forEach((cells, i) => {
        const tr = document.createElement("tr"), row = document.createElement("th");
        row.className = "row";
        row.textContent = String(i + 1);
        tr.append(row);
        if (entry.heights?.[i]) tr.style.height = entry.heights[i] * 4 / 3 + "px";
        for (let c = 0; c < width; c++) {
          if (hidden.has(i + ":" + c)) continue;
          const td = document.createElement("td");
          td.textContent = cells[c] ?? "";
          td.dataset.officeCell=i+":"+c;
          const span = spans.get(i + ":" + c);
          if (span) {
            td.rowSpan = span.rows;
            td.colSpan = span.cols;
          }
          const style2 = entry.styles?.[i]?.[c];
          if (style2) {
            td.style.fontWeight = style2.bold ? "700" : "400";
            td.style.fontStyle = style2.italic ? "italic" : "normal";
            if (style2.size) td.style.fontSize = Math.max(6, Math.min(72, style2.size)) * 4 / 3 + "px";
            if (style2.color) td.style.color = style2.color;
            if (style2.fill) td.style.backgroundColor = style2.fill;
            if (["left", "center", "right"].includes(style2.align)) td.style.textAlign = style2.align;
            td.style.whiteSpace = style2.wrap ? "pre-wrap" : "pre";
          }
          tr.append(td);
        }
        table.append(tr);
      });
      renderSheetVisuals(content,entry,scale,table);
    } else {
      const fitted = Math.min(960, Math.max(100, content.clientWidth - 32)) * scale;
      const stableSlide=createSlide(entry,fitted);stableSlide.dataset.renderScale=String(scale);content.append(stableSlide);if(entry.unpositionedElements?.length){const note=document.createElement('aside');note.className='empty';note.textContent='以下内容无法恢复原布局位置：'+entry.unpositionedElements.map(item=>item.text||item.chart?.title||'未定位对象').join('；');content.append(note);}
    }
    const selected=Number(select.value)||0,match=matches[matchIndex],key=model.kind==='presentation'?'officeElement':'officeCell';
    const matchedKeys=new Set(matches.filter(m=>m.page===selected).map(m=>m.key));
    content.querySelectorAll(model.kind==='presentation'?'[data-office-element]':'[data-office-cell]').forEach(node=>{node.classList.toggle('office-match',matchedKeys.has(node.dataset[key]));node.classList.toggle('office-match-active',match?.page===selected&&node.dataset[key]===match.key);});
  }
  select.onchange = () => {
    content.scrollTop = 0;
    content.scrollLeft = 0;
    render();
  };
  if(thumbnails){entries.forEach((entry,index)=>{const button=document.createElement('button');button.type='button';button.dataset.slideIndex=String(index);button.setAttribute('aria-label','转到幻灯片 '+(index+1));const thumb=createSlide(entry,112);thumb.setAttribute('aria-hidden','true');const frame=document.createElement('div');frame.className='thumbnail-frame';frame.style.aspectRatio=model.width+'/'+model.height;frame.append(thumb);const number=document.createElement('span');number.className='thumb-number';number.textContent=String(index+1);button.append(frame,number);button.onclick=()=>{select.value=String(index);select.onchange();};thumbnails.append(button);});thumbnails.onkeydown=event=>{const button=event.target.closest?.('[data-slide-index]');if(!button)return;const at=Number(button.dataset.slideIndex);let index=event.key==='ArrowDown'?Math.min(entries.length-1,at+1):event.key==='ArrowUp'?Math.max(0,at-1):event.key==='Home'?0:event.key==='End'?entries.length-1:null;if(index===null)return;event.preventDefault();const target=thumbnails.querySelector('[data-slide-index="'+index+'"]');target?.click();target?.focus();};}
  function updateContentScale(value){
    scale=Math.max(.5,Math.min(2,value));
    const shell=content.querySelector('.sheet-stage'),plane=content.querySelector('.sheet-surface');
    if(shell&&plane){plane.style.transform='scale('+scale+')';shell.style.width=parseFloat(plane.style.width)*scale+'px';shell.style.height=parseFloat(plane.style.height)*scale+'px';}
    const slide=content.querySelector(':scope > .slide');if(slide)slide.style.zoom=String(scale/Number(slide.dataset.renderScale||1));
    zoom.textContent=Math.round(scale*100)+'%';minus.disabled=scale<=.5;plus.disabled=scale>=2;
  }
  minus.onclick = () => {
    updateContentScale(Math.max(0.5, Math.round((scale - 0.1) * 10) / 10));
  };
  plus.onclick = () => {
    updateContentScale(Math.min(2, Math.round((scale + 0.1) * 10) / 10));
  };
  render();
  function fitThumbnails(){if(thumbnails)thumbnails.querySelectorAll('.thumbnail-frame').forEach(frame=>{frame.firstElementChild.style.transform='scale('+frame.clientWidth/112+')';});}
  fitThumbnails();
  const resize = new ResizeObserver(() => {
    if (model.kind === "presentation"&&!content.dataset.readerPinching){render();fitThumbnails();}
  });
  resize.observe(content);
  const disposeMobile=setupOffice({root,style,bar,select,minus,plus,zoom,searchBar,query,thumbnails,content,getScale:()=>scale,setScale:updateContentScale});
  return () => {
    disposeMobile();disposed = true;
    clearTimeout(searchTimer);root.removeEventListener('keydown',keys,true);query.oninput=previous.onclick=next.onclick=null;if(thumbnails)thumbnails.onkeydown=null;
    content.removeEventListener('pointerdown',focusContent);
    resize.disconnect();
    select.onchange = minus.onclick = plus.onclick = null;
    viewer.remove();
    style.remove();
  };
}
