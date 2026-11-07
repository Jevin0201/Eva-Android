package ai.eva.android.probe;

import android.content.Context;
import android.os.SystemClock;
import java.io.IOException;
import java.util.Arrays;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import org.json.JSONArray;
import org.json.JSONObject;

/** Bounded phone sequences. Each target is resolved against a new observation. */
final class PhoneBatch {
    private static final ConcurrentHashMap<String, AtomicLong> revisions = new ConcurrentHashMap<>();
    private static final java.util.List<String> ACTIONS = Arrays.asList(
        "observe", "open_app", "open_gallery", "click", "input", "scroll", "back", "home");

    static void steer(String thread) { revisions.computeIfAbsent(thread, key -> new AtomicLong()).incrementAndGet(); }
    static void end(String thread) { revisions.remove(thread); }
    static long revision(String thread) { return revisions.computeIfAbsent(thread, key -> new AtomicLong()).get(); }

    static JSONObject spec() throws Exception {
        JSONObject target = new JSONObject();
        for (String key : new String[]{"text", "resourceId", "description"}) target.put(key, new JSONObject().put("type", "string"));
        JSONObject fields = new JSONObject().put("action", new JSONObject().put("type", "string").put("enum", new JSONArray(ACTIONS)));
        for (String key : new String[]{"package", "app", "text", "direction", "expect", "expect_gone", "expect_package", "before_package"}) fields.put(key, new JSONObject().put("type", "string"));
        fields.put("target", new JSONObject().put("type", "object").put("properties", target).put("additionalProperties", false));
        fields.put("wait_stable", new JSONObject().put("type", "boolean"));
        fields.put("timeoutMs", new JSONObject().put("type", "integer").put("minimum", 0).put("maximum", 10000));
        JSONObject step = new JSONObject().put("type", "object").put("properties", fields).put("required", new JSONArray().put("action")).put("additionalProperties", false);
        JSONObject properties = new JSONObject().put("steps", new JSONObject().put("type", "array").put("minItems", 1).put("maxItems", 20).put("items", step));
        return new JSONObject().put("name", "eva_phone_steps").put("description", "Execute 1-20 phone actions in order. Targets use exact text/resourceId/description from an observation and must uniquely match a fresh screen. Do not pass node IDs or snapshots. Each action returns fresh observation. Optional before_package checks before dispatch. expect/expect_gone wait for visible text and expect_package checks App after dispatch; wait_stable waits for an unchanged node tree. Stops on failure, timeout, cancellation or user steering and reports every skipped step. No automatic replay. A batch does not grant authorization. Use only actions already authorized by the user. Stop before sending/purchasing/deleting or granting permissions, perform those separately under existing approval rules. For messaging try eva_wechat only when available, otherwise use live phone actions. Before exploring a repeated navigation, list eva_phone_route. After a successful batch inspect observation and save its navigation goal via eva_phone_route with success=true to learn it automatically.").put("inputSchema", new JSONObject().put("type", "object").put("properties", properties).put("required", new JSONArray().put("steps")).put("additionalProperties", false));
    }

    interface Backend {
        JSONObject execute(JSONObject args) throws Exception;
        void guard() throws Exception;
        long now();
        void sleep(long millis) throws Exception;
    }

    static JSONObject execute(Context context, JSONObject arguments, JSONObject request, long epoch, long revision) throws Exception {
        String thread = request.optString("threadId");
        return run(arguments, new Backend() {
            public JSONObject execute(JSONObject args) throws Exception { PhoneTools.dispatchGuard.set(()->{guard();return true;});try{PhoneTools.reserveTask(request,args);return PhoneTools.executeObserved(context,args,epoch);}finally{PhoneTools.dispatchGuard.remove();} }
            public void guard() throws Exception {
                KernelHost.guardTurn(request);
                if (epoch != PhoneAccessibility.generation || !PhoneAccessibility.armed) throw new IOException("手机控制已停止");
                if (revision(thread) != revision) throw new IOException("收到用户新消息，剩余步骤未执行");
            }
            public long now() { return SystemClock.elapsedRealtime(); }
            public void sleep(long millis) throws Exception { Thread.sleep(millis); }
        });
    }

