# 全项目验收工作记录（2026-11-18，持续推进）

## 当前结论

尚未完成用户要求的每个功能、每个按钮全验收，不能宣称整机无 bug。已完成首轮 105 项隔离回归、15 个 Web 页面三轮测量、12 个原生页面打开与入口盘点、浏览器最小化交互、账号读取、存储隔离检查及冷启动观察。相关原始证据集中 artifacts/audit-20261118。原生页面打开不等于其所有按钮功能已通过。

用户允许停止当前任务再验收。原会话在点击停止前已结束，因此停止脚本没有成功触发（等待按钮超时），不得记为真实停止通过。隔离 stop/steer 测试通过；真实模型停止和引导仍待专项验收。

## 已修复并交付的性能问题

1. UiStateStore.load 对所有历史反复 JSONObject 解析/序列化：保留分块顺序、长度、SHA 校验和事务；未有模型选择覆盖的记录直接拼接已保存 JSON，有覆盖的记录继续解析合并。2 MB 历史、草稿、过期写入与模型覆盖、空元数据和损坏检测共 18 项独立真机存储检查通过。
2. 新建对话同步 persist 全历史：原生具备增量异步保存接口时使用现有单会话 checkpoint，保留旧宿主回退。5 MB 历史 fixture 中新建处理 0.1 ms，单次小于 10 KB checkpoint，无同步全量保存；项目/存储失败保护回归通过。这个数字是电脑 fixture，非手机端到端耗时。
3. 关于页旧版本号 0.0.60 改从已安装包读取，结果缓存，避免反复查询。
4. 会话载入文字替换居中半透明旋转圆环，pointer-events:none；正常加载和渲染器等待共用样式，无可见文字，保留无障碍标签与减少动态效果设置。回归验证中心位置、透明度、动画、返回可用、迟到历史保护。

## 真机性能证据及边界

- 首轮设置页面双 rAF 约 10–22 ms，插件页首次处理 19 ms、后续出现 83 ms 帧间隔。不能据一次长帧断定渲染器根因。
- 15 页三轮重复测量，同步处理多数 0.5–2.7 ms；插件 5.3–14.9 ms，双 rAF 10.4–36.2 ms。不是物理触摸到显示器光子延迟。
- 原 load 三次 205/177.1/180.8 ms，约 4.8 MB；更新后 75.6/71.2/72.8 ms，约 4.0 MB。一个会话在测试期间更新，数据体积不同，不报告精确优化百分比。原始首次测量见工具日志；native-bridge-timing.json 是更新后的测量。
- 升级前后 7 个会话、2 个草稿、0 个项目 ID 都保留；6 个会话和两个草稿内容未变。1 个会话 updatedAt/kernelThread/lastSendTurnId 发生变化，未宣称全部内容逐字一致。before/after 原文备份保留。
- 冷启动 am start -W TotalTime 166 ms 仅代表 Activity，不代表内核/历史完全就绪；截图确认界面及已有对话已显示。
- 先前 gfxinfo 共 32278 帧，jank 0.29%，p95 7 ms；该计数包含此前运行，不能作为本轮独立性能样本。

## 功能覆盖

|范围|已跑内容|尚待补齐|
|---|---|---|
|对话/侧栏/项目|草稿、项目增删改、异步删除、返回、分页竞态、输入保存、模型弹层、5 MB 新建|真实长会话持续操作、所有菜单逐按钮|
|信息流|纯状态/DOM/投影/持久化等隔离检查|多个旧渲染选择器回归失败，真实工具详情与图片/子代理展示未完成|
|设置/模型/账号|15 Web 页路由与时间、12 原生页打开、账号缓存与内核状态一致|账号登录过期/重登、供应商真实多模型对话|
|插件/技能/MCP|统一界面、可见性、技能管理、MCP 表单等隔离检查|完整真实安装/卸载/OAuth/调用矩阵|
|浏览器|独立 fixture 前台填入点击，最小化后主界面侧栏可点击、后台 DOM 继续；测试标签已关闭|真实控制器全部工具、超时崩溃恢复、下载上传权限|
|手机控制|此前验收版本通过记录保留；本轮正式包额外跑了观察/预览检查|本轮独立 runner 受 Android 后台启动限制失败，不能算通过；尝试前台启动又等待超时，已撤回该测试改动|
|文件/办公/构建|入口打开、基础本地路径与交付扫描检查|多个样例缺失；复杂文档、APK 完整构建及安装未重跑|
|语音/网络/定时|入口打开，语音 UI、定时绑定/到期/界面隔离检查|真实音频、网络捕获、系统后台到期触发|
|停止/引导|隔离事件和失败保留回归|本轮真实任务停止/引导未完成|

## 回归结果

105 项首轮 68 通过、37 失败。修正 5 项测试的旧前提后通过，当前这批为 73 通过、32 待处理。另新增新建对话性能检查、浏览器恢复 worker 检查和原生 18 项存储检查通过。

5 项修正：键盘测试调用真实 evaAndroidBack 入口；删除等待异步完成；分页 fixture 补齐页面上下文；附件取消通过真实输入而非直接改内存草稿；定时 fixture 创建所需 tmp 目录。未删除失败断言来伪造通过。

待处理脚本（有的为旧选择器/缺样例/旧绝对路径，有的仍需确认产品原因）：

- test-activity-history-ui.cjs
- test-backup-history.cjs
- test-chat-scroll.cjs
- test-chat-send-delete.cjs
- test-codex-message-ui.cjs
- test-composer-bottom-layout.cjs
- test-connector-ux.cjs
- test-delivery-integration.cjs
- test-desktop-reader.cjs
- test-desktop-streaming-ui.cjs
- test-desktop-task-status.cjs
- test-document-preview.cjs
- test-extension-lists.cjs
- test-flow-feedback.cjs
- test-flow-history-window.cjs
- test-flow-parity.cjs
- test-generated-images.cjs
- test-local-attachment-contract.cjs
- test-mcp-oauth-lifecycle.cjs
- test-mobile-subagents.cjs
- test-original-activity.cjs
- test-orphan-delete.cjs
- test-plugin-manager.cjs
- test-ppt-preview.cjs
- test-pptx-native-charts.cjs
- test-reader-mobile.cjs
- test-scheduled-task-contract.cjs
- test-settings-refresh.cjs
- test-shell-ui.cjs
- test-sidebar-ui.cjs
- test-tall-pdf-reader.cjs
- test-task-recovery.cjs


## 后续优先级

P0：手机控制正式包真实启动链路及观察首帧；真实停止/引导；信息流历史详情缺失类失败。
P1：浏览器控制器全项、长会话滑动输入与连续切换性能；插件/技能/MCP 实际安装调用。
P2：补齐文件预览样例和可移植测试，语音/网络/定时系统层验收，逐按钮闭环。

## 清理

无桌面源码或桌面用户数据改动。独立无桌面入口的 audit runner 已卸载，浏览器测试标签已关闭。临时 ADB 转发和设备 XML 在收尾删除；项目中保留会话基线、原始失败日志、截图、复建证据与交付，未知历史文件不删除。签名文件的 ACL 子项继承已修复并实际读回验证，未修改签名内容。

## 0.1.5 加载圆环真机核验

正式93/0.1.5覆盖安装成功。真机加载元素可见文字为空，CSS动画名 chat-loading-spin；圆环中心 (196.92,393.08)，视口394×786。截图 chat-loading-device.png，测试临时加载状态已恢复，不改变会话。前端历史竞态回归通过。
