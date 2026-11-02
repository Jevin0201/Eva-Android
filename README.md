# Eva Android

独立安卓 Eva 项目：云端模型、手机本地代理执行，覆盖手机 App、内置浏览器、文件、编程和 APK 构建。桌面项目及其用户数据保持独立。

## 实施主清单

以 [产品实施与验收清单](docs/IMPLEMENTATION_CHECKLIST.md) 为后续唯一进度入口，逐项完成 UI、设置、模型接入、信息流、工具、手机控制、浏览器与工作区。

## 当前交接版本：0.0.27

请先阅读 [换电脑继续开发](TRANSFER_README.md) 和 [0.0.27 说明](docs/RELEASE_0_0_27.md)。0.0.26 已安装真机，0.0.27 已构建但手机断开，尚未安装及真机验收。

## 早期记录（历史状态，不代表当前功能）

- 0.0.9：[独立工具页面重设计与桌面兼容验证](docs/TOOL_PAGES_0_0_9.md)。

- 0.0.5 已覆盖安装；[全页面审查与修改记录](docs/PAGE_REVIEW_0_0_5.md)列出各页落地内容、真机验证与剩余工作。

- Android 17 ARM64 真机已接入；Alpine、Python、Node.js、Git 与基本 HTTPS 工作流通过。
- 本地终端已由用户在 UI 中实测执行成功。执行器取消、超时、输出上限及流式输出有独立测试证据。
- 会话、历史、文件预览、WebView 属于开发界面，尚未完成全量 UI 验收。
- 云模型、统一代理循环、无障碍、后台服务与手机 APK 构建未接入。当前 APK 位于 probe/build/eva-probe.apk，仅为开发版。
- 首次 rootfs 仍由电脑导入，运行时预编译来源尚待补齐，不能宣称完整产品交付。

## 记录

- [设计基准](docs/UI_DESKTOP_PARITY.md)
- [模型与功能实施清单](docs/IMPLEMENTATION_CHECKLIST.md)
- [本地工具界面记录](docs/LOCAL_TOOLS_UI.md)
- [Linux 验证](docs/LINUX_VALIDATION_2026-11-02.md)
- [任务执行器](docs/TASK_RUNNER_2026-11-02.md)
- [PRoot 验证](docs/PROOT_VALIDATION_2026-11-02.md)
