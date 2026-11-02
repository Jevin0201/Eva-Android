# Eva 同源内核与信息流迁移

用户于 2026-11-02 明确：安卓端使用 Eva 的 Codex 内核和现有信息流，不另建直接 Responses 聊天内核。

## 已核对的源码

桌面基准为 `D:/network shared/Eva-0.1.17-Source-20261029-094504/Eva-Source`，只读。
`.local/kernel-pin.json` 固定 Codex CLI 0.166.0 Windows x64。手机需对应 Linux ARM64 发行物，不能直接执行 Windows EXE。

`migration/eva/source.json` 保存本轮迁移基准、文件清单和 SHA-256。`app-server.js` 的 JSON-RPC 请求/通知/服务端请求协议、`providers.js` 的原生提供商配置、`stream-state.js` 的增量与快照合并，以及 renderer/mobile-live 的信息流渲染是迁移来源。复制到 migration 目录不等于已装入手机 UI。

迁移分层：

1. 手机应用私有 Linux 运行环境运行同版本 `codex app-server`，独立 CODEX_HOME，不借用桌面进程、账号或用户数据。
2. Android 宿主替换 Electron IPC/进程启动/凭据接口，保留 initialize、thread/start/resume、turn/start/interrupt 及 item/turn 通知语义。
3. 信息流继续消费内核结构化事件，复用 Eva 的增量合并、工具卡片、过程折叠、Markdown 和历史恢复逻辑。
4. 手机控制与内置浏览器经工具桥注册给内核。不能把内核启动成功等同于这些工具可用。

## 独立 Responses 实验的处置

0.0.10 中的 ModelClient/models.js 是此次澄清之前写的直接文本调用实验，不作为正式会话路径继续扩展。ModelStore 的 Keystore 和提供商表单可复用于原生凭据宿主，GET models/POST Responses 只保留为提供商连通性检测。正式发送必须走 Codex turn/start。

## 来源与许可证

官方 npm `@openai/codex@0.166.0-linux-arm64`，记录见 `research/codex-0.166.0/npm.json`。包元数据为 Apache-2.0，无 dependencies/optionalDependencies；上游对应标签 LICENSE 已保存。同标签 `.gitmodules` 返回 404；本轮使用预构建包，不递归拉取子模块。完整发布仍需核对包内 NOTICE 与资源许可证。

本地 Eva 源码按用户授权用于本项目迁移；其中 native-* 提取模块不能因为位于 Eva 源码中就擅自标记为 Apache-2.0。来源记录保留，后续发布需单独核对。当前 APK 直接复用 stream-state.js 和 mobile-live/flow-view.js，未打包上述提取模块。

Markdown 使用本地 Eva 依赖 markdown-it 14.3.3 的浏览器构建；递归依赖许可证已核对并随 APK assets/markdown-licenses 保存（MIT、BSD-2-Clause、Python-2.0），没有递归拉取 git 子模块。未启用 HTML 输入。

## 0.0.11 手机安装结果

- 官方 ARM64 包通过 npm 元数据 SHA-512 完整性校验。导入手机的 core/codemode-host/rg/bwrap 清单与 SHA-256 见 research/codex-0.166.0/device-files.json。未启用语音资源。
- 真机实测版本 codex-cli 0.166.0，Alpine Linux 3.22.7/aarch64；initialize、account/read、临时 thread/start 均成功。
- Android 原生 KernelHost 同样完成上述请求；非电脑代理进程。证据 artifacts/codex-0.166.0/native-kernel-check.txt。
- 正式发送入口改为 thread/start 或 thread/resume → turn/start；停止走 turn/interrupt；提供商定义及密钥环境变量由原生宿主传给内核。旧 modelStart 直连桥已禁用。
- 信息流直接使用 Eva stream-state 与移动端 flow-view 组件，适配 thread/turn/item 事件、Markdown、命令输出、处理过程折叠与确认请求。协议模拟测试见 tools/test-model-ui.cjs；它不能代替云端实测。
- Keystore 提供商管理保留。提供商在内核启动后发生变更需要重启 Eva。账号登录界面尚未迁移。

尚未交付：真实云端对话验收（待手机配置凭据）、手机与浏览器代理工具桥、完整桌面信息流特性（图片/文件操作/精确滚动恢复等）、后台服务与断线恢复验收。当前执行策略为 read-only，尚未验证 PRoot 中的 Codex 沙箱及工具执行；不能把线程创建成功写成完整代理已可用。内核现由开发流程导入，尚非手机自助安装。

## 验证边界

`tools/test-eva-stream.cjs` 验证直接复制的增量合并模块。`tools/check-codex-device.py` 在独立测试 CODEX_HOME 验证版本、initialize、account/read、thread/start；不读取用户密钥、不产生云端模型任务。真机结果保存到 artifacts/codex-0.166.0。云端对话、工具调用、取消、恢复与 Android 信息流仍需逐项通过后才能交付。
