# 手机端记忆管理

`MemoryStore.java` 和 `memory-settings.js` 实现列表、新建、读取、保存、删除以及 SHA-256 修订校验。保存与删除必须携带读取时的 revision；内容已被其他会话更新时拒绝覆盖，界面保留未保存草稿。删除需明确确认，离开有修改的编辑器需确认放弃。

路径映射：Android 私有目录 `files/alpine/root/.eva-codex/memories`，内核可见路径 `/root/.eva-codex/memories`。该根目录与 KernelHost 的 `CODEX_HOME=/root/.eva-codex` 一致。内核源码 `codex-rs/memories/read/src/lib.rs` 的 `memory_root` 使用 `codex_home.join("memories")`；桌面 `src/main/eva-memories.js` 也使用这个子目录，并通过 developer instructions 告知模型按需读取。

内核新版自动记忆管线可能根据 memories.version 使用不同目录；本功能是用户可编辑的独立记忆，与桌面一样通过 `MemoryStore.instructions()` 明确连接当前代理。接线时须将这些说明追加到 thread/start 和 thread/resume 的 developerInstructions，不能仅创建文件页面便声称模型会读取。这里不自动开启记忆生成服务。

宿主 RPC：`android/memories/list|read|create|save|delete`，交给 `MemoryStore.execute(context, action, params)`。内容只支持 .md/.txt，最大 4 MB；限制根目录、拒绝路径穿越和符号链接；列表最多 1000 个文件、16 层。新建仅接受根目录文件名，已有合法子目录中的文本记忆可读取、编辑和删除。

验证：JVM `MemoryStoreTest` 28 项通过，覆盖 Unicode、修订冲突、重复名称、路径限制、字节上限、外部更新及删除。Windows 测试账户无法创建符号链接，该分支需 Android 真机补验。`test-memory-settings.cjs` 已通过列表、新建、编辑、冲突保留草稿、确认放弃、重新读取、确认删除和文本转义。

仍需主线程完成宿主接线、APK 真机测试及真实模型读取记忆内容的验收。不得把前端协议桩结果描述为云模型记忆能力已验收。