    static JSONObject run(JSONObject arguments, Backend backend) throws Exception {
        JSONArray steps = arguments.getJSONArray("steps");
        if (steps.length() < 1 || steps.length() > 20) throw new IOException("批处理需要 1 至 20 个步骤");
        // Validate the whole request before the first side effect.
        for (int i = 0; i < steps.length(); i++) validate(steps.getJSONObject(i));
        JSONArray results = new JSONArray();
        JSONObject latest = null;
        String stopped = "";
        long deadline = backend.now() + 60000;
        for (int i = 0; i < steps.length(); i++) {
            JSONObject step = steps.getJSONObject(i), entry = new JSONObject().put("index", i).put("action", step.getString("action")).put("executed", false);
            results.put(entry);
            if (!stopped.isEmpty()) { entry.put("skipped", true).put("error", stopped); continue; }
            try {
                backend.guard();
                if (backend.now() >= deadline) throw new IOException("批处理总时限已到");
                String previousPackage = latest == null ? "" : latest.optString("package");
                latest = backend.execute(new JSONObject().put("action", "observe"));
                backend.guard();
                if (!previousPackage.isEmpty() && !previousPackage.equals(latest.optString("package"))) throw new IOException("步骤之间 App 已改变，停止后续操作");
                if (!step.optString("before_package").isEmpty() && !step.getString("before_package").equals(latest.optString("package"))) throw new IOException("当前 App 与 before_package 不一致");
                String startingPackage = latest.optString("package");
                JSONObject args = resolve(step, latest);
                backend.guard();
                if (!step.getString("action").equals("observe")) {
                    entry.put("attempted", true);
                    latest = backend.execute(args);
                    entry.put("executed", latest.optBoolean("dispatched"));
                    if (latest.has("actionError") || !latest.optBoolean("dispatched")) throw new IOException(latest.optString("actionError", "操作未派发"));
                }
                if (latest.has("observationError")) throw new IOException(latest.getString("observationError"));
                if (step.getString("action").equals("input") && !visibleText(latest).contains(step.getString("text"))) throw new IOException("输入回读未匹配，停止后续步骤");
                latest = await(step, latest, backend, deadline, startingPackage);
                entry.put("ok", true);
            } catch (Exception error) {
                stopped = error.getMessage() == null ? error.toString() : error.getMessage();
                entry.put("ok", false).put("error", stopped);
            }
        }
        JSONObject result = new JSONObject().put("steps", results).put("completed", stopped.isEmpty());
        if (latest != null) result.put("observation", latest);
        if (!stopped.isEmpty()) result.put("actionError", stopped);
        // The final image stays in the normal host image channel.
        if (latest != null && latest.has("imageUrl")) { result.put("imageUrl", latest.get("imageUrl")); latest.remove("imageUrl"); }
        return result;
    }

    static void validate(JSONObject step) throws Exception {
        if (!ACTIONS.contains(step.getString("action"))) throw new IOException("批处理不支持此操作");
        java.util.Iterator<String> keys = step.keys();
        java.util.List<String> allowed = Arrays.asList("action", "package", "app", "text", "direction", "target", "expect", "expect_gone", "expect_package", "before_package", "wait_stable", "timeoutMs");
        while (keys.hasNext()) if (!allowed.contains(keys.next())) throw new IOException("批处理包含未知字段或旧快照编号");
        for (String key : new String[]{"package", "app", "text", "direction", "expect", "expect_gone", "expect_package", "before_package"}) {
            if (step.has(key) && (!(step.get(key) instanceof String) || step.getString(key).length() > 10000)) throw new IOException("步骤文字字段无效或过长");
        }
        if (step.has("timeoutMs") && !(step.get("timeoutMs") instanceof Integer || step.get("timeoutMs") instanceof Long)) throw new IOException("等待时限需要整数");
        if (step.has("wait_stable") && !(step.get("wait_stable") instanceof Boolean)) throw new IOException("wait_stable 需要布尔值");
        if (step.getString("action").equals("open_app") && step.optString("package").trim().isEmpty() && step.optString("app").trim().isEmpty()) throw new IOException("open_app 需要 package 或 app");
        if (step.getString("action").equals("input") && !step.has("text")) throw new IOException("input 需要 text");
        int timeout = step.optInt("timeoutMs", 3000);
        if (timeout < 0 || timeout > 10000) throw new IOException("等待时限须在 0 至 10000 毫秒内");
        if (Arrays.asList("click", "input", "scroll").contains(step.getString("action"))) {
            JSONObject target = step.optJSONObject("target");
            if (target == null || target.length() == 0) throw new IOException("控件操作需要稳定 target");
            java.util.Iterator<String> fields = target.keys();
            while (fields.hasNext()) { String key = fields.next(); if (!Arrays.asList("text", "resourceId", "description").contains(key) || !(target.get(key) instanceof String) || target.getString(key).isEmpty()) throw new IOException("目标字段无效"); }
        }
    }

