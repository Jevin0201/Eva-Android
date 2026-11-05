package ai.eva.android.probe;
import java.util.*;import org.json.*;
public final class ThreadActivitySummaryTest {
 public static void main(String[] args)throws Exception{
  String thread=UUID.randomUUID().toString(),turn=UUID.randomUUID().toString();JSONObject request=new JSONObject().put("threadId",thread).put("turnIds",new JSONArray().put(turn));int[] calls={0};
  ThreadActivitySummary.Rpc plain=(m,p)->{calls[0]++;if(!m.equals("thread/items/list")||p.getInt("limit")!=2)throw new AssertionError("bounded read");return new JSONObject().put("data",new JSONArray().put(entry(turn,"agentMessage")).put(entry(turn,"userMessage"))).put("nextCursor",JSONObject.NULL);};
  if(ThreadActivitySummary.read(request,plain).getJSONArray("data").getJSONObject(0).getBoolean("hasActivity"))throw new AssertionError("plain reply invents activity");
  int[] emptyCalls={0};JSONObject empty=ThreadActivitySummary.read(request,(m,p)->{emptyCalls[0]++;return emptyCalls[0]==1?new JSONObject().put("data",new JSONArray().put(entry(turn,"agentMessage")).put(entry(turn,"reasoning"))).put("nextCursor","past-private-reasoning"):new JSONObject().put("data",new JSONArray().put(entry(turn,"userMessage"))).put("nextCursor",JSONObject.NULL);});if(empty.getJSONArray("data").getJSONObject(0).getBoolean("hasActivity")||emptyCalls[0]!=2)throw new AssertionError("private empty reasoning invented activity");
  char[] bytes=new char[9*1024*1024];Arrays.fill(bytes,'x');String huge=new String(bytes);
  JSONObject metadata=ThreadActivitySummary.read(request,(m,p)->new JSONObject().put("data",new JSONArray().put(entry(turn,"agentMessage")).put(entry(turn,"commandExecution").put("item",new JSONObject().put("type","commandExecution").put("aggregatedOutput",huge)))).put("nextCursor","cursor"));
  if(!metadata.getJSONArray("data").getJSONObject(0).getBoolean("hasActivity")||metadata.toString().length()>500)throw new AssertionError("large tool payload crosses IPC");
  try{ThreadActivitySummary.read(request,(m,p)->new JSONObject().put("data",new JSONArray().put(entry("wrong","agentMessage"))));throw new AssertionError("wrong turn accepted");}catch(java.io.IOException expected){}
  JSONArray many=new JSONArray();for(int n=0;n<6;n++)many.put(turn);try{ThreadActivitySummary.read(new JSONObject().put("threadId",thread).put("turnIds",many),plain);throw new AssertionError("unbounded batch accepted");}catch(java.io.IOException expected){}
  if(calls[0]!=1)throw new AssertionError("validation must run before RPC");System.out.println("PASS activity metadata: plain reply absent, real work present, 9MiB payload excluded from bridge, turn match and five-turn bound");
 }
 static JSONObject entry(String turn,String type)throws Exception{return new JSONObject().put("turnId",turn).put("item",new JSONObject().put("type",type));}
}
