# 模型与额度交互优化 · 0.0.18

直接对照桌面 Eva 的 src/renderer/composer.js 与 account-quota.js。

- 输入框模型按钮直接打开底部模型面板；模型名称、描述、选中标记、搜索、推理强度滑杆、默认强度恢复、快速/标准速度。
- 推理选项与快速服务层来自内核 model/list，未提供的能力不伪造。选择的 effort/serviceTier 实际传入 turn/start。
- 默认设置用于新会话；当前会话可调整同提供商模型，运行中不能切换，跨提供商提示新建会话。
- 侧栏提供“账号与额度”直接入口。底部面板展示账号/套餐、剩余百分比、进度条、重置时间、刷新与折叠详情。
- 额度逻辑直接复用桌面 account-quota.js 的 quotaView/renderWindow，保留其套餐窗口规则。导入时仅向浏览器暴露 desktopQuota 导出用于 Android 宿主；未更改额度归一化函数。
- 原生账号页负责登录管理，模型与额度入口返回统一面板。
- 修复多 ShellActivity 实例竞争 kernelDrain 的问题：主页面 singleTask、onNewIntent 接收面板请求、后台页面停止轮询；请求增加超时提示。

验证：tools/test-model-panels.cjs 覆盖模型选择、强度、快速服务层、持久化、turn 参数、桌面额度窗口、窄屏、系统返回。原有模型、会话、设置测试通过。模拟截图在 artifacts/model-panels-0.0.18/*-fixture.png。

真机安装 0.0.18，已读取真实登录账号的 Pro 额度：7 天限额、剩余比例和重置时间正常显示。真实账号截图仅存本机 artifacts，包含账号标识，不作为公共展示图。未为此次 UI 验证发送模型任务。
