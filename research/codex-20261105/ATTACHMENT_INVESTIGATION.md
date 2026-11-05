# 附件与 400 调查（2026-11-05）

## 正式包证据

只读检查 `/Applications/ChatGPT.app/Contents/Resources/app.asar`，SHA-256 `0c951258b7ab381ec601045ffb02159e53f424548dda18e6a4dcfd126557383b`。未修改正式安装或用户数据。

REA 父证据 `ev_a57cc2cb3247398d1720feff2e6c7f99d59edc2edf8e55e079420c2856e86b09` 分析 `webview/assets/async/357959.de4ec41383.js`。eE（等待会话创建消息）读取独立 input 中的 image.url/localImage.path；附件容器 `flex max-w-full flex-row-reverse self-end overflow-x-auto`，内部 `flex min-w-max items-end gap-2`；BW 参数 `imageSource:"uploaded",useImageDialog:true`；整体 `flex flex-col items-end gap-2`；文字仅在非空或没有图片时渲染，并传 `hasExternalAttachments`。这是静态实现证据，且本次确认的是等待会话创建分支，不能外推所有历史消息分支。

候选包内片段见 attachment-candidates.json。24191 模块中的队列恢复也将文字与 imageAttachments 分开，localImage 保存 src 与 localPath。17982 模块在包含 image/localImage 时查询 model/list，并检查 inputModalities 是否支持 image。

REA 活动分组父证据 `ev_cd0d327e1c16a9d7439ba204d4be5851d3cb9fb219080ceb56c7b455ab234485`。所有分析仅解析静态文本，未执行正式模块。图关系覆盖不完整；存在部分 native 依赖完整性矛盾，不影响上述明确原文片段的存在，但不代表运行行为验证。

## 安卓仓库已确认

- probe/assets/models.js 的 kernelSend 将附件 name/path JSON 拼到正文，同时发送 localImage。task-controls.js 的引导发送有同类拼接。
- eva-flow-view.js 将图片放进 user-bubble，调用 window.mobileImages?.html；仓库未找到 mobileImages 的实现/注册。没有缩略图并非仅仅 CSS 间距问题。
- 同文件把 t.error.message 原样显示，因而截图里可以出现整段服务端错误 JSON。

## 400 边界

截图表明服务器拒绝 input[3].content：允许长度 0，实际长度 1。这是第 4 个输入条目的 content，不是文件字节数或图片尺寸限制。没有原始请求，不能确定该条目的 type/role，不能确认由图片、历史 reasoning、工具条目或提供商兼容性引起。不得用删掉图片、清空历史或盲目清空 content 当作修复。

本机无 adb，REA list_adb_devices 返回 capability_unavailable（selected adb binary not found）。未能取真机请求、运行时日志或重现；没有修改安卓产品功能、构建或安装新 APK。

## 后续实现要求

保留执行输入与显示模型的分离；图片在文字气泡上方独立显示、点击预览，文件展示文件名卡片。旧历史中明确的附件描述应结构化解析，避免把任意用户正文误删。发送中、引导、重开历史均须覆盖。对比同一张图在新会话和原会话的脱敏请求，先确定 input[3] 的 type/role/content，再修正具体序列化分支；验证云端实际识图成功，不能只验证缩略图。
