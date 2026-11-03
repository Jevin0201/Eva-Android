# Eva Android

独立安卓 Eva 项目：云端模型、手机本地代理执行，覆盖手机 App、内置浏览器、文件、编程和 APK 构建。桌面项目及其用户数据保持独立。

## 实施主清单

以 [产品实施与验收清单](docs/IMPLEMENTATION_CHECKLIST.md) 为后续唯一进度入口，逐项完成 UI、设置、模型接入、信息流、工具、手机控制、浏览器与工作区。

## 当前开发版本：0.0.31-voice（语音测试版）

0.0.31 优化唤醒后的等待、残句拦截与确认发送，新增明确开关、权限对号及摄像头波纹。实测与限制见 [等待说完与界面修订](docs/VOICE_0_0_31.md)。

0.0.30 增加“艾娃、爱娃、埃瓦、伊娃”读法和“你好”连读变调；更新说明见 [相近发音修订](docs/VOICE_0_0_30.md)。

新增“你好艾瓦”本地唤醒、中文流式听写、摄像头附近语音状态光圈，并将语音指令接到现有代理和聊天记录。入口：设置 → 语音唤醒与灵动岛。实现、第三方来源、实测证据与待验收项目见 [语音测试版记录](docs/VOICE_0_0_29.md)。这不是完整手机代理最终验收，也不代表全天候后台可靠性已验证。

## 之前的开发版本：0.0.28

0.0.28 已在 Android 17 真机覆盖安装并持续验收。参见 [本轮修复与验收](docs/RELEASE_0_0_28.md) 和 [产品实施与验收清单](docs/IMPLEMENTATION_CHECKLIST.md)。手机自助初始化与手机 APK 构建仍未交付。换电脑环境说明见 [开发交接](TRANSFER_README.md)。

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
