# 正式 Mac Codex 消息布局与 Eva 复用边界

2026-11-05，只读 `/Applications/ChatGPT.app/Contents/Resources/app.asar`，版本26.1029.61003，SHA256 `0c951258b7ab381ec601045ffb02159e53f424548dda18e6a4dcfd126557383b`。本轮没有操作正式应用界面，没有改变桌面用户数据；CUA无法访问本体的限制未绕过。以下是安装包静态实现，不是实际窗口computed-style或截图等价证明。

## 可直接交给 Android 的源

- `message-css/11e93e921fb1.css`：完整原字节CSS，含Markdown正文、段落、标题、列表、表格、代码块/内联代码、链接规则。保留完整成员，避免丢失外层supports/media/动画规则。不是手工重写。
- `message-css/242c17f27016.css`：完整原字节CSS，含用户bubble规则。
- `message-css/SOURCE.json`：原ASAR成员哈希、完整字节范围、依赖token在全局CSS的声明/offset和上下文。token可能有多个scope，不能把任一声明当全局计算值。
- `message-layout-observations.json`：正文公式、全局字体scope、activity/state与body布局的精确UTF8 byte offset/source hash/excerpt。
- `message-layout-factories.json`：24个去重模块的源范围/哈希与inert factory路径；每项syntaxVerified表示仅做语法编译，未执行。
- Factory实物在`artifacts/diagnosis-20261105/message-layout-factories`。原factory声明仅将方法语法`ID(e,t,n){...}`包装成`const ID=function(e,t,n){...}`，正文保持原文。不执行bundle。

## 当前正式版字体、正文与间距

全局CSS`361a1f04b890.css`：`--spacing:.25rem`，`--leading-relaxed:1.625`，全局`--text-base:14px`/`--text-sm:12px`。基础chat字体有13px fallback，但electron body会设置`--font-ui-size:var(--text-base)`、`--codex-chat-font-size-override:var(--font-ui-size)`，所以默认electron为14px；设置覆盖/宿主字体倍率仍能改变它。browser scope另将text-base改成1rem，不能混当Mac desktop。

`.MarkdownRoot-rZKhxa`：`--markdown-font-size:var(--codex-chat-font-size)`，`--markdown-line-height:calc(var(--markdown-font-size)*var(--leading-relaxed))`，`--markdown-space:calc(var(--markdown-font-size)/4)`，`--markdown-small-font-size:max(var(--codex-chat-code-font-size),calc(var(--markdown-font-size)*.875))`。在上述默认electron下正文14px/22.75px、space3.5px。根overflow-wrap:anywhere，正文色`--color-text`。

原语义class必须对应DOM结构；给根加class不能让普通p自动匹配原Paragraph规则：

|节点|原class/属性|
|---|---|
|根|`MarkdownRoot-rZKhxa`, `data-markdown-text-style="assistant-message"`|
|段落|`Paragraph-kKnbIo`|
|标题|`Heading-Ro3lZr`（h1..h6规则不同）|
|列表|`List-kOVW5V`，li `ListItem-ncLgmg`|
|引用|`Blockquote-EqEEot`|
|内联代码|`InlineCode-Cddi3Y`|
|代码块外壳|`CodeBlock-zu1QM3`；真实代码编辑器内部结构另有规则，不能把外壳class当整个原控制器|
|表格容器/表|`TableContainer-UfIOz_`/`Table-LqdUhs`|
|表头/数据格|`TableHeaderCell-esYSpn`/`TableCell-WcsygL`|
|横线|`HorizontalRule-ByOEk_`|
|外链|`ExternalMarkdownLink-WWBYg9`|

Paragraph默认margin `0 0 space`。根非首段margin-top=2*space；连续Paragraph还有专门组合规则。非user tone连续中文段（两段都`data-markdown-han-text`）前段margin-bottom=spacing，即4px，不等于普通段落公式。根first/last child有消边距规则，列表内Paragraph又有独立规则；请直接使用保留原CSS，不按此摘要重新拼CSS。

