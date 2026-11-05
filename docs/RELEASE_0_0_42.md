# 0.0.42 · 附件与模型切换

使用原签名保留数据覆盖安装，不卸载原Eva。覆盖安装前完整状态备份在 `artifacts/upgrade-backups/1793853303805-before-install.json`（29会话、超过2M字符）。

## 附件

优先读取并复用Eva桌面附件解析、renderUserMessage与composer附件结构。输入框左上方显示图片缩略图，其他文件显示图标和文件名，独立移除；历史、发送中、引导中的附件独立于文字气泡。已知旧附件JSON后缀严格结构化，不删除任意正文。复用原生受限图片读取及文件预览。来源哈希见 `migration/desktop-user-attachments/provenance.json`。

完整页面测试包含真实原生选择回调模拟、添加/移除/取消/失败、图片-only、旧正文保留、CSS及原生白名单。用户同一张原图在干净OpenAI会话真机识别完成，确认上传/图片字节本身可用。

## 模型切换

确认旧会话由DeepSeek切到OpenAI后继承了异构reasoning记录。原始响应的reasoning.content包含reasoning_text，目标服务拒绝content长度；同图新会话成功。依据桌面isolated-server的history_base遍历/路径/双边界保护，Android新增提供商工作上下文投影：原始历史只读；有活动异构reasoning时生成自包含工作副本，保留用户消息、助手回答、工具payload、图片及文件，目标模型在新fork续接。

提供商私有reasoning不转发给不兼容提供商，原记录仍可查阅。支持识别已经受旧父历史影响的同提供商子fork。最新压缩checkpoint已清理异构活动上下文时不重复迁移。同提供商正常路径只读元数据，不全量改写。副本使用标准sessions路径，保留父依赖供重启解析；审计只存哈希与计数。源码方案不等于修改官方Rust二进制。

纯文件隔离测试22项通过（大图片、精确父前缀、checkpoint、循环、缺失依赖与源文件未变）。真机DeepSeek→OpenAI Terra→DeepSeek→OpenAI Sol四回合全部completed，测试标记保留，跨模型继续识别同一张用户图片，未再出现400；一次转换实测825/3643/1783ms（不同阶段，不代表通用延迟保证）。独立新内核进程在0.16秒读回4个完成回合，验证工作副本父依赖可恢复。实际三份原始rollout SHA256均保持不变。报告位于artifacts/diagnosis-20261105/v42-provider-roundtrip-real.json、v42-provider-cold-result.json、v42-original-hash-check.json。原生图片缩略路径对同一张2048×2048上传图解码成功。

## 保留的上一版修复

长历史摘要分页、条目按需加载、在途事件合并、发送恢复与独立停止、SQLite分块完整保存、交付列表及桌面压缩状态机。版本41已在真机完成压缩开始/完成及压缩后测试标记保留。自动压缩上限场景未做长任务压力验收。
