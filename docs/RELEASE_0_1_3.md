# 0.1.3 正式覆盖安装

2026-11-17 用户提供 eva-release-signing-backup.zip，恢复 .release-signing 长期签名及原始备份。证书 SHA256 7ea82efa25913cd8c016ba2bc989def449bcca4e9a62dc8e3f7ff588d10a6820 与手机正式包一致。密钥、口令及备份受 Git 忽略，不提交。

正式 ai.eva.android.probe 从 90 / 0.1.2 使用 adb install -r 升至 91 / 0.1.3，安装成功。firstInstallTime 保持 2026-11-13 15:10:00。启动检查通过，截图可见既有对话、当前模型与额度；未清空正式数据，未进行全量账户或历史校验。

构建使用项目当前源码，Release 模式移除 instrumentation、关闭 debuggable。Java、DEX、签名校验通过；资源归一化遇 Windows 文件占用，校验完成归一化 ZIP 及全部 assets 与源码一致后继续打包。正式安装验证不代替此前验收版各项功能测试。

用户授权删除 ai.eva.android.acceptance；先停止并备份 files/shared_prefs 到 artifacts/formal-install-20261117/acceptance-data.tar，检查 23496 项、919975936 字节可读取，再卸载成功。备份不包含 Android Keystore 密钥。不迁移或覆盖体验版数据到正式版。包列表仅剩正式 Eva 与独立醒图测试包，后者未修改。

交付 outputs/eva-android-0.1.3-arm64-release.apk，SHA256 ba5b8bf67514407646c324b1715eaca67a04ec4cfc5f653854d31343ea708634。安装证据与构建续跑脚本位于 artifacts/formal-install-20261117。

清理：卸载已备份的体验版，移除设备临时 UI XML。检查本轮和既有构建内容，签名、数据备份、正式交付、依赖及回退成果均保留，不删除用途不明的历史文件。
