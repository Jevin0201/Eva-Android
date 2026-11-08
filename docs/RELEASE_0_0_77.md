# 0.0.77 原文件阅读、选区编辑与组件修复

状态更新：2026-11-08。正式签名包已保留数据覆盖安装，版本77/0.0.77、debuggable=false；安装首日仍为2026-11-02 15:09:00，未卸载。实际安装base APK与交付包SHA一致。文件：[正式安装包](../outputs/eva-android-0.0.77-arm64-release.apk)，352549590字节，SHA-256 `b486e98875e832b096ac83bca872070cea972d7d143e9e9d0cbf58380b08a454`；1095项源码指纹见同目录release-source-manifest。

## 当前方向与已实现

- 用户最新明确否决默认转换/另存PDF，要求直接显示Word、Excel、PPT、Markdown原文件。原生默认入口改为DesktopDocumentPreview原文件，Web层等待真实DOM、字体与图片布局完成后展示；真实Word/Excel/PPT/Markdown读取与原始字节SHA验证已通过，不需要手动渲染。
- 此前 `eva-render.py preview` PDF方案不再用于默认入口，其代码和以下测试仅保留为可选转换/历史QA证据。旧 `render`、`convert`、`recalculate` 保持原行为。
- 历史可选转换（非默认文档阅读）：Calc按整表一页导出；隐藏内容先只存在于权限0700的私有临时PDF中，原始页数须匹配全部工作表数，再通过Poppler提取可见原页、验证最终页数及尺寸。全可见直接复制。全隐藏、未知可见性、缺工具或索引映射不符明确失败，不提供未验证PDF；私有raw、拆分页与配置自动清理。保留源文件和对隐藏数据的公式依赖。
- 历史转换filter启用无损图片压缩、禁止降采样；源SHA、Office输入、PDF大小/页数/几何资源限额仍校验。没有新增字体下载，不承诺所有Office函数或精确版式兼容。
- Excel原文件解析修复绘图命名空间的anchors崩溃，表格、嵌图与4张图表按原锚点共同缩放；隐藏工作表不出现在列表。PPT实际两页图表及布局/母版几何继承通过真机检查。
- PPT直接解析新增常见图表缓存、原位chart元素及占位符布局/母版几何继承；真实复杂样例两页图表和标题位置在浏览器通过。缺缓存不补零，未定位和未支持类型明确标记；不冒认完整母版样式、组合、SmartArt或动画能力。
- 办公组件就绪检查修复guest绝对符号链接的宿主误判，保留实际安装与profile记录。
- 原格式局部编辑后端已实现Word跨run、PPT唯一段落/整shape、Excel显式类型单cell、Markdown唯一源文字替换；check只读，apply具备SHA/备份/原子写/非目标ZIP字节保护。选区引用交接对话与原生替换均已接入并做真机端到端验收；不是完整Office编辑器，不自动重算Excel依赖缓存。详见 [任务总账第10组](ACTIVE_TASKS_20261108.md)。

## 历史可选转换及独立检查证据（不代替直接阅读）

证据根目录：`artifacts/preview-redesign-20261108/`。

| 验证 | 已确认结果 | 证据 |
| --- | --- | --- |
| 原Excel独立手机preview | 旧打印布局160页改为4个整表向量页，3.38秒；源SHA不变；不生成逐页PNG | `actual-excel-layout.txt`、`actual-excel-final-preview.txt`、`excel-final.pdf` |
| 隐藏表后过滤独立手机preview | hidden/visible/veryHidden/visible最终仅2页，可见唯一标识存在、隐藏sentinel未出现、两个公式42、源不变、privateRawLeft为空 | `hidden-sheets-fixture.xlsx`、`actual-hidden-postfilter.txt` |
| 初版PageRange方案 | 当前真机LO未遵守与SinglePageSheets并用的PageRange；已安全失败，未验证PDF被删除，后由Poppler后过滤替代 | `actual-hidden-sheets-preview.txt` |
| 原Word独立手机渲染 | 8页主代理逐页目视；全部3张源图在第2/6/7页保留；原文件未改 | `actual-word-layout.txt`、`word-final.pdf`、`word-final-page1.png`至`word-final-page8.png` |
| 办公组件根因 | office marker实际ready；host isFile=false，guest入口存在并可运行；修复后原生26项通过 | `office-host-evidence.json`、`office-guest-evidence.json`、`native-modular.txt` |
| 最终预览离线契约 | 17项通过，覆盖隐藏页索引、资源限制、失败/取消清理、缺工具、源保护及旧转换行为 | `office-preview-contract.log` |
| Excel浏览器内容回归 | 真实4表/4图/7序列与源数据一致，770个缺缓存公式明确标识；图像/图表fixture及其他既有XLSX通过 | `excel-parser-test.log`、`excel-parser-build.json` |
| 原格式局部编辑后端 | 17项事务检查及真实Word/Excel/PPT宿主副本通过；仅目标part改变、备份/非目标项/原样本保护，不是手机验收 | `document-edit-contract.log`、`document-edit-real-copies.json` |
| PPT原文件直接解析 | 真实2页/2柱图缓存和原位置、标题母版几何、布局优先、稀疏缓存、未定位标记及源SHA保护在Chrome通过 | `ppt-direct-parser-test.log`、`direct-office-parser-build.json` |

