package ai.eva.android.probe;
import android.content.Intent;import android.widget.*;import java.io.*;import java.nio.file.*;import java.util.*;import java.util.concurrent.*;import org.json.*;

/** Explicit offline layout rendering. Does not install packages or modify the source. */
final class OfficeLayoutPreview {
 static final Semaphore renderer=new Semaphore(1);
 final WorkspacePreviewActivity host;final File source;final Button action;final TextView status;
 final ExecutorService worker=Executors.newSingleThreadExecutor();volatile Process process;volatile boolean destroyed,cancelled;boolean busy;
 OfficeLayoutPreview(WorkspacePreviewActivity h,File f){host=h;source=f;action=h.button("排版预览",()->{if(busy)cancel();else start();});status=h.label("内容视图；排版预览需本机渲染引擎，不验证动画播放。",12);h.body.addView(action,1);h.body.addView(status,2);}
 void start(){if(busy||destroyed)return;busy=true;cancelled=false;action.setText("取消排版预览");status.setText("正在本机渲染排版，原文件不会被覆盖…");worker.execute(()->{File destination=null;String result="";boolean acquired=false;try{
  if(OfficeRuntime.busy||!renderer.tryAcquire())throw new IOException("已有办公环境操作或排版任务正在运行，请稍后重试");acquired=true;
  File root=WorkspaceFiles.root(host),input=source.getCanonicalFile();if(!input.isFile()||!input.toPath().startsWith(root.toPath()))throw new IOException("源文件不在工作区内");long modified=input.lastModified(),size=input.length();
  destination=WorkspaceFiles.resolve(host,".eva-previews/"+UUID.randomUUID());Files.createDirectories(destination.getParentFile().toPath());if(destination.exists()||!destination.getCanonicalFile().equals(destination.getAbsoluteFile()))throw new IOException("预览目录包含链接");
  String relative=root.toPath().relativize(input.toPath()).toString().replace('\\','/'),output=root.toPath().relativize(destination.toPath()).toString().replace('\\','/');
  OfficeRuntime.deploy(host);if(cancelled||destroyed)throw new InterruptedException();
  ProcessBuilder builder=OfficeRuntime.process(host,"render","--input","/root/eva-workspace/"+relative,"--output-dir","/root/eva-workspace/"+output);List<String> cmd=builder.command();cmd.set(cmd.indexOf("/root/eva-office.py"),"/root/.eva-office/eva-render.py");
  Process child=LinuxRuntime.start(host,builder);process=child;if(cancelled||destroyed){child.destroyForcibly();throw new InterruptedException();}
  final StringBuilder log=new StringBuilder();Thread drain=new Thread(()->{try(BufferedReader reader=new BufferedReader(new InputStreamReader(child.getInputStream(),"UTF-8"))){String line;while((line=reader.readLine())!=null){synchronized(log){if(log.length()<65536)log.append(line).append('\n');}}}catch(IOException ignored){}},"eva-layout-output");drain.setDaemon(true);drain.start();
  if(!child.waitFor(240,TimeUnit.SECONDS)){child.destroyForcibly();throw new IOException("渲染超过四分钟，请稍后重试或减少文档页数");}drain.join(2000);if(cancelled||destroyed)throw new InterruptedException();
  String text; synchronized(log){text=log.toString();}JSONObject report=null;for(String line:text.split("\\n"))try{JSONObject row=new JSONObject(line);if(row.has("pdf")||row.has("error"))report=row;}catch(JSONException ignored){}
  if(child.exitValue()!=0||report==null||report.has("error"))throw new IOException("排版渲染未成功；可在设置→办公文档检查渲染引擎，当前内容视图仍可使用");
  String pdf=report.optString("pdf");if(!pdf.startsWith("/root/eva-workspace/"))throw new IOException("渲染结果路径无效");File rendered=WorkspaceFiles.resolve(host,pdf.substring("/root/eva-workspace/".length()));
  if(!rendered.toPath().startsWith(destination.getCanonicalFile().toPath())||!rendered.isFile()||!rendered.getName().toLowerCase(Locale.ROOT).endsWith(".pdf"))throw new IOException("渲染 PDF 不在本次预览目录内");if(modified!=input.lastModified()||size!=input.length())throw new IOException("源文件在渲染期间发生变化，请重新预览");
  result=root.toPath().relativize(rendered.toPath()).toString().replace('\\','/');
 }catch(InterruptedException e){Thread.currentThread().interrupt();result="";}catch(Exception e){final String error=e.getMessage();host.runOnUiThread(()->{if(!destroyed)status.setText(error==null?"排版预览失败，内容视图仍可使用":error);});}finally{Process p=process;process=null;if(p!=null&&p.isAlive())p.destroyForcibly();if(acquired)renderer.release();final String ready=result;host.runOnUiThread(()->{busy=false;if(destroyed)return;action.setText("排版预览");if(cancelled){status.setText("已取消排版预览；内容视图仍可使用");return;}if(!ready.isEmpty()){status.setText("排版预览已生成；右上角可另存原文");host.startActivity(new Intent(host,WorkspacePreviewActivity.class).putExtra("path",ready));}});}
 });}
 void cancel(){cancelled=true;Process p=process;if(p!=null)p.destroyForcibly();status.setText("正在取消排版预览…");}
 void destroy(){destroyed=true;cancelled=true;Process p=process;if(p!=null)p.destroyForcibly();worker.shutdownNow();}
}
