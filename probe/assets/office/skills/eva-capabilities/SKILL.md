---
name: eva-capabilities
description: 检查并安装 Eva 手机本地运行能力，处理 Alpine、Python、Node、办公渲染、开发编译与媒体依赖；安装工具前先检查环境、来源、许可证和实际可用性。
---
# Eva Android managed skill · 本地能力安装

## 按需组件与用户确认

新手机只部署必备环境。使用办公、开发、媒体、REA 或 Ghidra 前先调用 `eva_components status`。缺少时调用 `ensure`，component 为 `office`、`development`、`media`、`analysis` 或 `ghidra`。Eva 展示用户确认并等待安装；仅在 `ready=true` 后继续原任务。用户暂不安装时保留任务，不通过终端命令绕过确认。REA 独立安装，不连带下载 Java/Ghidra。以下命令用于用户已授权的修复或其他软件安装。

环境：手机内的 Alpine 3.22 aarch64 用户空间。Python、Node、Git、apk 在本地运行，模型继续在云端。软件放在 Eva 私有运行环境，不需要 OpenAI 账号才能运行本地工具。

办公任务先检查 `python3 /root/eva-office.py status`，同时检查任务实际执行的 Python 入口。`python-docx` 与 `python-pptx` 的固定版本安装在 `/root/.eva-office/lib`。若办公入口报告就绪、裸 Python 却报 `ModuleNotFoundError`，先用 `PYTHONPATH=/root/.eva-office/lib${PYTHONPATH:+:$PYTHONPATH} python3 -c "import docx,pptx; print(docx.__file__,pptx.__file__)"` 核验导入路径，再以同样环境继续原脚本。确认是搜索路径问题后恢复正常入口，并重试原库调用。库确实缺失时通过 `eva_components ensure` 的 `office` 组件恢复；已获授权的修复也可执行 `python3 /root/.eva-runtime/eva-capabilities.py install --profile office-authoring`，完成后读回 status 并做一次生成与回读。不要因第一次导入失败就放弃成熟库，改为手写整个 DOCX/PPTX 包。已有库可通过 OOXML 局部补充动画等未覆盖特性。

托管办公安装使用签名 Alpine 原生依赖和 SHA-256 固定的纯 Python wheel，通常不需要 pip。其他项目确实要求 Python 包安装时，先核对锁文件、Alpine aarch64 和 musl 兼容性；优先签名 `apk` 原生依赖，必要时按需安装 `py3-pip` 并在项目独立 `venv` 中安装其依赖。不要直接覆盖系统 Python 或现有办公私有库。PDF 可复用已就绪的 LibreOffice、Poppler、reportlab；仅在任务明确需要 PyMuPDF 或 WeasyPrint 的特有能力时再检查并安装对应组件。

逐项检查命令、导入和退出码。`which ffmpeg ffprobe flite missing-command` 的总体非零不表示全部命令缺失，须分别用 `command -v flite` 等确认；保留成功项，修复实际缺项。管道末尾 `head`、`tail` 或 `echo` 的成功不代表前置程序成功。安装、导入和生成检查应直接读取对应进程退出状态与完整错误。修复完成后重试失败阶段，并继续原交付任务。

任务执行中遇到缺失的 Python 包、NPM 包、Java、Android SDK 或具体系统命令，先调用 `eva_dependencies status`，再对当前任务实际需要的项目调用 `ensure`。示例 requirements 为 `[{"kind":"python","module":"docx","name":"python-docx"},{"kind":"npm","name":"is-number"},{"kind":"java","version":"17"},{"kind":"android","profile":"build"},{"kind":"system","name":"sox","binary":"sox"}]`，按需选择其中的项，保留任务要求的版本。项目路径来自当前会话工作区；使用返回的 `pythonExecutable`、`commandPrefix`、`commands` 与 `environment` 继续运行原脚本。每项导入或真实工具检查通过才算依赖就绪。未知模块不能猜成同名 PyPI 包，须确认官方包名。Python 自动复用现有系统与托管库，新增包放项目独立 venv；NPM 放隔离 prefix，系统原生依赖使用签名 Alpine 包。

安装失败时读取 `results`、`error`、`logPath` 或 `logDirectory` 与 `sourceAttempts`，修复实际失败阶段后继续原任务。缺环境本身不作为放弃用户目标或直接降低交付要求的理由。网络、连接、超时及服务端故障会在有限尝试内切换国内镜像，保持版本约束、TLS 和摘要校验；账号拒绝、版本不存在、架构不符或校验失败必须针对原因调查，不能通过换源跳过验证。工具不改全局 pip/NPM/APK 源，已下载缓存和失败环境可继续复用。用户取消后等正在进行的包事务安全收尾，停止后续步骤，不自动重发原任务。

- 预检：`python3 /root/.eva-runtime/eva-capabilities.py status`。会实际检查硬链接兼容和可用空间。
- 已授权的办公库修复：`python3 /root/.eva-runtime/eva-capabilities.py install --profile office-authoring`。保留其他私有库及可恢复的前一版本，不连带安装其他渲染框架。
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


