# 电脑端 0.2.7 迁移状态

来源限定为 Eva-Source 的 src/renderer 和 src/main。SOURCE.json 固定了 1164 个文件的路径、大小和 SHA256。源码清单仅表示本次对照基线。

## 子智能体深入审查与 0.0.46

三路审查分别记录 21 项交互、22 类交付预览、38 个运行与扩展能力域，部分主题交叉，不能相加视为独立功能总数。

- [交互差异表](INTERACTION_AUDIT.md)覆盖同步与异步提问、引用编辑、草稿所有权、收据、回合标尺、书签及侧聊天。
- [交付预览差异表](DELIVERY_AUDIT.md)覆盖 Notebook、音视频、HTML、Markdown、图片生成与公共查看器、PDF/Office 及云端资源。
- [运行与扩展差异表](RUNTIME_AUDIT.md)覆盖发送账本、恢复、账号模型、插件技能、MCP、自动化、子代理、跨聊天消息、工作树、浏览器、听写和云产品。

0.0.46 已保留数据覆盖安装，仍为 28 个对话。本批实际迁入以下电脑端实现。

- native-user-input/bundle.js 原样装入，Android 提问宿主使用原问题组件。完整页面测试覆盖多题翻页、触控选项提交、原 RPC ID、重复防护、秘密不落盘、流式/完整刷新保留 root、停止及完成清理。真机确认资源与 API 加载，未用云模型生成新的提问任务。
- native-preview/bundle.js 原样装入独立 Notebook 页面。只读桥限定当前工作区文件、16 MiB 和有效 UTF-8，打开文件描述符后再次校验实际路径。真机通过正常文件预览入口渲染含 40 个代码单元及输出的文件，保存 CSS 像素视口位置。长文档重建恢复和触摸接管在浏览器测试通过。HTML 输出保留原组件空 sandbox，页面禁网络和 file/content 访问。
- 原文件分类核心及原文件图标用于交付卡片。Notebook、Office、媒体、Windows 路径和云 Drive 来源分类测试通过。
- runtime-warnings.js 和 conversation-failures.js 原核心装入，设置 → 关于与诊断 → 运行提示记录可查看。页面事件与原生入口检查通过，真机确认弹窗可达。

来源及哈希见 QUESTION_SOURCE.json、delivery/SOURCE.json 和 diagnostics/SOURCE.json。真机结果保存在 artifacts/diagnosis-20261105/v46-main-native.json 与 v46-notebook-native.json。

本批尚未迁入完整发送账本、异步问题面板、原文件行、完整图片查看器、音视频原播放器、PDF/Office 同源引擎、自动化和云端资源管理。后续逐项按三份差异表推进并分别验收。

安全清理已检查本批临时内容。真机 Notebook 测试文件和两次测试建立的目录均已删除。保留源码溯源、测试、验证记录、签名 APK、升级备份和构建依赖用于后续开发及回退。

## 本批完成

- thread-activity.js 的完整状态核心原样使用 CommonJS 分支，Android 适配会话存储、侧栏与生命周期。运行旋转标记、出错与未读状态已接入。
- steering-state.js 原样使用 CommonJS 分支。运行中引导立即显示，回显按客户端 ID 和输入去重，展示覆盖层不写入内核历史。默认操作继续调用 turn/steer。
- transcript-jump 的按钮标记和 CSS 已迁移，Android 使用触控与异步布局滚动适配。修复 chat-scroll.js/css 未列入原生资源白名单的问题。
- 0.0.45 已保留数据覆盖安装。真机验证脚本加载、初始到底、向上翻阅显示 32×32 圆形按钮、点击返回最新。记录位于 artifacts/diagnosis-20261105/v45-runtime-real.json。
- 电脑端引导核心原测试迁入后 30 项通过。滚动与任务控制完整页面测试通过。

## 待迁入及验收

- 电脑端 native-user-input 的完整同步和异步提问组件及宿主状态。Android 当前仍有原协议提问适配。
- native-preview、native-image-preview、native-delivery 的完整组件和生成图片交付流程。Android 已有预览入口，组件及行为尚需对齐。
- 完整 send-ledger 受理核对、native-steering 展示组件、技能详情及编辑引用体验。
- 桌面其余功能按 SOURCE.json 和实施主清单继续逐项核对宿主接口与真实入口，尚未逐项完成。

本批临时诊断脚本 tools/.diagnose-desktop-sync.cjs 已核实路径后删除。来源快照、真机记录、升级前数据备份、签名 APK 和构建依赖保留供验收、回退及后续迁移使用。tmp 目录检查未发现本批可清理内容。
