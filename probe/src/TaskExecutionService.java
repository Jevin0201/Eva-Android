package ai.eva.android.probe;

import android.app.*;
import android.content.*;
import android.content.pm.ServiceInfo;
import android.os.*;

/** Visible execution service exists only while an actual execution lease is held. */
public final class TaskExecutionService extends Service {
    private static final String CHANNEL = "eva-task-execution";
    private static final int NOTICE = 2075;
    private static volatile TaskExecutionService active;
    private int lastStartId;
    private final Handler main = new Handler(Looper.getMainLooper());
    static boolean isRunning() { return active != null; }
    static void refresh() {
        TaskExecutionService service = active;
        if (service != null) service.main.post(service::update);
    }
    private Notification notification() {
        PendingIntent open = PendingIntent.getActivity(this, NOTICE,
            new Intent(this, ShellActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new Notification.Builder(this, CHANNEL).setSmallIcon(android.R.drawable.ic_popup_sync)
            .setContentTitle("Eva 正在执行任务")
            .setContentText("后台运行与网络连接保持活动，任务完成后自动结束")
            .setContentIntent(open).setOngoing(true).setVisibility(Notification.VISIBILITY_PRIVATE).build();
    }
    public void onCreate() {
        super.onCreate();
        getSystemService(NotificationManager.class).createNotificationChannel(
            new NotificationChannel(CHANNEL, "任务执行", NotificationManager.IMPORTANCE_LOW));
        promote();
        update();
    }
    private void promote() {
        if (Build.VERSION.SDK_INT >= 34) startForeground(NOTICE, notification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        else startForeground(NOTICE, notification());
        active = this;
    }
    private void update() {
        if (active != this) return;
        if (ExecutionLease.stopIfIdle(() -> {
            if (lastStartId != 0 && stopSelfResult(lastStartId)) {
                active = null;
                stopForeground(STOP_FOREGROUND_REMOVE);
            }
        })) return;
        getSystemService(NotificationManager.class).notify(NOTICE, notification());
    }
    public int onStartCommand(Intent intent, int flags, int startId) {
        lastStartId = startId;
        if (active != this && ExecutionLease.count() > 0) promote();
        update();
        return START_NOT_STICKY;
    }
    public IBinder onBind(Intent intent) { return null; }
    public void onDestroy() {
        main.removeCallbacksAndMessages(null);
        if (active == this) { active = null; ExecutionLease.serviceDestroyed(); }
        super.onDestroy();
    }
}
