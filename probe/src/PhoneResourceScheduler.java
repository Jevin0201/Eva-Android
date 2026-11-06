package ai.eva.android.probe;

import java.io.IOException;
import java.util.Arrays;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.function.BooleanSupplier;
import org.json.JSONArray;
import org.json.JSONObject;

/** Process-wide task resources. Acquisition never blocks a tool executor or partially reserves a request. */
final class PhoneResourceScheduler {
    static final String MAIN_SCREEN = "screen:main";
    static final String BACKGROUND_SCREEN = "screen:background";
    static final String CLIPBOARD = "clipboard";
    static final String BROWSER_PAGE = "browser:page";
    private static final Map<String, Owner> held = new HashMap<>();
    private static final Map<Owner, Waiting> waiting = new HashMap<>();
    private static final long MAX_WAIT_MS = 5000;
    private static final long RETRY_MS = 250;

    private static final class Owner {
        final String thread, turn;
        Owner(String thread, String turn) throws IOException {
            if (thread == null || thread.isEmpty() || turn == null || turn.isEmpty())
                throw new IOException("资源操作缺少会话或回合标识");
            this.thread = thread;
            this.turn = turn;
        }
        public boolean equals(Object other) {
            if (!(other instanceof Owner)) return false;
            Owner owner = (Owner) other;
            return thread.equals(owner.thread) && turn.equals(owner.turn);
        }
        public int hashCode() { return 31 * thread.hashCode() + turn.hashCode(); }
    }
    private static final class Waiting {
        final Set<String> resources;
        final long deadline;
        Waiting(Set<String> resources, long deadline) { this.resources = resources; this.deadline = deadline; }
    }
    static final class BusyException extends IOException {
        final JSONObject details;
        BusyException(JSONObject details) {
            super(details.toString());
            this.details = details;
        }
    }
    static String app(String packageName, int user) throws IOException {
        if (packageName == null || !packageName.matches("[A-Za-z0-9_]+(?:\\.[A-Za-z0-9_]+)+") || user < 0)
            throw new IOException("应用资源标识无效");
        return "app:" + packageName + "@" + user;
    }
    static void reserve(JSONObject params, String... resources) throws Exception {
        acquire(params, Arrays.asList(resources), 0, () -> KernelHost.cancelledTurns.contains(KernelHost.turnKey(params)));
    }
    /** Nonblocking retry. timeoutMs bounds the waiting intent, not time spent blocking the serial executor. */
    static synchronized void acquire(JSONObject params, Collection<String> resources, long timeoutMs, BooleanSupplier cancelled) throws Exception {
        Owner owner = new Owner(params.optString("threadId"), params.optString("turnId"));
        if (cancelled.getAsBoolean()) {
            release(owner);
            throw new IOException("任务已停止，资源请求已取消");
        }
        if (timeoutMs < 0 || timeoutMs > MAX_WAIT_MS) throw new IOException("资源等待上限为 5000 毫秒");
        LinkedHashSet<String> request = new LinkedHashSet<>(resources);
        if (request.isEmpty() || request.size() > 64) throw new IOException("资源请求数量无效");
        for (String resource : request) {
            if (resource == null || resource.isEmpty() || resource.length() > 300)
                throw new IOException("资源标识无效");
        }
        long now = android.os.SystemClock.elapsedRealtime();
        Waiting expired = waiting.get(owner);
        if (timeoutMs > 0 && expired != null && expired.deadline <= now) {
            waiting.remove(owner);
            throw new BusyException(new JSONObject().put("error", "resource_timeout").put("actionExecuted", false)
                    .put("reason", "资源等待已超时，请结束冲突任务或重新安排操作"));
        }
        Set<Owner> blockers = new HashSet<>();
        JSONArray conflicts = new JSONArray();
        for (String resource : request) {
            Owner holder = held.get(resource);
            if (holder != null && !holder.equals(owner)) {
                blockers.add(holder);
                conflicts.put(new JSONObject().put("resource", resource).put("holderThread", holder.thread).put("holderTurn", holder.turn));
            }
        }
        if (blockers.isEmpty()) {
            waiting.remove(owner);
            for (String resource : request) held.put(resource, owner);
            return;
        }
        boolean cycle = false;
        for (Owner blocker : blockers) {
            if (reaches(blocker, owner, new HashSet<>())) { cycle = true; break; }
        }
        Waiting previous = waiting.get(owner);
        long deadline = previous == null ? now + timeoutMs : previous.deadline;
        if (!cycle && timeoutMs > 0) waiting.put(owner, new Waiting(request, deadline));
        else waiting.remove(owner);
        throw new BusyException(new JSONObject().put("error", cycle ? "resource_deadlock" : "resource_busy")
                .put("reason", cycle ? "任务互相等待，已拒绝本次资源申请" : "资源正在被其他任务使用，本次操作未执行")
                .put("conflicts", conflicts).put("retryAfterMs", RETRY_MS).put("waitingUntilMs", timeoutMs > 0 && !cycle ? deadline : now)
                .put("actionExecuted", false));
    }
    private static boolean reaches(Owner from, Owner target, Set<Owner> seen) {
        if (from.equals(target)) return true;
        if (!seen.add(from)) return false;
        Waiting next = waiting.get(from);
        if (next == null || next.deadline <= android.os.SystemClock.elapsedRealtime()) return false;
        for (String resource : next.resources) {
            Owner blocker = held.get(resource);
            if (blocker != null && !blocker.equals(from) && reaches(blocker, target, seen)) return true;
        }
        return false;
    }
    static synchronized void releaseTurn(String thread, String turn) {
        if (thread == null || turn == null || thread.isEmpty() || turn.isEmpty()) return;
        try { release(new Owner(thread, turn)); } catch (IOException ignored) { }
    }
    static synchronized void releaseThread(String thread) {
        if (thread == null) return;
        held.entrySet().removeIf(entry -> entry.getValue().thread.equals(thread));
        waiting.entrySet().removeIf(entry -> entry.getKey().thread.equals(thread));
    }
    static synchronized void releaseResources(JSONObject params, String... resources) throws IOException {
        Owner owner = new Owner(params.optString("threadId"), params.optString("turnId"));
        for (String resource : resources) if (owner.equals(held.get(resource))) held.remove(resource);
        waiting.remove(owner);
    }
    private static void release(Owner owner) {
        held.entrySet().removeIf(entry -> owner.equals(entry.getValue()));
        waiting.remove(owner);
    }
    static synchronized JSONObject diagnostics() throws Exception {
        long now = android.os.SystemClock.elapsedRealtime();
        JSONArray resources = new JSONArray();
        for (Map.Entry<String, Owner> entry : held.entrySet()) {
            Owner owner = entry.getValue();
            resources.put(new JSONObject().put("resource", entry.getKey()).put("threadId", owner.thread).put("turnId", owner.turn));
        }
        int activeWaits = 0;
        for (Waiting task : waiting.values()) if (task.deadline > now) activeWaits++;
        return new JSONObject().put("resources", resources).put("waitingTasks", activeWaits).put("blocking", false);
    }
}
