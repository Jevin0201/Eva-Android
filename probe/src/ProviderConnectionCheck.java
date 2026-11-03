package ai.eva.android.probe;
import android.app.Instrumentation;
import android.os.Bundle;
import org.json.*;
/** Explicit developer diagnostic. Credentials remain inside Android Keystore. */
public class ProviderConnectionCheck extends Instrumentation {
 Bundle args;
 public void onCreate(Bundle value){super.onCreate(value);args=value;start();}
 public void onStart(){Bundle out=new Bundle();int code=0;try{
  ModelStore store=new ModelStore(getTargetContext());String id=args.getString("provider",store.read().getString("active"));JSONObject provider=store.provider(id);
  JSONObject models=ModelClient.request(provider,store.secret(provider),"models",null,new ModelClient.Job());JSONArray names=new JSONArray();JSONArray entries=models.getJSONArray("data");for(int i=0;i<entries.length();i++)names.put(entries.getJSONObject(i).getString("id"));out.putString("models",names.toString());
  String model=args.getString("model",provider.getString("model"));boolean found=false;for(int i=0;i<names.length();i++)if(model.equals(names.getString(i)))found=true;if(!found)throw new Exception("Configured model not in provider model list: "+model);
  if(args.containsKey("model")){store.save(id,provider.getString("name"),provider.getString("url"),model,"");provider=store.provider(id);}
  JSONObject response=ModelClient.request(provider,store.secret(provider),"responses",ModelClient.body(model,new JSONArray().put(new JSONObject().put("role","user").put("content","Reply only OK."))),new ModelClient.Job());
  out.putString("result","PASS provider models and Responses request; model="+model+"; reply="+ModelClient.text(response));
 }catch(Exception e){code=1;out.putString("error",ModelClient.safeError(e));}finish(code,out);}
}
