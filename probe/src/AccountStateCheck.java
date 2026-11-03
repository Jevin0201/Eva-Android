package ai.eva.android.probe;
import android.app.Instrumentation;import android.os.Bundle;import android.content.SharedPreferences;import org.json.*;
/** Isolated state tests: never touches the user's account or tokens. */
public class AccountStateCheck extends Instrumentation {
 public void onCreate(Bundle b){super.onCreate(b);start();}
 void expect(boolean ok,String message)throws Exception{if(!ok)throw new Exception(message);}
 public void onStart(){Bundle out=new Bundle();int code=0;SharedPreferences p=getTargetContext().getSharedPreferences("eva-account-test",0);p.edit().clear().commit();try{
  AccountState.apply(p,"account/login/completed",new JSONObject().put("success",true),false);expect(p.getBoolean("loggedIn",false),"login event not stored");
  AccountState.apply(p,"account/updated",new JSONObject().put("authMode",JSONObject.NULL),true);expect(p.getBoolean("loggedIn",false),"API runtime cleared account");
  AccountState.apply(p,"account/read",new JSONObject().put("account",JSONObject.NULL).put("requiresOpenaiAuth",false),false);expect(p.getBoolean("loggedIn",false),"no-auth provider cleared account");
  AccountState.apply(p,"account/read",new JSONObject().put("error","timeout"),false);AccountState.apply(p,"account/login/completed",new JSONObject().put("success",false),false);expect(p.getBoolean("loggedIn",false),"failed request cleared account");
  AccountState.apply(p,"account/updated",new JSONObject().put("authMode",JSONObject.NULL),false);expect(!p.getBoolean("loggedIn",true),"real logout ignored");
  AccountState.apply(p,"account/read",new JSONObject().put("account",new JSONObject().put("type","chatgpt")),false);expect(p.getBoolean("loggedIn",false),"read result not synchronized");
  p.edit().putBoolean("preferred",true).commit();AccountState.apply(p,"account/logout",new JSONObject(),false);expect(!p.getBoolean("loggedIn",true)&&!p.getBoolean("preferred",true),"explicit logout not cleared");
  out.putString("result","PASS ordered login/read/logout state; API runtime isolation; errors preserve login; explicit logout clears preference; user credentials untouched");
 }catch(Exception e){code=1;out.putString("error",e.toString());}finally{p.edit().clear().commit();}finish(code,out);}
}
