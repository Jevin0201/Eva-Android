package ai.eva.android.probe;

import android.app.Instrumentation;
import android.os.Bundle;
import org.json.JSONObject;
import java.util.Arrays;

/** In-process resource and host-binding fixtures; never dispatches a phone or browser action. */
public final class PhoneResourceSchedulerCheck extends Instrumentation {
    public void onCreate(Bundle args) { super.onCreate(args); start(); }
    static void check(boolean value, String message) throws Exception { if (!value) throw new Exception(message); }
    JSONObject owner(String thread, String turn) throws Exception { return new JSONObject().put("threadId", thread).put("turnId", turn); }
    void busy(JSONObject owner, String expected, long timeout, String... resources) throws Exception {
        boolean blocked = false;
        try { PhoneResourceScheduler.acquire(owner, Arrays.asList(resources), timeout, () -> false); }
        catch (PhoneResourceScheduler.BusyException error) { blocked = expected.equals(error.details.optString("error")); }
        check(blocked, "Expected " + expected);
    }
    void registered(String resource, String thread, String turn) throws Exception {
        org.json.JSONArray rows = PhoneResourceScheduler.diagnostics().getJSONArray("resources");
        boolean found = false;
        for (int i = 0; i < rows.length(); i++) {
            JSONObject row = rows.getJSONObject(i);
            if (resource.equals(row.optString("resource")) && thread.equals(row.optString("threadId")) && turn.equals(row.optString("turnId"))) found = true;
        }
        check(found, "Host entry did not register " + resource);
    }
    public void onStart() {
        Bundle result = new Bundle(); int code = 0;
        String a = "resource-fixture-a", b = "resource-fixture-b", c = "resource-fixture-c";
        boolean armed = PhoneAccessibility.armed;
        String savedOwner = PhoneTools.owner, savedTurn = PhoneTools.turn;
        try {
            JSONObject first = owner(a, "1"), second = owner(b, "1"), newer = owner(a, "2"), third = owner(c, "1");
            String x = "fixture:main", y = "fixture:background", z = "fixture:clipboard";
            PhoneResourceScheduler.reserve(first, x);
            PhoneResourceScheduler.reserve(first, x);
            PhoneResourceScheduler.reserve(second, y);
            busy(third, "resource_busy", 0, z, x);
            PhoneResourceScheduler.reserve(second, z); // Failed atomic request must not hold z.
            busy(first, "resource_busy", 2000, y);
            busy(second, "resource_deadlock", 2000, x);
            PhoneResourceScheduler.releaseTurn(a, "1");
            PhoneResourceScheduler.reserve(newer, x);
            PhoneResourceScheduler.releaseTurn(a, "1");
            busy(third, "resource_busy", 0, x); // Old completion cannot release newer turn.
            PhoneResourceScheduler.releaseResources(second, x); // Non-owner cannot release x.
            busy(third, "resource_busy", 0, x);
            boolean cancelled = false;
            try { PhoneResourceScheduler.acquire(newer, Arrays.asList(z), 0, () -> true); }
            catch (java.io.IOException expected) { cancelled = true; }
            check(cancelled, "Cancellation ignored");
            PhoneResourceScheduler.reserve(third, x); // Cancellation releases only cancelled owner.
            busy(first, "resource_busy", 1, y);
            Thread.sleep(5);
            PhoneResourceScheduler.diagnostics(); // Diagnostics must not reset the expired request deadline.
            PhoneResourceScheduler.reserve(third, x); // Another owner cannot reset it either.
            busy(first, "resource_timeout", 1, y);
            PhoneResourceScheduler.releaseThread(b);
            PhoneResourceScheduler.reserve(first, y, z);
            check(!PhoneResourceScheduler.app("com.example.test", 0).equals(PhoneResourceScheduler.app("com.example.test", 10)), "Android users share app key");
            check(!PhoneResourceScheduler.diagnostics().optBoolean("blocking", true), "Scheduler blocks executor");
            synchronized (PhoneTools.class) {
                PhoneAccessibility.armed = true;
                PhoneTools.owner = "";
                PhoneTools.turn = "";
            }
            JSONObject phone = owner(a, "host-phone"), otherPhone = owner(b, "host-phone");
            JSONObject open = new JSONObject().put("action", "open_app").put("package", "com.example.test");
            PhoneTools.reserveTask(phone, open);
            String screen = PhoneAgentDisplay.displayId() == 0 ? PhoneResourceScheduler.MAIN_SCREEN : PhoneResourceScheduler.BACKGROUND_SCREEN;
            registered(screen, a, "host-phone");
            registered(PhoneResourceScheduler.app("com.example.test", android.os.Process.myUid() / 100000), a, "host-phone");
            boolean hostBusy = false;
            try { PhoneTools.reserveTask(otherPhone, open); }
            catch (PhoneResourceScheduler.BusyException expected) { hostBusy = "resource_busy".equals(expected.details.optString("error")); }
            check(hostBusy, "Phone host bypassed screen reservation");
            PhoneResourceScheduler.releaseTurn(a, "older-phone");
            busy(otherPhone, "resource_busy", 0, screen);
            synchronized (PhoneTools.class) { PhoneTools.bind(a); PhoneTools.turn = "host-phone"; }
            PhoneTools.releaseTurn(a, "older-phone");
            check(a.equals(PhoneTools.owner) && "host-phone".equals(PhoneTools.turn), "Old completion released phone host owner");
            PhoneTools.releaseTurn(a, "host-phone");
            PhoneResourceScheduler.releaseTurn(a, "host-phone");
            PhoneTools.reserveTask(otherPhone, open);
            PhoneResourceScheduler.releaseTurn(b, "host-phone");
            JSONObject browser = owner(a, "host-browser"), otherBrowser = owner(b, "host-browser");
            BrowserOwnership.Lease lease = BrowserOwnership.claim(browser);
            registered(PhoneResourceScheduler.BROWSER_PAGE, a, "host-browser");
            busy(otherBrowser, "resource_busy", 0, PhoneResourceScheduler.BROWSER_PAGE);
            BrowserOwnership.release(lease.key);
            PhoneResourceScheduler.reserve(otherBrowser, PhoneResourceScheduler.BROWSER_PAGE);
            PhoneResourceScheduler.releaseTurn(b, "host-browser");
            result.putString("result", "PASS actual phone reserveTask and browser claim/release integration; atomic reservation, independent screens, busy diagnostics, cycle rejection, bounded timeout, cancellation, exact-turn release, kernel-thread release, Android user app isolation");
        } catch (Exception error) { code = 1; result.putString("error", error.toString()); }
        finally {
            BrowserOwnership.releaseThread(a);
            BrowserOwnership.releaseThread(b);
            PhoneResourceScheduler.releaseThread(a); PhoneResourceScheduler.releaseThread(b); PhoneResourceScheduler.releaseThread(c);
            synchronized (PhoneTools.class) {
                PhoneAccessibility.armed = armed;
                PhoneTools.owner = savedOwner;
                PhoneTools.turn = savedTurn;
            }
        }
        finish(code, result);
    }
}
