package ai.eva.android.probe;

import android.app.Instrumentation;
import android.os.Bundle;
import android.os.SystemClock;
import android.graphics.Bitmap;
import org.json.JSONObject;

/** Isolated real-device coverage of the same phone tool entry points used by the model. */
public final class PhoneAgentDisplayCheck extends Instrumentation {
 public void onCreate(Bundle args) { super.onCreate(args); start(); }
 public void onStart() {
  Bundle result = new Bundle();
  boolean armed = PhoneAccessibility.armed;
  boolean desired = PhoneAgentDisplay.desired(getTargetContext());
  try {
   PhoneAccessibility.armed = true;
   String enabled=android.provider.Settings.Secure.getString(getTargetContext().getContentResolver(),"enabled_accessibility_services");
   if(PhoneAccessibility.live==null && enabled!=null && enabled.contains("ai.eva.android.probe")) PhoneShell.execute(getTargetContext(),PhoneShellService.restoreCommand(),PhoneAccessibility.generation);
   long deadline = SystemClock.elapsedRealtime() + 8000;
   while (PhoneAccessibility.live == null && SystemClock.elapsedRealtime() < deadline) Thread.sleep(100);
   PhoneAccessibility.armed = true;
   PhoneAgentDisplay.setEnabled(getTargetContext(),true);
   if(!PhoneAgentDisplay.desired(getTargetContext()))throw new Exception("background choice not persisted");
   PhoneAgentDisplay.start(getTargetContext());
   int id = PhoneAgentDisplay.displayId();
   if (id <= 0) throw new Exception("no background display");
   android.content.Intent intent = new android.content.Intent(getTargetContext(), PhoneFixtureActivity.class).putExtra("manual-check", true).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
   android.app.ActivityOptions options = android.app.ActivityOptions.makeBasic();
   options.setLaunchDisplayId(id);
   getTargetContext().startActivity(intent, options.toBundle());
   JSONObject screen = null;
   deadline = SystemClock.elapsedRealtime() + 6000;
   while (SystemClock.elapsedRealtime() < deadline) {
    screen = PhoneTools.execute(getTargetContext(), new JSONObject().put("action", "observe"));
    if (screen.toString().contains("fixture-click")) break;
    Thread.sleep(200);
   }
   if (screen == null || screen.optInt("displayId") != id || !screen.toString().contains("fixture-click")) throw new Exception("background observation missing: " + screen);
   String target = "";
   for (int i = 0; i < screen.getJSONArray("nodes").length(); i++) {
    JSONObject node = screen.getJSONArray("nodes").getJSONObject(i);
    if (node.optString("text").equals("fixture-click")) target = node.getString("id");
   }
   JSONObject clicked = PhoneTools.executeObserved(getTargetContext(), new JSONObject().put("action", "click").put("snapshot", screen.getString("snapshot")).put("node", target), PhoneAccessibility.generation);
   if (!clicked.toString().contains("fixture-clicked")) throw new Exception("background click failed: " + clicked);
   screen=PhoneTools.execute(getTargetContext(),new JSONObject().put("action","observe"));
   String input="";
   for(int i=0;i<screen.getJSONArray("nodes").length();i++){JSONObject node=screen.getJSONArray("nodes").getJSONObject(i);if(node.optBoolean("editable"))input=node.getString("id");}
   JSONObject typed=PhoneTools.executeObserved(getTargetContext(),new JSONObject().put("action","input").put("snapshot",screen.getString("snapshot")).put("node",input).put("text","后台输入验证"),PhoneAccessibility.generation);
   if(!typed.toString().contains("后台输入验证"))throw new Exception("background text input failed");
   JSONObject shot=PhoneTools.execute(getTargetContext(),new JSONObject().put("action","screenshot"));
   if(!shot.has("imageUrl")||shot.optInt("displayId")!=id)throw new Exception("background tool screenshot missing");
   JSONObject request=new JSONObject().put("threadId","display-check").put("turnId","display-check-turn");
   JSONObject steps=new JSONObject().put("steps",new org.json.JSONArray().put(new JSONObject().put("action","input").put("target",new JSONObject().put("description","fixture-input")).put("text","批处理输入").put("expect","批处理输入")).put(new JSONObject().put("action","click").put("target",new JSONObject().put("text","fixture-click")).put("expect","fixture-clicked")));
   JSONObject batch=PhoneBatch.execute(getTargetContext(),steps,request,PhoneAccessibility.generation,PhoneBatch.revision("display-check"));
   if(!batch.optBoolean("completed"))throw new Exception("real background batch failed: "+batch);
   screen=PhoneTools.execute(getTargetContext(),new JSONObject().put("action","observe"));
   for(int i=0;i<screen.getJSONArray("nodes").length();i++){JSONObject node=screen.getJSONArray("nodes").getJSONObject(i);if(node.optString("text").equals("fixture-click")){org.json.JSONArray bounds=node.getJSONArray("bounds");JSONObject gesture=PhoneTools.executeObserved(getTargetContext(),new JSONObject().put("action","gesture").put("snapshot",screen.getString("snapshot")).put("x",(bounds.getInt(0)+bounds.getInt(2))/2).put("y",(bounds.getInt(1)+bounds.getInt(3))/2),PhoneAccessibility.generation);if(!gesture.optBoolean("dispatched"))throw new Exception("background gesture failed");break;}}
   Bitmap bitmap = PhoneAgentDisplay.active.bitmap();
   if (bitmap.getWidth() != 1080) throw new Exception("invalid frame size");
   bitmap.recycle();
   PhoneAgentDisplay previous=PhoneAgentDisplay.active;
   PhoneAgentDisplay.stop();
   if(!PhoneAgentDisplay.desired(getTargetContext()))throw new Exception("runtime suspension cleared persisted choice");
   PhoneTools.owner="display-recovery-busy";
   PhoneAgentDisplay.restore(getTargetContext());
   Thread.sleep(100);
   if(PhoneAgentDisplay.active!=null)throw new Exception("restoration switched screen during active task");
   PhoneTools.owner="";
   PhoneAgentDisplay.start(getTargetContext());
   if(PhoneAgentDisplay.active==null||PhoneAgentDisplay.active==previous)throw new Exception("runtime not rebuilt after suspension");
   PhoneAgentDisplay.disable(getTargetContext());
   if(PhoneAgentDisplay.desired(getTargetContext())||PhoneAgentDisplay.active!=null)throw new Exception("explicit disable not reflected immediately");
   PhoneAgentDisplay.restore(getTargetContext());
   Thread.sleep(100);
   if(PhoneAgentDisplay.active!=null)throw new Exception("disabled background screen resurrected");
   result.putString("result", "PASS background display create, launch, observe, node click, Unicode input, tool screenshot, real batch, gesture, fresh frame, persisted choice, suspension, busy-task recovery guard, rebuild, explicit disable");
  } catch (Throwable error) { result.putString("result", "FAIL " + error); }
  finally { PhoneTools.owner="";PhoneAgentDisplay.stop();getTargetContext().getSharedPreferences("eva-phone",0).edit().putBoolean("backgroundDisplayEnabled",desired).commit();PhoneAccessibility.armed = armed;PhoneAgentDisplay.restore(getTargetContext()); }
  finish(result.getString("result", "").startsWith("PASS") ? -1 : 0, result);
 }
}
