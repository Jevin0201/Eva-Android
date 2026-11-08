package ai.eva.android.probe;

import android.content.Context;
import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;
import org.json.JSONArray;
import org.json.JSONObject;

/** Verified learning and replay of native navigation batches. */
final class PhoneRouteTools {
    private static final ConcurrentHashMap<String, Candidate> candidates = new ConcurrentHashMap<>();
    private static final ConcurrentHashMap<String, Replay> replays = new ConcurrentHashMap<>();
    static final class Candidate {
        final String turn; final JSONArray steps; final long at; final JSONObject binding;
        Candidate(String turn, JSONArray steps, JSONObject binding) { this.turn = turn; this.steps = steps; this.binding = binding; at = System.currentTimeMillis(); }
    }
    static final class Replay {
        final String id, turn, token; boolean confirmed;
        Replay(String id, String turn) { this.id = id; this.turn = turn; token = java.util.UUID.randomUUID().toString(); }
    }
    static void candidate(String thread, String turn, JSONObject arguments, JSONObject output) {
        Candidate previous = candidates.remove(thread);
        try {
            if (arguments.has("learn") && !arguments.getBoolean("learn")) return;
            if (!output.optBoolean("completed") || output.has("actionError") || output.optBoolean("learningRejected") || output.optBoolean("learningMixedApps") || output.optBoolean("learningUnavailable")) return;
            JSONObject binding = new JSONObject().put("package", output.optString("learningPackage"))
                .put("version", output.optString("learningVersion")).put("versionCode", output.optLong("learningVersionCode", -1));
            JSONArray steps = output.has("learningSteps") ? output.getJSONArray("learningSteps") : arguments.getJSONArray("steps"), results = output.getJSONArray("steps");
            if (steps.length() != arguments.getJSONArray("steps").length()) return;
            if (results.length() != steps.length()) return;
            for (int i = 0; i < results.length(); i++) if (!results.getJSONObject(i).optBoolean("ok")) return;
            PhoneRouteStore.validateSteps(steps);
            // Only join contiguous batches from the same turn. A failed or unsafe batch
            // invalidates the chain, so a later success cannot conceal a gap.
            JSONArray combined = new JSONArray();
            if (previous != null && previous.turn.equals(turn) && previous.binding.toString().equals(binding.toString()) &&
                    System.currentTimeMillis() - previous.at <= 30 * 60 * 1000 &&
                    previous.steps.length() + steps.length() <= 20) {
                combined = new JSONArray(previous.steps.toString());
            }
            for (int i = 0; i < steps.length(); i++) combined.put(steps.getJSONObject(i));
            steps = combined;
            if (candidates.size() >= 64) {
                String oldest = null; long timestamp = Long.MAX_VALUE;
                for (java.util.Map.Entry<String, Candidate> entry : candidates.entrySet()) if (entry.getValue().at < timestamp) { oldest = entry.getKey(); timestamp = entry.getValue().at; }
                if (oldest != null) candidates.remove(oldest);
            }
            candidates.put(thread, new Candidate(turn, new JSONArray(steps.toString()), binding));
            output.put("routeLearning", new JSONObject().put("candidateSteps", steps.length()).put("package", binding.optString("package"))
                .put("instruction", "核对当前 observation 已达到导航目标后，调用 eva_phone_route save，填写明确 goal、name 和 success=true，自动记住流程。未核验成功则不要保存。后续同类任务先 list 再 replay。"));
        } catch (Exception ignored) { /* Learning must never fail the completed operation. */ }
    }
    static void candidate(Context context, String thread, String turn, JSONObject arguments, JSONObject output) {
        candidate(thread, turn, arguments, output);
        Candidate candidate = candidates.get(thread);
        if (candidate == null || !candidate.turn.equals(turn)) return;
        try {
            String app = candidate.binding.optString("package");
            if (app.isEmpty() || candidate.binding.optLong("versionCode", -1) != installedVersion(context, app)) return;
            JSONObject observation = output.optJSONObject("observation");
            if (observation == null || observation.has("observationError") || observation.optString("snapshot").isEmpty() || !app.equals(observation.optString("package"))) return;
            JSONArray targets = new JSONArray(), nodes = observation.optJSONArray("nodes");
            for (int i = 0; nodes != null && i < nodes.length() && targets.length() < 4; i++) {
                JSONObject node = nodes.getJSONObject(i), target = new JSONObject();
                if (!node.optString("text").isEmpty()) target.put("text", node.getString("text"));
                else if (!node.optString("description").isEmpty()) target.put("description", node.getString("description"));
                else continue;
                if (!node.optString("resourceId").isEmpty()) target.put("resourceId", node.getString("resourceId"));
                try {
                    JSONObject step = new JSONObject().put("action", "click").put("target", target);
                    PhoneRouteStore.validateSteps(new JSONArray().put(step));
                    PhoneBatch.resolve(step, observation);
                    targets.put(target);
                }
                catch (Exception unsafeLabel) { /* Only stable, safe navigation labels bind the endpoint. */ }
            }
            if (targets.length() == 0) return;
            JSONObject endState = new JSONObject().put("package", app).put("targets", targets);
            JSONObject route = new PhoneRouteStore(context).observe(candidate.steps, candidate.binding, endState, turn);
            route.remove("steps");
            Replay verification = new Replay(route.getString("id"), turn);
            replays.put(thread, verification);
            output.put("routeLearning", new JSONObject().put("autoSaved", true).put("route", route).put("receipt", verification.token)
                .put("instruction", "已按该软件与版本自动记录实际成功导航，无须另调 save。核对当前页面确实达到本次导航目标后，可用此 receipt 调 eva_phone_route confirm success=true；仅操作成功不等于业务任务完成。后续 list package 查找并 replay，仍需核验回放结果。"));
        } catch (Exception error) {
            try { output.put("routeLearningWarning", "操作结果保留，自动流程保存未完成：" + error.getMessage()); }
            catch (Exception ignored) { }
        }
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
    static void invalidateCandidate(String thread) { candidates.remove(thread); }
    static void clear(String thread) { candidates.remove(thread); replays.remove(thread); }
    private static long installedVersion(Context context, String app) {
        if (app.isEmpty()) return -1;
        try { return context.getPackageManager().getPackageInfo(app, 0).getLongVersionCode(); }
        catch (android.content.pm.PackageManager.NameNotFoundException unavailable) { return -1; }
    }
    static JSONObject list(Context context, PhoneRouteStore store, String goal, String app) throws Exception {
        JSONArray rows = store.list(goal, app);
        int verified = 0, stale = 0, observed = 0;
        for (int i = 0; i < rows.length(); i++) {
            JSONObject route = rows.getJSONObject(i);
            JSONObject calibration = PhoneRouteStore.calibration(route, installedVersion(context, route.optString("package")));
            route.put("calibration", calibration).put("needsRelearning", calibration.getBoolean("needsRelearning"));
            if (calibration.getBoolean("verified")) verified++;
            if (calibration.getBoolean("needsRelearning")) stale++;
            if (calibration.optString("state").equals("observed")) observed++;
        }
        JSONObject result = new JSONObject().put("routes", rows).put("matching", "exact-goal");
        if (!app.isEmpty()) {
            long version = installedVersion(context, app);
            String state = version < 0 ? "app_unavailable" : verified > 0 ? "available" : observed > 0 ? "observed" : stale > 0 ? "needs_relearning" : rows.length() > 0 ? "candidate" : "unlearned";
            result.put("appLearning", new JSONObject().put("package", app).put("installedVersionCode", version)
                .put("state", state).put("goal", goal).put("routes", rows.length()).put("verifiedRoutes", verified)
                .put("instruction", "按当前软件及版本选择已核验路线。未学习或失效时先用 eva_phone_steps 完成实时导航，核对结果后 save success=true；未知软件无需寻找手工标定入口。坐标手势与输入仍需实时处理。"));
        }
        return result;
    }
    static JSONObject spec() throws Exception {
        JSONObject fields = new JSONObject().put("action", new JSONObject().put("type", "string").put("enum", new JSONArray(new String[]{"list", "save", "replay", "confirm", "delete"})));
        for (String key : new String[]{"id", "goal", "name", "receipt", "package"}) fields.put(key, new JSONObject().put("type", "string"));
        fields.put("success", new JSONObject().put("type", "boolean"));
        return new JSONObject().put("name", "eva_phone_route").put("description", "Manage reusable phone navigation routes. list filters by package and optional exact goal and returns actual installed-version calibration states (verified, observed, candidate, needs_relearning, disabled, app_unavailable), plus appLearning for the queried software. Learn and retrieve routes separately for each App. New routes bind to the observed installed App version. startTarget identifies the required initial navigation control after opening the App. Restore that starting page with live navigation before replay. An app version change requires relearning. Legacy routes remain readable and identify missing bindings with needsRelearning; replay requires relearning those routes before any dispatch. Learn successful navigation as part of the authorized task without asking for a separate save request. At the start of a phone task call list to find a reusable route, reuse its exact goal for replay. Prefer eva_phone_steps for newly explored navigation so it can be learned. Safe batches with valid readable endpoints are automatically saved as observed-safe-navigation. routeLearning returns the route and a verification receipt. Inspect observation before confirm success=true, which promotes it to verified. Do not call save again unless the user requests a custom name or goal. save copies contiguous successful eva_phone_steps batches from the same turn (up to 20 steps, within 30 minutes), never invent steps. Legacy save without success remains an unverified candidate. Do not save if the user asks not to remember. Keep goals specific to the App and destination. Input and external side effects remain live actions outside routes. replay requires id and the exact saved goal, only for the user's currently authorized task; routes reject input, opaque clicks and sensitive actions. Replay uses live target matching, conditions and interruption, stops on divergence and returns current observation for model verification. It does NOT prove task completion. After verifying the replay or newly recorded batch actually achieved the navigation goal against current observation, call confirm with its receipt and success=true to record success; success=false records failed verification. Never confirm based only on dispatched/completed flags. A startStateMismatch requires live navigation to the stated startTarget, without disabling the route. Later same-step divergence twice disables the route. A failed replay already records its failure and has no confirm receipt; do not call confirm without the returned receipt. delete requires user request. No user preferences are learned.")
            .put("inputSchema", new JSONObject().put("type", "object").put("properties", fields).put("required", new JSONArray().put("action")).put("additionalProperties", false));
    }
    static boolean endpointMatches(JSONObject route, JSONObject observation) throws Exception {
        JSONObject endpoint = route.optJSONObject("endState");
        if (endpoint == null) return true;
        if (observation == null || !endpoint.optString("package").equals(observation.optString("package"))) return false;
        JSONArray targets = endpoint.getJSONArray("targets");
        try {
            for (int i = 0; i < targets.length(); i++) PhoneBatch.resolve(new JSONObject().put("action", "click").put("target", targets.getJSONObject(i)), observation);
            return true;
        } catch (IOException mismatch) { return false; }
    }
    static JSONObject execute(Context context, JSONObject args, JSONObject request, long epoch, long revision) throws Exception {
        for (String field : new String[]{"action", "id", "goal", "name", "receipt", "package"}) if (args.has(field) && (!(args.get(field) instanceof String) || args.getString(field).length() > 2000)) throw new IOException("路线参数类型或长度无效");
        String action = args.getString("action"), thread = request.getString("threadId"), turn = request.optString("turnId");
        PhoneRouteStore store = new PhoneRouteStore(context);
        if (action.equals("list")) return list(context, store, args.optString("goal"), args.optString("package"));
        if (action.equals("save")) {
            Candidate candidate = candidates.get(thread);
            if (candidate == null || System.currentTimeMillis() - candidate.at > 30 * 60 * 1000) throw new IOException("没有可保存的近期成功批处理");
            if (args.has("success") && (!(args.get("success") instanceof Boolean) || !args.getBoolean("success"))) throw new IOException("仅可学习已核验成功的流程");
            JSONObject saved = store.create(args.getString("goal"), args.getString("name"), candidate.steps, candidate.turn, candidate.binding);
            if (args.optBoolean("success")) saved = store.success(saved.getString("id"));
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
        candidates.remove(thread);
        JSONObject route = store.get(args.getString("id"));
        if (!route.getString("goal").equals(args.getString("goal"))) throw new IOException("任务目标未精确匹配路线");
        if (route.optBoolean("disabled")) throw new IOException("路线因重复偏离已停用，请重新完成流程再保存");
        String app = route.optString("package", PhoneRouteStore.inferPackage(route.getJSONArray("steps")));
        if (args.has("package") && !args.getString("package").equals(app)) throw new IOException("路线所属软件不匹配");
        long version = route.optLong("appVersionCode", -1);
        if (!route.has("package") || app.isEmpty() || version < 0) return new JSONObject().put("actionExecuted", false)
            .put("actionError", "旧路线缺少软件版本标定，请通过实时导航重新学习").put("needsRelearning", true).put("package", app);
        if (!app.isEmpty() && version >= 0) {
            long currentVersion = installedVersion(context, app);
            if (currentVersion < 0) return new JSONObject().put("actionExecuted", false).put("appUnavailable", true).put("needsRelearning", true).put("actionError", "软件未安装或当前不可查询，请恢复软件后重新核验路线");
            if (currentVersion != version) return new JSONObject().put("actionExecuted", false)
                .put("actionError", "软件版本已变化，请使用实时操作重新学习流程").put("needsRelearning", true).put("package", app);
        }
        JSONArray steps = route.getJSONArray("steps"); PhoneRouteStore.validateSteps(steps);
        KernelHost.guardTurn(request);
        if (epoch != PhoneAccessibility.generation || revision != PhoneBatch.revision(thread)) throw new IOException("回放已取消或收到新消息");
        synchronized (PhoneTools.class) { PhoneTools.reserveTask(request,new JSONObject());PhoneTools.bind(thread); PhoneTools.turn = turn; }
        if(PhoneAgentDisplay.active!=null)PhoneAgentPreview.show(context);
        JSONObject output = PhoneBatch.execute(context, new JSONObject().put("steps", steps), request, epoch, revision);
        if (output.optBoolean("completed") && !endpointMatches(route, output.optJSONObject("observation"))) output.put("completed", false).put("endpointMismatch", true).put("actionError", "回放结束页与学习时的导航端点不符，请实时观察并继续核验");
        output.put("taskVerified", false).put("instruction", "检查当前 observation 和已执行步骤，核验任务结果后再 confirm。偏离时从当前页面继续，不要重放已执行操作。");
        if (output.optBoolean("completed")) {
            Replay replay = new Replay(route.getString("id"), turn); replays.put(thread, replay); output.put("receipt", replay.token);
        } else if (epoch == PhoneAccessibility.generation && revision == PhoneBatch.revision(thread) && !KernelHost.cancelledTurns.contains(KernelHost.turnKey(request))) {
            JSONArray results = output.getJSONArray("steps"); int failed = -1;
            for (int i = 0; i < results.length(); i++) if (!results.getJSONObject(i).optBoolean("ok") && !results.getJSONObject(i).optBoolean("skipped")) { failed = i; break; }
            int firstNavigation = -1;
            for (int i = 0; i < steps.length(); i++) if (steps.getJSONObject(i).has("target")) { firstNavigation = i; break; }
            boolean startMismatch = failed >= 0 && failed == firstNavigation &&
                !results.getJSONObject(failed).optBoolean("attempted") &&
                results.getJSONObject(failed).optString("error").contains("目标控件");
            if (startMismatch) return output.put("startStateMismatch", true).put("startTarget", PhoneRouteStore.firstTarget(steps))
                .put("instruction", "当前页面与学习时的起始页面不符，后续步骤未执行，未停用路线。用实时导航回到包含 startTarget 的页面，再回放。不要调用 confirm。");
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
