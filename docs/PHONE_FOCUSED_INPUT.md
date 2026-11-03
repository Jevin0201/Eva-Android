# 无控件编号的聚焦输入

2026-11-02，检查用户指定的最近微信任务：打开应用、截图和坐标手势均有成功记录；微信多次返回 `nodes: []`。最后一次 `input` 带有 text 和 snapshot，但没有 node，原实现只能通过缓存中的节点调用 ACTION_SET_TEXT，因此返回“控件不可用”。记录没有成功输入或发送，不是文字已送达微信后被微信拒收。

新增 Android 13+ 无障碍输入连接路径：`input` 省略 node 时，验证有效快照、控制开启、设备未锁定、编辑器已聚焦、编辑器包名与快照一致以及非密码类型后，以 commitText 插入文字。不会触发回车或发送，也不会替换用户的系统键盘。有 node 的操作继续使用原节点路径，旧快照不能自动重放。

来源：[Android AccessibilityInputConnection](https://developer.android.com/reference/android/accessibilityservice/InputMethod.AccessibilityInputConnection)。服务声明 FLAG_INPUT_METHOD_EDITOR，并在连接时配置该能力。

真机自有测试页已通过：不提供节点编号，正确写入中文与 emoji；跨 App 包名和密码类型拒绝；无 Send 操作。一次输入连同操作后观察耗时 195ms。修订 APK 已安装。该数值是测试页本地工具耗时，不包含模型网络时间，也不等于微信完整发送流程已验收；本轮未重发用户之前的微信消息。
