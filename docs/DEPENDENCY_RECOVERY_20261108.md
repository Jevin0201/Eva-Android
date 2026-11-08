# 依赖自动恢复与下载回退

2026-11-08。本轮针对手机代理遇到缺包、缺 pip 后停止或改用较差工具的问题。当前源码已整合；本文件明确区分后端真机证据与待做的代理端到端验收。总任务见 [当前任务总账](ACTIVE_TASKS_20261108.md)。

## 恢复链路

原生 `eva_dependencies` 接收当前任务需要的 Python、npm、Java、Android 或签名系统包，由宿主注入实际项目目录。先检查现有环境，再修复缺项，实际导入模块或运行入口后才返回 ready。返回解释器、环境变量和命令，供模型继续执行原脚本；未知安装配方应继续读取项目官方说明并通过终端补齐，不能将“不在预设列表”当作任务无法完成。

Python 缺 pip 时走已存在的签名能力安装器；第三方库进入按项目隔离的 venv。既有办公库目录纳入普通 Python 导入，显式请求版本仍以隔离环境为准。npm 使用按项目、包与版本隔离的 prefix，聚合 CJS preload 和 ESM loader，使请求的版本在受控命令中优先，同时保留原项目其他依赖。冲突版本在安装前拒绝，原文件、锁文件和依赖目录不被替换。

原来源发生网络错误后，pip 依次使用官方、清华、阿里镜像，npm 使用官方、npmmirror，APK 使用签名仓库的逐命令回退。保留逐源错误、日志与缓存。固定 SHA 下载严格核验 Range 和哈希，支持断点保留；不通过关闭 TLS 或忽略校验完成下载。Android platform 36 r02、build-tools 35/36 的腾讯官方镜像已完整下载，与原固定 SHA 一致，加入 Google 官方来源之后的回退。GitHub aarch64 原生工具包尚无已核实副本，继续保留官方重试、断点和已有缓存，不能声称每类资源均有国内镜像。精确来源和完整摘要见 `artifacts/sdk-mirror-research-20261108/verified-archives.json`。

任务和依赖事务各自持有执行 lease。任务执行期间保持可见前台服务及部分唤醒锁；完成、拒绝、中断或内核退出释放。取消安装时让已经开始的包事务安全收尾，随后停止，不重发任务。没有修改系统省电配置。

## 已有真机证据

- 原“复杂文件预览体验包”对话中，docx/pptx 原先已装于私有目录但普通 Python 无法导入。已恢复导入、安装 pip 25.1.1，实际验证 venv，以及最小 DOCX/PPTX 生成和回读。已向正在运行的任务提供真实环境结果。
- `artifacts/acceptance-0.0.75/live-dependencies.txt`：隔离项目先触发 Python/npm 缺依赖，再安装 pyfiglet 1.0.2、is-number 7.0.0；原 Python 与 ESM 脚本执行成功，脚本和保护文件 SHA 不变。Java 17 编译执行、Android aapt2 检查成功；这两项复用已有环境，不是本轮从空环境下载安装的证明。
- `live-mirrors-foreground.txt`：明确注入官方源超时，生产回退分支实际从清华和 npmmirror 安装并运行成功。超时为测试注入，不冒充官方源自然故障。
- 原八类预览成品尚未全部验收。本轮依赖恢复成功不能替代文件视觉、动画、音视频等完整验收。

## 电脑端检查与待验收项

Python 依赖 14 项、工具链 10 项、下载策略 10 项、办公恢复 7 项、分层部署 9 项通过。Node 聚合测试用真实 Node 执行 CJS/ESM，验证隔离 v2 优先于原项目 v1、未请求包维持原版本、子路径、聚合去重、原文件 SHA 不变、离线复用及冲突零写入。

整合调试包已通过原生依赖 18 项、真实执行服务 10 项、路线 50 项与模型选择持久化 14 项。GPT-6.1 Terra 在独立项目实际调用 `eva_dependencies` 安装 npm 包，使用返回的命令执行原 Python/ESM 脚本，保护文件 SHA 不变；按 HOME 后完成，服务和唤醒锁最终均释放，见 `native-dependency-*.json/txt`。该轮 Python 复用已有库，先前后端记录才是其缺包后隔离安装证据。

随后真实反馈又补了两项：Python requirement 的 `package`/`name` 一致别名和 schema 非空约束（Python 离线 18 项、原生扩至 29 项待再跑）；会话级 `PIP_REQUIRE_VIRTUALENV=true`（真实本地 wheel 回归 10 项），避免模型通过 `--break-system-packages` 装入系统 Python。正确项目 venv 不受影响。免费模型先前实际通过终端完成了脚本，但没有使用结构化工具，且用了全局 pip override；不能误记为“没有工具执行”或规范隔离安装通过。其临时全局 pyfiglet 已核实 RECORD 范围后移除，办公库导入保留，见 `cleanup-global-qa-dependency.txt`。

最终新增源码仍待统一安装、29 项原生检查、隔离 Python 的真实模型再验和正式包交付。

## 临时内容与清理

本轮证据及热部署记录集中于 `artifacts/acceptance-0.0.75/`，测试临时环境在自动清理的 `tmp/` 中创建。SDK/JDK/ADB、签名、已安装环境、用户文件及升级备份保留。已删除不再需要的本次原始手机进程 dump，见 `cleanup-partial.json`；手机暂存目录、最终构建中间文件与调试转发仍待交付前核查。
