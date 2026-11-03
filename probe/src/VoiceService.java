package ai.eva.android.probe;
import android.app.*;import android.content.*;import android.content.pm.PackageManager;import android.os.*;import android.provider.Settings;import android.Manifest;import android.media.*;

/** User-started microphone session. A wake event never submits a task. */
public class VoiceService extends Service implements VoiceAudio.Listener {
 static volatile VoiceService live;static volatile String status="语音唤醒已关闭";
 final Handler ui=new Handler(Looper.getMainLooper());VoiceAudio audio;VoiceIsland island;PowerManager.WakeLock lock;
 boolean destroyed,ready,directOnReady,diagnosticOnly;volatile String diagnosticTranscript;
 String state="loading",message="正在准备本地语音…",transcript="",pendingText="",continuation="",listeningHint="";
 int sendCountdown,wakeCount;long utteranceId;
 final Runnable returnToIdle=this::standby;
 static void report(String state,String text,boolean finished){VoiceService s=live;if(s!=null)s.ui.post(()->{if(s.destroyed)return;s.display(state,text);if(finished){s.ui.removeCallbacks(s.returnToIdle);s.ui.postDelayed(s.returnToIdle,4000);}});}
 PendingIntent action(String name,int id){return PendingIntent.getService(this,id,new Intent(this,VoiceService.class).setAction(name),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);}
 Notification notification(){
  PendingIntent open=PendingIntent.getActivity(this,290,new Intent(this,VoiceActivity.class),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
  String detail=state.equals("idle")?"已开启 · 说“你好艾瓦”唤醒":state.equals("listening")?listeningHint:state.equals("review")?"指令尚未发送 · 点击检查或补充":message;
  Notification.Builder b=new Notification.Builder(this,"eva-voice").setSmallIcon(android.R.drawable.ic_btn_speak_now).setContentTitle("Eva · "+VoiceIsland.label(state)).setContentText(detail).setVisibility(Notification.VISIBILITY_PRIVATE).setContentIntent(open).setOnlyAlertOnce(true).setOngoing(true).setCategory(Notification.CATEGORY_SERVICE);
  if(state.equals("listening")){b.addAction(new Notification.Action.Builder(null,"说完了",action("finish",294)).build());b.addAction(new Notification.Action.Builder(null,"取消听写",action("cancel",295)).build());}
  else if(state.equals("working")||state.equals("approval")){PendingIntent thread=PendingIntent.getActivity(this,293,PhoneTaskReport.target(this,VoiceAgent.thread),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);b.addAction(new Notification.Action.Builder(null,"查看对话",thread).build());b.addAction(new Notification.Action.Builder(null,"取消任务",action("cancel",295)).build());}
  else if(state.equals("review"))b.addAction(new Notification.Action.Builder(null,"检查并发送",open).build());
  else b.addAction(new Notification.Action.Builder(null,"直接说话",action("listen",292)).build());
  b.addAction(new Notification.Action.Builder(null,"关闭语音",action("stop",291)).build());
  // Do not request a system text pill over the same camera area as our halo.
  return b.build();
 }
 public void onCreate(){super.onCreate();live=this;getSystemService(NotificationManager.class).createNotificationChannel(new NotificationChannel("eva-voice","Eva 语音唤醒",NotificationManager.IMPORTANCE_LOW));}
 public int onStartCommand(Intent intent,int flags,int id){
  if(intent==null||"stop".equals(intent.getAction())){VoiceAgent.cancel(this);stopSelf();return START_NOT_STICKY;}
  try{
   if(checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED||!Settings.canDrawOverlays(this))throw new Exception("请先开启麦克风和悬浮窗权限");
   startForeground(2029,notification(),android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
   if(audio==null){island=new VoiceIsland(this,this::cancelCurrent,this::openConversation,this::manualListen);display("loading","正在准备本地语音…");lock=getSystemService(PowerManager.class).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK,"Eva:Voice");lock.acquire();audio=new VoiceAudio(this,this);audio.start();}
   String action=intent.getAction();if("listen".equals(action)){if(ready)manualListen();else directOnReady=true;}else if("finish".equals(action))finishCurrent();else if("cancel".equals(action))cancelCurrent();
  }catch(Exception e){status=e.getMessage();getSharedPreferences("eva-voice",0).edit().putString("lastError",status).apply();stopSelf();}
  return START_NOT_STICKY;
 }
 void display(String next,String text){if(destroyed)return;state=next;message=text;status=VoiceIsland.label(next);try{island.show(next,text);getSystemService(NotificationManager.class).notify(2029,notification());}catch(Exception e){status="光圈无法显示，请检查悬浮窗权限";getSharedPreferences("eva-voice",0).edit().putString("lastError",status).apply();stopSelf();}}
 void standby(){if(destroyed||!ready||VoiceAgent.busy)return;ui.removeCallbacks(returnToIdle);pendingText="";continuation="";sendCountdown=0;audio.standby();display("idle","已开启 · 等待“你好艾瓦”");}
 void manualListen(){if(!ready||VoiceAgent.busy)return;ui.removeCallbacks(returnToIdle);pendingText="";continuation="";transcript="";audio.listen();}
 void continueListening(){if(!ready||VoiceAgent.busy||!state.equals("review"))return;continuation=pendingText;pendingText="";ui.removeCallbacks(returnToIdle);audio.listen();}
 void finishCurrent(){if(audio!=null&&state.equals("listening"))audio.finish();}
 void cancelCurrent(){ui.removeCallbacks(returnToIdle);VoiceAgent.cancel(this);if(audio!=null)audio.pause();pendingText="";continuation="";display("done","本次已取消 · 未发送的听写已丢弃");ui.postDelayed(returnToIdle,1000);}
 void openConversation(){if(!VoiceAgent.thread.isEmpty())PhoneTaskReport.open(this,VoiceAgent.thread);else try{startActivity(new Intent(this,VoiceActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));}catch(Exception ignored){}}
 public void ready(){ui.post(()->{if(destroyed)return;ready=true;standby();if(directOnReady){directOnReady=false;manualListen();}});}
 static void playWakeFeedback(Context c){
  SharedPreferences p=c.getSharedPreferences("eva-voice",0);
  if(p.getBoolean("wakeVibration",true))try{c.getSystemService(Vibrator.class).vibrate(VibrationEffect.createWaveform(new long[]{0,75,65,95},-1));}catch(Exception ignored){}
  if(p.getBoolean("wakeSound",true))try{ToneGenerator tone=new ToneGenerator(AudioManager.STREAM_MUSIC,65);tone.startTone(ToneGenerator.TONE_PROP_ACK,160);new Handler(Looper.getMainLooper()).postDelayed(tone::release,350);}catch(Exception ignored){}
 }
 public void wake(int ticket){ui.post(()->{if(destroyed||audio.revision!=ticket)return;wakeCount++;utteranceId++;sendCountdown=0;transcript=continuation;listeningHint="已唤醒，等你说指令 · 不用急";display("listening",listeningHint);playWakeFeedback(this);});}
 public void partial(int ticket,String text,float level,int remaining){ui.post(()->{
  if(destroyed||audio.revision!=ticket||!state.equals("listening"))return;island.level(level);transcript=continuation+(continuation.isEmpty()||text.isEmpty()?"":"，")+text;
  VoiceCommandPolicy.Kind kind=VoiceCommandPolicy.classify(text);String hint=remaining>0?"停顿确认中 · 继续说话就会接着听":kind==VoiceCommandPolicy.Kind.EMPTY?"已唤醒，等你说指令 · 不用急":kind==VoiceCommandPolicy.Kind.INCOMPLETE?"这句话还没说完，我继续听":"正在听 · 说完也可以说“说完了”";
  boolean changed=!hint.equals(listeningHint)||remaining!=sendCountdown;listeningHint=hint;sendCountdown=remaining;if(changed)getSystemService(NotificationManager.class).notify(2029,notification());
 });}
 public void result(int ticket,String text,boolean confirmed,boolean endpointComplete){ui.post(()->{
  if(destroyed||audio.revision!=ticket)return;
  textResult(text,confirmed,endpointComplete);
 });}
 void textResult(String text,boolean confirmed,boolean endpointComplete){
  VoiceCommandPolicy.Kind incoming=VoiceCommandPolicy.classify(text);
  if(incoming==VoiceCommandPolicy.Kind.CANCEL||VoiceText.cancel(text)){cancelCurrent();return;}
  String combined=continuation+(continuation.isEmpty()||text.isEmpty()?"":"，")+text;continuation="";transcript=combined;sendCountdown=0;
  if(diagnosticOnly){diagnosticTranscript=combined;display("done","麦克风诊断完成");return;}
  VoiceCommandPolicy.Kind kind=VoiceCommandPolicy.classify(combined);
  if(kind==VoiceCommandPolicy.Kind.EMPTY){display("done","没有收到指令 · 可以再次唤醒");ui.postDelayed(returnToIdle,2000);return;}
  if(getSystemService(KeyguardManager.class).isKeyguardLocked()){display("error","请先解锁手机，再下达指令");ui.postDelayed(returnToIdle,3000);return;}
  boolean automatic=getSharedPreferences("eva-voice",0).getBoolean("autoSend",true);
  if(automatic&&((endpointComplete&&kind==VoiceCommandPolicy.Kind.READY)||(confirmed&&kind!=VoiceCommandPolicy.Kind.INCOMPLETE)))submit(combined);
  else{pendingText=combined;display("review",kind==VoiceCommandPolicy.Kind.INCOMPLETE?"这句话可能还没说完，等待你补充":"听写完成，等待你确认发送");}
 }
 void submitReviewed(String text){if(!state.equals("review")||text.trim().isEmpty())return;if(getSystemService(KeyguardManager.class).isKeyguardLocked())return;submit(text.trim());}
 void submit(String text){if(VoiceAgent.busy)return;pendingText="";if(audio!=null)audio.pause();display("working","正在执行你的指令");VoiceAgent.submit(this,text);}
 public void error(String text){ui.post(()->{if(destroyed)return;status=text;getSharedPreferences("eva-voice",0).edit().putString("lastError",text).apply();android.widget.Toast.makeText(this,text,1).show();stopSelf();});}
 public void onConfigurationChanged(android.content.res.Configuration c){super.onConfigurationChanged(c);if(island!=null&&island.attached)island.show(state,message);}
 public IBinder onBind(Intent i){return null;}
 public void onDestroy(){destroyed=true;ready=false;ui.removeCallbacksAndMessages(null);if(audio!=null)audio.stop();if(island!=null)island.close();if(lock!=null&&lock.isHeld())lock.release();if(live==this)live=null;stopForeground(STOP_FOREGROUND_REMOVE);status="语音唤醒已关闭";super.onDestroy();}
}
