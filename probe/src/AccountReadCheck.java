package ai.eva.android.probe;
import android.app.Instrumentation;import android.os.Bundle;import org.json.*;
/** Read-only check of the installed account. Never starts/cancels login or prints identity/tokens. */
public class AccountReadCheck extends Instrumentation {
 public void onCreate(Bundle b){super.onCreate(b);start();}
 public void onStart(){Bundle out=new Bundle();int code=0;try{
  KernelHost host=KernelHost.get(getTargetContext());long start=System.currentTimeMillis();
  JSONObject result=host.nativeRequest("account/read",new JSONObject().put("refreshToken",false));
  JSONObject account=result.optJSONObject("account");boolean signed=account!=null&&"chatgpt".equals(account.optString("type"));
  boolean cached=getTargetContext().getSharedPreferences("eva-account",0).getBoolean("loggedIn",false);
  if(signed!=cached)throw new Exception("Account cache differs from native account result");
  out.putString("result","PASS native account read and cache agree; signedIn="+signed+"; elapsedMs="+(System.currentTimeMillis()-start));
 }catch(Exception e){code=1;out.putString("error",e.getClass().getSimpleName()+": account check did not complete");}finish(code,out);}
}
