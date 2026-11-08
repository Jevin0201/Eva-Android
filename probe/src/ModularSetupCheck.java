package ai.eva.android.probe;

import android.app.Instrumentation;
import android.content.*;
import android.os.Bundle;
import java.io.*;
import java.nio.file.*;
import org.json.*;

/** Isolated readiness/upgrade checks, without touching user files or downloading packages. */
public final class ModularSetupCheck extends Instrumentation {
 private int checks;
 private void check(boolean value,String label){if(!value)throw new AssertionError(label);checks++;}
 private static void touch(File file)throws Exception{file.getParentFile().mkdirs();file.createNewFile();}
 public void onCreate(Bundle args){super.onCreate(args);start();}
 public void onStart(){Bundle result=new Bundle();File scratch=new File(getTargetContext().getCacheDir(),"modular-check-"+java.util.UUID.randomUUID());String prefix="modular-check-"+java.util.UUID.randomUUID()+"-";
  Context c=new ContextWrapper(getTargetContext()){
   public File getFilesDir(){return scratch;}
   public Context getApplicationContext(){return this;}
   public SharedPreferences getSharedPreferences(String name,int mode){return super.getSharedPreferences(prefix+name,mode);}
  };
  try{
   scratch.mkdirs();check(!RuntimeBootstrap.status(c).optBoolean("ready"),"empty root not ready");
   boolean rejected=false;try{RuntimeBootstrap.ensure(c);}catch(IOException expected){rejected=expected.getMessage().contains("确认安装");}check(rejected,"no install before user consent");check(!new File(scratch,"alpine").exists(),"no root created without consent");
   for(String path:new String[]{"bin/sh","usr/bin/python3","usr/bin/node","usr/bin/git","root/eva-kernel/bin/codex"})touch(new File(scratch,"alpine/"+path));
   c.getSharedPreferences("eva-runtime-bootstrap",0).edit().putBoolean("ready",true).commit();
   check(!RuntimeBootstrap.status(c).optBoolean("ready"),"base files alone not ready");
   touch(new File(RuntimeComponents.base(c),"core.json"));check(RuntimeBootstrap.status(c).optBoolean("ready"),"core ready without optional tools");
   for(String id:RuntimeComponents.IDS)check(!RuntimeComponents.installed(c,id),"optional starts uninstalled: "+id);
   touch(new File(RuntimeComponents.base(c),"office.json"));check(!RuntimeComponents.installed(c,"office"),"stale marker cannot replace missing executable");
   touch(new File(scratch,"alpine/usr/bin/libreoffice"));check(RuntimeComponents.installed(c,"office"),"verified module record with executable");
   File guestRoot=new File(scratch,"alpine"),entry=new File(guestRoot,"usr/bin/libreoffice");
   Files.delete(entry.toPath());File realEntry=new File(guestRoot,"usr/lib/libreoffice/program/soffice");touch(realEntry);
   Files.createSymbolicLink(entry.toPath(),Paths.get("/usr/lib/libreoffice/program/soffice"));
   check(RuntimeComponents.installed(c,"office")&&RuntimeComponents.guestFile(guestRoot,"/usr/bin/libreoffice").equals(realEntry.getCanonicalFile()),"guest absolute executable symlink resolves inside Alpine");
   Files.delete(entry.toPath());Files.createSymbolicLink(entry.toPath(),Paths.get("../lib/libreoffice/program/soffice"));
   check(RuntimeComponents.installed(c,"office"),"guest relative executable symlink resolves inside Alpine");
   Files.delete(entry.toPath());Files.createSymbolicLink(entry.toPath(),Paths.get("/usr/bin/libreoffice"));
   check(!RuntimeComponents.installed(c,"office"),"guest symlink cycle rejected");
   Files.delete(entry.toPath());Files.createSymbolicLink(entry.toPath(),Paths.get("../../../outside-office"));
   File outside=new File(scratch,"outside-office");touch(outside);
   check(!RuntimeComponents.installed(c,"office"),"relative symlink cannot escape Alpine root");
   Files.delete(entry.toPath());Files.createSymbolicLink(entry.toPath(),Paths.get("/usr/lib/libreoffice/program/missing"));
   check(!RuntimeComponents.installed(c,"office"),"missing guest symlink target rejected");
   Files.delete(entry.toPath());Files.createSymbolicLink(entry.toPath(),outside.toPath());
   check(!RuntimeComponents.installed(c,"office"),"host absolute target is not mistaken for guest executable");
   Files.delete(entry.toPath());Files.createSymbolicLink(entry.toPath(),Paths.get("/usr/lib/libreoffice/program/soffice"));
   File bin=new File(guestRoot,"sbin");Files.createSymbolicLink(bin.toPath(),Paths.get("/usr/bin"));
   check(RuntimeComponents.guestFile(guestRoot,"sbin/libreoffice")!=null,"absolute directory and executable symlinks can be chained");
   check(RuntimeComponents.guestFile(guestRoot,"../../outside-office")==null,"explicit root traversal rejected");
   RuntimeComponents.record(c,"development","installing","test interruption");check(RuntimeComponents.status(c).getJSONArray("components").getJSONObject(1).getString("state").equals("interrupted"),"interruption visible after worker stopped");
   check(RuntimeBootstrap.status(c).optBoolean("ready"),"optional interruption never blocks core");
   Files.delete(new File(RuntimeComponents.base(c),"core.json").toPath());touch(new File(RuntimeComponents.base(c),"ready.json"));check(RuntimeBootstrap.status(c).optBoolean("ready"),"legacy full readiness accepted");
   check(!RuntimeComponents.installed(c,"analysis"),"legacy marker cannot invent missing REA");
   check(RuntimeComponentTools.spec().getString("name").equals("eva_components"),"on-demand tool registered");
   check(!RuntimeComponents.valid("../core"),"unknown/path component rejected");
   result.putString("stream","PASS modular setup "+checks+" checks\n");
  }catch(Throwable error){result.putString("stream","FAIL modular setup "+error+"\n");}
  finally{for(String name:new String[]{"eva-runtime-bootstrap","eva-runtime-components"})getTargetContext().deleteSharedPreferences(prefix+name);try{if(scratch.getCanonicalFile().getParentFile().equals(getTargetContext().getCacheDir().getCanonicalFile()))Files.walkFileTree(scratch.toPath(),new SimpleFileVisitor<Path>(){public FileVisitResult visitFile(Path f,java.nio.file.attribute.BasicFileAttributes a)throws IOException{Files.delete(f);return FileVisitResult.CONTINUE;}public FileVisitResult postVisitDirectory(Path d,IOException e)throws IOException{Files.delete(d);return FileVisitResult.CONTINUE;}});}catch(Exception error){result.putString("cleanupError",error.toString());}}
  finish(result.getString("stream","").startsWith("PASS")?-1:0,result);
 }
}