## GitHub 项目、命令工具与插件安装

收到安装请求后，先从当前对话、附件及给出的 GitHub 链接确认仓库。用户只给缩写时先检索并核对项目用途，存在多个候选再请用户确定。不要按缩写猜 npm 包名、下载地址、入口命令或配置格式。

1. 阅读目标版本 README、LICENSE、安装说明及包清单，记录仓库 URL 和 commit/tag。检查子模块及依赖，区分 CLI、Python/Node 库、MCP 服务、Eva 插件、其他应用专用插件及桌面 GUI 项目。按实际格式选择接入点，检查 Linux ARM64、musl/glibc、Android/PRoot 与必需外部服务的兼容性。
2. 先检查本机现有安装、配置和相关进程。将新源码放入当前工作区中唯一的新目录。Git 克隆使用 `git -c core.createObject=rename clone --no-hardlinks <已核对的仓库URL> <新目录>`。保留现有安装、用户配置、凭据与锁文件，在新环境验证后再切换入口。先读取安装脚本及其写入目标，使用项目目录或可配置的独立安装前缀，避免脚本默认覆盖原配置。已有服务先核对端口和进程归属；保留原 `.env`、数据目录与服务自产密钥，配置变更采用读回合并或新文件试验，不能用示例密钥替换实际凭据。依赖按官方锁文件安装，Python 使用独立 venv，Node 使用项目目录或独立 prefix。
3. 实际执行官方安装步骤并检查退出状态。下载优先官方来源，网络失败时仅切换已核实、版本或提交一致的正规镜像或发行归档，保留 HTTPS、固定摘要或包管理器完整性验证。没有可信副本时保留缓存与日志并报告实际阻断。网络、缺包、架构、文件操作或权限错误分别定位，查看完整错误输出。先判断是否有进程仍运行，避免重复安装。执行器返回的进程/会话标识表示仍需等待；持续查询至退出后再判断结果。超时保留日志和已完成下载，确认状态后从可重试阶段恢复。依照当前任务权限完成可恢复的安装问题。
4. 验收实际入口。CLI 需运行版本/帮助和至少一个无副作用的功能；库需导入与最小实际调用；MCP 需初始化、列工具并执行一个只读工具；Eva 插件需通过原生导入/安装接口接入，在 Eva 的插件列表和新会话中读回能力。已有远程市场插件使用市场接口。其他应用专用插件先核对其运行宿主是否在本机可用。独立服务应分别检查进程生命周期、端口健康、客户端实际调用及冷启动恢复，并明确记录采用 standalone、MCP 或宿主插件中的哪一种接入形式。
5. 保存安装版本、来源、安装目录、入口、验证结果和必要的恢复方式。成功后清理已确认冗余的解压包、临时目录和失败中间产物，保留继续运行、升级和离线使用所需内容。失败时报告具体失败阶段、命令、退出码和错误，以及已完成与仍待完成部分。

下载源码、生成配置文件或安装依赖仅完成对应阶段。必须由真实入口验收结果决定能否向用户报告安装成功。项目要求的账号、API key 或 Android 系统授权需要从实际缺失状态判断，先完成已获授权且能够继续的步骤。

接入 OpenAI 兼容本机服务时，当前 Eva 提供商支持 `http://127.0.0.1:端口/v1` 和数字 IPv6 回环地址，并可保存整个模型列表供聊天选择。按项目文档核对实际接口并选择 Responses 或 Chat Completions 协议，通过现有提供商入口接入。分别验证真实文本回复、连续多次工具调用和冷启动恢复，健康检查或模型列表成功只代表对应阶段。DSH 插件的已有 standalone 连接由 Eva 自动恢复，在模型列表的“DSH插件”中查看并检测当前可用模型；普通 API 配置只填写供应商名称、URL、API Key 和模型名称，不提供“接入本机免费模型”入口。不要将密钥输出到聊天或为了登记本机提供商重新编译 Eva。服务接口适配须保持每次响应的 item.id 和 call_id 全局唯一，并使同一响应的流式事件和工具回传引用一致。

## 既有生成任务的错误恢复

接续长任务或切换模型后，先读取目标目录、现存脚本与上一条真实错误，只检查本阶段用到的依赖，不从头重装环境或重复覆盖成品。历史中出现 ModuleNotFoundError 不代表当前仍缺少该包，应以当前入口实际导入为准。使用既有 reportlab/LibreOffice/Poppler 完成 PDF 时，不因未安装 PyMuPDF、WeasyPrint 或 matplotlib 判定 PDF/图表能力缺失。脚本修复应产生实质差异，避免同值 sed 替换；Pillow 的 font/fill 使用关键字参数，自定义辅助函数则按其真实签名调用。先在同一项目的独立检查目录生成并读回，再更新需要修复的目标，保留已有有效成品。命令完成与任务成功分开判断：直接检查每个生成进程退出码、Traceback、文件存在与回读结果，不能以管道最后的 tail/echo 成功宣称前面的安装或生成成功。
