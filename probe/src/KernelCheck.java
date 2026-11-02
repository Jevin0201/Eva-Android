package ai.eva.android.probe;
import android.app.*;import android.os.*;import org.json.*;
public class KernelCheck extends Instrumentation{
 public void onCreate(Bundle b){super.onCreate(b);start();}
 JSONObject waitFor(KernelHost host,String ticket)throws Exception{long until=System.currentTimeMillis()+60000;while(System.currentTimeMillis()<until){JSONArray events=new JSONArray(host.drain());for(int i=0;i<events.length();i++){JSONObject e=events.getJSONObject(i);if(ticket.equals(e.optString("ticket"))){if(e.has("error"))throw new Exception(e.getString("error"));return e.getJSONObject("result");}}Thread.sleep(100);}throw new Exception("timeout");}
 public void onStart(){Bundle out=new Bundle();int code=0;try{KernelHost host=KernelHost.get(getTargetContext());host.call("account","account/read","{\"refreshToken\":false}");waitFor(host,"account");host.call("thread","thread/start","{\"ephemeral\":true}");JSONObject thread=waitFor(host,"thread").getJSONObject("thread");if(thread.optString("id").isEmpty())throw new Exception("missing thread id");out.putString("result","PASS: Android native KernelHost starts Codex 0.166.0, initialize, account/read, ephemeral thread/start; no model request or credentials used");}catch(Exception e){code=1;out.putString("error",e.toString());}finish(code,out);}
}
