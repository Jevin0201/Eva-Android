---
name: eva-ppt
description: 在 Eva 手机上制作、读取、修改和验收可编辑 PowerPoint、PPTX 与 HTML 演示文稿；需要课程设计、模板、图表、图解、讲师备注或逐页渲染时使用，不需要 OpenAI 登录。
---
# Eva Android managed skill · 演示文稿

先读取 references/design.md。不要把“创建文件成功”当作完成了视觉设计。

1. 读取用户要求、原稿和受众，确定课程目标、时长、案例、练习、证据及交付格式。长课需要教学展开、活动安排和讲师备注，不能用几页摘要冒充完整课程。
2. 读取本地依赖状态：`python3 /root/.eva-office/eva-render.py status`。缺依赖时使用本地能力安装入口，避免要求用户登录账号才能使用已安装工具。
3. 可编辑 PPT 优先采用原生文本、形状、图表和表格。参考模板与结构：`references/template-example.json`。生成：
   `python3 /root/.eva-office/eva-presentations.py --input /root/eva-workspace/content.json --output /root/eva-workspace/new-deck.pptx`
4. 复杂版式可以编写自有 Python 脚本，使用 `PYTHONPATH=/root/.eva-office/lib python3 script.py`。不要被基础 JSON 的 title/body 布局限制；python-pptx 可以构建真正可编辑对象、图表、表格、母版和讲师备注。
5. 必须渲染全部页面：`python3 /root/.eva-office/eva-render.py render --input /root/eva-workspace/new-deck.pptx --output-dir /root/eva-workspace/new-preview --expect-pages 页数 --require-editable`。目录必须是新目录。
6. 逐页查看实际 PNG，检查文字溢出、字号、对齐、空白、图表标签、中文字体与知识表达。阅读 render-report.json，修复所有意外空白页。结构检查不替代看图。若当前模型不支持图像输入，只能如实报告 OCR、像素和结构检查；不能把 OCR 或 ASCII 预览称为目视验收，也不要为此反复寻找终端图片工具。此时应将 PNG 交给支持图像输入的已配置模型或用户查看。
7. 用户明确需要 HTML/SVG 动画时可以交付 HTML。HTML 可通过同一 render 入口生成静态 PDF/PNG；这不会保留播放动画。整页截图放进 PPT 会失去文字编辑能力，不能把它作为可编辑 PPT 交付。PPT 页面淡入与 PPT 对象动画也要明确区分，不宣称任意 SVG/JS 动画已经无损移植。
8. 保留原文件，另存输出。交付实际文件链接和验收范围。

系统为 Alpine 3.22 ARM64，系统软件用 apk，不使用 apt-get。库位于 /root/.eva-office/lib。安装与能力检查见 eva-capabilities 技能。
