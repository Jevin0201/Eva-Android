package ai.eva.android.probe;

import android.content.Context;
import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;
import org.json.JSONArray;
import org.json.JSONObject;

/** Explicit save/replay of successful native batches, separate from preference memory. */
final class PhoneRouteTools {
    private static final ConcurrentHashMap<String, Candidate> candidates = new ConcurrentHashMap<>();
    private static final ConcurrentHashMap<String, Replay> replays = new ConcurrentHashMap<>();
    static final class Candidate {
        final String turn; final JSONArray steps; final long at;
        Candidate(String turn, JSONArray steps) { this.turn = turn; this.steps = steps; at = System.currentTimeMillis(); }
    }
    static final class Replay {
        final String id, turn, token; boolean confirmed;
        Replay(String id, String turn) { this.id = id; this.turn = turn; token = java.util.UUID.randomUUID().toString(); }
    }
    static void candidate(String thread, String turn, JSONObject arguments, JSONObject output) {
        candidates.remove(thread);
        try {
            if (!output.optBoolean("completed") || output.has("actionError")) return;
            JSONArray steps = arguments.getJSONArray("steps"), results = output.getJSONArray("steps");
            if (results.length() != steps.length()) return;
            for (int i = 0; i < results.length(); i++) if (!results.getJSONObject(i).optBoolean("ok")) return;
            PhoneRouteStore.validateSteps(steps);
            if (candidates.size() >= 64) {
                String oldest = null; long timestamp = Long.MAX_VALUE;
                for (java.util.Map.Entry<String, Candidate> entry : candidates.entrySet()) if (entry.getValue().at < timestamp) { oldest = entry.getKey(); timestamp = entry.getValue().at; }
                if (oldest != null) candidates.remove(oldest);
            }
            candidates.put(thread, new Candidate(turn, new JSONArray(steps.toString())));
        } catch (Exception ignored) { /* Learning must never fail the completed operation. */ }
    }
    static void event(JSONObject row) {
        if (!row.optString("method").equals("turn/completed")) return;
        JSONObject params = row.optJSONObject("params"); if (params == null) return;
        String thread = params.optString("threadId"); JSONObject turn = params.optJSONObject("turn");
        if (turn == null) return;
        Replay replay = replays.get(thread);
        if (replay != null && replay.turn.equals(turn.optString("id"))) replays.remove(thread, replay);
        Candidate candidate = candidates.get(thread);
        if (candidate != null && candidate.turn.equals(turn.optString("id")) && !turn.optString("status").equals("completed")) candidates.remove(thread, candidate);
    }
    static void cancel(String thread, String turn) {
        Candidate candidate = candidates.get(thread);
        if (candidate != null && candidate.turn.equals(turn)) candidates.remove(thread, candidate);
        Replay replay = replays.get(thread);
        if (replay != null && replay.turn.equals(turn)) replays.remove(thread, replay);
    }
    static void clear(String thread) { candidates.remove(thread); replays.remove(thread); }
    static JSONObject spec() throws Exception {
        JSONObject fields = new JSONObject().put("action", new JSONObject().put("type", "string").put("enum", new JSONArray(new String[]{"list", "save", "replay", "confirm", "delete"})));
        for (String key : new String[]{"id", "goal", "name", "receipt"}) fields.put(key, new JSONObject().put("type", "string"));
        fields.put("success", new JSONObject().put("type", "boolean"));
        return new JSONObject().put("name", "eva_phone_route").put("description", "Manage reusable phone navigation routes. list optionally filters by exact goal. save requires explicit user instruction to save this successful route, name and goal; copies only the latest actually successful eva_phone_steps receipt in this conversation (within 30 minutes), never invent steps. replay requires id and the exact saved goal, only for the user's currently authorized task; routes reject input, opaque clicks and sensitive actions. Replay uses live target matching, conditions and interruption, stops on divergence and returns current observation for model verification. It does NOT prove task completion. After verifying the replay actually achieved the goal against current observation, call confirm with its receipt and success=true to record success; success=false records failed verification. Never confirm based only on dispatched/completed flags. Same-step divergence twice disables the route. delete requires user request. No user preferences are learned.")
            .put("inputSchema", new JSONObject().put("type", "object").put("properties", fields).put("required", new JSONArray().put("action")).put("additionalProperties", false));
    }
    static JSONObject execute(Context context, JSONObject args, JSONObject request, long epoch, long revision) throws Exception {
        for (String field : new String[]{"action", "id", "goal", "name", "receipt"}) if (args.has(field) && (!(args.get(field) instanceof String) || args.getString(field).length() > 2000)) throw new IOException("路线参数类型或长度无效");
        String action = args.getString("action"), thread = request.getString("threadId"), turn = request.optString("turnId");
        PhoneRouteStore store = new PhoneRouteStore(context);
        if (action.equals("list")) return new JSONObject().put("routes", store.list(args.optString("goal"))).put("matching", "exact-goal");
        if (action.equals("save")) {
            Candidate candidate = candidates.get(thread);
            if (candidate == null || System.currentTimeMillis() - candidate.at > 30 * 60 * 1000) throw new IOException("没有可保存的近期成功批处理");
            JSONObject saved = store.create(args.getString("goal"), args.getString("name"), candidate.steps, candidate.turn);
            candidates.remove(thread, candidate); saved.remove("steps"); return new JSONObject().put("saved", saved);
        }
        if (action.equals("delete")) { store.delete(args.getString("id")); return new JSONObject().put("deleted", true); }
        if (action.equals("confirm")) {
            Replay replay = replays.get(thread);
            if (replay == null || !replay.turn.equals(turn) || !replay.token.equals(args.getString("receipt"))) throw new IOException("没有本回合可核验的回放记录");
            if (!(args.get("success") instanceof Boolean)) throw new IOException("核验结论必须为布尔值");
            synchronized (replay) {
                if (replay.confirmed) throw new IOException("此回放已核验");
                JSONObject result = args.getBoolean("success") ? store.success(replay.id) : store.miss(replay.id, -2);
                replay.confirmed = true; result.remove("steps"); return new JSONObject().put("verified", args.getBoolean("success")).put("route", result);
            }
        }
        if (!action.equals("replay")) throw new IOException("未知路线操作");
        replays.remove(thread);
        JSONObject route = store.get(args.getString("id"));
        if (!route.getString("goal").equals(args.getString("goal"))) throw new IOException("任务目标未精确匹配路线");
        if (route.optBoolean("disabled")) throw new IOException("路线因重复偏离已停用，请重新完成流程再保存");
        JSONArray steps = route.getJSONArray("steps"); PhoneRouteStore.validateSteps(steps);
        KernelHost.guardTurn(request);
        if (epoch != PhoneAccessibility.generation || revision != PhoneBatch.revision(thread)) throw new IOException("回放已取消或收到新消息");
        synchronized (PhoneTools.class) { PhoneTools.reserveTask(request,new JSONObject());PhoneTools.bind(thread); PhoneTools.turn = turn; }
        if(PhoneAgentDisplay.active!=null)PhoneAgentPreview.show(context);
        JSONObject output = PhoneBatch.execute(context, new JSONObject().put("steps", steps), request, epoch, revision);
        output.put("taskVerified", false).put("instruction", "检查当前 observation 和已执行步骤，核验任务结果后再 confirm。偏离时从当前页面继续，不要重放已执行操作。");
        if (output.optBoolean("completed")) {
            Replay replay = new Replay(route.getString("id"), turn); replays.put(thread, replay); output.put("receipt", replay.token);
        } else if (epoch == PhoneAccessibility.generation && revision == PhoneBatch.revision(thread) && !KernelHost.cancelledTurns.contains(KernelHost.turnKey(request))) {
            JSONArray results = output.getJSONArray("steps"); int failed = -1;
            for (int i = 0; i < results.length(); i++) if (!results.getJSONObject(i).optBoolean("ok") && !results.getJSONObject(i).optBoolean("skipped")) { failed = i; break; }
            try { JSONObject updated = store.miss(route.getString("id"), failed); output.put("routeDisabled", updated.optBoolean("disabled")); }
            catch (Exception error) { output.put("routeWarning", "回放结果已返回，路线统计保存失败"); }
        }
        return output;
    }
    static boolean handle(KernelHost host, JSONObject request) {
        if (!request.optString("method").equals("item/tool/call")) return false;
        JSONObject params = request.optJSONObject("params");
        if (params == null || !params.optString("tool").equals("eva_phone_route")) return false;
        long epoch = PhoneAccessibility.generation, revision = PhoneBatch.revision(params.optString("threadId"));
        PhoneTools.serial.execute(() -> {
            JSONObject result = new JSONObject();
            try {
                KernelHost.guardTurn(params);
                JSONObject output = execute(host.context, params.getJSONObject("arguments"), params, epoch, revision);
                JSONArray items = new JSONArray();
                if (output.has("imageUrl")) { items.put(new JSONObject().put("type", "inputImage").put("imageUrl", output.getString("imageUrl"))); output.remove("imageUrl"); }
                items.put(new JSONObject().put("type", "inputText").put("text", output.toString()));
                result.put("success", !output.has("actionError")).put("contentItems", items);
            } catch (Exception error) {
                try { result.put("success", false).put("contentItems", new JSONArray().put(new JSONObject().put("type", "inputText").put("text", error.getMessage() == null ? "路线操作失败" : error.getMessage()))); } catch (Exception ignored) { }
            }
            try { host.write(new JSONObject().put("id", request.get("id")).put("result", result)); } catch (Exception ignored) { }
        });
        return true;
    }
}
