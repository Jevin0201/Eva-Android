package ai.eva.android.probe;

import android.app.KeyguardManager;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.PixelFormat;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

/** Read-only live view of the agent display. Overlay touches never become phone actions. */
final class PhoneAgentPreview {
    private static final Handler main = new Handler(Looper.getMainLooper());
    private static PhoneAgentPreview current;
    private static volatile boolean displaying;
    private static volatile String reason = "";
    private final Context context;
    private final WindowManager manager;
    private final LinearLayout root;
    private final ImageView image;
    private final TextView message, fold;
    private final WindowManager.LayoutParams params;
    private Bitmap bitmap;
    private boolean collapsed, closed;
    private float downX, downY;
    private int originX, originY;

    static boolean enabled(Context context) {
        return context.getSharedPreferences("eva-phone", 0).getBoolean("previewEnabled", true);
    }
    static boolean isShowing() { return displaying; }
    static String state(Context context) {
        if (!enabled(context)) return "实时悬浮预览已关闭";
        if (!Settings.canDrawOverlays(context)) return "实时悬浮预览待授权，请打开悬浮窗权限";
        if (displaying) return "实时悬浮预览正在显示";
        if (!reason.isEmpty()) return reason;
        return PhoneAgentDisplay.active == null ? "实时悬浮预览等待后台屏" : "实时悬浮预览可用，后台操作时自动显示";
    }
    static void setEnabled(Context context, boolean enabled) {
        context.getSharedPreferences("eva-phone", 0).edit().putBoolean("previewEnabled", enabled).apply();
        if (enabled) show(context); else hide();
    }
    static void show(Context context) {
        Context app = context.getApplicationContext();
        main.post(() -> {
            if (!enabled(app)) { remove(); return; }
            if (!Settings.canDrawOverlays(app)) { reason = "实时悬浮预览待授权"; remove(); return; }
            if (((KeyguardManager) app.getSystemService(Context.KEYGUARD_SERVICE)).isKeyguardLocked()) { reason = "实时悬浮预览等待手机解锁"; remove(); return; }
            if (!PhoneAgentDisplay.connected(app, PhoneAgentDisplay.active)) { reason = "实时悬浮预览等待后台屏连接"; remove(); return; }
            if (current != null) return;
            try {
                PhoneAgentPreview next = new PhoneAgentPreview(app);
                next.manager.addView(next.root, next.params);
                current = next;
                displaying = true;
                reason = "";
                main.post(next.refresh);
            } catch (Exception error) {
                reason = "悬浮预览未显示，请检查悬浮窗权限与系统限制";
                android.util.Log.w("EvaPreview", "Unable to attach preview", error);
            }
        });
    }
    static void hide() { main.post(PhoneAgentPreview::remove); }
    private static void remove() {
        PhoneAgentPreview view = current;
        current = null;
        displaying = false;
        if (view != null) view.close();
    }
    private int dp(int size) { return Math.round(size * context.getResources().getDisplayMetrics().density); }
    private TextView text(String value, int size) {
        TextView view = new TextView(context);
        view.setText(value); view.setTextSize(size); view.setTextColor(0xff26334a);
        view.setPadding(dp(8), dp(8), dp(8), dp(8));
        return view;
    }
    private PhoneAgentPreview(Context app) {
        context = app;
        manager = app.getSystemService(WindowManager.class);
        root = new LinearLayout(app); root.setOrientation(LinearLayout.VERTICAL);
        root.setBackground(EvaUi.surface(app, 0xfff6f8fc, 14));
        root.setElevation(dp(8)); root.setPadding(dp(3), dp(3), dp(3), dp(3));
        root.setContentDescription("Eva 后台屏实时预览，仅查看");
        LinearLayout header = new LinearLayout(app); header.setGravity(Gravity.CENTER_VERTICAL);
        TextView title = text("Eva · 后台", 12); title.setContentDescription("拖动移动实时预览");
        header.addView(title, new LinearLayout.LayoutParams(0, -2, 1));
        fold = text("收起", 11); fold.setContentDescription("收起或展开实时画面");
        fold.setOnClickListener(view -> toggleCollapsed());
        header.addView(fold);
        TextView close = text("关闭", 11); close.setContentDescription("关闭实时预览，后台任务继续");
        close.setOnClickListener(view -> setEnabled(app, false)); header.addView(close);
        root.addView(header, new LinearLayout.LayoutParams(-1, -2));
        image = new ImageView(app); image.setScaleType(ImageView.ScaleType.FIT_CENTER);
        image.setContentDescription("后台屏实时画面"); image.setAdjustViewBounds(true);
        root.addView(image, new LinearLayout.LayoutParams(-1, dp(260)));
        message = text("等待后台屏首帧", 11); root.addView(message, new LinearLayout.LayoutParams(-1, -2));
        params = new WindowManager.LayoutParams(dp(200), -2, WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL, PixelFormat.TRANSLUCENT);
        params.gravity = Gravity.TOP | Gravity.LEFT;
        params.setTitle("Eva 后台屏实时预览");
        params.x = app.getSharedPreferences("eva-phone", 0).getInt("previewX", dp(12));
        params.y = app.getSharedPreferences("eva-phone", 0).getInt("previewY", dp(100));
        clamp();
        title.setOnTouchListener((view, event) -> {
            if (event.getActionMasked() == MotionEvent.ACTION_DOWN) {
                downX = event.getRawX(); downY = event.getRawY(); originX = params.x; originY = params.y; return true;
            }
            if (event.getActionMasked() == MotionEvent.ACTION_MOVE) {
                params.x = originX + Math.round(event.getRawX() - downX); params.y = originY + Math.round(event.getRawY() - downY);
                clamp(); updatePosition(); return true;
            }
            if (event.getActionMasked() == MotionEvent.ACTION_UP || event.getActionMasked() == MotionEvent.ACTION_CANCEL) {
                app.getSharedPreferences("eva-phone", 0).edit().putInt("previewX", params.x).putInt("previewY", params.y).apply(); return true;
            }
            return true;
        });
    }
    private void toggleCollapsed() {
        collapsed = !collapsed;
        image.setVisibility(collapsed ? View.GONE : View.VISIBLE);
        message.setVisibility(collapsed ? View.GONE : View.VISIBLE);
        fold.setText(collapsed ? "展开" : "收起");
    }
    private void clamp() {
        android.graphics.Point size = new android.graphics.Point(); manager.getDefaultDisplay().getRealSize(size);
        params.width = Math.min(dp(200), Math.max(dp(120), size.x - dp(16)));
        params.x = Math.max(0, Math.min(size.x - params.width, params.x));
        int height = root.getHeight() > 0 ? root.getHeight() : dp(330);
        params.y = Math.max(dp(24), Math.min(Math.max(dp(24), size.y - Math.min(height, size.y) - dp(24)), params.y));
    }
    private void updatePosition() {
        try { if (!closed && root.isAttachedToWindow()) manager.updateViewLayout(root, params); }
        catch (Exception error) { reason = "悬浮预览窗口已失效"; remove(); }
    }
    private final Runnable refresh = new Runnable() {
        public void run() {
            if (closed || current != PhoneAgentPreview.this) return;
            PhoneAgentDisplay display = PhoneAgentDisplay.active;
            if (!enabled(context) || !Settings.canDrawOverlays(context) || !PhoneAgentDisplay.connected(context, display)) { reason = "实时悬浮预览等待后台屏连接"; remove(); return; }
            if (((KeyguardManager) context.getSystemService(Context.KEYGUARD_SERVICE)).isKeyguardLocked()) { reason = "实时悬浮预览等待手机解锁"; remove(); return; }
            if (!collapsed) {
                try {
                    Bitmap next = display.previewBitmap(360);
                    if (next == null) throw new java.io.IOException("等待首帧");
                    if (display != PhoneAgentDisplay.active) { next.recycle(); remove(); return; }
                    Bitmap previous = bitmap; bitmap = next; image.setImageBitmap(next);
                    if (previous != null && previous != next) previous.recycle();
                    message.setText("实时画面 · 仅查看");
                } catch (Exception error) { message.setText("等待后台屏画面"); }
            }
            int x = params.x, y = params.y, width = params.width;
            clamp(); if (x != params.x || y != params.y || width != params.width) updatePosition();
            if (!closed) main.postDelayed(this, 200);
        }
    };
    private void close() {
        closed = true;
        main.removeCallbacks(refresh);
        image.setImageDrawable(null);
        if (bitmap != null) { bitmap.recycle(); bitmap = null; }
        try { manager.removeViewImmediate(root); } catch (Exception ignored) { }
    }
}
