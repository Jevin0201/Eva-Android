package ai.eva.android.probe;

import android.Manifest;
import android.content.ComponentName;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;

/** Resumable, user-initiated setup through Android's own permission screens. */
final class PhoneControlSetup {
    private final PhoneControlActivity activity;
    private boolean pending;
    private boolean recoveryStarted;
    private String requested = "";
    private long accessibilityWait;

    PhoneControlSetup(PhoneControlActivity activity, Bundle state) {
        this.activity = activity;
        if (state != null) {
            pending = state.getBoolean("controlSetupPending");
            recoveryStarted = state.getBoolean("controlSetupRecoveryStarted");
            requested = state.getString("controlSetupRequested", "");
            accessibilityWait = state.getLong("controlSetupAccessibilityWait");
        }
    }

    void save(Bundle state) {
        state.putBoolean("controlSetupPending", pending);
        state.putBoolean("controlSetupRecoveryStarted", recoveryStarted);
        state.putString("controlSetupRequested", requested);
        state.putLong("controlSetupAccessibilityWait", accessibilityWait);
    }

    void start() {
        pending = true;
        recoveryStarted = false;
        accessibilityWait = 0;
        requested = "";
        advance();
    }

    void cancel() { pending = false; requested = ""; }

    private boolean request(String step, String explanation) {
        if (activity.status != null) activity.status.setText(explanation);
        if (step.equals(requested)) return false;
        requested = step;
        return true;
    }

    void advance() {
        if (!pending || activity.isFinishing()) return;
        try {
            if (Build.VERSION.SDK_INT >= 33 && activity.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != 0) {
                if (request("notifications", "请允许任务通知，授权后自动继续。取消后可点击一键启用重试。"))
                    activity.requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 22);
                return;
            }
            if (!PhoneShell.authorized()) {
                boolean running = PhoneShell.status().optBoolean("serverRunning");
                if (!running) {
                    Intent intent = activity.getPackageManager().getLaunchIntentForPackage("moe.shizuku.privileged.api");
                    if (intent == null) {
                        if (request("shizuku-install", "正在打开 Shizuku 官方下载页。完成系统安装后返回此页，自动继续启用。"))
                            activity.startActivity(new Intent(activity, BrowserActivity.class).putExtra("initialUrl", "https://shizuku.rikka.app/download/"));
                        return;
                    }
                    if (request("shizuku-start", "请在 Shizuku 中启动服务，然后返回 Eva 自动继续。"))
                        activity.startActivity(intent);
                } else if (request("shizuku-authorize", "请允许 Shizuku 授权，授权后自动继续。取消后可点击一键启用重试。")) {
                    PhoneShell.authorize();
                }
                return;
            }
            // Persist only after the explicit setup action and required notification consent.
            if (recoveryStarted && !PhoneTaskService.keep(activity)) {
                cancel();
                return;
            }
            if (!recoveryStarted) {
                PhoneTaskService.setKeep(activity, true);
                recoveryStarted = true;
            }
            PhoneTaskService.restore(activity);
            if (PhoneAccessibility.live == null) {
                if (accessibilityWait == 0) accessibilityWait = android.os.SystemClock.elapsedRealtime();
                if (android.os.SystemClock.elapsedRealtime() - accessibilityWait < 15000) {
                    if (activity.status != null) activity.status.setText("正在通过已授权 Shizuku 自动连接手机控制…");
                    return;
                }
                if (request("accessibility", "正在恢复无障碍连接。也可在此系统页面启用 Eva，返回后自动继续。")) {
                    Intent intent = new Intent("android.settings.ACCESSIBILITY_DETAILS_SETTINGS");
                    intent.putExtra(Intent.EXTRA_COMPONENT_NAME, new ComponentName(activity, PhoneAccessibility.class));
                    try { activity.startActivity(intent); }
                    catch (android.content.ActivityNotFoundException error) {
                        activity.startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS));
                    }
                }
                return;
            }
            if (!Settings.canDrawOverlays(activity)) {
                if (request("overlay", "请允许 Eva 显示悬浮窗，返回后继续配置实时预览。"))
                    activity.startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + activity.getPackageName())));
                return;
            }
            PowerManager power = (PowerManager) activity.getSystemService(android.content.Context.POWER_SERVICE);
            if (!power.isIgnoringBatteryOptimizations(activity.getPackageName())) {
                if (request("battery", "请允许后台运行，返回 Eva 后自动完成启用。"))
                    activity.startActivity(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + activity.getPackageName())));
                return;
            }
            PhoneAgentPreview.setEnabled(activity, true);
            if (Build.VERSION.SDK_INT >= 34) PhoneAgentDisplay.setEnabled(activity, true);
            pending = false;
            requested = "";
            activity.requestedKeep = true;
            activity.enable();
            activity.refreshStatus();
        } catch (Exception error) {
            pending = false;
            requested = "";
            if (activity.status != null) activity.status.setText("启用尚未完成 · " + error.getMessage() + "\n处理后点击一键启用继续。");
        }
    }
}
