package ai.eva.android.probe;
import android.content.*;import org.json.*;import java.io.*;import java.util.*;import java.util.concurrent.*;import java.util.concurrent.atomic.AtomicInteger;

/** Android process/IPC adapter for Eva's pinned Codex app-server protocol. */
public final class KernelHost {
 private static KernelHost instance;
 static synchronized KernelHost get(Context c){if(instance==null)instance=new KernelHost(c.getApplicationContext());return instance;}
 final Context context;final ExecutorService work=Executors.newCachedThreadPool();final ConcurrentHashMap<Integer,CompletableFuture<JSONObject>> pending=new ConcurrentHashMap<>();final AtomicInteger ids=new AtomicInteger(1);final ArrayDeque<JSONObject> events=new ArrayDeque<>();final ArrayList<String> secrets=new ArrayList<>();Process process;BufferedWriter input;String configStamp="";boolean ready;KernelNetwork network;
 KernelHost(Context c){context=c;}
 final Object eventLock=new Object();
 void emit(JSONObject value){synchronized(eventLock){if(events.size()>=4000){events.clear();try{events.add(new JSONObject().put("method","android/resyncRequired"));}catch(Exception ignored){}}events.add(value);}}
 String drain(){synchronized(eventLock){JSONArray rows=new JSONArray();for(int n=0;n<200&&!events.isEmpty();n++)rows.put(events.removeFirst());return rows.toString();}}
 String redact(String text){synchronized(secrets){for(String secret:secrets)if(!secret.isEmpty())text=text.replace(secret,"[REDACTED]");}return text;}
 synchronized void write(JSONObject message)throws Exception{if(input==null)throw new IOException("Codex 内核未启动");input.write(message.toString());input.newLine();input.flush();}
 JSONObject rpc(String method,JSONObject params)throws Exception{int id=ids.getAndIncrement();CompletableFuture<JSONObject> future=new CompletableFuture<>();pending.put(id,future);try{write(new JSONObject().put("id",id).put("method",method).put("params",params));JSONObject reply=future.get(45,TimeUnit.SECONDS);if(reply.has("error"))throw new IOException(redact(reply.getJSONObject("error").optString("message","内核请求失败")));return reply.optJSONObject("result")==null?new JSONObject():reply.getJSONObject("result");}finally{pending.remove(id);}}
 void ensureStarted()throws Exception{synchronized(this){if(ready&&process!=null&&process.isAlive())return;
  File root=new File(context.getFilesDir(),"alpine"),binary=new File(root,"root/eva-kernel/bin/codex");if(!binary.isFile())throw new IOException("Codex 内核尚未安装到手机运行环境");
  new File(root,"root/.eva-codex").mkdirs();new File(root,"root/eva-workspace").mkdirs();new File(context.getFilesDir(),"tmp").mkdirs();String lib=context.getApplicationInfo().nativeLibraryDir;
  ProcessBuilder pb=new ProcessBuilder(lib+"/liboperit_proot.so","-0","-r",root.getAbsolutePath(),"-b","/dev","-b","/proc","-w","/root/eva-workspace","/root/eva-kernel/bin/codex","app-server");
  Map<String,String> env=pb.environment();env.put("PROOT_LOADER",lib+"/liboperit_loader.so");env.put("PROOT_TMP_DIR",new File(context.getFilesDir(),"tmp").getAbsolutePath());env.put("HOME","/root");env.put("CODEX_HOME","/root/.eva-codex");env.put("PATH","/root/eva-kernel/bin:/root/eva-kernel/codex-path:/usr/bin:/bin:/usr/sbin:/sbin");
  if(network==null)network=new KernelNetwork();env.put("HTTPS_PROXY",network.proxyUrl);env.put("HTTP_PROXY",network.proxyUrl);env.put("https_proxy",network.proxyUrl);env.put("http_proxy",network.proxyUrl);env.put("NO_PROXY","localhost,127.0.0.1,::1");env.put("no_proxy","localhost,127.0.0.1,::1");
  ModelStore store=new ModelStore(context);JSONObject config=store.read();configStamp=config.toString();JSONArray providers=config.getJSONArray("providers");synchronized(secrets){secrets.clear();for(int i=0;i<providers.length();i++){JSONObject p=providers.getJSONObject(i);String secret=store.secret(p);secrets.add(secret);env.put(envName(p.getString("id")),secret);}}
  final Process child=pb.start();process=child;input=new BufferedWriter(new OutputStreamWriter(child.getOutputStream(),"UTF-8"));
  work.execute(()->{try(BufferedReader reader=new BufferedReader(new InputStreamReader(child.getInputStream(),"UTF-8"))){String line;while((line=reader.readLine())!=null){try{JSONObject row=new JSONObject(redact(line));if(row.has("id")&&!row.has("method")){CompletableFuture<JSONObject> f=pending.get(row.optInt("id"));if(f!=null)f.complete(row);}else {PhoneTaskReport.event(context,row);if(BrowserTools.handle(this,row)||PhoneTools.handle(this,row))continue;if("turn/started".equals(row.optString("method"))){JSONObject state=row.optJSONObject("params");if(state!=null&&state.optString("threadId").equals(PhoneTools.owner))PhoneTools.turn=state.getJSONObject("turn").getString("id");}if("turn/completed".equals(row.optString("method"))){JSONObject state=row.optJSONObject("params");if(state!=null&&state.optString("threadId").equals(PhoneTools.owner)){PhoneTools.owner="";PhoneTools.turn="";}}if("account/login/completed".equals(row.optString("method"))){JSONObject state=row.optJSONObject("params");if(state!=null){loginSession=null;loginError=state.optBoolean("success")?"":state.optString("error","登录未完成，请重试");LoginService.end(context);}}emit(row);}}catch(JSONException ignored){}}}catch(Exception ignored){}finally{PhoneTaskReport.failAll(context);for(CompletableFuture<JSONObject> f:pending.values())f.completeExceptionally(new IOException("Codex 内核已停止，请恢复会话"));try{emit(new JSONObject().put("method","android/kernelExited"));}catch(Exception ignored){}}});
  work.execute(()->{try(InputStream err=child.getErrorStream()){byte[] bytes=new byte[4096];while(err.read(bytes)!=-1){/* Do not persist raw provider stderr or credentials. */}}catch(Exception ignored){}});
 }
 // Reader must be able to acquire the event lock during initialization.
 rpc("initialize",new JSONObject().put("clientInfo",new JSONObject().put("name","eva_android").put("version","0.0.11")).put("capabilities",new JSONObject().put("experimentalApi",true)));write(new JSONObject().put("method","initialized").put("params",new JSONObject()));ready=true;
 }
 static String envName(String id){return "EVA_PROVIDER_"+id.replace('-','_');}
 JSONObject params(String method,JSONObject p)throws Exception{if(method.equals("turn/start")){PhoneTaskService.restore(context);PhoneTools.bind(p.getString("threadId"));}if(method.equals("thread/start")||method.equals("thread/resume")){
  ModelStore store=new ModelStore(context);if(!store.read().toString().equals(configStamp))throw new IOException("提供商配置已变化，请重启 Eva 后使用新配置");JSONArray list=store.read().getJSONArray("providers");JSONObject definitions=new JSONObject();for(int i=0;i<list.length();i++){JSONObject entry=list.getJSONObject(i);definitions.put(entry.getString("id"),new JSONObject().put("name",entry.getString("name")).put("base_url",entry.getString("url")).put("env_key",envName(entry.getString("id"))).put("wire_api","responses").put("requires_openai_auth",false).put("supports_websockets",false));}
  if(method.equals("thread/start"))p.put("dynamicTools",PhoneTools.specs().put(BrowserTools.spec()));p.put("config",new JSONObject().put("model_providers",definitions));String project=p.optString("androidProject","");p.remove("androidProject");WorkspaceFiles.project(context,project);p.put("cwd","/root/eva-workspace"+(project.isEmpty()?"":"/projects/"+project));p.put("sandbox","read-only");p.put("approvalPolicy","on-request");
 }return p;}
 final Object startup=new Object();
 volatile JSONObject loginSession;volatile String loginError="";
 JSONObject nativeRequest(String method,JSONObject params)throws Exception{
  synchronized(startup){ensureStarted();}
  JSONObject result=rpc(method,params);
  if(method.equals("account/login/start")){loginSession=result;loginError="";}
  if(method.equals("account/login/cancel")||method.equals("account/logout"))loginSession=null;
  if(method.equals("account/read")){JSONObject account=result.optJSONObject("account");boolean logged=account!=null&&"chatgpt".equals(account.optString("type"));context.getSharedPreferences("eva-account",0).edit().putBoolean("loggedIn",logged).apply();if(logged)loginSession=null;}
  return result;
 }
 void call(String ticket,String method,String json){work.execute(()->{try{if(!Arrays.asList("account/read","account/rateLimits/read","account/login/start","account/login/cancel","account/logout","model/list","thread/start","thread/resume","thread/read","thread/archive","thread/list","turn/start","turn/interrupt").contains(method))throw new IOException("不支持的内核请求");synchronized(startup){try{ensureStarted();}catch(Exception startError){synchronized(this){ready=false;if(process!=null)process.destroy();input=null;}throw startError;}}JSONObject result=rpc(method,params(method,new JSONObject(json)));emit(new JSONObject().put("ticket",ticket).put("result",result));}catch(Exception e){try{emit(new JSONObject().put("ticket",ticket).put("error",redact(e instanceof IOException?e.getMessage():"内核请求失败或超时；请恢复会话后检查，勿重复提交")));}catch(Exception ignored){}}});}
 void respond(String idJson,String resultJson){work.execute(()->{try{Object id=new JSONArray("["+idJson+"]").get(0);JSONObject result=new JSONObject(resultJson);write(new JSONObject().put("id",id).put(result.has("error")?"error":"result",result.has("error")?result.get("error"):result));}catch(Exception ignored){}});}
}
