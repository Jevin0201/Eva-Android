# 多格式文件预览（2026-11-03）

## 本轮范围
用户明确先做预览，Office 局部文字修改与保存延后。没有把只读预览描述为 Office 编辑器。

- 工作区文件列表、对话内工作区文件链接统一打开 WorkspacePreviewActivity。
- DOCX：标题、正文、基础加粗/斜体/字号/颜色、表格、内嵌 PNG/JPEG/WebP/GIF。手机流式阅读布局，不做原始分页精确还原。
- XLSX：按工作簿关系顺序列出工作表、行列标题、共享/内联字符串、缓存值；无缓存公式显示公式。每表最多 200 行、30 列，最多 20 个工作表，不计算公式。
- PPTX：按演示文稿关系顺序显示幻灯片，保留基本文本框坐标、字号、颜色、内嵌图片；不含母版完整还原、复杂组图/图表/SmartArt、动画与转场。
- Markdown：复用已打包 markdown-it，渲染标题、表格、代码、列表等，HTML 输入不作为脚本执行。
- HTML：本地静态预览、同目录 CSS/图片；默认不执行脚本。用户可单独确认启用本地交互，仍无 EvaHost、文件/content URL访问或网络连接。
- SVG：作为图片预览，不将文件内 SVG 标签直接作为宿主 DOM 注入。
- CSV/TSV/UTF-8 文本及常见代码：只读预览；现有 Markdown/HTML/文本源码编辑入口保留，编辑后返回会重载文件。
- 音频：原生播放/暂停、进度、拖动定位、后台暂停，页面重建恢复位置且不自动播放。
- 视频：原生 VideoView + MediaController、播放/暂停和定位。容器/编码兼容性由安卓系统决定，损坏或不支持编码给出失败状态。
- PDF 与图片延用已有原生预览，保留系统另存入口。

## 实现与约束
没有引入新第三方库。Office 使用有边界的 ZIP/XML 内容解析，拒绝 DOCTYPE/ENTITY、越界关系、过量条目/解压体积、过深 Word 结构。Office 文件上限 64MB，单 ZIP 条目 4MB，累计读取 20MB；文本/HTML 上限 1MB。预览在后台准备，不由界面线程同步解析整份 Office。

预览 WebView 使用独立 preview.eva.invalid 来源。首版误拦截了 loadDataWithBaseURL 的初始页面，实际真机失败后已改为受控 HTTPS 本地文档响应，未把该失败算通过。子资源限定同目录工作区内，远端网络、iframe/object、表单提交及 Eva 原生接口均不开放。

旧版 DOC/XLS/PPT、RTF、ODF，以及加密 Office/密码 PDF、复杂排版不在本轮通过范围。旧版二进制文档明确提示先转换现代格式；不把二进制当 UTF-8 乱码展示。

## 验证
- tools/DocumentPreviewTest.java：24 项主机检查（格式路由、中文、格式/表格/图片、工作表关系、公式、幻灯片关系、XML 实体和包路径边界等）通过。
- tools/test-document-preview.cjs：Office 生成 HTML 在 390px 实际浏览器显示、无横向溢出；生成静音 WebM 测试样例。
- artifacts/previews/native-result.json：真机 Office 解析、XML 安全、静音音频解码与播放/暂停、视频帧解码通过。
- artifacts/previews/device-pages.json：真机实际预览 Activity 中 DOCX/XLSX/PPTX/Markdown/HTML 均有预期内容、无 EvaHost、无页面横向溢出；Word 内嵌图、两工作表、两幻灯片、Markdown 表格、HTML 本地图已验证；HTML 默认脚本没有执行。
- artifacts/previews/device-media-ui.json：实际 Activity 播放按钮、后台暂停、音频 Activity 重建、视频按钮通过；音频测试静音。
- 聊天滚动、生成图片、技能插件调用回归通过。APK 构建并覆盖安装。
- 测试文件是自己构造的样例，位于专用 preview-checks-* 目录，不是用户真实办公资料。没有修改用户 Office 文档；系统另存选择器和复杂文档长时压力测试未扩大声明为本轮验收通过。
