package ai.eva.android.probe;

import android.app.Instrumentation;
import android.content.Context;
import android.os.Bundle;
import android.os.SystemClock;
import android.util.Log;
import java.util.*;
import org.json.*;

/** Explicit fixture-only native bridge check. Online execution requires -e execute true. */
public final class ScheduledTaskCheck extends Instrumentation {
 private Bundle arguments;
 private final JSONObject report=new JSONObject();
 private final String token="EVA_SCHEDULE_CHECK_"+UUID.randomUUID();
 private Context context;
 private ScheduledTaskHost host;
 private String taskId,threadId;
 private JSONObject binding;
 private boolean enabledBefore;
 private static final String MARKER="EVA_SCHEDULE_NATIVE_OK";
 @Override public void onCreate(Bundle args){super.onCreate(args);arguments=args==null?new Bundle():args;start();}
 private static void require(boolean condition,String message)throws Exception{if(!condition)throw new Exception(message);}
 private Object command(String operation,JSONObject value)throws Exception{return host.command(operation,value).get("result");}
 private JSONObject id()throws Exception{return new JSONObject().put("id",taskId);}
 private JSONArray history()throws Exception{return (JSONArray)command("history",id());}
 private void capture(JSONArray runs)throws Exception{for(int i=0;i<runs.length();i++){JSONObject run=runs.getJSONObject(i);if(!run.optString("threadId").isEmpty()){threadId=run.getString("threadId");report.put("threadId",threadId);if(!run.optString("turnId").isEmpty())report.put("turnId",run.getString("turnId"));}}}
 private boolean inProgress(JSONArray runs){for(int i=0;i<runs.length();i++)if("IN_PROGRESS".equals(runs.optJSONObject(i).optString("status")))return true;return false;}
 private void save(){context.getSharedPreferences("eva-scheduled-check",0).edit().putString("result",report.toString()).commit();}
 private Set<String> ids(JSONArray rows){Set<String> result=new HashSet<>();for(int i=0;i<rows.length();i++)result.add(rows.optJSONObject(i).optString("id"));return result;}
 private void interruptOwnRun()throws Exception{
  if(threadId==null)return;
  JSONObject page=KernelHost.scheduledRequest(context,"thread/turns/list",new JSONObject().put("threadId",threadId).put("limit",5).put("sortDirection","desc").put("itemsView","summary"),binding);
  JSONArray turns=page.getJSONArray("data");for(int i=0;i<turns.length();i++){JSONObject turn=turns.getJSONObject(i);if("inProgress".equals(turn.optString("status")))KernelHost.scheduledRequest(context,"turn/interrupt",new JSONObject().put("threadId",threadId).put("turnId",turn.getString("id")),binding);}
 }
 @Override public void onStart(){
  context=getTargetContext();host=ScheduledTaskHost.get(context);
  enabledBefore=context.getSharedPreferences("eva-scheduled",0).getBoolean("enabled",false);
  Set<String> existing=new HashSet<>();boolean passed=false;
  try{
   JSONObject timezone=(JSONObject)command("status",new JSONObject());String androidZone=java.util.TimeZone.getDefault().getID();int androidOffset=java.util.TimeZone.getDefault().getOffset(System.currentTimeMillis())/60000;report.put("androidTimezone",androidZone).put("nodeTimezone",timezone);require(androidZone.equals(timezone.optString("environmentTimezone"))&&androidOffset==timezone.optInt("offsetMinutes"),"Node调度时区与手机时区不一致");
   existing=ids((JSONArray)command("list",new JSONObject()));
   report.put("existingTaskIds",new JSONArray(existing)).put("enabledBefore",enabledBefore).put("fixtureToken",token);
   boolean execute="true".equalsIgnoreCase(arguments.getString("execute","false"));
   String provider=arguments.getString("provider",execute?"":"fixture-paused"),model=arguments.getString("model",execute?"":"fixture-paused");
   require(!provider.trim().isEmpty()&&!model.trim().isEmpty(),"执行测试必须明确提供 provider 和 model");
   binding=new JSONObject().put("provider",provider).put("model",model);
   JSONObject created=(JSONObject)command("create",new JSONObject().put("name",token).put("prompt","只回复"+MARKER+"，不调用工具").put("rrule","FREQ=DAILY;BYHOUR=23;BYMINUTE=59;BYSECOND=0").put("status","PAUSED").put("threadMode","new").put("androidBinding",binding));
   taskId=created.getString("id");binding=created.getJSONObject("androidBinding");report.put("testTaskId",taskId).put("execute",execute);save();
   require(!existing.contains(taskId),"测试任务必须具有独立ID");
   JSONObject updated=(JSONObject)command("update",new JSONObject().put("id",taskId).put("name",token+"_EDITED").put("status","PAUSED").put("androidBinding",binding));
   require("PAUSED".equals(updated.getString("status")),"测试任务必须保持暂停");
   require((token+"_EDITED").equals(updated.getString("name")),"编辑未持久更新");
   require("readOnly".equals(binding.getJSONObject("sandboxPolicy").getString("type")),"任务绑定必须保持只读");
   require(ids((JSONArray)command("list",new JSONObject())).contains(taskId),"创建后列表缺少测试任务");
   require(history().length()==0,"被动创建编辑不能执行任务");
   report.put("passiveCrud",true);save();
   if(execute){
    command("runNow",id());
    long until=SystemClock.elapsedRealtime()+180000;boolean completed=false;
    while(SystemClock.elapsedRealtime()<until){JSONArray runs=history();capture(runs);save();for(int i=0;i<runs.length();i++){JSONObject run=runs.getJSONObject(i);if("COMPLETED".equals(run.optString("status"))){require(run.optString("description").contains(MARKER),"真实回合未返回测试标记");completed=true;}else if("FAILED".equals(run.optString("status")))throw new Exception("测试内核回合失败，请核对专用路径");}if(completed)break;SystemClock.sleep(500);}
    require(completed,"真实调度回合超时，清理阶段将尝试停止独立测试回合");
    require(threadId!=null,"真实执行未记录独立线程ID");report.put("nativeExecution",true);
   }
   passed=true;
  }catch(Exception failure){try{report.put("errorType",failure.getClass().getSimpleName()).put("error",failure.getMessage()==null?"测试失败":failure.getMessage());}catch(JSONException ignored){}}
  finally{
   try{
    // If the create response was lost, find only this exact UUID-prefixed fixture.
    if(taskId==null){JSONArray rows=(JSONArray)command("list",new JSONObject());for(int i=0;i<rows.length();i++){JSONObject row=rows.getJSONObject(i);if(row.optString("name").startsWith(token)){taskId=row.getString("id");binding=row.getJSONObject("androidBinding");break;}}}
    if(taskId!=null){JSONArray runs=history();capture(runs);if(inProgress(runs)){interruptOwnRun();long until=SystemClock.elapsedRealtime()+30000;while(inProgress(runs)&&SystemClock.elapsedRealtime()<until){SystemClock.sleep(500);runs=history();capture(runs);}}require(!inProgress(runs),"测试任务仍运行，已保留测试ID供后续核对");
     command("remove",id());report.put("testTaskRemoved",true);
     if(threadId!=null){JSONObject meta=KernelHost.scheduledRequest(context,"thread/read",new JSONObject().put("threadId",threadId).put("includeTurns",false),binding).getJSONObject("thread");require(meta.optJSONObject("status")==null||!"active".equals(meta.getJSONObject("status").optString("type")),"内核测试线程仍活跃，未归档");KernelHost.scheduledRequest(context,"thread/archive",new JSONObject().put("threadId",threadId),binding);report.put("testThreadArchived",true);}
    }
    Set<String> after=ids((JSONArray)command("list",new JSONObject()));require(after.containsAll(existing),"既有任务ID发生变化，需要核对");
    require(enabledBefore==context.getSharedPreferences("eva-scheduled",0).getBoolean("enabled",false),"全局后台开关发生变化");
    report.put("existingTasksPreserved",true).put("globalEnablePreserved",true);
   }catch(Exception cleanup){passed=false;try{report.put("cleanupPending",true).put("cleanupError",cleanup.getMessage());}catch(JSONException ignored){}}
   try{report.put("passed",passed);save();}catch(JSONException ignored){}
   // Do not stop the shared host or foreground service, even when enabledBefore=false.
   Log.i("EvaScheduledCheck","passed="+passed+" execute="+arguments.getString("execute","false")+" cleanupPending="+report.optBoolean("cleanupPending"));
   Bundle result=new Bundle();result.putString("result",report.toString());finish(passed?0:1,result);
  }
 }
}
