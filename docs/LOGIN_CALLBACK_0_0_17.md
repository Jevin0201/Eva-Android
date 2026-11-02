# Chrome 登录回调超时修复

2026-11-02 真机现场：Chrome 已跳到 127.0.0.1:1455/auth/callback，显示 ERR_CONNECTION_TIMED_OUT。记录不保存 callback 查询参数或授权码。

对照结果：
- 后台 Codex 进程仍在，ss 显示 127.0.0.1:1455 处于 LISTEN。
- Eva 在后台时，同 UID 运行环境的 loopback TCP 探测超时。
- 仅将 Eva 切回前台，不重启内核或重建登录，TCP 连接立即成功。

这些证据定位到当前设备后台网络/进程管理影响，不能由此推导 OpenAI 对所有 Android 客户端是否支持，也不能宣称真实账号授权已完成。

0.0.17 增加 LoginService（dataSync 前台服务）：用户发起或继续登录时启动；通知可返回账号页；授权完成/取消/失败后停止；等待超过十分钟取消并提示重试。服务维护后台账号状态检查。KernelHost 处理 account/login/completed，避免失效请求始终显示等待中。

安装后实测：Chrome 前台，LoginService isForeground=true，回调端口 TCP 可连接。完整 OAuth 完成仍由用户网页授权及服务端结果决定，不读取用户密码、桌面凭据或输出令牌。
