# 扩展管理列表改版（2026-11-03）

插件、技能、MCP 使用统一纵向列表：Eva SVG 图标、名称、两行用途简介、配置启用状态和详情箭头。已启用指配置状态，不冒充已连接或可调用。

技能与 MCP 点击列表项展开管理操作，插件点击进入既有详情管理。技能和 MCP 新增搜索；插件沿用名称/功能/来源搜索。新增 MCP 表单与插件来源默认折叠。技能路径移到展开详情，减少首屏技术文字。

图标来自项目内迁移副本 migration/eva-0.2.0-permissions/icons.js，使用 plugin/book/tool/chevronRight，仅抽取静态 SVG；未使用外部图标 URL，也不执行目录提供的 SVG/HTML。新公共脚本 extension-list.js 已加入本地 WebView 资源白名单。

验证：test-extension-lists（列表、搜索、默认折叠、320/390/600宽度）、test-skill-manager（编辑与失败草稿、删除、启停、范围）、test-mcp-settings（连接测试、资源/保存/启停协议）、test-plugin-manager（详情转义、安装、启停验证、卸载取消/确认、搜索、远端加载）通过。模拟截图在 artifacts/extension-lists，非真机截图。APK 构建成功并覆盖安装。未在用户真实配置上执行安装/删除/启停。
