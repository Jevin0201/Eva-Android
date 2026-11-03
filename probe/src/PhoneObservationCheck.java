package ai.eva.android.probe;
import android.app.*;import android.content.*;import android.os.*;import org.json.*;
/** Uses only Eva's fixture; never reads another app or repeats a stale click. */
public class PhoneObservationCheck extends Instrumentation {
 public void onCreate(Bundle b){super.onCreate(b);start();}
 String find(JSONObject o,String key,String value)throws Exception{return PhoneSelfCheck.find(o,key,value);}
 public void onStart(){Bundle result=new Bundle();int code=0;Activity fixture=null;
  try{PhoneTaskService.restore(getTargetContext());for(int n=0;n<60&&PhoneAccessibility.live==null;n++)Thread.sleep(100);if(PhoneAccessibility.live==null||!PhoneAccessibility.armed)throw new Exception("Phone control must already be enabled");
   fixture=startActivitySync(new Intent(getTargetContext(),PhoneFixtureActivity.class).putExtra("manual-check",true).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));Thread.sleep(350);long epoch=PhoneAccessibility.generation;
   JSONObject old=PhoneTools.execute(getTargetContext(),new JSONObject().put("action","observe"));if(!getTargetContext().getPackageName().equals(old.optString("package")))throw new Exception("Fixture not foreground");
   JSONObject input=PhoneTools.executeObserved(getTargetContext(),new JSONObject().put("action","input").put("snapshot",old.getString("snapshot")).put("node",find(old,"description","fixture-input")).put("text","observation-check"),epoch);
   find(input,"text","observation-check");if(old.getString("snapshot").equals(input.getString("snapshot")))throw new Exception("No fresh post-action snapshot");
   JSONObject stale=PhoneTools.executeObserved(getTargetContext(),new JSONObject().put("action","click").put("snapshot",old.getString("snapshot")).put("node",find(old,"text","fixture-click")),epoch);
   if(!stale.has("actionError")||stale.optBoolean("dispatched")||stale.optBoolean("actionExecuted",true))throw new Exception("Stale action was not rejected");find(stale,"text","EVA_PHONE_FIXTURE");
   JSONObject click=PhoneTools.executeObserved(getTargetContext(),new JSONObject().put("action","click").put("snapshot",stale.getString("snapshot")).put("node",find(stale,"text","fixture-click")),epoch);find(click,"text","fixture-clicked");
   result.putString("result","PASS post-input/post-click observations; stale action not executed and fresh snapshot returned; inputMs="+input.optLong("elapsedMs")+" clickMs="+click.optLong("elapsedMs")+" staleRecoveryMs="+stale.optLong("elapsedMs"));
  }catch(Exception e){code=1;result.putString("error",e.toString());}finally{if(fixture!=null){final Activity f=fixture;runOnMainSync(f::finish);}}finish(code,result);
 }
}
