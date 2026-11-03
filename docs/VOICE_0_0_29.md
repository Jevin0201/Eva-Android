# 0.0.29-voice：语音唤醒与灵动岛测试版

日期：2026-11-02。目标设备：已连接的 M332BF，Android API 37。状态：部分实测，供用户体验；不能视为完整手机代理最终交付。

## 使用

1. Eva 设置 → 语音唤醒与灵动岛。先用“预览灵动岛效果”看界面；预览不录音、不执行示例任务。
2. 授权麦克风、悬浮窗和通知，点击“开启语音唤醒”。手机操作仍需原有手机控制/无障碍授权。
3. 说“你好艾瓦”，振动并出现“Eva 正在听”后说指令。也支持连续说“你好艾瓦，打开相册”；该用法仍需真人准确率验收。
4. 停顿后自动提交。需要批准时点“查看对话”。执行期间展开浮层收起，避免挡住手机操作；通知/支持的系统胶囊显示状态。结果显示后返回待机。
5. 通知里可“直接说话”或“关闭语音”；语音页面也可关闭。关闭会释放录音、浮层、唤醒锁，并请求中断当前语音任务。

测试安装保留原包名和开发签名，覆盖升级，不清除聊天、账号和工作区。当前开发机已授权本机测试所需的麦克风、通知与悬浮窗。每次开启语音仍需用户主动操作，不在开机或恢复手机控制时自动录音。

## 实现范围

- 云端模型不变。本地只运行小型唤醒模型与中文语音转文字，不是把对话大模型搬到手机。
- 唤醒词：你好艾瓦；另配置“你好 Eva”的英语发音变体。中文变体已测，英文读法尚未真人验收。
- AudioRecord：16 kHz 单声道 PCM，VOICE_RECOGNITION。四秒内存环形缓冲用于保留唤醒词和连续说话的指令开头，不保存用户录音。
- sherpa-onnx KWS + streaming CTC；默认端点静音约 1.2 秒，无有效内容等待约 8 秒，单段指令约 20 秒上限。这些是配置值，不代表逐毫秒实测保证。
- 独立 microphone 前台服务、常驻通知、显式关闭、非 sticky 恢复；麦克风被系统静音/争用时停止并提示。保持 CPU 唤醒，耗电尚未量化。
- `TYPE_APPLICATION_OVERLAY` 黑色圆角浮层展示文字、音量条、取消和返回聊天；只占实际面板区域，不抢键盘焦点。可调垂直位置。
- 支持的 Android 系统会展示 promoted ongoing 短状态。此手机已在系统顶部胶囊显示“正在听”；完整听写面板仍由 Eva 自有浮层实现，不宣称任意手机都开放原生岛内自定义界面。
- 从设置进入时复制当前模型、项目和权限选择；无配置时仍能看预览，启动真实语音需要可用模型。每条语音指令新建一条独立聊天，不追加到正在输入的草稿。
- Native `thread/start` / `turn/start` 使用现有 KernelHost、云端账号/API 路由、权限策略、手机/浏览器动态工具。语音不会擅自提升到完全访问。
- 历史通过持久化收件队列导入 WebView；保存成功后确认导入，避免重启后反复出现已删除聊天。内核失败不自动重发。
- 锁屏下不执行识别出的指令，提示先解锁重新说；不做自动解锁。

## 已取得的证据

- APK 编译、D8、资源打包、签名验证及真机覆盖安装成功。
- `VoiceCheck mode=models`：真机加载本地模型，对 Windows 中文 TTS 生成的固定测试 WAV 解码，检测关键词“你好艾瓦”、识别“打开相册”。记录在 `artifacts/voice-models-final.txt`。这是合成样本测试。
- `VoiceCheck mode=service`：麦克风服务启动、本地模型就绪、悬浮窗可见、显式停止通过。
- `VoiceCheck mode=acoustic`：手机自身扬声器播放固定 WAV，经麦克风实际采音触发唤醒并听写；诊断模式禁止提交代理任务。包括切到系统设置后的跨 App 浮层检查及停止。最终结果见 `artifacts/voice-acoustic-final.txt`。
- `VoiceCheck mode=agent`：使用现有云端配置提交“请仅回复：语音测试成功。不要调用任何工具。”，完成并存入原生线程历史。不是语音操作第三方 App 的完整验收。
- `VoiceCheck mode=ui`：语音聊天进入现有历史、能打开对话、设置入口可达，通过。
- `test-voice-ui.cjs`：导入去重、草稿保留、导入确认、删除后不复活、模型/权限继承、无模型预览入口，通过。
- 原有设置、权限档位、聊天草稿测试通过。

