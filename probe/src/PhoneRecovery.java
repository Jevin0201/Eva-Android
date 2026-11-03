package ai.eva.android.probe;
import android.content.*;
/** Restores only a previously enabled persistent session, uses previously authorized Shizuku for accessibility recovery. */
public class PhoneRecovery extends BroadcastReceiver {
 public void onReceive(Context c,Intent i){String a=i.getAction();if(Intent.ACTION_BOOT_COMPLETED.equals(a)||Intent.ACTION_MY_PACKAGE_REPLACED.equals(a))PhoneTaskService.restore(c);}
}
