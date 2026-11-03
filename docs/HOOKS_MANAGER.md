# 生命周期钩子管理

`probe/assets/hooks-settings.js` 对照桌面 `src/renderer/hook-settings.js` 与内核 `HooksListParams`、`HookMetadata`、`ConfigBatchWriteParams` 接入。

已有：当前项目作用域列表；事件、完整命令或 MCP 服务/工具、来源、匹配条件、超时及指纹；受管只读；未信任/已改变内容必须先明确确认信任；启停；配置错误与警告。写入后重新读取并校验，拒绝把被覆盖的设置报告为成功；有正在执行的任务时不修改配置。

宿主接线：

- 加载 `/hooks-settings.js` 并加入 WebView 资源名单。
- 开放 `hooks/list`。
- 开放受限 `config/batchWrite`：只允许 `hooks.state.<JSON quoted hook key>.enabled` 布尔值与 `.trusted_hash` 字符串；`reloadUserConfig=true`；不允许借此任意修改其他配置或写到外部文件。
- 开启 `features.codex_hooks`，保留原有信任验证，不设置 `bypass_hook_trust`。禁用此 feature 时内核会返回空 hooks，不能据此宣称功能验收通过。

`node tools/test-hooks-settings.cjs` 通过：命令转义、来源和警告、管理员只读、确认取消/信任、正确 keyPath、启停回读、策略覆盖错误、指纹变化重新信任、加载失败。此为协议桩 UI 回归，尚未包含真机钩子执行结果。

未包含钩子命令编辑器、运行历史独立页面。页面显示现有真实配置，不自动创建或执行钩子，也不把“已信任”视为已验证命令效果。
