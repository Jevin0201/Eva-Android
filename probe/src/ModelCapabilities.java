package ai.eva.android.probe;
import org.json.*;import java.net.URI;
/** Shared UI capability metadata; never invent capabilities for unrelated providers. */
final class ModelCapabilities {
 static void enrich(JSONObject provider,JSONArray manifests)throws Exception{
  if(!"api.deepseek.com".equals(new URI(provider.optString("url")).getHost())||!"responses".equals(provider.optString("protocol","responses")))return;
  JSONArray rows=provider.optJSONArray("models");if(rows==null)rows=new JSONArray();
  String selected=provider.optString("model");
  for(int i=0;i<manifests.length();i++){JSONObject spec=manifests.getJSONObject(i);String id=spec.getString("slug");JSONObject row=null;for(int n=0;n<rows.length();n++)if(id.equals(rows.getJSONObject(n).optString("id")))row=rows.getJSONObject(n);
   if(row==null&&id.equals(selected)){row=new JSONObject().put("id",id).put("name",id);rows.put(row);}if(row==null||row.has("reasoningEfforts"))continue;
   JSONArray levels=spec.optJSONArray("supported_reasoning_levels"),efforts=new JSONArray();for(int n=0;levels!=null&&n<levels.length();n++)efforts.put(levels.getJSONObject(n).getString("effort"));row.put("reasoningEfforts",efforts).put("defaultReasoningEffort",spec.optString("default_reasoning_level"));
  }provider.put("models",rows);
 }
 static JSONArray retain(JSONArray previous,JSONArray next)throws Exception{
  for(int i=0;i<next.length();i++){JSONObject row=next.getJSONObject(i);for(int n=0;previous!=null&&n<previous.length();n++){JSONObject old=previous.getJSONObject(n);if(!row.optString("id").equals(old.optString("id")))continue;
    if(!row.has("reasoningEfforts")&&old.has("reasoningEfforts")){row.put("reasoningEfforts",old.get("reasoningEfforts"));if(old.has("defaultReasoningEffort"))row.put("defaultReasoningEffort",old.get("defaultReasoningEffort"));}
    for(String key:new String[]{"supportsVision","supportsTools"})if(!row.has(key)&&old.has(key))row.put(key,old.get(key));break;
  }}return next;
 }
}
