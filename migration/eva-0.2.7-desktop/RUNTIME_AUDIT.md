# 电脑端运行与扩展能力审查

2026-11-05。来源仅 Eva-Source 的 src/main 和 src/renderer。按 main.js 实际 IPC、scheduledDesktopRequest 的 rae 请求分支及对应页面核对。SOURCE.json 保留 1164 文件清单。以下“缺口”表示 Android 宿主或页面未见对应接入，源码存在与产品实测分别记录。此表为源码审查，本轮只对诊断模块执行页面测试。

| 能力 | 电脑端注册入口与实现 | Android 当前对应 | 差异及迁移路径 |
|---|---|---|---|
| 发送受理账本 | main/main.js 的 rae/send 分支、main/send-ledger.js | models.js pendingSend、ThreadRecovery.java | 缺持久指纹、并发 ID 核对、accepted/rejected/unknown 收据查询。需独立宿主服务，见下节 |
| 内核恢复 | main/runtime-recovery.js、renderer/runtime-recovery.js | ThreadRecovery.java、task-controls.js | 只有按会话恢复，缺统一中断列表、已核对标记和临时聊天清理记录 |
| 后台临时聊天清理 | main/sidechat-lifecycle.js、sidechat-drafts.js | 未见 sidechat 生命周期服务 | 先迁移关闭前 interrupt/确认，再建立 Android 独立窗口拥有者 |
| 错误/提示记录 | renderer/runtime-warnings.js、conversation-failures.js、actions.js | kernelNotice 临时状态 | 本批迁入原核心，记录回看、去重、额度/限流解释；需要设置入口与资源白名单 |
| 模型可用性检查 | renderer/model-access.js，main/model-catalog.js/model-discovery.js | ModelStore、KernelModelCatalog、账号模型页面 | 配置和发现已有；桌面登录门控状态机与显示细节需迁入 |
| API 提供商配置 | main/providers.js、renderer/deepseek-settings.js | ModelStore、ModelsActivity、ProviderHistoryProjection | Android 有独立密钥及跨提供商历史投影；迁移需保留这些 Android 已验证约束 |
| 登录/用量 | main/main.js 账号 IPC、renderer/account-quota.js | AccountActivity/AccountQuota、eva-account-quota.js | 已有协议接入，桌面定时刷新、账户选择与错误细节需逐入口验证 |
| 账号权限/验证 | main/chatgpt-request-verification.js、native-review-account.js、renderer/request-verification.js | AccountActivity、MCP 凭据页 | 缺完整网页验证窗口及授权恢复流程 |
| 技能插件商店 | main/plugin-sources.js、plugin-authoring.js，renderer/customize.js/plugin-detail.js | desktop-extensions.js、ExtensionAuthoring | 既有桌面迁移较早，需比较 0.2.7 的详情、来源管理、安装/更新及附带技能 |
| 本地插件开发 | main/local-plugin-authoring.js、renderer/native-plugin-add-host.js | desktop-authoring.cjs、原生导入 | 已有适配，完整原服务的依赖/源码检视和错误恢复需验证 |
| MCP OAuth 生命周期 | main/mcp-auth-lifecycle.js、renderer/actions.js OAuth 通知 | McpSettings、McpCredentialActivity | 缺过期/撤回/失败提示和回到设置刷新状态的完整循环 |
| Hooks | renderer/hook-settings.js | HookStore、hooks-settings.js | 基础配置已有；桌面事件类型和新字段需逐项比对 |
| 记忆 | main/eva-memories.js、renderer/memory-settings.js | MemoryStore、memory-settings.js | 基础列表/编辑已有，需对齐来源、范围、删除语义 |
| 心跳任务 | main/native-heartbeat.js/store/tools/mcp、renderer/native-heartbeat-page.js | 未见 Android heartbeat 宿主路由 | 缺任务存储、启停、执行回执与 UI；先迁原服务，再适配 Android 后台生命周期 |
| Cron 计划任务 | main/native-scheduled-cron.js、native-cron-runner-original.cjs | 未见对应计划调度宿主 | 需迁入原定时解析/任务状态，Android 调度与省电恢复单独适配 |
| 子代理拓扑 | renderer/subagents.js/subagent-topology.js | mobile-subagents.js | 已有子代理基础展示，桌面拓扑与停止后代、导航/恢复细节尚待对齐 |
| 跨聊天消息 | main/thread-messaging.js/tools、project-messages.js | 未见对应 Android 项目消息服务 | 缺聊天间路由、项目消息收件与状态，需复用原消息状态逻辑 |
| 会话归档/分支 | main/thread-links.js/thread-preferences.js/thread-creation.js | workflows.js、内核 thread fork/archive | 基础已有，缺完整分支来源链接、工作树种类与偏好提示 |
| 本地分享与导出 | main/local-thread-share.js、native-share-redaction.cjs/size.cjs、conversation:export | DataBackupActivity/Archive | 备份不是单会话分享；需迁移脱敏、大小限制、可读导出 |
| 项目工作区 | main/local-projects.js/projectless-workspaces.js、renderer/project-chat.js | workflows 项目树、FilesActivity | 文件和项目基础已有；桌面项目工作目录与上下文规则需统一接入 |
| 托管工作树 | workspace:managed-worktrees，main/managed-worktrees.js | GitActivity 基础 Git | 缺工作树创建/检查、模型偏好提示、归档队列与自动清理。应迁原服务与验证，不用简单 git 命令冒充 |
| 工作区保护 | main/workspace-protection.js、renderer/native-workspace-protection.js | 工具权限/路径校验 | 缺桌面完整保护策略、归档/文件操作共享判断 |
| Git 文件操作 | main/workspace-file-actions.js、renderer/file-context-menu.js | GitActivity、FilesActivity | 基础 Git/编辑已有，桌面复制路径、重命名、系统打开等菜单需原动作协议适配 |
| 文件监视与终端 | workspace:watch/unwatch、term:start/input/kill/resize，renderer/terminal-ui.js | TerminalActivity、LinuxRuntime | 命令执行已有；缺桌面多终端所有权、尺寸同步与文件监视 UI 闭环 |
| 内置浏览器标签 | browser:create/activate/navigate/destroy，main/browser-state.js | BrowserActivity/BrowserWindow | Android 已有独立内置浏览器。应迁移状态/用户行为，宿主用 WebView 实现 |
| 浏览器工具 | main/browser-tools.js、browser-bridge-mcp.js、browser-control | BrowserTools、BrowserSitePermissions | 已有 DOM/操作/截图权限，桌面工具面覆盖、会话拥有者与切标签细节需逐项核验 |
| 浏览器书签/密码/历史 | main/browser-bookmarks.js/browser-passwords.js/browser-state.js | BrowserActivity 设置/历史 | 原书签、密码解锁和导入需核对原生安全存储，不可直接复制桌面密钥 |
| 浏览器导入 | main/browser-profile-import.js/snapshot.js、renderer/browser-import | 未见完整 Android 档案导入 | 桌面操作系统格式专用，复用解析与状态，输入改为明确授权的文件导入 |
| 浏览器扩展与商店 | browser-extensions.js/browser-web-store.js/native-browser-session.js | Android WebView 无桌面扩展宿主 | 原扩展安装和 native messaging 需要实际可运行宿主，不能仅展示安装成功 |
| 全局听写 | dictation:command，main/native-dictation.js、renderer/global-dictation.js | VoiceAgent/VoiceAudio、voice.js | Android 有独立唤醒和浮窗；缺桌面云听写、恢复、历史、快捷键状态的同等接入 |
| 手机/电脑控制 | main/mac-computer-service.js/windows-computer-service.js/cua.js | PhoneTools/PhoneAccessibility/Shizuku | 平台宿主必须映射成手机控制。保留移动端现有真实权限检查与工具执行 |
| 连接 ChatGPT/云对话 | main/chatgpt-conversations.js/content.js，renderer/cloud-transcript.js/product-modes.js | 当前主要是本地代理内核对话 | 缺完整云会话产品模式、云账号验证和会话列表，不等同于配置 OpenAI API |
| 云项目 | main/chatgpt-projects.js、renderer/cloud-projects.js | 本地项目树 | 缺云项目协议与云附件生命周期 |
| 云图库/资源库 | main/cloud-library.js/chatgpt-library-*，renderer/chatgpt-gallery.js/library-* | 生成图片本地预览 | 缺云资源列表、检索、改名、批量管理和原下载链路 |
| Sites 分享/计划/分析 | main/chatgpt-sites.js/sites-detail-commands.cjs、renderer/sites-* | 插件入口 | 调用插件与完整产品管理页不同，缺详情/分享/分析/计划 UI 和对应宿主 |
| 通知、快捷键、可访问性 | main/desktop-notifications.js/keybindings.js、renderer/notification-settings.js/keybindings-core.js/accessibility.js | PhoneTaskService 通知、keyboard.js | 需移植通知偏好和快捷键核心，并映射 Android 返回键/外接键盘/无障碍语义 |
| 窗口、标签、多任务 | win:new-window/cycle/zoom，renderer/tabs.js/panel-resize.js | 单 Activity 聊天及多个工具 Activity | 桌面窗口布局需要 Android 分屏/返回栈适配，业务会话生命周期仍可复用 |
| 更新发布 | main/release-manager.js | 当前签名 APK 覆盖安装工具 | 缺应用内版本检查、下载验证与保留数据升级入口 |

