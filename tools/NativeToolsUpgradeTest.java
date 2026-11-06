package ai.eva.android.probe;

import java.io.*;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.json.*;

public final class NativeToolsUpgradeTest {
 static int checks;
 static void check(boolean value,String message){checks++;if(!value)throw new AssertionError(message);}
 public static void main(String[] args)throws Exception{
  Path base=Paths.get(args[0]);File home=base.resolve("home").toFile(),output=base.resolve("output").toFile();
  String id=UUID.randomUUID().toString();Path directory=home.toPath().resolve("sessions/2026/11/06");Files.createDirectories(directory);
  JSONObject old=new JSONObject().put("name","eva_network").put("description","legacy manual control").put("input_schema",new JSONObject().put("type","object")).put("defer_loading",false);
  JSONObject custom=new JSONObject().put("name","custom_tool").put("description","keep").put("input_schema",new JSONObject());
  JSONObject metadata=new JSONObject().put("type","session_meta").put("payload",new JSONObject().put("id",id).put("model_provider","fixture").put("dynamic_tools",new JSONArray().put(old).put(custom)));
  JSONObject user=new JSONObject().put("type","response_item").put("payload",new JSONObject().put("type","message").put("role","user").put("content",new JSONArray().put(new JSONObject().put("type","input_text").put("text","保留用户历史"))));
  Path source=directory.resolve("rollout-"+id+".jsonl");byte[] original=(metadata+"\n"+user+"\n").getBytes(StandardCharsets.UTF_8);Files.write(source,original);
  JSONObject spec=new JSONObject().put("name","eva_network").put("description","automatic capture").put("inputSchema",new JSONObject().put("type","object").put("properties",new JSONObject().put("action",new JSONObject().put("enum",new JSONArray().put("start").put("stop")))));
  JSONArray desired=new JSONArray().put(spec);
  JSONObject projected=ProviderHistoryProjection.project(home,output,"/fixture",id,"fixture",false,desired);
  check(projected.getBoolean("needed")&&projected.getBoolean("nativeToolsUpdated"),"same-provider tool upgrade projects history");
  check(projected.getInt("removedReasoningItems")==0,"no unrelated history removal");
  check(Arrays.equals(original,Files.readAllBytes(source)),"source remains byte-identical");
  String name=new File(projected.getString("path")).getName();List<String> rows=Files.readAllLines(new File(output,name).toPath(),StandardCharsets.UTF_8);
  JSONArray tools=new JSONObject(rows.get(0)).getJSONObject("payload").getJSONArray("dynamic_tools");
  check(tools.length()==2&&tools.getJSONObject(1).getString("name").equals("custom_tool"),"custom tools retained");
  check(!tools.getJSONObject(0).getBoolean("deferLoading"),"existing native tool metadata retained");
  check(new JSONObject(rows.get(1)).getJSONObject("payload").toString().equals(user.getJSONObject("payload").toString()),"user content retained");
  JSONArray repeated=ProviderHistoryProjection.upgradeTools(tools,desired);
  check(ProviderHistoryProjection.sameJson(tools,repeated),"upgrade is idempotent");
  check(ProviderHistoryProjection.sameJson(new JSONObject("{\"a\":1,\"b\":2}"),new JSONObject("{\"b\":2,\"a\":1}")),"object key order does not cause repeated forks");
  JSONObject newSpec=new JSONObject().put("name","eva_phone_route").put("description","route").put("inputSchema",new JSONObject().put("type","object"));
  JSONArray canonical=ProviderHistoryProjection.upgradeTools(tools,new JSONArray().put(newSpec));
  for(int i=0;i<canonical.length();i++){
   JSONObject entry=canonical.getJSONObject(i);
   check(entry.getString("type").equals("function"),"every native and custom tool has canonical function tag");
   check(entry.has("inputSchema")&&!entry.has("input_schema"),"tool schema uses camelCase protocol field");
  }
  check(canonical.length()==3,"new route tool appended to canonical legacy upgrade");
  JSONObject mixedOld=new JSONObject().put("type","function").put("name","eva_phone").put("description","old").put("inputSchema",new JSONObject()).put("input_schema",new JSONObject().put("obsolete",true));
  JSONArray repaired=ProviderHistoryProjection.upgradeTools(new JSONArray().put(mixedOld).put(new JSONObject().put("name","eva_phone_route").put("description","route").put("input_schema",new JSONObject())),new JSONArray().put(newSpec));
  check(repaired.getJSONObject(0).getJSONObject("inputSchema").length()==0,"canonical schema wins over stale snake_case field");
  check(!repaired.toString().contains("input_schema")&&repaired.getJSONObject(1).getString("type").equals("function"),"mixed broken projection is repaired");
  JSONObject legacyNamespaced=new JSONObject().put("namespace","custom").put("name","lookup").put("description","keep namespace").put("inputSchema",new JSONObject()).put("exposeToContext",false);
  JSONArray grouped=ProviderHistoryProjection.canonicalTools(new JSONArray().put(legacyNamespaced));
  check(grouped.getJSONObject(0).getString("type").equals("namespace"),"legacy namespace retained canonically");
  JSONObject nested=grouped.getJSONObject(0).getJSONArray("tools").getJSONObject(0);
  check(nested.getBoolean("deferLoading")&&!nested.has("namespace"),"legacy deferred visibility preserved");
  check(ProviderHistoryProjection.sameJson(grouped,ProviderHistoryProjection.canonicalTools(grouped)),"canonical namespaces are idempotent");
  System.out.println("PASS native tool schema upgrade "+checks+" checks");
 }
}
