# 0.0.76 · 跨模型历史兼容与旧任务修复

针对手机“复杂文件预览体验包”切换提供商后无法继续、压缩返回 400 的问题。保留原聊天 ID、原始 rollout、调用结果与文件，在兼容工作副本中继续。不是所有服务商能力完全一致的承诺，也不清除历史中真实发生的失败记录。

## 历史与恢复

桌面基准：Eva-Source/src/main/main.js 的提供商切换事务与 isolated-server.js 的 switchProvider，用原线程分叉并维护逻辑会话映射。手机当前内核需要额外适配：实测生成的 ThreadResumeParams/ThreadForkParams 不接受 path 字段，先前传入路径会被忽略；必须索引兼容副本，并使用副本的真实 ID 分叉。原聊天的 previousKernelThreadIds 保留旧线程，更新的工作线程必须由内核确认提供商和模型。

ProviderHistoryProjection 现在检查普通 response_item 和全部 compacted.replacement_history。跨提供商去除上游消息项 ID，保留 call_id 配对、参数、工具输出、图片、用户文本与普通摘要；同提供商旧对话也检查遗留的 item_ 等非法前缀。不会递归修改业务数据中的 id。检查点移除私有推理时同步筛选来源元数据。

反向切换时，其他提供商无法解释 OpenAI 的加密压缩项；从保留的 rollout 重建普通上下文及工具证据，不直接发送外部密文。缺失必要原记录时明确阻止不完整迁移，保留原会话。新网关输出 function_call 使用 fc_、custom_tool_call 使用 ctc_，流式事件和后续结果引用仍保持一致且唯一。

协议依据：[官方函数调用说明](https://developers.openai.com/api/docs/guides/function-calling)、[输入项字段定义](https://developers.openai.com/api/reference/resources/conversations/methods/create)。输入项 id 与工具 call_id 分开处理，不能连同调用配对一起清除。

## 依赖、脚本与错误提示

手机当前 docx/pptx/pip 等已补齐；三份既有脚本在独立检查目录运行全部退出 0，DOCX/XLSX ZIP/XML 回读通过，原成品摘要不变。未为消除无关探测报错而安装 matplotlib/PyMuPDF/WeasyPrint；本任务既有 Pillow/reportlab/LibreOffice 等能力可用。托管技能补充实际依赖探测、隔离生成、准确参数、非零退出码与管道错误处理，避免把旧报错当成当前缺包或以 tail/echo 的成功掩盖失败。

402 显示余额/额度不足、保留对话和文件并提示切换；429 显示限流与安全重试/切换提示。不会自动选择另一收费模型、重跑工具或宣称已解除服务商限制。未知错误保留原说明，原始协议详情仍在失败回合中。

## 验证与安装

证据集中 artifacts/history-compat-20261108/。

- 原历史迁移测试 22 项、旧同服务商污染与工具配对/图片/嵌套 ID 检查、反向加密检查点重建检查通过。
- 网关真实 HTTP fixtures、14 项依赖隔离检查、7 项办公修复检查、Chrome 模型/UI 回归通过。
- 原对话实际历史副本经手机 pinned Codex 向严格回环 Responses 接口继续和压缩成功；保留先前工具结果，无非法 ID，不执行任务工具。正向与反向日志 core-wire.log、core-reverse-wire.log。
- 应用 ModelRuntimeCheck 15 项通过，包含从原失败线程恢复、三次新工具调用及最终回复、源文件哈希不变、HTTP 429 只请求一次和任务释放。fixture 的建连后提前关闭单独计数，完整请求/正文错误继续失败。
- 原对话恢复到 e11143bb-5364-461a-87ee-07258d2a1d6f；当前 gpt-6.1-terra/OpenAI 的真实远程压缩已 completed，未复现两种历史 400。见 real-chat-resume.json、real-compact-status.json。
- 0.0.76 同签名保留数据覆盖安装，首次安装时间仍为 2026-11-02 15:09:00；安装前完整聊天快照保留。固定输入快照保证构建过程中其他聊天修改源码不会造成混合签名包。该包保持原有开发验收配置，未声明为公开发布完成。

原工作区既有浏览器/预览/执行生命周期改动一并编译，其完整功能范围仍以各专项记录为准；本次测试不能代替这些专项验收。云模型只读验收与清理结果在收尾补记。

## 最终云端验收与清理

原“复杂文件预览体验包”对话中已完成一次明确只读的真实云端验收：gpt-6.1-terra 连续3次终端调用，退出码全部0，最终回合 completed/error=null。读回 docx 1.2.0、pptx 1.0.2、openpyxl 3.1.5、Pillow 11.2.1、reportlab 3.6.13 均可用；原目录 DOCX/XLSX 成品仍在，没有重做、安装或覆盖。证据 cloud-check.json。原来的3份 rollout（含父链）逐字节 SHA256 核验不变，见 originals-unchanged.log。

剩余 PPTX、PDF、Markdown、HTML、WAV、MP4 与预览指南尚未制作，此次只读验收不等于复杂体验包全部交付。

已删除本轮固定构建快照、Java 编译类、迁移测试副本及冗余 base64 包装；手机已删除专用内核 fixture/生成 schema 环境、隔离生成检查目录和临时传输文件。保留 outputs/eva-android-0.0.76-arm64.apk 与 SHA256、构建源清单、原始历史备份、安装前快照、审计和必要依赖。用途未确认的其他任务历史内容保留。清理后核验原文件哈希、交付 APK 摘要与手机原成品存在，明细 cleanup.json。
