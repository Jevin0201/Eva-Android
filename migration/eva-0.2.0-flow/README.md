# Eva 桌面信息流迁移

从用户提供的 Eva 0.2.0 源码原样复制 `src/renderer/native-transcript/`，源 SHA256/commit 见 SOURCE.json。未改桌面项目。运行时副本位于 `probe/assets/eva-native-transcript/`；已接入 Android index.html 与 ShellActivity 资源白名单，构建并安装到真机。

## 安卓桥接与验证

`probe/assets/eva-flow-projection.js` 在五个模块之后加载，导出 `EvaFlowProjection.projectTurn(turn,itemText,options)`。options 可提供 backgroundAgents/expandedKeys；返回原 turn 与 mobileBlocks，每个 assistant block 带 work/persistent/final 及其 Groups。桥接仅适配协议文字、公开 reasoning summary、手机工具标签、真实时间戳和 Android 视图字段，原分组/摘要/折叠/持久项规则由 nativeTranscript 决定。

其中 `activityDisposition` 与 `nativeActivityLabels` 函数主体直接复制桌面 `src/renderer/render.js:556` 和 `:684`，其余为平台适配。保留桌面 first-final 划界；后续工具仍通过 finalGroups 渲染，不当作纯文本丢失。普通工具失败按原时间顺序保留在工作组，仅桌面判定持久的审批错误放在外面。reasoning 只保留公开 summary，不展示原始 content/text。

`node tools/test-eva-flow-projection.cjs` 验证原模块字节、普通浏览器脚本加载、连续工具/消息分组、错误顺序、审批持久项、运行状态、取消/子代理折叠、答案后工具、隐藏内部工具、reasoning summary、真实时长和稳定 group key。此为隔离协议测试，不替代真机验收。

额外视觉候选：`src/renderer/native-steering/adapter.jsx:92–107` 的 ActivityMessage/ActivityDetails，依赖 activity-shell-original.mjs（React/Compiler/JSX/cx/motion）、activity-summary-original.mjs、activity-labels-original.mjs、activity-current-zh-CN.json、activity-glyphs-original.json、activity-current.css。整份 adapter.jsx 还依赖 markdown、delivery、image-preview 大量模块，不能作为普通 script 直接引入。Android 可单独迁 Activity 闭包及宿主；普通 HTML fallback 不等于原 React 动画组件。

## 加载顺序与依赖

按桌面 index.html:282–286：original-core.js → activity-core.js → statistics-core.js → disclosure-core.js → host.js。

五个 JS 为 globalThis/IIFE 模块，无 imports、Electron IPC、Node require 或 DOM 调用；不需要新增子模块/包依赖。host 仅做协议形状与调用方提供的 classify/turn/backgroundAgents 适配。

- `nativeTranscript.renderGroups(items, classify, {scope,turn,backgroundAgents,excludedSubagentThreadIds})` 返回 `agent-activity` / `activity-item` / `assistant-message` / `user-message` / `generated-images`，group含稳定key、items和collapseWhenPossible。
- `nativeTranscript.summarize(group.items,turn,group.collapseWhenPossible,isLatestVisibleUnit)` 返回 `{state,parts,simplified,activeItem,activeDisplay,activeKey}`。state.kind为summary/active/thinking。由桌面render.js的nativeActivityLabels负责中文标签。
- `nativeTranscript.disclosureState({hasFinalAssistantStarted,isTurnCancelled,hasRenderableAgentItems,forceExpanded,persistedCollapsed,preventAutoCollapse})` 返回`shouldAllowCollapse/isCollapsed`。
- `nativeTranscript.isFinal(item,turn)`、`isPersistent(item,turn)`直接判断最终答案/需保留的审批错误。
- `beginRender(scope)` / `endRender(scope)`必须配对，用于稳定group key。
- `registerDynamicTool(namespace,tool,renderer)`可为eva_phone/eva_browser提供Android语义标签。

Android适配层应直接调用上述模块，把group.type转成现有mobileFlow的kind；桌面render.js的`activityDisposition`、`nativeActivityLabels`和`renderWorkActivity`供逐段迁移。不要重新写一套工具分组、计数或折叠状态机。

## 桌面渲染边界

`src/renderer/render.js`: finalAnswerStart 466行、renderThinking/shouldShowThinking 481–483行、renderAssistantSegment 503行、activityDisposition 554行、renderFlowItems 567行、nativeActivityLabels 684行、renderWorkActivity 718行。行号应由主流程重新核对后接入。该文件依赖大量全局state/图标/事件/工具详情函数，不能整文件复制执行。

## 与当前Codex的区别

这些Eva核心保留了26.1023.6123旧包的函数主体；本次研究Codex为26.1027.3384。activity state、disclosure核心关键算法仍对应，但不存在“整个信息流严格相同”的证据。Eva renderAssistantSegment本身仍从first final划界，不能把直接迁移声称已修复新Codex最后答案/post-final分离。应先迁移Eva同源基线，单独记录该差异再做最薄适配。

## 许可记录

用户提供源码包，根package标记private；根未发现LICENSE。core文件及provenance说明其内容来自Codex发布包保留函数，不能将其宣称为Apache开源实现。此目录保留原始来源信息；没有引入新的第三方实现或签署/断言额外再分发许可。
