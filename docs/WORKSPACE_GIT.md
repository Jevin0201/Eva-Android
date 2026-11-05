# 手机工作区 Git 增量

## 实现范围

文件目录页进入“版本管理”，只管理该目录作为根目录的本地仓库：初始化 main、分支/变更状态、工作区和暂存区差异、选中文件暂存、取消暂存、本地提交。提交要求明确填写说明、作者和邮箱；不改变全局 Git 身份。取消暂存不会还原或删除工作文件。

Android 界面为 `GitActivity`；`WorkspaceGit` 通过既有 PRoot/Python/Git 调用项目自有 `eva-git.py`。命令逐参数传入，无 shell 拼接；不引入新第三方代码或依赖。参考桌面 `src/main/managed-worktrees.js` 的原生 Git 调用及工作区边界，未复制桌面 Electron 代码，也没有修改桌面项目。

只允许工作区内子目录；禁止路径穿越、跨仓库链接、外部 gitdir/worktree、共享 object 存储。仓库根不匹配时提示返回正确根目录。保留已有工作文件，不提供丢弃修改、checkout/reset工作树、推送等操作。所有写操作检查 HEAD+index 的摘要，列表加载后索引变化时要求刷新。正在合并/变基的仓库拒绝此入口的写操作。

禁用 hooks、fsmonitor、外部 diff/textconv、签名、自动维护和交互凭据。**`git status` 也可能调用 clean/process filter**，因此对配置了内容过滤器（包括 Git LFS）的仓库，界面明确拒绝操作，交由终端检查。此保护通过会写入标记文件的测试过滤器验证，标记未产生。

## 验收

`tools/test-workspace-git.py` 已在实际手机的 Eva PRoot 环境执行，21 项通过：初始化、中文路径/内容、未跟踪预览、暂存、初始无提交时取消暂存、旧索引冲突、创建提交、禁用 hooks、工作区/暂存区 diff、取消暂存保留文件、目录越界、路径越界、外部符号链接、祖先仓库拒绝、status/stage 过滤器拒绝及无执行、外部 gitdir 拒绝，以及 external diff/fsmonitor 禁用。结果保存于 `artifacts/git/backend-phone.json`。测试仅使用自动清理的临时自有目录。

以上是实际 Git 后端验收；不等同于 Android 界面、旋转/后台生命周期全部验收。`WorkspaceGitProbe.check(Activity)` 提供最终 APK 的原生链路验收：唯一项目、真实原生初始化/状态/diff/暂存/提交、打开 GitActivity 并由生命周期回调检查真实渲染，最后关闭返回并清理自有目录。结果保存于 `eva-workspace-git-check/result`；此 helper 新增后尚需安装运行，不能把代码存在视为通过。

## 未完成

远程 clone/fetch/pull/push 和凭据管理、分支切换、冲突合并界面、交互式逐块暂存、Git LFS、子模块、worktree 管理、完整提交历史尚未实现。不支持任意二进制差异预览，文本差异显示最多 256 KB。Git 内核命令限时 25 秒，原生等待最多 35 秒；超时后应刷新确认结果，不能自动重复提交。

## 真机工作区边界修复

首次原生 Probe 暴露：手机运行环境已在 `/root/eva-workspace` 初始化 umbrella 仓库，隔离临时测试没有这个结构，祖先仓库检查错误地拒绝了所有新项目。现将工作区根作为仓库发现边界，且给 Git 设置 `GIT_CEILING_DIRECTORIES`；项目内部的祖先仓库仍拒绝误初始化。新增含工作区根 `.git` 的回归通过；在真实手机 `projects/` 下创建唯一项目、初始化/暂存/提交均通过，根仓库 HEAD/index 摘要未改变，fixture 已清理。证据：`artifacts/git/workspace-boundary-phone.json`。修复后原生 UI Probe 仍需最终 APK 重跑。

最终 APK 真机原生验收：`artifacts/git/native-ui.json` 为 PASS，覆盖原生封装及 GitActivity 真实状态显示，fixture 已清理。

## 2026-11-06 remote Git host increment

The version management menu now exposes clone, remote configuration, fetch, fast-forward pull, confirmed non-force push, branch create/switch, explicit merge, ours/theirs conflict resolution, merge abort and paged commit history. Dirty worktrees block branch switching and automatic integration. State tokens include HEAD, index, config and refs.

Desktop source provenance is fixed in migration/eva-0.2.7-desktop/git/SOURCE.json. The implementation retains the managed-worktrees.js argument-array execution, cleaned Git environment, 120-second timeout and repository/ref boundaries, while extending the existing Android Python/Git host.

HTTPS credentials reuse ModelStore Android Keystore AES-GCM encryption. A credential is bound to its full HTTPS repository URL. The temporary askpass script contains no secret, reads transient environment values and rejects a different host or repository path. The script is deleted after each operation. Credentials stay out of argv, remote URLs, WebView and error messages. Local URL rewrites, HTTP/credential overrides, content filters and external merge drivers are rejected. SSH uses preconfigured Linux keys and trusted known_hosts in batch mode.

Host validation passes 23 isolated bare-remote checks and the existing 21 local checks. The phone runtime also passes all 23 remote checks. Android Java compilation passes. The parent task can run artifacts/git/remote-runtime-check.py through tools/runtime-device.py. This fixture embeds the current helper and writes only task-owned temporary repositories. Device installation, UI lifecycle and real-account authorization remain for the parent to verify. Actual bare-remote tests cover missing repositories, rejected non-fast-forward pushes and merge conflicts. Authentication, host-key and DNS message classification uses deterministic stderr fixtures without account credentials.

LFS, submodules, worktrees, interactive rebase and initial SSH host registration continue through the terminal. The remote increment does not mark those UI domains complete. PRoot object writes use core.createObject=rename, clone disables hard links, and task-owned local remotes receive a fixed receive-pack object-rename option. Merge preparation stops before a commit and uses a process-only identity, while the final commit form supplies the real author.
