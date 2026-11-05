# 0.0.61 本地开发与扩展升级

本轮以电脑端原始 `src/main` 和 `src/renderer` 为对照，继续复用既有手机内核、信息流与 Android 运行宿主。四个领域分别实现和验收，以下结果按实际证据记录。

## MCP OAuth

直接迁入桌面 `mcp-auth-lifecycle.js` 原核心，接入手机授权状态、回调去重、重载后的授权核验与重新授权提示。新增 Eva 内置授权页，页面没有原生 JavaScript 接口，本机回调绑定地址、端口、路径和 state。原生套接字只转发精确匹配的本机回调。取消、超时与退出均按内核状态收尾。

真实手机内核与独立测试 MCP 服务已完成 PKCE S256、授权码交换、工具发现、refresh_token、退出后未登录和取消失败回调。外层 PRoot 与 app-server 均退出 0，测试线程全部结束。记录在 `artifacts/mcp-oauth/runtime-native.json`。测试使用独立临时 CODEX_HOME，未读取或改写真实账号凭据。

第三方服务的真人授权需要在其授权页完成，当前已安装内核决定具体协议兼容范围。真实服务按各自账号继续授权验收。

## 远程 Git

继续扩展现有工作区 Git 后端。增加 clone、远端配置、fetch、快进 pull、确认 push、分支创建与切换、显式 merge、冲突版本选择、merge abort 和分页历史。HTTPS 凭据通过 Android Keystore AES-GCM 保存并绑定完整仓库 URL。askpass 仅从临时进程环境读取秘密，错误按脱敏类别显示。

宿主和真机均通过 23 项远程检查，原本地 21 项回归通过。PRoot 兼容修复包括对象 rename 写入、禁止 clone 本地硬链接和工作区本地远端 receive-pack 参数。实际推送只发生在本轮自动清理的测试 bare 仓库。真实服务账号认证尚未代替用户完成。

LFS、子模块、worktree、交互式 rebase 和 SSH 首次主机登记沿用终端路径。范围和来源见 `WORKSPACE_GIT.md` 与 `migration/eva-0.2.7-desktop/git/SOURCE.json`。

## Office

复用手机已有 LibreOffice 与 Poppler，新增 DOCX/ODT、XLSX/ODS、PPTX/ODP 的可编辑另存与 PDF 转换，以及 Calc 重算。保留输入源文件，结果写到新目录。三种复杂真机样例各输出两页 PDF 与 PNG，中文、合并表格、图表及五项跨表公式缓存通过检查，另行完成编辑后重算及可编辑往返。

证据在 `artifacts/office-complex/device/`，兼容细节见 `OFFICE_COMPATIBILITY_20261106.md`。当前提供程序化编辑、另存与静态排版预览。SmartArt、微软专有函数、复杂域、OLE、播放动画及手机内原生富编辑仍需各自实现或样例验收。

## 手机源码构建 APK

增加固定来源和 SHA-256 的 ARM64 Android SDK 安装器、Java/AAPT2/D8/zipalign/apksigner 构建链与 Gradle 适配。Java 21 在本轮手机初始化失败，Java 17 实测可用，构建环境固定为 Java 17。能力技能和设置中的“从源码构建 APK”使用同一脚本。签名密钥保留在手机私有运行目录，构建结果写入新交付目录。

Java 资源样例已在手机完成源码编译、签名验证、安装与启动，截图在 `artifacts/capability-upgrade-20261106/phone-built-sample.png`。样例安装后已卸载，保留源码与 APK 验证记录。标准 Gradle 样例使用 AGP 8.10.1、compileSdk 36 和默认 Build Tools 35，包含 Java 8 lambda，31 项任务在真机完成。v2 签名与 16KB zipalign 检查通过，原生库工程仍需单独样例验证。

APK 预览页新增“安装”，通过只读单文件 content URI 交给系统安装器。手机首次使用时按系统要求允许安装来源，随后由系统确认安装。

最终通过 Eva 文件预览进入小米系统安装器，安装后的 APK 哈希与手机构建结果一致，安装来源核对为系统安装器。Gradle 样例启动后已目视确认居中显示 lambda 运行结果，测试包随后卸载。报告在 `artifacts/capability-upgrade-20261106/system-install-acceptance.json`，截图为 `gradle-app-run.png`。首次测试样例文字被系统顶部布局遮挡，调整样例布局并重新构建、安装后完成目视复验。

NDK/CMake 所需主机二进制需要 ARM64 适配，含原生编译的工程仍需各自验收。

## 集成与安全清理

0.0.61 已保留数据覆盖安装。原生 MCP 回调与取消、APK 只读授权边界、Git 原生初始化/提交/界面状态、构建工具链设置入口均通过检查。MCP 原生验收中发现 HTTP 状态行末尾回车未去除的问题，修正后重跑通过。会话列表核对为 27 条，用户确认自行删除的那条会话按其操作保留删除状态。

已清理构建中间 APK、编译中间文件、重复临时截图及测试应用。SDK/JDK/Gradle 依赖、签名、源码样例、验收图、交付 APK 和升级前会话备份保留。

本机确认无用的 14 项临时输出共清理约 216 MiB，清单在 `artifacts/capability-upgrade-20261106/cleanup.json`。手机删除两处本轮重复/失败的源码测试目录，保留最新 Java/Gradle 源码与交付结果。两个测试应用均已卸载，安装来源权限的原有设置已核对。
