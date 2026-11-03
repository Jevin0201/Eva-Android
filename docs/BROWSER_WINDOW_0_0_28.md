# 浏览器窗口交互修复（0.0.28）

## 问题与修改

原浏览器使用系统 Dialog Activity 主题，最小化虽然把触摸区域缩为 52dp，仍保留模态对话框的背景暗化与窗口属性。真机上点击后方 Eva 侧栏无效；因此只检查窗口宽高不足以验收。

- 新增 `BrowserWindowTheme`：透明、floating、不暗化背景、不因外部触摸关闭。
- 展开、最小化、恢复时都清除 `FLAG_DIM_BEHIND`，保留 `FLAG_NOT_TOUCH_MODAL`。
- 最小化仍使用 `FLAG_NOT_FOCUSABLE`，窗口仅占悬浮球区域。展开恢复输入焦点能力。
- 浏览器仍是 Eva 自带 WebView，未增加系统悬浮窗权限、无障碍依赖或 Chrome 依赖。

## 真机验收

主代理在连接的 Android 17 手机上构建安装后运行：

```text
adb shell am instrument -w ai.eva.android.probe/.BrowserWindowCheck
PASS native touch reaches conversation behind expanded/minimized browser;
composer focus works; browser viewport/page state retained
```

`BrowserWindowCheck` 用 `Instrumentation.sendPointerSync` 注入实际屏幕触摸，使用 WebView 在屏幕中的坐标换算，未用 DOM `click()` 代替触摸。

已验证展开窗口外的侧栏按钮、最小化后侧栏按钮、最小化后输入框获得焦点，以及恢复时网页输入内容与视口宽度保留。测试只使用本地浏览器测试页，不发送模型消息、不修改用户草稿。未将“输入框获得焦点”等同于完整软键盘输入、旋转、多窗口模式或长时后台验收。

## 后续用户复现与结构修复

上述第一轮通过不代表任务栈路径通过。用户再次复现最小化后回主页面不能点击；原测试仅在固定 BrowserActivity 前台状态中验证点击，遗漏了宿主暂停、原生页面往返与主页面重入。

后续改为由 ShellActivity 持有 BrowserWindow（Dialog），原 BrowserActivity 只负责兼容旧入口并立即结束。浏览器不再以单独 Activity 持有 top-resumed 位置；最小化窗口保持 52dp、不可聚焦、外部触摸穿透。Shell 生命周期驱动 WebView 暂停/恢复，关闭宿主时释放窗口，网页保存仍使用 WebView.saveState。BrowserTools.show 会把宿主带回前台。

BrowserWindowCheck 新增 TerminalActivity 往返与 CLEAR_TOP/SINGLE_TOP 主页面重入后真实触摸检查。KeyboardCheck 新增真实 IME 显示后的收起按钮、系统返回与草稿保留检查。以上新结构与新增原生检查等待主代理统一构建及真机执行，不能沿用前一轮 PASS 作为证据。

键盘前端专项 tools/test-keyboard-ui.cjs 和已有 tools/test-shell-ui.cjs 已通过：收起按钮、原生桥接、草稿保留、缩小视口、真实 IME 可见时优先收起、无 IME 时保留原返回行为。

Latest device verification: parent ran the new BrowserWindowCheck and reported PASS for expanded/minimized native touch, native Activity roundtrip, launcher return, composer focus and page/viewport retention. KeyboardCheck first run hit targeted input injection ownership rejection; stage diagnostics and UiAutomation system Back injection were added for the next run.
