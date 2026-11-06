package ai.eva.android.probe;

import android.app.Instrumentation;
import android.os.Bundle;
import org.json.JSONObject;

/** Isolated regression for task ownership and stale callbacks. */
public final class BrowserOwnershipCheck extends Instrumentation {
    public void onCreate(Bundle args) { super.onCreate(args); start(); }
    static void check(boolean ok, String message) throws Exception {
        if (!ok) throw new Exception(message);
    }
    public void onStart() {
        Bundle result = new Bundle();
        int code = 0;
        try {
            JSONObject a = new JSONObject().put("threadId", "browser-fixture-a").put("turnId", "1");
            JSONObject b = new JSONObject().put("threadId", "browser-fixture-b").put("turnId", "1");
            BrowserOwnership.Lease lease = BrowserOwnership.claim(a);
            check(BrowserOwnership.claim(a) == lease, "same turn lost lease");
            boolean blocked = false;
            try { BrowserOwnership.claim(b); } catch (java.io.IOException expected) { blocked = true; }
            check(blocked, "another turn stole lease");
            BrowserOwnership.release(KernelHost.turnKey(b));
            BrowserOwnership.validate(lease, null);
            BrowserOwnership.release(KernelHost.turnKey(a));
            blocked = false;
            try { BrowserOwnership.validate(lease, null); } catch (java.io.IOException expected) { blocked = true; }
            check(blocked, "released callback remained valid");
            BrowserOwnership.Lease next = BrowserOwnership.claim(b);
            BrowserOwnership.releaseThread("browser-fixture-a");
            BrowserOwnership.validate(next, null);
            KernelHost.cancelledTurns.add(next.key);
            blocked = false;
            try { BrowserOwnership.validate(next, null); } catch (java.io.IOException expected) { blocked = true; }
            check(blocked, "cancelled action accepted");
            BrowserOwnership.releaseThread("browser-fixture-b");
            KernelHost.cancelledTurns.remove(next.key);
            BrowserOwnership.Lease retry = BrowserOwnership.claim(b);
            check(retry != next, "next task reused stale lease");
            BrowserOwnership.release(KernelHost.turnKey(b));
            result.putString("result", "PASS browser exclusive ownership, matching release, stale callback and cancellation guards");
        } catch (Exception error) {
            code = 1;
            result.putString("error", error.toString());
        } finally {
            BrowserOwnership.releaseThread("browser-fixture-a");
            BrowserOwnership.releaseThread("browser-fixture-b");
            KernelHost.cancelledTurns.remove("browser-fixture-b:1");
        }
        finish(code, result);
    }
}
