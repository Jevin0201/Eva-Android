package ai.eva.android.probe;
import android.content.*;import java.io.*;import org.json.*;
class ShellActivity {static final Object saveLock=new Object();}
// This probe does not exercise model selection or validation.
class ModelStore {static void validateDshChoice(Context c,String provider,String model)throws Exception{throw new UnsupportedOperationException("not tested here");}}
/** app_process fixture; only opens its explicitly supplied temporary directory. */
public class UiStructureProbe {
 static void check(boolean b,String name){if(!b)throw new AssertionError(name);}
 public static void main(String[] args)throws Exception{
  final File root=new File(args[0]).getCanonicalFile();if(!root.getPath().startsWith("/data/local/tmp/eva-ui-perf-"))throw new SecurityException();root.mkdirs();
  Context c=new ContextWrapper(null){public File getFilesDir(){return root;}};
  JSONObject chat=new JSONObject().put("id","a").put("draft","保留草稿").put("messages",new JSONArray().put("保留原文"));
  JSONObject state=new JSONObject().put("chats",new JSONArray().put(chat).put(new JSONObject().put("id","b").put("messages",new JSONArray().put("删除对象")))).put("drafts",new JSONArray()).put("projects",new JSONArray().put(new JSONObject().put("id","p"))).put("active","a");
  check(!UiStateStore.saveStructure(c,state.toString(),UiStateStore.nextOperation()),"missing DB falls back");
  UiStateStore.save(c,state.toString());
  check(UiStateStore.saveNavigation(c,new JSONObject().put("active","b").put("projectId","p").toString()),"navigation commit");check(new JSONObject(UiStateStore.load(c)).getString("active").equals("b"),"navigation restored");
  String navGood=UiStateStore.load(c);check(!UiStateStore.saveNavigation(c,new JSONObject().put("active","missing").toString()),"unknown navigation rejected");check(navGood.equals(UiStateStore.load(c)),"unknown navigation rollback");
  check(UiStateStore.saveNavigation(c,new JSONObject().put("active","a").put("projectId","p").toString()),"navigation restored to original");
  String key="chats:"+UiStateStore.digest("a".getBytes("UTF-8"))+":0",before;
  try(android.database.sqlite.SQLiteDatabase db=UiStateStore.open(c)){before=UiStateStore.row(db,key);}
  JSONObject index=new JSONObject(state.toString()).put("chats",new JSONArray().put(new JSONObject().put("id","a"))).put("projects",new JSONArray());
  check(UiStateStore.saveStructure(c,index.toString(),UiStateStore.nextOperation()),"structural commit");
  JSONObject loaded=new JSONObject(UiStateStore.load(c));check(loaded.getJSONArray("chats").length()==1,"removed chat");check(loaded.getJSONArray("projects").length()==0,"removed project");check(loaded.getJSONArray("chats").getJSONObject(0).getString("draft").equals("保留草稿"),"draft preserved");
  try(android.database.sqlite.SQLiteDatabase db=UiStateStore.open(c)){check(before.equals(UiStateStore.row(db,key)),"conversation chunks unchanged");check(UiStateStore.row(db,"chats:"+UiStateStore.digest("b".getBytes("UTF-8"))+":0")==null,"deleted chunks removed");}
  String good=UiStateStore.load(c);JSONObject missingId=new JSONObject(index.toString()).put("chats",new JSONArray().put(new JSONObject()));check(!UiStateStore.saveStructure(c,missingId.toString(),UiStateStore.nextOperation()),"empty ID fallback");check(good.equals(UiStateStore.load(c)),"empty ID rollback");index.getJSONArray("chats").put(new JSONObject().put("id","missing"));check(!UiStateStore.saveStructure(c,index.toString(),UiStateStore.nextOperation()),"missing row fallback");check(good.equals(UiStateStore.load(c)),"fallback rollback");
  index.put("chats",new JSONArray().put(new JSONObject().put("id","a")).put(new JSONObject().put("id","a")));check(!UiStateStore.saveStructure(c,index.toString(),UiStateStore.nextOperation()),"duplicate fallback");check(good.equals(UiStateStore.load(c)),"duplicate rollback");// Compare the same metadata-only update with and without resending 2 MB of histories.
  char[] fill=new char[20000];java.util.Arrays.fill(fill,'x');String text=new String(fill);JSONArray big=new JSONArray(),refs=new JSONArray();
  for(int i=0;i<100;i++){String id="bench"+i;big.put(new JSONObject().put("id",id).put("messages",new JSONArray().put(text)));refs.put(new JSONObject().put("id",id));}
  JSONObject large=new JSONObject().put("chats",big).put("drafts",new JSONArray()).put("projects",new JSONArray());String full=large.toString();String small=new JSONObject(large.toString()).put("chats",refs).toString();UiStateStore.save(c,full);
  long[] fullTimes=new long[5],smallTimes=new long[5];for(int i=0;i<5;i++){long start=System.nanoTime();UiStateStore.save(c,full);fullTimes[i]=(System.nanoTime()-start)/1000;start=System.nanoTime();check(UiStateStore.saveStructure(c,small,UiStateStore.nextOperation()),"benchmark commit");smallTimes[i]=(System.nanoTime()-start)/1000;}
  java.util.Arrays.sort(fullTimes);java.util.Arrays.sort(smallTimes);System.out.println("BENCH 100 chats / "+full.length()+" chars: full median "+fullTimes[2]+" us; structure median "+smallTimes[2]+" us (5 samples; warm DB)");
  System.out.println("PASS SQLite navigation/structure checks; untouched chunks preserved, deletion atomic, missing/duplicate fallback rollback");
 }
}