真机采音回归曾出现唤醒词残片进入听写结果。已将两秒前置缓冲改为四秒，并处理“你好爱哦”“你好爱”等识别别字；不能因此推断任意口音、噪声和语速都可靠。原始实测与最终测试记录均应区分。

## 尚未验收

真人近远距离/不同口音/噪声/电视人声的唤醒率和误唤醒率；连续多轮日常任务；长时间熄屏与厂商省电策略；蓝牙耳机、通话和其他录音应用的切换；撤销权限后的完整恢复；不同屏幕和横屏；完整语音→第三方 App 操作的用户场景。测试版没有文字转语音播报回答，也未做说话人身份验证。

## 第三方来源与许可证

引入前检查了 sherpa-onnx v2.0.1 的 Apache-2.0 LICENSE、Git tree（没有 mode 160000 子模块）、Kotlin API 和 JNI 读取路径。CMake 使用 FetchContent；已读取 kaldi-native-fbank、kaldi-decoder、utf8proc、simple-sentencepiece 和 Android ONNX Runtime 依赖声明。使用上游 AAR 的 classes.jar、ARM64 JNI 和 ONNX Runtime，不在此项目自行重编译上游 C++。

| 内容 | 固定来源 | 许可 |
| --- | --- | --- |
| sherpa-onnx Android AAR | `k2-fsa/sherpa-onnx` release v2.0.1 | Apache-2.0 |
| KWS 编码器/连接器 int8、解码器 fp32、tokens | 官方 release `kws-models`，`sherpa-onnx-kws-zipformer-zh-en-3M-2025-12-20` | 模型原作者 pkufool 在 ModelScope 标注 Apache-2.0 |
| 中文流式 CTC int8 + tokens | 官方 release `asr-models`，`sherpa-onnx-streaming-zipformer-small-ctc-zh-int8-2025-04-01` | 对应 csukuangfj PyTorch 模型卡 Apache-2.0 |
| Kotlin stdlib | Maven Central 2.1.0 | Apache-2.0 |
| ONNX Runtime | 上游 AAR 随附，CMake 固定 Android 1.28.2 | MIT；包含 ThirdPartyNotices |
| kaldi-native-fbank / kaldi-decoder / simple-sentencepiece / utf8proc | 上游 CMake 固定依赖 | Apache-2.0 / MIT，许可证随 APK 打包 |

下载 URL、字节数和 SHA-256：`research/voice/dependencies.json`。原模型卡、LICENSE、CMake 和 JNI 读取证据保留在 `research/voice/`。权重未修改，文件仅重命名；`keywords.txt` 为本项目配置。许可证存放 `probe/assets/voice/licenses/`，总说明见 `THIRD_PARTY_NOTICES.txt`。

## 复现与构建

在项目根目录：

```powershell
node tools/download-voice.cjs
python tools/prepare-voice.py
# 使用本机已有 JDK；JAVA_HOME 的实际路径按开发环境设置
./tools/build-probe.ps1 -Sdk "$PWD/downloads/android-sdk"
node tools/test-voice-ui.cjs
```

Windows aapt2 在此环境会将嵌套 assets 路径写成反斜杠。`normalize-apk-assets.py` 在签名前规范化 ZIP 路径，禁止重名。初次归因为压缩读取问题并不完整，最终定位是路径分隔符。构建结果使用 Android 正斜杠路径；模型原子解包到私有目录，native 用文件路径加载。

声学测试会短暂播放中文样本并使用麦克风；不会发送这段样本对应的操作指令。运行 instrumentation 会重启目标进程，不应在用户已有任务执行期间运行。合成测试 WAV 位于项目 artifacts 和应用私有测试文件，不是用户录音。
