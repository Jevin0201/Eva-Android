package ai.eva.android.probe;
import android.app.Instrumentation;import android.os.Bundle;import org.json.*;import java.io.IOException;import java.util.*;
/** Tests the real host dispatch boundary with a fixture transport; never loads credentials. */
public final class ProviderSwitchCheck extends Instrumentation {
 public void onCreate(Bundle b){super.onCreate(b);start();}
 final class Fixture implements ProviderSwitch.Request {String mode="conflict";final List<String> calls=new ArrayList<>();
  public JSONObject request(String method,JSONObject params)throws Exception{calls.add(method);if(method.equals("thread/resume")||method.equals("turn/start")){if(mode.equals("network"))throw new IOException("network unavailable");if(!mode.equals("same"))throw new IOException("This chat uses openai, but your current provider is fixture. Switch to openai to continue.");}
   return new JSONObject().put("modelProvider",mode.equals("invalid")?"openai":"fixture").put("model","fixture-model").put("thread",new JSONObject().put("id",method.equals("thread/fork")?"forked":"original").put("turns",new JSONArray().put(new JSONObject().put("id","history").put("status","completed"))));}
 }
 static void check(boolean value,String message)throws Exception{if(!value)throw new Exception(message);}
 public void onStart(){Bundle out=new Bundle();int code=0;try{JSONObject request=new JSONObject().put("threadId","original").put("modelProvider","fixture").put("model","fixture-model");Fixture f=new Fixture();JSONObject result=ProviderSwitch.execute("thread/resume",request,"fixture",f);check(f.calls.equals(Arrays.asList("thread/resume","thread/fork")),"expected one resume and one fork");check(result.getString("androidPreviousThreadId").equals("original")&&result.getJSONObject("thread").getString("id").equals("forked"),"lineage");check(request.getString("threadId").equals("original"),"source request unchanged");
 f=new Fixture();f.mode="same";ProviderSwitch.execute("thread/resume",request,"fixture",f);check(f.calls.size()==1,"same provider must not fork");
 for(String mode:new String[]{"network","invalid"}){f=new Fixture();f.mode=mode;boolean failed=false;try{ProviderSwitch.execute("thread/resume",request,"fixture",f);}catch(IOException expected){failed=true;}check(failed,"failure must remain visible");check(f.calls.size()==(mode.equals("network")?1:2),"no arbitrary retry");}
 f=new Fixture();boolean rejected=false;try{ProviderSwitch.execute("turn/start",request,"fixture",f);}catch(IOException expected){rejected=true;}check(rejected&&f.calls.size()==1,"never retry task submission");out.putString("result","PASS provider mismatch forks once, validates provider/model, preserves lineage; same-provider/network/task paths never duplicate submission");}catch(Exception e){code=1;out.putString("error",e.toString());}finish(code,out);}
}
