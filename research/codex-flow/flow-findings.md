# Codex 发布包信息流静态分析

目标：本机 OpenAI.Codex 26.1027.3384.0，app/resources/app.asar。仅分析包内已发布 JS 字节，不执行目标代码，不读取账号或会话数据。来源 SHA256 见 selected-sources.json 与 flow-additional-sources.json。主流程 REA Evidence ID 由主代理汇总；本报告不把纯静态分析称为实际运行观察。

## 已观察到的行为规则

1. split-items-into-render-groups 的 m 函数将用户消息、工作活动、当前 commentary、最终助手回答、postAssistantItems、审批、提问、MCP授权、子代理分组分开。会从尾部寻找可显示的助手回答，容忍答案后已完成的命令/子代理事件，不把答案后所有项都当正文。latest 模式只保留最新公开 commentary。
2. inline-followup-markdown 的活动单元模型区分连续可分组工具与独立消息；带 startsGroup 边界；最新活动单元依状态展示 active/thinking，其余显示 summary。连续读取/搜索/列目录被汇总为 exploration。重复已完成 MCP 可合并，但带审批/有独立输出/电脑控制的调用不泛化合并。
3. local-conversation-turn 的 Vs 函数实现互斥占位：正在探索/规划时用对应状态；已有助手内容、网页搜索、动态工具摘要、阻塞审批时不再额外加泛化 Thinking；等待真实用户回答使用专门文字。没有可显示进度时才回退 Thinking。
4. subagent-activity-chip-group 的 uM 函数：有最终答案开始且未取消，才允许自动折叠（另有显式allowCollapseBeforeFinal开关）；forceExpanded优先，手动persistedCollapsed优先于自动默认。调用处在仍有运行子代理、异步内容等情况下设置preventAutoCollapse。
5. collapsed-turn-disclosure：已完成过程用真实 Worked for duration；没有耗时时用 previous message count，不编造用时。展示历史自动审查拒绝计数。按钮 aria-expanded 与箭头一致，下面是一条轻分隔线。
6. agent-activity-item-row：工具主要是一行图标+摘要+展开按钮，灰色较弱文字，详细body折叠；非大卡片堆叠。点击展开时先保存时间线锚点。普通 activity-row 模块更像其他应用列表通用行，不可直接认定聊天主工具行。
7. streaming-text：可选分段淡入，默认间隔24ms，累计延迟上限800ms，完成兜底2500ms。这是显示动画参数，不是模型或网络速度证据。手机无需为了对齐外观人为延迟文字。
8. local-conversation-thread-turn-entries 同时包含 compact Aeon 分支，某些模式会把最终回答隐藏到完成并显示Typing、甚至有1~3秒reveal delay；这些由产品/feature flag分支控制，不能推断所有Codex会话都如此，不建议在手机照搬延迟。

## 安卓当前差异

- models.js projectKernelTurn 从第一个非空 final_answer 开始把后续全部项归入 final，工具落在正文区域；失败工作被抽到 persistent，并在视图先输出，破坏时间顺序。
- eva-flow-view 虽接受 workGroups/finalGroups，但现有投影未实际提供分组，工具仍逐条展开标题/状态/命令。
- commentary 与普通assistant共用外观；没有与最新工具摘要互斥的等待状态模型。
- 折叠状态Map以块序号键保存，基本可用，但没有未完成子代理/待答请求的阻止自动折叠条件。
- 用时只读durationMs，遗漏已有起止时间字段；缺失时显示泛化“处理过程”。
- 整个turn的innerHTML随流式变化重建。虽然保存了外层滚动锚点，仍可能打断选择/展开内部DOM；独立稳定节点或有限末尾更新更接近正式包组件模型。

## 本轮建议的独立实现

P0：发送即有本地用户条目和明确发送状态（主代理负责），不要把“发送中/等待首个事件”称为已执行；真事件到达后切到当前动作。公开summary可见，隐藏reasoning.content不展示。
P1：连续工具压为单行活动组，commentary作为独立分隔；最新活动摘要取最新正在进行的操作，历史组显示条数；失败保留原序且默认展开。
P1：最后一个非空final只作为最终正文；后续活动独立postFinal。取消/失败、待答请求、未结束子代理不得自动折叠。没有真实时长时显示数量，不猜测时间。
P2：工具展开保持滚动锚点、用户手动展开状态稳定；动画仅淡入且尊重减少动画设置，不人为拖慢字符到达。

## 验证边界

上述均为静态代码观察和据此制定的手机实现选择。未证明产品feature flags实际取值，未抓取正式版在线网络/动画时间线，未宣称桌面与手机底层性能相同。新代码为独立重写，不把Codex专有模块复制到APK。

## 源文件字节锚点

- `split-items-into-render-groups-60ff256697ca.js` UTF-8 offset `361`：`function m(`
- `split-items-into-render-groups-60ff256697ca.js` UTF-8 offset `4500`：`postAssistantItems:`
- `split-items-into-render-groups-60ff256697ca.js` UTF-8 offset `4449`：`currentCommentaryItem:`
- `inline-followup-markdown-4c23df21794a.js` UTF-8 offset `20664`：`function Ke(`
- `inline-followup-markdown-4c23df21794a.js` UTF-8 offset `19812`：`function We(`
- `inline-followup-markdown-4c23df21794a.js` UTF-8 offset `6477`：`grouping===`groupable``
- `local-conversation-turn-db5559f1c48c.js` UTF-8 offset `31264`：`function Vs(`
- `local-conversation-turn-db5559f1c48c.js` UTF-8 offset `69372`：`waitingForYourAnswer`
- `local-conversation-turn-db5559f1c48c.js` UTF-8 offset `79088`：`preventAutoCollapse:`
- `subagent-activity-chip-group-6fb64417b5f0.js` UTF-8 offset `395932`：`function uM(`
- `subagent-activity-chip-group-6fb64417b5f0.js` UTF-8 offset `397245`：`persistedCollapsed:f??N`
- `collapsed-turn-disclosure-60796455ae54.js` UTF-8 offset `912`：`localConversation.workedFor`
- `collapsed-turn-disclosure-60796455ae54.js` UTF-8 offset `1291`：`localConversation.previousMessagesSummary`
- `collapsed-turn-disclosure-60796455ae54.js` UTF-8 offset `3109`：`localConversation.deniedActionsCount`
- `agent-activity-item-row-56ee4e39916f.js` UTF-8 offset `3779`：`function F(`
- `agent-activity-item-row-56ee4e39916f.js` UTF-8 offset `261`：`preserve-timeline-anchor-position`
- `streaming-text-bcc3b24ae7fd.js` UTF-8 offset `352`：`24:f`
- `streaming-text-bcc3b24ae7fd.js` UTF-8 offset `1424`：`fadeSegmentMaxDelayMs:800`
- `streaming-text-bcc3b24ae7fd.js` UTF-8 offset `1717`：`u=2500`
- `local-conversation-thread-turn-entries-5978cdd2a00b.js` UTF-8 offset `2122`：`revealAtMs:Date.now()`
