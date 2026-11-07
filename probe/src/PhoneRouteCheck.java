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
