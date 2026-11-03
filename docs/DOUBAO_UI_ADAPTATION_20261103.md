# 适合 Eva 的豆包设计借鉴 · 0.0.33-ui

## 保存点与研究对象

迁移前完整开发改动已保存到提交 `02bfa93`。本轮新增适配独立提交，未改桌面 Eva。

通过 REA 识别手机已安装的豆包 `com.larus.nova` 15.5.0 (15050040)。安装包实际 SHA-256：`87f0e93e15663f7040bdbfebff87ad7b7883ac5064dde6327549820a6bb40f69`。从手机提取 APK，仅在本项目 research/doubao 内分析。没有将豆包的代码、图片或品牌资源引入 Eva，也没有移植其云服务协议或授权。

## 取舍

| 豆包观察 / 静态事实 | 对 Eva 的价值 | 这次适配 |
| --- | --- | --- |
| 新对话大留白、能力入口靠近输入区 | 让开始任务更轻松 | 首页单一任务提示，手机控制/浏览器/文件/终端四个真实入口 |
| 侧栏能力入口在历史之前 | 不必先进入设置找能力 | 新建下方增加“技能与连接器”，保留项目树、历史、滑动删除 |
| 技能选择返回调用页，不直接执行 | 让用户知道这次任务选了什么 | 沿用 Eva 已有 references 协议；入口改为“选用能力”，空列表可直接管理与添加；选择不发送 |
| 连接器区分 not_connected/on/off | 避免“已启用=已连接”的误导 | 配置、授权、连接检查分开；默认显示“已启用·未检查连接”，未知响应显示未知 |
| 连接器 pending 与失败回读 | 防重复操作和假成功 | pending禁用、保存失败保留表单、完成后回读配置；旧页面响应隔离 |
| 添加与详情独立、底部弹层 | 减少初次配置的信息量 | 沿用已有底部弹层；连接器添加继续折叠，stdio JSON只在本地命令方式显示 |
| 对话/工作模式切换、推荐内容、使用人数 | Eva 现有代理已经统一处理任务；没有必要增加模式或运营内容 | 不迁移 |
| SaaS/CLI 连接目录与自动授权 | Eva 未提供同等服务集成，不能只复制卡片宣称可用 | 不迁移，不制造虚假连接器 |

## 证据与边界

- 设备包身份：`ev_2ad4c838e56e90fd98177c5ae26d6a8184556cfa3f1ca168a4bb8073aaa6d380`。
- APK 提取及校验：`ev_f3a6d3d18d176866a905db18e1e3cba5d0b657585b8d2afef32d6987dc8b6829`。
- 新对话真机截图：完整截图记录见本地 `research/doubao/rea-device-evidence.json`，其中 doubaoNewChat 保存真实 REA Evidence ID 与截图哈希。以原始记录为准。
- 技能选择、连接器状态与 pending 的逐方法证据见 `research/doubao/subset/STATIC_FINDINGS.md`；来源链见同目录 `provenance.json`。
- 豆包全包 JADX 搜索超时，未重复原样查询。通过原 DEX type/class-def 表定位 classes21.dex/classes22.dex，再生成无资源与依赖的单 DEX 派生分析包，局部 REA 分析成功。派生包从未安装或执行。
- 豆包截图显示当前账号下“插件”列表、连接详情、侧栏及新对话。技能 Tab 点击在本轮设备操作中未切换，技能选择依据来自局部静态方法，不能称为真机完成技能任务。
- 未授权豆包连接器、未读取令牌、未发送对话。未研究远程 Lynx 授权页面内容或实现。

## Eva 验证

浏览器 fixture 验证只覆盖界面、交互和协议参数，不等于云模型、外部授权或手机控制任务成功。最终测试、真机截图和安装结果在完成后追加。本轮是 UI 开发版，不是完整手机代理最终交付。


## 本轮已完成验证

- 17 套现有/新增回归通过：sidebar-ui、project-management、chat-drafts、desktop-model-control、chat-swipe、extension-lists、composer-references、plugin-manager、skill-manager、settings-ui、connector-ux、mcp-settings、model-panels、task-controls、keyboard-ui、chat-send-delete、stream-persistence。
- 新增能力与首页视图：320×740、390×844、844×390，浅/深色，首页/插件/技能/连接器，共 24 组检查，无页面脚本错误或外层横向溢出；保留工具入口 action。证据 `artifacts/capability-experience/result.json`。
- 另沿用设置 42 组布局检查通过。横向快捷入口允许有意的水平滚动。
- 新增“管理与添加”入口回归：草稿保留、只切换管理页、不发送任务。
- APK 构建、签名校验通过，版本 0.0.33-ui；开发编译仍有既有 Java 8/deprecated API 警告。
- 已覆盖安装到连接手机，ADB 返回 Success。实际设置页显示正常。随后手机前台切回豆包，故未把该画面算作 Eva 首页/侧栏验收；后续真机核对需避免并行操作手机。
- 连接器已配置项在 fixture 中验证；未替用户新增外部账号、未宣称外部服务已授权连通。

实际 APK：outputs/eva-android-0.0.33-ui.apk。安装包不纳入 Git；源码、验证脚本、设计取舍与来源元数据单独保存。
