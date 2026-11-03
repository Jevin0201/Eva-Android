# 工作区与办公能力增量

## 本轮实现

- 文件页菜单：新建文本文件/目录、系统文件选择器导入、未保存草稿恢复、Git、办公环境入口。导入最多 64 MB，拒绝覆盖同名文件。
- UTF-8 文本编辑：最多 256 KB，保存前比较 SHA-256 版本，原子替换并保留 POSIX 权限。链接路径、二进制和非法 UTF-8 拒绝编辑。
- 私有草稿：页面离开与重建后恢复；代理修改原文时拒绝覆盖，原文件被删除后仍可从“未保存草稿”恢复并另存。
- 对话内工作区文件链接可打开原生预览或文件页；PDF 原生逐页预览、图片按尺寸采样预览、系统保存位置导出。不会把工作区文件作为可信网页加载。
- 本地 Git：状态、差异、初始化、暂存/取消暂存、明确确认后的本地提交。见 [Git 实现与边界](WORKSPACE_GIT.md)。
- 办公运行环境：手机检查、安装/修复、四格式样例；模型可调用 schema/create/inspect。见 [办公运行环境](OFFICE_RUNTIME.md)。

入口：设置 → 文件；文件页右上角“文件操作”。办公也可直接从设置 → 办公文档进入。所有新增页面使用现有原生工具页样式。

## 验收证据

- `tools/WorkspaceEditorTest.java`：主机 33 项检查通过。
- `artifacts/workspace/native-checks.json`：真机中文/emoji、冲突拒绝、边界、符号链接、执行位保留、两页 PDF 实际渲染通过。
- 同一报告的 `editorUi`：实际 Activity 保存、重建恢复、原文删除后草稿恢复、PDF 页码恢复通过。此项是程序驱动真实 Activity 对象，不等同触屏端到端。
- `artifacts/office/native-ui.json`：实际点击手机页面的生成按钮，DOCX/XLSX/PPTX/PDF 均生成并回读通过。
- `artifacts/office/roundtrip.json`、`safety.json`：四格式内容与 7 项边界检查；输出保留在工作区 `office-checks/`。
- `artifacts/office/model-deepseek.json` 与 `model-files.json`：DeepSeek 真实读取工具 schema、生成 PDF/XLSX、inspect 回读；独立检查文件内容和公式通过。OpenAI 本次调用返回 `workspace routing discovery failed`，记录在 `model-turn.json`，不能算通过；原因尚未确定。
- Git 后端 21 项检查通过；真实工作区存在上级 `.git` 的隔离回归通过；`artifacts/git/native-ui.json` 原生初始化/暂存/提交/实际页面显示及测试清理通过。
- DeepSeek 回复中的 PDF 链接已实际点击，打开原生预览并核对中文显示，截图 `artifacts/office/pdf-device.png`。Playwright 等待 WebView 导航超时，但 Android 页面检查与截图确认原生跳转成功。

## 未完成与限制

- Office 结构生成和内容读取已接入；DOCX/PPTX 视觉渲染、复杂文档兼容、Excel 公式计算、PDF 编辑/OCR 尚未接入。
- 系统文件选择器导入导出的完整手工流程、低存储和安装途中进程回收仍需专项验收。
- 文本保存会检测已观察到的外部修改，但其他进程不遵守同一锁，校验与原子替换之间的极短竞态不能完全消除。
- Git 远程认证/推送、分支切换、冲突编辑、LFS、worktree 尚未完成；不把基础本地版本管理表述为完整 Git 工作区。
- APK 构建链、手机独立初始化升级、高级会话排队、自动化与长期后台生命周期仍是下一批主线。
