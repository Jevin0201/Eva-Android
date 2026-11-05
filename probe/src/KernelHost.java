package ai.eva.android.probe;
import android.content.*;import org.json.*;import java.io.*;import java.util.*;import java.util.concurrent.*;import java.util.concurrent.atomic.AtomicInteger;

/** Android process/IPC adapter for Eva's pinned Codex app-server protocol. */
public final class KernelHost {
 private static KernelHost instance,apiInstance;
 static synchronized KernelHost api(Context c){if(apiInstance==null)apiInstance=new KernelHost(c.getApplicationContext(),true);return apiInstance;}
 static KernelHost forThread(Context c,String thread){return c.getSharedPreferences("eva-kernel-routing",0).getBoolean(thread,false)?api(c):get(c);}
 static synchronized KernelHost get(Context c){if(instance==null)instance=new KernelHost(c.getApplicationContext());return instance;}

 /** Dedicated desktop Cron transport. Ordinary UI permission presets never rewrite this policy. */
 static JSONObject scheduledRequest(Context context,String method,JSONObject value,JSONObject binding)throws Exception{
  Set<String> reads=new HashSet<>(Arrays.asList("model/list","account/read","config/read","configRequirements/read","thread/read","thread/turns/list"));
  Set<String> writes=new HashSet<>(Arrays.asList("thread/start","thread/resume","turn/start","thread/archive","turn/interrupt"));
  if(!reads.contains(method)&&!writes.contains(method))throw new IOException("定时任务不支持此内核操作");
  if(writes.contains(method)&&(binding==null||binding.optString("automationId").isEmpty()||binding.optString("provider").isEmpty()||binding.optString("model").isEmpty()))throw new IOException("定时任务缺少固定模型绑定");
  if(binding!=null&&(!"on-request".equals(binding.optString("approvalPolicy","on-request"))||!"user".equals(binding.optString("approvalsReviewer","user"))||binding.optJSONObject("sandboxPolicy")!=null&&!"readOnly".equals(binding.getJSONObject("sandboxPolicy").optString("type"))))throw new IOException("定时任务权限绑定无效");
  JSONObject params=new JSONObject(value.toString());
  String provider=binding==null?"openai":binding.optString("provider","openai");
  KernelHost kernel="openai".equals(provider)?get(context):api(context);
  if(params.has("threadId")){
   String saved=context.getSharedPreferences("eva-scheduled-routing",0).getString(params.getString("threadId"),null);
   if(saved==null)throw new IOException("这个会话不属于定时任务或路由尚未恢复");
   if(saved!=null){JSONObject owner=new JSONObject(saved);if(binding!=null&&(!owner.optString("automationId").equals(binding.optString("automationId"))||writes.contains(method)&&(!owner.optString("provider").equals(provider)||!owner.optString("model").equals(binding.optString("model")))))throw new IOException("定时任务模型或会话绑定不一致");kernel=forThread(context,params.getString("threadId"));}
  }
  synchronized(kernel.startup){kernel.ensureStarted();}
  synchronized(providerDispatch){
   if((writes.contains(method)||method.equals("model/list"))&&!new ModelStore(context).read().getJSONArray("providers").toString().equals(kernel.configStamp))throw new IOException("提供商配置已变化，请停止任务并重新打开 Eva 后使用定时任务");
   if(!"openai".equals(provider))new ModelStore(context).provider(provider);
   if(method.equals("model/list")&&binding!=null)kernel.selectKernelProvider(provider);
   if(method.equals("config/read"))params.put("cwd","/root/eva-workspace");
   if(method.equals("thread/start")||method.equals("thread/resume")){
    kernel.selectKernelProvider(provider);
    params.put("model",binding.getString("model")).put("modelProvider",provider).put("cwd","/root/eva-workspace");
    params.put("approvalPolicy","on-request").put("approvalsReviewer","user").put("sandbox","read-only");
    params.put("dynamicTools",new JSONArray()).put("config",new JSONObject().put("model_providers",kernel.providerDefinitions()));
    params.remove("sandboxPolicy");params.remove("androidProject");
   }
   if(method.equals("turn/start")){
    kernel.selectKernelProvider(provider);
    JSONObject meta=kernel.rpc("thread/read",new JSONObject().put("threadId",params.getString("threadId")).put("includeTurns",false)).optJSONObject("thread");
    if(meta==null||meta.optJSONObject("status")!=null&&"active".equals(meta.getJSONObject("status").optString("type")))throw new IOException("定时任务会话仍在运行或状态无法确认");
    params.put("model",binding.getString("model")).put("approvalPolicy","on-request").put("approvalsReviewer","user").put("sandboxPolicy",new JSONObject().put("type","readOnly"));
    params.remove("sandbox");params.remove("config");params.remove("dynamicTools");
   }
   JSONObject result=kernel.rpc(method,params);
   if(method.equals("thread/start")||method.equals("thread/resume")){
    JSONObject thread=result.getJSONObject("thread");String id=thread.getString("id");if(thread.has("cwd")&&!"/root/eva-workspace".equals(thread.getString("cwd")))throw new IOException("定时任务目录未获内核确认");
    if(!provider.equals(result.optString("modelProvider",provider))||!binding.getString("model").equals(result.optString("model",binding.getString("model"))))throw new IOException("内核未接受定时任务模型绑定");
    kernel.threadProviders.put(id,provider);kernel.threadCwds.put(id,"/root/eva-workspace");
    if(!context.getSharedPreferences("eva-scheduled-routing",0).edit().putString(id,binding.toString()).commit())throw new IOException("定时任务会话绑定保存失败，未发送任务");
    context.getSharedPreferences("eva-kernel-routing",0).edit().putBoolean(id,kernel.apiOnly).commit();
   }
   return result;
  }
 }
 final Context context;final ExecutorService work=Executors.newCachedThreadPool();final ConcurrentHashMap<Integer,CompletableFuture<JSONObject>> pending=new ConcurrentHashMap<>();final AtomicInteger ids=new AtomicInteger(1);final ArrayDeque<JSONObject> events=new ArrayDeque<>();final ArrayList<String> secrets=new ArrayList<>();volatile Process process;BufferedWriter input;String configStamp="";boolean ready;KernelNetwork network;
 final boolean apiOnly;
 static final Set<String> cancelledTurns=ConcurrentHashMap.newKeySet();
 static String turnKey(JSONObject p){return p.optString("threadId")+":"+p.optString("turnId");}
 static void guardTurn(JSONObject p)throws IOException{if(cancelledTurns.contains(turnKey(p)))throw new IOException("任务已停止，操作已取消");}
 final ConcurrentHashMap<Integer,String> pendingMethods=new ConcurrentHashMap<>();
 volatile long accountRevision;final java.util.concurrent.atomic.AtomicBoolean accountRefreshing=new java.util.concurrent.atomic.AtomicBoolean();volatile long accountRefreshAt;
 KernelHost(Context c){this(c,false);}
 KernelHost(Context c,boolean apiOnly){context=c;this.apiOnly=apiOnly;}
 volatile Runnable eventSignal;
 final Object eventLock=new Object();
 final Map<String,JSONObject> questions=new LinkedHashMap<>();
 String pendingQuestions(){synchronized(eventLock){return new JSONArray(questions.values()).toString();}}
 void trackQuestions(JSONObject row){synchronized(eventLock){String method=row.optString("method");JSONObject p=row.optJSONObject("params");if(method.equals("item/tool/requestUserInput")&&row.has("id"))questions.put(String.valueOf(row.opt("id")),row);if(method.equals("turn/completed")&&p!=null){Iterator<JSONObject> it=questions.values().iterator();while(it.hasNext()){JSONObject q=it.next().optJSONObject("params");if(q!=null&&q.optString("threadId").equals(p.optString("threadId")))it.remove();}}if(method.equals("android/kernelExited")){JSONArray ids=p==null?null:p.optJSONArray("threadIds");if(ids==null)questions.clear();else{Set<String> ended=new HashSet<>();for(int n=0;n<ids.length();n++)ended.add(ids.optString(n));Iterator<JSONObject> it=questions.values().iterator();while(it.hasNext()){JSONObject q=it.next().optJSONObject("params");if(q!=null&&ended.contains(q.optString("threadId")))it.remove();}}}if(method.equals("serverRequest/resolved")&&p!=null)questions.remove(String.valueOf(p.opt("requestId")));}}
 void emit(JSONObject value){McpOAuth.observe(this,value);if(apiOnly){try{if(value.has("id")&&value.has("method"))value.put("id","api:"+new JSONArray().put(value.get("id")).toString());if("serverRequest/resolved".equals(value.optString("method"))&&value.optJSONObject("params")!=null&&value.getJSONObject("params").has("requestId")){JSONObject p=value.getJSONObject("params");p.put("requestId","api:"+new JSONArray().put(p.get("requestId")).toString());}}catch(JSONException ignored){}get(context).emit(value);return;}trackQuestions(value);if(value.has("method")&&value.optJSONObject("params")!=null)ScheduledTaskHost.get(context).observe(value.optString("method"),value.optJSONObject("params"));VoiceAgent.event(context,value);synchronized(eventLock){if(events.size()>=4000){events.clear();try{events.add(new JSONObject().put("method","android/resyncRequired"));}catch(Exception ignored){}}events.add(value);}Runnable listener=eventSignal;if(listener!=null)listener.run();}
 String drain(){synchronized(eventLock){JSONArray rows=new JSONArray();for(int n=0;n<200&&!events.isEmpty();n++)rows.put(events.removeFirst());return rows.toString();}}
 String redact(String text){synchronized(secrets){for(String secret:secrets)if(!secret.isEmpty())text=text.replace(secret,"[REDACTED]");}return text;}
 synchronized void write(JSONObject message)throws Exception{if(input==null)throw new IOException("Codex 内核未启动");input.write(message.toString());input.newLine();input.flush();}
 JSONObject rpc(String method,JSONObject params)throws Exception{KernelTrace.mark("rpc-send:"+method);int id=ids.getAndIncrement();CompletableFuture<JSONObject> future=new CompletableFuture<>();pending.put(id,future);pendingMethods.put(id,method);try{write(new JSONObject().put("id",id).put("method",method).put("params",params));JSONObject reply=future.get(45,TimeUnit.SECONDS);if(reply.has("error"))throw new IOException(redact(reply.getJSONObject("error").optString("message","内核请求失败")));return reply.optJSONObject("result")==null?new JSONObject():reply.getJSONObject("result");}finally{KernelTrace.mark("rpc-return:"+method);pending.remove(id);pendingMethods.remove(id);}}
 void ensureStarted()throws Exception{synchronized(this){if(ready&&process!=null&&process.isAlive())return;
  File root=new File(context.getFilesDir(),"alpine"),binary=new File(root,"root/eva-kernel/bin/codex");if(!binary.isFile())throw new IOException("Codex 内核尚未安装到手机运行环境");
  new File(root,"root/.eva-codex").mkdirs();new File(root,"root/eva-workspace").mkdirs();new File(context.getFilesDir(),"tmp").mkdirs();String lib=context.getApplicationInfo().nativeLibraryDir;
  // Android exposes its native phone/browser tools. Unconfigured ChatGPT cloud apps
  // must not block every turn on remote MCP/plugin discovery (15-30s offline).
  ProcessBuilder pb=new ProcessBuilder(lib+"/liboperit_proot.so","-0","-r",root.getAbsolutePath(),"-b","/dev","-b","/proc","-w","/root/eva-workspace","/root/eva-kernel/bin/codex","app-server","-c","features.apps="+(!apiOnly),"-c","features.plugins=true","-c","features.remote_plugin=true","-c","features.plugin_discovery_prefetch=false","-c","analytics.enabled=false","-c","features.codex_hooks=true","-c","features.default_mode_request_user_input=true","-c","features.multi_agent=true","-c","features.multi_agent_v2=false","-c","features.multi_agent_v2_dynamic_tools=true");
  // Separate API-key authentication from the persisted ChatGPT account. Shared
  // native session storage preserves existing thread IDs and history.
  if(apiOnly)pb.command().addAll(Arrays.asList("-c","cli_auth_credentials_store=\"ephemeral\""));
  else pb.command().addAll(Arrays.asList("-c","model_provider=\"openai\""));
  if(apiOnly&&KernelModelCatalog.prepare(context,root))pb.command().addAll(Arrays.asList("-c","model_catalog_json=\"/root/.eva-codex/android-models.json\""));
  Map<String,String> env=pb.environment();env.put("PROOT_LOADER",lib+"/liboperit_loader.so");env.put("PROOT_TMP_DIR",new File(context.getFilesDir(),"tmp").getAbsolutePath());env.put("HOME","/root");env.put("CODEX_HOME","/root/.eva-codex");env.put("PATH","/root/eva-kernel/bin:/root/eva-kernel/codex-path:/usr/bin:/bin:/usr/sbin:/sbin");
  if(network==null)network=new KernelNetwork();env.put("HTTPS_PROXY",network.proxyUrl);env.put("HTTP_PROXY",network.proxyUrl);env.put("https_proxy",network.proxyUrl);env.put("http_proxy",network.proxyUrl);env.put("NO_PROXY","localhost,127.0.0.1,::1");env.put("no_proxy","localhost,127.0.0.1,::1");
  ModelStore store=new ModelStore(context);JSONObject config=store.read();configStamp=config.getJSONArray("providers").toString();JSONArray providers=config.getJSONArray("providers");synchronized(secrets){secrets.clear();for(int i=0;i<providers.length();i++){JSONObject p=providers.getJSONObject(i);String secret=store.secret(p);secrets.add(secret);env.put(envName(p.getString("id")),secret);}}
  providerConfigCache.invalidate();currentProvider="";threadProviders.clear();threadCwds.clear();final Process child=LinuxRuntime.start(context,pb);process=child;input=new BufferedWriter(new OutputStreamWriter(child.getOutputStream(),"UTF-8"));
  work.execute(()->{try(BufferedReader reader=new BufferedReader(new InputStreamReader(child.getInputStream(),"UTF-8"))){String line;while((line=reader.readLine())!=null){if(process!=child)break;try{JSONObject row=new JSONObject(line);if(!(row.has("id")&&!row.has("method")&&"config/read".equals(pendingMethods.get(row.optInt("id")))))row=new JSONObject(redact(line));GeneratedImages.normalize(context,row);String observedMethod=row.optString("method");if(!observedMethod.isEmpty()){JSONObject observedParams=row.optJSONObject("params"),observedItem=observedParams==null?null:observedParams.optJSONObject("item");KernelTrace.once("event:"+observedMethod+(observedItem==null?"":":"+observedItem.optString("type")));}if(row.has("id")&&!row.has("method")){CompletableFuture<JSONObject> f=pending.get(row.optInt("id"));if(f!=null){if(!row.has("error"))observeAccount(pendingMethods.get(row.optInt("id")),row.optJSONObject("result"));f.complete(row);}}else {observeAccount(row.optString("method"),row.optJSONObject("params"));if("mcpServer/oauthLogin/completed".equals(row.optString("method")))work.execute(()->{try{reloadMcpConnections();}catch(Exception ignored){}});rememberRuntimeThread(row);PhoneTaskReport.event(context,row);if(NetworkTools.handle(this,row)||BrowserTools.handle(this,row)||PhoneTools.handle(this,row))continue;if("turn/started".equals(row.optString("method"))){JSONObject state=row.optJSONObject("params");if(state!=null&&state.optString("threadId").equals(PhoneTools.owner))PhoneTools.turn=state.getJSONObject("turn").getString("id");}if("turn/completed".equals(row.optString("method"))){JSONObject state=row.optJSONObject("params");if(state!=null&&state.optString("threadId").equals(PhoneTools.owner)){PhoneTools.release(state.optString("threadId"));}}if("account/login/completed".equals(row.optString("method"))){JSONObject state=row.optJSONObject("params");if(state!=null){loginSession=null;loginError=state.optBoolean("success")?"":state.optString("error","登录未完成，请重试");LoginService.end(context);}}emit(row);}}catch(JSONException ignored){}}}catch(Exception ignored){}finally{if(process!=child)return;providerConfigCache.invalidate();for(String thread:threadProviders.keySet())PhoneTools.release(thread);PhoneTaskReport.failThreads(context,threadProviders.keySet());for(CompletableFuture<JSONObject> f:pending.values())f.completeExceptionally(new IOException("Codex 内核已停止，请恢复会话"));try{emit(new JSONObject().put("method","android/kernelExited").put("params",new JSONObject().put("threadIds",new JSONArray(threadProviders.keySet()))));}catch(Exception ignored){}}});
  work.execute(()->{try(InputStream err=child.getErrorStream()){byte[] bytes=new byte[4096];while(err.read(bytes)!=-1){/* Do not persist raw provider stderr or credentials. */}}catch(Exception ignored){}});
 }
 // Reader must be able to acquire the event lock during initialization.
 try{rpc("initialize",new JSONObject().put("clientInfo",new JSONObject().put("name","eva_android").put("version","0.0.28")).put("capabilities",new JSONObject().put("experimentalApi",true)));write(new JSONObject().put("method","initialized").put("params",new JSONObject()));JSONObject mcpConfig=rpc("config/read",new JSONObject().put("includeLayers",false)).getJSONObject("config").optJSONObject("mcp_servers");if(mcpConfig!=null)McpSettings.rememberSecrets(this,mcpConfig);ready=true;}catch(Exception error){synchronized(this){ready=false;Process failed=process;process=null;input=null;if(failed!=null)failed.destroy();}throw error;}
 }
 // Child threads belong to the same authenticated runtime as the parent. Persist
 // routing before publishing the event so UI reads cannot start the other runtime.
 void rememberRuntimeThread(JSONObject row){try{
  JSONObject p=row.optJSONObject("params");if(p==null)return;
  JSONObject thread=p.optJSONObject("thread");
  if("thread/started".equals(row.optString("method"))&&thread!=null)rememberThread(thread.optString("id"),thread.optString("modelProvider",currentProvider),thread.optString("cwd","/root/eva-workspace"));
  JSONObject item=p.optJSONObject("item");if(item==null)return;
  String parent=p.optString("threadId"),provider=threadProviders.getOrDefault(parent,currentProvider),cwd=threadCwds.getOrDefault(parent,"/root/eva-workspace");
  if("subAgentActivity".equals(item.optString("type")))rememberThread(item.optString("agentThreadId"),provider,cwd);
  if("collabAgentToolCall".equals(item.optString("type"))){JSONArray ids=item.optJSONArray("receiverThreadIds");if(ids!=null)for(int i=0;i<ids.length();i++)rememberThread(ids.optString(i),provider,cwd);JSONObject states=item.optJSONObject("agentsStates");if(states!=null){Iterator<String> keys=states.keys();while(keys.hasNext())rememberThread(keys.next(),provider,cwd);}}
 }catch(Exception ignored){}}
 void rememberThread(String id,String provider,String cwd){if(id.isEmpty())return;if(!provider.isEmpty())threadProviders.put(id,provider);threadCwds.put(id,cwd);android.content.SharedPreferences routing=context.getSharedPreferences("eva-kernel-routing",0);if(!routing.contains(id)||routing.getBoolean(id,false)!=apiOnly)routing.edit().putBoolean(id,apiOnly).apply();}
 static String envName(String id){return "EVA_PROVIDER_"+id.replace('-','_');}
 JSONObject params(String method,JSONObject p)throws Exception{if(method.equals("turn/start")){PhoneTaskService.restore(context);}if(method.equals("thread/start")||method.equals("thread/resume")){
  ModelStore store=new ModelStore(context);if(!store.read().getJSONArray("providers").toString().equals(configStamp))throw new IOException("提供商配置已变化，请重启 Eva 后使用新配置");JSONArray list=store.read().getJSONArray("providers");JSONObject definitions=new JSONObject();for(int i=0;i<list.length();i++){JSONObject entry=list.getJSONObject(i);definitions.put(entry.getString("id"),new JSONObject().put("name",entry.getString("name")).put("base_url",entry.getString("url")).put("env_key",envName(entry.getString("id"))).put("wire_api","responses").put("requires_openai_auth",false).put("supports_websockets",false));}
  if(method.equals("thread/start"))p.put("dynamicTools",PhoneTools.specs().put(BrowserTools.spec()).put(NetworkTools.spec()));p.put("config",new JSONObject().put("model_providers",definitions));String project=p.optString("androidProject","");p.remove("androidProject");WorkspaceFiles.project(context,project);p.put("cwd","/root/eva-workspace"+(project.isEmpty()?"":"/projects/"+project));OfficeRuntime.deploy(context);if(managedSkillsRevision!=OfficeRuntime.skillsRevision){rpc("skills/list",new JSONObject().put("cwds",new JSONArray().put(p.getString("cwd"))).put("forceReload",true));managedSkillsRevision=OfficeRuntime.skillsRevision;}p.put("developerInstructions",p.optString("developerInstructions","")+"\n"+MemoryStore.instructions()+"\n"+OfficeRuntime.instructions());applyPermissions(p,false);
 }if(method.equals("turn/start"))applyPermissions(p,true);return p;}

