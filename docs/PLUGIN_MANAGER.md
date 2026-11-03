# Android 插件管理接入

实现文件：`probe/assets/plugin-manager.js`。对照桌面 Eva 0.2.0 的 `src/renderer/customize.js`、`plugin-detail.js`，使用同一 app-server 协议；Android 页面采用现有设置页布局，未复制桌面第三方组件。

## 实现范围

- 设置插件入口；本机与已安装插件列表、搜索、来源、版本、安装与启用状态。
- 详情读取及技能、MCP、应用连接、事件钩子清单。目录内容转义为文本。
- 安装、启停、卸载确认；完成后重新读取原生状态，不把请求返回当作生效。
- 添加 HTTPS Git／工作区内本地插件来源；来源更新。
- 默认只请求本地目录；在线目录由用户显式加载。
- 任务执行中阻止变更插件；授权仍未完成、受策略限制、目录与操作错误明确展示。

## 必须接入的宿主能力

index.html 加载脚本，ShellActivity 允许该资源；KernelHost 放行受约束的：

`plugin/installed`、`plugin/list`、`plugin/read`、`plugin/install`、`plugin/uninstall`、`marketplace/add`、`marketplace/upgrade`，以及仅限 `plugins.<JSON quoted id>.enabled` 的 `config/value/write`。

内核必须启用 `features.plugins`。源码 `request_processors/plugins.rs` 在禁用时会返回空目录而非错误；因此空目录不能证明接入成功。在线目录还需要 `remote_plugin` 及相应账号能力，不能把 API 提供商登录视为云插件服务授权。可继续关闭 `plugin_discovery_prefetch`，避免普通发送触发未配置服务发现。

## 验证与限制

`node tools/test-plugin-manager.cjs` 已通过，覆盖懒加载、本地/远程参数、详情转义、安装参数、启停结果不一致、取消/确认卸载、搜索与失败路径。该测试是协议桩，不能代替真机内核与模型验收。

`tools/create-plugin-fixture.py` 可通过 device-python.py 在自有工作区生成无第三方依赖的验收插件；包含技能 `eva-plugin-acceptance`，显式调用应答 `EVA_PLUGIN_SKILL_7391`。尚未在本子任务中安装或运行它。

未包含：云应用连接 OAuth UI、插件分享/发布/作者编辑器、任意桌面二进制依赖移植、完整在线目录权限与 ARM64 兼容验收。插件包含的计划任务只属于声明，当前页面不会声称已经调度执行。
