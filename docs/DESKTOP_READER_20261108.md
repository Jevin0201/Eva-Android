> 最新交付：0.0.77已正式安装。默认直接渲染Word/Excel/PPT/Markdown原文件，未转PDF；真机全屏、多段触摸、选区原格式保存与真实模型修改通过。范围和限制见[0.0.77](RELEASE_0_0_77.md)。以下保留各阶段记录。

# 桌面文件阅读器迁移（实现待真机验收）

> 最新要求（2026-11-08）：用户明确否决默认转换或另存PDF，要求直接显示Word、Excel、PPT、Markdown原文件。默认入口改为DesktopDocumentPreview原文件，Web层确认真实DOM就绪；最终UI仍待验收。下文PDF方案及测试仅保留为曾做过的可选转换/QA证据，不再代表默认阅读方向。参见 [0.0.77待验收记录](RELEASE_0_0_77.md) 与 [任务总账第8/9组](ACTIVE_TASKS_20261108.md)。

来源仅为用户提供的 Eva-Source/src/renderer 与 src/main，未采用 outputs/mobile-live。来源哈希与桌面原有能力边界保留在 migration/desktop-reader/。此前工作区未提交修改继续保留。

- DOCX：桌面 docx-current、分页、搜索、缩放、页眉页脚及脚注阅读。
- PDF：桌面 PDF.js、文本层、搜索、页码、旋转、缩放、连续阅读、密码输入和注释层。
- XLSX/CSV/TSV、PPTX：桌面解析业务逻辑与 Office Shadow DOM 阅读器；工作表/幻灯片选择、搜索、缩放、缩略图、样式、合并单元格、公式缓存值、嵌入图片。浏览器解析使用既有 JSZip/ExcelJS，Android 在输出源文件前校验 ZIP 实际展开大小及路径。
- Markdown：桌面 cloud-markdown、markdown-it、KaTeX，保留公式、表格、任务列表和代码复制；本地图片只允许文档目录内资源。
- HTML：原 mountHTML 及 sandbox 文档处理器，Android 只提供同目录资源读取，预览页面无原生 JS 接口。
- 音视频：原 mountMedia 播放组件；Android 文件流、Range、退后台暂停。系统支持的编码仍由 WebView 决定。

旧 Office 排版转换入口保留；桌面本来不完整支持的图表、母版、动画、复杂 Excel 格式和公式重算不会因迁移变成完整支持。DOC/XLS/PPT 仍需转换。32 MiB 文档上限；媒体流不受此上限限制。

验证：390×844 Chromium 检查现有真实 DOCX/PDF/XLSX/PPTX/Markdown/HTML 样例渲染、Office 搜索、内存 WAV 读取及无脚本异常。新增两份 Java 源码用当前既有编译类与 Android 34 API 编译通过。全项目使用 SDK 34 编译失败于现有 PhoneTaskReport 的 Android 36 API 与 RuntimeSetupService.onTimeout，因此尚无本轮完整 APK 构建和真机验收。阅读位置在旋转/进程重建后的恢复、长文档性能、视频全屏、各编码及 Android 生命周期仍需真机回归。

构建：先运行 tools/sync-desktop-reader.py、tools/build-desktop-reader.cjs、tools/build-desktop-native-reader.cjs。依赖与原提取代码许可证不可混同，NATIVE_LICENSES.json/OFFICE_LICENSES.json 记录 npm 依赖许可证，提取组件保留桌面 provenance，未重新声明开源许可证。

临时内容：本轮编译输出集中 artifacts/desktop-reader-20261108/，检查后删除无交付用途的 classes，保留编译日志。交付 assets、来源快照、测试脚本与既有依赖不删除。


## 2026-11-08 原文件阅读方向与历史可选转换证据

用户最新要求不转换、不另存，直接显示原文档。原生默认入口与Web真实DOM就绪正在对齐，新APK的原文件阅读、操作和生命周期仍待验收。此前新增的 `eva-render.py preview --input PATH --output-dir NEWDIR` 及以下PDF验证，仅为可选转换和历史QA证据，不能核销当前要求。旧 `render`（视觉QA）、`convert`、`recalculate` 保留原行为。

预览专用 PDF filter 使用 `UseLosslessCompression=true`、`ReduceImageResolution=false`，不额外下载字体或改写源文档。继续执行 Office 输入限制、宏/外部工作簿链接拒绝、源摘要不变检查，以及 PDF 128 MiB、300页、逐页尺寸和总面积限额。旧 DOC/XLS/PPT 不在此命令支持范围，明确要求先转换；公式重算和排版仍受 LibreOffice 的函数及字体兼容性限制。

XLSX/ODS 使用 `SinglePageSheets=true` 按整表一页导出。官方参数会忽略隐藏状态，因此不能直接把全部页交给界面。真机 LibreOffice 未遵守同时传入的 `PageRange`，该初版已安全失败并删除未验证输出。最终实现先在权限0700的私有临时目录导出所有页，严格要求原始 PDF 页数等于原工作表总数，建立原索引映射；仅通过 `pdfseparate`/`pdfunite` 抽取可见原页，核对单页及最终页数、尺寸，再提供最终 PDF。全可见时直接复制；缺少 Poppler 工具、全隐藏、可见性无法确定或页映射不符均明确失败。原始含隐藏页 PDF、拆分页及隔离配置在成功、失败和取消时清理。该流程不栅格化整页，保留 PDF 的文本、字体和向量对象。

以下均为此前主动执行的独立PDF转换/QA验证，不能替代原文件直接阅读或新APK默认界面的验收：

