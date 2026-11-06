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
    JSONArray list(String goal) throws Exception {
        synchronized (LOCK) {
            JSONArray rows = new JSONArray(); File[] files = directory.listFiles();
            if (files == null) return rows;
            for (File file : files) {
                String name = file.getName(); if (!name.matches("[a-f0-9-]{36}\\.json")) continue;
                try {
                    JSONObject route = read(name.substring(0, 36));
                    if (!goal.isEmpty() && !route.getString("goal").equals(goal)) continue;
                    route.remove("steps"); rows.put(route);
                } catch (Exception ignored) { /* A damaged entry does not hide other routes. */ }
            }
            return rows;
        }
    }
    JSONObject create(String goal, String name, JSONArray steps, String sourceTurn) throws Exception {
        synchronized (LOCK) {
            if (goal.trim().isEmpty() || goal.length() > 2000 || name.trim().isEmpty() || name.length() > 100) throw new IOException("路线名称或目标无效");
            validateSteps(steps);
            JSONObject route = new JSONObject().put("id", UUID.randomUUID().toString()).put("name", name).put("goal", goal)
                .put("steps", new JSONArray(steps.toString())).put("sourceTurn", sourceTurn).put("createdAt", System.currentTimeMillis())
                .put("successes", 0).put("consecutiveMisses", 0).put("missStep", -1).put("disabled", false);
            write(route); return route;
        }
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
            route.put("successes", route.optInt("successes") + 1).put("consecutiveMisses", 0).put("missStep", -1).put("lastUsedAt", System.currentTimeMillis());
            write(route); return route;
        }
    }
    void delete(String id) throws Exception { synchronized (LOCK) { AtomicFile record = file(id); record.delete(); if (record.getBaseFile().exists()) throw new IOException("路线删除失败"); } }
}
