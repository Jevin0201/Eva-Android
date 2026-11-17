# 技能自主创建修复

## 范围

Eva 0.1.3，versionCode 91。新增模型工具 `eva_skills`，复用 `SkillStore` 的全局及项目技能保存、路径校验和同名保护。支持 list、read、validate、save、refresh。创建指引随普通会话启动与恢复注入。

save 返回保存路径、读回正文、saved 和 discoverable。发现失败时返回 refreshError 或 discovery，保留已保存内容。覆盖须显式传入 overwrite，工具说明要求先读取并由用户请求修改已有技能。附属 scripts/references 由已有文件工具处理，再刷新技能目录。

新会话工具表、现有会话与模型切换使用的历史投影工具表均加入此工具。旧会话沿用现有的保留原记录、生成兼容副本的工具升级机制。技能刷新同步通知已启动的两类模型内核，另一内核刷新失败会返回诊断。

`SkillStore.call` 串行处理界面及工具的读写，避免并发创建时两个请求同时通过同名检查。保存沿用临时文件替换。新技能进入模型上下文可能需要下一回合或重新打开聊天，自动选用由技能描述与任务匹配决定。

Windows 构建脚本原先的固定源文件清单遗漏了当前仓库中的多个既有类，导致全量构建失败。改为从原有 src、third_party 两个目录枚举 Java 文件，现有构建参数保留。

## 验证

- `python tools/test-skill-authoring.py` 通过 13 项文件系统宿主模拟检查，运行真实 SkillTools 与 SkillStore。覆盖全局和项目保存、读回、覆盖保护、无效路径和正文拒绝、校验、刷新失败保留文件。
- `node tools/test-skill-manager.cjs` 通过已有技能管理界面回归，包括创建、修改、删除、切换范围和保存失败保留草稿。
- `NativeToolsUpgradeTest` 通过 20 项已有工具升级检查。
- `SkillStoreValidationTest` 通过已有 UTF-8、大小、头部、名称、项目和 ZIP 路径校验检查。
- Java 17 全量源码编译及开发 APK 构建通过。正式 APK 单独构建，结果和交付文件保存在 `artifacts/skill-authoring-20261117/`。

## 待验收

本轮 adb 未发现设备。手机覆盖安装、真实模型创建技能、下一回合发现与调用尚未验收。模拟宿主检查不能代替这些结果。

## Codex 创作能力名称

本机 `skill-creator`（Skill Creator）负责创建与更新技能。`plugin-creator` 插件中的 `create-plugin` 负责创建插件。此次修复在 Eva 内新增原生调用链和创作指导，未迁入上述 Codex 技能或插件包。

## 清理检查

本次生成内容集中在已有 probe/build 和 artifacts/skill-authoring-20261117。保留安装包、编译日志、回归检查及模拟数据供复测。未删除用途未确认的历史临时目录。已检查，无需清理。
