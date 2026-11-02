# 独立工具页面与默认桌面浏览（0.0.7）

2026-11-02。终端、文件、浏览器已拆成三个独立 Activity，侧栏顶部各自有入口。ToolPageActivity 只共享外观组件。旧 LocalToolsActivity 仅为旧链接提供重定向，不再显示工具标签。

- TerminalActivity：命令、输出、停止、历史，独立保存命令草稿并兼容旧配置。
- FilesActivity：目录和预览，保存上次目录；系统返回先退出预览，再返回上级目录。
- BrowserActivity：地址、导航、进度、错误与模式切换；保存上次 HTTPS 地址；Activity 重建可恢复 WebView 历史 Bundle。完整跨进程会话恢复尚未实现。

## 桌面模式

browserDesktop 默认 true。浏览器右上角和设置页使用同一配置。

桌面 User-Agent 保留 WebView 自身 Chromium 版本，替换移动平台标识并去除 Mobile、Version/4.0。开启宽视口、概览和双指缩放，页面加载后设置 1280 CSS 像素视口。手机版恢复系统 User-Agent 与网站自己的视口。开启 DOM Storage；远程网页仍无原生执行桥，文件/content 访问保持关闭。

此模式用于桌面页面兼容，不保证网站无法识别 Android/WebView。设备、触摸和浏览器特性仍可能被网站使用。动态重写视口及依赖特定桌面浏览器功能的网站需要单独适配。

官方依据：[Android WebSettings](https://developer.android.com/reference/android/webkit/WebSettings)，涉及 setUserAgentString、setUseWideViewPort、setLoadWithOverviewMode 和缩放设置。

## 验证边界

- 0.0.7 编译、签名、覆盖安装成功。
- 会话、任务、设置回归与新增浏览模式设置测试通过。
- 真机 PageCheck 通过：三个独立页面、侧栏三个入口、终端草稿、文件导航与路径边界、设置落盘。
- 受控响应式 HTML 实测：默认桌面 UA 不含 Android/Mobile，innerWidth >= 1200；手机版 innerWidth < 900；模式配置保存；网页 typeof EvaHost 为 undefined。
- 结果位于 artifacts/pages-0.0.7/device-check.txt。布局验证不能代替所有生产网站验收。上传下载、多标签和网页代理控制仍未完成。
