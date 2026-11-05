# 定时任务 Android 宿主

电脑原源码位于 probe/assets/scheduled-task-core，SOURCE.json 固定来源与哈希。RRULE、Jitter、定义 TOML、运行缓存、到期推进、Cron 原 dispatcher/turn 状态均复用原文件。native-scheduled-cron.js 仅包裹原 desktop-scheduled-cron.js，以 AsyncLocalStorage 将当前 automation ID 传给跨进程桥。

Android ScheduledTaskHost 在已有私有 Linux Node 运行 android-daemon.cjs。输入输出是逐行 JSON。Node 向 Java 发 kernel 请求，Java 调 KernelHost.scheduledRequest，结果回送 Node。任务定义不保存提供商密钥。模型/provider/权限绑定另存原子 JSON，运行时传入只读、on-request、user 档位。默认只提供新聊天 Cron，同一会话 heartbeat 核心已保留，产品入口尚不开放。

ScheduledTaskActivity 提供真实创建/编辑/暂停/删除/历史/明确立即运行入口。保存开启用户可见前台服务。管理读取保持被动，不启用计时器。服务被停止时不再执行计时，保留定义。只对 enabled 用户选择恢复后台服务。Android 可能限制后台/开机前台启动，系统失败写入错误，下次页面可见。此实现不保证息屏与省电模式下精确准点，未执行真实设备后台验收。

防重复依赖原 store.markRun 在派发前落盘、原 cronActive、Node 单实例锁、同进程命令串行。重启以原 invalidate 将运行记录标中断，不重发旧请求。再次创建同一任务回合前若有中断记录，先查询最后对应内核线程，仍 active 或状态无法确认则拒绝创建新任务。运行中禁止改模型/任务和删除定义。

接线需求由主智能体执行。

- Manifest 注册 ScheduledTaskActivity、ScheduledTaskService、ScheduledTaskReceiver。前台服务使用可持续的合法 Android 服务类型，Receiver 处理 BOOT_COMPLETED 与 MY_PACKAGE_REPLACED。
- 应用启动调 ScheduledTaskService.restore(context)，仅恢复 enabled。
- 设置导航 scheduled-tasks 打开 ScheduledTaskActivity。
- 原生内核通知传入 ScheduledTaskHost.get(context).observe(method,params)。普通与 API 内核通知合并处转发一次，避免重复。
- KernelHost.scheduledRequest(Context,String,JSONObject,JSONObject) 适配受控 RPC。固定任务模型和只读档位，不能经普通 applyPermissions 把只读提升到可写。method 白名单和模型绑定验证在 KernelHost 实现。
- 构建入口加入新增四个 Java 类，所有调度资产打入APK。

测试使用 tmp 下独立 fixture，未创建用户任务，未调用在线模型，未安装 APK。test-scheduled-task-daemon.cjs 验证 CRUD、绑定、模拟内核 thread/turn 路径、并发阻断、重启中断且不重放。test-scheduled-task-due.cjs 推进原 Clock 到 nextRunAt，验证原定时器到时派发及重复 tick 防护。fixture 最终核实路径后删除。Java 编译、原生接线、真机后台与开机恢复仍需主智能体验收。


补充验收

- KernelHost.scheduledRequest 与单次 emit/observe 接线已完成。所有带 threadId 的请求都验证已持久记录的任务路由，写请求核对 automation/provider/model 拥有者。thread/start 与 turn/start 均选择绑定提供商，使用原 ready/process 缓存，并在提供商配置变更时拒绝继续使用陈旧进程凭据。
- 创建 UI 提供每天、每周、间隔小时及高级规则选项，模型下拉来自已保存账号/API配置。历史包含打开任务对话入口，需主宿主通过 scheduledThreadId 只读导入。审批/失败通知也携带此入口。
- AlarmManager.setAndAllowWhileIdle(RTC_WAKEUP) 根据原 nextRunAt 唤醒，Receiver触发原定时回调；CRUD重排，暂停取消。IN_PROGRESS期间持有非引用计数且每次最多2分钟的WakeLock，健康检查每60秒续期，结束或服务销毁释放。Android仍可能杀死进程或延后inexact闹钟，需要真机后台与开机验收。
- 全项目Java源码编译通过，只有既有弃用警告。独立daemon、到时执行和原源码/Android宿主合同三项测试通过。仅模拟内核，不调用在线模型、不创建用户未来任务、不安装APK。
- 临时tmp/scheduled-compile中全部确认为本轮javac产生的.class，验证后清理。fixture目录均由测试finally清理，保留源码、测试及来源文件供后续集成。

并发与时区复核

- ScheduledTaskHost 的每条 Node 输出及原生 RPC 都绑定 originChild，旧进程排队请求不派发，已派发的旧请求返回时不写入新进程。真实 Host 的注入 transport JVM fixture 验证新旧进程复用同 ID 时，旧迟到回复不能完成新 pending，也不能让旧 reader 清掉新请求。
- 每个原 Cron 上下文在第一次内核请求前 structuredClone 固定绑定，已有 thread Map 的绑定优先且校验 automationId。定义在 RPC 等待期间被编辑，也只影响下一次运行。taskName 一同快照并写入线程路由。
- ProcessBuilder 明确传 Android TimeZone ID。Node status 返回 environmentTimezone、Intl resolvedTimezone 和实际 offsetMinutes。Service 刷新及 TIMEZONE_CHANGED 接收器更新 Node 进程 TZ，并调用原 nextWithJitter/postpone 重算未来时间，不重新派发旧回合。原生 Check 同时核对环境 ID 与当前偏移，避免 IANA 别名造成错误结论。
- 新增绑定等待竞争、真实 Host 代际、时区切换测试，均使用独立 fixture，无用户任务。generation runner 的所有临时 class 由 finally 核实工作区目录后清理。
