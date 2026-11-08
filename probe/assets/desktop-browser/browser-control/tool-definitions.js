'use strict';
const properties={editorAction:{type:"string",enum:["read","replace","insert"]},rowOffset:{type:"integer",minimum:0},columnOffset:{type:"integer",minimum:0},maxRows:{type:"integer",minimum:1,maximum:100},maxColumns:{type:"integer",minimum:1,maximum:50},maxCellChars:{type:"integer",minimum:1,maximum:2000},tabId:{type:'string'},ref:{type:'string'},selector:{type:'string'},url:{type:'string'},newTab:{type:'boolean'},interaction:{type:'string',enum:['click','double_click','hover','type','select','check','uncheck']},text:{type:'string'},option:{type:'string'},key:{type:'string'},files:{type:'array',items:{type:'string'}},steps:{type:'array',maxItems:8,items:{type:'object'}},expect:{type:'object'},pointer:{type:'string',enum:['click','double_click','scroll']},x:{type:'number'},y:{type:'number'},deltaX:{type:'number'},deltaY:{type:'number'},maxTextChars:{type:'integer'},maxRefs:{type:'integer'},textOffset:{type:'integer'},refOffset:{type:'integer'},maxResults:{type:'integer'},waitFor:{type:'string',enum:['attached','detached','visible','hidden']},timeoutMs:{type:'integer'},value:{type:'string'},minCount:{type:'integer'},styles:{type:'array',items:{type:'string'}},includeComponents:{type:'boolean'},decision:{type:'string',enum:['status','accept','dismiss']},mode:{type:'string',enum:['status','start','stop','clear']},networkAction:{type:'string',enum:['list','get','body','wait','export','clear','replay','mock','unmock']},recordID:{type:'string'},query:{type:'string'},resourceType:{type:'string'},status:{type:'integer'},parentID:{type:'string'},offset:{type:'integer'},limit:{type:'integer'},direction:{type:'string',enum:['request','response']},jsonPath:{type:'string'},bodyState:{type:'string'},scope:{type:'string',enum:['conversation','background']},method:{type:'string',enum:['GET','POST','PUT','PATCH','DELETE']},headers:{type:'object',additionalProperties:{type:'string'}},body:{type:'string'},maxResponseChars:{type:'integer'}};
properties.includeDocument={type:'boolean',description:'仅在需要提取完整结构化课稿、表格或公式文档时设 true；默认只返回有界 DOM 正文和元素。'};
properties.observationSelector={type:'string',description:'操作后需要读取的页面区域 CSS selector，与操作目标 selector 分开。'};
properties.steps.items={type:'object',properties:{action:{type:'string',enum:['type','select','check','uncheck','click','press_key']},ref:properties.ref,selector:properties.selector,text:properties.text,option:properties.option,key:properties.key,expect:properties.expect},required:['action'],additionalProperties:false};
properties.maxTextChars={type:'integer',minimum:1,maximum:50000};properties.maxRefs={type:'integer',minimum:0,maximum:500};
Object.assign(properties,{
 expression:{type:'string'},args:{},params:{type:'object'},events:{type:'array',items:{type:'string'},maxItems:20},
 cdpAction:{type:'string',enum:['send','subscribe','events','unsubscribe']},
 storageAction:{type:'string',enum:['list','get','set','remove','clear']},storageArea:{type:'string',enum:['local','session','cookies']},keys:{type:'array',items:{type:'string'}},name:{type:'string'},cookies:{type:'array',items:{type:'object'}},origin:{type:'string'},resultID:{type:'string'},operationID:{type:'string'}
});
const definitions=[
 ['browser_evaluate','在当前任务所属页面执行 JavaScript 表达式，定点读取 DOM、页面状态及已观察到的数据。只返回所需字段，避免整个 HTML；写入需有对应业务授权。大结果通过 browser_result 分页。','evaluate',false],
 ['browser_cdp','调用当前任务所属页面的 Chrome DevTools Protocol，支持 DOM、可访问性树、Network、Page 与浏览器上下文能力。cdpAction=send/subscribe/events/unsubscribe；method 为完整 CDP 方法名，params 为实际方法参数。只订阅需要的事件。大结果通过 browser_result 分页。','cdp',false],
 ['browser_storage','读取或按明确授权修改当前页面的 localStorage、sessionStorage 或 Cookie。storageArea=local/session/cookies，storageAction=list/get/set/remove/clear；不输出无关账号数据。大结果通过 browser_result 分页。','storage',false],
 ['browser_result','读取当前任务保留的完整浏览器原结果。br_开头resultID为持久结果，重启后仍可按 offset/maxResponseChars 分页；action=list 按 offset/limit 列出本会话持久结果索引。operationID 查询仍在执行或迟到完成的脚本/CDP/存储结果。不要为取结果重放原操作。','result',true],
 ["browser_table","定点读取 HTML 表格或 ARIA grid，支持按行列分页、表头、合并单元格及虚拟表格行号。用已观察到的 selector/ref 定位表格。只读取已渲染行，虚拟滚动区域需要滚动后重读；不会把当前可见行误报为完整表格。","table",true],
 ["browser_editor","读取、替换或在光标处插入纯文本，目标必须是真实 input、textarea 或 contenteditable 编辑区域，支持 iframe 和开放 Shadow DOM。editorAction=read/replace/insert，默认只读。通过浏览器输入事件操作并读回验证；verified 仅代表编辑区域内容，不代表服务器已保存。先观察真实编辑节点；未验证成功时不要盲目重发。画布或代码编辑器外壳不能直接填充。","editor",false],
 ['browser_tabs','列出、选择或关闭浏览器的标签。先确认 tabId，不按标题猜测。','tabs',false],
 ['browser_open','在应用界面实际可见的浏览器标签打开 HTTP/HTTPS 网页；复用当前会话标签，newTab=true 才新建；直接返回页面 DOM 正文、refs 和分页状态，可用 maxTextChars/maxRefs 调整。','open_tab',false],
 ['browser_snapshot','读取 DOM 正文、iframe/open Shadow DOM 元素与新鲜引用，不生成截图。支持 selector 与分页定点读取；结构化文档块需 includeDocument=true。open/act 已返回所需正文和 refs 时直接使用，不重复 snapshot。','snapshot',true],
 ['browser_inspect','按明确 CSS 选择器检查控件、可见性、遮挡、几何、样式和状态，支持等待与断言。','inspect',true],
 ['browser_act','使用最新 ref 操作网页：点击、输入、选择、勾选、悬停。steps 支持最多8步连续操作；导航、弹窗、下载或取消后停止。返回更新后的 DOM 正文、refs、changes，直接检查这些字段；不要只读取 execution 或丢弃结果再调用 snapshot。observationSelector/maxTextChars/maxRefs 控制操作后读取范围。','act',false],
 ['browser_key','向当前网页发送按键，返回实际状态。','press_key',false],
 ['browser_pointer','语义控件不能覆盖时执行坐标点击或实际滚轮滚动；优先使用snapshot给出的坐标。','pointer',false],
 ['browser_upload','上传用户明确指定的绝对文件路径。使用已捕获的文件选择请求；没有请求时，先点击网页真实上传按钮或关联input，再调用上传。无需点击系统文件选择框；selectionConfirmed表示捕获的文件选择请求已接受文件，网站立即清空或替换控件不作为失败条件。uploadStatus=not-verified不代表服务器上传成功，须检查网页结果或上传请求响应；状态未知时不要盲目重复上传。','upload',false],
 ['browser_dialog','查看网页对话框状态。默认后台关闭普通提示、取消确认/输入、保留当前页处理离开确认，dialogNotice返回已处理结果；已关闭弹窗不要重复处理或自动重试肯定操作。可按明确授权接受或取消仍在等待的对话框。文件选择使用browser_upload，不能将系统选择框当作网页按钮。','dialog',false],
 ['browser_downloads','核对当前标签真实下载文件的完成/失败状态和实际路径。','downloads',true],
 ['browser_debug','查看Console和Network，mode控制捕获；networkAction可检索请求、读取正文、条件等待、导出HAR和事件。优先检索已捕获的请求和响应正文，用接口读回核对页面状态。重放/Mock仅在用户明确要求时使用。抓包按当前会话隔离。','debug',false],
 ['browser_request','仅对已经从 DOM/Network 观察到的接口，在真实网页登录会话内发起请求。读取内容优先 GET；写请求须有对应业务授权，不能猜接口、认证或绕过验证码。','request',false],
 ['browser_screenshot','将当前网页截图保存为项目内证据文件；普通文本与表单问题优先snapshot/inspect。','screenshot',true]
];
const fields={
 browser_evaluate:'tabId expression args maxResponseChars timeoutMs',browser_cdp:'tabId cdpAction method params events maxResponseChars timeoutMs offset limit',browser_storage:'tabId storageArea storageAction keys name value cookies origin maxResponseChars timeoutMs',browser_result:'resultID operationID offset maxResponseChars limit',
 browser_tabs:'tabId', browser_open:'tabId url newTab maxTextChars maxRefs observationSelector', browser_snapshot:'tabId selector maxTextChars maxRefs textOffset refOffset includeDocument',
 browser_act:'tabId ref selector interaction text option steps expect timeoutMs observationSelector maxTextChars maxRefs', browser_key:'tabId key expect', browser_pointer:'tabId pointer x y deltaX deltaY expect',
 browser_inspect:'tabId selector ref waitFor timeoutMs expect value minCount styles includeComponents maxResults',
 browser_table:'tabId selector ref rowOffset columnOffset maxRows maxColumns maxCellChars',browser_editor:'tabId ref selector editorAction text timeoutMs',
 browser_upload:'tabId files',browser_dialog:'tabId decision text',browser_downloads:'tabId',
 browser_debug:'tabId mode networkAction recordID query resourceType status parentID offset limit direction jsonPath bodyState scope method url headers body maxResponseChars timeoutMs minCount maxResults maxTextChars',
 browser_request:'tabId url method headers body maxResponseChars',browser_screenshot:'tabId'
};
const toolProperties=name=>Object.fromEntries(fields[name].split(' ').map(key=>[key,properties[key]]));
const tools=definitions.map(([name,description,action,readOnlyHint])=>({name,description:description+(name==='browser_dialog'?' 连续弹窗使用 status 返回的 dialogId，避免操作已更新的弹窗。浏览器无法关闭原生弹窗时传 native=true；返回 requiresComputerUse 后接续本会话 cua_repl 工具，处理完必须重新观察并确认弹窗消失。':''),inputSchema:{type:'object',properties:{...toolProperties(name),...(name==='browser_cdp'?{method:{type:'string'}}:{}),...(name==='browser_result'?{action:{type:'string',enum:['read','list']}}:{}),...(name==='browser_dialog'?{native:{type:'boolean'},dialogId:{type:'string'}}:{}),...(name==='browser_tabs'?{action:{type:'string',enum:['list','select','close']}}:{})},additionalProperties:false,...(name==='browser_upload'?{required:['files']}:{})},annotations:{readOnlyHint,openWorldHint:true}}));
function command(name,args){const item=definitions.find(d=>d[0]===name);if(!item)throw Error('未知浏览器工具');let action=item[2];if(name==='browser_tabs')action=args.action==='select'?'select_tab':args.action==='close'?'close_tab':'tabs';if(name==='browser_act'&&args.steps)action='batch';if(name==='browser_debug'&&args.networkAction)action='network';return {...(name==='browser_snapshot'?{includeDocument:false}:{}),...args,...(name==='browser_result'&&args.action?{resultAction:args.action}:{}),action};}
module.exports={tools,command};
