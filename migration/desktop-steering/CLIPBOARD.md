# Android 剪贴板宿主适配

`clipboard-host.js` 是用户消息复制的 Android 宿主绑定：取原组件的 `text/plain`，交给 `EvaHost.copyText`，仅明确成功时返回 true；失败显示提示并保留原组件未复制状态。原组件继续管理忙碌状态和 1500 ms 对号反馈。

`rpc-7528198897e2.js` 来自已授权桌面来源 `Eva-Source/src/renderer/native-steering/rpc-7528198897e2.js`，原文保留。Markdown 代码复制通过动态导入该模块获得已注入的 `services.clipboard`。此前 Android 漏打包此模块，不能仅以静态 clipboard 服务注册认定代码复制可用。

运行 `node tools/build-native-clipboard.cjs`，仅更新已固定 bundle 中 `src/renderer/native-steering/adapter.jsx` 的消息复制回调和此惰性服务模块。生成器校验唯一边界及原始回调，支持幂等重跑，不重建或替换 vendor 算法与既有 Android 适配。

完整桌面构建入口为 `Eva-Source/tools/build-native-steering.cjs`；Android 尚无完整同源复建脚本，本次局部生成器不声称替代完整构建链。不得在桌面项目中修改 Android 功能或用户数据。
