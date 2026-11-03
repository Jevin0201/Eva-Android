# 桌面扩展能力迁移 · Android 0.0.34

## 范围与来源

本轮以桌面 Eva 源码为准迁移插件和技能，不继续用简化列表代替完整页面。桌面源码仅只读，未修改桌面用户数据、凭据或正式安装。来源路径、原文件 SHA-256、适配分层与生成文件 SHA-256 见 `migration/desktop-extensions/source.json`。源码目录名称较旧，实际 package.json 为 0.2.0。

保留桌面 Customize、PluginDetail、NativePluginAddHost 的功能和样式；Android 只适配窄屏布局、导航、原生文件选择、工作区路径、图片资源与原生内核 RPC。原始副本位于迁移目录 src，适配后的渲染器分为 head / renderer / tail，可用 `python tools/build-desktop-extensions.py` 重建。

## 已接入

- ChatGPT 登录账号的公开目录、个人／共享／工作区目录以及本机已安装插件的三路聚合，保留来源错误、精选、分类、公开／个人标签、已安装导航和搜索。
- 插件完整详情：介绍、示例、截图、附带技能、应用授权入口、MCP、Hooks、开发者、政策和网站。安装插件不等同于应用服务已授权。
- 个人／系统／插件技能分类、实际 SKILL.md 读取、启停、安装／卸载、应用到对话。创建插件准备可审阅草稿，不自动发起任务。
- 原版添加菜单及对应桥接：Git 市场、插件 ZIP/TGZ 导入、本地 MCP 配置与 OAuth 请求。创建 MCP 的 URL／认证能力沿用桌面当前 LocalPluginAuthoring，仍属本地配置；OpenAI 隧道、手动 OAuth 高级配置、MCP 图标上传不在原桌面实现的支持范围内，不伪装为云端创建。
- Logo 元数据保留真实本地／远程地址及深色版本，按需加载；本地 SVG／位图通过受限图片边界读取，HTTPS 图片允许实际下载。无 Logo 时才回退到通用图标，不制造品牌图标。不是预下载全目录数万张图片。
- 修正全局 SVG 强制描边：仅 Eva 自有线性图标使用线条样式，Logo、原版实心图标保留填充和线条。
- 技能预览将 YAML 文件头保留在可展开的“技能元信息”，正文单独渲染，避免 description 被 Markdown Setext 规则放大成粗黑标题。正文 14px／400，主标题 20px／600；不修改原文件。

## 性能与隔离

技能与插件分别返回、分别显示，慢插件不阻塞技能；进行中请求去重，元数据缓存 60 秒，账号变化／扩展修改后失效。`$` 只读取技能，发送时只验证选中的能力类别。新目录依然受网络速度影响，不把缓存耗时当作首次联网耗时。

账号运行时启用 Apps；API 密钥运行时保持独立认证。图片边界拒绝凭据路径、越界及符号链接，SVG 以 image 加载并附 sandbox CSP。压缩包限制、路径／链接检查沿用原作者实现；ZIP 流适配器为本项目代码，以替代存在许可证不明确传递依赖的 unzipper。tar-stream、React 等实际依赖许可证随 assets 提供。

## 验证记录（2026-11-03）

真机为已连接的 Android 17 ARM64 手机，开发 APK 覆盖安装，未清除应用数据。

- VPN 恢复后，完整目录实读 10,252 项（公开 10,250、个人 2），已安装 9 项，技能 40 项，来源及页面错误均为 0；全目录两轮读取约 9.6–10.9 秒。服务端目录持续变化，此数值不是固定承诺。
- 本轮 10,246 项提供 Logo、4,098 项提供深色版本，6 项源端无 Logo。真机抽查可见 9 张真实远程图全部解码成功，样本原图宽 256px。
- 插件详情真实读取到应用资源；Plugin Creator 真实返回 3 项附带技能，SKILL.md 预览成功。没有为测试向外部账号发送消息或创建内容。
- 能力选择真机一次强制读取：技能先返回 53ms，技能与插件全部返回 184ms；随后同会话缓存重开约 0ms。强制桥接读取仍可能命中内核自身缓存。
- `test-desktop-extension-parity.cjs`：源页面账号聚合、公开／个人、已安装、完整详情、插件技能、原版添加菜单、浅／深图标、本地 SVG、YAML 元信息与正文排版、SVG 不再被全局描边。
- `test-desktop-authoring.cjs`：原作者市场 payload、ZIP/TGZ 导入注册安装、内容保持、MCP 配置与元信息、越界／链接拒绝；使用隔离夹具，不代表每个线上第三方 OAuth 已完成授权。
- `ExtensionMediaCheck` 真机 instrumentation：本地 SVG、sandbox 响应头、凭据／路径／链接拒绝通过。
- 能力读取、草稿、发送删除、模型选择、任务控制、流持久化、设置、MCP 设置及连接器交互回归通过。旧 plugin-manager／skill-manager 列表测试的旧页面选择器不作为新桌面源码页面验收依据。

本轮不包含 ChatGPT 历史对话、图片和文件库同步，也不声称每一个线上服务都已逐项授权／执行验证。手机完整代理、初始化和 APK 自助构建的整体状态仍以项目实施清单为准。

## 重建

1. `python tools/build-desktop-extensions.py`
2. 如修改作者桥接，用 `node tools/build-desktop-authoring.cjs` 重建 Node bundle；脚本只读指定桌面 node_modules，来源记录与许可证需同时更新。
3. `powershell -ExecutionPolicy Bypass -File tools/build-probe.ps1`

开发包：`outputs/eva-android-0.0.34-extensions.apk`。这仍是开发版本，不是完整产品的正式发布验收。
