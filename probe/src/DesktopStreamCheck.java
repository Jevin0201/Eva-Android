package ai.eva.android.probe;

import android.app.Activity;
import android.app.Instrumentation;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.os.SystemClock;
import java.util.UUID;
import org.json.JSONObject;

/** Isolated packaged-renderer exercise. It never opens the production UI store or kernel. */
public final class DesktopStreamCheck extends Instrumentation {
 private boolean storageBenchmark;
 @Override public void onCreate(Bundle arguments) { super.onCreate(arguments); storageBenchmark=arguments!=null&&"true".equals(String.valueOf(arguments.get("storageBenchmark")));start(); }
 @Override public void onStart() {
  Bundle output = new Bundle();
  Activity fixture = null;
  try {
   String runId = UUID.randomUUID().toString();
   SharedPreferences result = getTargetContext().getSharedPreferences("eva-stream-check", 0);
   if (!result.edit().clear().putString("runId", runId).commit()) throw new IllegalStateException("Cannot initialize fixture report");
   JSONObject storageReport=storageBenchmark?measureStorage():null;
   Intent launch = new Intent(getTargetContext(), DesktopStreamFixtureActivity.class);
   launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK).putExtra("runId", runId).putExtra("storageBenchmark",storageBenchmark);
   fixture = startActivitySync(launch);
   long deadline = SystemClock.elapsedRealtime() + 120000;
   String raw = null;
   while (SystemClock.elapsedRealtime() < deadline) {
    raw = result.getString("result", null);
    if (raw != null) break;
    SystemClock.sleep(250);
   }
   if (raw == null) throw new IllegalStateException("Packaged WebView fixture timed out");
   JSONObject report = new JSONObject(raw);
   if(storageReport!=null){report.put("storageReport",storageReport);if(!storageReport.getBoolean("passed"))report.put("passed",false);}
   output.putString("result", report.toString());
   finish(report.optBoolean("passed") ? Activity.RESULT_OK : Activity.RESULT_CANCELED, output);
  } catch (Exception error) {
   output.putString("error", error.toString());
   finish(Activity.RESULT_CANCELED, output);
  } finally {
   final Activity current = fixture;
   if (current != null) runOnMainSync(() -> { if (!current.isFinishing()) current.finish(); });
  }
 }
 private JSONObject measureStorage()throws Exception{
  java.io.File folder=new java.io.File(getTargetContext().getCacheDir(),"storage-performance-"+UUID.randomUUID());
  if(!folder.mkdirs())throw new IllegalStateException("Cannot create isolated storage fixture");
  android.content.Context context=new android.content.ContextWrapper(getTargetContext()){
   @Override public java.io.File getFilesDir(){return folder;}
  };
  try{
   char[] large=new char[18*1024*1024];java.util.Arrays.fill(large,'x');
   JSONObject conversation=new JSONObject().put("id","active").put("draft","draft");
   JSONObject history=new JSONObject().put("id","inactive").put("text",new String(large));
   org.json.JSONArray chats=new org.json.JSONArray().put(conversation).put(history);
   JSONObject state=new JSONObject().put("chats",chats).put("drafts",new org.json.JSONArray()).put("active","active");
   String full=state.toString();UiStateStore.save(context,full);
   JSONObject index=new JSONObject().put("chats",new org.json.JSONArray().put(new JSONObject().put("id","active")).put(new JSONObject().put("id","inactive")))
    .put("drafts",new org.json.JSONArray()).put("active","active");
   conversation.put("draft","saved after partial checkpoint");
   String partial=new JSONObject().put("state",index).put("conversation",conversation).put("group","chats").toString();
   long[] fullTimes=new long[3],partialTimes=new long[3];
   for(int i=0;i<3;i++){
    long start=SystemClock.elapsedRealtime();UiStateStore.save(context,full);fullTimes[i]=SystemClock.elapsedRealtime()-start;
    start=SystemClock.elapsedRealtime();if(!UiStateStore.checkpoint(context,partial))throw new IllegalStateException("Partial checkpoint unexpectedly needs full state");partialTimes[i]=SystemClock.elapsedRealtime()-start;
   }
   JSONObject restored=new JSONObject(UiStateStore.load(context));
   boolean preserved=restored.getJSONArray("chats").getJSONObject(1).getString("text").length()==large.length
    &&restored.getJSONArray("chats").getJSONObject(0).getString("draft").equals(conversation.getString("draft"));
   java.util.Arrays.sort(fullTimes);java.util.Arrays.sort(partialTimes);
   return new JSONObject().put("passed",preserved&&partialTimes[1]<fullTimes[1]).put("fullMedianMs",fullTimes[1])
    .put("conversationMedianMs",partialTimes[1]).put("inactiveHistoryPreserved",preserved).put("historyCharacters",large.length);
  }finally{
   for(String name:new String[]{"ui-state.sqlite","ui-state.sqlite-journal"}){
    java.io.File file=new java.io.File(folder,name);if(file.exists()&&!file.delete())throw new IllegalStateException("Storage fixture cleanup failed");
   }
   if(!folder.delete())throw new IllegalStateException("Storage fixture directory cleanup failed");
  }
 }
}