 // Canonical desktop permission triples. Never promote a failed review into full access.
 void applyPermissions(JSONObject p,boolean turn)throws Exception{
  String approval=p.optString("approvalPolicy","on-request"),reviewer=p.optString("approvalsReviewer","user");
  boolean full="never".equals(approval)&&"user".equals(reviewer);
  if(!full&&!("on-request".equals(approval)&&("user".equals(reviewer)||"auto_review".equals(reviewer))))throw new IOException("不支持的执行权限组合，请重新选择权限档位");
  String sandbox=full?"danger-full-access":"workspace-write";
  if(!turn&&p.has("sandbox")&&!sandbox.equals(p.getString("sandbox")))throw new IOException("批准方式与访问权限不一致，请重新选择权限档位");
  p.put("approvalPolicy",approval).put("approvalsReviewer",reviewer);
  if(turn){
   String expected=full?"dangerFullAccess":"workspaceWrite";JSONObject supplied=p.optJSONObject("sandboxPolicy");
   if(supplied!=null&&!expected.equals(supplied.optString("type")))throw new IOException("回合访问权限与批准方式不一致");
   JSONObject policy=new JSONObject().put("type",expected);
   if(!full)policy.put("writableRoots",new JSONArray().put(threadCwds.getOrDefault(p.optString("threadId"),"/root/eva-workspace"))).put("networkAccess",false).put("excludeTmpdirEnvVar",false).put("excludeSlashTmp",false);
   p.put("sandboxPolicy",policy);
  }else p.put("sandbox",sandbox);
 }
 static final Object providerDispatch=new Object();
 // One stamp for the shared native config, bound to the process that acknowledged it.
 // A per-host provider cache would be stale after the other auth process writes config.
 static final ProviderConfigCache providerConfigCache=new ProviderConfigCache();
 static final class ProviderConfigCache {
  private Object process;private String selection,fingerprint;
  synchronized boolean matches(Object child,String value,String disk){return child!=null&&child==process&&value.equals(selection)&&disk!=null&&disk.equals(fingerprint);}
  synchronized void accepted(Object child,String value,String disk){process=child;selection=value;fingerprint=disk;}
  synchronized void invalidate(){process=null;selection=null;fingerprint=null;}
 }
 String providerConfigFingerprint(){
  File file=new File(context.getFilesDir(),"alpine/root/.eva-codex/config.toml");
  try{if(!file.isFile()||file.length()>8L*1024*1024)return null;java.security.MessageDigest digest=java.security.MessageDigest.getInstance("SHA-256");
   try(InputStream in=new FileInputStream(file)){byte[] bytes=new byte[8192];int n;long count=0;while((n=in.read(bytes))!=-1){count+=n;if(count>8L*1024*1024)return null;digest.update(bytes,0,n);}}
   return android.util.Base64.encodeToString(digest.digest(),android.util.Base64.NO_WRAP);
  }catch(Exception ignored){return null;}
 }

