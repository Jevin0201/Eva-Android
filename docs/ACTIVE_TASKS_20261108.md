# 当前会话任务总账

更新于 2026-11-08。只覆盖本会话明确提出及后续修正的任务。状态区分代码实现、离线验证、真机验证与未完成项，不把编译或 fixtures 当完整交付。当前三个子智能体分别复核流程学习、模型/DSH、原生执行与依赖；主代理负责整合、手机操作和最终验收。

最终整合状态：0.0.77正式包已保留数据安装，原格式阅读/全屏/真实触摸/选区直接替换/真实模型精确修改/组件已安装展示完成真机验收，详情见 [0.0.77](RELEASE_0_0_77.md)。前7组核心能力与既有限制保留0.0.76证据；本轮未把所有App、所有环境或任意Office高级特性当作已覆盖。

版本说明：本轮新增功能最初按 0.0.75 开发，证据仍集中于 acceptance-0.0.75；历史兼容会话已将统一源码版本推进到 0.0.76，并安装其调试候选。最终交付以整合后源码清单、实际安装和下面的验收记录为准。

## 1. 快捷流程学习、标定与按软件复用

用户要求：做过的操作能记住，按不同软件分别学习，形成标准化流程以减少重复操作和 Token；消除一直提示“快捷流程未标定”的体验。

已真机验证：0.0.71/72 路线持久保存、按包名和安装版本隔离、菜单延迟等待、起点不符停止、模型根据实时页面恢复后回放、receipt 确认成功。计算器三步导航及当时路线 30 项、批处理 19 项检查见 RELEASE_0_0_71.md、RELEASE_0_0_72.md。这些证据来自原来的模型调用 save 路径，不能作为新自动落盘或所有 App 已支持的证明。

本轮已实现并真机分项验证：成功的安全 eva_phone_steps（包括单步批次）在实际包名、安装版本、新快照和可读唯一导航端点有效时自动落盘，无须另调 save；指纹去重保留原路线 ID、goal 和已核验记录。自动记录先为 observed，只有核验当前页面并提交本次 receipt 后才为 verified。支持 learn=false，每 App 128 条、总 512 条容量，达到容量时保留已有数据并报告。手机控制页异步按 App 显示状态。真机 PhoneRouteCheck 55 项、PhoneBatchCheck 25 项通过，包括资源 ID 点击补取实际匹配节点标签、连续批次聚合、拒绝敏感/不可读步骤和 receipt 防伪。

真实模型完成“不调用 save”的两轮验收：第一轮两批点击“更多”及“设置”，自动保存完整两步路线 c60db6bf-2abe-4603-ae8c-dcbf671a5f28，startTarget 是实际“更多”控件；第二个独立新会话按 App list→完整 replay→实时设置页核验→本次 receipt confirm 成功。见 artifacts/acceptance-0.0.75/auto-route-result.json、auto-route-A/B-evidence.json。早期第一段漏学的失败记录保留在 route-partial-path-attempt，修复后不再依赖现场手动补开“更多”。

边界：普通 eva_phone 独立调用链不会自动收集成路线，应使用 eva_phone_steps；截图坐标、输入和发送/购买/删除等敏感动作不在完整自动学习范围。未知 App 必须满足安全导航控件可读、定位唯一，不能声称全部覆盖。微信固定坐标流程仍有独立版本适配限制。两轮真实累计用量为 A=225652、B=199492 Token，均保留原始 total/input/cache/output；准备步骤不同且 A 含一次快照拒绝，所以只作本次观察，不能当严格控制后的净节省或普遍节省率。

复验入口：手机空闲时运行 `EVA_ADB=本机adb绝对路径 node tools/run-isolated-device-check.cjs PhoneRouteCheck`，应得到 `PASS phone routes 55 checks`；该隔离检查不代替上面的真实 App 记录。

真实工具链路按以下顺序，所有 id、goal 和 receipt 均取刚返回的真实值，期间不调用 save。

