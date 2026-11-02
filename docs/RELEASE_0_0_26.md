# 0.0.26 — 浏览器弹窗、手机控制恢复、发送与删除

## 实现
- BrowserActivity 改为覆盖对话的原生窗口，复用原有 WebView、桌面兼容配置和导航栏。最大化/还原不重建网页。
- 收起为 52dp 悬浮球，拖动后吸附左右边缘，记录位置。隐藏网页保留布局尺寸。普通浏览器工具操作不自动展开。
- 新会话注入 eva_browser：open/show/observe/click/input/scroll/back/forward/screenshot，操作同一原生 WebView。远程页面无原生 JS bridge。跨域 iframe、下载与文件上传仍未全面实现。
- PhoneTaskService 每 3 秒检查连接，按用户持久开关恢复 armed 状态。恢复入口覆盖服务连接、打开应用、发送任务、应用更新、开机；系统限制仍可能阻止后台启动，不宣称强制永久开启。手动停止仍撤销保持状态。
- 当前测试手机通过 ADB 添加 Eva 到电池优化白名单。实际后台 app-op 默认 allow；无障碍设置已启用、服务已绑定、无崩溃记录。
- 原生 PhoneTaskReport 在任务结束处理结果通知、顶部可访问性浮层、条件返回发起对话；厂商系统灵动岛样式不保证。
- 发送立即生成待发送气泡并清空输入框，等待内核时保留输入 DOM 和下一条草稿；失败恢复原文。
- 会话在同一内核生命周期内复用，避免每条消息 resume；退出内核或失败清缓存。
- 流式事件同批刷新一次；500ms 合并会话保存；输入草稿 350ms 合并保存；缓存不再变化的已完成历史轮次 HTML。
- 右上角整理会话新增删除入口，确认后先归档 Codex 内核记录，再删除 Eva 本机对话、草稿和附件引用。工作区文件保留；不宣称从内核永久擦除。运行中禁止删除；失败保留本机记录。

## 验证
- APK 构建通过，安装包 probe/build/eva-probe.apk。
- 真机 BrowserTools 自检 PASS：收起后 viewport 不变、observe/input/click、拒绝旧 snapshot、截图。使用自建测试页面，不执行用户站点操作。
- tools/test-chat-send-delete.cjs：模拟延迟回复，验证立即显示消息、保留输入/信息流节点、下一条草稿、复用 resume、失败恢复、60 个事件仅一次刷新零次同步保存、删除取消与确认归档。
- tools/test-chat-scroll.cjs、test-sidebar-ui.cjs、test-shell-ui.cjs、test-settings-ui.cjs 通过。
- 未删除任何真实用户对话。模型端选择 eva_browser 的端到端真实任务、悬浮球手动拖动、整机重启恢复和厂商后台长时保活仍需后续实际使用验证。
