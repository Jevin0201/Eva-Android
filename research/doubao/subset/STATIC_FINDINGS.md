# 豆包技能与连接器：局部静态证据

原包版本与设备身份由主调查记录负责。本报告只分析原包内 classes21.dex 与 classes22.dex 的局部派生分析包，不宣称已执行豆包或完成授权。原包 SHA-256 和逐成员来源见 provenance.json。派生包只含未修改 DEX，缺失所有其余 DEX、资源、Manifest、签名，不能安装，仅供有来源约束的 JADX 静态分析。没有将豆包代码或资源复制进 Eva 产品。

## 已读方法的事实

| 主题 | 静态观察 | REA Evidence / 文件 |
| --- | --- | --- |
| 技能选择 | TaskSkillPanelFragment.onViewCreated 安装列表点击回调，将选中 TaskSkill 放入 key_skill，通过 arg_request_key 的 FragmentResult 返回，再关闭面板；该回调没有直接运行任务 | ev_34a541320307a813dd01441bf3a9b45afbfd0ed3219bc28d683e78b4e14d37e0 / rea-skill-view.json |
| 技能加载 | k80 以 requestInProgress 防重复，提交 9 个占位条目，启动 loadRecommendSkills 协程；提供重试处理器 | ev_4955e6be12be6ad35a43fc0ee31bae5c4aa5d7c20d65d405792ec25db7abc308 / rea-skill-load.json |
| 连接器面板 | ConnectorFragment.onViewCreated 继承 RoundedBottomSheetDialogFragment，列表使用 LinearLayoutManager；头部关闭面板 | ev_c2eb39bd42b9b7bd56551abe7d6ae032a1750cdf6530efb9dae180b6582fa709 / rea-connector-view.json |
| 添加连接器 | 添加入口走配置路由，默认 Lynx popup，page_mode=discovery；默认参数包括底部弹出、顶部24dp圆角、遮罩、下拉关闭、need_login_strict_mode | 同上；只读取路由常量，未访问或执行 URL |
| 连接详情 | connect 动作走详情路由，默认 page_mode=detail_only、resource_type=connector，并用 resource_id/skill_type 填入具体连接器；不在此方法直接伪造连接成功 | ev_4994c18e853e0ccf60f6c2047494c0a750f22e07dd77d6558f92807ebb56d46d / rea-connector-action-a.json |
| 连接/启用分离 | 曝光状态分支明确产生 not_connected / on / off；e==1 且 f==1 才视为连接，然后 g 决定 on/off。字段 e/f 的业务名称未解析，不将其任意命名为某一授权字段 | ev_9c968393eaffadd3f2722088ddb252812d221f5e564d85b6b8c9e8bf44f3a020 / rea-connector-action-b.json |
| 防重复切换 | toggle 按 connector id 检查进行中 Map；变更才记 pending 目标状态，重绘，启动 setConnectorEnabled 协程 | ev_d5ae856f8e6bd490756f32c2d130f2da4622615f112f390ab57884521fb50969 / rea-connector-action-c.json |
| 切换反馈 | setConnectorEnabled 协程完成后移除 pending id；成功/失败都重新读取 repository 缓存并重绘，不把待处理状态永久当成成功；成功、失败有不同提示 | ev_d3b7583070b3e594d17b72b2ccb08340878042f2fa855e8ed99913f273f22fff / rea-connector-set.json |
| pending 展示 | m80 给进行中条目临时覆盖目标 enabled，并单独携带 pending 布尔值交给 adapter；即区分乐观展示和真实提交 | ev_6a7b2692585fbceb9b3d566431cb8e03974e60a34012f69cb2501d51e803d9a5 / rea-connector-render.json |
| 加载失败 | 初次无数据失败时隐藏列表、展示错误处理器、调整面板；已有内容场景不必清空列表；均显示失败提示 | ev_5678009d09c60a6553556cea35706d2ed67d4d8439ad92eaf9bb00c5609e38d6 / rea-connector-toggle.json（文件命名沿调查顺序，内容实际是 j80 失败回调） |

## 可借鉴到 Eva 的设计推论（不是豆包运行事实）

- 区分对话中的“选用技能”与设置中的“管理技能”，选择后返回输入区，由用户发送，不直接执行。
- 连接器列表同时表达未连接、已连接且启用、已连接但停用；MCP 保存、启用、授权、运行可用性也必须分开。
- 添加/详情采用单独页面或底部弹层；高级地址、stdio 参数与密钥管理不挤占日常选择路径。
- 列表首次加载显示占位与重试；已有列表刷新失败保留可用内容。
- 连接器切换设置 pending、防重复与失败回读；不能用视觉开关代替真实状态。

## 未知与边界

- 未解析/执行默认 Lynx 远程 bundle；不能据此声称完整授权页、发现页内容、权限文案或云端协议已还原。
- 未查看连接服务的真实授权网络请求、令牌和账号数据；未证明任何远程连接成功。
- 局部派生 APK 缺依赖，反编译类型推断可能有警告，方法中资源 ID 未映射成实际字符串。
- 全包此前耗时超限，不重复原样操作；使用 DEX type/class-def 表定位后仅分析局部类，不能宣称全包审计。
