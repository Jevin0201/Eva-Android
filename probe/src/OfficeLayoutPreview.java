package ai.eva.android.probe;
import android.content.Intent;import android.widget.*;import java.io.*;import java.nio.file.*;import java.util.*;import java.util.concurrent.*;import org.json.*;

/** Final Office pages, rendered offline into a verified derivative; source is never modified. */
final class OfficeLayoutPreview {
 static final Semaphore renderer=new Semaphore(1);
 final WorkspacePreviewActivity host;final File source;String status="独立高级转换工具：生成额外 PDF 副本；原文件不会被覆盖。";android.app.AlertDialog details;
 final ExecutorService worker=Executors.newSingleThreadExecutor();volatile Process process;volatile boolean destroyed,cancelled;boolean busy;boolean showWhenReady=true;
 JSONArray visibleSheets;
 static boolean handles(File file){return Arrays.asList("docx","xlsx","pptx","odt","ods","odp","doc","xls","ppt").contains(DocumentPreview.ext(file));}
 OfficeLayoutPreview(WorkspacePreviewActivity h,File f){host=h;source=f;}
 void showDetails(){if(destroyed)return;if(details!=null)details.dismiss();details=new android.app.AlertDialog.Builder(host).setTitle("Office 转 PDF（高级）").setMessage(status).setNegativeButton("关闭",null).setPositiveButton(busy?"取消生成":"生成 PDF 副本",(dialog,which)->{if(busy)cancel();else start();}).create();details.show();}
 void setStatus(String text){status=text;if(details!=null&&details.isShowing())details.setMessage(text);if(busy)host.setLayoutProgress(text);}
 void start(){showWhenReady=true;if(busy||destroyed)return;
  if(Arrays.asList("doc","xls","ppt").contains(DocumentPreview.ext(source))){host.showOfficeStatus("failed","旧版 DOC/XLS/PPT 尚不在当前安全渲染器支持范围，请先转换为 DOCX/XLSX/PPTX；原文件已保留。",false);return;}
  visibleSheets=null;host.showOfficeStatus("preparing","正在检查最终排版缓存与办公引擎…",true);
  busy=true;cancelled=false;setStatus("正在本机渲染排版，原文件不会被覆盖…");Toast.makeText(host,"正在生成排版 PDF，可在更多工具查看或取消",Toast.LENGTH_SHORT).show();worker.execute(()->{File destination=null;File result=null;String failure="最终排版未完成，请重试";boolean acquired=false,needsComponent=false;ExecutionLease lease=null;try{
  lease=ExecutionLease.acquire(host,"office-layout:"+UUID.randomUUID());
  File root=WorkspaceFiles.root(host),input=source.getCanonicalFile();if(!input.isFile()||!input.toPath().startsWith(root.toPath()))throw new IOException("源文件不在工作区内");long modified=input.lastModified(),size=input.length();
  if(size>32L*1024*1024)throw new IOException("原版预览支持 32 MiB 内文档");
  String sourceHash=sha256(input),rendererHash=rendererHash();
  File cached=readCache(root,input,sourceHash,rendererHash,modified,size);
  if(cached!=null){result=cached;return;}
  if(!RuntimeComponents.installed(host,"office")){needsComponent=true;return;}
  long waitUntil=System.currentTimeMillis()+10000;while(OfficeRuntime.busy&&System.currentTimeMillis()<waitUntil){if(cancelled||destroyed)throw new InterruptedException();Thread.sleep(100);}
  if(OfficeRuntime.busy||!renderer.tryAcquire(10,TimeUnit.SECONDS))throw new IOException("已有办公环境操作或排版任务正在运行，请稍后重试");acquired=true;
  destination=WorkspaceFiles.resolve(host,".eva-previews/"+UUID.randomUUID());Files.createDirectories(destination.getParentFile().toPath());if(destination.exists()||!destination.getCanonicalFile().equals(destination.getAbsoluteFile()))throw new IOException("预览目录包含链接");
  String relative=root.toPath().relativize(input.toPath()).toString().replace('\\','/'),output=root.toPath().relativize(destination.toPath()).toString().replace('\\','/');
  OfficeRuntime.deploy(host);if(cancelled||destroyed)throw new InterruptedException();
  ProcessBuilder builder=OfficeRuntime.process(host,"preview","--input","/root/eva-workspace/"+relative,"--output-dir","/root/eva-workspace/"+output);List<String> cmd=builder.command();cmd.set(cmd.indexOf("/root/eva-office.py"),"/root/.eva-office/eva-render.py");
  Process child=LinuxRuntime.start(host,builder);process=child;if(cancelled||destroyed){child.destroyForcibly();throw new InterruptedException();}
  final StringBuilder log=new StringBuilder();Thread drain=new Thread(()->{try(BufferedReader reader=new BufferedReader(new InputStreamReader(child.getInputStream(),"UTF-8"))){String line;while((line=reader.readLine())!=null){synchronized(log){if(log.length()<65536)log.append(line).append('\n');}}}catch(IOException ignored){}},"eva-layout-output");drain.setDaemon(true);drain.start();
  if(!child.waitFor(240,TimeUnit.SECONDS)){child.destroyForcibly();throw new IOException("渲染超过四分钟，请稍后重试或减少文档页数");}drain.join(2000);if(cancelled||destroyed)throw new InterruptedException();
  String text; synchronized(log){text=log.toString();}JSONObject report=null;for(String line:text.split("\\n"))try{JSONObject row=new JSONObject(line);if(row.has("pdf")||row.has("error"))report=row;}catch(JSONException ignored){}
  if(child.exitValue()!=0||report==null||report.has("error"))throw new IOException("最终排版渲染未成功："+(report==null?"未收到有效渲染报告":report.optString("error","渲染进程退出异常")));
  String pdf=report.optString("pdf");if(!pdf.startsWith("/root/eva-workspace/"))throw new IOException("渲染结果路径无效");File rendered=WorkspaceFiles.resolve(host,pdf.substring("/root/eva-workspace/".length()));
  if(!rendered.toPath().startsWith(destination.getCanonicalFile().toPath())||!rendered.isFile()||!rendered.getName().toLowerCase(Locale.ROOT).endsWith(".pdf"))throw new IOException("渲染 PDF 不在本次预览目录内");if(modified!=input.lastModified()||size!=input.length()||!sourceHash.equals(sha256(input)))throw new IOException("源文件在渲染期间发生变化，请重新预览");
  if(!report.optBoolean("sourcePreserved")||!sourceHash.equals(report.optString("sourceSHA256")))throw new IOException("最终排版报告未证实原文件保持不变");
  writeCache(root,input,rendered,sourceHash,rendererHash,modified,size,report);
  result=rendered;
 }catch(InterruptedException e){Thread.currentThread().interrupt();result=null;}catch(Exception e){failure=e.getMessage()==null?"最终排版失败，请重试":e.getMessage();}finally{Process p=process;process=null;if(p!=null&&p.isAlive()){p.destroyForcibly();try{p.waitFor(2,TimeUnit.SECONDS);}catch(InterruptedException ignored){Thread.currentThread().interrupt();}}if(acquired)renderer.release();if(lease!=null)lease.close();final File ready=result;final String error=failure;final boolean missingComponent=needsComponent;host.runOnUiThread(()->{busy=false;if(destroyed)return;host.setLayoutProgress(null);if(details!=null)details.dismiss();if(cancelled){setStatus("已取消最终排版；原文件保留");if(showWhenReady)host.showOfficeStatus("cancelled",status,false);return;}if(missingComponent){host.showOfficeStatus("waiting-component","需要办公组件。确认安装后将自动生成最终排版。",true);host.pendingLayout=true;try{host.startActivityForResult(new Intent(host,RuntimeSetupActivity.class).putExtra("component","office"),721);}catch(Exception launchError){host.pendingLayout=false;host.showOfficeStatus("failed","无法打开办公组件安装页，请重试",false);}return;}if(ready!=null){setStatus("最终排版已就绪；另存仍导出原文件");if(showWhenReady)host.showOfficeOriginal(ready,visibleSheets);}else{setStatus(error);if(showWhenReady)host.showOfficeStatus("failed",error,false);else Toast.makeText(host,error,Toast.LENGTH_LONG).show();}});}
 });}
 static String sha256(File file)throws Exception{try(InputStream input=new FileInputStream(file)){return sha256(input);}}
 static String sha256(InputStream input)throws Exception{java.security.MessageDigest digest=java.security.MessageDigest.getInstance("SHA-256");byte[] bytes=new byte[32768];int count;while((count=input.read(bytes))!=-1)digest.update(bytes,0,count);StringBuilder hex=new StringBuilder();for(byte b:digest.digest())hex.append(String.format(Locale.ROOT,"%02x",b&255));return hex.toString();}
 String rendererHash()throws Exception{try(InputStream input=host.getAssets().open("office/eva-render.py")){return sha256(input);}}
 static File cacheDirectory(File cacheRoot)throws IOException{
  File trusted=cacheRoot.getCanonicalFile(),directory=new File(trusted,"office-layout-v1");
  if(Files.isSymbolicLink(directory.toPath()))throw new IOException("排版缓存记录目录包含链接");
  if(!directory.exists()&&!directory.mkdir())throw new IOException("无法创建排版缓存记录目录");
  File canonical=directory.getCanonicalFile();
  if(Files.isSymbolicLink(directory.toPath())||!Files.isDirectory(directory.toPath(),LinkOption.NOFOLLOW_LINKS)||!trusted.equals(canonical.getParentFile()))throw new IOException("排版缓存记录目录包含链接或越界");
  return canonical;
 }
 File cacheRecord()throws Exception{
  File directory=cacheDirectory(host.getCacheDir());
  String key;try(InputStream input=new ByteArrayInputStream(source.getCanonicalPath().getBytes("UTF-8"))){key=sha256(input);}
  File record=new File(directory,key+".json");if(Files.isSymbolicLink(record.toPath()))throw new IOException("排版缓存记录包含链接");return record;
 }
 static int verifyPdf(File file)throws Exception{
  if(!file.isFile()||file.length()<100||file.length()>32L*1024*1024)throw new IOException("排版 PDF 大小无效或超过 32 MiB");
  try(android.os.ParcelFileDescriptor descriptor=android.os.ParcelFileDescriptor.open(file,android.os.ParcelFileDescriptor.MODE_READ_ONLY);android.graphics.pdf.PdfRenderer pdf=new android.graphics.pdf.PdfRenderer(descriptor)){
   if(pdf.getPageCount()<1)throw new IOException("排版 PDF 没有页面");return pdf.getPageCount();
  }
 }
 static JSONArray checkedSheetNames(JSONArray names,int pages)throws Exception{
  if(names==null||names.length()<1||names.length()>300||names.length()!=pages)throw new IOException("工作表元信息与最终 PDF 页数不匹配");
  JSONArray checked=new JSONArray();
  for(int i=0;i<names.length();i++){
   Object value=names.get(i);if(!(value instanceof String))throw new IOException("工作表名称必须是文字");String name=(String)value;
   if(name.trim().isEmpty()||name.length()>200)throw new IOException("工作表名称为空或超过 200 字符");
   for(int c=0;c<name.length();c++)if(Character.isISOControl(name.charAt(c)))throw new IOException("工作表名称含控制字符");
   checked.put(name);
  }
  return checked;
 }
 static JSONArray reportSheets(File input,JSONObject report,int pages)throws Exception{
  Object count=report.opt("pageCount");if(!(count instanceof Integer||count instanceof Long)||((Number)count).longValue()!=pages)throw new IOException("渲染报告页数与最终 PDF 不一致");
  if(!Arrays.asList("xlsx","ods").contains(DocumentPreview.ext(input)))return null;
  if(!"single-page-visible-sheets".equals(report.optString("spreadsheetMode")))throw new IOException("最终工作表导出模式未核验");
  return checkedSheetNames(report.optJSONArray("visibleSheets"),pages);
 }
 File readCache(File root,File input,String sourceHash,String rendererHash,long modified,long size)throws Exception{
  File record=cacheRecord();if(!record.isFile()||record.length()>512*1024)return null;
  try{
   JSONObject row=new JSONObject(new String(Files.readAllBytes(record.toPath()),"UTF-8"));
   if(row.optInt("schema")!=2||!input.getPath().equals(row.optString("source"))||!sourceHash.equals(row.optString("sourceSha256"))||!rendererHash.equals(row.optString("rendererSha256"))||row.optLong("modified",-1)!=modified||row.optLong("size",-1)!=size||input.lastModified()!=modified||input.length()!=size)return null;
   String relative=row.optString("pdf");if(!relative.startsWith(".eva-previews/"))return null;
   File directory=new File(root,".eva-previews"),raw=new File(root,relative),pdf=WorkspaceFiles.resolve(host,relative);if(!directory.getCanonicalFile().equals(directory.getAbsoluteFile())||!raw.getAbsoluteFile().equals(pdf)||!pdf.toPath().startsWith(directory.toPath())||!pdf.getName().endsWith(".pdf")||pdf.length()>32L*1024*1024||!sha256(pdf).equals(row.optString("pdfSha256")))return null;
   int pages=verifyPdf(pdf);visibleSheets=reportSheets(input,row,pages);return pdf;
  }catch(Exception invalidCache){return null;}
 }
 void writeCache(File root,File input,File pdf,String sourceHash,String rendererHash,long modified,long size)throws Exception{
  writeCache(root,input,pdf,sourceHash,rendererHash,modified,size,new JSONObject().put("pageCount",verifyPdf(pdf)));
 }
 void writeCache(File root,File input,File pdf,String sourceHash,String rendererHash,long modified,long size,JSONObject report)throws Exception{
  int pages=verifyPdf(pdf);JSONArray names=reportSheets(input,report,pages);
  JSONObject row=new JSONObject().put("schema",2).put("pageCount",pages).put("source",input.getPath()).put("sourceSha256",sourceHash).put("rendererSha256",rendererHash).put("modified",modified).put("size",size)
   .put("pdf",root.toPath().relativize(pdf.toPath()).toString().replace('\\','/')).put("pdfSha256",sha256(pdf));
  if(names!=null)row.put("visibleSheets",names).put("spreadsheetMode","single-page-visible-sheets");
  android.util.AtomicFile record=new android.util.AtomicFile(cacheRecord());FileOutputStream output=null;
  try{output=record.startWrite();output.write(row.toString().getBytes("UTF-8"));record.finishWrite(output);visibleSheets=names;}catch(Exception error){if(output!=null)record.failWrite(output);throw error;}
 }
 void cancel(){cancelled=true;host.pendingLayout=false;if(!busy){host.showOfficeStatus("cancelled","已取消最终排版；原文件保留，可重试",false);return;}Process p=process;if(p!=null)p.destroyForcibly();setStatus("正在取消排版预览…");}
 void destroy(){destroyed=true;cancelled=true;if(details!=null){details.dismiss();details=null;}Process p=process;if(p!=null)p.destroyForcibly();worker.shutdownNow();}
}
