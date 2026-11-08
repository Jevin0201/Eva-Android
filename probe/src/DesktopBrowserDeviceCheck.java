package ai.eva.android.probe;
import android.app.*;import android.content.*;import android.os.*;
/** Isolated native host for the desktop-engine integration harness. */
public final class DesktopBrowserDeviceCheck extends Instrumentation {
 public void onCreate(Bundle args){super.onCreate(args);start();}
 public void onStart(){Bundle out=new Bundle();try{ShellActivity shell=(ShellActivity)startActivitySync(new Intent(getTargetContext(),ShellActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));runOnMainSync(()->shell.showBrowser(new Intent()));String endpoint=DesktopBrowserHost.get(getTargetContext()).endpoint();android.util.Log.i("EvaBrowserHost",endpoint);out.putString("endpoint",endpoint);Thread.sleep(240000);finish(-1,out);}catch(Exception e){out.putString("error",e.toString());finish(0,out);}}
}
