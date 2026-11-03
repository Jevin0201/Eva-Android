# 0.0.35 · 同一对话切换提供商

用户在已有 OpenAI 对话选择 DeepSeek 后，发送时报 `This chat uses openai, but your current provider is …`。界面此前已保存模型选择、清理恢复缓存，并在发送前请求 thread/resume，但当前固定版本内核拒绝跨提供商直接恢复。这条真实协议限制未被原先的界面夹具覆盖。

## 修复

参照只读桌面源码 `src/main/isolated-server.js` 的 switchProvider：跨提供商时使用 thread/fork 继承历史。Android 保留现有本地对话 ID、标题、工作区、草稿和设置，仅更新当前内核 thread ID，并记录 previousKernelThreadIds。原始内核记录保留。

`ProviderSwitch` 只对 thread/resume 的明确提供商冲突执行一次 fork；恢复返回了旧提供商时也必须通过 fork 的提供商／模型校验。普通网络错误不触发 fork，turn/start 不自动重试。原有权限校验继续执行。发送失败时，继承的历史不算新接收回合，输入恢复为草稿。

## 验证

- 真机固定 Codex 内核、独立测试目录和手机本地 SSE 模型夹具：建立 A 提供商对话并完成一轮；切换 B 直接 resume，复现用户同类报错；fork 后继续成功，当前记录有两轮，原始记录仍一轮；动态手机工具定义保留。未使用用户凭据、未发送用户历史、未调用手机操作工具或重新执行抓包。脚本 `tools/check-provider-switch-core-device.py`。
- 原生 `ProviderSwitchCheck`：真实适配算法、夹具传输；明确冲突一次 resume／一次 fork；提供商／模型确认、历史来源、相同提供商无 fork、网络失败不重试、任务提交不重试。
- `test-desktop-model-control.cjs`：同一界面对话切换、草稿、历史、当前内核 ID 更新与来源记录；迁移后发送被拒绝时仍保留草稿，且只提交一次。
- 发送删除与任务控制回归通过。

开发包 `outputs/eva-android-0.0.35-model-switch.apk`，覆盖安装保留应用数据。上述测试不代表已重新执行用户的美团抓包任务。
