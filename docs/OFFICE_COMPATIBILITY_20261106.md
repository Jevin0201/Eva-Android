# Office 转换与公式重算增量

本批沿用手机已有 LibreOffice 与 Poppler 的实际排版引擎。电脑端 `src/main/office-preview.js` 与 worker 的只读内容模型已审查，该模型仍以 XLSX 缓存值和 PPTX 文本位图为边界。来源与哈希见 OFFICE_COMPATIBILITY_SOURCE_20261106.json。

`eva-render.py` 新增 `convert` 和 `recalculate`。所有输入输出都限制在工作区，输出目录独占创建，保留原稿。转换格式按文档族限制，支持 DOCX/ODT、XLSX/ODS、PPTX/ODP 以及 PDF。Calc 可重新计算并另存新 XLSX，后续可用 openpyxl 的 data_only 读取真实缓存值。现有 Python 库可对新副本进行程序化编辑，再调用转换与排版路径。

```sh
python3 /root/.eva-office/eva-render.py recalculate --input /root/eva-workspace/book.xlsx --output-dir /root/eva-workspace/new-calculated
python3 /root/.eva-office/eva-render.py convert --format odt --input /root/eva-workspace/document.docx --output-dir /root/eva-workspace/new-odt
python3 /root/.eva-office/eva-render.py render --input /root/eva-workspace/document.docx --output-dir /root/eva-workspace/new-pages
```

引擎使用每次独立 profile，设置宏安全级别，拒绝 VBA 与外部工作簿链接。输入限制为 64 MiB，ZIP 展开限制为 128 MiB / 10000 项。失败仍保留本次输出目录，重试应使用新目录。

## 实测证据

`tools/test-office-complex.py` 构造真实 DOCX、XLSX、PPTX，并调用实际 LibreOffice + Poppler。主机真实渲染与可编辑往返通过，报告位于 `artifacts/office-complex/run-asqbbuhi/acceptance.json`。主机 LibreOfficeDev 26.8 的 CJK 字形缺失，已在目视验收中发现并记录。

手机 M332BF / ARM64 / LibreOffice 25.2.5.2 使用同一批源文件进行真实渲染，三格式各输出两页。拉回的三种首页 PNG 已逐张查看，中文、合并表格及原生图表可见。SUM、SUMIF、IFERROR、VLOOKUP、跨表引用结果为 250、170、99、80、500。输入数值改为 150 后另存并重算，SUM 结果为 280。DOCX→ODT→DOCX、PPTX→ODP→PPTX 的可编辑转换另行检查。

手机记录与首页截图位于 `artifacts/office-complex/device/`。运行脚本在 `artifacts/office-complex/device-request.py` 与 `device-roundtrip.py`，通过 `tools/runtime-device.py` 执行。测试使用独占目录 `/root/eva-workspace/.eva-office-upgrade-check-20261106`，保留源文件与结果供手机继续验收。没有重启应用或安装 APK。

## 兼容边界

这些样例覆盖页眉页码、显式分页、表格合并、数字格式、公式缓存、跨表引用、图表和演示备注。字体替换仍可能改变分页，微软专有函数、复杂公式、SmartArt、嵌入 OLE、修订、复杂域和放映动画均需各自样例验收。PDF 预览验证静态排版。当前提供程序化编辑和可编辑格式另存，手机内原生富文本/表格拖拽编辑器仍待实现。

## 安全清理

已删除本批首次主机测试的重复运行目录和确认无用的独立 LibreOffice profile 缓存。保留最新源文件、转换输出、PDF/PNG、验收报告及手机测试结果供复核。没有新增外部依赖下载。
