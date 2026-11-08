# 桌面浏览器迁移：实现与验收中

用户要求：先介绍桌面能力与手机差异，再迁移全部浏览器能力。本轮尚未达到全部对齐，不得标记完整交付或覆盖正式版。

来源限定 `/Users/jevin/Documents/Codex/Eva-Source/src/main` 与 `src/renderer`，清单与 SHA-256 见 `migration/desktop-browser/SOURCE.json`。没有读取桌面用户数据，未使用 outputs/mobile-live。原浏览器控制器、观察、复杂控件、动作序列、网络录制/归档、协议能力、文件/目录上传、结果持久化模块原样复制，Android 适配放在独立文件；Playwright 1.59.1 的 LICENSE、NOTICE 随离线依赖保留。桌面来源声明授权移植，未重新声明其许可证，无新增子模块。

## 能力盘点与边界

| 桌面现有能力 | 手机迁移实现 | 实际验证与剩余项 |
| --- | --- | --- |
| 19 个工具、原观察与操作状态机 | 全部工具定义接入 thread/start 及恢复历史投影，保留 eva_browser 兼容 | 工具注册到真实云模型调用链尚待实测 |
| JavaScript、CDP、Storage、结果分页 | 原控制器经应用私有 DevTools socket，手机 Node 22 执行，无桌面代理依赖 | 真机 WebView 与手机本机 Node 的 evaluate/CDP 返回 42；列表与分页也分项通过 |
| iframe/open Shadow DOM、分页、表格、编辑器、inspect | 原模块复用 | 真机正文、Shadow DOM、编辑器读回、表格与 inspect 分项检查；跨域 iframe 待专测 |
| 点击/双击/悬停/键盘/勾选/选择、8 步批量及等待断言 | 原逻辑复用，Android 缩放坐标层先验证 DOM 遮挡和稳定性再发真实 CDP 指针 | 真机按钮计数确认恰好一次；键盘/滚动分项执行；其余动作待回归 |
| 多标签与可见窗口 | 原 controller 绑定到多个原生 WebView；原生菜单添加标签管理 | 标签创建、切换、关闭与进程重建尚待专项；浏览器关闭会销毁全部标签 |
| Console、Network 正文、HAR、重放/Mock、网页登录态请求 | 原 recorder/archive/actions 复用；SQLite 与结果存于手机工作区 .local | 连接与 debug 查询分项通过，录制/正文/HAR/重放/Mock/真实请求尚未完整验收 |
| 上传文件与目录、真实下载记录 | 原选择与目录模块；CDP 文件路径从 Linux 路径映射 Android 路径；下载读取原生记录 | 文件/目录上传尚待同 UID 手机全链验证；下载仍沿用原生来源确认和 256 MB 边界 |
| 页面截图 | 原 fullPage 截图；CDP 失败时明确退回原生可见视口截图，不假报整页 | CDP 截图一轮通过，另一轮超时，原生回退待新版验证 |
| HTTP/HTTPS | 控制器支持 HTTP；原 WebView 导航已适配 HTTP | Android 全局网络策略仍禁止非回环 HTTP，普通 HTTP 不能算可用 |
| 书签/历史/密码/导入 | 本轮仅盘点来源，未完成产品迁移 | 待迁移。桌面密码密钥及配置不复制；需 Android 安全存储和文件导入 |
| Chrome 扩展、商店、native messaging | WebView 无 Electron loadExtension 等宿主 API | 未迁移，需要支持扩展的新引擎与真实兼容验证；不能显示虚假的安装成功 |

## 接入与验证

`DesktopBrowserHost` 只监听回环随机端口，以每次进程随机 token 保护入口，转发本应用 `webview_devtools_remote_<pid>`，远程网页没有 Java 原生桥。`DesktopBrowserRuntime` 在手机既有私有 Linux 运行环境启动 Node，离线部署控制器与 Playwright。工具沿用浏览器任务租约、用户接管与取消；操作等待超过 90 秒返回未确认，不自动重复写入。

构建脚本发现其他工作区修改后拒绝签名的记录在 artifacts/desktop-browser-20261108/build.log。使用 `tools/build-browser-candidate.py` 固定必要输入后构建独立包 `ai.eva.android.browsercheck`；没有覆盖正式 Eva。固定快照与项目当前源码的范围必须区分。

工具：`tools/sync-desktop-browser.py` 更新原始桌面模块及来源清单；`tools/test-desktop-browser-engine.cjs <private-forwarded-host-endpoint>` 对隔离真机 WebView 测试，不使用用户会话。检查日志集中 artifacts/desktop-browser-20261108。手机 Node 三项验证见 phone-node.log。

本次临时内容：隔离测试 APK/构建目录、build-input 快照、engine-test.tgz、test-* 结果目录、diagnose.cjs；手机隔离应用、/data/local/tmp/eva-browser-engine-test.tgz 及正式包私有运行环境内单独创建的 /root/eva-browser-engine-test 与同名 tgz。清理结果在收尾补记，交付源码、依赖、证据、候选 APK 与现有用户资料不作为临时垃圾删除。

## 后续验收与网址修复

18 类工具已在手机本机 Node + 隔离真机 WebView 检查中通过（唯一未覆盖的工具为 browser_upload），日志 `phone-engine-http.log` 以 ENGINE CHECK COMPLETE 结束。包括实际新建/选择/关闭标签、网页 GET 请求、空下载记录、原生视口截图回退和网络请求记录查询。此前 Node fetch 小响应解析错误已改为带明确 Content-Length 的 node:http 宿主通信。并非所有工具参数与所有网页场景均通过；完整 HAR/Mock/重放、跨域 iframe、上传与云模型接续仍待验收。

用户补充反馈地址栏强制 HTTPS：新增独立 BrowserAddress 规范化入口，共用到地址栏、设置启动页、历史恢复与旧 eva_browser；普通域名默认 HTTPS，localhost 与私网 IP 默认 HTTP，支持显式 HTTP/HTTPS、Unicode 域名、路径空格与 about:blank。前端设置不再重复拒绝 HTTP。Android network-security-config 允许明文网页流量；这也是应用级网络策略变化。API/运行依赖下载与 MCP 原有校验未改。纯 Java 检查 10 个有效与 6 个无效地址通过；真机 HTTP 地址栏检查待构建后补记。不宣称 WebView 可以渲染 FTP 或所有系统外部协议。

真机网址修复验收通过：`address-device.log` 记录原地址栏输入 bare localhost 后真实 HTTP 页面渲染、HTTP 地址持久保存、普通域名补全及 example.com 的非回环明文网络策略允许。`settings-ui.log` 的设置页面回归通过，包含 HTTP 启动页保存。最终独立候选包保留于 artifacts/desktop-browser-20261108/eva-browser-isolated-candidate.apk，配套 SHA256 和构建输入清单；没有覆盖原正式应用。

交付前清理已执行并核验：移除两轮生成构建目录、固定源码快照、诊断脚本、打包中间 tgz、五组本地假数据测试目录；卸载本轮隔离测试应用，移除原 Eva 运行环境内本轮明确创建的测试目录/压缩包、三个手机临时文件及三个 ADB 转发。保留候选包、日志/来源清单、截图、离线必要依赖；tmp/launch-confirmation-fixture 与其他任务/历史用途不明内容保留。明细与核验见 artifacts/desktop-browser-20261108/cleanup.json。
