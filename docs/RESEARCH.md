# 开源调研记录

调研日期：2026-11-02。尚未进行真机运行或成功率测试；链接指向可变分支，并非锁定版本。

## Operit

https://github.com/AAswordman/Operit

整体架构参考：原生安卓代理、Ubuntu 用户空间、手机控制、内置浏览器、终端和工作区。

已读取代码：

- `app/src/main/java/com/ai/assistance/operit/core/tools/system/Terminal.kt`：终端会话、命令 ID、输出事件、发送输入与中断。
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/accessbility/AccessibilityUITools.kt`：界面层级解析与按控件标识、边界定位点击。
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserPageExecutionSupport.kt`：WebView 异步桥接与不同下载类型的处理。
- `.gitmodules`：终端核心引用 OperitTerminalCore。

终端模块：https://github.com/AAswordman/OperitTerminalCore

其文档描述直接集成与 AIDL 跨进程接口。主项目也保留独立 OperitTerminal 安装检查代码；不能仅凭这一文件断言当前部署必须安装独立终端 APK。

## ClosePaw

https://github.com/imoonkey/closepaw

已阅读项目架构和 Termux 桥接文档：
https://github.com/imoonkey/closepaw/blob/main/doc/main/app/termux_shell.md

参考点：手机上的代理循环、无障碍树与截图、可接管悬浮界面、可选 Shizuku 虚拟显示；Termux 内 Python 服务经本机 HTTP 提供命令执行及健康检查。其 Chrome 控制路线不采用。

## AnyClaw

https://github.com/OpenClawAndroid/openclaw-android-assistant

文档参考：APK 内附带 Termux 衍生用户空间、初始化后启动 Node.js 服务与 WebView 界面，以及 Linux 二进制 DNS/TLS 适配。文档宣称的运行能力尚未逐项核验，不直接作为可复制实现或稳定性证据。

## AutoBrowse Android

https://github.com/Pixelgamer4k/autobrowse-android

文档参考：WebView 浏览器控制器与代理工具分层，支持导航、交互、快照、截图和标签管理。尚未进行代码全面审查和真机测试。

## 采用原则

研究架构不等于直接复制代码。采用任何模块前核对许可证、子模块、实际版本与构建结果。正式选型以 Eva 内核兼容性、手机控制效果及完整任务验收为依据。
