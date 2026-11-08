'use strict';
// REA: chatgpt-markdown-view / markdown-c48b6327bb53.css. Parse nodes before
// formatting: emphasis, code, lists and tables cannot safely be regex replacements.
globalThis.cloudMarkdown=(()=>{
 const parser=globalThis.markdownit({html:false,linkify:true,breaks:true,typographer:false});
 const escape=parser.utils.escapeHtml;
 // Native Codex links resolve only through the existing local-file policy.
 // This rule is inactive for GPT messages and never runs inside fenced/inline code.
 parser.inline.ruler.before('link','codex_local_file',(state,silent)=>{
  if(!state.env.codex||typeof transcriptLink!=='function')return false;
  const match=state.src.slice(state.pos).match(/^(!?)\[([^\]\n]+)\]\((<[^>\n]+>|(?:[^()\n]|\([^()\n]*\))+)\)/);if(!match)return false;
  const target=transcriptLink(match[3]);if(target?.kind!=='local')return false;
  if(!silent){const token=state.push('html_inline','',0);token.content=match[1]?'<img src="'+escape(mediaUrl(target.path))+'" alt="'+escape(match[2])+'" data-zoom="'+escape(mediaUrl(target.path))+'" loading="lazy">':'<button class="inline-file-link" data-local-path="'+escape(target.path)+'"'+(target.line?' data-file-line="'+target.line+'"':'')+' title="'+escape(target.path)+'">'+ic(/\.(zip|7z|tar|gz)$/i.test(target.path)?'folder':'doc')+parser.renderInline(match[2],state.env)+'</button>';}
  state.pos+=match[0].length;return true;
 });
 parser.inline.ruler.before('html_inline','cloud_br',(state,silent)=>{const match=state.src.slice(state.pos).match(/^<br\s*\/?>/i);if(!match)return false;if(!silent)state.push('hardbreak','br',0);state.pos+=match[0].length;return true;});
 function formula(source,display){try{return katex.renderToString(source,{displayMode:display,throwOnError:false,trust:false,strict:'ignore',maxExpand:1000,maxSize:10});}catch{return '<code>'+escape(source)+'</code>';}}
 parser.inline.ruler.before('escape','cloud_math',(state,silent)=>{
  const start=state.pos,src=state.src,open=src.startsWith('\\(',start)?'\\(':src[start]==='$'&&src[start+1]!=='$'?'$':null;
  if(!open||open==='$'&&(/\s/.test(src[start+1]||'')||src[start-1]==='\\'))return false;
  const close=open==='$'?'$':'\\)';let end=src.indexOf(close,start+open.length);
  while(end>=0&&src[end-1]==='\\'&&close==='$')end=src.indexOf(close,end+1);
  if(end<0||end-start>20000||src.slice(start,end).includes('\n')||open==='$'&&(/\s/.test(src[end-1])||/\d/.test(src[end+1]||'')))return false;
  if(!silent){const token=state.push('cloud_math','math',0);token.content=src.slice(start+open.length,end);}state.pos=end+close.length;return true;
 });
 parser.block.ruler.before('fence','cloud_math_block',(state,start,end,silent)=>{
  const line=state.src.slice(state.bMarks[start]+state.tShift[start],state.eMarks[start]);
  const open=line.startsWith('$$')?'$$':line.startsWith('\\[')?'\\[':null;if(!open)return false;
  const close=open==='$$'?'$$':'\\]';let text=line.slice(open.length),next=start+1,found=false;
  const finish=text.indexOf(close);if(finish>=0){if(text.slice(finish+close.length).trim())return false;text=text.slice(0,finish);found=true;}
  while(!found&&next<end&&text.length<20000){const value=state.src.slice(state.bMarks[next]+state.tShift[next],state.eMarks[next]);next++;const at=value.indexOf(close);if(at>=0){if(value.slice(at+close.length).trim())return false;text+='\n'+value.slice(0,at);found=true;}else text+='\n'+value;}
  if(!found)return false;if(silent)return true;const token=state.push('cloud_math_block','math',0);token.content=text;token.map=[start,next];state.line=next;return true;
 },{alt:['paragraph','reference','blockquote','list']});
 parser.renderer.rules.cloud_math=(tokens,i)=>formula(tokens[i].content,false);
 parser.renderer.rules.cloud_math_block=(tokens,i)=>'<div class="cloud-math-block">'+formula(tokens[i].content,true)+'</div>\n';
 // Shipped writing-block-directive-renderer reads title/variant/body separately.
 parser.block.ruler.before('fence','cloud_writing',(state,start,end,silent)=>{
  const line=state.src.slice(state.bMarks[start]+state.tShift[start],state.eMarks[start]);
  const match=line.match(/^:::writing\s*\{([^\n]*)\}\s*$/);if(!match)return false;if(silent)return true;
  let next=start+1;while(next<end&&state.src.slice(state.bMarks[next],state.eMarks[next]).trim()!==':::')next++;
  const token=state.push('cloud_writing','section',0);token.content=state.getLines(start+1,next,state.blkIndent,false);token.meta={title:match[1].match(/\btitle="([^"]*)"/)?.[1]||'',variant:match[1].match(/\bvariant="([^"]*)"/)?.[1]||'standard'};token.map=[start,Math.min(next+1,end)];state.line=Math.min(next+1,end);return true;
 },{alt:['paragraph','reference','blockquote','list']});
 parser.renderer.rules.cloud_writing=(tokens,i,options,env)=>{const t=tokens[i];return '<section class="cloud-writing-block" data-writing-variant="'+escape(t.meta.variant)+'"><header><span>'+escape(t.meta.title)+'</span><button type="button" class="cloud-writing-copy" aria-label="复制文本">复制</button></header><div class="cloud-writing-content">'+parser.render(t.content,env)+'</div></section>\n';};
 parser.renderer.rules.fence=(tokens,i)=>{const t=tokens[i],lang=t.info.trim().split(/\s+/)[0];return '<div class="cloud-code-block"'+(lang?' data-language="'+escape(lang)+'"':'')+'><button type="button" class="cloud-code-copy" aria-label="复制代码" title="复制代码">复制</button><pre><code>'+escape(t.content)+'</code></pre></div>\n';};
 parser.renderer.rules.code_block=(tokens,i)=>'<div class="cloud-code-block"><button type="button" class="cloud-code-copy" aria-label="复制代码">复制</button><pre><code>'+escape(tokens[i].content)+'</code></pre></div>\n';
 parser.core.ruler.after('inline','cloud_tasks',state=>{
  const stack=[];
  state.tokens.forEach((t,i)=>{if(t.type==='bullet_list_open'||t.type==='ordered_list_open')stack.push(t);if(t.type==='bullet_list_close'||t.type==='ordered_list_close')stack.pop();
   if(t.type!=='inline'||state.tokens[i-1]?.type!=='paragraph_open'||state.tokens[i-2]?.type!=='list_item_open'||!t.children?.length)return;
   const first=t.children[0],match=first.type==='text'&&first.content.match(/^\[([ xX])\]\s/);if(!match)return;
   first.content=first.content.slice(match[0].length);const checkbox=new state.Token('html_inline','',0);checkbox.content='<input type="checkbox" disabled'+(match[1].toLowerCase()==='x'?' checked':'')+' aria-label="'+(match[1].toLowerCase()==='x'?'已完成':'未完成')+'">';t.children.unshift(checkbox);stack.at(-1)?.attrJoin('class','contains-task-list');
  });
 });
 const tableOpen=parser.renderer.rules.table_open||((tokens,i,options,env,self)=>self.renderToken(tokens,i,options));
 parser.renderer.rules.table_open=(...args)=>'<div class="cloud-table-scroll" tabindex="0" role="region" aria-label="表格">'+tableOpen(...args);
 parser.renderer.rules.table_close=()=>'</table></div>\n';
 const roots=new WeakSet();
 function hydrate(root){if(roots.has(root))return;roots.add(root);root.addEventListener('click',async event=>{const button=event.target.closest('.cloud-code-copy,.cloud-writing-copy');if(!button)return;try{const content=button.classList.contains('cloud-writing-copy')?button.closest('.cloud-writing-block').querySelector('.cloud-writing-content').innerText:button.parentElement.querySelector('code').textContent;await navigator.clipboard.writeText(content);button.textContent='已复制';setTimeout(()=>{if(button.isConnected)button.textContent='复制';},1500);}catch{button.textContent='复制失败，请重试';}});}
 const cache=new Map();let cacheSize=0;
 function render(source,env={}){source=String(source??'');const cacheKey=(env.codex?'codex:':'chatgpt:')+source;if(cache.has(cacheKey)){const value=cache.get(cacheKey);cache.delete(cacheKey);cache.set(cacheKey,value);return value;}
  const html=parser.render(source,env),size=cacheKey.length+html.length;if(size<=1024*1024){cache.set(cacheKey,html);cacheSize+=size;while(cache.size>200||cacheSize>4*1024*1024){const key=cache.keys().next().value;cacheSize-=key.length+cache.get(key).length;cache.delete(key);}}return html;
 }
 return {render,renderNative:source=>render(source,{codex:true}),hydrate};
})();
