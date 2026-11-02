# PRoot 加载路径真机验证

日期：2026-11-02。设备：M332BF / Android 17 / ARM64。验证应用 target API 36，UID 10367。未使用 Root；ADB 仅安装、启动、读取报告。

## 已实测

1. APK 内打包 liboperit_proot.so、liboperit_loader.so，显式启用 extractNativeLibs。
2. 从 applicationInfo.nativeLibraryDir 启动 PRoot，设置 PROOT_LOADER 和应用私有临时目录，版本输出成功。
3. PRoot 启动系统 shell，返回 exit=0 EVA_PROOT_OK。
4. 将手机系统 /system/bin/sh 复制到应用私有目录作为原生 ELF 测试样本（未打包分发）。直接执行被拒绝，error=13。
5. PRoot 执行同一私有 ELF，返回 exit=0 EVA_PRIVATE_OK。
6. 文件读写、脚本解释执行、WebView 本地 DOM 点击回归通过。

结果：artifacts/proot-probe.json。该实验验证加载路径，不代表 Linux 根文件系统、开发工具或完整代理已可用。

## 来源及许可证检查

- 研究仓库 https://github.com/AAswordman/OperitTerminalCore，锁定 e4442bc6a047b6165bf59103721ad143149c620d；该提交无 gitlink 子模块条目。
- 已读取 LICENSE：以 LGPL v3 为基础的项目许可证文本，附带 GPL 文本存在省略占位。原文保存于 research/OperitTerminalCore-LICENSE。
- 已读取 TerminalManager.kt 原生库符号链接建立方式、LocalTerminalProvider.kt 环境变量与 build.gradle.kts 的 useLegacyPackaging 配置。未复制其 Kotlin 实现。
- 本次实验使用该提交随附的两个 ARM64 预编译文件，SHA256 见 research/runtime-provenance.json。
- PRoot 运行输出声明 GPL v2 or later。上游 termux/proot COPYING 保存于 research/PROOT-COPYING，不能据此认定这些预编译文件与某个上游提交完全对应。
- 尚未补齐预编译文件的精确源码、补丁与构建脚本，因此仅用于本机兼容性实验，不作为正式发布依赖。后续应采用来源完整、可重建的组件并保留相应许可证及源码履约材料。

## 下一步

验证 ARM64 Linux rootfs 的解压、加载器、路径映射与进程生命周期；随后逐项测试 Python、Node.js、Git、DNS/TLS、子进程、取消与任务恢复，再验证手机 APK 构建。独立推进无障碍控制和内置浏览器工具层。
