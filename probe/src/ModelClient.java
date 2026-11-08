package ai.eva.android.probe;
import android.content.*;import org.json.*;import java.io.*;import java.net.*;import java.util.concurrent.*;

/** Text Responses client. No hidden retry, redirects or automatic tool execution. */
public final class ModelClient {
 static final ConcurrentHashMap<String,Job> jobs=new ConcurrentHashMap<>();static final ExecutorService workers=Executors.newFixedThreadPool(2);
 static class Job{volatile boolean cancelled;volatile HttpURLConnection connection;}
 static JSONObject request(JSONObject provider,String key,String resource,JSONObject body,Job job)throws Exception{
  return exchange((HttpURLConnection)new URL(provider.getString("url")+"/"+resource).openConnection(),key,body,job);
 }
 static JSONObject exchange(HttpURLConnection c,String key,JSONObject body,Job job)throws Exception{return exchange(c,key,body,job,20000,120000);}
 static JSONObject exchange(HttpURLConnection c,String key,JSONObject body,Job job,int connectMs,int readMs)throws Exception{job.connection=c;
  try{if(job.cancelled)throw new IOException("请求已取消");c.setInstanceFollowRedirects(false);c.setConnectTimeout(connectMs);c.setReadTimeout(readMs);c.setRequestMethod(body==null?"GET":"POST");c.setRequestProperty("Authorization","Bearer "+key);c.setRequestProperty("Content-Type","application/json");c.setRequestProperty("Accept","application/json");
   if(body!=null){byte[] bytes=body.toString().getBytes("UTF-8");c.setDoOutput(true);c.setFixedLengthStreamingMode(bytes.length);try(OutputStream out=c.getOutputStream()){out.write(bytes);}}
   int status=c.getResponseCode();if(status<200||status>=300)throw new IOException("HTTP "+status+"："+(status==401||status==403?"认证失败，请检查 API Key 与权限":status==429?"请求过多或额度不足，请稍后检查":status>=300&&status<400?"服务发生重定向，已停止以保护凭据":"请求失败，请检查地址、模型与 Responses 支持"));
   ByteArrayOutputStream bytes=new ByteArrayOutputStream();try(InputStream in=c.getInputStream()){byte[] buffer=new byte[8192];int n;while((n=in.read(buffer))!=-1){if(job.cancelled)throw new IOException("请求已取消");if(bytes.size()+n>2*1024*1024)throw new IOException("响应超过 2 MB，请缩短任务");bytes.write(buffer,0,n);}}
   return new JSONObject(bytes.toString("UTF-8"));
  }finally{c.disconnect();job.connection=null;}
 }
 static String text(JSONObject response)throws Exception{if(!"completed".equals(response.optString("status")))throw new IOException("服务未完成响应，请检查模型能力或额度");StringBuilder text=new StringBuilder();JSONArray output=response.optJSONArray("output");if(output!=null)for(int i=0;i<output.length();i++){JSONObject item=output.optJSONObject(i);if(item==null||!item.optString("type").equals("message"))continue;JSONArray content=item.optJSONArray("content");if(content!=null)for(int j=0;j<content.length();j++){JSONObject part=content.optJSONObject(j);if(part==null)continue;if(part.optString("type").equals("output_text"))text.append(part.optString("text"));else if(part.optString("type").equals("refusal"))text.append(part.optString("refusal"));}}
  if(text.length()==0)throw new IOException("服务未返回文本；此版本尚未执行模型工具调用");return text.toString();}
 static String safeError(Exception e){String m=e.getMessage();if(m!=null&&(m.startsWith("HTTP ")||m.startsWith("服务未")||m.startsWith("响应超过")||m.startsWith("请求已取消")))return m;return "连接失败或响应无效，请检查网络、API 地址与 Responses 支持";}
 static JSONObject body(String model,JSONArray input)throws Exception{return new JSONObject().put("model",model).put("input",input).put("store",false).put("stream",false);}
 static void state(Context c,String id,JSONObject value){c.getSharedPreferences("eva-model-jobs",0).edit().putString(id,value.toString()).commit();}
 static String start(Context context,String id,String providerId,String model,String inputJson){Context c=context.getApplicationContext();try{
  if(!id.matches("[a-zA-Z0-9-]{1,80}"))throw new IOException("无效请求编号");if(inputJson.length()>200000)throw new IOException("对话过长，请新建会话");JSONArray raw=new JSONArray(inputJson),input=new JSONArray();if(raw.length()==0||raw.length()>200)throw new IOException("消息数量不在支持范围");for(int i=0;i<raw.length();i++){JSONObject m=raw.getJSONObject(i);String role=m.getString("role");if(!role.equals("user")&&!role.equals("assistant"))throw new IOException("不支持的消息角色");input.put(new JSONObject().put("role",role).put("content",m.getString("content")));}
  ModelStore store=new ModelStore(c);JSONObject p=store.provider(providerId);String secret=store.secret(p);JSONObject body=body(ModelStore.field(model,"模型",200),input);Job job=new Job();
  synchronized(jobs){if(jobs.containsKey(id)||c.getSharedPreferences("eva-model-jobs",0).contains(id))return poll(c,id);if(jobs.size()>=2)throw new IOException("已有请求正在进行，请等待完成");jobs.put(id,job);state(c,id,new JSONObject().put("state","running"));}
  workers.execute(()->{try{JSONObject response=request(p,secret,"responses",body,job);JSONObject result=new JSONObject().put("state",job.cancelled?"cancelled":"completed");if(!job.cancelled)result.put("text",text(response).replace(secret,"[REDACTED]"));state(c,id,result);}catch(Exception e){try{state(c,id,new JSONObject().put("state",job.cancelled?"cancelled":"failed").put("error",job.cancelled?"已停止等待；服务端可能已接收请求":safeError(e)));}catch(Exception ignored){}}finally{jobs.remove(id);}});return "{\"state\":\"running\"}";
 }catch(Exception e){try{return new JSONObject().put("state","failed").put("error",e instanceof IOException?e.getMessage():"配置无法读取，请重新保存提供商").toString();}catch(Exception ignored){return "{}";}}}
 static String poll(Context c,String id){try{JSONObject state=new JSONObject(c.getSharedPreferences("eva-model-jobs",0).getString(id,"{\"state\":\"interrupted\"}"));if(state.optString("state").equals("running")&&!jobs.containsKey(id))return "{\"state\":\"interrupted\",\"error\":\"应用已重启，未自动重复提交请求\"}";return state.toString();}catch(Exception e){return "{\"state\":\"failed\"}";}}
 static void cancel(String id){Job job=jobs.get(id);if(job!=null){job.cancelled=true;HttpURLConnection c=job.connection;if(c!=null)new Thread(()->c.disconnect(),"eva-model-cancel").start();}}
}
