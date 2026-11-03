package ai.eva.android.probe;
import org.json.*;import java.io.IOException;
/** Preserve provider-bound rollouts by forking only an explicitly rejected resume. */
final class ProviderSwitch {
 interface Request {JSONObject request(String method,JSONObject params)throws Exception;}
 static boolean providerConflict(String method,IOException error){String text=error.getMessage();return "thread/resume".equals(method)&&text!=null&&text.startsWith("This chat uses ")&&text.contains(", but your current provider is ")&&text.contains("Switch to ");}
 static JSONObject forkProvider(JSONObject prepared,String provider,Request transport)throws Exception{String previous=prepared.getString("threadId");JSONObject result=transport.request("thread/fork",new JSONObject(prepared.toString()).put("persistExtendedHistory",true));JSONObject thread=result.optJSONObject("thread");if(thread==null||thread.optString("id").isEmpty()||previous.equals(thread.optString("id"))||!provider.equals(result.optString("modelProvider"))||!prepared.optString("model").equals(result.optString("model")))throw new IOException("模型切换未获内核确认，原对话已保留；没有发送任务");result.put("androidPreviousThreadId",previous);return result;}
 static JSONObject execute(String method,JSONObject prepared,String provider,Request transport)throws Exception{JSONObject result;try{result=transport.request(method,prepared);}catch(IOException error){if(!providerConflict(method,error))throw error;result=forkProvider(prepared,provider,transport);}if(method.equals("thread/resume")&&!provider.equals(result.optString("modelProvider",provider)))result=forkProvider(prepared,provider,transport);return result;}
}
