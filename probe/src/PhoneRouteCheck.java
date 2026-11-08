package ai.eva.android.probe;

import android.app.Instrumentation;
import android.content.Context;
import android.content.ContextWrapper;
import android.os.Bundle;
import java.io.File;
import java.io.IOException;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONArray;
import org.json.JSONObject;

/** Private temporary route-store checks. Does not operate apps or call a cloud model. */
public final class PhoneRouteCheck extends Instrumentation {
    private int checks;
    private void check(boolean passed, String name) { if (!passed) throw new AssertionError(name); checks++; }
    private JSONObject observedOutput(Context context) throws Exception {
        android.content.pm.PackageInfo info = context.getPackageManager().getPackageInfo(context.getPackageName(), 0);
        return new JSONObject().put("completed", true).put("steps", new JSONArray().put(new JSONObject().put("ok", true)))
            .put("learningPackage", context.getPackageName()).put("learningVersion", info.versionName).put("learningVersionCode", info.getLongVersionCode())
            .put("observation", new JSONObject().put("package", context.getPackageName()).put("snapshot", "fixture-snapshot")
                .put("nodes", new JSONArray().put(new JSONObject().put("id", "fixture-settings").put("text", "设置").put("resourceId", "fixture:id/settings"))));
    }
    public void onCreate(Bundle arguments) { super.onCreate(arguments); start(); }
    public void onStart() {
        Bundle result = new Bundle(); File temporary = null;
        try {
            Context original = getTargetContext();
            temporary = new File(original.getCacheDir(), "phone-route-check-" + java.util.UUID.randomUUID());
            if (!temporary.mkdirs()) throw new IOException("test directory");
            final File isolated = temporary;
            Context context = new ContextWrapper(original) { public File getFilesDir() { return isolated; } };
            PhoneRouteStore store = new PhoneRouteStore(context);
            JSONArray steps = new JSONArray("[{action:observe},{action:click,target:{text:'更多'}}]");
            JSONObject route = store.create("open more", "More", steps, "source-turn"); String id = route.getString("id");
            check(store.get(id).getJSONArray("steps").length() == 2, "round trip");
            check(store.list("different goal").length() == 0 && store.list("open more").length() == 1, "exact goal matching");
            boolean rejected = false;
            try { store.get("../escape"); } catch (IOException expected) { rejected = true; }
            check(rejected, "path traversal");
            for (String unsafe : new String[]{"[{action:click,target:{text:'删除'}}]", "[{action:click,target:{resourceId:'opaque:id'}}]", "[{action:input,target:{text:'搜索'},text:'secret'}]", "[{action:click,target:{text:'更多支付'}}]"}) {
                rejected = false; try { PhoneRouteStore.validateSteps(new JSONArray(unsafe)); } catch (IOException expected) { rejected = true; }
                check(rejected, "sensitive or opaque route rejected");
            }
            check(!store.miss(id, 1).getBoolean("disabled"), "first divergence");
            check(!store.miss(id, 0).getBoolean("disabled"), "different step resets consecutive count");
            check(store.miss(id, 0).getBoolean("disabled"), "second same-step divergence disables");
            JSONObject concurrent = store.create("concurrent", "Counters", new JSONArray("[{action:observe}]"), "turn");
            String countId = concurrent.getString("id");
            AtomicReference<Throwable> failure = new AtomicReference<>(); Thread[] workers = new Thread[4];
            for (int i = 0; i < workers.length; i++) {
                workers[i] = new Thread(() -> { try { for (int n = 0; n < 10; n++) store.success(countId); } catch (Throwable error) { failure.set(error); } }); workers[i].start();
            }
            for (Thread worker : workers) worker.join();
            if (failure.get() != null) throw new AssertionError(failure.get());
            check(new PhoneRouteStore(context).get(countId).getInt("successes") == 40, "concurrent atomic increments and reload");
            JSONObject request = new JSONObject().put("threadId", "route-check").put("turnId", "save-turn");
            JSONObject save = new JSONObject().put("action", "save").put("goal", "save goal").put("name", "Saved");
            rejected = false;
            try { PhoneRouteTools.execute(context, save, request, 0, 0); } catch (IOException expected) { rejected = true; }
            check(rejected, "save without successful receipt rejected");
            PhoneRouteTools.candidate("route-check", "source", new JSONObject().put("steps", steps), new JSONObject().put("completed", true).put("steps", new JSONArray("[{ok:true},{ok:false}]")));
            rejected = false;
            try { PhoneRouteTools.execute(context, save, request, 0, 0); } catch (IOException expected) { rejected = true; }
            check(rejected, "fabricated incomplete receipt rejected");
            PhoneRouteTools.candidate("route-check", "source", new JSONObject().put("steps", steps), new JSONObject().put("completed", true).put("steps", new JSONArray("[{ok:true},{ok:true}]")));
            PhoneRouteTools.event(new JSONObject("{method:'turn/completed',params:{threadId:'route-check',turn:{id:source,status:completed}}}"));
            JSONObject saved = PhoneRouteTools.execute(context, save, request, 0, 0).getJSONObject("saved");
            check(saved.getString("sourceTurn").equals("source"), "successful receipt survives turn boundary");
            check(saved.getInt("successes") == 0, "saving does not assert task verification");
            rejected = false;
            try { PhoneRouteTools.execute(context, new JSONObject("{action:confirm,receipt:invented,success:true}"), request, 0, 0); } catch (IOException expected) { rejected = true; }
            check(rejected, "invented confirmation rejected");
            PhoneRouteTools.candidate("route-check", "failed-source", new JSONObject().put("steps", steps), new JSONObject().put("completed", true).put("steps", new JSONArray("[{ok:true},{ok:true}]")));
            PhoneRouteTools.event(new JSONObject("{method:'turn/completed',params:{threadId:'route-check',turn:{id:'failed-source',status:interrupted}}}"));
            rejected = false;
            try { PhoneRouteTools.execute(context, save, request, 0, 0); } catch (IOException expected) { rejected = true; }
            check(rejected, "interrupted source candidate removed");
            JSONObject ok = new JSONObject().put("completed", true).put("steps", new JSONArray("[{ok:true}]"));
            JSONObject observed = new JSONObject().put("steps", new JSONArray("[{action:observe}]"));
            PhoneRouteTools.candidate("route-check", "learn", observed, ok);
            PhoneRouteTools.candidate("route-check", "learn", observed, ok);
            check(ok.getJSONObject("routeLearning").getInt("candidateSteps") == 2, "contiguous batches accumulated");
            JSONObject learned = PhoneRouteTools.execute(context, new JSONObject(save.toString()).put("success", true), request, 0, 0).getJSONObject("saved");
            check(store.get(learned.getString("id")).getJSONArray("steps").length() == 2 && learned.getInt("successes") == 1, "verified learning persisted");
            PhoneRouteTools.candidate("route-check", "learn", observed, ok);
            PhoneRouteTools.candidate("route-check", "other-turn", observed, ok);
            check(ok.getJSONObject("routeLearning").getInt("candidateSteps") == 1, "turns never merged");
            PhoneRouteTools.candidate("route-check", "other-turn", observed, new JSONObject().put("completed", false));
            rejected = false;
            try { PhoneRouteTools.execute(context, save, request, 0, 0); } catch (IOException expected) { rejected = true; }
            check(rejected, "failed batch invalidates learning chain");
            JSONArray appSteps = new JSONArray("[{action:open_app,package:'example.calculator'},{action:click,target:{text:'更多'}}]");
            JSONObject binding = new JSONObject("{package:'example.calculator',version:'1.2',versionCode:12}");
            JSONObject bound = store.create("settings", "App settings", appSteps, "app-turn", binding);
            check(store.list("settings", "example.calculator").length() == 1 && store.list("settings", "example.other").length() == 0, "App route isolation");
            JSONObject restored = new PhoneRouteStore(context).get(bound.getString("id"));
            check(restored.getLong("appVersionCode") == 12 && restored.getString("appVersion").equals("1.2"), "installed version persisted");
            check(restored.getJSONObject("startTarget").getString("text").equals("更多") && restored.getJSONArray("steps").getJSONObject(1).getString("before_package").equals("example.calculator"), "entry target and App guard persisted");
            check(store.list("open more").getJSONObject(0).optBoolean("needsRelearning"), "legacy routes remain readable with relearning marker");
            JSONObject legacyReplay = PhoneRouteTools.execute(context, new JSONObject().put("action", "replay").put("id", learned.getString("id")).put("goal", "save goal"), request, 0, 0);
            check(legacyReplay.optBoolean("needsRelearning") && !legacyReplay.optBoolean("actionExecuted"), "legacy route requires relearning before dispatch");
            long installedVersion = context.getPackageManager().getPackageInfo(context.getPackageName(), 0).getLongVersionCode();
            JSONObject staleVersion = store.create("version check", "Stale version", new JSONArray("[{action:observe}]"), "app-turn",
                new JSONObject().put("package", context.getPackageName()).put("versionCode", installedVersion + 1));
            JSONObject rejectedVersion = PhoneRouteTools.execute(context, new JSONObject().put("action", "replay").put("id", staleVersion.getString("id")).put("goal", "version check"), request, 0, 0);
            check(rejectedVersion.optBoolean("needsRelearning") && !rejectedVersion.optBoolean("actionExecuted"), "changed App version rejected before phone dispatch");
            JSONObject appOk = new JSONObject().put("completed", true).put("steps", new JSONArray("[{ok:true}]")).put("learningPackage", "example.one").put("learningVersionCode", 1);
            PhoneRouteTools.candidate("route-check", "apps", observed, appOk);
            appOk.put("learningPackage", "example.two");
            PhoneRouteTools.candidate("route-check", "apps", observed, appOk);
            check(appOk.getJSONObject("routeLearning").getInt("candidateSteps") == 1, "different App batches never merged");
            PhoneRouteTools.candidate("route-check", "apps", observed, new JSONObject(appOk.toString()).put("learningMixedApps", true));
            rejected = false;
            try { PhoneRouteTools.execute(context, save, request, 0, 0); } catch (IOException expected) { rejected = true; }
            check(rejected, "cross App batch cannot be learned as one route");
            check(PhoneRouteStore.calibration(restored, 12).getString("state").equals("candidate"), "saved candidate is not shown as verified");
            JSONObject verifiedRoute = store.success(restored.getString("id"));
            check(PhoneRouteStore.calibration(verifiedRoute, 12).getBoolean("verified"), "same-version verified calibration");
            check(PhoneRouteStore.calibration(verifiedRoute, 13).getBoolean("needsRelearning"), "upgrade reported stale before replay");
            check(PhoneRouteStore.calibration(verifiedRoute, -1).getString("state").equals("app_unavailable"), "unavailable App has no verified status");
            check(PhoneRouteStore.calibration(learned, installedVersion).getBoolean("needsRelearning"), "legacy calibration remains untrusted");
            JSONObject disabledStatus = new JSONObject(verifiedRoute.toString()).put("disabled", true);
            check(PhoneRouteStore.calibration(disabledStatus, 12).getString("state").equals("disabled"), "disabled route not shown as verified");
            JSONObject emptyApp = PhoneRouteTools.list(context, store, "unused-status-goal", context.getPackageName());
            check(emptyApp.getJSONObject("appLearning").getString("state").equals("unlearned"), "unknown goal exposes actionable unlearned state");
            JSONObject staleList = PhoneRouteTools.list(context, store, "version check", context.getPackageName()).getJSONArray("routes").getJSONObject(0);
            check(staleList.getBoolean("needsRelearning") && staleList.getJSONObject("calibration").getLong("installedVersionCode") == installedVersion, "list evaluates actual installed version");
            JSONObject safeNavigation = new JSONObject().put("steps", new JSONArray("[{action:click,target:{text:'更多'}}]"));
            JSONObject automatic = observedOutput(context);
            PhoneRouteTools.candidate(context, "route-check", "auto-first", safeNavigation, automatic);
            JSONObject automaticRoute = automatic.getJSONObject("routeLearning").getJSONObject("route");
            String automaticId = automaticRoute.getString("id");
            check(automatic.getJSONObject("routeLearning").getBoolean("autoSaved") && store.get(automaticId).getString("provenance").equals("observed-safe-navigation"), "safe observed batch automatically persisted without save");
            check(PhoneRouteStore.calibration(store.get(automaticId), installedVersion).getString("state").equals("observed") && automaticRoute.getInt("successes") == 0, "automatic observation does not assert goal verification");
            JSONObject repeated = observedOutput(context);
            PhoneRouteTools.candidate(context, "route-check", "auto-second", safeNavigation, repeated);
            check(repeated.getJSONObject("routeLearning").getJSONObject("route").getString("id").equals(automaticId) && store.get(automaticId).getInt("observations") == 2, "repeated path upserts the same automatic route");
            JSONObject automaticRequest = new JSONObject().put("threadId", "route-check").put("turnId", "auto-second");
            JSONObject automaticConfirmation = PhoneRouteTools.execute(context, new JSONObject().put("action", "confirm").put("receipt", repeated.getJSONObject("routeLearning").getString("receipt")).put("success", true), automaticRequest, 0, 0);
            check(automaticConfirmation.getBoolean("verified") && store.get(automaticId).getInt("successes") == 1, "actual automatic batch receipt promotes verified status");
            JSONObject untrustedConfirmation = new JSONObject().put("action", "confirm").put("receipt", "invented-auto-receipt").put("success", true);
            rejected = false;
            try { PhoneRouteTools.execute(context, untrustedConfirmation, automaticRequest, 0, 0); } catch (IOException expectedError) { rejected = true; }
            check(rejected, "automatic learning does not permit invented verification receipts");
            int beforeRejectedLearning = store.list("").length();
            PhoneRouteTools.candidate(context, "route-check", "auto-opt-out", new JSONObject(safeNavigation.toString()).put("learn", false), observedOutput(context));
            check(store.get(automaticId).getInt("observations") == 2, "explicit no-learning request does not record another observation");
            JSONObject failedBatch = observedOutput(context).put("completed", false);
            PhoneRouteTools.candidate(context, "route-check", "auto-failed", safeNavigation, failedBatch);
            check(store.list("").length() == beforeRejectedLearning, "failed batch does not automatically learn");
            PhoneRouteTools.candidate(context, "route-check", "auto-input", new JSONObject().put("steps", new JSONArray("[{action:input,target:{text:'搜索'},text:'fixture'}]")), observedOutput(context));
            check(store.list("").length() == beforeRejectedLearning, "input is excluded from automatic learning");
            JSONObject unreadable = observedOutput(context);
            unreadable.getJSONObject("observation").put("nodes", new JSONArray());
            PhoneRouteTools.candidate(context, "route-check", "auto-unreadable", safeNavigation, unreadable);
            check(store.list("").length() == beforeRejectedLearning, "unreadable endpoint cannot be auto-calibrated");
            PhoneRouteTools.candidate(context, "route-check", "auto-wrong-version", safeNavigation, observedOutput(context).put("learningVersionCode", installedVersion + 1));
            check(store.list("").length() == beforeRejectedLearning && PhoneRouteStore.calibration(store.get(automaticId), installedVersion + 1).getBoolean("needsRelearning"), "automatic routes require the actual installed version");
            check(PhoneRouteTools.endpointMatches(store.get(automaticId), observedOutput(context).getJSONObject("observation")) && !PhoneRouteTools.endpointMatches(store.get(automaticId), unreadable.getJSONObject("observation")), "automatic replay endpoint binding checked without dispatch");
            JSONObject afterVerified = observedOutput(context);
            PhoneRouteTools.candidate(context, "route-check", "auto-third", safeNavigation, afterVerified);
            check(store.get(automaticId).getInt("successes") == 1 && store.get(automaticId).getString("goal").equals(automaticRoute.getString("goal")), "new observations preserve verified history and saved goal");
            PhoneBatchCheck.Fake navigation = new PhoneBatchCheck.Fake();
            navigation.app = context.getPackageName(); navigation.firstLabel = ""; navigation.firstDescription = "更多"; navigation.nextLabel = "设置";
            JSONObject firstArgs = PhoneBatchCheck.args("[{action:click,target:{resourceId:'fixture:id/action'},expect:'设置'}]");
            JSONObject firstBatch = PhoneBatch.run(firstArgs, navigation).put("learningVersionCode", installedVersion).put("learningVersion", "fixture");
            PhoneRouteTools.candidate(context, "route-check", "canonical-chain", firstArgs, firstBatch);
            check(firstBatch.getJSONObject("routeLearning").getBoolean("autoSaved"), "observed resource-only safe navigation auto-saves its first batch");
            JSONObject secondArgs = PhoneBatchCheck.args("[{action:click,target:{text:'设置'}}]");
            JSONObject secondBatch = PhoneBatch.run(secondArgs, navigation).put("learningVersionCode", installedVersion).put("learningVersion", "fixture");
            PhoneRouteTools.candidate(context, "route-check", "canonical-chain", secondArgs, secondBatch);
            JSONObject canonicalRoute = store.get(secondBatch.getJSONObject("routeLearning").getJSONObject("route").getString("id"));
            check(canonicalRoute.getJSONArray("steps").length() == 2, "two actual successful batches aggregate the complete navigation path");
            check(canonicalRoute.getJSONObject("startTarget").getString("description").equals("更多") && canonicalRoute.getJSONArray("steps").getJSONObject(1).getJSONObject("target").getString("text").equals("设置"), "aggregated route starts at actual more control rather than the later menu");
            check(!firstArgs.getJSONArray("steps").getJSONObject(0).getJSONObject("target").has("description"), "canonical route learning preserves original ID-only arguments");
            int beforeUnsafeCanonical = store.list("").length();
            JSONObject unsafeCanonical = new JSONObject(secondBatch.toString()).put("learningRejected", true);
            unsafeCanonical.remove("routeLearning");
            PhoneRouteTools.candidate(context, "route-check", "canonical-chain", secondArgs, unsafeCanonical);
            check(!unsafeCanonical.has("routeLearning") && store.list("").length() == beforeUnsafeCanonical, "rejected canonical evidence cannot silently fall back to original selectors");
            store.delete(id); check(store.list("open more").length() == 0, "delete");
            result.putString("stream", "PASS phone routes " + checks + " checks\n");
        } catch (Throwable error) { result.putString("stream", "FAIL phone routes " + error + "\n"); }
        finally {
            PhoneRouteTools.clear("route-check");
            if (temporary != null) {
                File directory = new File(temporary, "phone-routes"); File[] records = directory.listFiles();
                if (records != null) for (File record : records) record.delete();
                directory.delete(); temporary.delete();
            }
        }
        finish(result.getString("stream", "").startsWith("PASS") ? -1 : 0, result);
    }
}
