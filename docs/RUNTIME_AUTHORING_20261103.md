# 0.0.37 · 本地制作与可扩展运行环境

## 本轮交付

把制作链分成技能与资源、运行依赖、可编辑产物、实际渲染、视觉验收五层。Android 仍执行本地代理，模型仍使用云端；没有修改桌面 Eva、桌面用户数据或正式安装。

- 本地 eva-ppt 技能与设计参考、三套基础主题、封面／章节／对比卡片／流程／表格／图表／图片版式、讲师备注，固定部署到手机自己的技能目录。高级版式仍可直接使用 Python 库，不限制在旧 title/body JSON 中。
- 本地 eva-capabilities 技能与安装入口：办公渲染、HTML 渲染、常用命令、编译开发、媒体软件的配置，以及其他标准 Alpine 包。签名仓库、依赖模拟、许可证记录、空间与硬链接预检、事务记录与安装后验证相互区分。
- LibreOffice、Poppler 与 Linux Chromium 后端；PPTX、DOCX、XLSX、PDF、HTML 可输出实际 PDF 和逐页 PNG。浏览器代理任务仍使用 Eva 内置浏览器，Linux Chromium 只承担制品渲染。
- HTML 静态导出冻结动画，避免截到透明的入场帧；记录页数、可编辑对象、越界对象和疑似空白页。统计检查不会替代真实看图，静态页面也不能验证动画播放。
- DeepSeek Flash 的图像能力恢复。既有 deepseek-catalog.json 本来声明 text/image，但 KernelModelCatalog 曾强制覆盖成 text 并禁用 original detail。现保留官方模型清单的能力字段；不把不支持图像的其他模型随意改成视觉模型。
- 原生办公页增加渲染检查、安装修复、模板渲染验收、运行兼容检查。已注册的实际 PPT 技能与原有能力入口合并，避免重复卡片／标题。

## 已定位并解决的故障

1. 私有目录普通写入、符号链接和 chmod 正常，硬链接返回 EACCES。启用已有 PRoot 的 --link2symlink 后，硬链接建立、源名称删除后仍可读、tzdata 修复安装均通过。没有关闭 SELinux，也没有把整个文件系统改为 777。
2. Android 拒绝读取 /proc/version，LibreOffice 启动脚本因此误报 /proc 未挂载。仅将依据实际内核版本生成的私有兼容文件映射到 guest /proc/version，不改变 Android 的真实 /proc。
3. LibreOffice 另有 UNO 配置异常。LibreOfficeKit 给出 xcd unresolved dependencies，检查显示 librelogo.xcd 必须依赖 writer，但只安装了 common/impress。补齐 Writer／Calc／Draw 与 Poppler 后启动、PDF 转换及页面导出正常。
4. 原生资产部署的路径检查需要先规范 Android 数据目录的合法别名；在验收中发现并修正，继续拒绝真正的链接或越界目标。
5. DeepSeek 端到端验收暴露图片工具未提供，导致模型用 OCR／字符画替代看图。按当前官方 Vision 和 Codex 集成文档修正硬编码能力覆盖；技能要求如实区分视觉检查与 OCR。

统一 LinuxRuntime 已接入内核进程、终端、办公、插件作者进程、Git、OCR 和运行环境验证入口。临时手工命令不再是唯一能用修正参数的路径。技能部署后会刷新本地技能发现；保留同名非托管用户技能。

## 验证范围

- 原生 RuntimeAuthoringCheck：统一启动参数幂等、真实硬链接、四个渲染后端、四页可编辑模板（流程、表格、图表、讲师备注）与全部页面渲染、API-only 内核发现本地制作技能、DeepSeek 图像元数据保持。
- 真机独立实际文件：14 页既有 PPT 转 PDF 并导出 14 张图；既有 HTML 完整导出 12 页，原来淡到几乎空白的第 6 页恢复静态可见；原稿没有覆盖。
- Word、Excel、PDF 各一份生成、回读、渲染，PDF 文本检查通过。
- 统一安装入口实际安装 zip，并安装、执行 rg／GNU find／jq 等常用命令。没有预装所有开发或媒体包。安装器不把包安装成功直接标为能力验收成功。
- 前端模型切换、信息流排序、技能分批读取、桌面插件页、内置 PPT 去重回归通过。
- DeepSeek 真机模型端到端：读取本地技能，14 次执行、2 次真实看图调用，完成两页原生可编辑 PPT、讲师备注与逐页渲染。人工检查两页文字和流程卡片清晰，无对象越界或疑似空白页。这是制作链路验收，不是长篇课程教学质量验收。
- 最终 0.0.37 APK 覆盖安装成功，原生 RuntimeAuthoringCheck 再次通过。

## 使用

入口：设置 → 办公文档 → 检查渲染引擎／安装或修复渲染引擎／验证模板与逐页渲染。

模型可读取本地 eva-ppt 与 eva-capabilities 技能。常用命令：

```text
python3 /root/.eva-runtime/eva-capabilities.py status
python3 /root/.eva-runtime/eva-capabilities.py install --profile office-render
python3 /root/.eva-runtime/eva-capabilities.py install --profile utilities
python3 /root/.eva-runtime/eva-capabilities.py install --apk 包名
python3 /root/.eva-office/eva-render.py status
python3 /root/.eva-office/eva-presentations.py --input /root/eva-workspace/content.json --output /root/eva-workspace/new.pptx
python3 /root/.eva-office/eva-render.py render --input /root/eva-workspace/new.pptx --output-dir /root/eva-workspace/new-preview --expect-pages 4 --require-editable
```

Python 和 Node 的扩展按能力使用独立 venv／npm prefix。系统安装入口只验证 Alpine 3.22 ARM64，不宣称所有桌面二进制、内核模块、系统服务或 GPU 软件都能在 Android 用户空间运行。任意 HTML/SVG 动画仍不能自动无损转换成可编辑 PPT 对象动画，不能以页面淡入替代该承诺。FDE 课程的教学内容与成品重做不属于本轮环境修复的验收结果。

来源与实际包许可证记录：migration/runtime-authoring。软件包安装在手机私有 Linux 环境，未把 LibreOffice、Chromium 等新增为 APK 内嵌二进制；custom 许可证保留原标记，不重新归为宽松许可。

参考：
- https://github.com/termux/proot/blob/master/src/extension/link2symlink/link2symlink.c
- https://github.com/termux/proot/issues/175
- https://docs.libreoffice.org/vcl/html/salplug_8cxx_source.html
- https://api-docs.deepseek.com/guides/vision/
- https://api-docs.deepseek.com/quick_start/agent_integrations/codex/