 final ConcurrentHashMap<String,String> threadProviders=new ConcurrentHashMap<>();
 final ConcurrentHashMap<String,String> threadCwds=new ConcurrentHashMap<>();
 String currentProvider="";long managedSkillsRevision=-1;
 JSONObject providerDefinitions()throws Exception{
  JSONArray list=new ModelStore(context).read().getJSONArray("providers");JSONObject definitions=new JSONObject();
  for(int i=0;i<list.length();i++){JSONObject entry=list.getJSONObject(i);definitions.put(entry.getString("id"),new JSONObject().put("name",entry.getString("name")).put("base_url",entry.getString("url")).put("env_key",envName(entry.getString("id"))).put("wire_api","responses").put("requires_openai_auth",false).put("supports_websockets",false));}
  return definitions;
 }
 void selectKernelProvider(String provider)throws Exception{
  // Reuse only a successful write from this exact live process and unchanged disk bytes.
  JSONObject definitions=providerDefinitions();if(!provider.equals("openai")&&!definitions.has(provider))throw new IOException("会话提供商已删除，请重新配置");
  String selection=provider+"\n"+definitions.toString();Object child=process;
  if(providerConfigCache.matches(child,selection,providerConfigFingerprint())){KernelTrace.mark("provider-config:reused");currentProvider=provider;return;}
  providerConfigCache.invalidate();
  JSONArray edits=new JSONArray().put(new JSONObject().put("keyPath","model_providers").put("value",definitions).put("mergeStrategy","replace")).put(new JSONObject().put("keyPath","model_provider").put("value",provider).put("mergeStrategy","replace"));
  rpc("config/batchWrite",new JSONObject().put("edits",edits));currentProvider=provider;if(process==child)providerConfigCache.accepted(child,selection,providerConfigFingerprint());KernelTrace.mark("provider-config:written");
 }
 JSONObject providerRequest(String method,JSONObject prepared,String provider)throws Exception{
  if(method.equals("thread/resume")){
   JSONObject projection=ProviderHistoryProjection.project(context,prepared.getString("threadId"),provider,false);
   if(projection.optBoolean("needed"))return projectedProviderFork(prepared,provider,projection);
  }
  return ProviderSwitch.execute(method,prepared,provider,(name,params)->{
   if(name.equals("thread/fork")){
    JSONObject projection=ProviderHistoryProjection.project(context,params.getString("threadId"),provider,true);
    if(projection.optBoolean("needed")){JSONObject copy=new JSONObject(params.toString()).put("path",projection.getString("path")).put("excludeTurns",true);return rpc(name,copy);}
   }
   return rpc(name,params);
  });
 }
 JSONObject projectedProviderFork(JSONObject prepared,String provider,JSONObject projection)throws Exception{
  JSONObject result=ProviderSwitch.forkProvider(new JSONObject(prepared.toString()).put("path",projection.getString("path")).put("excludeTurns",true),provider,this::rpc);
  result.put("androidContextProjection",new JSONObject().put("preservedOriginal",true).put("removedProviderPrivateReasoning",projection.optInt("removedReasoningItems")+projection.optInt("removedCheckpointReasoningItems")).put("auditPath",projection.getString("auditPath")));
  KernelTrace.mark("provider-history:projected");return result;
 }
 JSONObject dispatch(String method,JSONObject request)throws Exception{
  if(method.equals("android/threadRecovery"))return ThreadRecovery.read(context,request);
  if(method.equals("android/threadActivity"))return ThreadActivitySummary.read(request,this::rpc);
  if(method.equals("android/extensions"))return ExtensionAuthoring.call(this,request);
  if(method.startsWith("android/memories/"))return MemoryStore.execute(context,method.substring("android/memories/".length()),request);
  if(method.equals("android/hooks"))return HookStore.call(this,request);
  if(method.equals("android/mcp"))return McpSettings.call(this,request);
  if(method.equals("config/batchWrite")){JSONArray edits=request.getJSONArray("edits");if(edits.length()>100)throw new IOException("修改数量过多");for(int n=0;n<edits.length();n++){JSONObject edit=edits.getJSONObject(n);String key=edit.getString("keyPath");boolean enabled=key.endsWith(".enabled"),trusted=key.endsWith(".trusted_hash");if(!key.startsWith("hooks.state.\"")||(!enabled&&!trusted))throw new IOException("仅允许修改钩子状态");String id=key.substring(12,key.length()-(enabled?8:13));if(!(new JSONArray("["+id+"]").get(0) instanceof String))throw new IOException("钩子编号无效");if(enabled&&!(edit.get("value") instanceof Boolean)||trusted&&!(edit.get("value") instanceof String))throw new IOException("钩子状态值无效");}request.remove("filePath");request.put("reloadUserConfig",true);}
  if(method.equals("config/value/write")){String key=request.getString("keyPath");if(!key.startsWith("plugins.\"")||!key.endsWith("\".enabled")||!(request.get("value") instanceof Boolean))throw new IOException("仅允许修改插件启用状态");String id=key.substring(8,key.length()-8);Object parsed=new JSONArray("["+id+"]").get(0);if(!(parsed instanceof String))throw new IOException("插件编号无效");}
  if(method.equals("skills/list")||method.equals("skills/config/write")){JSONObject result=rpc(method,params(method,request));KernelHost other=apiOnly?instance:apiInstance;if(method.equals("skills/config/write")&&other!=null&&other.ready){try{other.rpc(method,params(method,request));}catch(Exception e){result.put("androidWarning","另一模型进程未刷新，请停止任务后重新打开应用");}}return result;}
  if(method.equals("turn/interrupt")){
   cancelledTurns.add(turnKey(request));
   if(request.optString("threadId").equals(PhoneTools.owner)){PhoneAccessibility.generation++;PhoneShell.cancel();}
   BrowserTools.cancelTurn(turnKey(request));
  }
  if(!method.equals("thread/start")&&!method.equals("thread/resume")&&!method.equals("turn/start"))return rpc(method,params(method,request));
  synchronized(providerDispatch){
   String provider=request.optString("modelProvider","openai");
   if(method.equals("turn/start")){provider=threadProviders.get(request.getString("threadId"));if(provider==null)throw new IOException("请重新打开会话后发送，提供商状态尚未恢复");}
   if(!new ModelStore(context).read().getJSONArray("providers").toString().equals(configStamp))throw new IOException("提供商配置已变化，请重启 Eva 后使用新配置");
   if(method.equals("thread/resume")){
    String id=request.getString("threadId");KernelHost previous=forThread(context,id);String oldProvider=previous.threadProviders.get(id);
    // Release the old subscription before resuming with another provider. Loaded
    // subscribed threads otherwise ignore provider overrides in the core.
    if(previous.ready&&(previous!=this||(oldProvider!=null&&!provider.equals(oldProvider)))){
     previous.rpc("thread/unsubscribe",new JSONObject().put("threadId",id));
     previous.threadProviders.remove(id);previous.threadCwds.remove(id);
    }
   }
   selectKernelProvider(provider);
   JSONObject prepared=params(method,new JSONObject(request.toString())),result=providerRequest(method,prepared,provider);
   if(!method.equals("turn/start")){JSONObject thread=result.getJSONObject("thread");threadProviders.put(thread.getString("id"),result.optString("modelProvider",provider));threadCwds.put(thread.getString("id"),thread.optString("cwd",request.optString("cwd","/root/eva-workspace")));context.getSharedPreferences("eva-kernel-routing",0).edit().putBoolean(thread.getString("id"),apiOnly).commit();}
   return result;
  }
 }
 void reloadMcpConnections()throws Exception{rpc("config/mcpServer/reload",new JSONObject());KernelHost other=apiOnly?instance:apiInstance;if(other!=null&&other.ready){JSONObject servers=other.rpc("config/read",new JSONObject().put("includeLayers",false)).getJSONObject("config").optJSONObject("mcp_servers");if(servers!=null)McpSettings.rememberSecrets(other,servers);other.rpc("config/mcpServer/reload",new JSONObject());}}
 void warm(){if(!apiOnly){try{JSONObject config=new ModelStore(context).read();if(!context.getSharedPreferences("eva-account",0).getBoolean("preferred",false)&&!config.optString("active").isEmpty()){api(context).warm();return;}}catch(Exception ignored){}}work.execute(()->{try{synchronized(startup){ensureStarted();}}catch(Exception ignored){/* Actual send reports startup failure without sending or retrying a task. */}});}
 final Object startup=new Object();
 void observeAccount(String method,JSONObject value){
  if(apiOnly||method==null||value==null)return;
  if(method.equals("account/login/start")){loginSession=value;loginError="";}
  if(method.equals("account/login/cancel")||method.equals("account/logout"))loginSession=null;if(method.equals("account/logout"))providerConfigCache.invalidate();
  if(AccountState.apply(context.getSharedPreferences("eva-account",0),method,value,false)){
   accountRevision++;try{emit(new JSONObject().put("method","android/accountChanged"));}catch(JSONException ignored){}
  }
  if(method.equals("account/read")&&value.optJSONObject("account")!=null){loginSession=null;loginError="";}
 }
 void refreshAccount(){
  if(apiOnly||!context.getSharedPreferences("eva-account",0).getBoolean("loggedIn",false))return;
  long now=android.os.SystemClock.elapsedRealtime();if(now-accountRefreshAt<30000||!accountRefreshing.compareAndSet(false,true))return;
  accountRefreshAt=now;work.execute(()->{try{nativeRequest("account/read",new JSONObject().put("refreshToken",false));}catch(Exception ignored){/* A transport error is not a logout. Managed OAuth refresh stays inside Codex. */}finally{accountRefreshing.set(false);}});
 }
 volatile JSONObject loginSession;volatile String loginError="";
 JSONObject nativeRequest(String method,JSONObject params)throws Exception{
  synchronized(startup){ensureStarted();}
  JSONObject result=rpc(method,params);
  return result;
 }
 void call(String ticket,String method,String json){if(method.equals("android/threadRecovery")){work.execute(()->{try{emit(new JSONObject().put("ticket",ticket).put("result",ThreadRecovery.read(context,new JSONObject(json))));}catch(Exception error){try{emit(new JSONObject().put("ticket",ticket).put("error",error instanceof IOException?error.getMessage():"本地会话状态读取失败"));}catch(Exception ignored){}}});return;}if(!apiOnly){try{JSONObject request=new JSONObject(json);boolean useApi=(method.equals("thread/start")||method.equals("thread/resume"))?!request.optString("modelProvider","openai").equals("openai"):request.has("threadId")&&forThread(context,request.getString("threadId")).apiOnly;if(useApi){api(context).call(ticket,method,json);return;}}catch(JSONException ignored){}}KernelTrace.mark("bridge:"+method);work.execute(()->{try{if(!Arrays.asList("account/read","account/rateLimits/read","account/login/start","account/login/cancel","account/logout","model/list","thread/start","thread/resume","thread/read","thread/compact/start","thread/turns/list","thread/items/list","android/threadActivity","thread/archive","thread/list","turn/start","turn/interrupt","turn/steer","skills/list","skills/config/write","android/mcp","android/hooks","plugin/installed","plugin/list","plugin/read","plugin/skill/read","app/list","android/extensions","plugin/install","plugin/uninstall","marketplace/add","marketplace/upgrade","config/value/write","config/batchWrite","hooks/list","android/memories/list","android/memories/read","android/memories/create","android/memories/save","android/memories/delete").contains(method))throw new IOException("不支持的内核请求");synchronized(startup){try{ensureStarted();}catch(Exception startError){synchronized(this){ready=false;if(process!=null)process.destroy();input=null;}throw startError;}}JSONObject result=dispatch(method,new JSONObject(json));emit(new JSONObject().put("ticket",ticket).put("result",result));}catch(Exception e){try{emit(new JSONObject().put("ticket",ticket).put("error",redact(e instanceof IOException?e.getMessage():"内核请求失败或超时；请恢复会话后检查，勿重复提交")));}catch(Exception ignored){}}});}
 void respond(String idJson,String resultJson){try{synchronized(eventLock){questions.remove(String.valueOf(new JSONArray("["+idJson+"]").get(0)));}}catch(Exception ignored){}if(!apiOnly){try{Object id=new JSONArray("["+idJson+"]").get(0);if(id instanceof String&&((String)id).startsWith("api:")){String encoded=((String)id).substring(4);api(context).respond(encoded.substring(1,encoded.length()-1),resultJson);return;}}catch(Exception ignored){}}work.execute(()->{try{Object id=new JSONArray("["+idJson+"]").get(0);JSONObject result=new JSONObject(resultJson);write(new JSONObject().put("id",id).put(result.has("error")?"error":"result",result.has("error")?result.get("error"):result));}catch(Exception ignored){}});}
}
