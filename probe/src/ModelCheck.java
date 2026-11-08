package ai.eva.android.probe;
import android.app.*;import android.os.*;import org.json.*;import java.net.*;import java.io.*;
/** Isolated fixture checks; never contacts a cloud provider. */
public class ModelCheck extends Instrumentation {
 void check(boolean value,String label){if(!value)throw new AssertionError(label);}
 interface Work{void run()throws Exception;}
 void rejects(Work w,String label)throws Exception{boolean failed=false;try{w.run();}catch(Exception expected){failed=true;}check(failed,label);}
 static class Fake extends HttpURLConnection{
  int status=200;String response="{\"status\":\"completed\",\"output\":[{\"type\":\"message\",\"content\":[{\"type\":\"output_text\",\"text\":\"fixture reply\"}]}]}";ByteArrayOutputStream sent=new ByteArrayOutputStream();boolean closed;
  Fake()throws Exception{super(new URL("https://fixture.invalid/v1/responses"));}
  public void connect(){}public void disconnect(){closed=true;}public boolean usingProxy(){return false;}public int getResponseCode(){return status;}public OutputStream getOutputStream(){return sent;}public InputStream getInputStream()throws IOException{return new ByteArrayInputStream(response.getBytes("UTF-8"));}
 }
 public void onCreate(Bundle args){super.onCreate(args);start();}
 public void onStart(){Bundle result=new Bundle();int code=0;ModelStore store=new ModelStore(getTargetContext());String saved=store.prefs().getString("config",null);android.content.SharedPreferences account=getTargetContext().getSharedPreferences("eva-account",0);java.util.Map<String,?> accountSaved=account.getAll();try{
  account.edit().putBoolean("preferred",false).commit();
  store.prefs().edit().remove("config").commit();String secret="fixture-only-not-a-real-key";
  String id=store.save("","Fixture","https://fixture.invalid/v1/","",secret);
  check(!store.prefs().getString("config","").contains(secret),"plaintext persisted");check(store.secret(store.provider(id)).equals(secret),"Keystore roundtrip");check(!store.publicConfig().toString().contains(secret)&&!store.publicConfig().toString().contains("secret"),"public credential leak");
  rejects(()->store.select(id),"empty model selected");store.save(id,"Fixture","https://fixture.invalid/v1","fixture-model","");store.select(id);
  rejects(()->store.save(id,"Fixture","https://other.invalid/v1","model",""),"key reused across hosts");
  for(String url:new String[]{"http://fixture.invalid","https://key@fixture.invalid","https://fixture.invalid?key=x","https://fixture.invalid/v1/responses"})rejects(()->ModelStore.baseUrl(url),"invalid URL accepted");
  check(ModelStore.baseUrl("http://127.0.0.1:18900/v1/").equals("http://127.0.0.1:18900/v1"),"local loopback allowed");
  check(ModelStore.baseUrl("http://[::1]:18900/v1").contains("[::1]"),"IPv6 loopback allowed");
  rejects(()->ModelStore.baseUrl("http://127.0.0.1.example.invalid/v1"),"lookalike loopback rejected");
  rejects(()->ModelStore.baseUrl("http://192.168.1.1/v1"),"LAN cleartext rejected");
  String stamp=store.runtimeStamp();JSONObject provider=store.provider(id);
  store.cacheModels(id,provider,new JSONArray("[{id:'one'},{id:'one'},{id:'two',name:'Two'},{id:''},{id:123}]"));
  check(store.provider(id).getJSONArray("models").length()==2,"model list validated and deduplicated");
  check(store.runtimeStamp().equals(stamp),"catalog refresh keeps kernel binding valid");
  rejects(()->store.cacheModels(id,new JSONArray()),"empty catalog rejected");
  check(store.provider(id).getJSONArray("models").length()==2,"empty refresh preserves previous catalog");
  store.save(id,"Fixture","https://fixture.invalid/v1","two","");
  check(store.runtimeStamp().equals(stamp)&&store.provider(id).getJSONArray("models").length()==2,"model selection preserves cache and binding");
  store.save(id,"Fixture","https://fixture.invalid/v1","two","new-fixture-key");
  rejects(()->store.cacheModels(id,provider,new JSONArray("[{id:'stale'}]")),"old credential catalog rejected");
  check(!store.provider(id).has("models"),"credential change invalidates catalog");
  store.save(id,"Renamed","https://fixture.invalid/v1","two","");
  String stable=store.runtimeStamp();JSONObject defaultBefore=store.read().getJSONObject("defaultSelection");
  store.save(id,"Renamed Again","https://fixture.invalid/v1","other-test-model","");
  check(store.read().getJSONObject("defaultSelection").toString().equals(defaultBefore.toString()),"editing test model changed global default");
  check(store.runtimeStamp().equals(stable),"display name changed runtime binding");
  store.modelPreference(id,"two",new JSONObject("{visible:false,name:'My Two',reasoningEfforts:['low','high']}"));
  store.setDefaultSelection(id,"two","high","");
  check(store.read().getJSONObject("defaultSelection").getString("model").equals("two"),"hidden model cannot remain selected");
  JSONObject expected=store.provider(id);
  store.cacheModels(id,expected,new JSONArray("[{id:'two',name:'Remote Two',reasoningEfforts:['medium'],supportsVision:true,supportsTools:false}]"));
  JSONObject preference=store.provider(id).getJSONObject("modelPreferences").getJSONObject("two");
  check(!preference.getBoolean("visible")&&preference.getString("name").equals("My Two")&&preference.getJSONArray("reasoningEfforts").length()==2,"catalog overwrote preferences");
  check(store.provider(id).getJSONArray("models").getJSONObject(0).getBoolean("supportsVision"),"explicit capabilities lost");
  store.addModel(id,"manual","Manual");store.cacheModels(id,new JSONArray("[{id:'two'}]"));
  check(store.provider(id).getJSONArray("models").length()==2,"manual model lost on refresh");
  JSONObject beforeProtocol=store.provider(id);store.save(id,"Protocol Test","https://fixture.invalid/v1","two","","chat_completions");
  rejects(()->store.cacheModels(id,beforeProtocol,new JSONArray("[{id:'stale'}]")),"old protocol catalog accepted");
  check(!store.runtimeStamp().equals(stable),"protocol excluded from runtime binding");
  JSONObject legacy=store.read();legacy.remove("defaultSelection");legacy.put("active",id);store.prefs().edit().putString("config",legacy.toString()).commit();account.edit().putBoolean("preferred",true).putString("model","legacy-account-model").commit();
  check(store.read().getJSONObject("defaultSelection").optString("providerId").equals("openai")&&store.read().getJSONObject("defaultSelection").getString("model").equals("legacy-account-model"),"legacy preferred default migration");
  store.save(id,"After Migration","https://fixture.invalid/v1","two","");
  JSONObject accountDefault=new JSONObject(store.read().getJSONObject("defaultSelection").toString());
  store.modelPreference("openai","legacy-account-model",new JSONObject("{visible:false,name:'Account Name',reasoningEfforts:['high']}"));
  JSONObject accountPreference=store.publicConfig().getJSONObject("account").getJSONObject("modelPreferences").getJSONObject("legacy-account-model");
  check(!accountPreference.getBoolean("visible")&&accountPreference.getString("name").equals("Account Name"),"account preferences not exposed");
  check(store.read().getJSONObject("defaultSelection").toString().equals(accountDefault.toString()),"account hide/rename changed default");
  check(store.provider(id).getJSONObject("modelPreferences").getJSONObject("two").getString("name").equals("My Two"),"account preferences changed API preferences");
  check(!store.provider(id).getJSONObject("modelPreferences").has("legacy-account-model"),"account preference leaked to API provider");
  rejects(()->store.modelPreference("openai","legacy-account-model",new JSONObject("{visible:'no'}")),"invalid account preference accepted");
  check(store.read().getJSONObject("defaultSelection").getString("model").equals("legacy-account-model"),"connection edit changed migrated default");
  String localId=store.save("","Local Fixture",LocalFreeModels.URL,"kilo-auto/free",secret);
  check(store.provider(localId).getString("protocol").equals("chat_completions"),"new local service defaults to compatible Chat protocol");
  JSONObject localConfig=store.read(),localBefore=store.provider(localId),localDefault=new JSONObject(localConfig.getJSONObject("defaultSelection").toString());
  JSONArray localProviders=localConfig.getJSONArray("providers");
  for(int n=0;n<localProviders.length();n++){JSONObject item=localProviders.getJSONObject(n);if(item.getString("id").equals(localId)){item.remove("localProtocolRevision");item.put("protocol","responses");}}
  store.write(localConfig);
  JSONObject migratedLocal=store.provider(localId);
  check(migratedLocal.getString("protocol").equals("chat_completions")&&migratedLocal.getInt("localProtocolRevision")==1,"legacy local service protocol migrated once");
  check(migratedLocal.getString("id").equals(localBefore.getString("id"))&&migratedLocal.getString("model").equals(localBefore.getString("model"))&&migratedLocal.getString("secret").equals(localBefore.getString("secret")),"local migration preserves provider binding model and credential");
  check(store.read().getJSONObject("defaultSelection").toString().equals(localDefault.toString())&&store.provider(id).getString("protocol").equals("chat_completions"),"local migration preserves selected default and unrelated provider");
  store.save(localId,"Explicit Local",LocalFreeModels.URL,"kilo-auto/free","","responses");
  check(store.provider(localId).getString("protocol").equals("responses"),"explicit later local protocol choice retained on read");
  store.save(localId,"Renamed Local",LocalFreeModels.URL,"kilo-auto/free","");
  check(store.provider(localId).getString("protocol").equals("responses"),"renaming local service does not rerun protocol migration");
  store.delete(localId);
  JSONArray declaredEfforts=ModelStore.modelCatalog(new JSONArray("[{id:'declared',x_ofm_efforts:[{id:'high'}],x_ofm_effort_default:'high'},{id:'unknown',x_ofm_efforts:[{id:'high'}],x_ofm_effort_default:'low'}]"));
  check(declaredEfforts.getJSONObject(0).getJSONArray("reasoningEfforts").getString(0).equals("high")&&declaredEfforts.getJSONObject(0).getString("defaultReasoningEffort").equals("high"),"declared service reasoning metadata lost");
  check(!declaredEfforts.getJSONObject(1).has("defaultReasoningEffort"),"undeclared default reasoning effort accepted");
  JSONObject localChat=new JSONObject().put("url",LocalFreeModels.URL).put("protocol","chat_completions");
  for(String effort:new String[]{"off","light","balanced","deep","max"})for(String field:new String[]{"effort","reasoningEffort"}){
   JSONObject adapted=LocalFreeModels.turnOptions(localChat,new JSONObject().put("model","fixture-model").put(field,effort));
   check(adapted.getString("model").equals("fixture-model("+effort+")")&&!adapted.has("effort")&&!adapted.has("reasoningEffort"),"service effort suffix or enum removal failed");
  }
  JSONObject untouched=new JSONObject().put("model","fixture-model").put("effort","light");String untouchedText=untouched.toString();
  LocalFreeModels.turnOptions(new JSONObject().put("url","https://fixture.invalid/v1").put("protocol","chat_completions"),untouched);
  check(untouched.toString().equals(untouchedText),"ordinary provider turn options changed");
  JSONObject noEffort=new JSONObject().put("model","fixture-model");String noEffortText=noEffort.toString();LocalFreeModels.turnOptions(localChat,noEffort);
  check(noEffort.toString().equals(noEffortText),"effort-free turn options changed");
  check(ModelStore.needsLocalCatalogRefresh(new JSONObject().put("url",LocalFreeModels.URL)),"legacy local catalog not scheduled for metadata upgrade");
  check(!ModelStore.needsLocalCatalogRefresh(new JSONObject().put("url",LocalFreeModels.URL).put("catalogMetadataVersion",2)),"current local catalog repeatedly refreshed");
  check(!ModelStore.needsLocalCatalogRefresh(new JSONObject().put("url","https://fixture.invalid/v1")),"unrelated provider auto-refreshed");
  Fake conn=new Fake();JSONObject body=ModelClient.body("fixture-model",new JSONArray().put(new JSONObject().put("role","user").put("content","hello")));
  check(ModelClient.text(ModelClient.exchange(conn,secret,body,new ModelClient.Job())).equals("fixture reply"),"response parse");check(conn.closed&&!conn.getInstanceFollowRedirects(),"redirect/close");check(conn.getRequestProperty("Authorization").equals("Bearer "+secret),"authorization");check(conn.sent.toString("UTF-8").contains("\"store\":false"),"store flag");check(conn.getRequestMethod().equals("POST"),"method");
  Fake redirect=new Fake();redirect.status=302;rejects(()->ModelClient.exchange(redirect,secret,null,new ModelClient.Job()),"redirect accepted");
  Fake denied=new Fake();denied.status=401;rejects(()->ModelClient.exchange(denied,secret,null,new ModelClient.Job()),"401 accepted");
  Fake malformed=new Fake();malformed.response="invalid "+secret;try{ModelClient.exchange(malformed,secret,null,new ModelClient.Job());throw new AssertionError("invalid JSON accepted");}catch(Exception e){check(!ModelClient.safeError(e).contains(secret),"error key leak");}
  rejects(()->ModelClient.text(new JSONObject("{\"status\":\"incomplete\"}")),"incomplete accepted");
  ModelClient.Job cancelled=new ModelClient.Job();cancelled.cancelled=true;rejects(()->ModelClient.exchange(new Fake(),secret,null,cancelled),"cancel ignored");
  check(new JSONObject(ModelClient.poll(getTargetContext(),"nonexistent-fixture-job")).getString("state").equals("interrupted"),"interrupted job");store.delete(id);check(store.publicConfig().getJSONArray("providers").length()==0,"delete");
  result.putString("result","PASS: real device Keystore, config isolation, URL validation, fixture HTTP headers/body/redirect/error/cancel, Responses parsing, interrupted job");
 }catch(Throwable e){code=1;result.putString("error",e.toString());}finally{if(saved==null)store.prefs().edit().remove("config").commit();else store.prefs().edit().putString("config",saved).commit();android.content.SharedPreferences.Editor restore=account.edit().clear();for(java.util.Map.Entry<String,?> entry:accountSaved.entrySet()){Object value=entry.getValue();String key=entry.getKey();if(value instanceof String)restore.putString(key,(String)value);else if(value instanceof Boolean)restore.putBoolean(key,(Boolean)value);else if(value instanceof Integer)restore.putInt(key,(Integer)value);else if(value instanceof Long)restore.putLong(key,(Long)value);else if(value instanceof Float)restore.putFloat(key,(Float)value);else if(value instanceof java.util.Set)restore.putStringSet(key,(java.util.Set<String>)value);}restore.commit();}finish(code,result);}
}
