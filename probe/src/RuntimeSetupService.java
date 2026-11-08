package ai.eva.android.probe;

import android.app.*;
import android.content.*;
import android.os.*;
import org.json.JSONObject;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.atomic.AtomicBoolean;

/** Visible, bounded lifetime for first-run runtime deployment. */
public final class RuntimeSetupService extends Service {
    private static final int NOTICE = 2040;
    private static final String CHANNEL = "eva-runtime-setup";
    private static final long MAX_DURATION_MS = 30 * 60 * 1000;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final AtomicBoolean started = new AtomicBoolean();
    private boolean complete;
    private long began;
    private static volatile boolean active;
    private boolean optional;
    static boolean isActive(){return active;}
    static void launch(Context context, boolean retry) {
        context.startForegroundService(new Intent(context, RuntimeSetupService.class).setAction(retry ? "retry" : "install"));
    }
    static void launchComponents(Context context,String[] ids)throws java.io.IOException{
        if(active)throw new java.io.IOException("已有安装正在进行，请稍后重试");
        for(String id:ids)if(!RuntimeComponents.valid(id))throw new java.io.IOException("未知组件");
        context.startForegroundService(new Intent(context,RuntimeSetupService.class).setAction("components").putExtra("components",ids));
    }
    private Notification notification(JSONObject status) {
        PendingIntent open = PendingIntent.getActivity(this, NOTICE, new Intent(this, RuntimeSetupActivity.class), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        PendingIntent cancel = PendingIntent.getService(this, NOTICE + 1, new Intent(this, RuntimeSetupService.class).setAction("cancel"), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        String message = status.optString("message", "正在检查运行环境");
        int progress = Math.max(0, Math.min(100, status.optInt("progress", 0)));
        return new Notification.Builder(this, CHANNEL).setSmallIcon(android.R.drawable.stat_sys_download)
                .setContentTitle("Eva 正在部署运行环境").setContentText(message).setStyle(new Notification.BigTextStyle().bigText(message))
                .setContentIntent(open).setOnlyAlertOnce(true).setOngoing(true)
                .setProgress(100, progress, progress == 0).addAction(new Notification.Action.Builder(null, "取消部署", cancel).build()).build();
    }
    public void onCreate() {
        super.onCreate();
        active = true;
        getSystemService(NotificationManager.class).createNotificationChannel(new NotificationChannel(CHANNEL, "运行环境部署", NotificationManager.IMPORTANCE_LOW));
        began = SystemClock.elapsedRealtime();
        startForeground(NOTICE, notification(new JSONObject()));
    }
    private final Runnable update = new Runnable() {
        public void run() {
            if (complete) return;
            if (SystemClock.elapsedRealtime() - began > MAX_DURATION_MS) { stopDeployment(); if(optional&&RuntimeComponents.process!=null)RuntimeComponents.process.destroyForcibly(); return; }
            try { JSONObject state=RuntimeBootstrap.status(RuntimeSetupService.this);if(optional){String id=RuntimeComponents.prefs(RuntimeSetupService.this).getString("active","");state.put("message",RuntimeComponents.title(id)+" · "+RuntimeComponents.prefs(RuntimeSetupService.this).getString(id+".message","准备安装")).put("progress",0);}getSystemService(NotificationManager.class).notify(NOTICE, notification(state)); }
            catch (Exception error) { android.util.Log.w("EvaRuntime", "Setup notification unavailable", error); }
            handler.postDelayed(this, 1000);
        }
    };
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && "cancel".equals(intent.getAction())) { stopDeployment(); return START_NOT_STICKY; }
        if (!started.compareAndSet(false, true)) return START_NOT_STICKY;
        optional=intent!=null&&"components".equals(intent.getAction());
        if(optional)RuntimeComponents.stopping=false;
        final String[] components=optional?intent.getStringArrayExtra("components"):null;
        final boolean retry = intent != null && "retry".equals(intent.getAction());
        handler.post(update);
        worker.execute(() -> {
            try {
                if(optional){if(components==null||components.length==0)throw new java.io.IOException("未选择组件");RuntimeComponents.install(this,components);}
                else {getSharedPreferences("eva-runtime-bootstrap",0).edit().putBoolean("accepted",true).commit();if (retry) RuntimeBootstrap.resetForRetry(this);RuntimeBootstrap.ensure(this);}
            } catch (Exception error) {
                android.util.Log.w("EvaRuntime", "Runtime setup stopped", error);
            } finally {
                handler.post(() -> { complete = true; handler.removeCallbacks(update); stopForeground(STOP_FOREGROUND_REMOVE); stopSelf(); });
            }
        });
        return START_NOT_STICKY;
    }
    private void stopDeployment() {
        if(optional){RuntimeComponents.stop(this);return;}
        RuntimeBootstrap.cancel(this);
        complete = true;
        handler.removeCallbacks(update);
        stopForeground(STOP_FOREGROUND_REMOVE);
        stopSelf();
    }
    @Override public void onTimeout(int startId, int fgsType) { stopDeployment(); if(optional){if(RuntimeComponents.process!=null)RuntimeComponents.process.destroyForcibly();complete=true;stopForeground(STOP_FOREGROUND_REMOVE);stopSelf();} }
    public void onDestroy() {
        active=false;
        if (!complete) {if(optional)RuntimeComponents.stop(this);else RuntimeBootstrap.cancel(this);}
        handler.removeCallbacksAndMessages(null);
        worker.shutdown();
        super.onDestroy();
    }
    public IBinder onBind(Intent intent) { return null; }
}
