# 0.0.13 密钥粘贴与 OpenAI 账号接入

## 0.0.14 用户修正

默认已改为与桌面同样的 `account/login/start {type:chatgpt}` 浏览器 OAuth。优先通过 Android ACTION_VIEW 打开 com.android.chrome，Chrome 未安装时交给系统浏览器。设备码只在“其他登录方式”中保留。账号页随未登录、授权中、已登录切换可见操作，不再默认展示验证码。

AccountCheck 真机通过：内核生成官方 HTTPS OAuth URL，redirect_uri 指向手机本机回调端口，Android 侧能够连接该监听端口，测试登录已取消。没有代替用户完成账号授权。账号授权使用 Chrome 是用户明确指定的例外；一般代理网页任务仍使用 Eva 内置浏览器。

以下为 0.0.13 历史实现及验证记录，默认登录路径以上述 0.0.14 为准。

2026-11-02，安装到已连接手机。

- API Key 增加原生“粘贴 API Key”按钮，支持在光标处插入或替换选中内容；仅用户点击时读取文本剪贴板，不记录内容。显式设置密码 TransformationMethod，避免 setSingleLine 覆盖密码遮罩。
- CredentialPasteCheck 真机通过：313 字符模拟密钥、替换选区、系统原生粘贴、密码遮罩。测试不保存提供商；恢复此前剪贴板，不输出其内容。
- 设置 → 账号与模型 → OpenAI / ChatGPT 账号。使用内核 account/login/start（chatgptDeviceCode）、account/login/cancel、account/read、account/logout；授权网页在 Eva 内置浏览器打开，没有网页原生桥。
- 登录后从 model/list 读取模型，用户选择后设为新会话默认。账号会话使用 modelProvider=openai；已有自定义提供商会话保持原选择。额度来自 account/rateLimits/read，不由本地估算套餐配额。
- 真机发现原 Linux rootfs 固定 DNS 无法解析全部测试域名。KernelNetwork 为内核提供随机凭据保护的 loopback CONNECT 隧道，使用 Android 域名解析；不解密 TLS、不记录目标数据，限制连接数和头长度。内核进程得到代理环境变量，localhost 保持直连。
- AccountCheck 已实际从官方服务申请到设备码并取消。没有代用户登录，没有读取用户密码、桌面凭据或打印验证码。完整用户授权、账号模型调用和实际额度显示仍待用户完成登录后验收。

依据：本地 Eva 0.166.0 协议定义；[官方认证说明](https://learn.chatgpt.com/docs/auth)、[App Server 账号协议](https://learn.chatgpt.com/docs/app-server)。设备码授权可能需要在 ChatGPT 账号安全设置或工作区权限中开启。使用该账号可用的 Codex 模型与额度；不把登录状态或模型列表等同于所有 OpenAI 产品均有调用权限。
