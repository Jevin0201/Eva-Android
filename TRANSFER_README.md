# 换电脑继续开发（0.0.27）

本包是完整的 Eva-Android 工作区备份，含 .git 本地提交历史、当前源码、下载依赖、原生库、Codex ARM64 运行时、构建产物、测试依赖、文档和测试截图。原生库、下载、运行时、测试 node_modules 等保持 Git 忽略，但都在 ZIP 中。

## 当前状态与下一步
- 手机上的最后安装版本：0.0.26；本包 APK：0.0.27，尚未安装/真机验收。
- 0.0.27 改进：多窗口和截图辅助识别、父控件点击；桌面式信息流分段/折叠；异步保存、截图编码和内核事件锁分离。
- 必须继续验证微信联系人查找、无障碍长时保活、真实手机输入/发送/滚动性能，不能把本机模拟测试当成真机成功。
- 首先阅读 AGENTS.md、docs/RELEASE_0_0_27.md、docs/RELEASE_0_0_26.md。其他早期规划文件可能落后于源码。
- 桌面 Eva 独立项目未打包。本包 migration/eva 包含已迁入的参考文件；原完整桌面项目路径记录在 release 文档，继续深入比对时另行提供桌面源码。

## 在另一台 Windows 电脑启动
1. 完整解压 Eva-Android 文件夹到本地磁盘，保留隐藏 .git。不要只取 APK。
2. 安装 JDK 21（javac/keytool 在 PATH）、Python 3、Node.js 22、Chrome 或 Edge。
3. 安装 Android SDK Platform 36、Build Tools 36.0.0、Platform Tools。SDK 默认路径为 %LOCALAPPDATA%/Android/Sdk；也可向构建脚本传 -Sdk 参数。
4. 进入项目根目录执行：
   powershell -ExecutionPolicy Bypass -File tools/build-probe.ps1
   产物：probe/build/eva-probe.apk
5. UI 测试依赖 playwright-core 已包含在 node_modules；也可用 npm install --ignore-scripts 按 package.json 的固定版本恢复。
   node tools/test-chat-send-delete.cjs
   node tools/test-chat-scroll.cjs
   node tools/test-flow-parity.cjs
   node tools/test-sidebar-ui.cjs
   node tools/test-shell-ui.cjs
   node tools/test-settings-ui.cjs
   浏览器未自动找到时，设置 EVA_TEST_BROWSER 为 Chrome/Edge 可执行文件完整路径。
6. 手机重新授权此电脑 USB 调试后：adb devices；adb install -r probe/build/eva-probe.apk。
   PowerShell 可设置 $env:EVA_ADB='你的 adb.exe 路径'。check-device.ps1 仍要求 adb 在 PATH。
7. 同一手机不需要重置应用、重新导入 rootfs 或删除登录数据。新手机初始化请参考 docs 中运行时记录；目前仍不是一键完整产品安装器。

## 签名、数据与安全
- probe/build/debug.keystore 是现有开发签名，已随包保留（仅打包，不提交 Git）；保留它才能继续覆盖升级同一手机。构建脚本使用开发默认密码 android。
- 不要公开发布这个迁移包：包含开发签名及测试截图。它是用户本人的私有迁移副本。
- 未从手机导出账号、API Key、聊天数据库或授权状态；这些仍留在手机内。手机拔掉后电脑无法读取它们。
- Git 提交未推送任何远端。因原项目尚无提交和作者配置，本次用 Codex <codex@localhost> 标记代理保存的本地检查点，不更改全局 Git 身份。
- tools 下 implement/fix/wire/update 等 Python 脚本多为历史一次性迁移脚本，不要批量重跑。日常构建用 build-probe.ps1，回归用 test-*。

## 完整性
ZIP 内 TRANSFER_MANIFEST.json 包含每个文件的 SHA-256、大小和 Git 提交号；桌面同名 .sha256 文件校验整个 ZIP。外部 SDK/JDK/Node/浏览器不属于项目包，需在新电脑配置。