1. `eva_phone foreground`，按实时观察把 `com.miui.calculator` 恢复到计算主页面。
2. `eva_phone_steps` 一批执行 open_app(package=com.miui.calculator) → 点击当前“更多”控件 → 点击“设置”，附 before_package/expect 等实时条件。检查 completed、当前设置页面及 routeLearning.autoSaved=true，记录 routeLearning.route.id/goal；此时只应为 observed，不能报告业务任务已核验。
3. `eva_phone_route list`，package=com.miui.calculator，确认刚才自动记录的路线存在，包名、当前版本、起点和端点正确。
4. 根据最新观察用 `eva_phone back` 恢复计算主页面，再 `eva_phone_route replay` 传入刚保存的 id 和精确 goal。检查回放 completed、实际设置页、endpointMismatch 未出现，取本次新的 receipt。
5. 核对实际页面后 `eva_phone_route confirm`，success=true，传本次回放 receipt；读回 verified=true，路线变为 verified。打开手机控制页检查该 App 摘要。冷启动持久化、版本变化和未知 App 扩展需另留真机证据；不得把本条计算器通过扩写成全覆盖。

负责人 app_learning，主代理独占真机验收。

## 2. 原 DSH 安装对话、插件执行与 GitHub 项目安装

用户要求：找到手机里安装 DSH 插件失败的对话，定位设计/模型配置问题，增强兼容项目的完整安装执行，保留原项目与资料。

原失败链已取证：实际项目为 MIT 许可的 `Ebony-Vinyl/dsh-our-free-model` standalone 2.7.1。原任务下载曾遇到 Git Proxy CONNECT aborted，改用源码归档后跑通过单次调用；后续适配停留在手机工作区的 Eva 0.0.61 源码，而实际安装版已是 0.0.71，宿主接入未安装生效。原对话与源码取证见 artifacts/dsh-investigation-20261107/，修复范围见 RELEASE_0_0_72.md。

已实现并分项实测：复用独立项目及数据，服务自产凭据进入 Keystore，保留提供商 ID 和全局默认；冷启动确保服务、随机就绪握手与 health 核验、受管进程代理更新；Responses 跨请求编号补丁有原 SHA 备份及未知修改拒绝，后续采用 Chat 协议适配 namespace/custom/additional_tools/typed output。0.0.74 的 `nvidia/nemotron-3.5-super-vl:free` 真实消息、连续三次只读工具及 disabled/low 实际下发通过。模型结论必须按证据内的 model 字段核对，文件名含 kilo 的旧记录不能据此算作 kilo 多工具通过。跨提供商切换与压缩仍有第 3 节所记真实阻断，待负责会话完成实际恢复入口验收。

GitHub 安装执行合同：先核对真实 README、许可证、子模块与 Alpine/ARM64/运行时条件，识别 standalone、CLI、MCP、技能或宿主插件的实际入口；保留原版本、配置、锁文件及回滚材料，隔离安装，启动并执行真实任务后核验。缺包、包管理器或安装 recipe 时继续官方说明调查、依赖修复和可验证来源回退；确证架构、权限、账号或全部可用来源阻断时记录失败命令、来源尝试与后续恢复条件。此合同的工具与指引已有实现，各项目的实际兼容结果需分别记录。

与通用依赖的接续已有真机后端证据：隔离项目 Python/npm 从缺包到安装，再用返回的执行环境运行原脚本成功，原脚本与保护文件 SHA 不变；Java/Android 本轮复用已有环境并验证入口。官方来源故障注入后 TUNA/npmmirror 实际安装与执行通过，见 artifacts/acceptance-0.0.75/live-dependencies.txt、live-mirrors-foreground.txt。这些结果尚未覆盖新版原生动态工具的模型主动调用、后台网络及全新 Java/SDK 安装链，具体待办见第 5、6 节。

0.0.75 最终待核销：受管 DSH 冷启动、目录及凭据/默认保留；已记录模型的三工具与最终答复；原失败历史工作副本恢复和跨提供商压缩；真实模型通过 `eva_dependencies` 补齐隔离项目依赖并继续原脚本；后台来源回退与资源释放；正式签名覆盖安装及数据保留。负责人 model_config 核对模型/DSH，plugin_install 核对安装/依赖，主代理独占真机验收。

## 3. 模型模块整体修复与以后添加模型

用户要求：对照本机布噜的添加、模型显示及默认模型逻辑，修复发现的全部问题；后续模型可持续添加。

