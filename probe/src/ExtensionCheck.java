package ai.eva.android.probe;
import android.content.*;import org.json.*;
/** Own disabled connection only; no real secret or external request. */
final class ExtensionCheck {
 static void run(Context context){new Thread(()->{JSONObject result=new JSONObject();String name="eva_credentials_acceptance",token="EVA_NON_SECRET_TEST_3861";KernelHost host=KernelHost.get(context);boolean created=false;
  try{host.ensureStarted();JSONObject read=host.rpc("config/read",new JSONObject().put("includeLayers",false));JSONObject servers=read.getJSONObject("config").optJSONObject("mcp_servers");if(servers!=null&&servers.has(name))throw new Exception("Test connection already exists");host.rpc("config/value/write",new JSONObject().put("keyPath","mcp_servers."+name).put("value",new JSONObject().put("url","https://127.0.0.1:9/mcp").put("enabled",false)).put("mergeStrategy","replace"));created=true;
   McpSettings.credential(host,name,token);
   read=host.rpc("config/read",new JSONObject().put("includeLayers",false));String stored=read.getJSONObject("config").getJSONObject("mcp_servers").getJSONObject(name).getJSONObject("http_headers").getString("Authorization");if(!stored.equals("Bearer "+token))throw new Exception("Native credential roundtrip failed");
   if(!host.redact(token).equals("[REDACTED]"))throw new Exception("Credential redaction failed");
   if(McpSettings.call(host,new JSONObject().put("action","list")).toString().contains(token))throw new Exception("Credential leaked to UI result");
   McpSettings.call(host,new JSONObject().put("action","toggle").put("name",name).put("enabled",false));read=host.rpc("config/read",new JSONObject().put("includeLayers",false));if(!read.getJSONObject("config").getJSONObject("mcp_servers").getJSONObject(name).getJSONObject("http_headers").getString("Authorization").equals("Bearer "+token))throw new Exception("Credential damaged by config edit");
   McpSettings.credential(host,name,"");read=host.rpc("config/read",new JSONObject().put("includeLayers",false));if(read.getJSONObject("config").getJSONObject("mcp_servers").getJSONObject(name).getJSONObject("http_headers").has("Authorization"))throw new Exception("Credential clear failed");result.put("credentialStorage","PASS").put("redaction","PASS").put("uiNoSecret","PASS").put("clear","PASS");
  }catch(Exception error){try{result.put("error",error.getMessage());}catch(Exception ignored){}}
  finally{if(created)try{McpSettings.call(host,new JSONObject().put("action","remove").put("name",name));result.put("cleanup","PASS");}catch(Exception e){try{result.put("cleanup","FAIL");}catch(Exception ignored){}}context.getSharedPreferences("eva-extension-check",0).edit().putString("credentials",result.toString()).commit();}
 }).start();}
}
