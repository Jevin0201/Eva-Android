# 会话历史备份与恢复

本轮范围是会话历史、草稿和项目元数据。**不包含工作区文件、附件文件、记忆、技能、插件、MCP 配置、登录凭据、API 密钥或 rootfs。** 不能作为完整设备迁移或内核会话迁移工具。

通过 Android 系统 SAF 选择导出位置或备份文件，无全盘存储权限。ZIP 只允许 manifest.json 与 conversations.json 两个条目。导入先预览数量和范围，再明确确认；合并前把当前会话数据另存到私有 history-backups 目录，并提供系统导出快照入口。

恢复采用合并：现有对话、项目、当前选择不覆盖；导入对话及项目生成新本地 UUID。导入记录标记 importedReadOnly=true，保留原 kernelThread 仅供显示，清除运行状态，不恢复原内核执行。旧设备的 thread ID 不向本机发送 read/archive/resume 请求。删除导入历史仅删除本地导入记录。跨设备继续原任务不在本轮范围。

原生保存前同时检查 SharedPreferences 原始内容和 ShellActivity.saveRevision。若确认期间已有新数据，拒绝恢复并要求重新预览。检测到聊天、语音、手机控制或本地终端任务运行时拒绝操作。恢复完成重建主 Activity，避免旧 WebView 状态覆盖新数据。

ZIP 限制：压缩输入 12 MB，解压总量 8 MB，manifest 16 KB，JSON 嵌套 64 层。拒绝路径穿越、绝对路径、未知条目、重复条目、无效 UTF-8 和缺失内容；不会按归档文件名写入任何目录。最终合并仍遵守手机 UI 当前 2,000,000 字符存储上限。

接线：

- build 加 DataBackupArchive.java、DataBackupStore.java、DataBackupActivity.java。
- manifest 加 `.DataBackupActivity`，exported=false。
- EvaHost.open("data-backup") 启动该 Activity。
- 最后加载 backup-history.js，并加入 ShellActivity 资源名单。脚本自行增加设置入口和只读保护。

验证：Java 编译通过；DataBackupArchiveTest 18 项通过，含 ZIP 路径穿越、解压炸弹、重复条目、UTF-8、截断和 JSON 深度。test-backup-history.cjs 通过只读渲染、不调用旧内核 ID、发送与模型操作保护、本地删除与设置入口。SAF 和真实恢复合并需主线程在测试数据上真机验收，不应直接拿用户现有记录试验覆盖。
