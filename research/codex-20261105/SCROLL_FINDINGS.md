# 对话底部与返回最新内容（2026-11-05）

只读逆向 `/Applications/ChatGPT.app/Contents/Resources/app.asar`，SHA-256 `0c951258b7ab381ec601045ffb02159e53f424548dda18e6a4dcfd126557383b`。

REA 父证据 `ev_93d7d26ba6ebe4885cd90dfe3728bfb4fafdc4c5fd64fd69de434083b076032e`，分析包内 `webview/assets/async/638975.dfeada196a.js`。候选与原文摘要见 scroll-candidates.json。该包包含：

- transcript N 默认 scrollOrigin 为 bottom、initialOffset 为 0；以 distance from bottom 维护位置，<=24px 视为底部。
- 返回按钮读取 isScrolledFromBottom；存在 response spacer 时检查距底部是否超过 spacer 高度+24，点击调用 spacer.scrollToBottom 或容器 scrollToBottom。
- 可访问标签为 localConversation.scrollToBottomButton；底部圆形按钮，hidden 状态取消指针事件，显示时可带运行指示。

静态解析不代表观察到正式客户端运行。REA 图覆盖 partial，部分 native 依赖完整性矛盾保留在原证据；未执行这些模块。安卓未复制正式包代码，采用本地实现；40px 触控按钮、简单流容器24px阈值属于移动适配，未声称完整复刻 response spacer。

## 安卓修正

此前 workflows.js 恢复会话上次的绝对 scrollTop；models.js 仅靠更新前布局的距底部判断跟随。现在切换/重入对话默认到底部，同一对话整页刷新仍保留上翻位置。chat-scroll.js 按流容器保存跟随状态，在底部跟随流式更新，上翻暂停；点击箭头恢复；ResizeObserver 和 MutationObserver 处理后加载媒体、容器/内容高度及直接子节点变化。箭头位于信息流下缘，不参与消息排版。现有历史锚点补偿保持。

## 验证

Chrome headless、390×844：test-chat-scroll-bottom.cjs 通过进入/重入/切换定位、上翻时追加输出不跳动、整页刷新保持、箭头显示/点击/隐藏、恢复流式跟随、后加载内容高度变化。test-chat-scroll.cjs 原有15次增量/焦点/视口测试通过。test-flow-history-window.cjs 的200回合分页与草稿保持通过。

未构建、安装 APK，未完成真机 WebView、软键盘与触摸惯性验收。截图 artifacts/diagnosis-20261105/chat-scroll-bottom.png。
