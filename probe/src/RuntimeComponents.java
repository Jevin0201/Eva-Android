package ai.eva.android.probe;

import android.content.*;
import java.io.*;
import java.util.*;
import java.util.concurrent.*;
import org.json.*;

/** Optional capabilities never participate in core readiness. */
final class RuntimeComponents {
 static final String[] IDS={"office","development","media","analysis","ghidra"};
 static final String[] TITLES={"办公处理","编程与 APK 构建","图像与音视频","逆向分析 · REA","Ghidra 原生反编译"};
 static final String[] DESCRIPTIONS={"制作 Word、Excel、PPT、PDF，排版预览与 HTML 导出","编译工具、Java 17、Gradle 与 Android SDK","图片文字识别、音视频转换与图像处理","按需下载 REA；不连带安装 Java 或 Ghidra","需要原生反编译时安装，包含 Java 21 与原生编译器"};
 static volatile boolean busy, stopping;
 static volatile Process process;
 static final Map<String,CompletableFuture<Boolean>> requests=new ConcurrentHashMap<>();
 static boolean valid(String id){return Arrays.asList(IDS).contains(id);}
 static String title(String id){int index=Arrays.asList(IDS).indexOf(id);return index<0?id:TITLES[index];}
 static String entry(String id){return id.equals("office")?"python3 /root/eva-office.py":id.equals("development")?"python3 /root/.eva-runtime/eva-android-build.py":id.equals("media")?"tesseract, ffmpeg, magick":id.equals("analysis")?"/root/.eva-runtime/distribution/rea/node_modules/.bin/rea":"/root/.eva-runtime/ghidra/ghidra_12.1.4_PUBLIC/support/analyzeHeadless";}
 static android.content.SharedPreferences prefs(Context c){return c.getSharedPreferences("eva-runtime-components",0);}
 static File base(Context c){return new File(c.getFilesDir(),"alpine/root/.eva-runtime/distribution");}
 /** Resolve Linux paths inside this guest, without following absolute links into Android. */
 static File guestFile(File root,String guestPath){
  try{
   if(guestPath==null||guestPath.length()>16384||guestPath.indexOf('\0')>=0||java.nio.file.Files.isSymbolicLink(root.toPath()))return null;
   java.nio.file.Path anchor=root.getCanonicalFile().toPath();
   if(!java.nio.file.Files.isDirectory(anchor,java.nio.file.LinkOption.NOFOLLOW_LINKS))return null;
   java.util.ArrayDeque<String> pending=new java.util.ArrayDeque<>(Arrays.asList(guestPath.split("/",-1)));
   java.util.ArrayList<String> resolved=new java.util.ArrayList<>();int links=0,segments=0;
   while(!pending.isEmpty()){
    if(++segments>4096)return null;
    String component=pending.removeFirst();if(component.isEmpty()||component.equals("."))continue;
    if(component.equals("..")){if(resolved.isEmpty())return null;resolved.remove(resolved.size()-1);continue;}
    java.nio.file.Path current=anchor;for(String part:resolved)current=current.resolve(part);current=current.resolve(component);
    java.nio.file.attribute.BasicFileAttributes attrs=java.nio.file.Files.readAttributes(current,java.nio.file.attribute.BasicFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
    if(attrs.isSymbolicLink()){
     if(++links>40)return null;
     String target=java.nio.file.Files.readSymbolicLink(current).toString();if(target.length()>16384)return null;
     if(target.startsWith("/"))resolved.clear();
     String[] parts=target.split("/",-1);for(int i=parts.length-1;i>=0;i--)pending.addFirst(parts[i]);
    }else{
     if(!pending.isEmpty()&&!attrs.isDirectory())return null;
     resolved.add(component);
    }
   }
   java.nio.file.Path result=anchor;for(String part:resolved)result=result.resolve(part);
   // Revalidate confinement after traversal, including concurrent link replacement.
   if(!result.toFile().getCanonicalFile().toPath().equals(result)||!result.startsWith(anchor)||!java.nio.file.Files.isRegularFile(result,java.nio.file.LinkOption.NOFOLLOW_LINKS))return null;
   return result.toFile();
  }catch(IOException|SecurityException error){return null;}
 }
 static boolean installed(Context c,String id){
  if(!valid(id))return false;
  File root=new File(c.getFilesDir(),"alpine");
  // Preserve legacy marker compatibility; the marker alone never proves readiness.
  if(guestFile(root,"root/.eva-runtime/distribution/"+id+".json")==null&&guestFile(root,"root/.eva-runtime/distribution/ready.json")==null)return false;
  // Legacy full installs are preserved, including their existing config.
  String path=id.equals("office")?"usr/bin/libreoffice":id.equals("development")?"root/.eva-android/sdk-36/platforms/android-36/android.jar":id.equals("media")?"usr/bin/ffmpeg":id.equals("analysis")?"root/.eva-runtime/distribution/rea/node_modules/.bin/rea":"root/.eva-runtime/ghidra/ghidra_12.1.4_PUBLIC/Ghidra/Features/Decompiler/os/linux_arm_64/decompile";
  return guestFile(root,path)!=null;
 }
 static JSONObject status(Context c)throws Exception{
  JSONObject result=new JSONObject().put("running",busy).put("stopping",stopping).put("active",busy?prefs(c).getString("active",""):"");
  JSONArray rows=new JSONArray();
  for(String id:IDS){String state=prefs(c).getString(id+".state","available");if(!busy&&state.equals("installing"))state="interrupted";rows.put(new JSONObject().put("id",id).put("title",title(id)).put("entry",entry(id)).put("ready",installed(c,id)).put("state",state).put("message",prefs(c).getString(id+".message","")));}
  return result.put("components",rows);
 }
 static void stop(Context c){stopping=true;try{File flag=new File(base(c),"cancel");if(flag.getParentFile().isDirectory())flag.createNewFile();}catch(IOException ignored){} }
 static void record(Context c,String id,String state,String message){prefs(c).edit().putString("active",id).putString(id+".state",state).putString(id+".message",message).commit();}
 static synchronized void install(Context c,String[] ids)throws Exception{
  for(String id:ids)if(!valid(id))throw new IOException("未知组件");
  busy=true;
  try{
   RuntimeBootstrap.ensure(c);OfficeRuntime.deploy(c);
   for(String id:ids){
    if(stopping)break;
    if(installed(c,id))continue;
    record(c,id,"installing","准备下载与安装");
    try{run(c,id);if(stopping)record(c,id,"cancelled","已停止后续步骤，已安装内容保留");else record(c,id,"ready","安装与组件自检通过");}
    catch(Exception error){record(c,id,stopping?"cancelled":"error",error.getMessage()==null?error.toString():error.getMessage());}
   }
  }finally{process=null;busy=false;prefs(c).edit().remove("active").commit();}
 }
 private static void run(Context c,String id)throws Exception{
  ProcessBuilder builder=OfficeRuntime.process(c);
  List<String> command=builder.command();command.set(command.size()-1,"/root/.eva-runtime/eva-distribution.py");command.addAll(Arrays.asList("--profile",id));
  KernelNetwork network=new KernelNetwork();
  for(String key:new String[]{"HTTP_PROXY","HTTPS_PROXY","http_proxy","https_proxy","npm_config_proxy","npm_config_https_proxy"})builder.environment().put(key,network.proxyUrl);
  try{
   Process child=LinuxRuntime.start(c,builder);process=child;
   try(BufferedReader reader=new BufferedReader(new InputStreamReader(child.getInputStream(),"UTF-8"))){String line;StringBuilder tail=new StringBuilder();while((line=reader.readLine())!=null){line=line.replace(network.proxyUrl,"[local proxy]").replace(network.credential,"[redacted]");if(tail.length()>12000)tail.delete(0,6000);tail.append(line).append('\n');try{JSONObject row=new JSONObject(line);if(row.has("progress"))record(c,id,"installing",row.getString("progress"));}catch(JSONException ignored){}}if(child.waitFor()!=0)throw new IOException(tail.toString());}
   if(!installed(c,id))throw new IOException("组件安装自检记录缺失，请重试");
  }finally{network.listener.close();network.threads.shutdownNow();process=null;}
 }
 static void answer(String token,boolean accepted){CompletableFuture<Boolean> future=requests.get(token);if(future!=null)future.complete(accepted);}
 static JSONObject ensureForTask(Context c,String id,JSONObject params)throws Exception{
  if(!valid(id))throw new IOException("未知组件");
  if(installed(c,id))return new JSONObject().put("ready",true).put("component",id).put("entry",entry(id));
  String token=UUID.randomUUID().toString();CompletableFuture<Boolean> future=new CompletableFuture<>();requests.put(token,future);
  android.app.NotificationManager notices=c.getSystemService(android.app.NotificationManager.class);int noticeId=token.hashCode()&0x3fffffff;
  try{
   Intent open=new Intent(c,RuntimeSetupActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK).putExtra("component",id).putExtra("request",token);
   boolean notified=false;
   if(notices.areNotificationsEnabled())try{
    String channel="eva-component-consent";notices.createNotificationChannel(new android.app.NotificationChannel(channel,"按需组件确认",android.app.NotificationManager.IMPORTANCE_DEFAULT));
    android.app.PendingIntent pending=android.app.PendingIntent.getActivity(c,noticeId,open,android.app.PendingIntent.FLAG_UPDATE_CURRENT|android.app.PendingIntent.FLAG_IMMUTABLE);
    notices.notify(noticeId,new android.app.Notification.Builder(c,channel).setSmallIcon(android.R.drawable.stat_sys_download).setContentTitle("Eva 需要安装"+title(id)).setContentText("点击确认安装，完成后继续原任务。也可选择暂不安装。").setContentIntent(pending).setAutoCancel(true).build());notified=true;
   }catch(Exception error){android.util.Log.w("EvaRuntime","组件确认通知不可用",error);}
   android.app.ActivityManager.RunningAppProcessInfo info=new android.app.ActivityManager.RunningAppProcessInfo();android.app.ActivityManager.getMyMemoryState(info);
   if(info.importance<=android.app.ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND)c.startActivity(open);
   else if(!notified)return new JSONObject().put("ready",false).put("component",id).put("requiresForeground",true).put("instruction","请告知用户返回 Eva 后再确认所需组件；当前无法在后台显示确认页，未开始安装。不要通过终端绕过确认。");
   long deadline=android.os.SystemClock.elapsedRealtime()+25*60*1000;
   while(!future.isDone()){KernelHost.guardTurn(params);if(android.os.SystemClock.elapsedRealtime()>deadline)throw new IOException("等待组件安装超时，可稍后重试");try{future.get(1,TimeUnit.SECONDS);}catch(TimeoutException ignored){}}
   boolean ready=future.get()&&installed(c,id);
   return new JSONObject().put("ready",ready).put("component",id).put("entry",entry(id)).put("instruction",ready?"组件已就绪，继续原任务。":"用户暂不安装或安装未完成，保留任务，不得绕过确认自行下载。");
  }finally{requests.remove(token);notices.cancel(noticeId);}
 }
}
