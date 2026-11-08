# 布噜与 Eva 模型模块对照审查

> 历史审查，保留 2026-11-07 的证据和当时状态。后续实现见 [0.0.73](RELEASE_0_0_73.md)、[0.0.74](RELEASE_0_0_74.md)，当前验收及待完成项见 [任务总账](ACTIVE_TASKS_20261108.md)。

2026-11-07。用户反馈免费模型添加后仍有问题，要求检查本机布噜的添加模型、设置模型显示和前台默认模型逻辑。本轮完成只读调查，尚未将下面的重构合同实施到 Eva，也没有构建或安装新版本。

## 调查来源与边界

本机目标 /Applications/bulu.app，显示名称“布噜”，版本 0.1.2，bundle ID ai.bulu.desktop。app.asar SHA-256 为 3281eab27cf02a7241183200a3b14deadba713134df2020a1b9e1d883bbf6a2e。原安装和用户配置保留，未读取密钥、未修改布噜默认模型。运行界面显示“账号服务暂不可用”，菜单 Settings 也没有进入设置页面，所以模型设置部分为已读发布代码证据，尚无界面运行验收。

REA parent Evidence ev_cdc012c4708ac998260bd8f12a2ecccc055ca9c7d65fa68ef28c94ec9a5abd02，精确选择 package.json、自定义提供商对话框、模型选择对话框、settings 模块。原生解包依赖的声明哈希与观察字节不一致，按 record-and-continue 记录；REA 静态分析没有执行这些原生模块。该静态调查仅覆盖选择的 JavaScript，其他模块保留未知，不代表应用全域验证。完整REA导出和补充代码索引位于 artifacts/bulu-model-review-20261107。

## 布噜实际实现

1. 提供商连接对象保存协议适配器、名称、URL、headers 与多模型目录，认证经独立接口保存。自定义连接支持 OpenAI-compatible 和 Anthropic-compatible。不能从配置代码推断认证落盘是否加密。
2. 自定义模型可以手动维护 ID 和名称。运行时目录查询 GET /provider 返回 all、connected 和 provider default。没有从本次选取 UI 代码找到远端 /models 自动发现或真实推理测试，保存成功提示不应视为调用验收。
3. 模型显示偏好以 providerID+modelID 保存 show/hide，影响前台列表，不删除提供商目录。显示名称与真实请求 ID 独立。列表按提供商分组、按模型名排序，最近模型单独保存并去重，最多5项。
4. 设置中的主要模型写 config.model，轻量任务模型另写 config.small_model。两者不等于显示开关，也不等于当前会话模型。
5. 当前模型优先使用会话选择，其次 Agent 指定，再取全局默认、最近选择或提供商默认。前台切换写当前会话/草稿，不写全局默认。旧会话已有显式选择时，修改全局默认不会覆盖它。
6. 发送时固定 providerID/modelID 到任务快照，排队和真正 turn/start 使用这份快照。

精确代码索引见 artifacts/bulu-model-review-20261107/model-selection-evidence.md。上述为发布代码行为，不将设置保存或目录可见当成真实请求验收。

## Eva 当前已确认问题

| 问题 | 直接代码依据 | 影响 |
|---|---|---|
| 打开菜单会提交状态 | eva-model-control-adapter.js open 将缺失档位补为 high，core 菜单 renderComposer 映射 commit | 只查看菜单也可能改变会话档位和全局选择 |
| 读配置改写已有会话 | adapter readProviders 根据 providerDefaultModel/旧默认遍历修改 chat.model | 无法区分跟随默认与用户主动选过同名模型 |
| 默认与当前会话混杂 | adapter commit 有当前会话时更新会话和全局 providerSelections，无会话时才写原生默认 | 同样点模型在不同页面有不同持久影响 |
| 账号优先标记可能未清 | active provider 未变时不调用 providerChoice，即使 account.preferred 为 true | 用户选 API 后可能重新回到账号模型 |
| 删除提供商使切换入口失效 | selectedProvider 返回空，adapter.open 直接返回 | 旧聊天保留，但无法在该入口改选其他提供商 |
| 保存失败未检查 | commit 忽略 providerChoice/accountChoice 的布尔结果 | 前台显示已选但原生未保存 |
| 多模型标题可能显示默认模型 | adapter providers.displayName 默认来自 p.model，core 优先使用该字段 | 菜单标题与当前真实模型不一致 |
| 能力和协议没有独立模型 | catalog 仅保存 id/name；未知 API 模型得到通用推理档位；所有 API wire_api 固定 responses | 展示出未验证的能力，不能代表任意 OpenAI-compatible 接口均可使用 |
| 账号目录缓存缺失失效与分页 | model-panels 只在 modelCatalog 为空时请求，固定100项 | 账号切换后可能继续使用旧目录 |
| 无关配置也可能要求重启 | runtimeStamp 覆盖所有提供商 id/name/url/secret | 添加其他提供商或改名也可能阻断现有内核 |

## 重构合同

需要以清晰的状态关系重构，避免继续增加具体模型名称的特判。

- 提供商连接保存 ID、名称、地址、认证、协议与连接状态。
- 模型目录保存 providerID+modelID、显示名和已声明能力。手动添加与目录发现并存，显示开关独立。
- 全局默认单独保存提供商和模型组合，仅决定新会话的初始选择。
- 会话模型单独保存，前台切换只更新当前会话/草稿，设置默认不改写既有会话。
- 可见性、最近使用、推理档位偏好独立于默认值。未知能力不显示成已支持。
- 发送前解析并固定真实提供商/模型快照，失效项提供明确改选入口，不能静默换模型。
- 连接配置保存、目录获取、实际文本调用、多次工具往返分别记录结果，完成后三项不能只凭“保存成功”推断。
- 迁移保留现有提供商、Keystore 凭据、聊天绑定和用户明确选择。全局默认和会话行为要有迁移前后对照测试。

本轮没有将布噜实现代码引入 Eva 运行代码，也没有更改其模型配置。信息结构和行为设计可作为 Eva 的重构依据，直接复用第三方代码须另行核实许可证。


## 清理

已核实并清理本次提取后未用于结论的 871 个临时文本文件，保留10个关键发布文件、完整REA证据、哈希清单与审查笔记。清理范围仅本项目 artifacts/bulu-model-review-20261107/extracted，未修改布噜安装或数据。逐项记录见 cleanup.json。既有 tmp/launch-confirmation-fixture 用途属于其他工作，保留。
