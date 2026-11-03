# Android 发送与流式更新审计

范围：当前 Android 源码、已提取 Codex 26.1027.3384 静态包内模块、用户指定 Eva 0.2.0 桌面源码。未启动新的云任务，未读取用户会话正文或凭据，未声称测得网络时延。

## 已观察的链路

1. `models.js:kernelSend` 同步置 pending/running、清输入框并渲染；下一 animation frame 后调用同步 saveKernel，之后 thread/start 或必要的 thread/resume；随后又同步 saveKernel，最后 turn/start。
2. `ShellActivity.Bridge.save` 把完整 data JSON 校验后同步 SharedPreferences.commit；前端 stringify 与磁盘提交均在桥调用返回前完成。saveLater 已有异步通道，但发送前保存承担持久性保证，不应直接删掉。
3. `KernelHost.call` 进入线程池，startup 锁保证内核启动；dispatch 的 providerDispatch 全局锁覆盖 provider 写入与 thread/turn RPC。原实现每次 thread/start/resume/turn/start 都 config/batchWrite，新会话有两次配置写入。
4. 内核 stdout reader 标记 first event，调用 PhoneTaskReport/工具适配后 emit。ShellActivity 以 32ms 合并唤醒 pollKernel，另有 150ms 兜底轮询。
5. pollKernel 一次 drain 最多200事件，合并状态后对当前会话渲染一次。单批渲染已存在，不应误称逐token完整render。
6. updateKernelFlow 每批重新投影当前turn和生成HTML，并在变化时整体替换当前turn section.innerHTML；旧已完成turn有WeakMap缓存。持续输出仍会反复替换整个当前turn，影响选择、details内容与布局；每次都会读scrollHeight/offsetTop/getBoundingClientRect及派发scroll事件。

## 已实施：消除冗余 provider 配置写入

只修改 KernelHost，不修改现有模型/权限/持久化语义。新增共享 ProviderConfigCache：

- 只有同一确切子进程、相同 provider+definition、相同 config.toml SHA256 才复用成功配置。
- 缓存为两宿主共享；另一宿主的成功写入会替换stamp。单host currentProvider无法保证这个条件，所以没有采用仅比较currentProvider的方案。
- 配置文件变化、无法读取、提供商定义变化、子进程替换、退出、登出及配置写入失败不复用。
- 仍保留全局providerDispatch锁，避免为了提速引入配置切换与实际请求的竞态。
- 只记录 provider-config:written/reused 标记，不记录URL、凭据、prompt或输出。
- 桌面对照：Eva src/main/main.js 的 prepareDesktopThreadRequest 后直接 server.request/sendLedger.execute；src/main/providers.js config() 返回model_providers定义，并没有Android这种每回合写配置。此变更去掉Android适配层额外成本，未复制专有Codex实现。

验证：tools/KernelProviderCacheTest.java 直接调用产品嵌套cache类，15项通过；KernelHost在Android36 API/Java8编译通过。尚不能据此声称云请求缩短多少秒。

## 建议由主线实施的前端升级

- 使用明确状态：准备/保存、连接或恢复会话、已提交等待模型、工具运行/等待用户、停止确认；仅依据真实阶段切换，不能用动画冒充模型收到。
- 当前 pending 仅显示用户文本 + footer“正在发送”，没有独立、可持续的反馈；等待期间很容易理解为点击失效。
- 对当前turn使用稳定item容器，仅更新变化的item；对纯文字流追加与Markdown块重新解析做节流；保持键盘焦点、用户展开状态、阅读锚点。
- 先保留现有32ms事件合并，不盲目把轮询变成10ms。真正需要量化的是批渲染耗时和帧占用；减少DOM替换通常比提高轮询频率更有效。
- 如需进一步减少发送前磁盘延迟，应复用桌面send-ledger的最小待发送记录/receipt契约，不可直接把durable save改成未确认的fire-and-forget。

## Codex静态证据与边界

- start-turn-3f6fbf886410.js：在 getFollowUpContext 之后 startTurn，并传 onRequestDispatched/clientUserMessageId trace。可借鉴“请求准备”和“实际派发”分段，不可推断该步骤实际耗时。
- streaming-text-bcc3b24ae7fd.js：流式组件接受 animate、onComplete，分段 fadeSegmentDelayMs 默认24，最大延迟800，完成fallback2500。此为展示动画参数，不是网络发送/模型响应等待；不可把2500ms当作真实模型延迟或给手机强加等待。
- composer-send-c6a97339d30a.js 是 cloud/orbit messaging 路径（含messaging-room），确有optimistic/deliveryUnknown，但不能直接当成所有Codex本地turn的实现。
- 已发布包模块通过父任务REA处理；本报告不另造Evidence ID，完整scope与integrity限制应引用父任务REA ledger。

## 真机时延验收设计

现有 KernelTrace 128条无正文事件可复用，但 once() 是全局reset以来首次，不是每个turn；rpc-send标记位于write之前，因此不是实际flush完成时间。

建议每条发送产生不可复用requestId，记录以下单调时钟阶段：

- JS click、optimistic DOM commit、durable save开始/完成、thread/resume开始/完成、turn/start bridge调用。
- Native bridge收到、worker开始、startup ready、provider-config hit/write、实际write+flush完成、turn/start RPC返回、首个turn/started、首个agentMessage delta。
- JS首次drain收到该request/turn、该turn第一次可见DOM提交。

不要直接相减JS performance.now与Android elapsedRealtime：两个时钟需要一次校准，或分别报告宿主内区间。先验证warm same-thread发送减少config/batchWrite次数，再分别报告cold/warm/切换模型的区间；模型网络首字单列，不并入手机提速成绩。

父任务可通过EvaHost.kernelTrace(true)清空→发送一个简单验收任务→完成后kernelTrace(false)读取；对同会话再发一次。第一轮应出现一次provider-config:written，其紧接turn/start为reused；第二轮应无额外config写（配置未变化时）。切换提供商、修改MCP配置、重启进程后必须重新written。共享配置受其他进程直接修改的校验/使用瞬间竞态无法仅靠本地缓存完全消除。