Word版式差异有源几何和字体证据：源为Letter，正文432×648pt，封面图高528pt且有标题/空段/段后距和显式分页；源TOC没有已存条目。源未嵌入字体，实际PDF使用文泉驿/DejaVu替代Microsoft YaHei等。不能把轻阅读器曾经同页视作Word最终分页标准，也不因出现空白页就认定原文件损坏；未对用户文档做排版美化。详情见 [阅读器记录](DESKTOP_READER_20261108.md)。

## 正式验收结果

- 原生预览检查43项通过，直接原文件检查Word/Excel各14项通过，未生成转换PDF/cache；Word进入/退出全屏实际点击通过。
- Word、Excel、PPT、Markdown通过实际手机阅读器；`/document` SHA与原格式源文件一致，sourceMatchesHost=true、derivative=false。Word封面正常整页显示，Excel四工作表可切换；PPT两页各一真实SVG图表，标题继承布局；Markdown真实正文就绪。
- 真机追踪发现缩放中重建TD使Android丢失后续手势，已修为只缩放既有平面。最终Android收到8次move、2次end，原触摸节点始终连接，Excel1→1.4，PPT1→1.4；按钮/滑杆保留原选区。见 `excel-touch-before-fix.json` / `excel-touch-after-fix.json`、`phone-direct-*-final.txt`。
- 办公组件页实际显示“办公处理 · 已安装”，旧“自检记录缺失”不再显示；未重装已成功安装的Office。组件原生26项通过。
- 四类真实手机副本check→apply→回读通过，Word/Excel/PPT仅目标XML part变更，其它ZIP内容不变，备份等于原文件，过期SHA重复提交被拒绝。用户原Word/Excel SHA保持不变。
- 原生界面选中Markdown→直接替换→原格式保存→刷新通过；选区→对话草稿（未自动发送）→真实GPT-6.1 Terra工具调用→原文件保存/回读也通过，未选中段落不变，引用成功消费，临时请求已删除。验收对话“验收：选区精准修改”保留供审阅；不是四类格式都分别调用了真实模型。
- 正式包冷启动原Word显示正文并无渲染按钮；手机最后停留在该Word原文件预览。安装及截图见 `installed-release.json`、`formal-word-ready.json` / PNG。

证据统一位于 `artifacts/preview-redesign-20261108/`；源格式浏览器回归及多段触摸/选区回归位于 `artifacts/reader-mobile-20261108/`。真实模型首次将请求写入/tmp被拒后自主移动到工作区继续成功；最终指令已明确请求JSON必须在工作区，以减少该无效回合。

### 使用与边界

打开原文件即自动完成文档渲染。Word/Markdown选中文字、Excel点击单元格、PPT点击文本框，再通过顶部更多→“将选区交给 Eva 修改”填写要求；可交给对话，也可直接替换。Excel直接替换提供文字/数字/公式显式类型；Markdown另保留文本编辑器。

当前为局部内容编辑，不是完整Office排版编辑器。Word跨段/不可唯一定位选区会拒绝，Excel直接修改限单格且不自动重算依赖公式/图表缓存；源样本770个未缓存公式明确显示未计算，12处疑似源公式非法引用没有擅自修正。复杂PPT母版样式、组合、SmartArt、动画及未支持的图表语义不承诺完整保真；旧DOC/XLS/PPT、ODF尚无直接原格式parser，不以默认转PDF掩盖。

## 交付清理

已核对绝对路径后清理手机撤回转换方案的301个QA中间文件（35,285,320字节）、重复编辑脚本、公开暂存脚本/PPT/XML与旧自建部署暂存目录；私有回滚审计保留。清理构建中间产物2,870,951,919字节，保留签名APK、源码指纹、SDK/JDK/ADB、锁文件、离线依赖、用户原文件。SHA及ZIP清理前后验证一致。手机编辑验收样本及自动备份仍供回归和验收对话链接使用，未删除；不是全盘清理。详见cleanup-*.json。

## 本子任务清理范围

主机Excel回归及预览契约测试所生成的临时文档、图片、浏览器baseline/inspection bundle和测试目录已自动清除并检查无残留；本子任务此前依赖测试的临时虚拟环境与定点编译目录也已亲自核验清除。保留用户文件副本、隐藏表fixture、PDF、截图、日志与校验记录，供继续验收。不声称已经覆盖其他代理的构建输出或整个手机的清理。
