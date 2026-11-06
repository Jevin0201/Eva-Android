package ai.eva.android.probe;

import android.content.Context;
import android.os.Build;
import android.os.StatFs;
import android.os.SystemClock;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.*;

/** First-install runtime bootstrap. Existing user environments are never replaced. */
final class RuntimeBootstrap {
 private static final Object LOCK=new Object();
 private static final ExecutorService worker=Executors.newSingleThreadExecutor();
 private static final AtomicBoolean active=new AtomicBoolean(),cancelled=new AtomicBoolean();
 private static volatile Process smoke;
 private static volatile HttpURLConnection connection;
 private static final String[] REQUIRED={"bin/sh","usr/bin/python3","usr/bin/node","usr/bin/git","root/eva-kernel/bin/codex"};
 private static final Set<String> HOSTS=new HashSet<>(Arrays.asList("github.com","objects.githubusercontent.com","release-assets.githubusercontent.com","dl-cdn.alpinelinux.org","registry.npmjs.org"));
 private static android.content.SharedPreferences prefs(Context c){return c.getSharedPreferences("eva-runtime-bootstrap",0);}
 static boolean present(File root){if(Files.isSymbolicLink(root.toPath())||!root.isDirectory())return false;for(String name:REQUIRED)if(!Files.exists(new File(root,name).toPath(),LinkOption.NOFOLLOW_LINKS))return false;return true;}
 static JSONObject status(Context context) {
  try {
   android.content.SharedPreferences p=prefs(context);File root=new File(context.getFilesDir(),"alpine");boolean exists=root.isDirectory(),complete=present(root),ready=p.getBoolean("ready",false)&&complete;
   boolean running=active.get();String stage=p.getString("stage",complete?"checking":"idle"),message=p.getString("message",complete?"已有环境等待兼容检查":"准备首次部署");
   if(p.getBoolean("running",false)&&!running&&!ready){stage="interrupted";message="上次部署中断，正在准备继续";}
   if(!exists&&ready)ready=false;
   return new JSONObject().put("ready",ready).put("running",running).put("stage",ready?"ready":stage).put("progress",ready?100:p.getInt("progress",0)).put("message",message).put("error",p.getString("error","")).put("cancelled",p.getBoolean("cancelled",false)).put("existingEnvironment",complete).put("hasExistingDirectory",exists).put("needsVerification",complete&&!ready);
  }catch(Exception error){return new JSONObject();}
 }
 private static void state(Context context,String stage,int progress,String message,String error) {
  prefs(context).edit().putString("stage",stage).putInt("progress",progress).putString("message",message).putString("error",error==null?"":error).putBoolean("running",active.get()).putBoolean("ready",stage.equals("ready")).putBoolean("cancelled",stage.equals("cancelled")).commit();
 }
 static void requireAvailable(Context context)throws IOException {
  if(present(new File(context.getFilesDir(),"alpine")))return;
  start(context);
  throw new IOException("运行环境尚未就绪，请到运行环境页完成部署后再导入文件或创建项目");
 }
 static void start(Context context){Context app=context.getApplicationContext();worker.execute(()->{try{ensure(app);}catch(Exception ignored){}});}
 static void resetForRetry(Context context)throws IOException {
  synchronized(active){
   if(active.get())throw new IOException("部署仍在运行，请等待停止后重试");
   cancelled.set(false);state(context,"idle",0,"准备重试部署","");
  }
 }
 static void retry(Context context){try{resetForRetry(context);start(context);}catch(IOException ignored){}}
 static void cancel(Context context) {
  cancelled.set(true);prefs(context).edit().putBoolean("cancelled",true).commit();
  HttpURLConnection current=connection;if(current!=null)current.disconnect();Process process=smoke;if(process!=null)process.destroyForcibly();
  if(!active.get())state(context,"cancelled",0,"部署已取消，可重试","");
 }
 private static void check(Context context)throws IOException {if(cancelled.get()||prefs(context).getBoolean("cancelled",false)||Thread.currentThread().isInterrupted())throw new InterruptedIOException("部署已取消，可重试");}
 static void ensure(Context context)throws Exception {
  if(android.os.Looper.myLooper()==android.os.Looper.getMainLooper())throw new IOException("运行环境部署必须在后台执行");
  synchronized(LOCK) {
   if(prefs(context).getBoolean("ready",false)&&present(new File(context.getFilesDir(),"alpine")))return;
   synchronized(active){check(context);active.set(true);}
   File stage=null;
   try {
    state(context,"checking",0,"正在检查设备与现有环境","");
    if(Build.VERSION.SDK_INT<28||!Arrays.asList(Build.SUPPORTED_ABIS).contains("arm64-v8a"))throw new IOException("当前运行环境需要 Android 9 及以上的 arm64 设备");
    File root=new File(context.getFilesDir(),"alpine");
    if(Files.exists(root.toPath(),LinkOption.NOFOLLOW_LINKS)) {
     if(Files.isSymbolicLink(root.toPath())||!root.isDirectory())throw new IOException("已有运行环境路径无效，请保留数据并检查");
     if(!present(root))throw new IOException("已有环境缺少必要组件，已保留全部数据；需要兼容修复后继续");
     verify(context,root);state(context,"ready",100,"现有运行环境检查通过","");return;
    }
    JSONObject manifest=readManifest(context);JSONObject component=manifest.getJSONArray("components").getJSONObject(0);
    File base=new File(context.getFilesDir(),"bootstrap");safeDirectory(base);File cache=new File(base,"cache");safeDirectory(cache);
    long size=component.getLong("size"),expanded=component.getLong("expandedSize");
    if(size<=0||expanded<=0||size>4L*1024*1024*1024||expanded>16L*1024*1024*1024)throw new IOException("组件大小声明无效");
    long required=size+expanded+128L*1024*1024;
    if(new StatFs(base.getAbsolutePath()).getAvailableBytes()<required)throw new IOException("可用空间不足，需要约 "+(required/1024/1024)+" MiB");
    File archive=download(context,component,cache);
    stage=new File(base,"staging-root");
    if(Files.exists(stage.toPath(),LinkOption.NOFOLLOW_LINKS))deleteStage(base,stage);
    safeDirectory(stage);final long limit=expanded;final long[] lastProgress={0};
    state(context,"extracting",25,"正在安全解包运行环境","");
    try(InputStream input=new FileInputStream(archive)) {
     RuntimeArchive.extract(input,component.getString("format"),stage,limit,new RuntimeArchive.Monitor(){
      public void check()throws IOException{RuntimeBootstrap.check(context);}
      public void progress(long bytes){long now=SystemClock.elapsedRealtime();if(now-lastProgress[0]>500){lastProgress[0]=now;state(context,"extracting",25+(int)Math.min(60,bytes*60/limit),"已解包 "+bytes/1024/1024+" MiB","");}}
     });
    }
    check(context);if(!present(stage))throw new IOException("完整运行环境包缺少必要组件");
    verify(context,stage);check(context);
    // Target must still be absent. Moving a directory on this filesystem is atomic.
    if(Files.exists(root.toPath(),LinkOption.NOFOLLOW_LINKS))throw new IOException("已有环境在部署期间出现，已停止以保护数据");
    try{Files.move(stage.toPath(),root.toPath(),StandardCopyOption.ATOMIC_MOVE);}catch(AtomicMoveNotSupportedException error){throw new IOException("当前文件系统不支持安全原子部署",error);}
    stage=null;prefs(context).edit().putString("installedId",manifest.getString("id")).putString("installedSha256",component.getString("sha256")).commit();
    state(context,"ready",100,"运行环境部署完成并通过自检","");
   }catch(Exception error){boolean stop=cancelled.get()||error instanceof InterruptedIOException||prefs(context).getBoolean("cancelled",false);state(context,stop?"cancelled":"error",0,stop?"部署已取消，可重试":"部署未完成，可重试",error.getMessage()==null?error.toString():error.getMessage());throw error;}
   finally{active.set(false);prefs(context).edit().putBoolean("running",false).commit();}
  }
 }
 private static JSONObject readManifest(Context context)throws Exception {
  byte[] bytes;try(InputStream in=context.getAssets().open("runtime/bootstrap.json")){bytes=bounded(in,65536);}
  JSONObject manifest=new JSONObject(new String(bytes,StandardCharsets.UTF_8));JSONArray components=manifest.getJSONArray("components");
  if(manifest.getInt("version")!=1||!manifest.getString("abi").equals("arm64-v8a")||Build.VERSION.SDK_INT<manifest.getInt("minApi")||components.length()!=1)throw new IOException("运行环境清单与设备不兼容");
  JSONObject component=components.getJSONObject(0);
  if(!component.getString("destination").equals("alpine")||!component.getString("sha256").matches("[a-fA-F0-9]{64}")||!Arrays.asList("tar","tar.gz").contains(component.getString("format")))throw new IOException("运行环境组件清单无效");
  String asset=component.optString("asset");if(!asset.isEmpty()&&(!asset.startsWith("runtime/")||asset.contains("..")||asset.contains("\\")))throw new IOException("离线组件路径无效");
  if(asset.isEmpty())validateUrl(new URL(component.getString("url")));
  return manifest;
 }
 private static File download(Context context,JSONObject component,File cache)throws Exception {
  String expected=component.getString("sha256").toLowerCase(Locale.ROOT);long size=component.getLong("size");
  File ready=new File(cache,expected+".archive"),partial=new File(cache,expected+".partial");
  if(Files.isSymbolicLink(ready.toPath())||Files.isSymbolicLink(partial.toPath()))throw new IOException("下载路径不能使用链接");
  if(ready.isFile()&&ready.length()==size&&digest(ready).equals(expected))return ready;
  state(context,"downloading",1,"正在获取运行环境组件","");
  long received=0,last=0;InputStream source=null;
  try {
   if(!component.optString("asset").isEmpty())source=context.getAssets().open(component.getString("asset"));
   else source=openRemote(new URL(component.getString("url")));
   try(InputStream in=source;FileOutputStream out=new FileOutputStream(partial,false)) {
    MessageDigest hash=MessageDigest.getInstance("SHA-256");byte[] buffer=new byte[65536];int count;
    while((count=in.read(buffer))!=-1){check(context);received+=count;if(received>size)throw new IOException("组件超过声明大小");out.write(buffer,0,count);hash.update(buffer,0,count);long now=SystemClock.elapsedRealtime();if(now-last>500){last=now;state(context,"downloading",1+(int)(received*24/size),"已获取 "+received/1024/1024+" / "+size/1024/1024+" MiB","");}}
    if(received!=size||!hex(hash.digest()).equals(expected))throw new IOException("组件大小或 SHA-256 校验失败");out.getFD().sync();
   }
   Files.move(partial.toPath(),ready.toPath(),StandardCopyOption.REPLACE_EXISTING);return ready;
  }finally{HttpURLConnection current=connection;connection=null;if(current!=null)current.disconnect();}
 }
 private static InputStream openRemote(URL url)throws Exception {
  for(int redirects=0;redirects<5;redirects++){
   validateUrl(url);HttpURLConnection current=(HttpURLConnection)url.openConnection();connection=current;current.setInstanceFollowRedirects(false);current.setConnectTimeout(20000);current.setReadTimeout(30000);current.setRequestProperty("Accept-Encoding","identity");int code=current.getResponseCode();
   if(code>=300&&code<400){String location=current.getHeaderField("Location");current.disconnect();if(location==null)throw new IOException("下载重定向缺少地址");url=new URL(url,location);continue;}
   if(code!=200)throw new IOException("运行环境下载失败，HTTP "+code);return current.getInputStream();
  }throw new IOException("下载重定向次数过多");
 }
 private static void validateUrl(URL url)throws IOException {if(!url.getProtocol().equals("https")||!HOSTS.contains(url.getHost().toLowerCase(Locale.ROOT))||url.getUserInfo()!=null||url.getPort()!=-1&&url.getPort()!=443)throw new IOException("运行环境下载来源不在官方 HTTPS 白名单");}
 private static void verify(Context context,File root)throws Exception {
  check(context);state(context,"verifying",90,"正在检查 Python、Node、Git 和代理内核","");
  File temporary=new File(context.getFilesDir(),"tmp");safeDirectory(temporary);
  String libraries=context.getApplicationInfo().nativeLibraryDir;
  ProcessBuilder builder=new ProcessBuilder(libraries+"/liboperit_proot.so","-0","-r",root.getAbsolutePath(),"-b","/dev","-b","/proc","-w","/","/bin/sh","-c","set -eu; /usr/bin/python3 --version; /usr/bin/node --version; /usr/bin/git --version; /root/eva-kernel/bin/codex --version");
  builder.environment().put("PROOT_LOADER",libraries+"/liboperit_loader.so");builder.environment().put("PROOT_TMP_DIR",temporary.getAbsolutePath());builder.redirectErrorStream(true);
  Process process=LinuxRuntime.start(context,builder);smoke=process;ByteArrayOutputStream output=new ByteArrayOutputStream();
  Thread reader=new Thread(()->{try(InputStream in=process.getInputStream()){byte[] buffer=new byte[4096];int count;while((count=in.read(buffer))!=-1){synchronized(output){int remaining=32768-output.size();if(remaining>0)output.write(buffer,0,Math.min(count,remaining));}}}catch(IOException ignored){}});reader.start();
  try{
   long deadline=SystemClock.elapsedRealtime()+60000;
   while(!process.waitFor(200,TimeUnit.MILLISECONDS)){check(context);if(SystemClock.elapsedRealtime()>deadline)throw new IOException("运行环境自检超时");}
   reader.join(1000);check(context);
   String text;synchronized(output){text=output.toString("UTF-8");}
   if(process.exitValue()!=0||!text.contains("Python ")||!text.contains("git version")||!text.contains("codex-cli"))throw new IOException("运行环境兼容自检失败，请保留现有数据并重试。"+text.substring(0,Math.min(1500,text.length())));
  }finally{process.destroyForcibly();smoke=null;}
 }
 private static void safeDirectory(File directory)throws IOException {if(Files.isSymbolicLink(directory.toPath()))throw new IOException("部署目录不能使用链接");if(!directory.isDirectory()&&!directory.mkdirs())throw new IOException("无法创建部署目录");}
 private static void deleteStage(File base,File stage)throws IOException {
  Path expected=base.getCanonicalFile().toPath().resolve("staging-root"),path=stage.getCanonicalFile().toPath();
  if(!path.equals(expected)||Files.isSymbolicLink(stage.toPath()))throw new IOException("不能清理未确认的临时路径");
  Files.walkFileTree(path,new SimpleFileVisitor<Path>(){public FileVisitResult visitFile(Path file,java.nio.file.attribute.BasicFileAttributes attrs)throws IOException{Files.delete(file);return FileVisitResult.CONTINUE;}public FileVisitResult postVisitDirectory(Path dir,IOException error)throws IOException{if(error!=null)throw error;Files.delete(dir);return FileVisitResult.CONTINUE;}});
 }
 private static byte[] bounded(InputStream in,int limit)throws IOException {ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] buffer=new byte[4096];int n;while((n=in.read(buffer))!=-1){if(out.size()+n>limit)throw new IOException("清单过大");out.write(buffer,0,n);}return out.toByteArray();}
 private static String digest(File file)throws Exception {MessageDigest hash=MessageDigest.getInstance("SHA-256");try(InputStream in=new FileInputStream(file)){byte[] buffer=new byte[65536];int n;while((n=in.read(buffer))!=-1)hash.update(buffer,0,n);}return hex(hash.digest());}
 private static String hex(byte[] bytes){StringBuilder value=new StringBuilder();for(byte b:bytes)value.append(String.format(Locale.ROOT,"%02x",b&255));return value.toString();}
}
