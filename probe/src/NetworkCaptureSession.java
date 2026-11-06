package ai.eva.android.probe;

import android.content.*;
import android.net.Uri;
import android.os.*;
import android.provider.MediaStore;
import android.database.Cursor;
import org.json.*;
import java.io.*;
import java.util.*;
import java.util.concurrent.*;

/** One persisted capture, with explicit controller results and local output ownership. */
final class NetworkCaptureSession {
 static final String ENGINE="com.emanuelef.remote_capture", MITM="com.pcapdroid.mitm";
 static final ExecutorService work=Executors.newCachedThreadPool();
 static final Object lock=new Object();
 static volatile Operation pending;
 static final class Operation {
  final String id=UUID.randomUUID().toString(),action;
  final JSONObject arguments;
  final CompletableFuture<JSONObject> result=new CompletableFuture<>();
  volatile boolean cancelled;
  volatile Runnable cancel;
  Operation(String action,JSONObject arguments){this.action=action;this.arguments=arguments;}
 }
 static JSONObject read(Context context)throws JSONException{
  return new JSONObject(context.getSharedPreferences("eva-network-session",0).getString("session","{}"));
 }
 static void save(Context context,JSONObject value)throws IOException{
  if(!context.getSharedPreferences("eva-network-session",0).edit().putString("session",value.toString()).commit())throw new IOException("抓包状态保存失败");
 }
 static void phase(Context context,String phase,String message)throws Exception{
  synchronized(lock){JSONObject value=read(context);value.put("phase",phase).put("message",message);save(context,value);}
 }
 static boolean installed(Context context,String name){try{context.getPackageManager().getPackageInfo(name,0);return true;}catch(Exception absent){return false;}}
 static boolean canExportHttp(Context context){
  try{
   int uid=context.getPackageManager().getApplicationInfo(MITM,0).uid;
   android.app.AppOpsManager operations=context.getSystemService(android.app.AppOpsManager.class);
   return operations.unsafeCheckOpNoThrow("android:manage_external_storage",uid,MITM)==android.app.AppOpsManager.MODE_ALLOWED;
  }catch(Exception unavailable){return false;}
 }
 static boolean proxyBackgroundAllowed(Context context){
  return context.getSystemService(PowerManager.class).isIgnoringBatteryOptimizations(MITM);
 }
 static JSONObject status(Context context)throws Exception{
  JSONObject value=read(context);
  value.remove("harUri");value.remove("harDiskPath");value.remove("eventsUri");value.remove("eventsDiskPath");value.remove("addonScriptPath");
  value.put("engineInstalled",installed(context,ENGINE)).put("mitmInstalled",installed(context,MITM));
  value.put("httpExportAuthorized",canExportHttp(context));
  value.put("proxyBackgroundAllowed",proxyBackgroundAllowed(context));
  value.put("receiverActive",NetworkCaptureService.active);
  if(NetworkCaptureService.active)value.put("captureBytes",NetworkCaptureService.bytes);
  value.put("phoneControlConnected",PhoneAccessibility.live!=null).put("phoneControlEnabled",PhoneAccessibility.armed);
  value.put("localControlRequiresChatGptLogin",false);
  if(value.optBoolean("engineRunning")&&!NetworkCaptureService.active)value.put("receiverInterrupted",true);
  if(pending!=null)value.put("pendingAction",pending.action);
  return value;
 }
 static JSONObject request(Context context,String action,JSONObject arguments,String turnKey)throws Exception{
  Operation operation;
  synchronized(lock){
   if(pending!=null)throw new IOException("抓包操作正在等待完成，请等待当前授权或操作结果");
   operation=new Operation(action,new JSONObject(arguments.toString()));pending=operation;
  }
  Context app=context.getApplicationContext();
  new Handler(Looper.getMainLooper()).post(()->{
   try{
    Intent intent=new Intent(app,NetworkCaptureControlActivity.class).putExtra("operation",operation.id).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    PhoneAccessibility phone=PhoneAccessibility.live;
    if(phone!=null&&PhoneAccessibility.armed){phone.guard();phone.startActivity(intent);}else app.startActivity(intent);
   }catch(Exception error){complete(app,operation,null,error);}
  });
  long deadline=System.currentTimeMillis()+240000;
  while(true){
   try{return operation.result.get(1,TimeUnit.SECONDS);}
   catch(TimeoutException waiting){
    if((turnKey!=null&&KernelHost.cancelledTurns.contains(turnKey))||System.currentTimeMillis()>deadline){
     operation.cancelled=true;
     new Handler(Looper.getMainLooper()).post(()->{if(operation.cancel!=null)operation.cancel.run();});
     throw new IOException(operation.cancelled&&System.currentTimeMillis()<=deadline?"任务已停止，抓包控制将在授权页返回后收尾":"等待系统授权超时，抓包控制将在授权页返回后收尾");
    }
   }catch(ExecutionException error){throw new IOException(error.getCause().getMessage(),error.getCause());}
  }
 }
 static void complete(Context context,Operation operation,JSONObject result,Exception error){
  synchronized(lock){
   if(pending!=operation)return;
   pending=null;
   operation.cancel=null;
   if(error!=null)operation.result.completeExceptionally(error);else operation.result.complete(result);
  }
 }
 static void cancelTurn(Context context,String key){
  Operation current=pending;if(current!=null&&key.equals(current.arguments.optString("ownerTurn"))){current.cancelled=true;new Handler(Looper.getMainLooper()).post(()->{if(current.cancel!=null)current.cancel.run();});}
  work.execute(()->{try{JSONObject value=read(context);if(key.equals(value.optString("ownerTurn"))&&value.optBoolean("engineRunning"))request(context,"stop",new JSONObject(),null);}catch(Exception ignored){}});
 }
 static void begin(Context context,Operation operation)throws Exception{
  String target=operation.arguments.optString("targetPackage");
  if(!target.equals("*")){
   if(!target.matches("[A-Za-z_][A-Za-z0-9_]*(?:\\.[A-Za-z0-9_]+)+(?:,[A-Za-z_][A-Za-z0-9_]*(?:\\.[A-Za-z0-9_]+)+){0,7}"))throw new IOException("请先用 eva_phone 的 apps 查询目标 App，并提供 targetPackage");
   for(String name:target.split(","))context.getPackageManager().getPackageInfo(name,0);
  }
  int port=NetworkCaptureService.prepare(context,target);
  ArrayList<Uri> created=new ArrayList<>();
  try{
  String id=UUID.randomUUID().toString();boolean tls=operation.arguments.optBoolean("decryptHttps",true);
  JSONObject value=new JSONObject().put("captureId",id).put("targetPackage",target).put("goal",operation.arguments.optString("goal"))
   .put("decryptHttpsRequested",tls).put("tlsDecrypted",false).put("engineRunning",false).put("phase","preparing")
   .put("ownerTurn",operation.arguments.optString("ownerTurn")).put("collectorPort",port).put("startedAt",System.currentTimeMillis())
   .put("durationSeconds",Math.max(10,Math.min(600,operation.arguments.optInt("durationSeconds",120))))
   .put("pcapPath",WorkspaceFiles.root(context).toPath().relativize(NetworkCaptureService.file.toPath()).toString());
  if(tls){
   JSONObject har=sharedFile(context,"eva-"+id+".har","application/json",new byte[0]);
   created.add(Uri.parse(har.getString("uri")));
   JSONObject events=sharedFile(context,"eva-"+id+".events.jsonl","application/octet-stream",new byte[0]);
   created.add(Uri.parse(events.getString("uri")));
   String script;
   try(InputStream input=context.getAssets().open("network/eva-capture-events.py");ByteArrayOutputStream bytes=new ByteArrayOutputStream()){
    byte[] buffer=new byte[8192];int count;while((count=input.read(buffer))!=-1)bytes.write(buffer,0,count);script=bytes.toString("UTF-8");
   }
   script=script.replace("__EVA_EVENTS_PATH__",events.getString("path"));
   JSONObject addon=sharedFile(context,"eva-"+id+".py","text/x-python",script.getBytes("UTF-8"));
   created.add(Uri.parse(addon.getString("uri")));
   value.put("harUri",har.getString("uri")).put("harDiskPath",har.getString("path"))
    .put("eventsUri",events.getString("uri")).put("eventsDiskPath",events.getString("path")).put("addonScriptPath",addon.getString("path"));
  }
  save(context,value);
  context.startForegroundService(new Intent(context,NetworkCaptureService.class));
  }catch(Exception error){
   NetworkCaptureService.stop(context);
   for(Uri uri:created)try{context.getContentResolver().delete(uri,null,null);}catch(Exception cleanup){error.addSuppressed(cleanup);}
   throw error;
  }
 }
 static JSONObject sharedFile(Context context,String name,String mime,byte[] bytes)throws Exception{
  ContentValues metadata=new ContentValues();metadata.put(MediaStore.Downloads.DISPLAY_NAME,name);
  metadata.put(MediaStore.Downloads.MIME_TYPE,mime);metadata.put(MediaStore.Downloads.RELATIVE_PATH,"Download/EvaCaptures");
  Uri uri=context.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI,metadata);
  if(uri==null)throw new IOException("无法创建抓包结果文件");
  try{
   try(OutputStream output=context.getContentResolver().openOutputStream(uri,"w")){if(output==null)throw new IOException("无法写入抓包文件");output.write(bytes);}
   String path;
   try(Cursor cursor=context.getContentResolver().query(uri,new String[]{MediaStore.MediaColumns.DATA},null,null,null)){
    if(cursor==null||!cursor.moveToFirst())throw new IOException("无法读取抓包文件位置");path=cursor.getString(0);
   }
   if(path==null||!path.matches("/storage/emulated/[0-9]+/Download/EvaCaptures/[A-Za-z0-9._-]+"))throw new IOException("抓包文件位置不受支持");
   context.grantUriPermission(MITM,uri,Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
   return new JSONObject().put("uri",uri.toString()).put("path",path);
  }catch(Exception error){context.getContentResolver().delete(uri,null,null);throw error;}
 }
 static File importFile(Context context,String source,String outputName)throws Exception{
  File output=WorkspaceFiles.resolve(context,outputName),temp=new File(output.getParentFile(),output.getName()+".part");
  try(InputStream input=context.getContentResolver().openInputStream(Uri.parse(source));OutputStream out=new FileOutputStream(temp)){
   if(input==null)throw new IOException("采集结果不可读取");byte[] buffer=new byte[32768];long size=0;int count;
   while((count=input.read(buffer))!=-1){size+=count;if(size>HttpCaptureSummary.MAX_BYTES)throw new IOException("采集结果超过 16 MiB 上限，原文件已保留");out.write(buffer,0,count);}
  }catch(Exception error){temp.delete();throw error;}
  java.nio.file.Files.move(temp.toPath(),output.toPath(),java.nio.file.StandardCopyOption.REPLACE_EXISTING);return output;
 }
 static Intent startIntent(Context context)throws Exception{
  JSONObject value=read(context);
  Intent intent=engine("start")
   .putExtra("pcap_dump_mode","udp_exporter").putExtra("collector_host","127.0.0.1").putExtra("collector_port",value.getInt("collectorPort"))
   .putExtra("pcapng_format",false).putExtra("dump_extensions",false).putExtra("full_payload",true)
   .putExtra("tls_decryption",value.getBoolean("decryptHttpsRequested")).putExtra("root_capture",false)
   .putExtra("snaplen",65535).putExtra("max_dump_size",20*1024*1024);
  String target=value.getString("targetPackage");if(!target.equals("*"))intent.putExtra("app_filter",target);
  if(value.getBoolean("decryptHttpsRequested")){
   if(!target.equals("*")){
    JSONArray rules=new JSONArray();for(String name:target.split(","))rules.put(new JSONObject().put("type","APP").put("value",name));
    intent.putExtra("decryption_rules",rules.toString());
   }
   intent.putExtra("block_quic","to_decrypt").putExtra("mitmproxy_opts","--set hardump="+value.getString("harDiskPath")+" --set stream_large_bodies=2m -s "+value.getString("addonScriptPath"));
  }
  return intent;
 }
 static Intent engine(String action){return new Intent(Intent.ACTION_VIEW).setClassName(ENGINE,ENGINE+".activities.CaptureCtrl").putExtra("action",action);}
 static void awaitProxy(Operation operation)throws Exception{
  long deadline=System.currentTimeMillis()+60000;
  while(System.currentTimeMillis()<deadline){
   if(operation.cancelled)throw new IOException("任务已取消，正在停止采集");
   try(java.net.Socket socket=new java.net.Socket()){
    socket.connect(new java.net.InetSocketAddress("127.0.0.1",7780),300);socket.setSoTimeout(300);
    socket.getOutputStream().write(new byte[]{5,1,2});
    int version=socket.getInputStream().read(),method=socket.getInputStream().read();
    if(version==5&&method==2)return;
   }catch(IOException waiting){}
   Thread.sleep(300);
  }
  throw new IOException("解密代理未在 60 秒内就绪，已停止本次采集；需要检查组件运行状态");
 }
 static void observed(Context context,Intent data,Boolean running)throws Exception{
  synchronized(lock){
   JSONObject value=read(context);
   if(running!=null)value.put("engineRunning",running);
   value.put("engineStatusAt",System.currentTimeMillis());
   if(data!=null){
    for(String key:new String[]{"bytes_sent","bytes_rcvd","bytes_dumped","pkts_sent","pkts_rcvd","pkts_dropped"})if(data.hasExtra(key)){
     Object count=data.getExtras().get(key);if(count instanceof Number)value.put(key,((Number)count).longValue());
    }
    if(data.hasExtra("version_name"))value.put("engineVersion",data.getStringExtra("version_name"));
   }
   save(context,value);
  }
 }
 static void stopped(Context context)throws Exception{
  Thread.sleep(250);NetworkCaptureService.stop(context);
  synchronized(lock){JSONObject value=read(context);value.put("engineRunning",false).put("phase","stopped").put("captureBytes",NetworkCaptureService.bytes);save(context,value);}
 }
 static void awaitHttpExport(Context context)throws Exception{
  String source=read(context).optString("harUri");if(source.isEmpty())return;
  long deadline=System.currentTimeMillis()+10000,previous=-1,stableSince=0;
  while(System.currentTimeMillis()<deadline){
   long size=0;
   try(android.content.res.AssetFileDescriptor file=context.getContentResolver().openAssetFileDescriptor(Uri.parse(source),"r")){
    if(file!=null)size=file.getLength();
   }
   if(size>0&&size==previous){if(System.currentTimeMillis()-stableSince>=500)return;}
   else stableSince=System.currentTimeMillis();
   previous=size;Thread.sleep(200);
  }
 }
 static JSONObject results(Context context,JSONObject arguments)throws Exception{
  JSONObject value=read(context);
  if(value.optBoolean("engineRunning")||NetworkCaptureService.active)throw new IOException("请先调用 stop，待输出写入后读取结果");
  if(arguments.has("captureId")&&!arguments.getString("captureId").equals(value.optString("captureId")))throw new IOException("抓包编号不匹配，未混用其他任务的数据");
  JSONObject result=status(context);String pcap=value.optString("pcapPath");
  if(!pcap.isEmpty()){
   File file=WorkspaceFiles.resolve(context,pcap);result.put("captureBytes",file.length());
   if(file.length()>=24)result.put("pcap",new JSONObject(PacketSummary.read(file).json()));
  }
  String har=value.optString("harUri");
  if(!har.isEmpty()){
   try{
   File output=WorkspaceFiles.resolve(context,"network-captures/http-"+value.getString("captureId")+".har");
   {
    File temp=new File(output.getParentFile(),output.getName()+".part");
    try(InputStream in=context.getContentResolver().openInputStream(Uri.parse(har));OutputStream out=new FileOutputStream(temp)){
     if(in==null)throw new IOException("HTTP 输出不可读取");byte[] buffer=new byte[32768];long total=0;int count;
     while((count=in.read(buffer))!=-1){total+=count;if(total>HttpCaptureSummary.MAX_BYTES)throw new IOException("HAR 超过 16 MiB 分析上限，外部原文件已保留");out.write(buffer,0,count);}
    }catch(Exception error){temp.delete();throw error;}
    java.nio.file.Files.move(temp.toPath(),output.toPath(),java.nio.file.StandardCopyOption.REPLACE_EXISTING);
   }
   if(output.length()>0){
    JSONObject http=HttpCaptureSummary.read(output,arguments.optString("query"),arguments.optBoolean("includeBodies",true),Math.max(1,Math.min(20,arguments.optInt("limit",10))));
    result.put("http",http).put("tlsDecrypted",http.getBoolean("tlsDecrypted")).put("harPath",WorkspaceFiles.root(context).toPath().relativize(output.toPath()).toString());
   }else result.put("httpExportReady",false).put("instruction","HTTP 输出尚未写入。核对组件运行状态及 httpExportAuthorized，已授权时不要重复申请权限。结合事件诊断和实际响应排查，不能据此断定证书固定。");
   }catch(IOException|JSONException error){result.put("harAnalysisError",error.getMessage());}
  }
  String events=value.optString("eventsUri");
  if(!events.isEmpty()){
   File output=importFile(context,events,"network-captures/events-"+value.getString("captureId")+".jsonl");
   if(output.length()>0){
    JSONObject http=HttpCaptureSummary.readEvents(output,arguments.optString("query"),arguments.optBoolean("includeBodies",true),Math.max(1,Math.min(20,arguments.optInt("limit",10))));
    JSONObject harSummary=result.optJSONObject("http");
    if(harSummary!=null&&harSummary.optInt("responses")>http.optInt("responses")){
     harSummary.put("tlsErrors",http.getInt("tlsErrors")).put("tcpErrors",http.getInt("tcpErrors")).put("transportDiagnostics",http.getJSONArray("transportDiagnostics"));
     http=harSummary;
    }
    result.put("http",http).put("tlsDecrypted",http.getBoolean("tlsDecrypted")).put("httpExportReady",true);
    result.put("eventsPath",WorkspaceFiles.root(context).toPath().relativize(output.toPath()).toString());
    result.remove("instruction");
   }
  }
  return result;
 }
}
