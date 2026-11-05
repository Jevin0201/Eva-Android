package ai.eva.android.probe;
import android.content.*;
/** Restores only an explicitly enabled scheduler after Android/app restart. */
public final class ScheduledTaskReceiver extends BroadcastReceiver {
 @Override public void onReceive(Context context,Intent intent){String action=intent.getAction();if(Intent.ACTION_TIMEZONE_CHANGED.equals(action)){ScheduledTaskService.refresh(context);return;}if(ScheduledTaskService.WAKE.equals(action)){ScheduledTaskService.restore(context,ScheduledTaskService.WAKE);return;}if(Intent.ACTION_BOOT_COMPLETED.equals(action)||Intent.ACTION_MY_PACKAGE_REPLACED.equals(action))ScheduledTaskService.restore(context);}
}
