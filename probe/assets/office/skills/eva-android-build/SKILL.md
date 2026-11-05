---
name: eva-android-build
description: 在手机本地从 Java 或 Gradle Android 源码构建 APK，配置 ARM64 SDK、诊断编译失败并交付 APK。
---
# Eva Android managed skill · 手机构建 APK

所有编译和签名在本机 Alpine ARM64 环境执行。入口为 `python3 /root/.eva-runtime/eva-android-build.py`。

1. `status` 检查 SDK/JDK。手机兼容环境固定使用 `/usr/lib/jvm/java-17-openjdk`。
2. 缺少 Java 时先执行 `python3 /root/.eva-runtime/eva-capabilities.py install --apk openjdk17-jdk gradle`。
3. `install` 下载经固定 SHA-256 校验的 SDK。ARM64 aapt2/zipalign 来自 lzhiyong/android-sdk-tools 35.0.2（Apache-2.0），android.jar 和 D8/apksigner 来自 Google SDK 36。保留 SDK NOTICE/来源记录，下载包存在 `/root/.eva-android/downloads`。
4. `build --project /root/eva-workspace/项目 --output-dir /root/eva-workspace/新交付目录`。Gradle 默认运行 assembleDebug，可用 `--task :app:assembleDebug`。优先采用项目自身 gradlew。脚本传入 ARM64 aapt2 覆盖属性、SDK 地址和独立 Gradle 缓存。网络下载/插件版本/仓库错误须据实诊断。项目 Gradle 构建文件属于可执行代码。
5. 常规 Java 源码项目可提供 `eva-android.json`，例如 `{"manifest":"AndroidManifest.xml","java":"src","resources":"res","assets":"assets","libraries":"libs","nativeLibraries":"jniLibs","minSdk":28}`。使用 AAPT2→javac→D8→zipalign→apksigner，支持资源 R 类、JAR、assets、多 DEX 与预构建 ARM 原生库。此模式按 Java 8 编译，Kotlin/插件项目用 Gradle。
6. 调试签名存于 `/root/.eva-android/debug.p12`，保持以便覆盖升级。正式发布用项目已有签名配置，不把密码写进命令行或日志。
7. 检查 build-result.json 及 APK 签名，再用手机系统安装入口由用户完成安装。新应用安装后启动并检查实际界面，编译成功不能代替运行验收。

输入及新输出目录必须在手机工作区。源文件保留，构建日志错误保存在输出目录。Gradle按其常规约定写项目build目录。NDK/CMake的主机工具也需ARM64适配，不能把桌面x86二进制当作手机工具运行。遇到此类依赖要定位并补齐，不能声称任意NDK项目已兼容。
