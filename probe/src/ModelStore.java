package ai.eva.android.probe;
import android.content.*;import android.security.keystore.*;import android.util.Base64;import org.json.*;import java.net.*;import java.io.*;import java.security.*;import javax.crypto.*;import javax.crypto.spec.GCMParameterSpec;

/** Provider metadata and Keystore-encrypted credentials. Never exposes keys to WebView. */
public final class ModelStore {
 final Context context;static final Object LOCK=new Object();
 ModelStore(Context c){context=c.getApplicationContext();}
 android.content.SharedPreferences prefs(){return context.getSharedPreferences("eva-providers",0);}
 JSONObject read()throws Exception{synchronized(LOCK){
  JSONObject config=new JSONObject(prefs().getString("config","{\"providers\":[],\"active\":\"\"}"));
  boolean changed=false;
  JSONArray localProviders=config.getJSONArray("providers");
  for(int i=0;i<localProviders.length();i++){
   JSONObject provider=localProviders.getJSONObject(i);
   if(DshAvailability.managed(provider)&&!"DSH插件".equals(provider.optString("name"))){provider.put("name","DSH插件");changed=true;}
   if(LocalFreeModels.URL.equals(provider.optString("url"))&&!provider.has("localProtocolRevision")){
    provider.put("protocol","chat_completions").put("localProtocolRevision",1);changed=true;
   }
  }
  if(!config.has("defaultSelection")){
   android.content.SharedPreferences account=context.getSharedPreferences("eva-account",0);
   JSONObject selection=new JSONObject().put("providerId","").put("model","");
   if(account.getBoolean("preferred",false))selection.put("providerId","openai").put("model",account.getString("model","")).put("effort",account.getString("effort","")).put("serviceTier",account.getString("serviceTier",""));
   else{JSONArray providers=config.getJSONArray("providers");for(int i=0;i<providers.length();i++){JSONObject provider=providers.getJSONObject(i);if(provider.optString("id").equals(config.optString("active")))selection.put("providerId",provider.getString("id")).put("model",provider.optString("model"));}}
   config.put("defaultSelection",selection);changed=true;
  }
  if(changed)write(config);
  return config;
 }}
 void write(JSONObject config)throws IOException{if(!prefs().edit().putString("config",config.toString()).commit())throw new IOException("模型配置保存失败");}
 JSONObject provider(String id)throws Exception{JSONArray a=read().getJSONArray("providers");for(int i=0;i<a.length();i++)if(a.getJSONObject(i).getString("id").equals(id))return a.getJSONObject(i);throw new IOException("提供商不存在，请重新选择");}
 String runtimeStamp()throws Exception{
  JSONArray providers=read().getJSONArray("providers"),bindings=new JSONArray();
  for(int i=0;i<providers.length();i++){JSONObject p=providers.getJSONObject(i);bindings.put(new JSONObject().put("id",p.getString("id")).put("url",p.getString("url")).put("secret",p.getString("secret")).put("protocol",p.optString("protocol","responses")));}
  return bindings.toString();
 }
 static String connectionRevision(JSONObject provider)throws Exception{
  String binding=provider.optString("url")+"\n"+provider.optString("protocol","responses")+"\n"+provider.optString("secret");
  byte[] digest=java.security.MessageDigest.getInstance("SHA-256").digest(binding.getBytes("UTF-8"));
  StringBuilder hex=new StringBuilder();
  for(byte value:digest)hex.append(String.format(java.util.Locale.ROOT,"%02x",value&255));
  return hex.toString();
 }
 JSONObject publicConfig()throws Exception{JSONObject config=read();JSONArray a=config.getJSONArray("providers");for(int i=0;i<a.length();i++){JSONObject p=a.getJSONObject(i);p.put("protocol",p.optString("protocol","responses"));if(!p.has("modelPreferences"))p.put("modelPreferences",new JSONObject());p.put("hasKey",!p.optString("secret").isEmpty());p.put("connectionRevision",connectionRevision(p));p.remove("secret");ModelCapabilities.enrich(p,new JSONObject(KernelModelCatalog.read(context.getAssets().open("deepseek-catalog.json"))).getJSONArray("models"));DshAvailability.decorate(p,System.currentTimeMillis());}android.content.SharedPreferences account=context.getSharedPreferences("eva-account",0);config.put("account",new JSONObject().put("modelPreferences",config.optJSONObject("accountModelPreferences")==null?new JSONObject():config.getJSONObject("accountModelPreferences")).put("loggedIn",account.getBoolean("loggedIn",false)).put("preferred",account.getBoolean("preferred",false)).put("model",account.getString("model","")).put("effort",account.getString("effort","")).put("serviceTier",account.getString("serviceTier","")));return config;}
 static String baseUrl(String input)throws Exception{String value=input.trim();if(value.length()>2048)throw new IOException("服务地址过长");URI uri=new URI(value);boolean loopback="127.0.0.1".equals(uri.getHost())||"[::1]".equals(uri.getHost())||"::1".equals(uri.getHost());if((!"https".equals(uri.getScheme())&&!("http".equals(uri.getScheme())&&loopback))||uri.getHost()==null||uri.getUserInfo()!=null||uri.getQuery()!=null||uri.getFragment()!=null)throw new IOException("请输入 HTTPS API 地址；本机回环服务支持 HTTP，地址不能包含账号、查询参数或片段");while(value.endsWith("/"))value=value.substring(0,value.length()-1);if(value.endsWith("/responses")||value.endsWith("/models")||value.endsWith("/chat/completions"))throw new IOException("请填写 API 基础地址，例如 https://服务域名/v1");return value;}
 static String field(String s,String label,int max)throws IOException{s=s.trim();if(s.isEmpty()||s.length()>max||s.indexOf('\n')>=0||s.indexOf('\r')>=0||s.indexOf(0)>=0)throw new IOException(label+"为空、过长或包含换行");return s;}
 javax.crypto.SecretKey key()throws Exception{KeyStore ks=KeyStore.getInstance("AndroidKeyStore");ks.load(null);String alias="eva-provider-credentials-v1";if(!ks.containsAlias(alias)){KeyGenerator g=KeyGenerator.getInstance("AES","AndroidKeyStore");g.init(new KeyGenParameterSpec.Builder(alias,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());g.generateKey();}return (javax.crypto.SecretKey)ks.getKey(alias,null);}
 String encrypt(String value)throws Exception{Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.ENCRYPT_MODE,key());return Base64.encodeToString(c.getIV(),Base64.NO_WRAP)+":"+Base64.encodeToString(c.doFinal(value.getBytes("UTF-8")),Base64.NO_WRAP);}
 String secret(JSONObject p)throws Exception{String[] parts=p.getString("secret").split(":",2);Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(parts[0],Base64.NO_WRAP)));return new String(c.doFinal(Base64.decode(parts[1],Base64.NO_WRAP)),"UTF-8");}
 String save(String id,String name,String url,String model,String secret)throws Exception{return save(id,name,url,model,secret,null);}
 String save(String id,String name,String url,String model,String secret,String requestedProtocol)throws Exception{synchronized(LOCK){JSONObject config=read();JSONArray a=config.getJSONArray("providers");JSONObject prior=null;for(int i=0;i<a.length();i++)if(a.getJSONObject(i).getString("id").equals(id))prior=a.getJSONObject(i);if(prior==null){if(a.length()>=20)throw new IOException("最多保存 20 个提供商");id=java.util.UUID.randomUUID().toString();}
  String normalizedUrl=baseUrl(url);
  boolean local=LocalFreeModels.URL.equals(normalizedUrl);
  String defaultProtocol=local&&(prior==null||!normalizedUrl.equals(prior.optString("url")))?"chat_completions":prior==null?"responses":prior.optString("protocol","responses");
  String protocol=requestedProtocol==null?defaultProtocol:requestedProtocol;
  if(!protocol.equals("responses")&&!protocol.equals("chat_completions"))throw new IOException("不支持的模型协议");
  JSONObject p=new JSONObject().put("protocol",protocol).put("modelPreferences",prior==null?new JSONObject():prior.optJSONObject("modelPreferences")==null?new JSONObject():prior.getJSONObject("modelPreferences")).put("id",id).put("name",field(name,"名称",80)).put("url",normalizedUrl).put("model",(model.trim().isEmpty()?"":field(model,"模型 ID",200)));
  if(local)p.put("localProtocolRevision",1);
  if(secret.trim().isEmpty()){if(prior==null||!prior.optString("url").equals(p.getString("url")))throw new IOException("新增或更换服务地址时，请填写 API Key");p.put("secret",prior.getString("secret"));}else p.put("secret",encrypt(field(secret,"API Key",8192)));
  if(prior!=null&&prior.has("manualModels"))p.put("manualModels",prior.getJSONArray("manualModels"));
  if(prior!=null&&prior.optString("url").equals(p.getString("url"))&&prior.optString("secret").equals(p.optString("secret"))&&prior.optString("protocol","responses").equals(protocol)&&prior.has("models")){p.put("models",prior.getJSONArray("models"));if(prior.has("catalogMetadataVersion"))p.put("catalogMetadataVersion",prior.getInt("catalogMetadataVersion"));for(String key:new String[]{"modelAvailability","availabilityCheckedAt"})if(prior.has(key))p.put(key,prior.get(key));}
  boolean replaced=false;for(int i=0;i<a.length();i++)if(a.getJSONObject(i).getString("id").equals(id)){a.put(i,p);replaced=true;}if(!replaced)a.put(p);if(config.optString("active").isEmpty())config.put("active",id);if(!prefs().edit().putString("config",config.toString()).commit())throw new IOException("保存失败");return id;}}
 static JSONArray modelCatalog(JSONArray rows)throws Exception{
  JSONArray models=new JSONArray();java.util.HashSet<String> seen=new java.util.HashSet<>();
  for(int i=0;i<rows.length()&&models.length()<500;i++){
   JSONObject row=rows.optJSONObject(i);if(row==null||!(row.opt("id") instanceof String))continue;
   String id=row.getString("id").trim();if(id.isEmpty()||id.length()>200||id.contains("\n")||id.contains("\r")||!seen.add(id))continue;
   String name=row.optString("name",row.optString("display_name",id));if(name.isEmpty()||name.length()>200)name=id;
   JSONObject model=new JSONObject().put("id",id).put("name",name);
   for(String capability:new String[]{"supportsVision","supportsTools"})if(row.opt(capability) instanceof Boolean)model.put(capability,row.getBoolean(capability));
   JSONArray efforts=row.optJSONArray("reasoningEfforts");if(efforts==null)efforts=row.optJSONArray("x_ofm_efforts");
   if(efforts!=null){JSONArray options=effortOptions(efforts);model.put("reasoningEfforts",options);Object declaredDefault=row.opt("defaultReasoningEffort");if(!(declaredDefault instanceof String))declaredDefault=row.opt("x_ofm_effort_default");if(declaredDefault instanceof String)for(int n=0;n<options.length();n++)if(options.getString(n).equals(declaredDefault))model.put("defaultReasoningEffort",declaredDefault);}
   models.put(model);
  }return models;
 }
 void cacheModels(String id,JSONArray rows)throws Exception{cacheModels(id,provider(id),rows);}
 void cacheModels(String id,JSONObject expected,JSONArray rows)throws Exception{synchronized(LOCK){
  JSONObject config=read();JSONArray list=config.getJSONArray("providers");
  for(int i=0;i<list.length();i++){JSONObject p=list.getJSONObject(i);if(!id.equals(p.optString("id")))continue;
   if(!p.optString("url").equals(expected.optString("url"))||!p.optString("secret").equals(expected.optString("secret"))||!p.optString("protocol","responses").equals(expected.optString("protocol","responses")))throw new IOException("提供商已更改，请重新获取模型列表");
   JSONArray catalog=ModelCapabilities.retain(p.optJSONArray("models"),modelCatalog(rows));if(catalog.length()==0&&!DshAvailability.managed(p))throw new IOException("服务未返回有效模型，已保留原模型列表");JSONArray manual=p.optJSONArray("manualModels");if(manual!=null){java.util.HashSet<String> included=new java.util.HashSet<>();for(int n=0;n<catalog.length();n++)included.add(catalog.getJSONObject(n).getString("id"));for(int n=0;n<manual.length();n++){JSONObject item=manual.getJSONObject(n);if(included.add(item.getString("id")))catalog.put(item);}}
   p.put("models",catalog).put("catalogMetadataVersion",2);if(!prefs().edit().putString("config",config.toString()).commit())throw new IOException("模型列表保存失败");return;
  }throw new IOException("提供商已删除，模型列表未保存");
 }}
 void dshResult(String id,JSONObject expected,String model,boolean ok,long checkedAt,String reason)throws Exception{synchronized(LOCK){JSONObject config=read();JSONArray rows=config.getJSONArray("providers");for(int n=0;n<rows.length();n++){JSONObject p=rows.getJSONObject(n);if(!id.equals(p.optString("id")))continue;if(!connectionRevision(p).equals(connectionRevision(expected)))return;JSONObject all=p.optJSONObject("modelAvailability");if(all==null)all=new JSONObject();all.put(model,new JSONObject().put("state",ok?"available":"unavailable").put("checkedAt",checkedAt).put("reason",reason));p.put("modelAvailability",all).put("availabilityCheckedAt",checkedAt);write(config);return;}}}
 static boolean needsLocalCatalogRefresh(JSONObject provider){
  return LocalFreeModels.URL.equals(provider.optString("url"))&&provider.optInt("catalogMetadataVersion",0)<2;
 }
 static JSONArray effortOptions(JSONArray values)throws Exception{
  JSONArray result=new JSONArray();java.util.HashSet<String> seen=new java.util.HashSet<>();
  for(int i=0;i<values.length()&&result.length()<20;i++){Object value=values.get(i);String id=value instanceof String?(String)value:value instanceof JSONObject?((JSONObject)value).optString("id"):"";if(!id.trim().isEmpty()&&id.length()<=40&&seen.add(id))result.put(field(id,"推理档位",40));}return result;
 }
 static JSONObject mergeModelPreference(JSONObject existing, JSONObject patch)throws Exception {
  JSONObject value=existing==null?new JSONObject():new JSONObject(existing.toString());
  java.util.Iterator<String> keys=patch.keys();
  while(keys.hasNext()) {
   String key=keys.next();
   if(key.equals("visible")) {
    if(!(patch.get(key) instanceof Boolean))throw new IOException("模型显示状态无效");
    value.put(key,patch.getBoolean(key));
   } else if(key.equals("name"))value.put(key,field(patch.getString(key),"模型名称",200));
   else if(key.equals("reasoningEfforts"))value.put(key,effortOptions(patch.getJSONArray(key)));
   else throw new IOException("未知模型偏好");
  }
  return value;
 }
 void modelPreference(String providerId,String modelId,JSONObject patch)throws Exception {
  synchronized(LOCK) {
   field(modelId,"模型 ID",200);
   JSONObject config=read();
   if(providerId.equals("openai")) {
    JSONObject preferences=config.optJSONObject("accountModelPreferences");
    if(preferences==null)preferences=new JSONObject();
    preferences.put(modelId,mergeModelPreference(preferences.optJSONObject(modelId),patch));
    config.put("accountModelPreferences",preferences);
    write(config);
    return;
   }
   JSONArray providers=config.getJSONArray("providers");
   for(int i=0;i<providers.length();i++) {
    JSONObject provider=providers.getJSONObject(i);
    if(!providerId.equals(provider.optString("id")))continue;
    JSONObject preferences=provider.optJSONObject("modelPreferences");
    if(preferences==null)preferences=new JSONObject();
    preferences.put(modelId,mergeModelPreference(preferences.optJSONObject(modelId),patch));
    provider.put("modelPreferences",preferences);
    write(config);
    return;
   }
   throw new IOException("提供商不存在");
  }
 }
 void addModel(String providerId,String modelId,String name)throws Exception{synchronized(LOCK){
  modelId=field(modelId,"模型 ID",200);name=field(name,"模型名称",200);JSONObject config=read();JSONArray providers=config.getJSONArray("providers");
  for(int i=0;i<providers.length();i++){JSONObject p=providers.getJSONObject(i);if(!providerId.equals(p.optString("id")))continue;JSONArray models=p.optJSONArray("models");if(models==null)models=new JSONArray();boolean exists=false;for(int n=0;n<models.length();n++)if(modelId.equals(models.getJSONObject(n).optString("id")))exists=true;if(!exists)models.put(new JSONObject().put("id",modelId).put("name",name));JSONArray manual=p.optJSONArray("manualModels");if(manual==null)manual=new JSONArray();boolean known=false;for(int n=0;n<manual.length();n++)if(modelId.equals(manual.getJSONObject(n).optString("id")))known=true;if(!known)manual.put(new JSONObject().put("id",modelId).put("name",name));p.put("manualModels",manual).put("models",models);write(config);modelPreference(providerId,modelId,new JSONObject().put("name",name));return;}throw new IOException("提供商不存在");
 }}
 static void validateDshChoice(Context c,String providerId,String model)throws Exception{JSONArray providers=new ModelStore(c).read().getJSONArray("providers");for(int i=0;i<providers.length();i++){JSONObject p=providers.getJSONObject(i);if(providerId.equals(p.optString("id"))&&DshAvailability.managed(p)&&!DshAvailability.available(p,model,System.currentTimeMillis()))throw new IOException("此 DSH插件模型未通过近期连通测试，请重新检测或选择其他模型");}}
 void setDefaultSelection(String providerId,String model,String effort,String tier)throws Exception{synchronized(LOCK){
  model=field(model,"模型 ID",200);validateDshChoice(context,providerId,model);if(!providerId.equals("openai"))provider(providerId);
  if(effort.length()>40||tier.length()>80)throw new IOException("模型选项过长");
  JSONObject config=read();JSONObject selection=new JSONObject().put("providerId",providerId).put("model",model);
  if(!effort.isEmpty())selection.put("effort",effort);if(!tier.isEmpty())selection.put("serviceTier",tier);
  config.put("defaultSelection",selection);if(!providerId.equals("openai"))config.put("active",providerId);write(config);
  // Compatibility mirrors are not read to resolve the default after migration.
  android.content.SharedPreferences.Editor account=context.getSharedPreferences("eva-account",0).edit().putBoolean("preferred",providerId.equals("openai"));
  if(providerId.equals("openai"))account.putString("model",model).putString("effort",effort).putString("serviceTier",tier);account.commit();
 }}
 void select(String id)throws Exception{setDefaultSelection(id,provider(id).optString("model"),"","");}
 void delete(String id)throws Exception{synchronized(LOCK){JSONObject c=read();JSONArray old=c.getJSONArray("providers"),next=new JSONArray();for(int i=0;i<old.length();i++)if(!old.getJSONObject(i).getString("id").equals(id))next.put(old.get(i));c.put("providers",next);if(c.optString("active").equals(id))c.put("active","");if(c.getJSONObject("defaultSelection").optString("providerId").equals(id))c.put("defaultSelection",new JSONObject().put("providerId","").put("model",""));write(c);}}
}
