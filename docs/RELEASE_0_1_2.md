# Eva Android 0.1.2 — 对话载入优化

版本 0.1.2 / versionCode 90，正式包 ai.eva.android.probe，沿用现有签名，覆盖安装保留数据。复制粘贴修复及真机验收见 RELEASE_0_1_1.md。

## 变更与边界

kernel-paged-history.js 原先先等待 thread/read 元数据，再发送 thread/turns/list 首屏摘要。两者都只依赖 threadId，现在同时请求，以 Promise.all 汇合并观察异常。保留首屏最近 5 回合、请求代次、实时消息合并和迟到结果保护，不读取完整历史，也不在点击处理器同步渲染大历史缓存。

原生内核采用线程池，每个 RPC 独立等待回包，历史读取不持供应商修改锁，支持该并行读取。内核冷启动初始化和 Markdown 首次渲染仍有独立成本，本次不声称解决全部载入等待。

## 验证

- test-chat-history-latency：受控元数据 120 ms、摘要 180 ms 条件下，串行 300 ms 改为并行 180 ms；仅为模拟请求等待，不代表真机整体提速 40%。单边及双边失败不产生未处理异常。
- test-history-live-races、test-chat-responsiveness、test-kernel-request-cache 通过；快速切换、设置页、输入草稿、实时回合和分页边界保护保留。
- 全量 Java 构建、APK ZIP 完整性、关键资源与源码一致性检查通过；正式覆盖安装成功，手机版本已核对为 90 / 0.1.2。
- 旧版测量曾使用 EvaHost Proxy 出现超时，恢复不代理原生桥的测量后，三次对话载入为 116–125 ms。缺少当时 RPC trace，不能断言超时为产品缺陷。
- 新版对已有历史的真实会话连续载入三次为 105.5、98.7、99.8 ms，点击同步处理为 13.6–21.0 ms。核对实际加载资源含并行读取；存储保留 1 个会话、1 个草稿，无测试会话残留。该小样本为已启动内核的同一短会话，不代表冷启动或长历史的整体提速比例。证据 artifacts/chat-load-0.1.2/device-after-native.json。
- 测量数据已写盘后，附加的 CDP 截图超时，脚本因此返回非零；这不作为全脚本通过记录。随后单独保存原生屏幕截图 installed-native.png，测量数据与截图步骤分开记录。

交付：outputs/eva-android-0.1.2-arm64-release.apk，SHA256 和 source-manifest 同目录保存。构建时对源码前后指纹核对，避免混入构建中途的变更。

## 清理

临时构建、测量脚本和证据集中 artifacts/chat-load-0.1.2；保留交付、数据备份及签名。已检查新构建重复产物，核实绝对路径及交付 SHA 后，自动审批拒绝删除，返回 blocked by policy，无具体原因；未绕过，产物暂留。历史清理拒绝记录沿用 RELEASE_0_1_1.md。测试 ADB 端口转发已移除。
