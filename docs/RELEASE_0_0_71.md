# 0.0.71 导航流程学习与真机验收

2026-11-07，在 USB 连接的 M332BF 手机上完成保留数据升级。先使用正式签名的调试验收包执行检查，最后覆盖安装关闭 debuggable、移除 instrumentation 的正式包。versionCode=71，versionName=0.0.71，firstInstallTime 仍为 2026-11-02 15:09:00。

## 本轮实现

同回合连续成功的 eva_phone_steps 合并为最多 20 步的候选。失败、独立界面操作和路线回放打断学习链。模型核对 observation 达到目标后可直接 save success=true，无须用户单独发出保存要求。保存路线支持后续 list、replay、confirm，保留实时匹配、偏离停止和重复偏离停用。

## 真机证据

证据集中在 artifacts/route-learning-20261107/。

- native-routes.txt 为 PASS phone routes 22 checks，覆盖保存读回、路径限制、敏感步骤拦截、并发计数、连续批次合并、跨回合隔离及失败链清除。
- native-batches.txt 为 PASS phone batch 14 checks。
- 默认 DeepSeek 首次测试返回 402 Insufficient Balance。仅把测试会话切换到已登录的 OpenAI gpt-6.1-terra，默认提供商未更改。
- model-learn-final.json 与 model-replay-final.json 保存真实模型轨迹。模型打开 com.miui.calculator、观察计算页、保存“前台打开系统计算器”，下一回合 list、replay、confirm success=true。learned-route.json 为应用私有存储读回，successes=2。
- 第二次任务还进行了 foreground 后的独立 open_app，再回放路线。未证明最少调用次数或 Token 净节省。
- install-release.txt 记录升级前完整会话快照与正式 APK 覆盖安装成功。installed-package.txt 核对版本和非调试标志。release.png 和 release-screen.txt 核对正式包启动后原验收会话恢复。

本次模型实测路线仅包含打开计算器一步，连续多批学习由原生回归覆盖，复杂多步骤跨 App 仍待实测。微信专用快捷流程仍受固定 WechatPolicy 配置限制，截图坐标动作与完整消息流程的自动学习未完成。

## 清理

删除本轮两个构建目录中已被签名 APK 收录的临时类文件、类归档、资源归档与中间 APK，以及已解压使用的 platform-tools 下载压缩包，共约 1934 MiB。逐项绝对路径与字节数见 cleanup.json。保留签名 APK、ADB 工具依赖、升级前用户数据快照、构建及测试证据。既有 tmp/launch-confirmation-fixture 用途属于其他工作，保留。