已有：提供商连接/目录/显示偏好/全局默认/会话选择隔离；菜单零写入；删除恢复；保存失败回滚；账号目录全分页与身份缓存隔离；Responses/Chat 双协议；推理与视觉能力元数据；空闲连接自动刷新。已有 Chrome、HTTP、真机 ModelCheck 与 ModelRuntimeCheck 证据。

待最终复核：按 MODEL_MODULE_BULU_REVIEW_20261107.md 逐条核销，明确已实测与尚未实测的提供商/上游模型。不将单一免费模型成功推断成全部可用。负责人 model_config。

历史兼容协同修复：复杂文件任务切换模型后曾出现 foreign input item ID 被拒及 remote compact 的 `item_`/`fc` 前缀错误。用户会话「排查手机端浏览器能力限制」负责 projection/gateway/实际恢复入口，发现内核忽略 path、旧检查点恢复旧提供商配置两项隐藏问题，并改为按兼容副本真实 ID 分叉。其应用级 ModelRuntimeCheck 已通过 15 项（真实旧历史、三工具和最终回复、429 一次及资源释放）；真实云端压缩与压缩后反向迁移严格内核检查已有证据，最后的原对话只读云请求仍在验收。本组没有并行覆盖这些共享改动。证据见 artifacts/history-compat-20261108/。

## 4. 模型弹窗按提供商折叠

用户要求：保留前台按钮总体样式，弹窗分 OpenAI、DeepSeek、本机免费模型，点击展开该厂商模型，支持收起。

已有：折叠结构、当前项提示、隐藏模型过滤、按需创建节点；手机实际显示三组。切换持久化实测约 85–103ms，目录刷新不阻塞 API 选择，推理滑杆松手保存一次。截图/测试在 artifacts/acceptance-0.0.73/ 和 0.0.74/。

待完成：最终整合包上核验目录与档位、展示最终手机效果。负责人主代理。

## 5. 通用依赖缺失后的自动恢复

用户要求：pip 仅是例子；Python、npm、Java、Android 及其它环境缺失时，应先检查和补齐，再使用原工具完成目标，不应立即放弃或降级。

已有：当前手机恢复现有 docx/pptx 的普通 Python 导入；pip 25.1.1、venv、DOCX/PPTX 最小生成回读实测。新增 eva_dependencies 结构化原生工具与 dispatcher，支持 Python/npm/Java/Android/system，项目环境隔离、版本与入口验证、取消安全收尾。新机 core/development 清单补 pip。

真机后端已通过：隔离项目先出现 ModuleNotFoundError/ERR_MODULE_NOT_FOUND，自动安装 pyfiglet/is-number 后执行原 Python/ESM 脚本成功，脚本及保护文件 SHA 不变；Java 17 真实编译运行、Android aapt2 就绪。见 artifacts/acceptance-0.0.75/live-dependencies.txt。

真实代理链已通过：GPT-6.1 Terra 主动 ensure Python/npm，Python 进入项目 venv，npm 进入私有 prefix，使用返回命令运行原脚本成功，保护文件 SHA 不变；HOME 后完成并释放服务/锁，见 native-dependency-turn.json、native-dependency-after.json、native-dependency-released.json。会话级 pip venv 保护已通过本地 wheel 10 项，Python 参数别名与非空契约离线 18 项。原生先完成 29 项，随后参数错误提示新增标准示例及 invalid_request 分类，扩至 31 项待最后一轮执行。最终正式安装见第 7 节。

## 6. 网络、国内镜像、断点与后台保活

用户要求：原来源下载失败时改用国内镜像继续，不因网络问题立即放弃。

已有：pip 官方→TUNA→阿里，npm 官方→npmmirror，签名 APK 仓库回退；保留缓存/日志/逐源错误。固定 SHA 下载加入严格 Range 续传；哈希/范围错误不绕过校验。故障注入官方超时后，真机实际从 TUNA/npmmirror 安装并执行通过，见 live-mirrors-foreground.txt。

旧版曾观察到后台请求停滞。当前 FGS/唤醒锁已实现并通过真实服务 10 项；新模型依赖任务在 HOME 后安装并执行成功，完成后 foregroundService=false、活动唤醒锁为空。保活只覆盖实际任务/依赖事务，不改系统省电配置、不重发任务。正式 App 暂停 UI 轮询与原生后台执行是两回事，验收脚本仅临时 drain 读取事件，不常驻改变产品轮询策略。

