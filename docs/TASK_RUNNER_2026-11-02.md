
# Task execution layer (2026-11-02)

Implemented `runtime/task_runner.py`: argument-array commands, explicit working directory, unique task IDs, separate stdout/stderr events, sequenced JSONL log, atomic state-file replacement, exit status, 1 MiB retained-output cap, timeout and cancellation via process-group signals. Output events store Base64 bytes to preserve split UTF-8 sequences. No shell interpolation is applied unless callers explicitly choose a shell command.

Device acceptance: `runtime/test_task_runner.py` ran inside the app-launched Alpine/PRoot environment (Android 17, target API 36). Command execution, UTF-8, nonzero exit, timeout, cancellation preventing a descendant from writing its delayed marker, 1.2 MB output drain/truncation, and synthetic interrupted-state recovery all passed. Linux smoke tests also passed again. Raw evidence: `artifacts/task-runner-probe.json`.

Scope limits: recovery marks stale running records interrupted without replay; it is not task continuation. Call recovery only once after establishing exclusive store ownership at startup. Actual Android process death / reboot recovery is not tested. Children deliberately escaping the process group are not covered. No background service, cloud model, Android accessibility bridge or general browser tool bridge is connected yet. Current module is invoked by the development probe, not a complete agent product.
