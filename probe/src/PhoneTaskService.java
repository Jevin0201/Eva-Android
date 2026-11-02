package ai.eva.android.probe;
import android.app.*;import android.content.*;import android.os.*;
/** User-controlled persistent foreground session; explicit stop clears recovery intent. */
public class PhoneTaskService extends Service {
 static volatile boolean running;
 final Handler monitor=new Handler(Looper.getMainLooper());boolean lastConnected;
 final Runnable health=new Runnable(){public void run(){if(!running)return;boolean connected=PhoneAccessibility.live!=null;if(keep(PhoneTaskService.this)){if(connected){PhoneAccessibility.armed=true;reason(PhoneTaskService.this,"");}else reason(PhoneTaskService.this,"无障碍暂未连接，等待系统重连；若持续未恢复，请在系统设置重新开启 Eva 无障碍");}if(connected!=lastConnected){lastConnected=connected;NotificationManager manager=getSystemService(NotificationManager.class);manager.notify(2020,notification());}monitor.postDelayed(this,3000);}};
 Notification notification(){PendingIntent open=PendingIntent.getActivity(this,20,new Intent(this,PhoneControlActivity.class),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);PendingIntent stop=PendingIntent.getService(this,21,new Intent(this,PhoneTaskService.class).setAction("stop"),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);return new Notification.Builder(this,"eva-phone").setSmallIcon(android.R.drawable.ic_menu_view).setContentTitle(PhoneAccessibility.live!=null?"Eva 手机控制已开启":"Eva 手机控制等待重连").setContentText(PhoneAccessibility.live==null?"点击检查无障碍连接":keep(this)?"保持开启 · 服务恢复后自动连接":"临时开启 · 点击停止立即撤销控制").setContentIntent(open).addAction(new Notification.Action.Builder(null,"停止控制",stop).build()).setOngoing(true).build();}
 static boolean keep(Context c){return c.getSharedPreferences("eva-phone",0).getBoolean("keepEnabled",false);}
 static void setKeep(Context c,boolean keep){c.getSharedPreferences("eva-phone",0).edit().putBoolean("keepEnabled",keep).commit();}
 static void reason(Context c,String reason){c.getSharedPreferences("eva-phone",0).edit().putString("reason",reason).apply();}
 static void restore(Context c){if(!keep(c))return;try{if(!running)c.startForegroundService(new Intent(c,PhoneTaskService.class).setAction("restore"));if(PhoneAccessibility.live!=null)PhoneAccessibility.armed=true;}catch(Exception e){PhoneAccessibility.stopControl();reason(c,"系统暂不允许恢复后台服务，请打开 Eva 后重试");}}

 public void onCreate(){super.onCreate();running=true;NotificationManager manager=getSystemService(NotificationManager.class);manager.createNotificationChannel(new NotificationChannel("eva-phone","手机控制",NotificationManager.IMPORTANCE_LOW));lastConnected=PhoneAccessibility.live!=null;startForeground(2020,notification());monitor.post(health);}

 public int onStartCommand(Intent i,int flags,int id){if(i!=null&&"stop".equals(i.getAction())){PhoneTools.stop(this);return START_NOT_STICKY;}if(i!=null&&"session".equals(i.getAction())&&i.getLongExtra("generation",-1)!=PhoneAccessibility.generation){if(!keep(this))stopSelf();return keep(this)?START_STICKY:START_NOT_STICKY;}if(!keep(this)&&(i==null||!"session".equals(i.getAction()))){stopSelf();return START_NOT_STICKY;}if(PhoneAccessibility.live!=null){PhoneAccessibility.armed=true;reason(this,"");}else{PhoneAccessibility.stopControl();reason(this,"等待系统重新连接无障碍服务");}return keep(this)?START_STICKY:START_NOT_STICKY;}
 public IBinder onBind(Intent i){return null;}
 public void onDestroy(){monitor.removeCallbacks(health);running=false;PhoneAccessibility.stopControl();if(keep(this))reason(this,"控制服务已中断，等待系统恢复或重新打开 Eva");super.onDestroy();}
}
