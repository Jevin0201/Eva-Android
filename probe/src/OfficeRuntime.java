package ai.eva.android.probe;
import android.content.Context;
import java.io.*;
import java.nio.file.*;
import java.util.concurrent.*;
import org.json.*;

/** Runs bundled office adapter in the existing phone runtime; never a desktop service. */
final class OfficeRuntime {
 static final ExecutorService worker=Executors.newSingleThreadExecutor();
 static volatile boolean busy;static volatile String output="",state="尚未检查";
 static synchronized void start(Context raw,String action){
  if(busy)return;if(!java.util.Arrays.asList("status","install","selftest").contains(action))throw new IllegalArgumentException("未知操作");
  Context c=raw.getApplicationContext();busy=true;output="";state="正在运行";
  worker.execute(()->{try{
   deploy(c);Process p=process(c,action).start();StringBuilder log=new StringBuilder();
   try(BufferedReader in=new BufferedReader(new InputStreamReader(p.getInputStream(),"UTF-8"))){String line;while((line=in.readLine())!=null){
    if(log.length()<150000)log.append(line).append('\n');output=log.toString();
    try{JSONObject result=new JSONObject(line);if(result.has("progress"))state=result.getString("progress");else if(result.has("error"))state="失败："+result.getString("error");else if(result.has("ready"))state=result.getBoolean("ready")?"办公依赖已就绪":"办公依赖尚未完整安装";else if(result.optBoolean("passed"))state="四种格式生成与回读通过";}catch(Exception ignored){}
   }}
   int code=p.waitFor();if(code!=0&&!state.startsWith("失败"))state="执行失败（"+code+"），可检查后重试";
   c.getSharedPreferences("eva-office",0).edit().putString("lastState",state).putString("lastOutput",output).apply();
  }catch(Exception e){state="失败："+e.getMessage();output=state;}finally{busy=false;} });
 }
 static String instructions(){return "\nOffice documents: bundled phone tool python3 /root/eva-office.py status; run python3 /root/eva-office.py schema for required content JSON formats before create word|excel|ppt|pdf --input /root/eva-workspace/content.json --output /root/eva-workspace/new-file.ext; inspect --input /root/eva-workspace/file.ext. Check status before use; if missing dependencies ask the user to open Settings > 办公文档 > 安装或修复办公依赖 (or install only when authorized). Outputs must be new workspace files. XLSX formulas are preserved but NOT recalculated; this is not a full Office rendering engine. Never claim visual fidelity without previewing the produced document.\n";}
 static synchronized void deploy(Context c)throws IOException{
  File root=new File(c.getFilesDir(),"alpine/root");if(!new File(c.getFilesDir(),"alpine/usr/bin/python3").exists())throw new IOException("请先初始化手机运行环境");
  File target=new File(root,"eva-office.py"),tmp=new File(root,"eva-office.py.tmp");
  try(InputStream in=c.getAssets().open("office/eva-office.py")){Files.copy(in,tmp.toPath(),StandardCopyOption.REPLACE_EXISTING);}Files.move(tmp.toPath(),target.toPath(),StandardCopyOption.REPLACE_EXISTING);
 }
 static ProcessBuilder process(Context c,String...args){
  String lib=c.getApplicationInfo().nativeLibraryDir;java.util.ArrayList<String> cmd=new java.util.ArrayList<>(java.util.Arrays.asList(lib+"/liboperit_proot.so","-0","-r",new File(c.getFilesDir(),"alpine").getAbsolutePath(),"-b","/dev","-b","/proc","-w","/root/eva-workspace","/usr/bin/python3","/root/eva-office.py"));java.util.Collections.addAll(cmd,args);
  ProcessBuilder p=new ProcessBuilder(cmd);p.environment().put("PROOT_LOADER",lib+"/liboperit_loader.so");p.environment().put("PROOT_TMP_DIR",new File(c.getFilesDir(),"tmp").getAbsolutePath());p.environment().put("PATH","/usr/bin:/bin:/usr/sbin:/sbin");p.redirectErrorStream(true);return p;
 }
 static void cancel(Context c)throws IOException{File f=new File(c.getFilesDir(),"alpine/root/.eva-office/cancel");f.getParentFile().mkdirs();f.createNewFile();state="等待当前依赖事务结束后取消";}
}
