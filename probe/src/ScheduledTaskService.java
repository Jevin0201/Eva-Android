package ai.eva.android.probe;

import android.app.*;
import android.content.*;
import android.os.*;
import org.json.*;

/** Android wake/lifetime adapter. All due-time decisions remain in the desktop core. */
public final class ScheduledTaskService extends Service {
 static final String WAKE="ai.eva.android.probe.SCHEDULE_WAKE";
 private PowerManager.WakeLock activeLock;
 private final Handler handler=new Handler(Looper.getMainLooper());
 private final java.util.concurrent.ExecutorService worker=java.util.concurrent.Executors.newSingleThreadExecutor();
 private final Runnable health=new Runnable(){public void run(){refresh(false);handler.postDelayed(this,60000);}};
 private static PendingIntent alarmIntent(Context context){return PendingIntent.getBroadcast(context,2032,new Intent(context,ScheduledTaskReceiver.class).setAction(WAKE),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);}
 static void cancelAlarm(Context context){context.getSystemService(AlarmManager.class).cancel(alarmIntent(context));}
 static void refresh(Context context){restore(context,"refresh");}
 static void restore(Context context){restore(context,"restore");}
 static void restore(Context context,String action){if(!context.getSharedPreferences("eva-scheduled",0).getBoolean("enabled",false)){cancelAlarm(context);return;}try{context.startForegroundService(new Intent(context,ScheduledTaskService.class).setAction(action));}catch(Exception e){context.getSharedPreferences("eva-scheduled",0).edit().putString("error","系统暂停后台定时任务，请打开 Eva 的定时任务页恢复").apply();}}
 private void refresh(boolean wake){worker.execute(()->{
  PowerManager.WakeLock lock=null;
  try{
   if(!getSharedPreferences("eva-scheduled",0).getBoolean("enabled",false)){cancelAlarm(this);return;}
   lock=getSystemService(PowerManager.class).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK,"Eva:scheduled-tick");lock.acquire(120000);
   ScheduledTaskHost host=ScheduledTaskHost.get(this);host.command("timezone",new JSONObject().put("id",java.util.TimeZone.getDefault().getID()));host.command("enable",new JSONObject());if(wake)host.command("tick",new JSONObject());
   JSONArray rows=host.command("list",new JSONObject()).getJSONArray("result");long earliest=Long.MAX_VALUE;boolean running=false;
   for(int i=0;i<rows.length();i++){JSONObject row=rows.getJSONObject(i);JSONArray history=host.command("history",new JSONObject().put("id",row.getString("id"))).getJSONArray("result");for(int j=0;j<history.length();j++)if("IN_PROGRESS".equals(history.getJSONObject(j).optString("status")))running=true;long next=row.optLong("nextRunAt",0);if("ACTIVE".equals(row.optString("status"))&&next>0)earliest=Math.min(earliest,next);}
   synchronized(this){if(running){if(activeLock==null){activeLock=getSystemService(PowerManager.class).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK,"Eva:scheduled-running");activeLock.setReferenceCounted(false);}activeLock.acquire(120000);}else if(activeLock!=null&&activeLock.isHeld())activeLock.release();}
   if(running)earliest=Math.min(earliest,System.currentTimeMillis()+60000);
   AlarmManager alarms=getSystemService(AlarmManager.class);
   if(earliest==Long.MAX_VALUE)cancelAlarm(this);else alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,Math.max(System.currentTimeMillis()+30000,earliest),alarmIntent(this));
   getSharedPreferences("eva-scheduled",0).edit().remove("error").apply();
  }catch(Exception e){getSharedPreferences("eva-scheduled",0).edit().putString("error",e.getMessage()==null?"后台调度未完成":e.getMessage()).apply();}
  finally{if(lock!=null&&lock.isHeld())lock.release();}
 });}
 @Override public void onCreate(){super.onCreate();NotificationManager manager=getSystemService(NotificationManager.class);manager.createNotificationChannel(new NotificationChannel("eva-scheduled","定时任务",NotificationManager.IMPORTANCE_LOW));PendingIntent open=PendingIntent.getActivity(this,0,new Intent(this,ScheduledTaskActivity.class),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);startForeground(2031,new Notification.Builder(this,"eva-scheduled").setSmallIcon(android.R.drawable.ic_popup_sync).setContentTitle("Eva 定时任务已开启").setContentText("按已保存的时间、模型和权限执行，点击管理").setContentIntent(open).setOngoing(true).build());handler.post(health);}
 @Override public int onStartCommand(Intent intent,int flags,int startId){if(!getSharedPreferences("eva-scheduled",0).getBoolean("enabled",false)){cancelAlarm(this);stopSelf();return START_NOT_STICKY;}if(intent!=null)refresh(WAKE.equals(intent.getAction()));return START_STICKY;}
 @Override public void onDestroy(){handler.removeCallbacks(health);worker.shutdown();ScheduledTaskHost.get(this).stop();synchronized(this){if(activeLock!=null&&activeLock.isHeld())activeLock.release();}super.onDestroy();}
 @Override public IBinder onBind(Intent intent){return null;}
}
