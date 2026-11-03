# 模型切换保留当前对话

2026-11-03：桌面迁移的 `selectProviderModel` 在 provider 改变且已有 thread 时调用 `startNewThread`，导致 Android 清空 active 并进入首页。

为迁移组件增加可选的 `preserveThreadOnProviderChange` 策略，Android 启用；模型菜单外观与其他桌面逻辑保持。选择后保留本地 chat ID、内核 thread ID、历史、草稿及附件。清除此 thread 的全部加载缓存标记，保证 A → B → A 也会重新 resume。

原生层在跨提供商恢复前取消旧进程的 thread 订阅，避免内核忽略已加载且仍被订阅的 thread 的 provider 覆盖。恢复后验证响应的 modelProvider，按响应更新路由；不一致时报错并保留原对话，不退回新建。

验证：`test-desktop-model-control.cjs` 覆盖 DeepSeek → OpenAI → DeepSeek 后对话、历史和草稿不变，并确认继续发送仅调用原 ID 的 thread/resume、turn/start，没有 thread/start。`test-chat-drafts.cjs`、`test-model-panels.cjs` 通过。Android 构建通过。以上前端回归使用协议桩；尚未进行两家云模型交替生成的完整真机验收。
