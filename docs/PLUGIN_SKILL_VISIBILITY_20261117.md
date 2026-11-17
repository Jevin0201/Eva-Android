# 插件内部技能的展示归属

## 用户要求与实现

插件附带技能继续由内核加载、供插件内部调用；手机的独立技能目录和对话 `@` / `$` 候选不再重复展示它们。按插件归属识别，不按中文或英文名称识别。用户自己安装的独立英文技能仍可显示。

`probe/assets/composer-references.js` 提供 `evaReferences.isPluginSkill`。优先采用 `pluginId` 或插件 scope，旧目录缺少元数据时采用发布版 Codex 的路径归属顺序，先识别 `.agents/skills`、`.codex/skills` 及 Android 的 `.eva-codex/skills`，再识别 `plugins/cache/<marketplace>/<plugin>/<version>/skills/...` 和本地 `plugins/<plugin>/skills/...`。独立目录优先于路径中更早出现的 `plugins` 字段，避免误伤用户项目。

候选过滤只作用于展示。没有删除技能、写入停用状态或裁剪内核目录。发送前校验既有历史引用仍读取完整目录；历史已选内部技能不会仅因隐藏而失效。停用、卸载和读取失败的既有发送保护继续有效。

## 正式 Codex 静态证据

目标为用户指定机器上的正式 Codex 26.1103.7773.0，`app.asar` SHA-256 为 `ee88fdd77fb7346efb5e91ce73c7c0eee4eba390ffba3192635d5cdbe44e4097`。

REA 使用 `analyze_javascript_application` 分析五个精确选定的发布包模块，没有执行发布包代码。主记录为 `ev_393e215bf70ee2491b0060f87232c149f952595bec8d2da1ca0c191b8bedb8d4`，摘要记录为 `ev_e6fa2d88a957a947987aa14ee784de30514c225d9979aa8d83492a79ccd7459f`。完整摘要、所选原始片段和哈希索引保留于 `artifacts/plugin-skill-visibility-20261117/`。

- `webview/assets/async/192666.161cacd23a.js` 中 `f22a` 模块导出的 `cy`（函数 M，字符位置 67224）和 `704837.a97a7a5782.js` 的同模块函数 A，明确把路径经 `pNUK.F` 解析后 `pluginId != null` 的技能排除，再送入目录整理函数。这是独立技能目录隐藏插件内置技能的直接依据。
- `pNUK` 原始解析器来自 `182735.7f13786b92.js`，字符位置 5234852，采用 ASAR 索引按偏移直接读取，完整所属文件哈希在 source-hits.json，目标模块原文在 pNUK-module.txt。该模块没有在本轮五文件 REA AST 分析范围内。其解析先认 `.codex/skills` / `.agents/skills`，再认插件缓存或本地插件路径；`.system` 和 `_import` 仍属于独立技能路径。没有基于名称语言的过滤条件。
- 同目录帮助模块中，用户安装技能的推荐去重分支先选 `scope === 'user'`，再排除插件归属并处理推荐技能重复项。因此不能把“所有英文技能都隐藏”当成发布版规则。
- `96880.2739c3d60c.js` 中旧 `L6Ky` 技能 mention 分支仍包含插件技能来源标签。其候选条件是启用并通过 `QfTn.b` 的当前内置插件市场/profile 过滤；`39017.8e35999c14.js` 的 slash 分支另排除当前 excludedPluginId。它们没有“所有 pluginId 一律不可见”的条件。不能据静态源码宣称正式 Codex 所有 `@`、`$`、slash 或账号分支都使用同一规则。Android 对 `@` / `$` 内部技能的统一隐藏是用户此次明确要求。

## 验证

浏览器模拟 Android 宿主验证通过：

- `node tools/test-plugin-skill-visibility.cjs`：中英文插件内部技能均隐藏，缺 pluginId 的缓存/本地/Windows 插件路径隐藏，独立英文技能和用户技能保留；插件显示；插件目录读取失败时不泄露内部技能；历史内部引用仍生成原 skill 输入；启用状态未改。
- `node tools/test-composer-references.cjs`：选择、发送协议、成功后清理、失败保留、停用保护和草稿隔离通过。修正旧 fixture 缺少 `scope:user`，与当前目录分组一致。
- `node tools/test-capability-loading.cjs`：慢插件不阻塞技能、缓存/并发去重、后到结果合并、技能专用读取通过。原测试已删除的 `.reference-open` 按钮改为现有 `@` 输入入口。
- `node tools/test-composer-reference-icons.cjs`：图标、主题、失败回退与选择通过。

本记录不代替实际模型经插件执行内部技能的端到端验收；没有改变对应内核调用路径。安装与真机 UI 由本轮整页 UI 主任务统一验收。

## 证据边界与清理

REA 图覆盖部分，五个模块以外依赖未作完整 AST 分析，语义未知节点达到保留上限；所选 JavaScript 静态事实不等于实时账号与功能开关状态。REA 还记录与本次 JavaScript 无关的若干 native 文件完整性元数据差异，未把这些文件用于可见性结论。

扫描临时输出仅在本项目 artifacts 下。按 source-hits.json 的精确文件名、绝对目录与 SHA-256 核验后，删除本轮 150 份无须保留的扫描源副本，保留五个所选模块、解析器片段、摘要、索引与扫描脚本。未删除依赖、安装包、用户数据或其他任务产物。
