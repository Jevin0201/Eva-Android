# 上下文压缩：桌面 Eva 复用与正式 Codex 证据

日期：2026-11-05。本轮不修改桌面源码、安装或用户数据；压缩属于模型上下文维护，不等于删聊天、删工具历史或对 UI 分页。

## 先检查已有桌面实现

用户指示优先复用桌面 Eva 源码后，已读取 `/Users/jevin/Documents/Codex/Eva-Source/package.json`（0.2.1）和实际模块：

- `src/renderer/context-compaction.js` 已完整实现 pending 手动占位、原生 item 生命周期、manual/automatic 来源、10 秒慢请求提示、失败撤销占位、晚到 start 不复活已完成记录、线程隔离。可直接复用该核心。
- `actions.js:991` 的 compactThread 调用 `beginManual`，随后 `api.call('thread/compact/start',{threadId})`；失败 `failManual` 并显示错误。RPC 成功只表示已调度，不表示压缩完成。
- `render.js:377` 把核心 overlay 投影到副本；`render.js:982` 的 renderContextCompaction 输出状态行，使用 presentation 的中文标签与已有 thinking shimmer；不改原生历史。
- `codex-chat-layout.css:108` 给出 .context-compaction-row 的布局与样式，可连同手机 selector adapter 复用。
- `actions.js:1350` / `composer.js:69` 当前桌面 Eva 只显示累计 token 数，未实现正式 Codex 的窗口百分比。此处应保留原行为或添加手机适配，不能把累计 total 当成上下文占用。

原核心及测试已保存 `migration/eva-0.2.1-compaction/`，原始源文件 SHA-256、大小与权限范围记录于 SOURCE.json。原测试仅改 require 路径后执行通过。用户授权复用其私有源码；根目录未发现公开分发许可证，不据此宣称第三方公开再分发权利。

**v41候选源码已集成，尚未安装**。先前自写状态机草稿已移出 probe/assets；当前迁入桌面核心，只改浏览器 bootstrap 暴露 factory。Android adapter 使用原 beginManual/failManual/overlay/presentation，对接 kernelCall、事件和原有工具行；index、资源与 RPC 白名单已加入。未改版本或构建脚本。

## 正式 Codex 安装包静态 REA 证据

目标 `/Applications/ChatGPT.app/Contents/Resources/app.asar`，ASAR SHA-256 `0c951258b7ab381ec601045ffb02159e53f424548dda18e6a4dcfd126557383b`。精确源文件摘要、UTF-8 字节范围及提取片段见 compaction-observations.json。主 bundle 没有重跑全量分析，而是精确截出四个小函数/类并静态解析；未执行 bundle。

REA Evidence `ev_fcfedff580bbe677d1ea9a2f52f641a636bf642fb5acaade8d98ee6aa5283e99`，摘要与完整文件校验见 rea-compaction-summary.json。

- composer bundle `589850.4264f95e93.js` 的 la 函数注册 `/compact`，只有已存在会话可用，requiresEmptyComposer=true；响应正在执行时显示禁用提示。调用 manager.compactThread。
- main `24191.589dcc9878.js` 的 n8 等待已有设置写入，注册手动占位，并按 owner/follower 转发到正确拥有者；真正请求是 `thread/compact/start`，唯一参数 threadId。捕获失败会撤销 pending 并重新抛出错误；没有自动重试压缩逻辑。
- 同 bundle rH pending 管理器使用单一 synthetic ID `pending-manual-context-compaction`。真实 item/started 到来后移除占位，并按 pending 归属识别 manual 或 automatic。item/completed 标记完成并保留来源。现成桌面 Eva 核心覆盖了这些语义。
- 前端将 `contextCompaction` 映射为 `context-compaction`，区分 completed/inProgress/interrupted。这证明状态处理方式，不证明摘要算法。
- `thread/tokenUsage/updated` 更新会话 latestTokenUsageInfo。composer rM 以 `last.totalTokens / modelContextWindow` 计算比例，clamp used 到窗口；窗口无效、token 未知或负数均不显示比例。累计 `total.totalTokens` 不用于该百分比。
- 正式设置 `show-context-window-usage` 默认 false。上下文占用 UI 是可见性设置，不是自动压缩开关。

## 手机已安装内核的只读协议核查

读取父任务已从手机 installed codex 生成的 JSON schema，没有发起压缩或模型调用。源路径与 schema 原始内容摘要见 phone-compaction-schema.json。

已确认支持：

1. `ThreadCompactStartParams`: required threadId；响应为空对象。
2. `ThreadTokenUsageUpdatedNotification`: threadId、turnId、tokenUsage；后者有 last/total/modelContextWindow，细分 input/cachedInput/output/reasoningOutput/totalTokens。
3. item/started、item/completed 中 ThreadItem 存在 `contextCompaction`，协议本身只含 id/type；manual 来源、startedAt/completed 是前端生命周期投影的补充字段，不能误说内核已返回。
4. 老的 `thread/compacted` 通知标注 deprecated，应优先使用 ContextCompaction item。
5. Config schema 暴露 `model_auto_compact_token_limit`、`model_auto_compact_token_limit_scope`、`model_context_window`、`compact_prompt`。scope 语义为 total（完整 active context）或 body_after_prefix（携带窗口前缀之后的采样输出与后续增长）。这些 nullable 字段没有声明默认数值。
6. 手机 android-models.json 中 DeepSeek Flash 的 context_window/max_context_window=1048576、effective_context_window_percent=95；gpt-6.1-sol 为500000/max872000/effective95%。这是模型容量元数据，**不能将95%直接解释为自动压缩触发阈值**。

## 自动压缩与内容保留：明确未知

