# API 供应商、DSH 插件与推理档位

## 0.0.84 最新界面要求

按用户最新要求，前台和设置不再显示冗长的DSH可用性说明，仅保留重新检测入口和可用模型；下面关于展示说明的内容为历史实现。检测、筛选和选择前校验保留。真实复检24项中11项通过，正式覆盖安装与范围见 [0.0.84](RELEASE_0_0_84.md)。

## 目标与实现

API 提供商入口直接显示供应商名称、URL、API Key、模型名称四个字段和保存/测试连接。已有 API 连接在下方供编辑，不再重复显示协议名；DSH 不混入普通 API 添加表单。接口格式收在高级设置，新增普通 OpenAI 兼容连接默认 Chat Completions；官方 DeepSeek 地址自动使用 Responses；编辑已有连接保留已保存协议。Key 留空保留原密钥，更换地址要求重新填写。凭据仍在原生安全窗口输入、Keystore 加密保存。

既有 DSH standalone 连接按固定回环地址识别，显示名称迁移为“DSH插件”，不重建连接，不变更 Key、默认选择或会话。模型列表和设置单独说明：部分模型不可用，仅显示近期实际连通测试通过的模型。使用 DSH 自有 `/api/management/models/test`，不是把 `/v1/models` 列出当作成功。应用进程运行期间每分钟判断是否到期，15 分钟启动一轮，两路检测；有内核任务时延后。成功有效期30分钟；未知、失败或过期不在模型选择器/默认选择器显示。强制重新检测入口保留；不添加系统定时唤醒。进程被系统终止时不能持续检测，恢复应用后检查。文本连通通过不保证下一请求或工具能力始终可用。

DeepSeek 用户手动连接未缓存模型目录，原选择器因此失去推理能力元数据。现在仅对精确官方主机及匹配模型复用应用已有官方 manifest；deepseek-flash 恢复 low/high/max。刷新目录遗漏元数据时保留已知能力，服务明确返回空档位时尊重移除；其他供应商不套用 DeepSeek 能力。

可用性独立于用户显隐设置、连接身份、模型默认值、当前对话与推理档位。健康结果不重启内核、不重绘无关聊天；保存选择前原生再次检查 DSH 可用性。历史保留的不可用 DSH 模型不会被静默替换，发送前提示重新选择并保留输入。

## 验证

- `ModelProviderPolicyTest`：DSH成功/失败/未知/过期/时钟回拨、人工模型回退、其他供应商隔离、DeepSeek无目录与目录刷新能力保留通过。
- Chrome：DSH选择范围与刷新、默认模型、桌面同源模型控件、账号目录16项、模型面板和模型UI回归通过。
- 真机独立包 `ModelSettingsPolicyCheck`：直接四字段、保存及重复保存、普通入口无插件/协议干扰、DeepSeek能力、DSH失败模型默认选择阻止、健康结果不改变默认/连接身份通过；不调用用户付费API。
- 正式版82/0.0.82已保留数据覆盖安装，非debuggable；升级前后41对话、5草稿、1项目的完整UI持久数据SHA-256一致。真实原生层次确认直接四字段，已有连接仅显示名称DeepSeek；返回一次即退出新建表单。
- 正式版真实DSH首轮：24个目录模型均完成文本连通检测，11通过、13未通过；前台11项全部对应成功账本。该数量会随后续检测变化，不是长期可用承诺。15分钟周期已实现，未为验收等待完整第二个周期。
- 正式版DeepSeek控件：max=2（3档）、disabled=false、当前显示“高”；只读控件检查结束后完整data不变。全局默认保持手机当时已有OpenAI/gpt-6.1-terra/low，没有切换用户默认或实际发起付费DeepSeek请求。

证据集中在 `artifacts/dsh-availability-20261108/`。构建输入临时快照也集中于此，交付后清理；最终签名APK/源码SHA清单保留于 `outputs/`。

## 来源

- [DSH management 实现](https://github.com/Ebony-Vinyl/dsh-our-free-model/blob/main/packages/standalone/management.mjs)
- [DeepSeek Responses](https://api-docs.deepseek.com/guides/responses_api/)、[Thinking mode](https://api-docs.deepseek.com/guides/thinking_mode/)

## 安全清理

已卸载独立真机测试包、删除本轮构建输入快照与Java测试class、手机临时UI层次文件和本轮ADB转发；保留正式0.0.82 APK/源码SHA清单、验收日志、脱敏元数据及升级前备份。检查项目tmp，仅有用途未确认的launch-confirmation-fixture，未删除。其他会话并行修改的源码保留；0.0.82安装证据仅对应固定源码清单，不包含冻结之后的其他性能改动。
