# 2026-11-03 持续流式输出的保存修复

基于 GitHub main / 98cffe9，未重复实施 0.0.28–0.0.31 已有手机控制与信息流迁移。

## 问题与修改
原 scheduleKernelSave 在每个事件到来时重置 500ms 定时器。持续输出的事件间隔小于 500ms 时，可能直到整轮结束都没有保存快照。

现在第一次事件安排保存，后续事件合并至该次快照，不延后定时器。保存后下一批可再次安排；没有新事件时不产生空闲写入。JS 时间片繁忙或页面被系统冻结时，500ms 不是实时保证。

pagehide/visibilitychange 及原生 ShellActivity.onPause 提交待保存快照。saveKernel 同步保存取消定时保存并清除标志，避免重复写入。保留现有 native saveLater 异步写入与错误提示。仅修复 UI 状态保存；不宣称强制杀进程时最后一个事件必不丢失，内核历史仍是恢复来源。

## 验证
- test-stream-persistence.cjs：连续 50ms 更新仍产生多次递增检查点；pagehide 保存最后状态；同步保存不留下重复写入；写入失败可提示并恢复。
- test-chat-send-delete、test-chat-scroll、test-global-events、test-eva-flow-projection 通过。
- 新电脑缺少 Git 忽略的语音原生库，使用 download-voice.cjs 校验全部四个固定依赖，再以 prepare-voice.py 准备；未改变依赖版本。
- 本轮不执行微信联系人任务，不访问用户聊天或发送消息。真机后台/断电恢复尚待单独验收。
