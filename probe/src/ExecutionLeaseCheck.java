package ai.eva.android.probe;

import android.app.Instrumentation;
import android.os.Bundle;
import android.os.SystemClock;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;

/** Isolated lease accounting; optional service exercise never calls a cloud model. */
public final class ExecutionLeaseCheck extends Instrumentation {
    private int checks;
    private boolean exerciseService;
    private void check(boolean value, String message) { if (!value) throw new AssertionError(message); checks++; }
    public void onCreate(Bundle arguments) {
        super.onCreate(arguments);
        exerciseService = arguments != null && "true".equals(arguments.getString("exerciseService"));
        start();
    }
    public void onStart() {
        Bundle result = new Bundle();
        ExecutionLease first = null, dependency = null;
        try {
            ExecutionLease.Registry state = new ExecutionLease.Registry();
            check(state.count() == 0, "new registry empty");
            long a = state.add("kernel"), b = state.add("kernel"), c = state.add("dependency");
            check(a != b && b != c && state.countOwner("kernel") == 2, "independent reservations tracked");
            state.removeOwner("kernel");
            check(state.count() == 1 && state.countOwner("dependency") == 1, "kernel exit retains dependency finishing lease");
            check(!state.remove(a) && !state.remove(b) && state.count() == 1, "late duplicate release cannot drop another owner");
            check(state.remove(c) && !state.remove(c) && state.count() == 0, "final release idempotent");
            AtomicReference<Throwable> failure = new AtomicReference<>();
            Thread[] workers = new Thread[4];
            for (int i = 0; i < workers.length; i++) {
                workers[i] = new Thread(() -> {
                    try { for (int n = 0; n < 200; n++) { long id = state.add("concurrent"); if (!state.remove(id)) throw new AssertionError("lost reservation"); } }
                    catch (Throwable error) { failure.set(error); }
                });
                workers[i].start();
            }
            for (Thread worker : workers) worker.join();
            check(failure.get() == null && state.count() == 0, "concurrent lease accounting clean");
            if (exerciseService) {
                check(ExecutionLease.count() == 0, "service exercise requires idle execution state");
                first = ExecutionLease.acquire(getTargetContext(), "lease-check-kernel");
                dependency = ExecutionLease.acquire(getTargetContext(), "lease-check-dependency");
                long deadline = SystemClock.elapsedRealtime() + 5000;
                while (!TaskExecutionService.isRunning() && SystemClock.elapsedRealtime() < deadline) Thread.sleep(50);
                JSONObject live = ExecutionLease.state();
                check(live.getInt("leases") == 2 && live.getBoolean("foreground") && live.getBoolean("wakeLockHeld"), "real foreground service and partial wake lock active");
                ExecutionLease.releaseOwner("lease-check-kernel"); first.close(); first = null;
                check(ExecutionLease.count() == 1 && ExecutionLease.state().getBoolean("wakeLockHeld"), "dependency transaction retains actual wake lock after kernel release");
                dependency.close(); dependency = null;
                deadline = SystemClock.elapsedRealtime() + 5000;
                while (TaskExecutionService.isRunning() && SystemClock.elapsedRealtime() < deadline) Thread.sleep(50);
                JSONObject idle = ExecutionLease.state();
                check(idle.getInt("leases") == 0 && !idle.getBoolean("foreground") && !idle.getBoolean("wakeLockHeld"), "final actual release stops service and wake lock");
            }
            result.putString("stream", "PASS execution leases " + checks + " checks" + (exerciseService ? " with real service" : " pure accounting") + "\n");
        } catch (Throwable error) {
            result.putString("stream", "FAIL execution leases " + error + "\n");
        } finally {
            if (first != null) first.close();
            if (dependency != null) dependency.close();
            ExecutionLease.releaseOwner("lease-check-kernel");
            ExecutionLease.releaseOwner("lease-check-dependency");
        }
        finish(result.getString("stream", "").startsWith("PASS") ? -1 : 0, result);
    }
}
