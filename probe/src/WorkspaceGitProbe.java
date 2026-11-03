package ai.eva.android.probe;

import android.app.*;
import android.content.Intent;
import android.os.*;
import android.view.*;
import android.widget.*;
import java.io.*;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.*;

/** Native bridge and actual Activity acceptance; unique disposable project only. */
final class WorkspaceGitProbe {
 static final AtomicBoolean testing=new AtomicBoolean();
 static void require(boolean condition,String message)throws IOException{if(!condition)throw new IOException(message);}
 static JSONObject call(Activity a,String folder,String action,JSONObject params)throws Exception{return WorkspaceGit.execute(a,params.put("folder",folder).put("action",action));}
 static boolean text(View view,String expected){if(view instanceof TextView&&((TextView)view).getText().toString().contains(expected))return true;if(view instanceof ViewGroup){ViewGroup group=(ViewGroup)view;for(int i=0;i<group.getChildCount();i++)if(text(group.getChildAt(i),expected))return true;}return false;}
 static void removeFixture(File project,File projects)throws Exception{
  require(project.getCanonicalFile().equals(project.getAbsoluteFile())&&project.getCanonicalFile().toPath().startsWith(projects.getCanonicalFile().toPath())&&project.getName().startsWith("git-native-check-"),"Fixture cleanup boundary mismatch");
  Files.walkFileTree(project.toPath(),new SimpleFileVisitor<Path>(){public FileVisitResult visitFile(Path file,BasicFileAttributes attrs)throws IOException{Files.delete(file);return FileVisitResult.CONTINUE;}public FileVisitResult postVisitDirectory(Path dir,IOException error)throws IOException{if(error!=null)throw error;Files.delete(dir);return FileVisitResult.CONTINUE;}});
 }
 static void check(Activity activity){if(!testing.compareAndSet(false,true))return;new Run(activity).start();}
 static final class Run implements Application.ActivityLifecycleCallbacks {
  final Activity origin;final Handler handler=new Handler(Looper.getMainLooper());final AtomicBoolean complete=new AtomicBoolean();final JSONObject report=new JSONObject();final long start=SystemClock.elapsedRealtime();
  File projects,project;String folder;boolean owned,registered;GitActivity screen;
  Run(Activity origin){this.origin=origin;}
  void start(){origin.getSharedPreferences("eva-workspace-git-check",0).edit().putString("result","{\"result\":\"RUNNING\"}").commit();new Thread(()->{try{
   projects=new File(origin.getFilesDir().getCanonicalFile(),"alpine/root/eva-workspace/projects").getCanonicalFile();require(projects.isDirectory()||projects.mkdirs(),"Projects directory unavailable");
   String name="git-native-check-"+UUID.randomUUID().toString();project=new File(projects,name);require(!project.exists()&&project.mkdir(),"Unique fixture could not be created");owned=true;folder="projects/"+name;
   JSONObject state=call(origin,folder,"status",new JSONObject());require(!state.getBoolean("repository"),"Empty fixture unexpectedly has repository");report.put("emptyState",true);
   state=call(origin,folder,"init",new JSONObject());require(state.getBoolean("repository")&&state.getString("branch").equals("main"),"Native init failed");report.put("nativeInit",true);
   File file=new File(project,"原生验收.txt");Files.write(file.toPath(),"原生 Git 验收 😀\n".getBytes("UTF-8"));
   state=call(origin,folder,"status",new JSONObject());require(state.getJSONArray("files").length()==1,"Native status missing fixture file");
   JSONObject diff=call(origin,folder,"diff",new JSONObject().put("path",file.getName()));require(diff.getString("text").contains("原生 Git 验收 😀"),"Native diff UTF8 mismatch");report.put("nativeStatusAndDiff",true);
   state=call(origin,folder,"stage",new JSONObject().put("path",file.getName()).put("token",state.getString("token")));require(state.getJSONArray("files").getJSONObject(0).getString("code").equals("A "),"Native stage failed");report.put("nativeStage",true);
   state=call(origin,folder,"commit",new JSONObject().put("token",state.getString("token")).put("message","原生封装验收").put("name","Eva Fixture").put("email","eva-fixture@example.invalid"));require(state.getJSONArray("files").length()==0,"Native commit not clean");require(new String(Files.readAllBytes(file.toPath()),"UTF-8").equals("原生 Git 验收 😀\n"),"Commit changed worktree");report.put("nativeCommitAndContentPreserved",true);
   origin.runOnUiThread(()->{try{origin.getApplication().registerActivityLifecycleCallbacks(this);registered=true;origin.startActivity(new Intent(origin,GitActivity.class).putExtra("folder",folder));handler.postDelayed(()->finish("Activity rendering timed out"),20000);}catch(Exception e){finish(e.toString());}});
  }catch(Exception e){finish(e.toString());}},"eva-git-native-check").start();}
  public void onActivityResumed(Activity activity){if(activity instanceof GitActivity&&folder.equals(activity.getIntent().getStringExtra("folder"))){screen=(GitActivity)activity;poll();}}
  void poll(){if(complete.get())return;try{if(screen!=null&&!screen.busy&&screen.state!=null){require(screen.state.getBoolean("repository")&&screen.state.getJSONArray("files").length()==0,"Activity state does not match fixture");require(text(screen.body,"工作区干净")&&text(screen.body,"分支：main")&&text(screen.body,folder),"Activity did not render real fixture status");report.put("activityOpened",true).put("activityRealStateRendered",true);finish(null);return;}handler.postDelayed(()->poll(),100);}catch(Exception e){finish(e.toString());}}
  void finish(String error){if(!complete.compareAndSet(false,true))return;origin.runOnUiThread(()->{handler.removeCallbacksAndMessages(null);if(registered){origin.getApplication().unregisterActivityLifecycleCallbacks(this);registered=false;}if(screen!=null&&!screen.isFinishing())screen.finish();new Thread(()->{try{if(error==null)report.put("result","PASS");else report.put("result","FAIL").put("error",error);boolean clean=true;if(owned)try{removeFixture(project,projects);}catch(Exception failure){clean=false;report.put("cleanupError",failure.toString());}report.put("fixtureCleanup",clean).put("elapsedMs",SystemClock.elapsedRealtime()-start);if(!clean)report.put("result","FAIL");}catch(Exception ignored){}finally{origin.getSharedPreferences("eva-workspace-git-check",0).edit().putString("result",report.toString()).commit();testing.set(false);origin.runOnUiThread(()->Toast.makeText(origin,"Git native check: "+report.optString("result"),Toast.LENGTH_LONG).show());}},"eva-git-check-cleanup").start();});}
  public void onActivityCreated(Activity a,Bundle b){}public void onActivityStarted(Activity a){}public void onActivityPaused(Activity a){}public void onActivityStopped(Activity a){}public void onActivitySaveInstanceState(Activity a,Bundle b){}public void onActivityDestroyed(Activity a){}
 }
}
