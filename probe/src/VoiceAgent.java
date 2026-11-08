package ai.eva.android.probe;

import android.content.*;import org.json.*;import java.util.UUID;

/** Voice submits the same thread/turn protocol, without depending on a visible WebView. */
final class VoiceAgent {
 static volatile String thread="",turn="";static volatile boolean busy;static long generation;
 static JSONObject config(Context c)throws Exception{
  String saved=c.getSharedPreferences("eva-voice",0).getString("config","");if(!saved.isEmpty())return new JSONObject(saved);
  JSONObject all=new ModelStore(c).publicConfig(),selection=all.getJSONObject("defaultSelection");
  String provider=selection.optString("providerId");
  if(selection.optString("model").isEmpty()||provider.isEmpty())throw new Exception("请先在 Eva 设置中选择新会话默认模型，再开启语音模式");
  if(provider.equals("openai")){if(!all.getJSONObject("account").optBoolean("loggedIn"))throw new Exception("默认账号模型尚未登录，请先登录或选择其他默认模型");}
  else new ModelStore(c).provider(provider);
  return new JSONObject(selection.toString()).put("permissionMode","auto").put("projectId","");
 }
 static JSONObject permissions(JSONObject cfg)throws Exception{
  String mode=cfg.optString("permissionMode","auto");return new JSONObject().put("approvalPolicy",mode.equals("full")?"never":"on-request").put("approvalsReviewer",mode.equals("assisted")?"auto_review":"user");
 }
 static synchronized void submit(Context c,String text){
  if(busy)return;busy=true;thread="";turn="";long stamp=++generation;
  new Thread(()->{try{
   JSONObject cfg=config(c);KernelHost h=cfg.getString("providerId").equals("openai")?KernelHost.get(c):KernelHost.api(c);
   synchronized(h.startup){h.ensureStarted();}
   synchronized(VoiceAgent.class){if(stamp!=generation)return;}
   JSONObject p=permissions(cfg).put("modelProvider",cfg.getString("providerId")).put("model",cfg.getString("model")).put("androidProject",cfg.optString("projectId"));
   JSONObject started=h.dispatch("thread/start",p),t=started.getJSONObject("thread");String tid=t.getString("id");
   if(started.has("approvalPolicy")&&!started.optString("approvalPolicy").equals(p.getString("approvalPolicy")))throw new Exception("语音会话批准策略不一致");
   String reviewer=started.optString("approvalsReviewer");if(!reviewer.isEmpty()&&!reviewer.equals(p.getString("approvalsReviewer"))&&!(p.getString("approvalsReviewer").equals("auto_review")&&reviewer.equals("guardian_subagent")))throw new Exception("语音会话批准方式不一致");
   synchronized(VoiceAgent.class){if(stamp!=generation)return;thread=tid;}
   JSONObject chat=new JSONObject().put("id","voice-"+tid).put("title","语音 · "+text.substring(0,Math.min(text.length(),24))).put("messages",new JSONArray()).put("draft","").put("providerId",cfg.getString("providerId")).put("model",cfg.getString("model")).put("effort",cfg.optString("effort")).put("permissionMode",cfg.optString("permissionMode","auto")).put("projectId",cfg.optString("projectId")).put("kernelThread",t).put("running",true).put("voice",true);
   synchronized(VoiceAgent.class){if(stamp!=generation)return;SharedPreferences prefs=c.getSharedPreferences("eva-voice",0);JSONArray chats=new JSONArray(prefs.getString("threads","[]"));chats.put(chat);prefs.edit().putString("threads",chats.toString()).commit();}
   h.emit(new JSONObject().put("method","android/voiceThread"));
   JSONObject request=permissions(cfg).put("threadId",tid).put("input",new JSONArray().put(new JSONObject().put("type","text").put("text",text).put("text_elements",new JSONArray()))).put("clientUserMessageId",UUID.randomUUID().toString()).put("model",cfg.getString("model"));
   if(!cfg.optString("effort").isEmpty())request.put("effort",cfg.getString("effort"));if(!cfg.optString("serviceTier").isEmpty())request.put("serviceTier",cfg.getString("serviceTier"));
   synchronized(VoiceAgent.class){if(stamp!=generation)return;}
   JSONObject result=h.dispatch("turn/start",request);
   String id=result.getJSONObject("turn").getString("id");boolean cancelled;
   synchronized(VoiceAgent.class){cancelled=stamp!=generation;if(!cancelled)turn=id;}
   if(cancelled)h.rpc("turn/interrupt",new JSONObject().put("threadId",tid).put("turnId",id));
  }catch(Exception e){synchronized(VoiceAgent.class){if(stamp!=generation)return;busy=false;}VoiceService.report("error","提交未确认，请查看对话；不会自动重发",true);}
  },"eva-voice-submit").start();
 }
 static synchronized void event(Context c,JSONObject row){
  if(!busy)return;JSONObject p=row.optJSONObject("params");if(p==null)return;
  if("android/kernelExited".equals(row.optString("method"))){busy=false;VoiceService.report("error","代理已停止，请打开对话检查",true);return;}
  if(thread.isEmpty()||!thread.equals(p.optString("threadId")))return;
  String method=row.optString("method");
  if(method.equals("turn/started")){JSONObject t=p.optJSONObject("turn");if(t!=null)turn=t.optString("id");}
  if(method.endsWith("requestApproval")||method.equals("tool/requestUserInput"))VoiceService.report("approval","需要你确认，点“查看对话”继续",false);
  if(method.equals("item/started"))VoiceService.report("working","正在处理你的指令…",false);
  if(method.equals("turn/completed")){
   JSONObject t=p.optJSONObject("turn");if(t==null)return;busy=false;String status=t.optString("status"),answer="";JSONArray items=t.optJSONArray("items");
   if(items!=null)for(int i=0;i<items.length();i++){JSONObject item=items.optJSONObject(i);if(item!=null&&item.optString("type").equals("agentMessage")&&!item.optString("phase").equals("commentary"))answer=item.optString("text");}
   if(answer.length()>100)answer=answer.substring(0,100)+"…";
   VoiceService.report(status.equals("completed")?"done":"error",answer.isEmpty()?(status.equals("completed")?"已完成，可再次唤醒":"任务未完成，请查看对话"):answer,true);
  }
 }
 static synchronized void cancel(Context c){generation++;busy=false;String tid=thread,id=turn;if(!tid.isEmpty()&&!id.isEmpty())KernelHost.forThread(c,tid).call("voice-stop-"+UUID.randomUUID(),"turn/interrupt","{\"threadId\":"+JSONObject.quote(tid)+",\"turnId\":"+JSONObject.quote(id)+"}");}
}
