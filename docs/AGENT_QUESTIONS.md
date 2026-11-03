# Android 代理提问交互

实现：`probe/assets/agent-questions.js`。源码依据是桌面 Eva 0.2.0 `src/renderer/actions.js` 的 request 分类，以及 `ui.js` 的 `buildQuestion`；协议依据本项目诊断用内核源码 `ToolRequestUserInputParams/Response`。

支持 `item/tool/requestUserInput` 的单个或多个问题，选项说明、自由文本和 secret 输入。无预选，不自动提交；回复使用原始 RPC ID，结构为 `{answers:{questionId:{answers:[value]}}}`。对 API 进程的带前缀字符串 ID 不做转换，由宿主路由。

取消按钮明确为“停止任务”，发送原 thread/turn 的 `turn/interrupt`，不伪造空答案。问题在 `serverRequest/resolved`、对应 `turn/completed` 或内核退出时清理。提交后保持“回答已提交，等待处理”，防止重复点击；桥接异常时允许再次手动提交。内核异步写失败仍需宿主向页面提供错误事件，不能将同步 JavaScript bridge 返回当成服务端确认。

草稿规则：非 secret 答案保存在 UI 状态；secret 答案仅在当前页面内存中。请求 ID 不落盘，也不从已保存历史重建待回复 RPC。WebView 重载时仅通过可选的 `EvaHost.pendingQuestions()` 恢复仍属于活内核连接的请求，再匹配草稿，绝不自动重发答案。

宿主集成要求：

1. index 最后加载脚本；ShellActivity 资源名单放行该 JS。
2. `pendingQuestions()` 返回实时未响应请求数组。响应成功写入、resolved、turn complete、所属进程退出时移除；不要把这一集合存入 SharedPreferences。
3. API 进程的 `serverRequest/resolved.params.requestId` 须和请求 `id` 使用一致的 `api:` 路由编码。

自动化验证：`node tools/test-agent-questions.cjs` 已通过，覆盖多问题、选项与自由输入、输入校验、文字转义、secret 不持久化、流式更新保留输入节点、JSON-RPC ID、去重、结束清理和取消。当前是前端协议测试，尚不宣称真实模型 request_user_input 已通过真机验收。
