package ai.eva.android.probe;

import android.app.Instrumentation;
import android.content.Intent;
import android.os.Bundle;
import java.io.File;
import java.io.IOException;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;

/** Read-only acceptance of the original-format reader. Never starts conversion. */
public final class WorkspaceFinalPreviewCheck extends Instrumentation {
 private String relative;private int checks;
 private void check(boolean value,String message){if(!value)throw new AssertionError(message);checks++;}
 private void mainChecked(Runnable action){AtomicReference<Throwable> failure=new AtomicReference<>();runOnMainSync(()->{try{action.run();}catch(Throwable error){failure.set(error);}});if(failure.get()!=null)throw new AssertionError(failure.get());}
 public void onCreate(Bundle arguments){super.onCreate(arguments);relative=arguments==null?"":arguments.getString("path","");start();}
 private WorkspacePreviewActivity open(){return (WorkspacePreviewActivity)startActivitySync(new Intent(getTargetContext(),WorkspacePreviewActivity.class).putExtra("path",relative).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));}
 private Map<String,String> artifacts()throws Exception{
  Map<String,String> rows=new TreeMap<>();
  for(File base:new File[]{new File(WorkspaceFiles.root(getTargetContext()),".eva-previews"),new File(getTargetContext().getCacheDir(),"office-layout-v1")}){
   if(!base.isDirectory())continue;
   Files.walkFileTree(base.toPath(),new SimpleFileVisitor<Path>(){public FileVisitResult visitFile(Path path,BasicFileAttributes attrs)throws IOException{
    if(rows.size()>20000)throw new IOException("Too many existing preview artifacts for bounded acceptance");
    rows.put(base.getName()+"/"+base.toPath().relativize(path),attrs.size()+":"+attrs.lastModifiedTime().toMillis());return FileVisitResult.CONTINUE;
   }});
  }
  return rows;
 }
 private void inspect(WorkspacePreviewActivity activity,File original)throws Exception{
  mainChecked(()->{
   check(activity.source.equals(original)&&activity.pageTitle.getText().toString().equals(original.getName()),"source title and export identity remain original");
   check(activity.desktopDocument!=null&&activity.desktopDocument.displayedSource().equals(original),"direct original reader is mounted");
   check(activity.layout==null&&!activity.originalLayout&&activity.pdf==null,"no Office conversion or derivative PDF mode");
   JSONObject info=activity.desktopDocument.sourceInfo();check(info.optBoolean("sourceMatchesHost")&&!info.optBoolean("derivative"),"read-only reader provenance identifies original file");
  });
  check(ExecutionLease.count()==0&&!OfficeRuntime.busy,"no native conversion job or execution lease");
 }
 public void onStart(){Bundle result=new Bundle();WorkspacePreviewActivity first=null,second=null;boolean passed=false;
  try{
   if(relative==null||relative.trim().isEmpty())throw new IOException("Required: -e path workspace-relative-original-file");
   File source=WorkspaceFiles.resolve(getTargetContext(),relative);
   check(source.isFile()&&DesktopDocumentPreview.supports(source),"existing directly supported source required");
   check(ExecutionLease.count()==0&&!OfficeRuntime.busy,"acceptance starts idle");
   String hash=OfficeLayoutPreview.sha256(source);long size=source.length(),modified=source.lastModified();Map<String,String> before=artifacts();
   first=open();waitForIdleSync();inspect(first,source);
   final WorkspacePreviewActivity completed=first;runOnMainSync(completed::finish);waitForIdleSync();first=null;
   second=open();waitForIdleSync();inspect(second,source);
   check(hash.equals(OfficeLayoutPreview.sha256(source))&&size==source.length()&&modified==source.lastModified(),"source bytes and stamp unchanged");
   check(before.equals(artifacts()),"no conversion PDF cache or derivative artifacts generated");
   result.putString("stream","PASS direct original preview "+new JSONObject().put("checks",checks).put("originalFormat",DocumentPreview.ext(source)).put("sourcePreserved",true).put("conversionStarted",false).put("derivativesGenerated",false).put("checkedDirectActivity",true)+"\n");passed=true;
  }catch(Throwable error){result.putString("stream","FAIL direct original preview "+error.getMessage()+"\n");}
  finally{if(!passed){WorkspacePreviewActivity remaining=second!=null?second:first;if(remaining!=null)runOnMainSync(remaining::finish);}}
  finish(passed?-1:0,result);
 }
}
