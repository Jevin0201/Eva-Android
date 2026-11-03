# 手机办公文档运行环境

2026-11-03 增量。状态：依赖安装与四种格式生成/回读已真机实测；完整 Office 排版、公式计算及后台生命周期未完成。

## 产品入口和实现

设置 → 办公文档：检查环境、安装/修复依赖、生成四种验收样例、打开工作区。`OfficeActivity` 调用独立 `OfficeRuntime`，在已有手机 Alpine/PRoot 环境中执行内置 `office/eva-office.py`。首次启动部署脚本；初始化 Alpine 本身仍是独立未完成项。

桌面代码依据（只读）：`integrations/eva-essentials/office.cjs` 的 create word/excel/ppt/pdf、JSON 输入和 inspect 约定。Android 新实现采用 Python 库适配 ARM64，不依赖 Electron、桌面 Node 包或桌面凭据。没有修改桌面源码。

命令（也由模型线程指令说明）：

```sh
python3 /root/eva-office.py status
python3 /root/eva-office.py schema
python3 /root/eva-office.py create word --input /root/eva-workspace/content.json --output /root/eva-workspace/new.docx
python3 /root/eva-office.py inspect --input /root/eva-workspace/new.docx
python3 /root/eva-office.py selftest
```

`schema` 返回四种 JSON 内容示例；`create` 还支持 excel、ppt、pdf。模型先检查环境，不应把依赖未安装解释为文档格式不支持。用户可在手机内安装，ADB 只是开发验收入口。

## 安装与来源

- 系统依赖使用 Alpine 3.22 签名仓库，不使用 `--allow-untrusted`，不修改全局 `/etc/apk/repositories`。当前手机默认 CDN 出现 TLS EOF，采用 Alpine 官方镜像列表中的清华 TUNA HTTPS 镜像；apk 签名验证不变。
- python-docx 1.2.0、python-pptx 1.0.2 下载官方 PyPI wheel，官方 CDN 失败后使用 TUNA PyPI 镜像；两者均使用预先核对的固定 SHA256。只下载 wheel，不运行第三方构建脚本，不克隆 Git 子模块。
- 私有库放 `/root/.eva-office/lib`。所有 wheel 下载和校验完成后才替换自己的私有库，旧库保留到 `.previous`；安装后检查失败则恢复旧库。失败或取消不删除已经安装的系统依赖。依赖完整性检查来自真实 import 和中文字体存在性。
- 安装持有文件锁。取消在包管理事务结束后生效，再阻止后续下载/替换，不在任意时点截断 apk。网络与 apk 调用有超时，错误可重试。系统回收恢复只保证再次检查与重试，尚不声称后台连续安装。
- `/root/.eva-office/installed.json` 保存 wheel URL/哈希、安装时间、apk 版本清单、模块版本。此清单记录实际安装版本，系统仓库依赖不是完整可复现锁文件。

来源及许可（2026-11-03 已检查官方元数据与手机 apk metadata）：

| 依赖 | 实测版本 | 许可 | 上游/包源 |
| --- | --- | --- | --- |
| python-docx | 1.2.0 | MIT | https://pypi.org/pypi/python-docx/1.2.0/json |
| python-pptx | 1.0.2 | MIT | https://pypi.org/pypi/python-pptx/1.0.2/json |
| openpyxl | 3.1.5 | MIT | https://pkgs.alpinelinux.org/package/v3.22/community/aarch64/py3-openpyxl |
| ReportLab | 3.6.13 | BSD-3-Clause | https://pkgs.alpinelinux.org/package/v3.22/community/aarch64/py3-reportlab |
| pypdf | 5.3.1 | BSD-3-Clause | https://pkgs.alpinelinux.org/package/v3.22/community/aarch64/py3-pypdf |
| lxml | 5.3.1 | BSD-3-Clause AND ZPL-2.0 AND ElementTree | https://pkgs.alpinelinux.org/package/v3.22/main/aarch64/py3-lxml |
| Pillow | 11.2.1 | PIL license | https://pkgs.alpinelinux.org/package/v3.22/community/aarch64/py3-pillow |
| typing-extensions | 4.13.2 | Python-2.0 | Alpine v3.22 main |
| XlsxWriter | 3.2.2 | BSD-2-Clause | Alpine v3.22 community |
| 文泉驿正黑 | 0.9.45-r4 | GPL-2.0（Alpine 元数据） | https://pkgs.alpinelinux.org/package/v3.22/community/aarch64/font-wqy-zenhei |

镜像注册依据：https://mirrors.alpinelinux.org/ 。Alpine 上游构建脚本/对应源包由包详情页 Git repository / commit 链接追溯。未将这些二进制依赖打入本 APK；首次使用由用户在手机下载，后续若制作离线发行包，须附完整许可证、适用字体例外条款及 GPL/LGPL 对应源代码提供安排。wheel 自带许可证保留在 `.dist-info` 目录。

固定 wheel 哈希：

```
python_docx-1.2.0-py3-none-any.whl
3fd478f3250fbbbfd3b94fe1e985955737c145627498896a8a6bf81f4baf66c7
python_pptx-1.0.2-py3-none-any.whl
160838e0b8565a8b1f67947675886e9fea18aa5e795db7ae531606d68e785cba
```

## 文件边界

- 输入/输出必须在 `/root/eva-workspace` 规范化路径内；拒绝导致越界的 `..` 与指向外部的符号链接。
- 输出独占创建，不覆盖同名原稿；失败清理自己创建的半成品。Android SELinux/PRoot 实测拒绝 `link(2)`，故未采用硬链接发布策略。
- 输入最大 32 MiB；内容 JSON 最大 2 MiB；OOXML 展开大小上限 128 MiB / 10000 项。inspect 文本和表格输出有数量上限。
- 不执行宏；不启动 Office 软件。XLSX 公式仅保存字符串，不声称计算出的缓存值正确。
- DOCX/PPTX/XLSX 的内容和结构生成不等于完整排版渲染。PDF 中文使用文泉驿字体嵌入；其他字体与 emoji 字形覆盖未全面验证。

## 真实验收

设备：已连接 M332BF，Android 17，aarch64，Alpine 3.22.7。

1. 原环境 docx/openpyxl/pptx/reportlab/pypdf/Pillow/lxml 均缺失；实际在线下载安装后全部 import 成功。
2. 四种文件实际在手机生成并再次打开读取，中文标记一致；PDF 中文文本可抽取；XLSX `SUM` 公式字符串保留。
3. 工作区外输入/输出拒绝、符号链接越界拒绝、已有文件拒绝且字节未变，共 7 项设备侧检查通过。
4. 样例目录 `/root/eva-workspace/office-checks/20261103-000724/`；证据 `artifacts/office/roundtrip.json`、`safety.json`、`installed.json`。
5. 工具 `tools/deploy-office-runtime.py` 可部署当前资产并执行 status/install/selftest；`tools/check-office-device.py` 为设备侧边界检查。

这不代表第三方复杂文档兼容、打印分页、Office 公式计算、DOCX/PPTX 视觉导出、PDF 编辑/OCR、长期后台任务已经完成。手机页面/原生预览的验收由主线单独记录。
