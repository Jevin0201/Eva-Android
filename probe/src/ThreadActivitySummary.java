package ai.eva.android.probe;
import java.io.IOException;import org.json.*;
/** Read-only bounded metadata; large tool/image bodies never cross the WebView bridge. */
final class ThreadActivitySummary {
 interface Rpc {JSONObject call(String method,JSONObject params)throws Exception;}
 static JSONObject read(JSONObject request,Rpc rpc)throws Exception{
  String thread=request.getString("threadId");JSONArray turns=request.getJSONArray("turnIds");
  if(!thread.matches(ProviderHistoryProjection.UUID)||turns.length()>5)throw new IOException("历史摘要参数无效");
  JSONArray data=new JSONArray();
  for(int n=0;n<turns.length();n++){
   String id=turns.getString(n);if(!id.matches(ProviderHistoryProjection.UUID))throw new IOException("回合编号无效");
   Boolean activity=null;String kind="",cursor=null;
   for(int page=0;page<8&&activity==null;page++){
    JSONObject params=new JSONObject().put("threadId",thread).put("turnId",id).put("sortDirection","desc").put("limit",2);if(cursor!=null)params.put("cursor",cursor);
    JSONObject result=rpc.call("thread/items/list",params);JSONArray items=result.getJSONArray("data");
    for(int j=0;j<items.length();j++){
     JSONObject entry=items.getJSONObject(j);if(!id.equals(entry.getString("turnId")))throw new IOException("历史回合不匹配");JSONObject item=entry.getJSONObject("item");String type=item.getString("type");
     if(type.equals("userMessage")){activity=false;break;}
     if(type.equals("agentMessage")){if(item.optString("phase").equals("commentary")&&!item.optString("text").trim().isEmpty()){activity=true;kind=type;break;}continue;}
     if(type.equals("reasoning")){JSONArray summary=item.optJSONArray("summary");boolean visible=false;if(summary!=null)for(int k=0;k<summary.length();k++){Object part=summary.get(k);String text=part instanceof JSONObject?((JSONObject)part).optString("text"):part instanceof String?(String)part:"";if(!text.trim().isEmpty()){visible=true;break;}}if(!visible)continue;}
     activity=true;kind=type;break;
    }
    cursor=result.isNull("nextCursor")?null:result.optString("nextCursor",null);if(activity==null&&(cursor==null||cursor.isEmpty()))activity=false;
   }
   data.put(new JSONObject().put("turnId",id).put("hasActivity",activity==null?JSONObject.NULL:activity).put("lastActivityType",kind));
  }
  return new JSONObject().put("data",data);
 }
}
