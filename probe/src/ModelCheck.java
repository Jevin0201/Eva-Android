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
 public void onStart(){Bundle result=new Bundle();int code=0;ModelStore store=new ModelStore(getTargetContext());String saved=store.prefs().getString("config",null);try{
  store.prefs().edit().remove("config").commit();String secret="fixture-only-not-a-real-key";
  String id=store.save("","Fixture","https://fixture.invalid/v1/","",secret);
  check(!store.prefs().getString("config","").contains(secret),"plaintext persisted");check(store.secret(store.provider(id)).equals(secret),"Keystore roundtrip");check(!store.publicConfig().toString().contains(secret)&&!store.publicConfig().toString().contains("secret"),"public credential leak");
  rejects(()->store.select(id),"empty model selected");store.save(id,"Fixture","https://fixture.invalid/v1","fixture-model","");store.select(id);
  rejects(()->store.save(id,"Fixture","https://other.invalid/v1","model",""),"key reused across hosts");
  for(String url:new String[]{"http://fixture.invalid","https://key@fixture.invalid","https://fixture.invalid?key=x","https://fixture.invalid/v1/responses"})rejects(()->ModelStore.baseUrl(url),"invalid URL accepted");
  Fake conn=new Fake();JSONObject body=ModelClient.body("fixture-model",new JSONArray().put(new JSONObject().put("role","user").put("content","hello")));
  check(ModelClient.text(ModelClient.exchange(conn,secret,body,new ModelClient.Job())).equals("fixture reply"),"response parse");check(conn.closed&&!conn.getInstanceFollowRedirects(),"redirect/close");check(conn.getRequestProperty("Authorization").equals("Bearer "+secret),"authorization");check(conn.sent.toString("UTF-8").contains("\"store\":false"),"store flag");check(conn.getRequestMethod().equals("POST"),"method");
  Fake redirect=new Fake();redirect.status=302;rejects(()->ModelClient.exchange(redirect,secret,null,new ModelClient.Job()),"redirect accepted");
  Fake denied=new Fake();denied.status=401;rejects(()->ModelClient.exchange(denied,secret,null,new ModelClient.Job()),"401 accepted");
  Fake malformed=new Fake();malformed.response="invalid "+secret;try{ModelClient.exchange(malformed,secret,null,new ModelClient.Job());throw new AssertionError("invalid JSON accepted");}catch(Exception e){check(!ModelClient.safeError(e).contains(secret),"error key leak");}
  rejects(()->ModelClient.text(new JSONObject("{\"status\":\"incomplete\"}")),"incomplete accepted");
  ModelClient.Job cancelled=new ModelClient.Job();cancelled.cancelled=true;rejects(()->ModelClient.exchange(new Fake(),secret,null,cancelled),"cancel ignored");
  check(new JSONObject(ModelClient.poll(getTargetContext(),"nonexistent-fixture-job")).getString("state").equals("interrupted"),"interrupted job");store.delete(id);check(store.publicConfig().getJSONArray("providers").length()==0,"delete");
  result.putString("result","PASS: real device Keystore, config isolation, URL validation, fixture HTTP headers/body/redirect/error/cancel, Responses parsing, interrupted job");
 }catch(Throwable e){code=1;result.putString("error",e.toString());}finally{if(saved==null)store.prefs().edit().remove("config").commit();else store.prefs().edit().putString("config",saved).commit();}finish(code,result);}
}
