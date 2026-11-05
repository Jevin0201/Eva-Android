package ai.eva.android.probe;

import android.content.Context;
import java.io.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;
import org.json.*;

/** Android transport only. Desktop Node code owns schedule/store/run semantics. */
final class ScheduledTaskHost {
 private static ScheduledTaskHost instance;
 static synchronized ScheduledTaskHost get(Context context) {
  if (instance == null) instance = new ScheduledTaskHost(context.getApplicationContext());
  return instance;
 }
 interface Transport { JSONObject request(Context context,String method,JSONObject params,JSONObject binding)throws Exception; }
 private final Transport transport;
 private final Context context;
 private final AtomicLong ids = new AtomicLong();
 private final ConcurrentHashMap<Long,CompletableFuture<JSONObject>> replies = new ConcurrentHashMap<>();
 private final ExecutorService requests = Executors.newCachedThreadPool();
 private Process process;
 private BufferedWriter input;
 private ScheduledTaskHost(Context context) { this(context,KernelHost::scheduledRequest); }
 ScheduledTaskHost(Context context,Transport transport) { this.context=context;this.transport=transport; }
 private void deploy(String asset, File destination) throws IOException {
  if (java.nio.file.Files.isSymbolicLink(destination.toPath())) throw new IOException("调度目录不能使用符号链接");
  if (!destination.isDirectory() && !destination.mkdirs()) throw new IOException("无法创建定时任务运行目录");
  for (String name : context.getAssets().list(asset)) {
   File file = new File(destination,name);
   try (InputStream source = context.getAssets().open(asset+"/"+name)) {
    byte[] bytes = read(source, 2*1024*1024);
    if (file.isFile() && Arrays.equals(java.nio.file.Files.readAllBytes(file.toPath()),bytes)) continue;
    File temporary = File.createTempFile("scheduler-", ".tmp",destination);
    try { java.nio.file.Files.write(temporary.toPath(),bytes);java.nio.file.Files.move(temporary.toPath(),file.toPath(),java.nio.file.StandardCopyOption.REPLACE_EXISTING); }
    finally { temporary.delete(); }
   }
  }
 }
 private static byte[] read(InputStream source,int maximum) throws IOException {
  ByteArrayOutputStream bytes=new ByteArrayOutputStream();byte[] buffer=new byte[8192];int n;
  while((n=source.read(buffer))!=-1){if(bytes.size()+n>maximum)throw new IOException("调度资源过大");bytes.write(buffer,0,n);}return bytes.toByteArray();
 }
 synchronized void start() throws Exception {
  if(process!=null&&process.isAlive())return;
  File root=new File(context.getFilesDir(),"alpine");
  if(!new File(root,"usr/bin/node").isFile())throw new IOException("请先完成手机 Node 运行环境安装");
  deploy("scheduled-task-core",new File(root,"root/eva-scheduled-core"));
  String lib=context.getApplicationInfo().nativeLibraryDir;
  ProcessBuilder builder=new ProcessBuilder(lib+"/liboperit_proot.so","-0","-r",root.getAbsolutePath(),"-b","/dev","-b","/proc","-w","/root/eva-workspace","/usr/bin/node","/root/eva-scheduled-core/android-daemon.cjs","/root/.eva-scheduled");
  builder.environment().put("PROOT_LOADER",lib+"/liboperit_loader.so");
  builder.environment().put("PROOT_TMP_DIR",new File(context.getFilesDir(),"tmp").getAbsolutePath());
  builder.environment().put("PATH","/usr/bin:/bin:/usr/sbin:/sbin");
  builder.environment().put("TZ",java.util.TimeZone.getDefault().getID());
  final Process child=LinuxRuntime.start(context,builder);
  process=child;input=new BufferedWriter(new OutputStreamWriter(child.getOutputStream(),"UTF-8"));
  new Thread(()->readOutput(child),"Eva-Scheduled-Bridge").start();
  new Thread(()->{try(InputStream errors=child.getErrorStream()){byte[] b=new byte[4096];while(errors.read(b)!=-1){/* No model prompts or provider credentials are logged. */}}catch(IOException ignored){}},"Eva-Scheduled-Stderr").start();
 }
 private void readOutput(Process child) {
  try(BufferedReader reader=new BufferedReader(new InputStreamReader(child.getInputStream(),"UTF-8"))){
   String line;while((line=reader.readLine())!=null){
    if(line.length()>4*1024*1024)throw new IOException("调度消息过大");
    JSONObject row=new JSONObject(line);String type=row.optString("type");
    synchronized(this){
     if(process!=child)break;
     if(type.equals("result")){CompletableFuture<JSONObject> future=replies.remove(row.getLong("id"));if(future!=null)future.complete(row);}
     else if(type.equals("kernel"))requests.execute(()->kernel(child,row));
     else if(type.equals("fatal"))throw new IOException(row.optString("error","调度器启动失败"));
    }
   }
  }catch(Exception failure){/* Completion is handled below for this process only. */}
  finally{synchronized(this){if(process==child){process=null;input=null;failPending();}}}
 }
 private void failPending(){for(CompletableFuture<JSONObject> future:replies.values())future.completeExceptionally(new IOException("调度进程已断开，请核对历史；未自动重发任务"));replies.clear();}
 private void kernel(Process originChild,JSONObject row){
  synchronized(this){if(process!=originChild||!originChild.isAlive())return;}
  JSONObject response=new JSONObject();
  try{response.put("type","reply").put("id",row.getLong("id"));response.put("result",transport.request(context,row.getString("method"),row.getJSONObject("params"),row.optJSONObject("binding")));}
  catch(Exception failure){try{response.put("error",failure.getMessage()==null?"定时任务内核请求失败":failure.getMessage());}catch(JSONException ignored){}}
  synchronized(this){if(process!=originChild)return;try{write(response);}catch(Exception ignored){}}
 }
 private synchronized void write(JSONObject row)throws Exception{if(input==null||process==null||!process.isAlive())throw new IOException("定时任务服务未连接");input.write(row.toString());input.newLine();input.flush();}
 JSONObject command(String operation,JSONObject value)throws Exception{
  start();long id=ids.incrementAndGet();CompletableFuture<JSONObject> future=new CompletableFuture<>();replies.put(id,future);
  try{write(new JSONObject().put("type","command").put("id",id).put("operation",operation).put("value",value));JSONObject row=future.get(90,TimeUnit.SECONDS);if(row.has("error"))throw new IOException(row.getString("error"));return row;}
  finally{replies.remove(id);}
 }
 synchronized void observe(String method,JSONObject params){
  String thread=params.optString("threadId","");
  boolean owned=!thread.isEmpty()&&context.getSharedPreferences("eva-scheduled-routing",0).contains(thread);
  if(owned&&(method.endsWith("requestApproval")||method.equals("item/tool/requestUserInput")))attention(thread,"定时任务需要你的确认","点击打开任务对话，处理审批或停止任务");
  if(owned&&method.equals("turn/completed")){android.app.NotificationManager manager=context.getSystemService(android.app.NotificationManager.class);manager.cancel(thread.hashCode());JSONObject turn=params.optJSONObject("turn");if(turn!=null&&"failed".equals(turn.optString("status")))attention(thread,"定时任务执行失败","点击核对运行结果");}
  if(input==null)return;try{write(new JSONObject().put("type","notification").put("method",method).put("params",params));}catch(Exception ignored){}
 }
 private void attention(String thread,String title,String message){
  try{android.app.NotificationManager manager=context.getSystemService(android.app.NotificationManager.class);
  manager.createNotificationChannel(new android.app.NotificationChannel("eva-scheduled-attention","定时任务审批与失败",android.app.NotificationManager.IMPORTANCE_DEFAULT));
  android.app.PendingIntent open=android.app.PendingIntent.getActivity(context,thread.hashCode(),new android.content.Intent(context,ShellActivity.class).putExtra("scheduledThreadId",thread),android.app.PendingIntent.FLAG_IMMUTABLE|android.app.PendingIntent.FLAG_UPDATE_CURRENT);
  manager.notify(thread.hashCode(),new android.app.Notification.Builder(context,"eva-scheduled-attention").setSmallIcon(android.R.drawable.ic_dialog_info).setContentTitle(title).setContentText(message).setContentIntent(open).setAutoCancel(true).build());}catch(RuntimeException ignored){/* History keeps the approval reachable when notifications are denied. */}
 }
 synchronized void stop(){if(process!=null)process.destroy();process=null;input=null;failPending();}
}
