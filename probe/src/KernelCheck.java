package ai.eva.android.probe;
import android.app.*;import android.os.*;import org.json.*;
public class KernelCheck extends Instrumentation{
 public void onCreate(Bundle b){super.onCreate(b);start();}
 JSONObject waitFor(KernelHost host,String ticket)throws Exception{long until=System.currentTimeMillis()+60000;while(System.currentTimeMillis()<until){JSONArray events=new JSONArray(host.drain());for(int i=0;i<events.length();i++){JSONObject e=events.getJSONObject(i);if(ticket.equals(e.optString("ticket"))){if(e.has("error"))throw new Exception(e.getString("error"));return e.getJSONObject("result");}}Thread.sleep(100);}throw new Exception("timeout");}
 public void onStart(){
  Bundle out=new Bundle();int code=0;
  try{
   ModelStore models=new ModelStore(getTargetContext());String provider=models.read().optString("active");
   boolean useApi=!provider.isEmpty()&&!getTargetContext().getSharedPreferences("eva-account",0).getBoolean("preferred",false);
   // Both provider processes publish receipts to the shared UI event queue.
   KernelHost host=KernelHost.get(getTargetContext());
   if(!useApi){host.call("account","account/read","{\"refreshToken\":false}");waitFor(host,"account");}
   JSONObject request=new JSONObject().put("ephemeral",true);
   if(useApi)request.put("modelProvider",provider).put("model",models.provider(provider).getString("model"));
   host.call("thread","thread/start",request.toString());
   JSONObject thread=waitFor(host,"thread").getJSONObject("thread");
   if(thread.optString("id").isEmpty())throw new Exception("missing thread id");
   out.putString("result","PASS: current provider's native KernelHost initialize and ephemeral thread/start; no model turn submitted");
   out.putString("providerMode",useApi?"api":"account");
  }catch(Exception e){code=1;out.putString("error",e.toString());}
  finish(code,out);
 }
}
