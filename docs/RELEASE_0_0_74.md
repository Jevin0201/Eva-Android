# 0.0.74 免费模型切换、档位与协议修复

2026-11-08。用户实测 0.0.73 后反馈本机免费模型选择卡顿、档位不可调、发送持续重连。本轮在手机空闲后继续验收，具体正式安装及检查状态见文末。

## 修复

- 模型选择从同步序列化和保存全部历史，改为 `saveModelSelection(ticket,json)` 异步写入几百字节元数据。SQLite 选择覆盖层保留原历史分块，处理延迟快照、延迟选择和已消费的新会话选择。发送前等待保存成功，失败回滚。
- 折叠组展开后才创建模型行。API 用户打开菜单不再附带刷新 OpenAI 全目录，只在展开 OpenAI 或当前使用 OpenAI 时读取，保留身份、分页与请求代际隔离。
- 真机旧目录确实只有 ID/name，而 DSH 当前目录 24 个模型均提供档位。精确匹配受管理本机服务的旧缓存在后台自动升级，不阻塞界面，不重加提供商，不改默认/密钥/历史。后台结果按连接身份核验，失败保留旧目录。
- 保存真实 `x_ofm_efforts` 与 `x_ofm_effort_default`。增加“关闭、轻量、均衡、深入”等显示，未声明能力不编造。拖动时仅预览，松手后保存最终档位一次；重置使用真实模型默认。
- DSH 扩展档位不能直接放进内核固定 effort 枚举。对固定本机服务采用其文档模型后缀传输，由适配器恢复基础模型与真实 `reasoning_effort`。无显式选择时去除内核推断值，让服务使用自身默认。普通提供商保持原行为。
- DSH 原 Responses 入口未完整支持 namespace，旧配置一次性迁移 Chat Completions，由本机适配器保留命名空间、自定义工具、调用编号和结果配对。迁移保留提供商 ID、模型、密钥、目录及全局默认，后续显式协议编辑予以保留。
- 真机用户失败回合直接报错 `Unsupported Responses input item: additional_tools`。这是内核 Responses Lite 的正式工具声明形式。现将历史声明归并入 Chat 工具表，保持扩展能力，当前定义覆盖同名旧 schema，不再将其误当普通消息拒绝。
- 手机工具返回的截图由 typed output 数组转换为 Chat 的真实 image_url，文本保留在工具结果，并行结果全部配对完成后才插入图像，避免将图片编码当成文本发送。
- 回环访问明确绕过环境代理，流式心跳与上游活动继续传给内核。受管理服务自带恢复，外层 request/stream retries 设为 0，防止明确失败后再反复“1/5 重连”，不自动重跑工具或切换模型。

## 真机证据

证据目录为 `artifacts/acceptance-0.0.74/`。

- 模型选择两次实测约 85、103 毫秒（包括持久保存完成）。早期独立测量约 91 毫秒。
- 旧目录自动升级为 24 个带真实档位的条目，`catalogMetadataVersion=2`。见 `refreshed-model-config.json`。
- 独立验收聊天 `d6a917dd-e1ab-4083-bca3-bbbb670e407b` 使用 `nvidia/nemotron-3.5-super-vl:free`，关闭思考时真实返回 `EVA_FREE_74_OK`。
- 同一独立聊天连续三次实际调用 `eva_phone_route` 只读 list，每次 `success=true`，最后回复 `EVA_FREE_TOOLS_74_OK`。没有打开 App 或更改路线。见 `free-tools-smoke.json`。
- 将滑杆改为 low 后实际回复 `EVA_EFFORT_LOW_OK`。DSH 服务记录分别确认 `effort=disabled` 和 `effort=low` 且请求成功。见 `service-effort-evidence.json`。
- DeepSeek 免费线路在本轮返回 HTTP 429，不能宣称所有免费上游都可用。限流属于当前上游结果，协议修复不会解除额度限制。见 `free-device-smoke.json`。
- ModelSelectionStorageCheck 真机 14 项通过，验证 2 MiB 历史摘要不变、选择异步持久化、延迟快照和草稿隔离。
- ModelCheck 真机通过。早期 ModelRuntimeCheck 的 6 项通过；扩展后的旧历史副本和 429 单次请求回归状态见文末。

测试使用独立验收聊天，用户原失败聊天保持原有失败记录作为证据。全局默认保持原值，未因选择验收模型更改新会话默认。

## 电脑端检查

Chrome 模型控件回归和账号目录 16 项通过，包括小型异步保存、失败回滚、发送等待、旧目录实时更新，以及多次拖动 input 不保存、一次 change 只保存一次。图片附件与模型面板回归通过。

Python 实际 HTTP fixtures 通过，覆盖 SSE/JSON 回退、递归 namespace/function/custom、多轮配对、历史 additional_tools、截图与并行工具结果、真实档位、坏环境代理下回环直连、心跳、认证、上游错误和不支持内容的明确拒绝。

原生构建与签名检查通过，源码输入清单由构建前后散列核验，防止其他会话写入期间交付不一致候选。运行环境分层部署是其他会话的独立工作，本轮模型验收不替代其完整验收。

## 最终安装及清理

该候选后续统一进 0.0.76。正式包、原生与真实模型验收、截图和清理结果以 [0.0.76](RELEASE_0_0_76.md) 及 [任务总账](ACTIVE_TASKS_20261108.md) 为准，避免将旧候选路径误认为本轮最终包。
