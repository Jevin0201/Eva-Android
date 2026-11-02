package ai.eva.android.probe;
import android.app.*;import android.content.*;import android.os.*;import org.json.*;import java.util.concurrent.atomic.AtomicBoolean;

/** Keeps the OAuth callback and TLS tunnel reachable while Chrome is foreground. */
public class LoginService extends Service {
 final Handler timer=new Handler();final AtomicBoolean polling=new AtomicBoolean();long began;boolean stopped;
 static void begin(Context c){c.startForegroundService(new Intent(c,LoginService.class));}
 static void end(Context c){c.stopService(new Intent(c,LoginService.class));}
 public void onCreate(){super.onCreate();began=SystemClock.elapsedRealtime();NotificationManager manager=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);manager.createNotificationChannel(new NotificationChannel("eva-login","账号登录",NotificationManager.IMPORTANCE_LOW));PendingIntent open=PendingIntent.getActivity(this,0,new Intent(this,AccountActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);Notification n=new Notification.Builder(this,"eva-login").setSmallIcon(android.R.drawable.ic_lock_lock).setContentTitle("Eva 正在等待 OpenAI 登录").setContentText("请在 Chrome 完成授权；点击返回 Eva").setContentIntent(open).setOngoing(true).build();startForeground(1455,n);timer.postDelayed(check,3000);}
 final Runnable check=new Runnable(){public void run(){if(stopped)return;if(SystemClock.elapsedRealtime()-began>10*60*1000){KernelHost host=KernelHost.get(LoginService.this);host.work.execute(()->{JSONObject login=host.loginSession;if(login!=null)try{host.nativeRequest("account/login/cancel",new JSONObject().put("loginId",login.getString("loginId")));}catch(Exception ignored){}host.loginSession=null;host.loginError="登录等待已超时，请重新登录";});stopSelf();return;}KernelHost host=KernelHost.get(LoginService.this);if(host.loginSession!=null&&polling.compareAndSet(false,true))host.work.execute(()->{try{JSONObject result=host.nativeRequest("account/read",new JSONObject().put("refreshToken",false));if(!result.isNull("account"))stopSelf();}catch(Exception ignored){}finally{polling.set(false);}});timer.postDelayed(this,3000);}};
 public int onStartCommand(Intent intent,int flags,int id){return START_NOT_STICKY;}
 public IBinder onBind(Intent intent){return null;}
 public void onDestroy(){stopped=true;timer.removeCallbacks(check);stopForeground(STOP_FOREGROUND_REMOVE);super.onDestroy();}
}
