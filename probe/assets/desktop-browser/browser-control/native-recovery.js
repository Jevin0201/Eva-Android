'use strict';

// A handoff to the current clone thread's own MCP runtime, never an external agent.
function nativeRecovery(actor, owner, runtimeAvailable, reason, options = {}) {
  const available = !!(runtimeAvailable && (actor.threadId || actor.sessionId) && actor.cuaEnabled);
  const handle = owner.getNativeWindowHandle();
  const appPath = typeof options.appPath === 'string' && require('node:path').isAbsolute(options.appPath) && /\.app$/i.test(options.appPath) ? options.appPath : null;
  return {
    requiresComputerUse: true,
    available,
    recovered: false,
    reason,
    threadId: actor.threadId || null,
    sessionId: actor.sessionId || null,
    target: {
      executable: process.execPath,
      platform: process.platform,
      pid: process.pid,
      ...(process.platform === "darwin" && appPath ? { appPath } : {}),
      ...(process.platform === "darwin" ? { bundleId: "com.jevin.eva.desktop" } : {}),
      title: owner.getTitle(),
      nativeWindowHandle: (handle.length >= 8 ? handle.readBigUInt64LE(0) : handle.readUInt32LE(0)).toString(),
    },
    next: available
      ? process.platform === 'darwin'
        ? appPath
          ? '调用当前会话的 cua_repl.js：先 await cua.getApp(' + JSON.stringify(appPath) + ') 绑定实际运行的 Eva，读取最新状态和截图，核对上述应用路径及窗口标题后，根据原任务处理阻塞弹窗。多个窗口时不得默认选择第一个；目标不唯一时停止并报告。'
          : '调用当前会话的 cua_repl.js：先 await cua.getState() 查看当前应用，再根据上述可执行文件、进程及窗口标题确认唯一 Eva 目标的完整 .app 路径，随后用 cua.getApp(完整应用路径) 绑定。不得只凭 bundle ID 或默认选择第一个窗口；目标不唯一时停止并报告。'
        : '调用当前会话的 cua_repl.js：Windows 上先 await cua.listWindows()，唯一匹配上述应用进程与窗口；再 await cua.getApp({windowId: 实际窗口ID})，不能按名称调用 getApp。读取最新状态和截图后，根据原任务处理阻塞弹窗。'
      : '当前会话尚未连接原生窗口工具，请重新打开此聊天以加载当前会话的 computer use。',
    verification: '操作后再次读取原生窗口，确认目标弹窗消失，再调用 browser_snapshot 确认网页恢复。工具点击成功不等于弹窗已关闭。最多尝试一次恢复；失败时报告原因。',
    restrictions: '不得操作其他应用窗口，不得自动确认登录、付款、删除或系统授权。上传优先调用 browser_upload；只有浏览器无法接管的系统选择框才使用原生窗口工具。',
  };
}

module.exports = { nativeRecovery };