h1字号1.5*font，行高8*space；h2字号1.25*font/7*space；h3字号1.125*font/7*space；h4 font/6*space。列表缩进=markdown-line-height。CodeBlock margin-block=5*space；InlineCode圆角6px、padding1px6px、字号.92em；代码占位字体small、行高5*space、padding4*space。表头padding-y=2*space，body格padding-y=2.5*space，末行body格padding-bottom=6*space。原CSS包含完整选择器，摘要不代替原文。

## 消息宽度、用户消息与活动容器

正式electron/browser/chrome-extension body设`--thread-content-max-width:48rem`。`KkZX`容器组合：响应宽度变量→body最大宽度加inline padding，`mx-auto w-full max-w-(--thread-body-max-width)`，`px-[var(--thread-body-inline-padding,var(--padding-toolbar))]`。browser另设compact40rem/expanded48rem与更窄viewport规则。48rem是容器上界，不表示每个消息固定48rem；工具/宽Markdown还有自己的wide block规则。

用户Bubble vHM0（34346成员）跟桌面旧原history Bubble总体契约一致：默认alignment=end，max-width=--user-chat-width，padding-x=--thread-content-margin；普通prompt `py-2.5 rounded-2xl relative text-start`。当前`.bubble-vBnidZ`设user-chat-width70%、radius-2xl=5.5*spacing（22px）、thread-content-margin=4*spacing（16px）。这与Android旧max70%/padding10x16/radius22相近；Android额外user-row margin20px0 32px并非此Bubble来源。

`GRDa`精确消息stack：`flex flex-col`，默认item gap=16px，grouped gap=4px，custom不给gap。这是容器控制，不应再给每个assistant/body额外margin16px。`tHoD`活动body默认`gap-2 pt-2 pb-1`，indent=true时`ps-6`（24px）；grouped为4px gap+pt4；conversation为item16px gap。没有手写left-border。

## 今日活动shell与 Eva 桌面旧原组件的差异

桌面native-steering/activity-shell-original.mjs来自Windows26.1027.3384.0；正文FormattedText/Markdown环境主要来自26.1023.6123.0，不可标成今日Mac原实现。已先读这些现成代码，给Flow提供其直接复用边界。

今日`r9ev`源899308 UTF8 bytes41384..42825：`children != null`才可展开；running默认展开但允许用户折起，completed用独立state（defaultExpanded仅初始值）。两个状态互不冒充；展开时onExpand回调。关闭height0/opacity0、aria-hidden/inert、pointerEvents none；打开真实测量高度/opacity1。transition来自V8uZ.X7，`.3s/[.19,1,.22,1]`，与旧同值。

旧by接收summaryKey/summaryTransition/shouldAnimateInitialCollapse/canExpand/dir，含旧summary节奏逻辑；不是今日r9ev API。今日header hCjf的外壳类与旧一致：`group/activity-header relative inline-flex min-w-0 max-w-full self-start items-center gap-1 p-0 text-start`，inner Inline为gap1.5。今日BI7J Row新增summary flex1/min-w0/强制子元素color变量；通过nMdB在toggle后350ms保持滚动锚定，触摸/滚轮/按键会取消。

今日shimmer umSm.N读取默认true的h30a.T context；active时aqd9观察可见性，600ms后进入，每4s播放1s，尊重document.hidden和reducedMotion。N不需要FormattedMessage；同module的g Thinking fallback才用oyxz Intl。可绑定现有桌面原Intl服务，须明确是host binding。

ltPT测量hook需要现代nsuH.wY/ZYy5.k/m8On ResizeObserver真实provider。不能将旧provider的另一context直接放上面就算接通。所有小factory已交Flow闭包提取；源manifest逐项追踪。

## 当前 Android 差异与落地建议

当前手写assistant14/22、body margin16px、p margin12px、user-row20/32、summary min-height32、body左边线与左缩进16，都不能从本次原组件证明。优先使用原语义DOM+原CSS、stack16/group4与tHoD原结构，去掉重复人为外边距。根负责适配Markdown-it节点class和attributes，Flow接今日原activity工厂，桌面已有原Bubble/MessageLayout/BodyLayout可直接复用并记录版本。

