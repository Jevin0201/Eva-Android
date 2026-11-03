package ai.eva.android.probe;
import android.content.SharedPreferences;import org.json.*;
/** Non-secret account presence, updated only by the account runtime's ordered messages. */
final class AccountState {
 static boolean apply(SharedPreferences prefs,String method,JSONObject value,boolean apiOnly){
  if(apiOnly||value==null)return false;Boolean signed=null;boolean logout=false;
  if(method.equals("account/read")&&value.has("account")){
   JSONObject account=value.optJSONObject("account");
   if(account!=null)signed="chatgpt".equals(account.optString("type"));
   else if(value.optBoolean("requiresOpenaiAuth",true))signed=false;
  }else if(method.equals("account/updated")&&value.has("authMode"))signed="chatgpt".equals(value.optString("authMode"));
  else if(method.equals("account/login/completed")&&value.optBoolean("success"))signed=true;
  else if(method.equals("account/logout")){signed=false;logout=true;}
  if(signed==null)return false;
  boolean changed=!prefs.contains("loggedIn")||prefs.getBoolean("loggedIn",false)!=signed;
  SharedPreferences.Editor edit=prefs.edit().putBoolean("loggedIn",signed);
  if(logout)edit.putBoolean("preferred",false);
  edit.apply();return changed;
 }
}
