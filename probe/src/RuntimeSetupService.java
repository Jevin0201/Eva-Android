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
    static void launch(Context context, boolean retry) {
        context.startForegroundService(new Intent(context, RuntimeSetupService.class).setAction(retry ? "retry" : "install"));
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
        getSystemService(NotificationManager.class).createNotificationChannel(new NotificationChannel(CHANNEL, "运行环境部署", NotificationManager.IMPORTANCE_LOW));
        began = SystemClock.elapsedRealtime();
        startForeground(NOTICE, notification(new JSONObject()));
    }
    private final Runnable update = new Runnable() {
        public void run() {
            if (complete) return;
            if (SystemClock.elapsedRealtime() - began > MAX_DURATION_MS) { stopDeployment(); return; }
            try { getSystemService(NotificationManager.class).notify(NOTICE, notification(RuntimeBootstrap.status(RuntimeSetupService.this))); }
            catch (Exception error) { android.util.Log.w("EvaRuntime", "Setup notification unavailable", error); }
            handler.postDelayed(this, 1000);
        }
    };
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && "cancel".equals(intent.getAction())) { stopDeployment(); return START_NOT_STICKY; }
        if (!started.compareAndSet(false, true)) return START_NOT_STICKY;
        final boolean retry = intent != null && "retry".equals(intent.getAction());
        handler.post(update);
        worker.execute(() -> {
            try {
                if (retry) RuntimeBootstrap.resetForRetry(this);
                RuntimeBootstrap.ensure(this);
            } catch (Exception error) {
                android.util.Log.w("EvaRuntime", "Runtime setup stopped", error);
            } finally {
                handler.post(() -> { complete = true; handler.removeCallbacks(update); stopForeground(STOP_FOREGROUND_REMOVE); stopSelf(); });
            }
        });
        return START_NOT_STICKY;
    }
    private void stopDeployment() {
        RuntimeBootstrap.cancel(this);
        complete = true;
        handler.removeCallbacks(update);
        stopForeground(STOP_FOREGROUND_REMOVE);
        stopSelf();
    }
    @Override public void onTimeout(int startId, int fgsType) { stopDeployment(); }
    public void onDestroy() {
        if (!complete) RuntimeBootstrap.cancel(this);
        handler.removeCallbacksAndMessages(null);
        worker.shutdown();
        super.onDestroy();
    }
    public IBinder onBind(Intent intent) { return null; }
}
