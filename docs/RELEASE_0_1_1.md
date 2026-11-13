# Eva Android 0.1.1 — 复制粘贴修复

版本从本次起使用 0.1.1，后续补丁递增为 0.1.2 等；Android versionCode 延续为 89，保留正式包名 ai.eva.android.probe 和现有长期签名，覆盖安装保留数据。

## 修复

- 代码框复制缺失懒加载剪贴板服务模块，补齐 Android 宿主文件及可重复生成适配脚本。
- 用户消息复制接入 Android ClipboardManager，不再依赖 WebView 不稳定的 Web Clipboard 路径。原生失败不会伪装成功。
- 普通文本的 copy 事件将真实选区写入 Android 剪贴板；保留中文、emoji 和可见换行，仅在用户复制时触发。
- 回答底部及兼容代码复制按钮成功后短暂显示对号，失败保持复制按钮并给出提示；缺失代码内容不清空剪贴板。
- 本地 Markdown 阅读器 Clipboard API 不可用时回退系统复制命令，恢复原焦点、选区和滚动位置，仍无原生桥。
- 输入框键盘栏提供“粘贴”，替换选区或在光标处插入文本；纯 content URI 图片/文件经后台复制到工作区，复用附件结果通道。文本最多 400000 字符，资源最多 64 个条目。
- 文件选择与粘贴导入共享操作编号和互斥状态；迟到附件结果只更新所属会话，不重建输入框或切走当前界面。

## 验证

定向测试：test-shell-clipboard.cjs、test-reader-clipboard.cjs、test-clipboard-copy.cjs；回答操作、附件显示和历史并发既有回归通过。原生分类13项及附件操作所有权夹具、全 Java 编译通过。

0.1.1 正式安装成功。真机通过真实 Android 剪贴板读回核对用户消息、代码框、整条回答复制（含中文、emoji、换行），回答按钮成功对号、粘贴替换选区，以及长按文字后点击系统“复制”。证据位于 artifacts/clipboard-0.1.1/device-results.json、answer-checkmark-device.png 和 native-selection.png。测试使用内存样例，结束后恢复真实页面；未持久化测试会话。纯 content URI 图片/文件粘贴仍只有原生夹具验证，没有真机端到端结论。后续 0.1.2 保留本批修复并优化历史载入。

## 清理

本轮文件集中 artifacts/clipboard-0.1.1、artifacts/clipboard-20261113 和 tmp/clipboard-native-check。原生夹具清理已核实绝对路径，但执行工具返回 blocked by policy 且无具体原因，未绕过，暂留。旧 artifacts/performance-20261113 构建产物仍按上一轮拒绝记录保留。签名、备份、交付 APK 和必要依赖保留。
