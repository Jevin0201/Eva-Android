# 附件400与跨提供商历史工作投影

## 原因边界与证据

真实错误是 input[3].content 最长0却收到1个元素；这是输入条目 schema，并非图片字节数限制。父任务另已用相同原图在新 OpenAI 隔离会话成功识图，因此不可通过删除图片或整个用户历史掩盖错误。

只读检查当前 KernelNetwork：仅提供 CONNECT TCP隧道，TLS端到端，未解析或改写 Responses JSON。桌面 Eva 0.2.1 的 `src/main/http-transport.js` 只提供HTTP传输profile；`isolated-server.js::switchProvider` 只fork并登记alias，无异构reasoning序列化转换。`importThread` 已有history_base依赖递归、路径与循环检查、end_byte_offset完整性检查，可复用这些安全约束。

手机污染子fork本地无reasoning，但 history_base 指向旧提供商父前缀。严格读取其引用的45181字节/end_ordinal_exclusive=16，安全shape存于 attachment-parent-prefix-shape.json：父前缀包含 reasoning.content[reasoning_text]1、summary0、encrypted长度38。没有输出或保留正文/密文/图片到该shape报告。仅凭rollout顺序不冒称已捕获真正出站 input[3]。

matching commit `6ff1e1ca3b30fc8b914720681fcf5fe62e95f856` 的官方 companion 源码及摘要在 attachment-transport/SOURCE.json（Apache-2.0，非二进制等价证明）：

- models.rs::ResponseItem::Reasoning 允许content，should_serialize_reasoning_content 在content含ReasoningText时不跳过该字段。
- history.rs::for_prompt 调 normalize_history；该normalizer修工具调用配对、移除孤立输出、按能力处理图片音频，不提供跨provider reasoning兼容迁移。
- client_common.rs::Prompt.get_formatted_input_for_request 克隆输入并规范化图片detail，没有清理reasoning。
- client.rs::build_responses_request 处理配置更新和前缀；非OpenAI路径明确豁免Reasoning的encrypted_content清理。这不是跨provider密文可互通的保证。
- paginated_fork.rs 使用history_base引用和model_context::load_for_fork；新fork不是复制current后缀就获得完整工作历史。

## 定向修复原则

长期的最佳边界是内核请求副本的目标provider能力投影，而非修改原rollout或TLS拦截。当前Android先提供独立的提供商工作副本投影工具；不自行生成摘要，不改变原始可见历史，不猜测跨provider密文格式，不盲目设置content=[]。

新增 ProviderHistoryProjection.java（由父任务另行集成）：

- 明确跨provider，或同名target子fork的祖先provider冲突，且**当前活动模型历史**仍有异构reasoning才生成副本。正常同provider只读元数据后直接pass-through；未materialized空会话交原内核处理。
- 精确递归history_base的字节及ordinal边界，禁止循环、路径越界、重复UUID；最新compacted.replacement_history重置活动reasoning判定，避免压缩后无限重复fork。
- 仅从新的工作副本移除不同provider的ResponseItem reasoning；checkpoint replacement_history内同类条目也处理。用户消息、助手最终文本、工具调用与输出的payload不改，原source文件不写。
- 原始source文件和所含前缀分别记录SHA-256、来源provider和边界；audit不含正文或密文。
- 32MiB单条记录、128MiB累计投影输入、深度16、最多2万文件/50万记录；边界、原文件变化或损坏失败时不继续任务。
- 自包含新UUID元数据移除history_base并标target；存于CODEX_HOME/sessions/UTC日期/标准rollout文件名，保留作为新fork未来重启时的parent。新文件不是可任意删除的临时缓存。

## 验证

tools/ProviderHistoryProjectionTest.java 已以JDK21 --release8编译；使用独立测试运行时 com.vaadin.external.google:android-json（POM标Apache2）在临时目录执行22项断言通过。覆盖同provider元数据快路径、未materialized空会话、父前缀精确边界、重复/坏边界失败、checkpoint清除reasoning后不迁移、checkpoint保留reasoning时定向处理、9MiB图像payload不变、源文件不变及无正文审计。

这只验证纯文件投影。实际thread/fork(path)、持久化父链、重启resume、跨provider双向发送/识图仍由父任务在真机独立验证；不能用宿主22项测试代替。
