package ai.eva.android.probe;
import org.json.*;
import java.util.concurrent.*;

/** A missing capability returns to the same tool call after explicit user consent. */
final class RuntimeComponentTools {
 static final ExecutorService worker=Executors.newCachedThreadPool();
 static JSONObject spec()throws Exception{
  return new JSONObject().put("name","eva_components").put("description","Phone-local optional capabilities. status lists installed components. ensure opens Eva's install confirmation and waits; after ready=true continue the original task. Never install missing optional dependencies via shell to bypass user consent. analysis installs REA only; request ghidra separately only for native decompilation.")
   .put("inputSchema",new JSONObject().put("type","object").put("properties",new JSONObject().put("action",new JSONObject().put("type","string").put("enum",new JSONArray(new String[]{"status","ensure"}))).put("component",new JSONObject().put("type","string").put("enum",new JSONArray(RuntimeComponents.IDS)))).put("required",new JSONArray(new String[]{"action"})).put("additionalProperties",false));
 }
 static boolean handle(KernelHost host,JSONObject row){
  JSONObject params=row.optJSONObject("params");if(!row.optString("method").equals("item/tool/call")||params==null||!params.optString("tool").equals("eva_components"))return false;
  worker.execute(()->{JSONObject response=new JSONObject();try{
   KernelHost.guardTurn(params);JSONObject args=params.getJSONObject("arguments"),value;
   if(args.getString("action").equals("status"))value=RuntimeComponents.status(host.context);
   else if(args.getString("action").equals("ensure"))value=RuntimeComponents.ensureForTask(host.context,args.getString("component"),params);
   else throw new java.io.IOException("未知组件操作");
   response.put("success",true).put("contentItems",new JSONArray().put(new JSONObject().put("type","inputText").put("text",value.toString())));
  }catch(Exception error){try{response.put("success",false).put("contentItems",new JSONArray().put(new JSONObject().put("type","inputText").put("text",String.valueOf(error.getMessage()))));}catch(Exception ignored){}}
   try{host.write(new JSONObject().put("id",row.get("id")).put("result",response));}catch(Exception ignored){}
  });return true;
 }
}