    static JSONObject resolve(JSONObject step, JSONObject observation) throws Exception {
        JSONObject args = new JSONObject().put("action", step.getString("action"));
        for (String key : new String[]{"package", "app", "text", "direction"}) if (step.has(key)) args.put(key, step.get(key));
        if (observation.has("snapshot")) args.put("snapshot", observation.get("snapshot"));
        JSONObject target = step.optJSONObject("target");
        if (target == null) return args;
        JSONArray nodes = observation.optJSONArray("nodes");
        JSONObject selected = null;
        for (int i = 0; nodes != null && i < nodes.length(); i++) {
            JSONObject node = nodes.getJSONObject(i); boolean match = true;
            java.util.Iterator<String> keys = target.keys();
            while (keys.hasNext()) { String key = keys.next(); if (!target.getString(key).equals(node.optString(key))) match = false; }
            if (!match) continue;
            if (selected != null) throw new IOException("目标控件不唯一，请缩小 target");
            selected = node;
        }
        if (selected == null) throw new IOException("当前页面没有匹配的目标控件");
        return args.put("node", selected.getString("id"));
    }

    static String visibleText(JSONObject observation) {
        StringBuilder text = new StringBuilder(); JSONArray nodes = observation.optJSONArray("nodes");
        for (int i = 0; nodes != null && i < nodes.length(); i++) { JSONObject node = nodes.optJSONObject(i); if (node != null) for (String key : new String[]{"text", "description", "hint"}) text.append(node.optString(key)).append('\n'); }
        return text.toString();
    }

    static JSONObject await(JSONObject step, JSONObject latest, Backend backend, long batchDeadline, String startingPackage) throws Exception {
        boolean stable = step.optBoolean("wait_stable");
        String expectedPackage = step.optString("expect_package");
        if (expectedPackage.isEmpty() && step.getString("action").equals("open_app")) expectedPackage = step.optString("package");
        boolean opening = step.getString("action").startsWith("open_");
        long deadline = Math.min(batchDeadline, backend.now() + step.optInt("timeoutMs", 3000));
        String fingerprint = latest.optString("nodes"), pkg = latest.optString("package");
        long stableSince = backend.now();
        while (true) {
            backend.guard();
            String currentPackage = latest.optString("package");
            if (!opening && !currentPackage.equals(startingPackage) && !currentPackage.equals(expectedPackage)) throw new IOException("操作后出现未预期的 App 切换，停止后续步骤");
            String text = visibleText(latest);
            boolean matches = (step.optString("expect").isEmpty() || text.contains(step.getString("expect")))
                && (step.optString("expect_gone").isEmpty() || !text.contains(step.getString("expect_gone")))
                && (expectedPackage.isEmpty() || expectedPackage.equals(currentPackage));
            if (matches && (!stable || backend.now() - stableSince >= 200)) return latest;
            if (backend.now() >= deadline) throw new IOException("等待页面条件超时，已执行的操作不会重试");
            backend.sleep(Math.min(100, deadline - backend.now())); backend.guard();
            latest = backend.execute(new JSONObject().put("action", "observe"));
            if (latest.has("observationError")) throw new IOException(latest.getString("observationError"));
            String next = latest.optString("nodes"), nextPackage = latest.optString("package");
            if (!fingerprint.equals(next) || !pkg.equals(nextPackage)) stableSince = backend.now();
            fingerprint = next; pkg = nextPackage;
        }
    }
}