桌面普通assistant实际`renderCodexMarkdown`→cloudMarkdown.renderNative，仍为Markdown-it重建；不应声称直接用了原React Markdown。另一`native-steering/markdown-runtime/api.mjs`才提供原Markdown/FormattedText环境，它包含原Markdown闭包及真实service接线，需要单独迁移成本评估。Android本轮class适配能恢复确定CSS，却不能宣称原FormattedText折叠控制器/所有特殊指令/动画已完整移植。

本轮未锁定完整final外层母组件与所有动作栏/头像条件，因此不凭缺少匹配推断“正式版没有头像或动作栏”，也不按ChatGPT网页组件添头像。正文、用户bubble、活动shell、gap/宽度是已定位事实。实际主题色由app-color宿主scope提供，SOURCE列其变量链，手机映射色不能当已观测Mac计算色。无正式本体截图对照，不能宣称像素一比一完成。

## 第二轮：final母组件及动作栏已锁定

已从原copy tooltip种子区分自动任务确认页与真正assistant内容：`34346`那个copy tooltip位于task confirmation，不能用作普通assistant证据；实际为`366297.f0d89078fe.js`的`o7K3`，导出`F=t7`、`m=ni`。完整factory65KB已提取；函数由Babel AST直接截取，`final-answer-observations.json`记录UTF8原范围/hash，实物`artifacts/diagnosis-20261105/final-answer-functions`。

- t7 bytes212096..236206，SHA256 `df105798966b93fe0258e31d6ab369cea218f2512153d3b87a1f7906983b5a7e`。根固定`group flex min-w-0 flex-col`，children为speaker marker、external delivery（条件有）、screen reader公告、正文/after/action片段。默认无人工margin。`after`/`electronAfter`各有`mt-3`；普通文字本体无气泡。Markdown绑定textStyle assistant-message；commentary不启用adaptive buffering，其他phase streamId为conversationId:searchItemId。默认根消末子margin与首ol/ul上边距。
- B3ke speaker marker已完整提取：assistant是`h4.sr-only`，只有打印时`print:not-sr-only`，正常UI不显示ChatGPT署名；t7无头像子节点。这是组件源事实，不推导其他Aeon/共享会话等变体都无头像。
- ni bytes240456..245090，SHA256 `8077725c66d8e393483f9fed0c944c37ad978f45a3815e8dd9bf6835a8113066`。动作行`mt-1.5 flex turn-action-controls min-h-5 min-w-0 max-w-(--thread-content-max-width) flex-wrap items-center justify-start gap-0.5`，electron `-translate-x-1`，browser另`mt-3/-ms-.5`，extension `-translate-x-1.5`。未知父scope不能混用。
- ni仅有copyText非空，或统计/引用/goal/onFork/feedback/host actions等实际内容才生成actions；全无内容也无允许timestamp时返回null。copy按钮只有copyText非空才出现。t7传入copyText还要求`(completed || allowCopyWhileStreaming) && normalizedCopyText非空`。不渲染“空操作栏”。
- 默认操作组opacity0，group hover/focus后显示；alwaysShowActions或overflowOpen时常显。原父`612929… tJ`传alwaysShowAssistantMessageActions=isMostRecentTurn，因此最新回合常显、旧回合hover/focus；手机hover可用性须以这个真实父条件处理。
- 父tJ的showActionRow要求voiceWorkActivity为空、没有pending items、没有当前thinking-status展示（ic为复杂thinking/reserve状态布尔，原表达式见源，不简化成completed）。t7又以非compact scope `!tQ && (showActionRow || showTimestampWithoutActions)`控制ni挂载。
- 原overflow tX只含Branch in new chat、autoReview、hooks、memory、skills条件；没有内建重试/编辑。onFork由t7仅completed时传入。host可注入额外动作；不能由这点声称整个Codex都没有retry/edit。
- 原本地thread父tJ先push agent-activity、再assistant-item、最后post-assistant-items。commentary在前面的slice作为独立assistant-message处理；复制文本仅取已completed内容。Retry的retryTurnId传活动renderer，要求最新回合、非readOnly等，未传ni。User edit走独立user renderer且仅last user message，不能挪到final assistant。