当前手机 KernelHost thread/start/resume 的 config 只明确提供 model_providers；未硬编码 auto_compact_token_limit，也未替换 compact_prompt。存在自动压缩配置 schema 和 automatic 来源处理，仅证明协议/宿主有此能力入口；本轮没有触发到上下文上限，也未分析 Rust 内核的压缩决策与摘要生成函数，因此**仅凭这些安装包/schema证据不能证实当前模型默认阈值、压缩请求是否实际可用、自动压缩是否已成功运行**。匹配版本开源内核提供了下一节的补充源码观察。

从前端代码可证明：窗口用量来自内核反馈；手动压缩委托同一内核；显示历史没有被前端删掉；成功由 item 生命周期确认。无法从前端证明：系统提示词与开发者指令如何保留、旧用户消息/工具结果摘要如何选择、摘要格式、压缩失败重试算法、恢复到何种 token 预算、是否能无损保留事实。这些必须靠匹配版本内核源码/原生反汇编或隔离的真实压缩验收补齐。

## 手机最小落地方案

直接迁入桌面 context-compaction.js 核心，仅适配初始化 onChange 与 kernelEvent 转发；复用 beginManual/failManual/overlay/presentation 及状态行 CSS。手机薄入口将 api.call 换成 kernelCall，保留空 composer、已有会话、非运行中条件。不得清空可见 turn.items 来“压缩”，不得覆盖默认 compact_prompt 或根据95%猜测并添加独立前端自动压缩。

窗口百分比若需要添加，只补 rM 等价适配，使用 last.totalTokens/modelContextWindow，未知不显示。错误保留原草稿/历史，显示真实失败；不把RPC返回当成完成，不自动重复请求。自动行为继续由内核负责，另用隔离测试线程验收其实际事件与 token 变化，再更新完成状态。


## 匹配版本内核的补充源码观察（非二进制等价证明）

父任务另行提供官方 `rust-v0.166.0` tag 的 companion source：kernel-compaction/{turn.rs,context_window.rs,compact.rs}。SOURCE.json 记录来源 URL、摘要与 scope；Apache-2.0 许可在既有 research/codex-0.166.0/LICENSE。它是匹配版本源码阅读，**不是 REA 反编译结果，也不是本机 ARM64 编译产物与源码逐字节等价证明**。

- turn.rs 的 run_turn 默认在没有 AutoCompactionDisabled 扩展标记时启用 auto_compaction；采样前调用 run_pre_sampling_compact。后者在 token_limit_reached 或已有可用异步压缩 candidate 时调用 run_auto_compact。不能再把“自动触发算法完全未知”作为源码层结论。
- context_window.rs:53 起区分 Total 与 BodyAfterPrefix：前者按 active_context_tokens 计费，后者扣除 prefix baseline。完整有效窗口独立作为硬上限：resolved_context_window × effective_context_window_percent /100。scope budget 还可能加入 token-budget fallback buffer。因此“有效窗口95%”与“独立自动压缩预算”不是一个可随便互换的设置。
- turn.rs:203 起预采样压缩发生在新输入记录前；失败路径先运行输入 hooks 并持久化输入，再发 error lifecycle，避免丢掉用户新消息。UI应显示失败，不自动重发用户消息。
- compact.rs:120 起用配置 compact_prompt，缺省 SUMMARIZATION_PROMPT；手动/自动调用都交给内核 compact task。Responses 路径会组装当前历史和上下文，生成摘要后重建模型使用的历史。代码存在保留初始上下文与真实用户消息的专用组装逻辑，不能由前端删 turn.items 模拟。
- compact.rs:340 起内核本身会区分中断、预算/不完整响应、上下文超限和其他失败。上下文超限时可移除最老模型输入重试，其他可恢复错误有有限 backoff 重试；这是内核策略，和“前端不自动重复发送 compact RPC”并不矛盾。

仍未实测的边界是：手机当前 DeepSeek/OpenAI 的实际生效预算、默认模型 auto_compact_limit 如何解析到最终数值、这次 Android 构建的扩展标记/feature 状态、长上下文自动触发是否成功、摘要后的事实保留质量。候选 adapter 不覆盖阈值、不改默认 prompt，等待独立测试线程验收。

## 候选源码验证

`node migration/eva-0.2.1-compaction/test-context-compaction.js`：原桌面核心生命周期契约通过。比较 factory 部分，Android core 与桌面原文件 factory 正文字节相同，仅浏览器 bootstrap 改动。

`tools/test-context-compaction.cjs`：完整页面 mock 检查未知用量不显示、last/total区别、运行中禁止、原生 item 生命周期、RPC ACK不冒充完成、失败保留草稿/历史、不自动重试。当前通过；没有向手机真实用户会话发起压缩。


### v41候选连接与渲染补充

手动压缩前，适配器按与正常发送一致的 thread/provider/model/project stamp 检查 loadedKernelThreads；未加载时先 excludeTurns:true 轻量 resume，沿用权限、提供商和工作区参数并保留缓存回合。返回不同线程身份时明确失败，不悄悄压缩另一个会话。

渲染读取完整 core.overlay(turns)，临时替换 c.kernelThread 视图并在同步 updateKernelFlow 后 finally 恢复原对象；因此手动占位从 beginManual 到真实 item/started 之间可见，合成 turn 从不进入持久化状态。没有压缩活动的回合保留原对象引用，避免破坏已完成回合的 WeakMap 渲染缓存。

压缩进行中的 native error 和 failed/interrupted turn 显示真实错误，失败不冒充完成；请求 ACK 仍不代表完成。完整页面测试增加 fresh-open resume→compact 顺序、占位出现及失败删除、原始历史不变和异步错误不重试场景。
