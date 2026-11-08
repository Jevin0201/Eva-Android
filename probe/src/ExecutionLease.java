package ai.eva.android.probe;

import android.content.Context;
import android.content.Intent;
import android.os.PowerManager;
import java.io.IOException;
import java.util.*;
import org.json.JSONObject;

/** In-process execution lifetimes. No persisted task replay or battery-setting changes. */
final class ExecutionLease implements AutoCloseable {
    static final class Registry {
        private final Map<Long, String> owners = new HashMap<>();
        private long next;
        synchronized long add(String owner) { long id = ++next; owners.put(id, owner); return id; }
        synchronized boolean remove(long id) { return owners.remove(id) != null; }
        synchronized void removeOwner(String owner) { owners.values().removeIf(owner::equals); }
        synchronized int count() { return owners.size(); }
        synchronized int countOwner(String owner) { int count = 0; for (String value : owners.values()) if (owner.equals(value)) count++; return count; }
    }
    private static final Object LOCK = new Object();
    private static final Registry leases = new Registry();
    private static PowerManager.WakeLock wakeLock;
    private final long id;
    private boolean closed;

    private ExecutionLease(long id) { this.id = id; }
    static ExecutionLease acquire(Context original, String owner) throws IOException {
        synchronized (LOCK) {
            Context context = original.getApplicationContext();
            long id = leases.add(owner);
            try {
                if (wakeLock == null) {
                    PowerManager power = context.getSystemService(PowerManager.class);
                    if (power == null) throw new IOException("无法保持任务执行电源状态");
                    wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Eva:task-execution");
                    wakeLock.setReferenceCounted(false);
                }
                if (!wakeLock.isHeld()) wakeLock.acquire();
                if (!TaskExecutionService.isRunning()) context.startForegroundService(new Intent(context, TaskExecutionService.class));
                TaskExecutionService.refresh();
                return new ExecutionLease(id);
            } catch (Exception error) {
                leases.remove(id);
                releaseWakeIfIdle();
                throw new IOException("系统未能启动任务执行服务，请打开 Eva 后重试", error);
            }
        }
    }
    private static void releaseWakeIfIdle() {
        if (leases.count() == 0 && wakeLock != null && wakeLock.isHeld()) wakeLock.release();
    }
    public void close() {
        synchronized (LOCK) {
            if (closed) return;
            closed = true;
            leases.remove(id);
            releaseWakeIfIdle();
            TaskExecutionService.refresh();
        }
    }
    static void releaseOwner(String owner) {
        synchronized (LOCK) { leases.removeOwner(owner); releaseWakeIfIdle(); TaskExecutionService.refresh(); }
    }
    static int count() { return leases.count(); }
    static int countOwner(String owner) { return leases.countOwner(owner); }
    static boolean stopIfIdle(Runnable stop) {
        synchronized (LOCK) {
            if (leases.count() != 0) return false;
            stop.run();
            releaseWakeIfIdle();
            return true;
        }
    }
    static void serviceDestroyed() {
        synchronized (LOCK) {
            // A stopped foreground service must not leave a hidden wake lock.
            if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        }
    }
    static JSONObject state() throws Exception {
        synchronized (LOCK) {
            return new JSONObject().put("leases", leases.count()).put("foreground", TaskExecutionService.isRunning())
                .put("wakeLockHeld", wakeLock != null && wakeLock.isHeld());
        }
    }
}
