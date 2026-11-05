# 桌面源码复用优先（2026-11-05）

按用户要求，REA用于确认正式Codex行为；落地前先检查Eva桌面源码，已有实现优先复用。Android代码仅在本项目维护，不修改桌面源码、正式安装或用户数据。

| 能力 | 桌面来源 | 本轮处理 |
|---|---|---|
| 压缩状态机 | `Eva-Source/src/renderer/context-compaction.js` | 复用核心，单独适配Android初始化、内核桥、布局与事件；不复制摘要算法到前端 |
| 文件链接扫描 | `Eva-Source/src/renderer/native-delivery/scanner.js` | 原样复制；Android保留工作区路径校验和原生打开/另存；代码示例和行内代码不转换成交付文件 |
| 分页与实时合并 | `Eva-Source/src/renderer/actions.js` 的 openThread | 适配请求epoch、旧历史与新事件合并，手机维持摘要5回合/详情10项以控制响应体 |
| 增量信息流 | `Eva-Source` 已迁移stream/transcript模块 | 继续使用现有迁移模块，避免重建完整DOM |
| 原子存储 | 桌面Node存储/Android SQLite不同宿主 | Android使用事务与64KiB块；不能直接使用桌面Node文件API |
| 发送收据 | `src/main/send-ledger.js`、`src/renderer/send-recovery.js` | 已审查；当前Android是pendingSend+本地日志恢复。桌面落盘收据与输入指纹的完整状态机尚未迁入，不宣称等价 |
| 文件行及完整预览 | `native-delivery/*.mjs`、`native-preview/adapter.jsx` | 已识别现成组件；当前Android仍是DOM适配与原生预览，尚未迁入全部React组件/Notebook/媒体流程 |

来源摘要、哈希与适配差异保存在 `migration/desktop-history`、`migration/eva-0.2.1-compaction`、`migration/eva-0.2.1-delivery`。用户授权复用私有Eva源码；未据此推断对第三方代码的公开再分发许可。
