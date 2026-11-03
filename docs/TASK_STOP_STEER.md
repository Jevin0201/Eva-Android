# 任务停止与执行中引导

2026-11-03：对照桌面 `src/renderer/actions.js` 的 turn/steer（threadId、expectedTurnId、input）和 turn/interrupt 接入 Android。

- 执行中输入框提供“引导”，旁边独立“停止”；停止不再被 kernelBusy 禁用。
- 初次发送尚未拿到 turn ID 时记录取消请求：未调用 turn/start 则取消发送并恢复草稿，已经提交则取得 turn ID 后发送 interrupt。
- 引导只发往原活动 turn；失败保留文字，不自动新建 turn 或重发。支持工作区附件及图片。
- interrupt 到达宿主后标记 turn 已取消，拒绝其排队的手机/浏览器操作，并取消当前手机后续观察、shell 和浏览器待执行 future。已派发到 Android 的实际点击无法撤销；内核中断仍需等待确认。
- 打开应用时校准保存的 running 状态；停止报错时读取真实历史核对是否已结束，避免卡在“执行中”。

用户报告的当前卡住任务：发送 interrupt 返回 thread not found；随后 thread/read 显示 notLoaded，最后 turn 为 interrupted。已同步前台为 running=false，保留全部 3 个历史 turn。没有重新发送原任务。

验证：test-task-controls.cjs 覆盖发送等待时可停止、同 turn 引导、完成事件、失败草稿恢复、早期取消、停止报错后校准历史；test-chat-send-delete.cjs 与 test-chat-drafts.cjs 通过。

## 真机云模型验收

在用户连接的手机上通过真实 WebView、EvaHost、app-server 和云模型测试，无模型或 RPC 桩。验收发现 task-controls.js 未加入 ShellActivity 资源名单，已修复，并增加资源名单回归断言。停止完成后的提示也改为“任务已停止”。

- OpenAI gpt-6.1-terra：活动 turn 中追加引导，模型最终回复指定 `STEER_ACCEPTED_7319`，引导与原消息属于同一 turn；终端 sleep 60 执行中点停止，99ms 后观察到 interrupted。
- DeepSeek deepseek-flash（high）：同样通过引导验收；sleep 60 执行中停止，101ms 后观察到 interrupted。
- 两次页面重载及最终 APK 安装后完整进程重启：controlsLoaded=true、running=false、最后 turn=interrupted，历史保留。

耗时为单次按钮点击到前台收到中断事件，不代表任意工具都能在 100ms 内停止，也不能撤销已经执行的点击。证据在 artifacts/task-controls/real-device.json 和 real-device-deepseek.json；复验脚本 tools/accept-task-controls.cjs。最终修复 APK 已安装。
