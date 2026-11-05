# 电脑端交付与预览能力审查

基准为 Eva-Source 0.2.7 的 src/renderer 与 src/main。下表依据已读代码，真机验证由主任务单独记录。桌面工程自己的 coverage.json 仅作待核对能力索引，其 runtimeVerified 不视为 Android 验收。

| 能力 | 电脑端源码 | 手机端现状与差异 | 迁移或适配方案 |
|---|---|---|---|
| Markdown 文件链接提取 | native-delivery/scanner.js | 已复用同源 scanner，限定工作区；代码块不会误识别 | 保留文件路径约束 |
| 文件资源行与悬停动作 | native-delivery/file-row.mjs、items-current.mjs | delivery-files.js 自有 DOM 卡片，尚未完整使用原组件 | 原 React Row/Card 及 scoped CSS 仍需移植 |
| 文件类型与图标 | native-preview/classify.mjs、classify-library.mjs、native-delivery/file-icon.mjs | 原类型映射范围少 | 本轮原样迁入分类核心及图标，交付卡片记录 preview kind |
| 文件列表折叠 | render.js / native-delivery | 手机已有三项折叠 | 对照原列表状态与键盘/触控操作继续验收 |
| 本地 Notebook | native-preview/notebook.mjs、adapter.jsx mountNotebook | 原 DocumentPreview.kind 不识别 ipynb | 本轮直接复用桌面 bundle 的 Notebook parser/cell/output UI，隔离 WebView 与只读文件桥 |
| Notebook HTML 输出 | notebook.mjs | 手机缺失 | 原组件 iframe sandbox 空权限，页面禁网络，HTML 输出空 sandbox 禁止脚本执行，原生桥仅能读取当前文件及保存视口位置 |
| Notebook Markdown 与代码输出 | native-preview/adapter.jsx | 手机缺失 | Notebook 原组件，宿主 Markdown 复用现有 markdown-it html:false；原高亮 worker 不在提供源码中，CSP 禁 worker触发原同步回退 |
| 音频、视频控制条 | native-preview/audio.mjs、player.mjs、adapter.jsx | RichPreview 用 MediaPlayer/VideoView，原组件缺失 | 需工作区限定媒体 Range 流与原播放器 dispose 生命周期 |
| 媒体范围流 | main/local-preview-media.cjs | 原生文件播放存在，WebView Range 尚未提供 | 将范围/状态契约接入 Android 资源响应 |
| 本地 HTML 预览与相对资源 | native-preview/html-current.mjs、adapter.jsx mountHTML | RichPreview 自有离线 HTML，脚本关闭 | 原 HTML resolver/opaque links 和 sandbox 页面需适配原生资源桥 |
| Markdown 文件预览 | adapter.jsx mountMarkdown、native-steering | RichPreview 用 markdown-it，非完整原格式组件 | 原 steering formatted-text 及安全本地链接宿主仍待迁移 |
| 图片生成过程与结果 | native-image-preview/tool-adapter.jsx、tool.js | generated-images.js DOM图卡、数据URL/工作区图片、放大 | 原生成过程组件依赖共同预览宿主与原 image runtime，尚待接入 |
| 图片查看器与多图切换 | native-image-preview/common、bootstrap.js | 手机放大图弹层，控制有限 | 原公共查看器需触控适配与受限URL解析 |
| 图片选择与编辑动作 | cloud-image-selection.js、cloud-image-viewer.js | 手机缺少对应云端图片编辑流程 | 依赖云端授权及资源下载契约，不能只显示动作按钮 |
| PDF连续预览、查找、注释层 | cloud-pdf-frame.mjs、cloud-pdf-continuous.mjs、main/office-preview.js | 原生 PdfRenderer 逐页，缺少同源连续层和查找 | 桌面已具独立 sandbox PDF.js 页，可适配只读资源服务 |
| DOCX分页、搜索与缩放 | cloud-docx-frame.js、main/office-preview.js | DocumentPreview OOXML文本及OfficeLayoutPreview渲染入口 | 原独立文档引擎及资源加载需接入 |
| XLSX样式、合并、工作表与搜索 | main/office-preview-worker.js、renderer/office-preview.js | 手机基础OOXML预览和另行排版入口 | 复用原worker/渲染数据协议，补Android离线执行宿主 |
| PPTX缩略图与页导航 | 同上 | 手机排版入口与原桌面交互仍有差异 | 原查看器接入本地输出资源 |
| CSV/TSV、文本、代码、Tex分类 | classify-library.mjs、workspace.js | 文本预览存在，格式识别范围不同 | 原分类已迁，实际富预览分支仍待完成 |
| 文件打开、另存、路径定位 | main/workspace-file-actions.js、local-preview-files.cjs | 手机支持预览、导出与编辑，系统位置需移动端文件选择适配 | 保留工作区校验，Android SAF实现系统交付 |
| 文档来源校验与体积上限 | main/local-preview-files.cjs | WorkspaceFiles、DocumentPreview有本地路径和读取限制 | Notebook桥限定单文件16MiB，不扩大工作区访问 |
| 云端资料库、Drive原生预览 | classify-library.mjs、cloud-library.js、main/cloud-library.js | 非同等云端资料库 | 依赖云端资源API、账号、下载缓存，单独迁移完整链路 |

## 本轮实际新增

- desktop-preview-types.js 由原始 classify.mjs、classify-library.mjs 构建，原始副本及 SHA 保存在 delivery/SOURCE.json。
- desktop-notebook-bundle.js 为电脑端 native-preview/bundle.js 原样复制的 ESM。desktop-notebook.html/js 仅提供手机只读宿主、主题和 Markdown 适配。
- 主任务负责 DesktopNotebookPreview.java、WorkspacePreviewActivity 入口、资源白名单及真机运行。
- UI不宣称完整桌面预览能力已对齐。上述未接入分支继续保留为缺口。

本子任务未下载依赖。测试采用已有浏览器和桌面现有 esbuild。新增源码副本、可复现构建脚本、生产资源及回归测试继续用于构建和验收，检查后无需清理。
