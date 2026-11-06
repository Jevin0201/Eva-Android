package ai.eva.android.probe;

import android.content.Context;
import java.io.IOException;
import org.json.JSONObject;

/** One task leases the visible page. All dispatch callbacks revalidate the same lease. */
final class BrowserOwnership {
    static final class Lease {
        final String thread, turn, key;
        BrowserWindow window;
        boolean released;
        Lease(JSONObject params) {
            thread = params.optString("threadId");
            turn = params.optString("turnId");
            key = KernelHost.turnKey(params);
        }
    }
    private static Lease current;

    static synchronized Lease claim(JSONObject params) throws Exception {
        KernelHost.guardTurn(params);
        if (params.optString("threadId").isEmpty() || params.optString("turnId").isEmpty())
            throw new IOException("浏览器操作缺少任务标识");
        if (current != null && !current.key.equals(KernelHost.turnKey(params)))
            throw new IOException("另一个任务正在使用此网页，请先结束该任务");
        PhoneResourceScheduler.reserve(params,PhoneResourceScheduler.BROWSER_PAGE);
        if (current == null) {
            current = new Lease(params);
            current.window = BrowserWindow.live;
        }
        return current;
    }

    static synchronized void validate(Lease lease, BrowserWindow window) throws IOException {
        if (lease == null) return; // Local browser self-check has no model turn.
        if (current != lease || lease.released || KernelHost.cancelledTurns.contains(lease.key))
            throw new IOException("网页控制已交还，当前操作已取消");
        if (window != null) {
            if (lease.window == null) lease.window = window;
            else if (lease.window != window) throw new IOException("网页窗口已更换，请重新发起任务");
        }
    }

    static synchronized void opened(BrowserWindow window) {
        if (current != null && current.window == null && !current.released)
            current.window = window;
    }

    static synchronized void release(String key) {
        if (current != null && current.key.equals(key)) {
            try { PhoneResourceScheduler.releaseResources(new JSONObject().put("threadId",current.thread).put("turnId",current.turn),PhoneResourceScheduler.BROWSER_PAGE); } catch(Exception ignored) {}
            current.released = true;
            current = null;
        }
    }

    static synchronized void releaseThread(String thread) {
        if (current != null && current.thread.equals(thread)) release(current.key);
    }

    static void userTakeover(BrowserWindow window, String reason) {
        Lease lease;
        synchronized (BrowserOwnership.class) {
            lease = current;
            if (lease == null || lease.window != window) return;
            KernelHost.cancelledTurns.add(lease.key);
            release(lease.key);
        }
        BrowserTools.cancelTurn(lease.key);
        window.status(reason + "，Eva 已停止操作网页");
        Context context = window.getContext().getApplicationContext();
        KernelHost host = KernelHost.forThread(context, lease.thread);
        host.work.execute(() -> {
            try {
                host.dispatch("turn/interrupt", new JSONObject().put("threadId", lease.thread).put("turnId", lease.turn));
            } catch (Exception error) {
                android.util.Log.w("EvaBrowser", "Browser takeover interrupt failed", error);
            }
        });
    }
}
