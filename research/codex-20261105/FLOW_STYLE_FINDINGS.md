# 正式 Codex 信息流静态样式证据（2026-11-05）

目标为 `/Applications/ChatGPT.app/Contents/Resources/app.asar`，应用身份由父任务核验为 com.openai.codex 26.1029.61003，ASAR SHA-256 `0c951258b7ab381ec601045ffb02159e53f424548dda18e6a4dcfd126557383b`。

## 证据边界

- REA `ev_d4f29b71c6a5b58ea869c31d914c226238d24c028a33605f0d370f7fc0d565fe` 分析正式 ASAR 中两个小模块 `899308.3f1db3f4cb.js` 与 `592985.cdef4a4347.js`；没有重复运行堆溢出的整个 main 模块分析。
- REA `ev_f4bed593ccb0cf17903aebc5e4c321abb4318908e28da838c86be3806d94218f` 分析从 main 精确截取的 G9sS 工厂，其来源范围与全文摘要记录于 `flow-style-observations.json`。截取后只是静态解析，没有执行工厂。
- 完整 Evidence 位于忽略目录 artifacts/diagnosis-20261105，摘要、完整记录摘要校验与限制保存在 `rea-flow-style-summary.json`。
- 所有下面的源码片段均有包内文件 SHA-256、原始 UTF-8 字节范围；这些是静态渲染规则证据，不是正式客户端当前运行的 computedStyle 或视觉截图。ASAR 内若干 native 依赖完整性存在矛盾，已在 REA limitation 中保留；未执行这些二进制。

## 可以证明的规则

1. **活动分组**：899308 的 udV3 把 groupable 活动合并为 `agent-activity-group:*`，而不是每个工具都独立占据一个完整消息块；standalone 活动有单独 key。一般纵向条目间距 CSS 变量回退 16px，组内 4px。
2. **展开与收起**：同文件 r9ev 参数包含 `defaultExpanded/indentContent/status/children`。实际逻辑是有 children 时，running 使用 `!用户已收起`，非 running 使用 `defaultExpanded` 初始化的状态（默认 false）。所以运行时默认展开、完成后默认折叠，可由用户切换；不是“所有工具始终展开”。折叠时高度0、opacity0、aria-hidden、inert 和 pointerEvents none 一致。
3. **标题样式**：活动标题是 `text-size-chat text-text-tertiary/90`，hover 变 text-default；header 是 `group/activity-header relative inline-flex min-w-0 max-w-full self-start items-center gap-1 p-0 text-start`。有可展开详情才加入 chevron 和 button/aria-expanded；没有详情不能显示空的可点折叠控件。
4. **耗时不是每轮必有**：main 的投影 case reasoning 仅在规范化 summary 非空，或 reasoning 仍是运行中最后一项时才输出 reasoning。完成后空 summary 被过滤。最终回答前的 `em(items,index)` 检查是否有非 user-message、external-event、realtime-transcript、worktree-init 项；只有存在这种工作项才 hasStartedWork。母调用还在完成回合缺少 firstTurnWorkItemStartedAtMs 时把 workStartedAtMs 设 null。G9sS 工厂要求 hasStartedWork 与 startedAtMs 同时有效，否则返回 null。因此 **用户消息 + 空 reasoning + 纯最终文本** 的完成回合不会产生“用时1s”及横线。
5. **耗时状态**：592985 显示 loading 骨架、unknown=Activity、paused=Paused、working 小于1秒=Working、达到1秒=Working for time、worked=Worked for time、stopped=You stopped after time。unknown 不应捏造0秒。耗时文字为 tabular-nums，默认 text-tertiary；容器是 `flex min-h-0 flex-col items-start gap-2 text-size-chat text-secondary`，其下有 `w-full border-t border-default`。只有上一步生成这个条目时才应显示相应分隔线。
6. **字体 token**：正式 CSS `361a1f04b890.css` 中 `.text-size-chat{font-size:var(--codex-chat-font-size)}`；默认 `var(--codex-chat-font-size-override,var(--font-ui-size,13px))`。它可随设置变化，不是固定“正式版14px”。本次未追到当前用户设置和 body 继承后的最终行距，不能声称正式消息都为14/22。`.leading-6` 是 spacing×6，spacing默认.25rem，但不是所有消息都挂了此class。
7. **用户气泡**：34346 的 vHM0 默认 end 对齐，`bg-user-message text-user-message min-w-0 max-w-(--user-chat-width) overflow-hidden break-words px-(--thread-content-margin)`、普通 `py-2.5 rounded-2xl relative text-start`。配套 `.bubble-vBnidZ` 设置默认宽70%、圆角spacing×5.5、水平padding spacing×4；特殊 leadingBubble 可100%。

## 手机适配建议（设计选择，不伪称原样迁移）

- 现有 `eva-native-transcript/host.js` 及 original/activity/disclosure core 可以继续提供状态投影、组装和折叠结构；优先修 `eva-flow-projection.js` 对空 reasoning 和 worked-for 的生成条件，不能只用 CSS 把“用时”隐藏。
- `eva-transcript-mobile.css` 已有 .mobile-native-activity / .mobile-turn-process，但14px/22px、85%气泡宽、32px触摸高度是手机适配值，不是本次正式包测得值。可保留移动可读性，改成共享 token 管理并在文档标明取舍。
- 组内工具纵向间距按4px、活动与正文按16px建立层级；避免每个工具重复边框、背景、粗标题。真实代码与完整输出放折叠详情。
- 无工作活动的纯文本回复仅显示正文；工具活动结束后显示清晰可展开的一行摘要；耗时与分隔线必须绑定同一个真实投影条目，不得生成孤立空线。

## 未知与未交付

未获取正式客户端运行时 computedStyle、不同主题实际色值、字体设置与缩放；未完整恢复所有 activity 显示分支。此次只提交证据与建议，未修改产品样式或信息流代码。手机视觉与触控验收由父任务统一执行。
