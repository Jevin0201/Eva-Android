package ai.eva.android.probe;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.accessibility.AccessibilityNodeInfo;
import java.util.List;

/** The user's standing consent applies only to Eva's own, pending MIUI app launch. */
final class PhoneLaunchConfirmation {
    private static final String SECURITY = "com.miui.securitycenter";
    private static final Handler handler = new Handler(Looper.getMainLooper());
    private static volatile PhoneLaunchConfirmation pending;
    private final String targetPackage, sourceLabel, targetLabel, owner, turn;
    private final int displayId;
    private final long generation, deadline;

    private PhoneLaunchConfirmation(Context context, String target) throws Exception {
        targetPackage = target;
        sourceLabel = context.getApplicationInfo().loadLabel(context.getPackageManager()).toString();
        targetLabel = context.getPackageManager().getApplicationInfo(target, 0).loadLabel(context.getPackageManager()).toString();
        owner = PhoneTools.owner;
        turn = PhoneTools.turn;
        displayId = PhoneAgentDisplay.displayId();
        generation = PhoneAccessibility.generation;
        deadline = SystemClock.elapsedRealtime() + 10000;
    }

    static void begin(Context context, String target) {
        pending = null;
        if (!context.getSharedPreferences("eva-phone", 0).getBoolean("allowAppLaunchConfirmations", true)) return;
        try {
            PhoneLaunchConfirmation next = new PhoneLaunchConfirmation(context, target);
            pending = next;
            handler.postDelayed(next.poll, 100);
        } catch (Exception error) {
            android.util.Log.w("EvaLaunch", "Unable to identify pending app launch", error);
        }
    }

    static void failed() { pending = null; }

    static boolean awaiting(long generation) {
        PhoneLaunchConfirmation value = pending;
        return value != null && value.generation == generation && value.valid(PhoneAccessibility.live);
    }


    private boolean valid(PhoneAccessibility service) {
        return pending == this && service != null && PhoneAccessibility.armed
                && generation == PhoneAccessibility.generation && displayId == PhoneAgentDisplay.displayId()
                && SystemClock.elapsedRealtime() < deadline && owner.equals(PhoneTools.owner) && turn.equals(PhoneTools.turn)
                && !KernelHost.cancelledTurns.contains(owner + ":" + turn)
                && service.getSharedPreferences("eva-phone", 0).getBoolean("allowAppLaunchConfirmations", true);
    }

    private static String compact(CharSequence value) {
        return value == null ? "" : value.toString().replaceAll("\\s+", "").replace('?', '？').replace(',', '，');
    }

    private boolean textMatches(AccessibilityNodeInfo root, String id, String expected) {
        List<AccessibilityNodeInfo> nodes = root.findAccessibilityNodeInfosByViewId(SECURITY + ":id/" + id);
        try {
            return nodes.size() == 1 && nodes.get(0).isVisibleToUser() && compact(nodes.get(0).getText()).equals(compact(expected));
        } finally { for (AccessibilityNodeInfo node : nodes) node.recycle(); }
    }

    private final Runnable poll = new Runnable() {
        public void run() {
            PhoneAccessibility service = PhoneAccessibility.live;
            if (!valid(service)) { if (pending == PhoneLaunchConfirmation.this) pending = null; return; }
            AccessibilityNodeInfo root = null;
            try {
                service.guard();
                root = service.readableRoot();
                if (root != null && targetPackage.contentEquals(root.getPackageName() == null ? "" : root.getPackageName())) {
                    pending = null;
                    return;
                }
                if (root != null
                        && SECURITY.contentEquals(root.getPackageName() == null ? "" : root.getPackageName())
                        && textMatches(root, "permission_group_title", "启动应用")
                        && textMatches(root, "event_title", sourceLabel + " 想要打开 " + targetLabel + "，是否允许？")) {
                    List<AccessibilityNodeInfo> buttons = root.findAccessibilityNodeInfosByText("始终允许");
                    try {
                        AccessibilityNodeInfo button = null;
                        for (AccessibilityNodeInfo node : buttons) {
                            if (!node.isVisibleToUser() || !compact(node.getText()).equals("始终允许")) continue;
                            if (button != null) { pending = null; return; }
                            button = node;
                        }
                        if (button != null && valid(service)) {
                            pending = null;
                            if (service.actOnAncestor(button, AccessibilityNodeInfo.ACTION_CLICK))
                                android.util.Log.i("EvaLaunch", "Confirmed requested app launch: " + targetPackage + " on display " + displayId);
                            service.clearNodes();
                            return;
                        }
                    } finally { for (AccessibilityNodeInfo node : buttons) node.recycle(); }
                }
            } catch (Exception error) {
                if (!valid(service)) { pending = null; return; }
            } finally { if (root != null) root.recycle(); }
            if (pending == PhoneLaunchConfirmation.this) handler.postDelayed(this, 150);
        }
    };
}
