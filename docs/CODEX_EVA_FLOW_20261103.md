# Codex 对标与 Eva 桌面信息流迁移验收

2026-11-03。用户要求先对标正式 Codex，再优先复用指定 Eva 桌面源码。此次完成信息流核心迁移和发送适配优化，已构建并覆盖安装到已连接的 M332BF 真机；没有修改桌面 Eva 项目或用户数据。

## 来源与实现

REA 静态检查安装的 OpenAI.Codex 26.1027.3384.0 app.asar，选择 10 个 JavaScript 模块及 package.json，覆盖活动行、折叠、流式文本和发送入口。不是完整应用逆向，也不是桌面运行时观测。分析记录 8 个 unpacked native 文件完整性差异后继续静态分析；没有执行这些目标文件。完整证据 research/codex-flow/rea-evidence.json，选取清单 asar-inventory.json、selected-sources.json，同目录 flow-findings.md、latency-findings.md 记录分析范围。

正式 Codex 仅用作对照；产品核心使用用户提供的 Eva 0.2.0 src/renderer 源码。迁移快照、来源 SHA256 和许可说明在 migration/eva-0.2.0-flow/。

- 五个 native-transcript 模块原样复用：分组、活动统计、摘要、折叠、持久错误判定。eva-flow-projection.js 是手机协议/视图适配，使用桌面 activityDisposition/nativeActivityLabels。
- transcript-dom.js 迁入 eva-transcript-dom.js：现有当前回合 section.innerHTML 替换改为逐节点更新，保留文本节点、焦点、用户选择及展开内容。
- 复用桌面 thinking 样式与显示规则，增加手机连接/提交阶段反馈。工具执行或等待审批时不叠加第二个思考提示。未人为增加流式延迟。
- 通过现有 mobileFlow 宿主显示分组和按需工具输出，移动端字号、间距与触摸区域适配。
- KernelHost 仅在同一内核进程、相同提供商定义及配置文件指纹时复用已成功写入的配置，减少 thread/start 与 turn/start 的冗余 config/batchWrite。进程替换、配置变化、失败、登出失效。保留发送前持久化和提供商串行锁。

## 验证

构建 tools/build-probe.ps1 成功；probe/build/eva-probe.apk 已 adb install -r。Java 仅既有 Java 8/API 过时警告。

通过：test-eva-flow-projection.cjs、test-eva-transcript-dom.cjs、test-flow-parity.cjs、test-flow-feedback.cjs、test-chat-scroll.cjs、test-task-controls.cjs、test-chat-drafts.cjs，以及 KernelProviderCacheTest.java 15 项缓存检查。覆盖最终答案分界、失败顺序、子智能体/中断展开、懒详情、DOM 引用保留、滚动/输入焦点、提交反馈、审批、停止/引导和空会话逻辑。

真机 accept-codex-flow.cjs 使用单独验收会话，DeepSeek 两轮成功：第一轮执行只读 pwd 并返回 FLOW_OK_1，第二轮直接返回 FLOW_OK_2。已独立展开真实工具详情并读出 /root/eva-workspace。

| 本次样本 | 新会话首轮 | 同会话次轮 |
| --- | ---: | ---: |
| JS 发起后下一帧回调 | 3.1ms | 5.9ms |
| JS 收到内核接受 | 419.8ms | 100.6ms |
| 回合完成 | 3159.2ms | 869.8ms |
| 提供商配置 | 写入一次、发送时复用 | 直接复用 |

下一帧回调不是精确屏幕呈现时间；接受时间是 RPC/turn started 反馈，不是模型首字。firstEvent 含用户消息，不作为模型首字统计。两次任务内容不同且没有改前同条件基准，不能计算提速百分比。云端与网络时延仍受外部条件影响。完整本次样本 artifacts/codex-flow/device-rounds.json，截图 device-collapsed.png、device-expanded.png。

## 明确边界

本轮不是整个移动端与桌面端 100% 一致。Eva 仍用 first-final 划界，保留答案后的工具和后续消息；与当前 Codex 最后答案分离存在已记录差异。Activity 展示使用 Eva HTML 宿主方式，没有接入整套 React/motion 动画组件。没有为此重写渲染框架。

APK 构建工具链/bootstrap 的进一步补全依照用户优先级暂让位于本轮信息流升级；本验收不声称全产品交付或解决所有后台网络问题。
