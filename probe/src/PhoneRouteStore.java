package ai.eva.android.probe;

import android.content.Context;
import android.util.AtomicFile;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.json.JSONArray;
import org.json.JSONObject;

/** Private route records. All read-modify-write operations share a process lock. */
final class PhoneRouteStore {
    private static final Object LOCK = new Object();
    private final File directory;
    PhoneRouteStore(Context context) { this(new File(context.getFilesDir(), "phone-routes")); }
    PhoneRouteStore(File directory) { this.directory = directory; }
    private AtomicFile file(String id) throws IOException {
        if (!id.matches("[a-f0-9-]{36}")) throw new IOException("路线编号无效");
        if (!directory.isDirectory() && !directory.mkdirs()) throw new IOException("无法创建路线目录");
        if (java.nio.file.Files.isSymbolicLink(directory.toPath())) throw new IOException("路线目录不能使用符号链接");
        File target = new File(directory.getCanonicalFile(), id + ".json");
        if (!target.getCanonicalFile().equals(target.getAbsoluteFile())) throw new IOException("路线不能使用符号链接");
        return new AtomicFile(target);
    }
    private JSONObject read(String id) throws Exception {
        AtomicFile file = file(id);
        if (file.getBaseFile().length() > 256 * 1024) throw new IOException("路线记录过大");
        return new JSONObject(new String(file.readFully(), StandardCharsets.UTF_8));
    }
    private void write(JSONObject route) throws Exception {
        AtomicFile file = file(route.getString("id"));
        byte[] bytes = route.toString().getBytes(StandardCharsets.UTF_8);
        if (bytes.length > 256 * 1024) throw new IOException("路线内容过大");
        FileOutputStream output = null;
        try { output = file.startWrite(); output.write(bytes); file.finishWrite(output); }
        catch (Exception error) { if (output != null) file.failWrite(output); throw error; }
    }
    JSONObject get(String id) throws Exception { synchronized (LOCK) { return read(id); } }
    static JSONObject calibration(JSONObject route, long installedVersion) throws Exception {
        boolean bound = !route.optString("package").isEmpty() && route.optLong("appVersionCode", -1) >= 0;
        boolean stale = !bound || route.optLong("appVersionCode", -1) != installedVersion;
        String state;
        if (route.optBoolean("disabled")) state = "disabled";
        else if (!bound) state = "needs_relearning";
        else if (installedVersion < 0) state = "app_unavailable";
        else if (stale) state = "needs_relearning";
        else state = route.optInt("successes") > 0 ? "verified" : route.optString("provenance").equals("observed-safe-navigation") ? "observed" : "candidate";
        return new JSONObject().put("state", state).put("verified", state.equals("verified"))
            .put("needsRelearning", state.equals("needs_relearning") || state.equals("disabled") || state.equals("app_unavailable"))
            .put("boundVersionCode", route.optLong("appVersionCode", -1)).put("installedVersionCode", installedVersion);
    }
    JSONArray list(String goal) throws Exception { return list(goal, ""); }
    JSONArray list(String goal, String app) throws Exception {
        synchronized (LOCK) {
            JSONArray rows = new JSONArray(); File[] files = directory.listFiles();
            if (files == null) return rows;
            for (File file : files) {
                String name = file.getName(); if (!name.matches("[a-f0-9-]{36}\\.json")) continue;
                try {
                    JSONObject route = read(name.substring(0, 36));
                    if (!goal.isEmpty() && !route.getString("goal").equals(goal)) continue;
                    if (!app.isEmpty() && !app.equals(route.optString("package", inferPackage(route.getJSONArray("steps"))))) continue;
                    if (!route.has("package")) route.put("package", inferPackage(route.getJSONArray("steps"))).put("needsRelearning", true);
                    route.remove("steps"); rows.put(route);
                } catch (Exception ignored) { /* A damaged entry does not hide other routes. */ }
            }
            return rows;
        }
    }
    JSONObject create(String goal, String name, JSONArray steps, String sourceTurn) throws Exception {
        return create(goal, name, steps, sourceTurn, new JSONObject());
    }
    JSONObject create(String goal, String name, JSONArray steps, String sourceTurn, JSONObject binding) throws Exception {
        return create(goal, name, steps, sourceTurn, binding, new JSONObject());
    }
    private JSONObject create(String goal, String name, JSONArray steps, String sourceTurn, JSONObject binding, JSONObject metadata) throws Exception {
        synchronized (LOCK) {
            if (goal.trim().isEmpty() || goal.length() > 2000 || name.trim().isEmpty() || name.length() > 100) throw new IOException("路线名称或目标无效");
            steps = new JSONArray(steps.toString());
            validateSteps(steps);
            JSONObject route = new JSONObject().put("id", UUID.randomUUID().toString()).put("name", name).put("goal", goal)
                .put("steps", new JSONArray(steps.toString())).put("sourceTurn", sourceTurn).put("createdAt", System.currentTimeMillis())
                .put("successes", 0).put("consecutiveMisses", 0).put("missStep", -1).put("disabled", false);
            if (!binding.optString("package").isEmpty()) {
                route.put("package", binding.getString("package")).put("appVersion", binding.optString("version"))
                    .put("appVersionCode", binding.optLong("versionCode", -1)).put("startTarget", firstTarget(steps));
                for (int i = 0; i < steps.length(); i++) {
                    JSONObject step = steps.getJSONObject(i);
                    if (step.has("target") && !step.has("before_package")) step.put("before_package", binding.getString("package"));
                }
                route.put("steps", new JSONArray(steps.toString()));
            }
            java.util.Iterator<String> metadataKeys = metadata.keys();
            while (metadataKeys.hasNext()) { String key = metadataKeys.next(); route.put(key, metadata.get(key)); }
            write(route); return route;
        }
    }
    private static String canonical(Object value) throws Exception {
        if (value instanceof JSONObject) {
            JSONObject object = (JSONObject)value;
            java.util.TreeSet<String> keys = new java.util.TreeSet<>();
            java.util.Iterator<String> iterator = object.keys();
            while (iterator.hasNext()) keys.add(iterator.next());
            StringBuilder result = new StringBuilder("{");
            for (String key : keys) { if (result.length() > 1) result.append(','); result.append(JSONObject.quote(key)).append(':').append(canonical(object.get(key))); }
            return result.append('}').toString();
        }
        if (value instanceof JSONArray) {
            JSONArray array = (JSONArray)value; StringBuilder result = new StringBuilder("[");
            for (int i = 0; i < array.length(); i++) { if (i > 0) result.append(','); result.append(canonical(array.get(i))); }
            return result.append(']').toString();
        }
        return value instanceof String ? JSONObject.quote((String)value) : String.valueOf(value);
    }
    JSONObject observe(JSONArray steps, JSONObject binding, JSONObject endState, String sourceTurn) throws Exception {
        synchronized (LOCK) {
            validateSteps(steps);
            JSONObject identity = new JSONObject().put("steps", steps).put("binding", binding).put("endState", endState);
            byte[] digest = java.security.MessageDigest.getInstance("SHA-256").digest(canonical(identity).getBytes(StandardCharsets.UTF_8));
            StringBuilder fingerprint = new StringBuilder();
            for (byte value : digest) fingerprint.append(String.format(java.util.Locale.ROOT, "%02x", value & 255));
            JSONArray routes = list(""); int appCount = 0, automaticCount = 0;
            for (int i = 0; i < routes.length(); i++) {
                JSONObject summary = routes.getJSONObject(i);
                if (!summary.optString("provenance").equals("observed-safe-navigation")) continue;
                automaticCount++;
                if (summary.optString("package").equals(binding.getString("package"))) appCount++;
                if (!summary.optString("fingerprint").equals(fingerprint.toString())) continue;
                JSONObject route = read(summary.getString("id"));
                route.put("observations", route.optInt("observations") + 1).put("lastObservedAt", System.currentTimeMillis()).put("lastSourceTurn", sourceTurn);
                write(route); return route;
            }
            if (automaticCount >= 512 || appCount >= 128) throw new IOException("自动流程记录已达容量，已有流程保留；请整理该软件的旧流程后继续学习");
            JSONArray labels = new JSONArray();
            for (int i = 0; i < steps.length(); i++) {
                JSONObject step = steps.getJSONObject(i), target = step.optJSONObject("target");
                labels.put(target == null ? step.getString("action") : target.optString("text", target.optString("description")));
            }
            String name = "自动导航 · " + labels.join(" → ").replace("\"", "");
            if (name.length() > 100) name = name.substring(0, 100);
            JSONObject metadata = new JSONObject().put("provenance", "observed-safe-navigation").put("fingerprint", fingerprint.toString()).put("endState", endState)
                .put("navigation", labels).put("observations", 1).put("lastObservedAt", System.currentTimeMillis());
            return create("observed-navigation:" + binding.getString("package") + ":" + fingerprint, name, steps, sourceTurn, binding, metadata);
        }
    }
    static String inferPackage(JSONArray steps) {
        String app = "";
        for (int i = 0; i < steps.length(); i++) {
            JSONObject step = steps.optJSONObject(i); if (step == null) continue;
            String value = step.optString("package", step.optString("before_package"));
            if (value.isEmpty()) continue;
            if (!app.isEmpty() && !app.equals(value)) return "";
            app = value;
        }
        return app;
    }
    static JSONObject firstTarget(JSONArray steps) {
        for (int i = 0; i < steps.length(); i++) {
            JSONObject step = steps.optJSONObject(i);
            if (step != null && step.optJSONObject("target") != null) return step.optJSONObject("target");
        }
        return new JSONObject();
    }
    static void validateSteps(JSONArray steps) throws Exception {
        if (steps.length() < 1 || steps.length() > 20) throw new IOException("路线需要 1 至 20 步");
        for (int i = 0; i < steps.length(); i++) {
            JSONObject step = steps.getJSONObject(i); PhoneBatch.validate(step);
            String action = step.getString("action");
            // Exact visible navigation labels only. Opaque ID-only clicks cannot prove a safe replay target.
            if (action.equals("input")) throw new IOException("输入步骤需现场处理，不能保存为自动路线");
            if (action.equals("click")) {
                JSONObject target = step.getJSONObject("target");
                String label = target.optString("text", target.optString("description"));
                if (label.isEmpty() || !label.matches("(?iu).*(搜索|查找|详情|更多|返回|首页|设置|列表|展开|收起|search|find|details|more|back|home|settings|list|expand|collapse).*")) throw new IOException("仅可保存明确的导航点击，其他点击需现场确认");
            }
            if (step.toString().matches("(?isu).*(付款|支付|购买|下单|删除|清空|发送|提交|确认|授权|密码|验证码|pay|purchase|checkout|delete|remove|send|submit|confirm|authorize|password|verification).*")) throw new IOException("敏感操作不能自动回放");
        }
    }
    JSONObject miss(String id, int step) throws Exception {
        synchronized (LOCK) {
            JSONObject route = read(id);
            int count = route.optInt("missStep", -1) == step ? route.optInt("consecutiveMisses") + 1 : 1;
            route.put("missStep", step).put("consecutiveMisses", count).put("disabled", route.optBoolean("disabled") || count >= 2).put("lastUsedAt", System.currentTimeMillis());
            write(route); return route;
        }
    }
    JSONObject success(String id) throws Exception {
        synchronized (LOCK) {
            JSONObject route = read(id);
            route.put("successes", route.optInt("successes") + 1).put("consecutiveMisses", 0).put("missStep", -1).put("disabled", false).put("lastUsedAt", System.currentTimeMillis());
            write(route); return route;
        }
    }
    void delete(String id) throws Exception { synchronized (LOCK) { AtomicFile record = file(id); record.delete(); if (record.getBaseFile().exists()) throw new IOException("路线删除失败"); } }
}
