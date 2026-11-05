# 0.0.53 信息流宿主修复

本轮接续 0.0.49 中断任务，电脑端基准只使用 Eva-Source/src/renderer 与 src/main。

## 已定位并修复

- 电脑整页样式的 overflow:hidden 被带入手机滚动容器，导致脚本可滚而手指不可滚。手机宿主恢复 overflow-y:auto；原消息布局保留。
- 电脑组件通过 module 异步启动，models.js 先画旧图片和交付卡片。正常模式等待电脑渲染器，不再显示旧信息流；legacy 仅为显式测试模式。
- 正文 Markdown 图片使用的 workspaceFiles 服务缺少 readBinary。绑定现有受路径、类型和大小限制的 Android 图片服务；没有更换 Markdown 组件。
- 原图片弹层的默认 Portal 落到 body，脱离原 CSS 作用域，成为屏幕下方的普通元素。给原 Dialog 绑定正确 Portal；共用放大预览保留原组件。
- 用户气泡缺少 native-scoped 基础主题变量，背景透明。原主题加入用户消息、助手和活动的 ShadowRoot，不另写气泡组件。
- 工作区的生成图片为 .img 扩展名，原生预览现在按原图片路径解码。文件夹入口转到 FilesActivity。
- 子智能体活动改用电脑 subagents.js 的头像、动作、分组和面板标记及 subagents.css；52 个浅深头像原样复制。执行过程使用原消息渲染与增量补丁，绑定现有会员关系校验、thread/read 和分页 items/list。窄屏用覆盖面板，宽屏保留侧栏宽度。

来源哈希及 Android 绑定见 migration/eva-0.2.7-desktop/stream/ANDROID_HOST_FIXES.json。

输入框由独立子智能体按用户红框调整：去掉网页重复叠加的 20px 底部安全区（Android 宿主已处理系统栏），框内按钮再下移 6px，初始文字区 44→54px，保持 40px 触控区和底部状态/压缩入口。真实 20px CSS 安全区模拟、竖横屏、键盘与 24px 大字体测试通过。

## 验证记录

- 桌面已安装 Eva：新建独立界面测试，两个子智能体完成；观察提示词气泡、展开过程、原头像及右侧执行面板。测试对话保留用于对照，没有改动桌面源码、凭据或其他会话。
- 0.0.50 真机 ADB 双向滑动：滚动位置 1220→968→1220，28 个会话保留。
- 0.0.52 真机：当前对话五张 Markdown 图片均加载，逐张打开/关闭且预览实际位于屏幕内；气泡有背景和 22px 圆角。原头像加载，真实子智能体执行面板可打开。证据 artifacts/diagnosis-20261105/v52-image-check.json、v52-agent-panel.json。
- 浏览器完整页面：五图、放大预览屏幕内可见、原气泡、原头像和子智能体历史面板通过；文本、工具、失败、中断与桌面 renderTurn 同源模型对照通过；原交互提问通过。
- 540 次增量压力：无空白帧、无消息/ShadowRoot/主容器重建、无文本回退，阅读旧内容不漂移；展开工具能读到最后一条输出。结果 artifacts/desktop-streaming/desktop.json。
- 定时任务本轮补验原规则、到期去重、时区变化和模型绑定测试通过。完整产品验收仍以实施清单为准。

0.0.53 已保留数据覆盖安装，仍有 28 个会话；真机输入区底部内边距 2px、文字区 54px，按钮在框内且状态说明位于系统导航栏上方。文件夹图片通过真实 touchscreen tap 打开原生预览。证据 v53-composer-native.json、v53-native-preview.json。

## 边界及清理

统一主渲染链路不等于所有桌面产品功能已经完成。完整信息流的后续验收包括长历史分页、后台与断线恢复、不同提供商和嵌套子智能体等实际任务；不得仅凭这批修复声称全域迁移完成。

本轮生成的截图、结构记录、回归报告集中在 artifacts/；APK、升级前备份和构建依赖继续用于验收及回退。检查项目 tmp/ 和 artifacts/ 内明显的 .tmp/.part 遗留，没有发现确认无用的项目文件；手机 UI 验证用 /data/local/tmp/eva-android-v53-ui.xml 在核实路径后删除。保留本轮证据、备份与构建依赖。
