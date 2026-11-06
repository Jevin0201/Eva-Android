---
name: eva-capabilities
description: 检查并安装 Eva 手机本地运行能力，处理 Alpine、Python、Node、办公渲染、开发编译与媒体依赖；安装工具前先检查环境、来源、许可证和实际可用性。
---
# Eva Android managed skill · 本地能力安装

环境：手机内的 Alpine 3.22 aarch64 用户空间。Python、Node、Git、apk 在本地运行，模型继续在云端。软件放在 Eva 私有运行环境，不需要 OpenAI 账号才能运行本地工具。

- 预检：`python3 /root/.eva-runtime/eva-capabilities.py status`。会实际检查硬链接兼容和可用空间。
- 安装办公渲染：`python3 /root/.eva-runtime/eva-capabilities.py install --profile office-render`
- 安装 HTML 渲染：`python3 /root/.eva-runtime/eva-capabilities.py install --profile html-render`
- 安装通用命令工具：`python3 /root/.eva-runtime/eva-capabilities.py install --profile utilities`（rg、GNU find、coreutils 等）
- 安装编译工具：`python3 /root/.eva-runtime/eva-capabilities.py install --profile development`
- 安装媒体工具：`python3 /root/.eva-runtime/eva-capabilities.py install --profile media`
- 其他标准系统软件：`python3 /root/.eva-runtime/eva-capabilities.py install --apk 软件包名 [更多软件包]`
- 已安装版本、许可证与来源：`python3 /root/.eva-runtime/eva-capabilities.py inventory`

先确认当前任务确实需要这些依赖。使用签名仓库，保留安装计划、许可证和事务记录。此入口不接受 shell 片段或任意安装选项。安装完成后还必须跑版本检查及一项实际任务，不能直接宣称能力完整。

Python 扩展按能力创建独立 venv，Node 扩展按能力使用独立 npm prefix。安装前检查官方来源、许可证、体系结构与子依赖，记录版本。不要把桌面 Windows 二进制直接当作手机 ARM64 Linux 程序执行，不要混用 apt 和 apk。

PRoot 的 root 是用户空间兼容层，不代表 Android root。需要内核模块、系统服务或特定 GPU 接口的软件应先做兼容性验证。禁止为消除安装报错而随意 chmod 整个系统、删除数据或关闭 Android 安全策略。权限失败应查明具体文件操作。

文档渲染：`python3 /root/.eva-office/eva-render.py status`，再使用 render 子命令生成真实 PDF 和全部页面 PNG。原生浏览器任务继续使用 Eva 内置浏览器；Linux Chromium 仅作为本地制品的渲染后端。

## Java 21 运行兼容

需要 Java 21 的工具使用 `JAVA_HOME=/root/.eva-runtime/java21/current`，并将 `$JAVA_HOME/bin` 放在 PATH 首位。先运行 `python3 /root/.eva-runtime/eva-java21.py status`。首次安装先通过上述签名仓库入口安装 `openjdk21-jdk build-base`，再运行 `python3 /root/.eva-runtime/eva-java21.py install`。安装后执行 `selftest` 检查 javac、虚拟线程及解释/混合/强制编译模式。系统 JDK 更新后需重新安装和验证兼容入口。

兼容层针对 OpenJDK 21 单页探测与线程栈 VMA 合并的失败，隔离探测页后重试原本的内存权限请求。失败会继续报告。Ghidra 与 REA 仍须完成真实样例反编译验收。现有 Java 17 APK 构建链继续沿用其固定环境。
