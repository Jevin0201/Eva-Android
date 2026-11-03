package ai.eva.android.probe;
import android.app.Instrumentation;
import android.os.Bundle;
import org.json.JSONObject;

/** Regression: sending text must not acquire or conflict with phone ownership. */
public class PhoneOwnershipCheck extends Instrumentation {
 public void onCreate(Bundle args){super.onCreate(args);start();}
 public void onStart(){Bundle result=new Bundle();int code=0;boolean armed=PhoneAccessibility.armed;
  try{
   PhoneAccessibility.armed=true;
   PhoneTools.bind("owner-a");PhoneTools.turn="turn-a";
   KernelHost.get(getTargetContext()).params("turn/start",new JSONObject().put("threadId","chat-b"));
   if(!PhoneTools.owner.equals("owner-a"))throw new Exception("text send changed owner");
   boolean blocked=false;try{PhoneTools.bind("owner-b");}catch(java.io.IOException expected){blocked=true;}
   if(!blocked)throw new Exception("concurrent phone owner accepted");
   PhoneTools.release("other");if(!PhoneTools.owner.equals("owner-a"))throw new Exception("unrelated completion released owner");
   PhoneTools.release("owner-a");PhoneTools.bind("owner-b");
   PhoneTools.release(null);if(!PhoneTools.owner.isEmpty()||!PhoneTools.turn.isEmpty())throw new Exception("exit leaked owner");
   PhoneAccessibility.armed=false;blocked=false;try{PhoneTools.bind("owner-c");}catch(java.io.IOException expected){blocked=true;}
   if(!blocked)throw new Exception("disabled phone accepted");
   result.putString("result","PASS text send independent of phone owner; exclusive tool control; matching completion and kernel exit release; stopped control denied");
  }catch(Exception e){code=1;result.putString("error",e.toString());}
  finally{PhoneTools.release(null);PhoneAccessibility.armed=armed;}
  finish(code,result);
 }
}
