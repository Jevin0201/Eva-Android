# 0.0.58 附件、本地导入与 Android 返回

更新：2026-11-06。

## 附件及本地执行

附件先复制到手机工作区。发送和运行中引导都只传电脑同源附件路径清单，不再把选中的所有图片直接追加为 localImage 模型输入。前端以只读显示模型复用原图片画廊、原文件卡片和目录图标，内核历史对象不变。模型按任务调用本地工具读取；进入模型上下文的内容仍发送到云端模型。

去掉应用的 10 项及 32 MiB 导入限制，采用 32 KiB 有界缓冲复制。目录递归保留层次及空目录，复制失败清理本次 UUID 容器。相册数量由系统选择器能力决定，不另设应用的 10 项上限。

依据用户最终要求，撤掉自建文件树。手机文件直接调用系统文件管理器；目录单独调用 ACTION_OPEN_DOCUMENT_TREE，以系统“使用此文件夹”确认。相册、文件、文件夹以统一紧凑菜单显示。输入区附件的缩略图、名称、类型/大小和移除操作统一整理；发送后的信息流继续使用桌面原组件。

附件按钮失效的实测原因为遗留 eva-transfer.busy=true 静默拦截后续点击。现在用进程内真实导入标记阻止并发导入，启动时清理无工作线程的遗留状态；实际导入中会明确提示。

## Android 返回

注册 Android 13+ OnBackInvokedCallback。优先收起键盘、原图片预览和弹层，设置按访问层级逐级返回，设置首页回到当前聊天；对话返回打开侧栏，再返回收起侧栏。原生工具页通过各自 onBackPressed 保留目录及页面上级逻辑。

## 验证

- 前端：14 个路径附件（原图片画廊、12 个文件卡片和目录卡片）、不可变历史、路径越界拒绝；16 个本地附件发送只带文本路径清单，无 eager 图片载荷。
- 原生：33 MiB 文件、超过 10 项、多层及空目录、字节数、失败清理通过 AttachmentImportCheck。测试私有 provider 限定 cache/attachment-import-check，exported=false，只读。
- 真机：右边缘手势从浏览器设置回设置首页，左边缘回聊天；返回打开/关闭侧栏、消费附件菜单、保留当前会话。
- 真机：手机文件打开 com.android.fileexplorer 系统文件管理；目录打开 DocumentsUI。进入独立测试目录后确认按钮可用，目录复制成功并出现输入区目录卡片。
- 0.0.58 已原签名保留数据覆盖安装；最终菜单 172×138 CSS px、三项同级入口，系统返回关闭菜单且不打开侧栏，真机保留 28 个会话。浅/深/320px 附件卡片截图已实际检查。证据：artifacts/diagnosis-20261105/v56-back-native.json、v57-system-picker.json、v57-folder-import-native.json、v58-attachment-ui-native.json；界面回归截图和记录由对应 tools/test-* 保存到 artifacts/。

## 清理

已核实路径并删除未采用的 AttachmentPickerActivity.java。已删除手机独立测试目录 EvaAttachmentCheck_8c17cc927c、对应 workspace 项目内的测试 UUID 导入容器、该附件的测试元数据和 /data/local/tmp/eva-attachment-ui.xml；未删除用户源文件或历史。原生大文件测试自行清理其 cache 和导入容器。保留源码测试、验收记录、签名 APK、升级备份与构建依赖。
