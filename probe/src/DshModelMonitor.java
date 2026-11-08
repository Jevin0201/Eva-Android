package ai.eva.android.probe;
import android.content.Context;import java.net.*;import java.util.concurrent.*;import java.util.concurrent.atomic.AtomicBoolean;import org.json.*;
/** Uses DSH's existing text connectivity test; never tests a user's paid provider. */
final class DshModelMonitor {
 static final ScheduledExecutorService scheduler=Executors.newSingleThreadScheduledExecutor();
 static final ExecutorService probes=Executors.newFixedThreadPool(2);
 static final AtomicBoolean armed=new AtomicBoolean(),running=new AtomicBoolean();
 static boolean busy(Context c){return !KernelHost.get(c).activeTurns.isEmpty()||!KernelHost.api(c).activeTurns.isEmpty();}
 static void refresh(Context raw,boolean force){Context c=raw.getApplicationContext();if(armed.compareAndSet(false,true))scheduler.scheduleWithFixedDelay(()->refresh(c,false),60,60,TimeUnit.SECONDS);if(!running.compareAndSet(false,true))return;scheduler.execute(()->{try{
  if(busy(c))return;ModelStore store=new ModelStore(c);JSONArray providers=store.read().getJSONArray("providers");
  for(int i=0;i<providers.length();i++){
   JSONObject p=providers.getJSONObject(i);if(!DshAvailability.managed(p))continue;String identity=p.getString("id")+":"+ModelStore.connectionRevision(p);long now=System.currentTimeMillis(),last=c.getSharedPreferences("eva-dsh-checks",0).getLong(identity,0);if(!force&&now>=last&&now-last<DshAvailability.REFRESH_MS)continue;
   c.getSharedPreferences("eva-dsh-checks",0).edit().putLong(identity,now).apply();
   try{LocalFreeModels.ensureProvider(c,p);JSONObject catalog=ModelClient.request(p,store.secret(p),"models",null,new ModelClient.Job());store.cacheModels(p.getString("id"),p,catalog.getJSONArray("data"));p=store.provider(p.getString("id"));final JSONObject expected=p;final String key=store.secret(p);JSONArray models=p.getJSONArray("models");CountDownLatch complete=new CountDownLatch(models.length());
    for(int n=0;n<models.length();n++){final String id=models.getJSONObject(n).getString("id");probes.execute(()->{try{
     if(busy(c))return;JSONObject prior=expected.optJSONObject("modelAvailability"),old=prior==null?null:prior.optJSONObject(id);long at=System.currentTimeMillis();if(!force&&old!=null&&at>=old.optLong("checkedAt")&&at-old.optLong("checkedAt")<DshAvailability.REFRESH_MS)return;
     boolean ok=false;String reason="检测未通过";try{HttpURLConnection connection=(HttpURLConnection)new URL("http://127.0.0.1:18900/api/management/models/test").openConnection(Proxy.NO_PROXY);JSONObject result=ModelClient.exchange(connection,key,new JSONObject().put("model",id),new ModelClient.Job(),2000,45000);ok=result.optBoolean("ok");reason=ok?"连通测试通过":"DSH未确认测试成功";}catch(Exception error){reason=ModelClient.safeError(error);}
     store.dshResult(expected.getString("id"),expected,id,ok,System.currentTimeMillis(),reason);notifyUi(c);
    }catch(Exception ignored){}finally{complete.countDown();}});}
    complete.await(12,TimeUnit.MINUTES);notifyUi(c);
   }catch(Exception ignored){notifyUi(c);}
  }
 }catch(Exception ignored){}finally{running.set(false);}});}
 static void notifyUi(Context c){try{KernelHost.get(c).emit(new JSONObject().put("method","android/modelsUpdated"));}catch(Exception ignored){}}
}
