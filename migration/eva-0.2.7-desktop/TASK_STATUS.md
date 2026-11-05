# 会话任务状态与运行区域

电脑端来源为 renderer/render.js 的 renderThreadTree / renderThreadActivity、thread-activity.js、styles.css 的 ti-status/ti-spinner/ti-unread，以及 actions.js 的事件观察和已读调用。src/main/main.js 记录 activeTurns，按真实 turn/started、turn/completed 与 thread/status/changed 通知更新主进程运行状态，isolated-server.js 同步失效列表缓存。

电脑端 renderThreadTree 按置顶、自定义 section、项目和最近等结构分组。本次已读源码未找到独立“正在执行的任务”区。Android 的运行聚合区落实用户明确要求，保留原项目/最近定位，并通过同一个 chat:id 导航到已有会话。

## 原状态核心与显示

- QEn 优先级依次为 owned work、runtime systemError、runtime active、needs_resume、latest systemError、response progress、idle。
- Android 复用原完整 thread-activity 核心。已知恢复待核对状态在宿主层显示待核对，避免把未知状态当成已确认执行。
- 原运行标记为 14px 半圆 SVG，1.25s 旋转，重建时负 animation delay 对齐墙钟周期。局部 paint 保留已有 SVG，避免每 token 重启旋转。
- 原完成未读标记为 7px 圆点，颜色 #3981f7。后台完成且非 interrupted 才写未读。重复完成事件去重。
- Android 仿照电脑端 document.visibilityState/document.hasFocus 前台判断，补充设置、弹窗和提问遮挡判断。只在实际查看目标会话时清标记，切换到其他 App 时保留。
- 运行区域覆盖折叠项目、普通会话及正在启动的 draft。启动草稿展示“正在启动”，恢复中的任务展示“待核对任务状态”。不产生额外对话或模型回合。
- 内核退出时宿主更新 notLoaded runtime 状态，防止保留已失效 active 标记。

## 验证

完整页面 fixture 覆盖折叠项目任务进入运行区、原 SVG 连续动画、后台完成蓝点、后台选中仍不清、前台查看清点、draft 启动提示和同一聊天导航。生产手机正在执行用户任务，本子任务没有操作手机。

新增生产 CSS 应在 chat-scroll.css 后加载，且进入原生资源白名单。本子任务没有临时下载或诊断脚本。新增源码、测试和来源记录继续用于构建与验收，已检查，无需清理。
