package ai.eva.android.probe;

import android.app.Instrumentation;
import android.os.Bundle;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.IOException;

/** Isolated batch regression checks with deterministic screens and no phone side effects. */
public final class PhoneBatchCheck extends Instrumentation {
    int checks;
    void check(boolean condition, String message) { if (!condition) throw new AssertionError(message); checks++; }
    static final class Fake implements PhoneBatch.Backend {
        long clock; int actions, reads, failAt = -1; boolean cancelled, switchAfterAction, cancelAfterAction;
        JSONObject screen() throws Exception { return new JSONObject().put("snapshot", "s" + reads).put("package", switchAfterAction && actions > 0 ? "another.app" : "fixture.app").put("nodes", new JSONArray().put(new JSONObject().put("id", "n" + reads).put("text", actions > 0 ? "Done" : "Apply").put("resourceId", "fixture:id/action"))); }
        public JSONObject execute(JSONObject args) throws Exception {
            if (args.getString("action").equals("observe")) { reads++; return screen(); }
            if (actions == failAt) throw new IOException("dispatch failed");
            if (!args.getString("snapshot").equals("s" + reads) || !args.getString("node").equals("n" + reads)) throw new AssertionError("stale target");
            actions++; if (cancelAfterAction) cancelled = true; return screen().put("dispatched", true);
        }
        public void guard() throws Exception { if (cancelled) throw new IOException("cancelled"); }
        public long now() { return clock; }
        public void sleep(long millis) { clock += millis; }
    }
    static JSONObject args(String steps) throws Exception { return new JSONObject().put("steps", new JSONArray(steps)); }
    public void onCreate(Bundle options) { super.onCreate(options); start(); }
    public void onStart() {
        Bundle result = new Bundle();
        try {
            Fake fake = new Fake();
            JSONObject out = PhoneBatch.run(args("[{action:click,target:{text:Apply},expect:Done},{action:click,target:{resourceId:'fixture:id/action'}}]"), fake);
            check(out.getBoolean("completed") && fake.actions == 2, "fresh node and snapshot chaining");
            fake = new Fake();
            out = PhoneBatch.run(args("[{action:click,target:{text:Apply},expect:Missing,timeoutMs:100},{action:click,target:{text:Done}}]"), fake);
            check(!out.getBoolean("completed") && fake.actions == 1, "timeout never replays");
            check(out.getJSONArray("steps").getJSONObject(1).getBoolean("skipped"), "remaining step reported");
            fake = new Fake(); fake.cancelled = true;
            out = PhoneBatch.run(args("[{action:click,target:{text:Apply}},{action:observe}]"), fake);
            check(fake.actions == 0 && fake.reads == 0 && !out.getBoolean("completed"), "cancellation before read");
            fake = new Fake(); fake.failAt = 0;
            out = PhoneBatch.run(args("[{action:click,target:{text:Apply}},{action:observe}]"), fake);
            check(fake.actions == 0 && out.getJSONArray("steps").getJSONObject(1).getBoolean("skipped"), "dispatch exception stops batch");
            fake = new Fake();
            out = PhoneBatch.run(args("[{action:click,target:{text:Apply},before_package:another.app}]"), fake);
            check(fake.actions == 0 && !out.getBoolean("completed"), "package guard");
            fake = new Fake();
            out = PhoneBatch.run(args("[{action:observe,wait_stable:true,expect_package:fixture.app,expect_gone:Missing}]"), fake);
            // Node IDs in this fake change at every read, intentionally keeping its screen unstable.
            check(!out.getBoolean("completed") && fake.clock >= 3000, "unstable tree times out");
            fake = new Fake(); boolean rejected = false;
            try { PhoneBatch.run(args("[{action:click,target:{text:Apply}},{action:shell}]"), fake); } catch (IOException expected) { rejected = true; }
            check(rejected && fake.actions == 0 && fake.reads == 0, "whole batch validated before dispatch");
            JSONObject ambiguous = new Fake().screen();
            ambiguous.getJSONArray("nodes").put(new JSONObject().put("id", "other").put("text", "Apply")); rejected = false;
            try { PhoneBatch.resolve(new JSONObject("{action:click,target:{text:Apply}}"), ambiguous); } catch (IOException expected) { rejected = true; }
            check(rejected, "ambiguous target rejected");
            fake = new Fake(); rejected = false;
            try { PhoneBatch.run(args("[{action:click,target:{text:123}}]"), fake); } catch (IOException expected) { rejected = true; }
            check(rejected && fake.reads == 0, "numeric target rejected before observation");
            fake = new Fake(); fake.switchAfterAction = true;
            out = PhoneBatch.run(args("[{action:click,target:{text:Apply}},{action:click,target:{text:Done}}]"), fake);
            check(!out.getBoolean("completed") && fake.actions == 1, "unexpected App switch stops");
            fake = new Fake(); fake.switchAfterAction = true;
            out = PhoneBatch.run(args("[{action:click,target:{text:Apply},expect_package:another.app},{action:click,target:{text:Done}}]"), fake);
            check(out.getBoolean("completed") && fake.actions == 2, "explicit App switch accepted");
            fake = new Fake(); fake.cancelAfterAction = true;
            out = PhoneBatch.run(args("[{action:click,target:{text:Apply}},{action:click,target:{text:Done}}]"), fake);
            check(!out.getBoolean("completed") && fake.actions == 1, "steering after dispatch stops remaining actions");
            long old = PhoneBatch.revision("check"); PhoneBatch.steer("check");
            check(PhoneBatch.revision("check") != old, "steering revision"); PhoneBatch.end("check");
            result.putString("stream", "PASS phone batch " + checks + " checks\n"); finish(-1, result);
        } catch (Throwable error) { result.putString("stream", "FAIL phone batch " + error + "\n"); finish(0, result); }
    }
}
