# ARM64 Linux 开发环境验证（2026-11-02）

## 来源与范围

采用官方 Alpine minirootfs 3.22.7 aarch64 作最小兼容性实验，不将其视为 Ubuntu/glibc 兼容性结论。
下载：https://dl-cdn.alpinelinux.org/alpine/v3.22/releases/aarch64/alpine-minirootfs-3.22.7-aarch64.tar.gz
同站 SHA256 文件校验通过（未独立验证发行签名）。基础包许可证在导入前读取，记录于 research/alpine-package-manifest.txt；安装后完整包版本和许可证清单位于 research/alpine-installed-manifest.txt。未增加 Git 子模块。PRoot 预编译来源限制仍见前轮记录，不满足正式发布可重建要求。

## 真机结果

Android 17，target API 36，应用 UID 10367。应用自身启动 PRoot；ADB 仅用于开发阶段导入根文件系统、安装、启动和读取结果。

- Alpine 3.22.7 / aarch64 启动成功。
- 手机内 apk 包管理器安装 Python 3.12.16、Node.js v22.23.4、Git 2.49.1，共 51 包约 120 MiB。
- Python 中文文件读写通过。
- Python 启动 Node 子进程，Node 写文件及返回值检查通过。
- Git init / add / 暂存差异文件检查通过。
- Python 对 sleep 子进程超时终止通过；不代表整个代理进程树取消已完成。
- Python HTTPS 请求通过，保持证书验证启用。
- 应用文件、shell、WebView DOM 测试回归通过。

原始结果 artifacts/linux-probe.json，实际工作流测试 tools/linux-smoke.py。

## 实施修正

- 用 adb exec-in 二进制传输至应用私有归档，再由 tar 解压；传输长度及本地归档 SHA256 检查。先前直接流式解压失败，不将部分解压当成功。
- 子进程输出改为并发读取，避免输出管道填满阻塞；增加输出上限、超时错误输出。
- 实验 rootfs resolv.conf 使用 223.5.5.5 / 119.29.29.29，未修改手机系统 DNS。正式产品需接入当前网络 DNS，而不是固定公共服务器。

## 尚未完成

完整代理内核及云端模型、任务流式事件/恢复、后台服务、完整进程树取消、无障碍控制、真实网站浏览器工具、手机 APK 构建均未验收。未测试 npm/pip 安装或桌面 Eva 原生依赖；glibc 依赖需另测 Ubuntu/Debian。当前 rootfs 由电脑导入，自助初始化与升级尚未实现。
