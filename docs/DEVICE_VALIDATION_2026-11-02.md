# 首轮真机接入（2026-11-02）

## 已实测

- ADB 已授权，设备型号 M332BF，Android 17 / API 37，arm64-v8a。
- 内存页大小 4096；/data 剩余约 76 GB。
- WebView 提供程序 com.google.android.webview，版本 156.0.8078.47。
- 独立验证应用 ai.eva.android.probe 已由本机 Android SDK 36 构建，签名检查通过。
- 首次安装被 USB 安装限制拒绝；用户开启后重试成功，Activity 冷启动耗时 291 ms。
- 应用 UID 10367、target API 36：文件写入并读回、系统 shell、shell 解释私有脚本均通过。
- 内置 WebView 本地测试页面通过 JavaScript 定位按钮、点击并读取 DOM_OK。尚不代表真实网站兼容性。
- 私有脚本设置可执行位成功，但直接执行返回 error=13, Permission denied。
- 原始设备及应用结果保存在本地 artifacts/device-environment.json 与 artifacts/app-probe.json。

## 尚未实测

上述结果来自应用自身进程；ADB 仅用于安装、启动与读取报告。尚无 Eva 内核、云模型调用、Linux 运行时、手机控制或 APK 手机上构建的验收结论。

## 验证应用

源代码位于 probe/，构建入口 tools/build-probe.ps1；仅使用 Android/Java 平台 API，无引入第三方源码或子模块。使用本机已有 SDK / JDK，生成物均在本项目 probe/build/ 下。调试签名仅供开发。

构建：`./tools/build-probe.ps1`

安装：`adb install -r probe/build/eva-probe.apk`

启动：`adb shell am start -W -n ai.eva.android.probe/.MainActivity`

结果：`adb shell run-as ai.eva.android.probe cat files/probe.json`

## 官方文档与待验证约束

Android 文档说明 target API 29+ 应用不能直接执行可写私有目录中的文件：
https://developer.android.google.cn/about/versions/10/behavior-changes-10?hl=en

本验证应用 target API 36；区分调用系统 shell、由 shell 解释脚本和直接执行私有文件，不将前两项成功推导为 PRoot / Node.js 可运行。私有文件直接执行限制已在此设备复现。下一步审查候选运行时的许可证与子模块，验证 APK 原生库打包及 PRoot 路线；不能以本轮 shell 成功代替完整运行时验证。