- 原 Excel 看板：SHA `72d7e4f3b3a4ff6805a8d3f2819f6f5c2aceb86554ac264f6371fea3c246ba62`。旧 QA 打印布局产生160页及160张PNG；新预览实际3.38秒生成4页、没有逐页PNG。四页尺寸为373.342×10814.5、1008.03×2257.54、1085.02×313.54、2105.77×664.526pt，对应4个可见工作表；源摘要不变。保留整表长页，不能把它当作纸张打印分页。证据：`artifacts/preview-redesign-20261108/actual-excel-layout.txt`、`actual-excel-final-preview.txt`、`excel-final.pdf`。
- 隐藏工作表样例：原顺序 hidden / visible / veryHidden / visible，实际最终2页；仅有两张可见表的唯一标识，隐藏 sentinel 不在 PDF 文本中；可见公式保留对隐藏数据的依赖，两处结果均为42，源摘要不变，`privateRawLeft: []`。样例单元格本身较窄，完整可见标识被源列宽截断，验收使用唯一 `VISIBLE_ONE`/`VISIBLE_TWO` 子串，不归因为丢页。证据：`hidden-sheets-fixture.xlsx`、同名JSON、`actual-hidden-postfilter.txt`。初版失败记录 `actual-hidden-sheets-preview.txt` 保留供追溯。
- 原 Word：SHA `0eaac99aab941feae71693a5430621eb7986c8f88d347e2d74dcafb6c33bbe45`，真实 LibreOffice 输出8页；主代理已逐页目视，源仅3张内嵌图，PDF在第2、6、7页全部保留。源为Letter，正文432×648pt，封面图396×528pt，另有标题、空段、段后距及显式分页；封面不能以轻解析器曾经同页作为版式基准。第3页空白与后续目录分页需按引擎布局理解，不能断言其他Office完全一致。目录源只有字段指令、无已存条目；源字体未嵌入，PDF实际替代为文泉驿及DejaVu。未对源文件做排版美化。证据：`original-word.docx`、`actual-word-layout.txt`、`word-final.pdf`、`word-final-page1.png`至`word-final-page8.png`。

轻解析适配也已修复 ExcelJS 对默认绘图命名空间的 `anchors` 错误：按 namespace URI 规范化内存绘图副本，不删除图片/图表/关系，不改用户文件。浏览器回归验证真实4表、4图、7条序列与源数值一致；770个无缓存公式明确标记而非当零。该解析结果和普通柱/线/饼图阅读卡片属于轻解析路径的能力，不冒充完整Office最终排版。测试与再生成证据见 `excel-parser-test.log`、`excel-parser-build.json`；最终预览的17项离线契约见 `office-preview-contract.log`。

办公组件安装误报也已定位：`distribution/office.json` 实际为 ready，guest 中 LibreOffice 正常运行；Android `File.isFile` 将 guest 绝对符号链接按宿主 `/usr` 解析而返回false。源码改为限制在当前 Alpine 根内解析链接，真机 `ModularSetupCheck` 26项通过。证据：`office-host-evidence.json`、`office-guest-evidence.json`、`native-modular.txt`。仍需最终包的设置页和组件入口回归，不以该原生检查替代全部UI验收。

本子任务清理核验：主机 Excel 回归的临时PNG/XLSX、baseline/inspection浏览器bundle、依赖契约的临时虚拟环境/编译目录，以及预览契约测试目录均已自动清理并检查无残留。保留真实用户文件副本、隐藏样例、PDF、截图、校验及日志供后续验收。项目整体构建/手机临时内容由主代理单独核查，此处不声称覆盖整体清理。

### 原文件解析当前核验与待补能力

直接Excel阅读已在可再生成适配中过滤hidden/veryHidden表，保留原workbook供跨表引用，不改源文件；全部隐藏明确失败。补充图片/图表的原锚点、偏移和像素尺寸，供Web层按网格原位显示，不能沿用表前卡片而称原位保真。真实4图原锚点为H3、H18、P3、P18，7条序列引用的数据区为源已保存常量，数值浏览器回归一致。测试见 `excel-direct-parser-test.log`。

770个公式均没有缓存，直接读取当前显示“公式未提供缓存值”；这不是计算结果完整。依赖只有ExcelJS/JSZip/saxes等，ExcelJS不能生成公式结果，没有现成公式计算引擎。实际公式需要SUMIFS、AVERAGEIFS、DATE、IF、SUM、ABS、AVERAGE及整列/跨表引用、日期与条件语义；月度汇总H4:H15另有12个可疑非法行引用D-11至D0，不能假称全部正确重算。后续若引入内存计算，须保留错误/不支持结果，禁用脚本eval，不能用0填补。

直接PPT来源是桌面 `src/main/office-preview.js` 与 `src/renderer/office-preview.js`，不是另一套完整Office引擎。本轮补齐普通柱/线/饼图缓存读取与原位元素合同，并让占位符按idx/type从布局、必要时同型母版继承几何。真实 `artifacts/office-complex/run-asqbbuhi/complex.pptx` 两页各1张柱图，缓存Revenue / East、West / 120、80逐值保留，图表原归一化位置为(.1,.2,.6,.4)；两页标题实际继承母版几何，不再无声满页。Chrome回归另验布局优先、无法定位时明确标记、不把缺缓存填零，原文件SHA不变；Web子任务验证实际SVG处在对应shape区域。证据：`ppt-direct-parser-test.log`、`direct-office-parser-build.json`，这仍不等同手机UI验收。

剩余限制包括复杂母版样式、组合、表格/SmartArt、富文本逐run样式、复杂填充和动画。复合、堆叠或当前绘制器未支持的图表方向明确标记supported=false，不能按普通图替代；找不到唯一原几何时返回未定位元素和警告，而非伪造位置。后续逐项以原文件回归补齐，不能用PDF转换替代直接阅读要求，也不能因来源桌面就宣称全保真。
