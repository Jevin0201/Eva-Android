# Phone Use 0.0.20

## 实现范围

- 原生 AccessibilityService：读取前台控件树（限 250 节点）、控件点击、文本输入、滚动、屏幕手势、返回、主页和截图。密码节点不返回文本、不执行输入。设备锁定或用户停止时拒绝操作。
- 手机控制页面：跳转系统授权、读取真实连接状态、显式开启控制、通知栏停止、相册启动测试、独立安全测试页。
- 任务运行：手机动态工具请求由 KernelHost 原生 reader 路由至串行执行器，不依赖 WebView 的事件轮询。工具与当前 thread 绑定，停止后撤销队列操作并请求中断当前回合。
- Codex 新会话注册 `eva_phone` 动态工具。截图返回 inputImage，文本结果返回 inputText。控件操作使用 observe 返回的快照与节点，快照 15 秒过期；每次操作后要求重新观察。旧会话需新建会话获取工具定义。
- Shizuku 可选增强：授权入口、真实授权/UID 状态、UserService Binder 连接、Android Shell 命令执行。20 秒超时、64 KiB 输出上限、进程组取消。未启动或未授权时明确失败，不降级成应用 UID 后冒充 ADB。
- 聊天信息流适配手机操作标题和文字结果；截图已传给内核，UI 历史不重复保存 base64。
- 相册附件入口补充包可见性查询，并在选择器 Activity 不存在时使用 GET_CONTENT 后备路径。

## 证据与限制

- 已通过 javac/d8/aapt2 构建和 APK 覆盖安装。
- 真机 KernelCheck：固定 Codex 0.166.0 接受带动态手机工具的 ephemeral thread/start；没有发送云端模型请求。
- 原有模型信息流、项目/附件/模型面板测试通过。
- 用户已在系统开启 Eva 无障碍服务。更新及 instrumentation 重启后，系统显示 enabled 但 crashed/unbound；未观察到 AndroidRuntime 崩溃堆栈。为避免测试重启干扰，新增应用内 PhoneSelfCheck，并请用户重新连接服务。
- 应用内 PhoneSelfCheck 真机通过：observe、输入、点击、截图、停止后拒绝读取。修复测试立即回读时序与按钮大写转换匹配；真实系统设置显示服务 bound。Shell Binder/输出流在应用 UID 下通过。跨 App 的云端完整任务仍待验收，不把测试页通过称作全功能交付。
- 真机未检测到 Shizuku 管理器。此通道仅完成代码接入，尚未验证 shell UID 2000、启动恢复及真实提权执行。安全测试中的 Shell 流检查使用应用 UID，明确不是 ADB 权限验收。
- 普通跨 App 控制占用当前屏幕，不提供隐藏第二屏；不自动解锁，不自动授予系统权限，不保证锁屏/厂商清理后的继续执行。
- Shizuku 命令可以影响系统，使用范围以用户具体任务为准；取消针对当前进程组，不承诺追回命令启动后已完成的副作用或另起会话的进程。
- 尚未接入原生无线 ADB 配对客户端；不把 Shizuku 管理器依赖包装成无依赖原生 ADB。

## 验收步骤

1. 系统无障碍设置开启“Eva 手机控制”；如果处于已启用未连接，关闭再开启。
2. Eva 手机控制页运行安全测试页：检查控件读取、输入、点击、截图、停止后拒绝访问和 Shell 输出流。该页仅包含测试数据。
3. 返回手机控制页开启控制并允许通知，测试打开相册。
4. 新建对话要求打开相册，观察动态工具返回与实际前台 App；再验证通知栏停止及权限撤销。
5. Shizuku 安装、用户启动并授权后单独验收 `id`、只读系统信息、超时与取消；不得以应用 UID 的测试替代。

## 来源

- Android AccessibilityService：https://developer.android.com/reference/android/accessibilityservice/AccessibilityService
- Foreground service specialUse：https://developer.android.com/develop/background-work/services/fgs/service-types
- OpenAI 动态工具协议：https://learn.chatgpt.com/docs/app-server
- Shizuku API 13.1.5：https://github.com/RikkaApps/Shizuku-API

Shizuku API/provider/aidl/shared 的 POM、AAR、SHA-256 与 MIT 许可证在 `research/shizuku/`；许可证随应用打包到 `probe/assets/shizuku-LICENSE.txt`。检查上游 settings.gradle 与 .gitmodules（无该文件）；本次使用 Maven 发布包，不拉取源码子模块。依赖 API/aidl/shared/provider 已全部纳入；AndroidX 注解沿用工程现有 annotation JAR。未引入 hidden API bypass 库，也未使用上游已弃用 newProcess 接口。
