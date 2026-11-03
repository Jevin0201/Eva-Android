package ai.eva.android.probe;
import android.content.Context;import org.json.*;import java.io.*;

/** Android port of Eva 0.2.0 main/model-catalog.js. Uses this installation's native cache. */
final class KernelModelCatalog {
 static String read(InputStream in)throws IOException{try(InputStream stream=in;ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] b=new byte[8192];int n;while((n=stream.read(b))!=-1)out.write(b,0,n);return out.toString("UTF-8");}}
 static synchronized boolean prepare(Context context,File root)throws Exception{
  JSONArray providers=new ModelStore(context).read().getJSONArray("providers");boolean enabled=false;
  for(int i=0;i<providers.length();i++){JSONObject p=providers.getJSONObject(i);if("api.deepseek.com".equals(new java.net.URI(p.getString("url")).getHost())&&"deepseek-flash".equals(p.optString("model")))enabled=true;}
  if(!enabled)return false;
  File cache=new File(root,"root/.eva-codex/models_cache.json");
  if(!cache.isFile())throw new IOException("DeepSeek 缺少原生模型目录，请先刷新模型目录");
  JSONArray nativeModels=new JSONObject(read(new FileInputStream(cache))).getJSONArray("models");
  JSONArray custom=new JSONObject(read(context.getAssets().open("deepseek-catalog.json"))).getJSONArray("models");
  JSONObject reference=null;
  for(int i=0;i<nativeModels.length();i++){JSONObject m=nativeModels.getJSONObject(i);JSONObject messages=m.optJSONObject("model_messages");if(messages==null||messages.optString("instructions_template").isEmpty())continue;if("gpt-5.6-sol".equals(m.optString("slug"))){reference=m;break;}if(reference==null&&"unified_exec".equals(m.optString("shell_type")))reference=m;}
  if(reference==null)throw new IOException("原生模型目录缺少代理提示词模板，请刷新模型目录");
  JSONArray result=new JSONArray();
  for(int i=0;i<nativeModels.length();i++){JSONObject m=nativeModels.getJSONObject(i);boolean replaced=false;for(int j=0;j<custom.length();j++)if(m.getString("slug").equals(custom.getJSONObject(j).getString("slug")))replaced=true;if(!replaced)result.put(m);}
  for(int i=0;i<custom.length();i++){
   JSONObject m=custom.getJSONObject(i);for(String key:new String[]{"model_messages","shell_type","apply_patch_tool_type","include_skills_usage_instructions","include_plugin_usage_instructions","include_apps_usage_instructions","multi_agent_version","node_repl_disabled"}){if(reference.has(key))m.put(key,reference.get(key));else m.remove(key);}
   JSONObject messages=new JSONObject(m.getJSONObject("model_messages").toString());messages.put("instructions_template",messages.getString("instructions_template").replaceFirst("^You are Codex, an agent based on [^.]+\\.","You are Eva, a coding agent using the configured third-party model."));m.put("model_messages",messages);
   // V2 direct collaboration messages require encrypted_function_args metadata.
   // DeepSeek emits ordinary function arguments; V1 delivers the actual task as user input.
   m.put("multi_agent_version","v1").put("auto_review_model_override",m.getString("slug"));
   m.remove("base_instructions");m.put("tool_mode","direct").put("experimental_supported_tools",new JSONArray()).put("supports_parallel_tool_calls",false).put("input_modalities",new JSONArray().put("text")).put("supports_image_detail_original",false);result.put(m);
  }
  File target=new File(root,"root/.eva-codex/android-models.json"),tmp=new File(target.getPath()+".tmp");
  try(FileOutputStream out=new FileOutputStream(tmp)){out.write(new JSONObject().put("models",result).toString().getBytes("UTF-8"));out.getFD().sync();}
  if(!tmp.renameTo(target))throw new IOException("无法保存 Android 模型目录");return true;
 }
}
