package ai.eva.android.probe;

import android.os.Bundle;
import android.content.Intent;
import android.widget.*;
import org.json.*;
import java.util.concurrent.*;

/** Android controls for desktop automation definitions, never a second scheduler. */
public final class ScheduledTaskActivity extends ToolPageActivity {
 private final ExecutorService worker=Executors.newSingleThreadExecutor();
 private boolean busy;
 @Override public void onCreate(Bundle state){super.onCreate(state);show();}
 private interface Result{void accept(Object result)throws Exception;}
 private void call(String operation,JSONObject value,Result callback){
  if(busy)return;if(operation.equals("runNow")&&!getSharedPreferences("eva-scheduled",0).getBoolean("enabled",false)){error(new Exception("请先开启后台调度后运行，确保任务执行期间保持运行"));return;}busy=true;
  worker.execute(()->{try{JSONObject reply=ScheduledTaskHost.get(this).command(operation,value);if(operation.equals("create")||operation.equals("update")&&value.has("prompt")){getSharedPreferences("eva-scheduled",0).edit().putBoolean("enabled",true).commit();ScheduledTaskService.restore(this);}if(java.util.Arrays.asList("create","update","remove").contains(operation))ScheduledTaskService.refresh(this);Object result=reply.opt("result");runOnUiThread(()->{busy=false;if(isFinishing()||isDestroyed())return;try{callback.accept(result);}catch(Exception e){error(e);}});}catch(Exception e){runOnUiThread(()->{busy=false;if(!isFinishing()&&!isDestroyed())error(e);});}});
 }
 private void error(Exception error){new android.app.AlertDialog.Builder(this).setTitle("定时任务未完成").setMessage(error.getMessage()).setPositiveButton("关闭",null).show();}
 private JSONObject object(String key,Object value){try{return new JSONObject().put(key,value);}catch(JSONException e){throw new IllegalArgumentException(e);}}
 private void show(){
  page("定时任务","电脑端调度核心 · 手机独立执行");
  body.addView(label(getSharedPreferences("eva-scheduled",0).getBoolean("enabled",false)?"后台调度已开启":"后台调度已暂停，已保存任务保留",14));
  body.addView(label("任务使用固定模型及只读权限。Android 限制后台运行或关闭 Eva 时，任务可能延后执行。",13));
  String failure=getSharedPreferences("eva-scheduled",0).getString("error","");if(!failure.isEmpty())body.addView(label(failure,13));
  body.addView(button("创建定时任务",()->edit(null)));
  body.addView(button("开启 / 恢复后台调度",()->{getSharedPreferences("eva-scheduled",0).edit().putBoolean("enabled",true).apply();ScheduledTaskService.restore(this);show();}));
  body.addView(button("暂停全部后台调度",()->{getSharedPreferences("eva-scheduled",0).edit().putBoolean("enabled",false).apply();ScheduledTaskService.cancelAlarm(this);stopService(new Intent(this,ScheduledTaskService.class));show();}));
  // Merely opening management may read definitions. Only the foreground service keeps future execution enabled.
  call("list",new JSONObject(),result->{JSONArray rows=(JSONArray)result;for(int i=0;i<rows.length();i++)row(rows.getJSONObject(i));});
 }
 private void row(JSONObject task){
  LinearLayout block=new LinearLayout(this);block.setOrientation(LinearLayout.VERTICAL);
  block.addView(label(task.optString("name")+" · "+(task.optString("status").equals("ACTIVE")?"启用":"暂停"),17));
  long next=task.optLong("nextRunAt",0);block.addView(label(next>0?"下次运行 "+new java.util.Date(next):"下次运行时间待计算",12));
  block.addView(button("编辑",()->edit(task)));
  block.addView(button(task.optString("status").equals("ACTIVE")?"暂停":"启用",()->{try{JSONObject input=new JSONObject().put("id",task.getString("id")).put("status",task.optString("status").equals("ACTIVE")?"PAUSED":"ACTIVE").put("androidBinding",task.getJSONObject("androidBinding"));call("update",input,result->show());}catch(Exception e){error(e);}}));
  block.addView(button("运行历史",()->call("history",object("id",task.optString("id")),result->{page("运行历史",task.optString("name"));JSONArray rows=(JSONArray)result;for(int i=rows.length()-1;i>=0;i--){JSONObject run=rows.getJSONObject(i);body.addView(label(run.toString(2),13));String threadId=run.optString("threadId","");if(!threadId.isEmpty())body.addView(button("打开任务对话 / 处理审批",()->startActivity(new Intent(this,ShellActivity.class).putExtra("scheduledThreadId",threadId))));}if(rows.length()==0)body.addView(label("暂无运行记录",14));})));
  block.addView(button("立即运行一次",()->new android.app.AlertDialog.Builder(this).setMessage("现在使用此任务已保存的模型和只读权限运行一次？").setNegativeButton("取消",null).setPositiveButton("运行",(dialog,which)->call("runNow",object("id",task.optString("id")),result->show())).show()));
  block.addView(button("删除",()->new android.app.AlertDialog.Builder(this).setMessage("删除此定时任务？运行历史不会重新执行。").setNegativeButton("取消",null).setPositiveButton("删除",(dialog,which)->call("remove",object("id",task.optString("id")),result->show())).show()));body.addView(block);
 }
 private EditText field(String title,String value){body.addView(label(title,13));EditText input=new EditText(this);input.setText(value);input.setTextColor(ink);body.addView(input);return input;}
 private void edit(JSONObject existing){
  page(existing==null?"创建定时任务":"编辑定时任务","每次运行创建独立聊天");
  EditText name=field("名称",existing==null?"":existing.optString("name"));
  EditText prompt=field("任务内容",existing==null?"":existing.optString("prompt"));prompt.setMinLines(3);
  String originalRule=existing==null?"":existing.optString("rrule");
  body.addView(label("运行频率",13));Spinner frequency=new Spinner(this);frequency.setAdapter(new ArrayAdapter<String>(this,android.R.layout.simple_spinner_dropdown_item,new String[]{"每天","每周","每隔若干小时","高级时间规则"}));body.addView(frequency);
  EditText time=field("运行时间（每天 / 每周）","09:00");
  body.addView(label("每周运行日",13));Spinner weekday=new Spinner(this);weekday.setAdapter(new ArrayAdapter<String>(this,android.R.layout.simple_spinner_dropdown_item,new String[]{"周一","周二","周三","周四","周五","周六","周日"}));body.addView(weekday);
  EditText interval=field("间隔小时数","24");interval.setInputType(android.text.InputType.TYPE_CLASS_NUMBER);
  EditText advanced=field("高级 RRULE（仅高级模式使用）",originalRule);if(existing!=null)frequency.setSelection(3);
  if(existing!=null){java.util.Map<String,String> parts=new java.util.HashMap<>();for(String part:originalRule.replace("RRULE:","").split(";")){String[] pair=part.split("=",2);if(pair.length==2)parts.put(pair[0],pair[1]);}String freq=parts.get("FREQ");boolean simple=true;for(String key:parts.keySet())if(!java.util.Arrays.asList("FREQ","BYHOUR","BYMINUTE","BYSECOND","BYDAY","INTERVAL").contains(key))simple=false;
   if(simple&&("DAILY".equals(freq)||"WEEKLY".equals(freq))&&"1".equals(parts.getOrDefault("INTERVAL","1"))&&!parts.getOrDefault("BYHOUR","0").contains(",")&&!parts.getOrDefault("BYMINUTE","0").contains(",")){String day=parts.getOrDefault("BYDAY","MO");int selected=java.util.Arrays.asList("MO","TU","WE","TH","FR","SA","SU").indexOf(day);if("DAILY".equals(freq)||selected>=0){frequency.setSelection("DAILY".equals(freq)?0:1);if(selected>=0)weekday.setSelection(selected);time.setText(parts.getOrDefault("BYHOUR","9")+":"+String.format(java.util.Locale.ROOT,"%02d",Integer.parseInt(parts.getOrDefault("BYMINUTE","0"))));}}
   else if(simple&&"HOURLY".equals(freq)&&"0".equals(parts.getOrDefault("BYMINUTE","0"))){frequency.setSelection(2);interval.setText(parts.getOrDefault("INTERVAL","1"));}
  }
  frequency.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener(){public void onNothingSelected(android.widget.AdapterView<?> parent){}public void onItemSelected(android.widget.AdapterView<?> parent,android.view.View view,int position,long id){time.setVisibility(position<2?android.view.View.VISIBLE:android.view.View.GONE);weekday.setVisibility(position==1?android.view.View.VISIBLE:android.view.View.GONE);interval.setVisibility(position==2?android.view.View.VISIBLE:android.view.View.GONE);advanced.setVisibility(position==3?android.view.View.VISIBLE:android.view.View.GONE);}});
  java.util.ArrayList<JSONObject> choices=new java.util.ArrayList<>();java.util.ArrayList<String> labels=new java.util.ArrayList<>();
  JSONObject current=existing==null?null:existing.optJSONObject("androidBinding");
  try{JSONObject config=new ModelStore(this).publicConfig();JSONArray providers=config.getJSONArray("providers");for(int i=0;i<providers.length();i++){JSONObject provider=providers.getJSONObject(i);String selected=provider.optString("model","");if(selected.isEmpty())continue;choices.add(new JSONObject().put("provider",provider.getString("id")).put("model",selected));labels.add(provider.optString("name")+" · "+selected);}JSONObject account=config.getJSONObject("account");if(account.optBoolean("loggedIn")&&!account.optString("model").isEmpty()){choices.add(new JSONObject().put("provider","openai").put("model",account.getString("model")));labels.add("OpenAI · "+account.getString("model"));}}catch(Exception error){error(error);}
  body.addView(label("执行模型（来自账号与模型设置）",13));Spinner model=new Spinner(this);model.setAdapter(new ArrayAdapter<String>(this,android.R.layout.simple_spinner_dropdown_item,labels));body.addView(model);
  if(current!=null){int selected=-1;for(int i=0;i<choices.size();i++)if(choices.get(i).optString("provider").equals(current.optString("provider"))&&choices.get(i).optString("model").equals(current.optString("model")))selected=i;if(selected<0){choices.add(current);labels.add("原任务模型 · "+current.optString("model"));((ArrayAdapter<?>)model.getAdapter()).notifyDataSetChanged();selected=choices.size()-1;}model.setSelection(selected);}
  body.addView(button("管理账号与模型",()->startActivity(new Intent(this,ModelsActivity.class))));
  body.addView(label("每次运行创建独立聊天，使用只读文件权限。需要审批时可从运行历史打开任务对话处理。修改时间或模型只影响后续运行，运行中的任务禁止编辑。",12));
  Button save=button("保存",()->{try{
   int selected=model.getSelectedItemPosition();if(selected<0||selected>=choices.size())throw new Exception("请先在账号与模型中选择可用模型");
   String rule;
   int mode=frequency.getSelectedItemPosition();
   if(mode==3)rule=advanced.getText().toString();
   else if(mode==2){int hours=Integer.parseInt(interval.getText().toString());if(hours<1||hours>168)throw new Exception("间隔应为1至168小时");rule="FREQ=HOURLY;INTERVAL="+hours+";BYMINUTE=0;BYSECOND=0";}
   else{String value=time.getText().toString().trim();if(!value.matches("(?:[01]?\\d|2[0-3]):[0-5]\\d"))throw new Exception("请输入有效时间，例如09:00");String[] parts=value.split(":");rule=(mode==0?"FREQ=DAILY":"FREQ=WEEKLY;BYDAY="+new String[]{"MO","TU","WE","TH","FR","SA","SU"}[weekday.getSelectedItemPosition()])+";BYHOUR="+Integer.parseInt(parts[0])+";BYMINUTE="+Integer.parseInt(parts[1])+";BYSECOND=0";}
   JSONObject input=new JSONObject().put("name",name.getText().toString()).put("prompt",prompt.getText().toString()).put("rrule",rule).put("threadMode","new").put("status",existing==null?"ACTIVE":existing.optString("status")).put("notificationPolicy","failed_runs_only").put("androidBinding",choices.get(selected));if(existing!=null)input.put("id",existing.getString("id"));call(existing==null?"create":"update",input,result->{getSharedPreferences("eva-scheduled",0).edit().putBoolean("enabled",true).apply();ScheduledTaskService.restore(this);show();});
  }catch(Exception failure){error(failure);}});save.setEnabled(!choices.isEmpty());body.addView(save);

 }
 @Override protected void onDestroy(){worker.shutdown();super.onDestroy();}
}
