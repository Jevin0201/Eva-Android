# 电脑端交互能力差异审查

本次只读取 Eva-Source/src/renderer 与 src/main。下表基于已读实现，源码存在与真机验收分别判断。Android 既有功能仍需逐项核验，不能仅以同名文件判定等价。

| 能力 | 电脑端实现 | 手机对应与差异 |
|---|---|---|
| 活动状态优先级、未读完成 | thread-activity.js | desktop-thread-activity.js 已迁核心，宿主生命周期已适配 |
| 引导消息乐观展示、客户端身份回显去重 | steering-state.js、native-steering | 状态核心已迁，完整展示组件仍需对齐 |
| 立即引导与显式排队意图 | follow-ups.js、native-queue | 手机默认 turn/steer，缺显式队列管理与行操作 |
| 同步多问题原组件 | ui.js buildQuestion、native-user-input | 本批原样迁 bundle，触控选择/多题翻页/自由回答/秘密编辑/停止及卸载测试通过，真机待验收 |
| agentMessage 内异步 question 标记及答案回显 | native-user-input-host.js scan/hydrate/displayReply | 手机 agent-questions.js 只处理阻塞 RPC，缺完整异步提问面板 |
| 异步问题跨回合归属和直播到达触发 | native-user-input-host.js observeItem | 缺桌面 live item 所有权、选择组、关闭/重开流程 |
| 文本范围绑定引用、原子删除、Undo/Redo | composer-input.js、composer-reference-editing.js | composer-references.js 有选择与调用，缺完整范围编辑与撤销恢复 |
| 图片和文件粘贴、拖放与目录判别 | composer-drop.js | 手机有原生附件挑选，缺拖放目录判别、剪贴板完整入口 |
| 草稿按会话、工作区隔离及冲突所有者 | drafts.js | Android 会话草稿已保存，缺跨窗口冲突所有者提示 |
| 受理状态未知时禁止自动重发与收据核对 | send-recovery.js、main/send-ledger.js | Android pendingSend/日志恢复可核对，缺完整输入指纹与桌面落盘收据状态机 |
| 运行中断记录与已审阅标记 | runtime-recovery.js | Android task-controls.js 有本地日志恢复，缺完整记录管理页 |
| 提示去重、历史记录及项目配置诊断 | runtime-warnings.js | 当前 kernelNotice 单行，缺提示记录面板与计数去重 |
| 额度、限流和断流的用户引导 | conversation-failures.js、render.js | 配额显示已有，错误分类尚未完全复用 |
| 对话标尺、回合预览、本地书签 | transcript-nav.js | 无等价手机入口 |
| 向下按钮的运行态、跟随阈值 | transcript-jump.js/css | 0.0.45 已迁标记和CSS并修复原生资源入口 |
| 流式DOM增量与历史滚动锚点 | transcript-dom.js、actions.js | 已有迁移和分页，版本差异需继续逐方法对比 |
| 已处理时长与结束时间冻结 | work-timer.js | 活动组件有状态，时长完整口径未对齐 |
| 账户可用性门禁 | model-access.js | 手机提供商配置与账号页独立，缺同源门禁状态机 |
| 临时侧聊天、父子会话导航 | main/sidechat-lifecycle.js、sidechat-drafts.js | Android subagents 有状态页，缺完整临时侧聊天生命周期 |
| 键盘快捷键、可访问性焦点 | keybindings-core.js、accessibility.js | Android 键盘有适配，需确认外接键盘语义与屏幕阅读器 |
| 工作区保护和只读子会话 | native-workspace-protection.js | 部分 importedReadOnly 判断，缺全面宿主保护提示 |

优先顺序为提问组件、异步提问、收据与引用编辑，再到回合标尺、提示记录、队列与跨会话导航。原始桌面组件与业务状态复用优先，手机层承接数据保存、触控和内核桥接。

## 本批落地与清理

`probe/assets/desktop-user-input.js` 原样来自电脑端 native-user-input/bundle.js，SHA256 见 QUESTION_SOURCE.json。宿主适配保留原请求身份、重复回放防护、非秘密草稿保存和停止语义。提交后卸载原编辑器，秘密只存在于内存及必要RPC回复，完成或解决事件清理请求root。外观使用组件自带ShadowRoot CSS，Android只提供外围间距和主题同步。

现有 test-agent-questions.cjs 入口已切换至 test-desktop-questions.cjs 的电脑端契约。完整页面测试覆盖多题自动翻页、触控选择提交、自由答案、秘密不落盘、流式及完整render同一root、提交清秘密编辑器、重复事件、忽略中止及完成卸载。原生资源加载入口与真机由主代理整合验证。

本轮没有下载或生成临时依赖，源码组件、来源记录和测试均为后续构建所需。检查本轮文件后无需清理。未检查整台电脑或其他项目缓存。