新增核验：Android platform 36 r02、build-tools 35/36 三个腾讯官方镜像已完整下载，SHA 与源码固定值逐项一致，加入 Google 来源之后的回退。来源、字节和摘要见 artifacts/sdk-mirror-research-20261108/verified-archives.json。GitHub 原生 aarch64 工具包尚无已核实副本，继续官方重试与断点保留；不能据此声称所有资源均有国内镜像。

剩余边界：已完成官方故障注入后的真机国内安装，以及独立真实模型的后台安装，尚未把“故障注入+模型+HOME”合成同一次测试，也未从全空环境重装整套 Java/SDK。各证据分开保留，不合并冒称通过。负责人 plugin_install 与主代理。

## 7. 安装包、当前手机任务与最终交付

用户要求：安装编译包并完成真机验收，修复成果可查看。

当前：另一会话已保留数据安装 0.0.76 调试候选，模型核心 15 项回归通过；本组继续构建包含最新 npm 聚合修复的统一包，尚未最终正式安装。依赖/镜像/保活及自动学习仍按各节标记区分后端、原生和模型端到端证据。复杂文件预览原对话已有 DOCX/XLSX 实际生成，历史恢复的云端只读检查正在进行，尚不据此宣称八类交付全部验收。

待完成：稳定源码清单→构建/签名→必要原生与模型端到端检查→任务空闲时保留数据覆盖正式包→确认版本/调试关闭/历史与配置保留→交付截图与测试范围→安全清理。

清理规则：保留 SDK/JDK/ADB、签名、锁文件、正式 APK、用户资料、升级备份和仍需继续使用的环境。只删除核实属于本次且不再需要的临时内容，记录实际绝对路径和验证。其他会话正在写入的浏览器/预览等内容保留，编译兼容修复单独说明，不冒认其完整功能验收。

## 8. 当前 Excel 看板、Word 与通用预览体验

最终补充：本组已按0.0.77正式安装完成对应真机验收；范围、实际原文件SHA、UI/模型回执、未支持项与清理见[交付记录](RELEASE_0_0_77.md)。下文保留实施阶段记录。

用户新增：实际 Excel 看板无法预览；Word 内容过小、工具按钮占位多，所有预览需要更好的布局和全屏查看。

真机原始截图已记录。当前工作簿为 147258 字节、SHA 72d7e4f3b3a4ff6805a8d3f2819f6f5c2aceb86554ac264f6371fea3c246ba62，4 个工作表和 4 张图表。ExcelJS 未识别绘图 XML 的合法默认命名空间而触发 anchors 错误；Android 可再生成适配按 namespace URI 规范化内存副本，真实原文件与全部图表关系保留。真实浏览器验证 4 图/7 条数据序列与原数据一致，770 个缺缓存公式明确标记，不冒作零。

三个子智能体继续按用户最新要求推进：model_config负责Excel/PPT解析与原格式局部编辑工具，plugin_install负责原文件阅读Web组件与图像/图表位置，app_learning负责原生宿主、默认原文件入口、全屏和组件检查。用户明确否决自动转换/另存PDF，要求直接显示Word/Excel/PPT/Markdown原文件。默认入口改为DesktopDocumentPreview原文件，Web层确认真实DOM就绪。此前PDF脚本、17项离线契约及以下手机结果仅为可选转换/历史QA，不能作为当前原文件阅读完成。本轮新APK默认阅读、触摸和全屏/退出/生命周期仍待验收。

历史可选PDF转换的手机独立QA：原Excel由旧打印布局160页变为preview4页，3.38秒，源SHA不变；隐藏交错样例后过滤实际2页、可见标识存在、隐藏sentinel缺失、两个公式42、私有raw无残留。原Word实际8页，主代理已目视全部页面，3张源图均保留；不修改源文档美化，不承诺与Microsoft Office完全一致。准确证据和边界见 [阅读器记录](DESKTOP_READER_20261108.md) 与 [0.0.77待验收记录](RELEASE_0_0_77.md)，文件集中 `artifacts/preview-redesign-20261108/`。

