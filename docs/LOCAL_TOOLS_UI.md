# 安卓本机工具 UI（开发中）

实现：LocalToolsActivity.java，入口为 Eva 首页“工具”。原生界面暂时沿用会话骨架；新移动端的细致视觉适配仍未完成。

- 本地终端：显式输入 shell 命令，调用手机内 PRoot/Python TaskRunner，120 秒超时，停止按钮写取消标记，由执行器终止进程组。结果保存在 /root/eva-tasks；界面当前在执行结束后显示输出，不是实时输出流。
- 工作区：列出 eva-workspace 顶层文件，支持 64 KB 内文本预览；目录深入、编辑、导入导出尚未接入。
- 浏览器：独立 WebView，支持输入 HTTPS 地址与网页导航，禁用文件/内容访问，无 JS 原生桥；尚无多标签、模型控制、下载或上传工具。
- 手机控制：明确标记无障碍服务尚未接入。

构建与安装成功，首页 UI 层级可读取。ADB 模拟点击未触发工具菜单，原因未确认；已请求用户手动点击终端运行，以验证真实 UI 路径。不能把模块已有的底层测试当作本轮界面联调通过。

不依赖远程电脑服务，但 rootfs 首次初始化目前仍由开发电脑导入。云模型仍未配置。

用户手动点击工具→本地终端→运行成功，日志核对 taskId=18d4ba22-5050-448e-ad14-d75cbad065e4，state=succeeded，exitCode=0，Python/Node/Git 输出正确。证据 artifacts/local-terminal-ui-result.txt。退出页取消修正已重新构建安装，但该退出分支尚未单独实测。

## 2026-11-02 流式输出与任务历史

TaskRunner 增加事件回调，命令包装器逐条输出 JSON 事件并 flush。安卓终端解码事件显示进行中输出与任务状态；重新进入时加载 last-command.txt，历史列表读取任务 state.json 与 events.jsonl。历史只查看，不自动重放。

安装及构建通过。tools/test-device-stream.py 在手机 ADB run-as 上下文中完成执行器回归；第一段输出约 0.234 秒返回，命令在两秒后结束，证明包装器输出及时。证据 artifacts/task-stream-check.json。这不是 UI 点击验收，历史列表/恢复交互和真正后台生命周期仍待验收。手机控制权限服务本轮尚未实现。