今日复制状态机`uuN8`完整5463byte已交Flow，真实onCopy事件返回boolean/Promise，stopPropagation、防并发、Promise busy、失败不显示Copied、unmount清timer，成功反馈默认2s（inline1s）。小copy/check SVG m0fb/mmWO以及原class utility on57也完整提取；可用原renderButton扩展点接手机真实剪贴板/原按钮宿主。若关闭Tooltip或只裁剪copy子分支需在来源记录中写明，不声称完整ni/store/analytics已迁移。

Han属性精确条件现已证明：`814244… pxwu`为`/\p{Script=Han}/u.test(ZjkF.X(children))`；ZjkF.X递归React children提取string/number并拼接。含任意Han字符即true（混英文也true），不是“纯中文”检测；媒体段落专用分支不加此attr。原factory和观察范围已保留。

## 第三轮：用户上传图尺寸与布局

先读Eva现有`native-image-preview/tool-adapter.jsx`：已用原`createOriginalToolImageView(...).ImageDialogGallery`，再注入原HistoryPresentation.Images；`mountOriginalUploadedImages`是桥接，携带原完整runtime、Scope/Intl/Query/Portal/ImagePreview服务，bundle较大，不宜为80px布局搬16MB整套。手机本地图片点击预览可保留真实宿主实现，但必须记录没有迁入整个正式gallery preview控制器。

今日Mac原`GL6x`15.7KB factory已提取；`BW=et`是gallery，`im=ee`是单图/预览控制器，来源`366297.f0d89078fe.js`。`gallery-observations.json`保留exact UTF8范围/source SHA，et bytes482901..483718（817bytes），ee475372..482901（7529bytes）；AST提取原函数实物在final-answer-functions目录（名称et/ee，不要误当assistant函数）。

- 用户消息外层：`hide-scrollbar flex max-w-full flex-row-reverse self-end overflow-x-auto`。内层：`flex min-w-max items-end gap-2`，即8px gap。外部message stack给图片/气泡之间gap2（有externalSurface的另有gap1.5分支）。用户末端对齐，溢出横向滚动，非wrap/grid。
- et以原src顺序map ee到React.Fragment；单、多图**相同thumb大小**。维护openIndex，previous仅index>0时提供，next仅index<count-1，disableOpenAnimation=true。没有按多图数量改变缩略图尺寸。
- 成功缩略图外节点`div.size-20.cursor-interaction.rounded-lg.border.border-strong`，role=button、tabIndex0、真实click/Enter/Space，内部img为`h-full w-full rounded-md object-cover`。size20=20*spacing=80px。
- 全局corner-radius-scale=1，radius-lg-base=.625rem、radius-md-base=.5rem：默认electron外圆角10px、图8px；browser又覆盖lg=.5rem/md=.375rem，不应直接混用browser值。
- 加载中占位`flex size-20 items-center justify-center rounded-lg border border-strong`（80px）。失败专用节点`size-16`（64px），danger边框/底/文字、10px字体/12px行高；不是缩略图失败时继续展示虚假成功图。
- 手机手写144x144/radius16与今日原实现不一致；确定的最小迁移为上述原wrapper/size80/border/radius tokens/fit，不需要整套云图编辑/下载/context menu服务。原ee依赖诸多真实服务，不能假设单独执行即可；若从其原DOM返回片段裁剪用于宿主，需记录片段源与host onPreview边界。

第二、三轮REA验证：`rea-final-gallery-summary.json`，Evidence `ev_1a820f029435722752e1e9eebc698f79004780801374f0f61a28730f7dda51d7`。仅选择o7K3/GL6x/uuN8/B3ke/pxwu/ZjkF六个小模块，未分析整个8MB主bundle；静态边/语义覆盖有上限，未执行原bundle，故不构成真实宿主计算样式证明。