直接Excel解析修复隐藏表过滤，并补图像/图表原锚点及像素尺寸供原位UI使用，隐藏引用依赖仍保留。770个缺缓存公式仍是未计算提示，不等于正确最终数值；当前没有现成公式引擎，另有12个可疑非法行引用需保留错误边界。PPT本轮补普通图表缓存和占位符布局/母版几何继承，真实复杂样例两图及标题位置在浏览器通过，源不变；复杂母版样式、组合、复合图表、SmartArt、复杂排版与动画仍有缺口。可选PDF验证不能核销原文件直接阅读、新APK默认入口或全部格式验收。原用户文件未被改写。

## 9. 办公组件安装后仍未就绪

最终补充：本组已按0.0.77正式安装完成对应真机验收；范围、实际原文件SHA、UI/模型回执、未支持项与清理见[交付记录](RELEASE_0_0_77.md)。下文保留实施阶段记录。

用户新增：办公组件似乎无法安装。实际页报“组件安装自检记录缺失，请重试”。该提示在安装进程退出 0 后、原生就绪核验失败时产生。Python office profile 成功路径仍会执行自检并写 distribution/office.json，没有发现“已装时漏写记录”的分支。

已由真机双视角证实：`office-host-evidence.json` 中 markerRead=true、record.ready=true，但 Android host isFile=false；同一入口在 `office-guest-evidence.json` 中正常存在并返回 LibreOffice 25.2.5.2，符号链接目标是guest绝对路径 `/usr/lib/libreoffice/program/soffice`。原因是宿主按自己的 `/usr` 跟随该链接，非Python漏写profile记录。

源码已加入限制在当前Alpine根内的guest符号链接解析，离线真实文件系统12项检查通过，真机 `ModularSetupCheck` 26项PASS（`native-modular.txt`）。保留既有办公环境和ready记录；不反复重装或伪造marker。新APK组件设置页、安装后状态展示及原任务续接UI仍待主代理最终验收。预览全屏检查11项为独立原生检查，不等同最终默认界面验收。

## 10. 原格式编辑与选区对话

最终补充：本组已按0.0.77正式安装完成对应真机验收；范围、实际原文件SHA、UI/模型回执、未支持项与清理见[交付记录](RELEASE_0_0_77.md)。下文保留实施阶段记录。

用户新增要求：直接编辑Word/Excel/PPT/Markdown原文件；选中具体内容后发起对话，让模型精确修改该位置。不能以转换、另存或普通聊天建议代替真实保存，也不能丢失原有图片、图表或格式。

源码已实现选区携带源SHA/locator交接当前对话：保留原草稿、不自动发送，显示引用chip；明确发送后把选区元数据加入模型上下文，成功才消费，失败保留。根代理维护 `PreviewSelectionRouting.java`、`preview-selection.js`、Shell早期路由和Node回归。原生直接替换与AI交接均在接入中；不能把源码和Node检查视作手机通过。

原格式后端 `eva-document-edit.py` 为纯stdlib，CLI `check|apply --request JSONfile`。请求包含workspace path、expectedSha256、真实kind、selectedText、replacement和locator。Word按源段落唯一文字匹配并跨run精确patch；PPT按真实slide关系及唯一段落/整shape多段文字匹配，不盲信DOM页、段落或shape序号。保留原XML命名空间、非目标格式及所有非目标ZIP payload原字节；Excel初期严格单cell，text默认按字面、number/formula必须显式类型，保留样式、图表、关系及未知cell子节点；MD按唯一源子串及可选上下文定位。

`check`仅预检；`apply`在锁内重验源SHA，建立 `.eva-edit-backups` 精确原件备份，同目录暂存、校验后原子replace并读回。歧义、stale、空文字选区、宏/签名/不支持ZIP、范围/合并从属格/数组公式等明确拒绝；普通失败原件不变。Excel依赖公式和图表缓存不重算，明确返回warnings。PPT不增原shape段落数，复杂跨段/显式换行等不支持时明确失败，不猜位置。

后端17项事务回归通过；真实Word/XLSX/PPT宿主副本各验证仅目标XML part改变、备份准确、其他entry不变、原样本SHA不变。证据：`artifacts/preview-redesign-20261108/document-edit-contract.log`、`document-edit-real-copies.json`（hostOnly）。待主代理在手机副本验收后端、原生替换、AI交接、成功刷新与失败保留，不操作用户原成品。不能据此宣称整个文档编辑器或所有Office格式/功能完整支持。
