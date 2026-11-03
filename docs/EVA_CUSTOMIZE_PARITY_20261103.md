# 插件页对照 Eva 修订（2026-11-03）

用户截图指出上一版仅复用分类图标与设置列表，未对齐 Eva 自定义页。

本次只读参考桌面 src/renderer/customize.js 的 customizeIcon、customizeCard 和内置分组，原 SVG 来自 renderer/assets/builtin-plugins。来源及哈希见 research/eva-extension-assets.json。内联 SVG 的渐变/滤镜 ID 加图标名前缀，避免同页多个 SVG 引用串色。

- 插件/技能/MCP 共用自定义导航，插件顶部搜索、刷新、在线目录与添加来源入口。
- 插件分已安装/可添加，主行进入详情，行尾进入管理或安装详情。小屏单列，650px 起两列。
- 原有内置浏览器和办公模块以五个彩色图标展示。办公项进入已有办公依赖管理，并非新注册了五个插件或宣称依赖就绪；使用“管理依赖”而非伪造启用对号。
- 插件自己的本机 PNG/JPEG/WebP/GIF 图标按 interface logo/icon 字段加载，限制 Linux 工作区/插件/技能目录、规范路径、256KiB、4096px 和实际图片格式，转 data URL。远程图标和未支持的 SVG 插件 logo 仍回退分类图标，不冒称完整图标兼容。
- 内置 SVG 是随包可信资产；不把插件提供的任意 SVG 注入 DOM。

本机：plugin-manager、extension-lists、skill-manager、mcp-settings 回归通过；模拟截图 artifacts/extension-lists/plugins.png 已目视检查。APK 构建成功。真实账号目录可用性和每个插件 logo 是否存在仍取决于内核返回的数据。