## send-ledger 迁入接口

已读 main/send-ledger.js 的 execute/dispatch/history/status/observe/interrupted。其核心依赖 Node crypto、atomic-json 和内核 request，使用输入 SHA256 而不把私有输入正文落到持久账本。现有 Android pendingSend 不能替代完整收据服务。

建议在手机 Linux 运行时原样运行 Node SendLedger，由 Java 以受控本机协议访问。若 Android 原生承载，需要严格迁移等价状态机并逐项跑桌面 fixture。最小宿主合同如下。

- execute(method,params,id) 校验同一 ID 的 method/thread/input 指纹，串行保护同一聊天，调用前保存 pending 与已有 turn IDs。实现 rae/send/execute 对接后才切换发送路径。
- status(id,input) 仅返回 accepted/rejected/unknown 及精简 turn 结果。unknown 文本发送只在新历史唯一匹配且无图像时确认。带附件不能靠文本确认。
- observe(turn/started) 用新 turn ID 受理收据。进程退出 interrupted() 将 pending 改 unknown。
- request(thread/read includeTurns:false、thread/turns/list、turn/start、turn/steer) 继续复用当前内核与分页合同。
- validateThread/authorize 接入手机路径与权限约束；文件存储放 Android 私有运行目录，采用事务/原子替换。
- 前端原样复用 renderer/send-recovery.js 状态语义，Android 适配输入框、附件和收据查询入口。必须保留现有隔离未知发送的行为，不能在迁入途中自动重发。

本批没有迁入 send-ledger 的宿主执行服务，不能标记完成。它需要 KernelHost 的结构化错误 code、稳定请求 ID、进程退出通知和原子存储协同。

## 本批诊断迁移及清理

原样核心保存在 diagnostics/runtime-warnings.js 和 conversation-failures.js，来源 SHA 位于 diagnostics/SOURCE.json。desktop-runtime-diagnostics.js 仅适配 Android 弹窗、设置导航及事件。入口 action 为 runtime-diagnostics，宿主需白名单和页面 script 标签。

新增测试与源码属于后续开发所需。已检查本批未产生下载、安装包或临时依赖，无需清理。本轮未检查其他任务的构建目录。
