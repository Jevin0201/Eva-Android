package ai.eva.android.probe;

import android.app.ActivityOptions;
import android.app.Instrumentation;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.drawable.BitmapDrawable;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.lang.reflect.Field;
import java.util.concurrent.Callable;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

/** Real overlay lifecycle coverage using only Eva's isolated background fixture. */
public final class PhoneAgentPreviewCheck extends Instrumentation {
    public void onCreate(Bundle args) { super.onCreate(args); start(); }
    static void check(boolean value, String message) throws Exception { if (!value) throw new Exception(message); }
    Object field(Object target, String name) throws Exception {
        Field field = PhoneAgentPreview.class.getDeclaredField(name); field.setAccessible(true); return field.get(target);
    }
    <T> T ui(Callable<T> work) throws Exception {
        CompletableFuture<T> result = new CompletableFuture<>();
        runOnMainSync(() -> { try { result.complete(work.call()); } catch (Exception error) { result.completeExceptionally(error); } });
        return result.get(5, TimeUnit.SECONDS);
    }
    void await(Callable<Boolean> condition, String message) throws Exception {
        long deadline = SystemClock.elapsedRealtime() + 7000;
        while (SystemClock.elapsedRealtime() < deadline) {
            if (condition.call()) return;
            Thread.sleep(100);
        }
        throw new Exception(message);
    }
    void drag(View title) {
        long now = SystemClock.uptimeMillis();
        MotionEvent down = MotionEvent.obtain(now, now, MotionEvent.ACTION_DOWN, 20, 20, 0);
        MotionEvent move = MotionEvent.obtain(now, now + 30, MotionEvent.ACTION_MOVE, 100, 100, 0);
        MotionEvent up = MotionEvent.obtain(now, now + 60, MotionEvent.ACTION_UP, 100, 100, 0);
        try { title.dispatchTouchEvent(down); title.dispatchTouchEvent(move); title.dispatchTouchEvent(up); }
        finally { down.recycle(); move.recycle(); up.recycle(); }
    }
    public void onStart() {
        Bundle result = new Bundle();
        SharedPreferences prefs = getTargetContext().getSharedPreferences("eva-phone", 0);
        boolean armed = PhoneAccessibility.armed, desired = PhoneAgentDisplay.desired(getTargetContext());
        boolean hasPreview = prefs.contains("previewEnabled"), preview = PhoneAgentPreview.enabled(getTargetContext());
        boolean hasX = prefs.contains("previewX"), hasY = prefs.contains("previewY");
        int x = prefs.getInt("previewX", 0), y = prefs.getInt("previewY", 0);
        boolean began = false;
        try {
            check(PhoneTools.owner.isEmpty(), "An active phone task prevents isolated overlay test");
            check(android.provider.Settings.canDrawOverlays(getTargetContext()), "Overlay permission must already be granted");
            began = true;
            PhoneAccessibility.armed = true;
            String enabled = android.provider.Settings.Secure.getString(getTargetContext().getContentResolver(), "enabled_accessibility_services");
            if (PhoneAccessibility.live == null && enabled != null && enabled.contains("ai.eva.android.probe"))
                PhoneShell.execute(getTargetContext(), PhoneShellService.restoreCommand(), PhoneAccessibility.generation);
            await(() -> PhoneAccessibility.live != null, "Accessibility did not reconnect");
            PhoneAccessibility.armed = true;
            PhoneAgentDisplay.setEnabled(getTargetContext(), true);
            PhoneAgentDisplay.start(getTargetContext());
            PhoneAgentDisplay display = PhoneAgentDisplay.active;
            check(display != null && display.id > 0, "Background display did not start");
            Intent fixture = new Intent(getTargetContext(), PhoneFixtureActivity.class).putExtra("manual-check", true).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ActivityOptions options = ActivityOptions.makeBasic(); options.setLaunchDisplayId(display.id);
            getTargetContext().startActivity(fixture, options.toBundle());
            prefs.edit().putInt("previewX", 12).putInt("previewY", 100).commit();
            PhoneAgentPreview.setEnabled(getTargetContext(), true);
            PhoneAgentPreview.show(getTargetContext());
            await(PhoneAgentPreview::isShowing, "Overlay did not attach");
            Object overlay = ui(() -> field(null, "current"));
            LinearLayout root = ui(() -> (LinearLayout) field(overlay, "root"));
            ImageView image = ui(() -> (ImageView) field(overlay, "image"));
            await(() -> ui(() -> {
                if (!(image.getDrawable() instanceof BitmapDrawable)) return false;
                Bitmap bitmap = ((BitmapDrawable) image.getDrawable()).getBitmap();
                return root.isAttachedToWindow() && !bitmap.isRecycled() && bitmap.getWidth() > 0 && Math.min(bitmap.getWidth(), bitmap.getHeight()) <= 360;
            }), "No scaled live bitmap in attached overlay");
            int beforeFrame = ui(() -> {
                Bitmap frame = ((BitmapDrawable)image.getDrawable()).getBitmap();
                int[] pixels = new int[frame.getWidth()*frame.getHeight()];
                frame.getPixels(pixels,0,frame.getWidth(),0,0,frame.getWidth(),frame.getHeight());
                return java.util.Arrays.hashCode(pixels);
            });
            org.json.JSONObject observation = PhoneTools.execute(getTargetContext(),new org.json.JSONObject().put("action","observe"));
            String button = "";
            for(int index=0;index<observation.getJSONArray("nodes").length();index++){
                org.json.JSONObject node=observation.getJSONArray("nodes").getJSONObject(index);
                if(node.optString("text").equals("fixture-click"))button=node.getString("id");
            }
            org.json.JSONObject clicked = PhoneTools.executeObserved(getTargetContext(),new org.json.JSONObject().put("action","click").put("snapshot",observation.getString("snapshot")).put("node",button),PhoneAccessibility.generation);
            check(clicked.toString().contains("fixture-clicked"),"Background fixture action did not complete");
            await(() -> ui(() -> {
                Bitmap frame = ((BitmapDrawable)image.getDrawable()).getBitmap();
                int[] pixels = new int[frame.getWidth()*frame.getHeight()];
                frame.getPixels(pixels,0,frame.getWidth(),0,0,frame.getWidth(),frame.getHeight());
                return java.util.Arrays.hashCode(pixels)!=beforeFrame;
            }),"Preview did not update after real background operation");
            LinearLayout header = ui(() -> (LinearLayout) root.getChildAt(0));
            TextView title = ui(() -> (TextView) header.getChildAt(0));
            TextView fold = ui(() -> (TextView) header.getChildAt(1));
            TextView close = ui(() -> (TextView) header.getChildAt(2));
            ui(() -> { fold.performClick(); return null; });
            check(ui(() -> image.getVisibility() == View.GONE && "展开".contentEquals(fold.getText())), "Collapse did not hide preview");
            ui(() -> { fold.performClick(); return null; });
            check(ui(() -> image.getVisibility() == View.VISIBLE && "收起".contentEquals(fold.getText())), "Expand did not restore preview");
            int[] before = ui(() -> { WindowManager.LayoutParams params = (WindowManager.LayoutParams) field(overlay, "params"); return new int[]{params.x, params.y}; });
            ui(() -> { drag(title); return null; });
            check(ui(() -> { WindowManager.LayoutParams params = (WindowManager.LayoutParams) field(overlay, "params"); return params.x != before[0] || params.y != before[1]; }), "Drag did not move overlay");
            getTargetContext().startActivity(new Intent(android.provider.Settings.ACTION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            Thread.sleep(500);
            check(PhoneAgentPreview.isShowing() && ui(root::isAttachedToWindow), "Opening system Settings removed overlay");
            ui(() -> { close.performClick(); return null; });
            await(() -> !PhoneAgentPreview.isShowing(), "Close left overlay attached");
            check(!PhoneAgentPreview.enabled(getTargetContext()), "Close did not persist preview choice");
            check(PhoneAgentDisplay.active == display && PhoneAgentDisplay.connected(getTargetContext(), display), "Closing preview stopped background display");
            check(ui(() -> !root.isAttachedToWindow() && image.getDrawable() == null), "Close retained overlay image resources");
            PhoneAgentPreview.setEnabled(getTargetContext(), true);
            await(PhoneAgentPreview::isShowing, "Overlay could not reopen");
            PhoneAgentDisplay.stop();
            await(() -> !PhoneAgentPreview.isShowing(), "Stopping display left overlay visible");
            result.putString("result", "PASS live scaled overlay bitmap updates after real background click, collapse/expand, drag, cross-App attachment, close preserves background execution, image cleanup, display stop removes overlay");
        } catch (Throwable error) { result.putString("result", "FAIL " + error); }
        finally {
            if (began) {
                PhoneAgentPreview.hide();
                PhoneAgentDisplay.stop();
                SharedPreferences.Editor edit = prefs.edit().putBoolean("backgroundDisplayEnabled", desired);
                if (hasPreview) edit.putBoolean("previewEnabled", preview); else edit.remove("previewEnabled");
                if (hasX) edit.putInt("previewX", x); else edit.remove("previewX");
                if (hasY) edit.putInt("previewY", y); else edit.remove("previewY");
                edit.commit();
                PhoneAccessibility.armed = armed;
                PhoneAgentDisplay.restore(getTargetContext());
                getTargetContext().startActivity(new Intent(getTargetContext(), ShellActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP));
            }
        }
        finish(result.getString("result", "").startsWith("PASS") ? -1 : 0, result);
    }
}
