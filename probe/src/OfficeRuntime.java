package ai.eva.android.probe;
import android.content.Context;
import java.io.*;
import java.nio.file.*;
import java.util.concurrent.*;
import org.json.*;

/** Runs bundled office adapter in the existing phone runtime; never a desktop service. */
final class OfficeRuntime {
 static final ExecutorService worker=Executors.newSingleThreadExecutor();
 static volatile long skillsRevision;static volatile boolean busy;static volatile String output="",state="尚未检查";
 static synchronized void start(Context raw,String action){
  if(busy)return;if(!java.util.Arrays.asList("status","install","selftest","render-status","render-install","render-selftest","runtime-status").contains(action))throw new IllegalArgumentException("未知操作");
  Context c=raw.getApplicationContext();busy=true;output="";state="正在运行";
  worker.execute(()->{try{
   deploy(c);Process p=LinuxRuntime.start(c,process(c,action));StringBuilder log=new StringBuilder();
   try(BufferedReader in=new BufferedReader(new InputStreamReader(p.getInputStream(),"UTF-8"))){String line;while((line=in.readLine())!=null){
    if(log.length()<150000)log.append(line).append('\n');output=log.toString();
    try{JSONObject result=new JSONObject(line);if(result.has("progress"))state=result.getString("progress");else if(result.has("error"))state="失败："+result.getString("error");else if(result.has("ready"))state=result.getBoolean("ready")?"办公依赖已就绪":"办公依赖尚未完整安装";else if(result.optBoolean("passed"))state=action.equals("render-selftest")?"可编辑 PPT 与逐页渲染通过":"四种格式生成与回读通过";else if(result.has("office"))state=(result.getJSONObject("office").optBoolean("ready")?"Office 渲染可用":"Office 渲染未就绪")+" · "+(result.getJSONObject("html").optBoolean("ready")?"HTML 渲染可用":"HTML 渲染未就绪");else if(result.has("installed"))state="组件安装完成，请检查并执行验收";else if(result.optBoolean("hardlinks"))state="本地运行环境兼容检查通过";}catch(Exception ignored){}
   }}
   int code=p.waitFor();if(code!=0&&!state.startsWith("失败"))state="执行失败（"+code+"），可检查后重试";
   c.getSharedPreferences("eva-office",0).edit().putString("lastState",state).putString("lastOutput",output).apply();
  }catch(Exception e){state="失败："+e.getMessage();output=state;}finally{busy=false;} });
 }
 static String instructions(){return "Phone Git uses PRoot hardlink emulation. For direct Git commands pass -c core.createObject=rename, and clone with --no-hardlinks. The native workspace Git panel provides scoped HTTPS credentials and conflict handling. For phone-local APK builds read /root/.eva-codex/skills/eva-android-build/SKILL.md. SDK builder: python3 /root/.eva-runtime/eva-android-build.py status|install|build --project workspace-path --output-dir new-workspace-folder. \nLocal runtime: Alpine 3.22 aarch64, not Ubuntu; use apk, not apt-get. Local tools do not require ChatGPT login. For presentations read /root/.eva-codex/skills/eva-ppt/SKILL.md and its design reference; do not treat the basic title/body JSON generator as the full presentation skill. Editable layouts/templates: python3 /root/.eva-office/eva-presentations.py --input content.json --output new.pptx. For custom Python office scripts use PYTHONPATH=/root/.eva-office/lib. Renderer status: python3 /root/.eva-office/eva-render.py status; render all pages: python3 /root/.eva-office/eva-render.py render --input /root/eva-workspace/file.pptx --output-dir /root/eva-workspace/new-preview --expect-pages N --require-editable. Inspect every resulting PNG, not only file structure; blank/overflow/incorrect content must be fixed. Rendered PDF does not verify playback animations. Text-only models must not call OCR/ASCII/pixel checks a visual inspection; report that visual review is pending, or use an available image-capable review model. Capability installation/preflight: read /root/.eva-codex/skills/eva-capabilities/SKILL.md; python3 /root/.eva-runtime/eva-capabilities.py status or install --profile office-render|html-render|development|media, or install --apk package names. Installation and actual verification are separate. Existing basic office tools remain: python3 /root/eva-office.py status, schema, create word|excel|ppt|pdf, inspect. Outputs must be new workspace files; never overwrite the user's sources. XLSX formula strings are not recalculated by the basic writer; recalculate a new copy via python3 /root/.eva-office/eva-render.py recalculate --input /root/eva-workspace/file.xlsx --output-dir /root/eva-workspace/new-recalculated. Editable conversions use the same script convert --format docx|xlsx|pptx|odt|ods|odp --input source --output-dir new-folder. Existing sources are preserved; unsupported macros/external workbook links are rejected.\n";}
 static synchronized void deploy(Context c)throws IOException{
  File root=new File(c.getFilesDir(),"alpine/root").getCanonicalFile();if(!new File(c.getFilesDir(),"alpine/usr/bin/python3").exists())throw new IOException("请先初始化手机运行环境");
  copyAsset(c,"office/eva-render.py",new File(root,".eva-office/eva-render.py"),root);
  copyAsset(c,"office/eva-presentations.py",new File(root,".eva-office/eva-presentations.py"),root);
  copyAsset(c,"office/eva-capabilities.py",new File(root,".eva-runtime/eva-capabilities.py"),root);
  copyAsset(c,"office/eva-android-build.py",new File(root,".eva-runtime/eva-android-build.py"),root);
  for(String skill:new String[]{"eva-ppt","eva-capabilities","eva-android-build"}){File folder=new File(root,".eva-codex/skills/"+skill),file=new File(folder,"SKILL.md");if(file.isFile()&&!new String(Files.readAllBytes(file.toPath()),"UTF-8").contains("# Eva Android managed skill"))continue;if(copyTree(c,"office/skills/"+skill,folder,root))skillsRevision++;}
  File target=new File(root,"eva-office.py"),tmp=new File(root,"eva-office.py.tmp");
  try(InputStream in=c.getAssets().open("office/eva-office.py")){Files.copy(in,tmp.toPath(),StandardCopyOption.REPLACE_EXISTING);}Files.move(tmp.toPath(),target.toPath(),StandardCopyOption.REPLACE_EXISTING);
 }
 static boolean copyAsset(Context c,String asset,File target,File root)throws IOException{if(!target.getCanonicalFile().equals(target.getAbsoluteFile())||!target.getCanonicalPath().startsWith(root.getCanonicalPath()+File.separator))throw new IOException("能力资源路径包含链接或越界："+asset);target.getParentFile().mkdirs();byte[] bytes;try(InputStream in=c.getAssets().open(asset);ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] b=new byte[16384];int n;while((n=in.read(b))!=-1)out.write(b,0,n);bytes=out.toByteArray();}if(target.isFile()&&java.util.Arrays.equals(Files.readAllBytes(target.toPath()),bytes))return false;File temp=File.createTempFile("asset-",".tmp",target.getParentFile());try{Files.write(temp.toPath(),bytes);Files.move(temp.toPath(),target.toPath(),StandardCopyOption.REPLACE_EXISTING);}finally{temp.delete();}return true;}
 static boolean copyTree(Context c,String asset,File folder,File root)throws IOException{boolean changed=false;String[] names=c.getAssets().list(asset);for(String name:names){String child=asset+"/"+name;if(c.getAssets().list(child).length>0)changed|=copyTree(c,child,new File(folder,name),root);else changed|=copyAsset(c,child,new File(folder,name),root);}return changed;}
 static ProcessBuilder process(Context c,String...args){
  String lib=c.getApplicationInfo().nativeLibraryDir;java.util.ArrayList<String> cmd=new java.util.ArrayList<>(java.util.Arrays.asList(lib+"/liboperit_proot.so","-0","-r",new File(c.getFilesDir(),"alpine").getAbsolutePath(),"-b","/dev","-b","/proc","-w","/root/eva-workspace","/usr/bin/python3","/root/eva-office.py"));java.util.Collections.addAll(cmd,args);
  ProcessBuilder p=new ProcessBuilder(cmd);p.environment().put("PROOT_LOADER",lib+"/liboperit_loader.so");p.environment().put("PROOT_TMP_DIR",new File(c.getFilesDir(),"tmp").getAbsolutePath());p.environment().put("PATH","/usr/bin:/bin:/usr/sbin:/sbin");p.redirectErrorStream(true);return p;
 }
 static void cancel(Context c)throws IOException{File f=new File(c.getFilesDir(),"alpine/root/.eva-office/cancel");f.getParentFile().mkdirs();f.createNewFile();state="等待当前依赖事务结束后取消";}
}
