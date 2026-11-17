package ai.eva.android.probe;

import android.os.Handler;
import android.os.Looper;
import android.os.Bundle;
import android.content.Intent;
import java.io.IOException;
import org.json.JSONObject;

/** One task leases the visible page. All dispatch callbacks revalidate the same lease. */
final class BrowserOwnership {
    static final class Lease {
        final String thread, turn, key;
        BrowserWindow window;
        boolean released;
        String pause="";
        int reopens;
        Lease(String thread,String turn,String key){this.thread=thread;this.turn=turn;this.key=key;}
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
            final Lease initial=current;
            if(initial.window!=null)new Handler(Looper.getMainLooper()).post(()->{
                synchronized(BrowserOwnership.class){
                    if(current==initial&&initial.window==BrowserWindow.live&&initial.pause.isEmpty())initial.window.windowMode(false,false);
                }
            });
        }
        return current;
    }

    static synchronized Lease await(JSONObject params) throws Exception {
        Lease lease=claim(params);
        while (!lease.pause.isEmpty()) {
            if("unavailable".equals(lease.pause))throw new IOException("无法恢复浏览器；请报告未完成的网页步骤。");
            KernelHost.guardTurn(params);
            BrowserOwnership.class.wait(250);
            if(current==null||!current.key.equals(lease.key))throw new IOException("浏览器任务已结束");
            lease=current;
        }
        return lease;
    }

    static synchronized void afterFailure(JSONObject params,Lease lease)throws Exception {
        KernelHost.guardTurn(params);
        if(current==null||!current.key.equals(lease.key))throw new IOException("浏览器任务已结束");
        if(current!=lease)await(params);
    }

    static synchronized void validate(Lease lease, BrowserWindow window) throws IOException {
        if (lease == null) return; // Local browser self-check has no model turn.
        if (current != lease || lease.released || KernelHost.cancelledTurns.contains(lease.key))
            throw new IOException("网页控制已交还，当前操作已取消");
        if (!lease.pause.isEmpty()) throw new IOException(lease.pause);
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
            BrowserOwnership.class.notifyAll();
        }
    }

    static synchronized void releaseThread(String thread) {
        if (current != null && current.thread.equals(thread)) release(current.key);
    }

    static void notice(BrowserWindow window, Lease lease, String message, boolean paused) {
        try {
            KernelHost.forThread(window.getContext(),lease.thread).emit(new JSONObject().put("method","android/browserStatus")
                .put("params",new JSONObject().put("threadId",lease.thread).put("turnId",lease.turn).put("message",message).put("paused",paused)));
        } catch(Exception ignored) {}
    }

    static synchronized boolean resume(String thread,String turn) {
        Lease lease=current;
        if(lease==null||!lease.thread.equals(thread)||!lease.turn.equals(turn)||!lease.pause.equals("manual")||KernelHost.cancelledTurns.contains(lease.key))return false;
        lease.pause="";BrowserOwnership.class.notifyAll();
        if(lease.window!=null)notice(lease.window,lease,"已交回浏览器，Eva 将重新读取当前页面。",false);
        return true;
    }
    static synchronized void resumeWindow(BrowserWindow window) {
        if(current!=null&&current.window==window)resume(current.thread,current.turn);
    }
    static synchronized Lease replace(Lease previous,String pause,BrowserWindow window) {
        previous.released=true;
        Lease next=new Lease(previous.thread,previous.turn,previous.key);
        next.window=window;next.pause=pause;next.reopens=previous.reopens;
        current=next;BrowserOwnership.class.notifyAll();return next;
    }

    static synchronized void userTakeover(BrowserWindow window, String reason) {
        Lease lease=current;
        if(lease==null||lease.window!=window||"manual".equals(lease.pause))return;
        replace(lease,"manual",window);
        BrowserTools.cancelTurn(lease.key);
        DesktopBrowserRuntime.cancelLease(lease);
        window.status(reason+"；Eva 已暂停网页操作，可点「继续控制」。");
        notice(window,lease,reason+"。Eva 已暂停网页操作；完成后点「继续网页任务」。",true);
    }

    static void windowClosed(BrowserWindow window, Bundle saved, boolean reopen, String reason) {
        final Lease next;
        synchronized(BrowserOwnership.class){
            Lease lease=current;
            if(lease==null||lease.window!=window)return;
            next=replace(lease,"恢复浏览器",null);
            BrowserTools.cancelTurn(lease.key);
        DesktopBrowserRuntime.cancelLease(lease);
        }
        boolean retry=reopen&&next.reopens++<2;
        notice(window,next,retry?reason+"，Eva 正在重新打开并恢复页面。":reason+"，无法自动恢复，请手动打开浏览器后再继续。",false);
        new Handler(Looper.getMainLooper()).post(()->{
            synchronized(BrowserOwnership.class){
                if(current!=next||KernelHost.cancelledTurns.contains(next.key))return;
                try{
                    if(retry&&!window.host.isFinishing()&&!window.host.isDestroyed()){
                        if(BrowserWindow.live==null)window.host.showBrowser(new Intent(),saved);
                        if(BrowserWindow.live!=null){next.window=BrowserWindow.live;next.pause="";BrowserOwnership.class.notifyAll();notice(window,next,"浏览器已重新打开，正在核对当前页面。",false);return;}
                    }
                }catch(Exception ignored){}
                next.pause="unavailable";BrowserOwnership.class.notifyAll();
                notice(window,next,"无法恢复浏览器，请检查窗口或页面，再重试未完成的步骤。",false);
            }
        });
    }
}
