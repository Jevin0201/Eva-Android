package ai.eva.android.probe;

import android.app.Instrumentation;
import android.content.Intent;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.MotionEvent;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import org.json.JSONArray;
import org.json.JSONObject;

/** Runs exclusively against an in-memory page, with native touch and real WebView callbacks. */
public final class BrowserHandoverDeviceCheck extends Instrumentation {
    public void onCreate(Bundle args) { super.onCreate(args); start(); }
    static void check(boolean value, String message) throws Exception {
        if (!value) throw new Exception(message);
    }
    JSONObject params(String turn) throws Exception {
        return new JSONObject().put("threadId", "browser-handover-fixture").put("turnId", turn);
    }
    String js(BrowserWindow window, String script) throws Exception {
        CompletableFuture<String> value = new CompletableFuture<>();
        runOnMainSync(() -> window.browser.evaluateJavascript(script, value::complete));
        return value.get(5, TimeUnit.SECONDS);
    }
    JSONObject execute(JSONObject args, BrowserOwnership.Lease lease) throws Exception {
        return BrowserTools.execute(getTargetContext(), args, lease).get(8, TimeUnit.SECONDS);
    }
    String node(JSONObject observation, String tag) throws Exception {
        JSONArray nodes = observation.getJSONArray("nodes");
        for (int i = 0; i < nodes.length(); i++) {
            JSONObject node = nodes.getJSONObject(i);
            if (tag.equals(node.optString("tag"))) return node.getString("id");
        }
        throw new Exception("Missing fixture node " + tag);
    }
    void rejected(CompletableFuture<JSONObject> future, String message) throws Exception {
        boolean failed = false;
        try { future.get(8, TimeUnit.SECONDS); } catch (java.util.concurrent.ExecutionException | java.util.concurrent.CancellationException expected) { failed = true; }
        check(failed, message);
    }
    void touch(BrowserWindow window) {
        runOnMainSync(() -> {
            long now = SystemClock.uptimeMillis();
            MotionEvent down = MotionEvent.obtain(now, now, MotionEvent.ACTION_DOWN, 15, 15, 0);
            MotionEvent up = MotionEvent.obtain(now, now + 40, MotionEvent.ACTION_UP, 15, 15, 0);
            try { window.browser.dispatchTouchEvent(down); window.browser.dispatchTouchEvent(up); }
            finally { down.recycle(); up.recycle(); }
        });
    }
    public void onStart() {
        Bundle result = new Bundle();
        BrowserWindow window = null;
        int code = 0;
        try {
            ShellActivity shell = (ShellActivity) startActivitySync(new Intent(getTargetContext(), ShellActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            runOnMainSync(() -> shell.showBrowser(new Intent()));
            window = BrowserWindow.live;
            check(window != null, "Browser did not open");
            BrowserWindow b = window;
            runOnMainSync(() -> {
                b.browser.loadDataWithBaseURL("https://eva-browser-test.invalid/", "<html><body><h1>Handover fixture</h1><input aria-label='Fixture input'><button onclick='window.clicks=(window.clicks||0)+1'>Apply</button></body></html>", "text/html", "UTF-8", null);
                b.windowMode(false, false);
            });
            long deadline = SystemClock.elapsedRealtime() + 6000;
            while (!"true".equals(js(b, "!!document.querySelector('input')"))) {
                if (SystemClock.elapsedRealtime() >= deadline) throw new Exception("Fixture load timed out");
                Thread.sleep(60);
            }
            BrowserOwnership.Lease first = BrowserOwnership.claim(params("touch"));
            JSONObject observation = execute(new JSONObject().put("action", "observe"), first);
            JSONObject entered = execute(new JSONObject().put("action", "input").put("snapshot", observation.getString("snapshot")).put("node", node(observation, "INPUT")).put("text", "交接验收"), first);
            check("true".equals(js(b, "document.querySelector('input').value==='交接验收'")), "Input failed");
            CompletableFuture<JSONObject> pending = BrowserTools.execute(getTargetContext(), new JSONObject().put("action", "click").put("snapshot", entered.getString("snapshot")).put("node", node(entered, "BUTTON")), first);
            touch(b);
            rejected(pending, "Touch returned a normal successful observation");
            check(KernelHost.cancelledTurns.contains(first.key), "Touch did not cancel model turn");
            String clicks = js(b, "window.clicks||0");
            rejected(BrowserTools.execute(getTargetContext(), new JSONObject().put("action", "click").put("snapshot", entered.getString("snapshot")).put("node", node(entered, "BUTTON")), first), "Old lease executed click");
            check(clicks.equals(js(b, "window.clicks||0")), "Stale action changed page");
            BrowserOwnership.Lease second = BrowserOwnership.claim(params("minimized"));
            runOnMainSync(() -> b.windowMode(false, true));
            check(BrowserWindow.live == b && b.browser != null, "Minimize destroyed page");
            JSONObject minimized = execute(new JSONObject().put("action", "observe"), second);
            JSONObject clicked = execute(new JSONObject().put("action", "click").put("snapshot", minimized.getString("snapshot")).put("node", node(minimized, "BUTTON")), second);
            check(clicked.optBoolean("dispatched"), "Minimized task could not act");
            check(Integer.parseInt(js(b, "window.clicks||0")) == Integer.parseInt(clicks) + 1, "Minimized click count wrong");
            BrowserOwnership.release(second.key);
            BrowserOwnership.Lease third = BrowserOwnership.claim(params("close"));
            check(third != second, "Completion retained previous lease");
            runOnMainSync(b::finish);
            check(BrowserWindow.live == null, "Close retained browser");
            check(b.browser == null && b.destroyed, "Close left a live WebView");
            runOnMainSync(() -> shell.showBrowser(new Intent()));
            BrowserWindow replacement = BrowserWindow.live;
            check(replacement != null && replacement != b, "Close did not permit reopening");
            runOnMainSync(b::destroyBrowser);
            check(BrowserWindow.live == replacement && replacement.browser != null, "Old dismiss callback destroyed replacement");
            runOnMainSync(replacement::finish);
            check(KernelHost.cancelledTurns.contains(third.key), "Close did not cancel task");
            rejected(BrowserTools.execute(getTargetContext(), new JSONObject().put("action", "observe"), third), "Destroyed page accepted stale lease");
            result.putString("result", "PASS real WebView observe/input; native touch cancels pending observation and old actions; no stale click; minimized page continues; completion hands back; close cancels and releases");
        } catch (Exception error) {
            code = 1;
            result.putString("error", error.toString());
        } finally {
            BrowserOwnership.releaseThread("browser-handover-fixture");
            if (window != null) { BrowserWindow b = window; runOnMainSync(b::finish); }
            KernelHost.cancelledTurns.remove("browser-handover-fixture:touch");
            KernelHost.cancelledTurns.remove("browser-handover-fixture:minimized");
            KernelHost.cancelledTurns.remove("browser-handover-fixture:close");
        }
        finish(code, result);
    }
}
