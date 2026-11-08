package ai.eva.android.probe;
import org.json.*;
/** DSH-only health ledger, independent of user visibility and model selection. */
final class DshAvailability {
 static final String URL="http://127.0.0.1:18900/v1";
 static final long REFRESH_MS=15*60*1000L,VALID_MS=30*60*1000L;
 static boolean managed(JSONObject p){return URL.equals(p.optString("url"));}
 static boolean available(JSONObject provider,String id,long now){JSONObject all=provider.optJSONObject("modelAvailability"),row=all==null?null:all.optJSONObject(id);return row!=null&&"available".equals(row.optString("state"))&&row.optLong("checkedAt")<=now&&now-row.optLong("checkedAt")<VALID_MS;}
 static JSONArray visible(JSONObject p,JSONArray rows,long now)throws Exception{JSONArray result=new JSONArray();for(int n=0;rows!=null&&n<rows.length();n++){JSONObject row=rows.getJSONObject(n);if(available(p,row.optString("id"),now))result.put(row);}return result;}
 static void decorate(JSONObject p,long now)throws Exception{if(!managed(p))return;p.put("name","DSH插件").put("managedBy","dsh").put("availabilityRefreshMinutes",15);p.remove("description");JSONArray all=p.optJSONArray("models");p.put("catalogCount",all==null?0:all.length());p.put("models",visible(p,all,now));p.put("manualModels",visible(p,p.optJSONArray("manualModels"),now));}
}
