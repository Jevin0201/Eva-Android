package ai.eva.android.probe;
import android.content.*;import android.os.*;import java.io.*;import java.nio.file.*;import java.util.*;import java.util.concurrent.*;import org.json.*;
/** Runs the original desktop controller locally in Eva's existing Node runtime. */
final class DesktopBrowserRuntime {
 static java.lang.Process process;static BufferedWriter input;static final class Request {
  final java.lang.Process child;final BrowserOwnership.Lease lease;
  final CompletableFuture<JSONObject> result=new CompletableFuture<>();
  volatile String stage="等待控制器启动";
  Request(java.lang.Process child,BrowserOwnership.Lease lease){this.child=child;this.lease=lease;}
 }
 static final Map<String,Request> pending=new ConcurrentHashMap<>();
 static void cancelLease(BrowserOwnership.Lease lease){
  for(Map.Entry<String,Request> entry:pending.entrySet())if(entry.getValue().lease==lease){
   String id=entry.getKey();Request r=entry.getValue();
   if(r.result.completeExceptionally(new IOException("浏览器控制已暂停或窗口已更换；请重新读取页面核对进度。"))){
    new Thread(()->{try{write(r.child,new JSONObject().put("cancel",id));}catch(Exception ignored){}},"eva-browser-cancel").start();
   }
  }
 }
 static void validateRequest(String id)throws IOException{
  Request r=pending.get(id);if(r==null)throw new IOException("浏览器请求已结束");
  BrowserOwnership.validate(r.lease,BrowserWindow.live);
 }
 static byte[] read(InputStream in)throws IOException{ByteArrayOutputStream out=new ByteArrayOutputStream();DesktopBrowserHost.pump(in,out);return out.toByteArray();}
 static JSONArray specs(Context c)throws Exception{try(InputStream in=c.getAssets().open("desktop-browser/tools.json")){
   JSONArray tools=new JSONArray(new String(read(in),"UTF-8"));
   for(int i=0;i<tools.length();i++){
    JSONObject tool=tools.getJSONObject(i);String name=tool.getString("name"),extra="";
    if("browser_snapshot".equals(name))extra=" 优先用最新快照的语义元素编号定位控件。登录或导航后重新获取快照。高级读取失败时可用 eva_browser observe 读取当前页。";
    if("browser_act".equals(name))extra=" 使用最新快照定位控件，可在页面状态明确时按步骤批量操作。写入后的状态未确认时，先观察结果，勿重复提交。";
    if("browser_cdp".equals(name))extra=" 常规网页工作优先 browser_snapshot、browser_inspect、browser_act。恢复失败时说明卡在哪一步和哪些工作未做完。";
    if(!extra.isEmpty())tool.put("description",tool.getString("description")+extra);
   }return tools;
 }}
 static void copy(Context c,String asset,File dest)throws Exception{String[] children=c.getAssets().list(asset);if(children!=null&&children.length>0){dest.mkdirs();for(String child:children)copy(c,asset+"/"+child,new File(dest,child));}else{dest.getParentFile().mkdirs();try(InputStream in=c.getAssets().open(asset)){Files.copy(in,dest.toPath(),StandardCopyOption.REPLACE_EXISTING);}}}
 static synchronized void start(Context c)throws Exception{if(process!=null&&process.isAlive())return;File root=new File(c.getFilesDir(),"alpine"),target=new File(root,"root/eva-browser");copy(c,"desktop-browser",target);String lib=c.getApplicationInfo().nativeLibraryDir;
 ProcessBuilder pb=new ProcessBuilder(lib+"/liboperit_proot.so","-0","-r",root.getAbsolutePath(),"-b","/dev","-b","/proc","-w","/root/eva-workspace","/usr/bin/node","/root/eva-browser/android-worker.mjs",DesktopBrowserHost.get(c).endpoint());pb.environment().put("EVA_ANDROID_ROOT",root.getAbsolutePath());pb.environment().put("PROOT_LOADER",lib+"/liboperit_loader.so");pb.environment().put("PROOT_TMP_DIR",new File(c.getFilesDir(),"tmp").getAbsolutePath());java.lang.Process child=LinuxRuntime.start(c,pb);process=child;input=new BufferedWriter(new OutputStreamWriter(child.getOutputStream(),"UTF-8"));
 new Thread(()->{try(BufferedReader reader=new BufferedReader(new InputStreamReader(child.getInputStream(),"UTF-8"))){
  String line;while((line=reader.readLine())!=null){JSONObject row=new JSONObject(line);Request r=pending.get(row.optString("id"));if(r==null||r.child!=child)continue;
   if(row.has("stage")){r.stage=row.getString("stage");continue;}
   JSONObject result=row.optJSONObject("result");
   if(row.has("error"))r.result.completeExceptionally(new IOException(r.stage+"："+row.optString("error","浏览器调用失败")));
   else if(result!=null)r.result.complete(result);
   else r.result.completeExceptionally(new IOException(r.stage+"：控制器返回格式无效"));
  }
 }catch(Exception error){child.destroy();}finally{for(Request r:pending.values())if(r.child==child)r.result.completeExceptionally(new IOException(r.stage+"：浏览器控制器已停止"));}},"eva-browser-results").start();
 new Thread(()->{try(InputStream in=child.getErrorStream()){byte[] b=new byte[4096];while(in.read(b)!=-1){}}catch(Exception ignored){}},"eva-browser-errors").start();}
 static synchronized void write(java.lang.Process child,JSONObject row)throws Exception{
  if(process!=child||!child.isAlive())throw new IOException("浏览器控制器已停止");
  input.write(row.toString());input.newLine();input.flush();
 }
 static synchronized Request begin(Context c,BrowserOwnership.Lease lease,String id)throws Exception{
  try{start(c);}catch(Exception error){throw new IOException("启动手机浏览器控制器失败，请检查 Eva 运行环境。",error);}
  BrowserOwnership.validate(lease,BrowserWindow.live);
  Request request=new Request(process,lease);pending.put(id,request);return request;
 }
 static synchronized void reset(java.lang.Process child){
  if(process==child){process=null;input=null;child.destroy();}
 }
 static boolean readOnly(String tool,JSONObject args){
  return Arrays.asList("browser_snapshot","browser_inspect","browser_table","browser_screenshot","browser_downloads").contains(tool)
   ||("browser_cdp".equals(tool)&&"Page.getFrameTree".equals(args.optString("method"))&&"send".equals(args.optString("cdpAction","send")));
 }
 static JSONObject execute(Context c,JSONObject p)throws Exception{
  String tool=p.getString("tool");JSONObject args=p.getJSONObject("arguments");
  boolean read=readOnly(tool,args);
  for(int attempt=0;;attempt++){
   BrowserOwnership.Lease lease=BrowserOwnership.await(p);
   try{return executeOnce(c,p,lease,tool,args,read);}
   catch(Exception error){
    BrowserOwnership.afterFailure(p,lease);
    if(!read||attempt>0||error instanceof InterruptedException)throw error;
   }
  }
 }
 static JSONObject executeOnce(Context c,JSONObject p,BrowserOwnership.Lease lease,String tool,JSONObject args,boolean read)throws Exception{
  if(BrowserWindow.live==null){
   try{JSONObject ready=BrowserTools.execute(c,new JSONObject().put("action","show"),lease).get(6,TimeUnit.SECONDS);
    if(BrowserWindow.live==null)throw new IOException(ready.optString("observationError","网页窗口未就绪"));
   }catch(TimeoutException e){throw new IOException("打开 Eva 浏览器窗口超时",e);}
  }
  String id=KernelHost.turnKey(p)+":"+UUID.randomUUID();
  Request request=begin(c,lease,id);long budget=read?12000:45000,deadline=SystemClock.elapsedRealtime()+budget;
  try{
   write(request.child,new JSONObject().put("id",id).put("session",p.getString("threadId")).put("tool",tool).put("args",args));
   while(true){
    BrowserOwnership.validate(lease,BrowserWindow.live);
    if(SystemClock.elapsedRealtime()>=deadline){
     reset(request.child);
     throw new IOException(request.stage+"超过 "+budget/1000+" 秒。"+(read?"可用 eva_browser observe 读取当前页，若仍失败请说明未完成的步骤。":"操作结果未确认，请观察页面，勿重复提交。"));
    }
    try{JSONObject out=request.result.get(200,TimeUnit.MILLISECONDS);BrowserOwnership.validate(lease,BrowserWindow.live);return out;}
    catch(TimeoutException wait){ /* recheck lease and deadline */ }
    catch(ExecutionException failed){throw new IOException(failed.getCause().getMessage(),failed);}
   }
  }finally{
   pending.remove(id,request);
   if(!request.result.isDone())try{write(request.child,new JSONObject().put("cancel",id));}catch(Exception ignored){}
  }
 }
 static JSONObject failure(Exception error){
  try{
   Throwable cause=error instanceof ExecutionException&&error.getCause()!=null?error.getCause():error;
   String message=cause.getMessage();
   if(message==null||message.isEmpty())message="浏览器操作未完成；请重新观察当前页面。";
   return new JSONObject().put("success",false).put("contentItems",new JSONArray().put(new JSONObject().put("type","inputText").put("text",message)));
  }catch(JSONException impossible){throw new IllegalStateException(impossible);}
 }
 static void reply(KernelHost host,JSONObject request,JSONObject response){
  try{host.write(new JSONObject().put("id",request.get("id")).put("result",response));}
  catch(Exception error){android.util.Log.w("EvaBrowser","Browser tool reply could not be sent");}
 }
 static boolean handle(KernelHost host,JSONObject request){
  JSONObject p=request.optJSONObject("params");
  if(!"item/tool/call".equals(request.optString("method"))||p==null||!p.optString("tool").startsWith("browser_"))return false;
  host.work.execute(()->{
   JSONObject response;
   try{JSONObject out=execute(host.context,p);response=new JSONObject().put("success",true).put("contentItems",new JSONArray().put(new JSONObject().put("type","inputText").put("text",out.toString())));}
   catch(Exception error){response=failure(error);}
   reply(host,request,response);
  });
  return true;
 }
}
