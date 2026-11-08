package ai.eva.android.probe;

import android.app.*;
import android.content.*;
import android.os.*;
import android.view.*;
import android.widget.*;
import org.json.*;
import java.util.*;

/** Core setup, optional capability selection and task-scoped installation consent. */
public final class RuntimeSetupActivity extends ToolPageActivity {
 private static final java.util.concurrent.ExecutorService checking=java.util.concurrent.Executors.newSingleThreadExecutor();
 private final Handler handler=new Handler(Looper.getMainLooper());
 private String displayed="",request="",requested="";
 private boolean advanced,requestExpired;
 private Button optionalAction,skipAction;
 private final Set<String> selected=new LinkedHashSet<>();
 private final Runnable refresh=new Runnable(){public void run(){renderStatus();handler.postDelayed(this,700);}};
 static void checkOnLaunch(Activity activity){
  checking.execute(()->{try{
   JSONObject state=RuntimeBootstrap.status(activity);
   boolean legacy=new java.io.File(RuntimeComponents.base(activity),"ready.json").isFile();
   if(state.optBoolean("ready")&&(legacy||RuntimeComponents.prefs(activity).getBoolean("onboardingComplete",false)))return;
   activity.runOnUiThread(()->{if(!activity.isFinishing()&&!activity.isDestroyed()&&!activity.getIntent().hasExtra("page"))activity.startActivity(new Intent(activity,RuntimeSetupActivity.class).putExtra("onboarding",true));});
  }catch(Exception error){android.util.Log.w("EvaRuntime","Setup state unavailable",error);}});
 }
 public void onCreate(Bundle state){
  super.onCreate(state);page("Eva · 首次设置","");
  LinearLayout outer=body;ScrollView scroll=new ScrollView(this);body=new LinearLayout(this);body.setOrientation(1);scroll.setFillViewport(true);scroll.addView(body);outer.addView(scroll,new LinearLayout.LayoutParams(-1,-1));
  request=getIntent().getStringExtra("request");requested=getIntent().getStringExtra("component");
  if(request==null)request="";if(requested==null)requested="";
  if(!request.isEmpty()&&!RuntimeComponents.requests.containsKey(request)){request="";requestExpired=true;}
  advanced=state!=null&&state.getBoolean("advanced");
  Set<String> saved=RuntimeComponents.prefs(this).getStringSet("selection",Collections.emptySet());selected.addAll(saved);
  if(RuntimeComponents.valid(requested)){selected.clear();selected.add(requested);advanced=requested.equals("analysis")||requested.equals("ghidra");}
  renderStatus();
 }
 protected void onNewIntent(Intent intent){super.onNewIntent(intent);if(!request.isEmpty()&&!intent.hasExtra("request")){displayed="";renderStatus();return;}String next=intent.getStringExtra("request");if(!request.isEmpty()&&!request.equals(next))RuntimeComponents.answer(request,false);setIntent(intent);request=next;requested=intent.getStringExtra("component");if(request==null)request="";if(requested==null)requested="";if(RuntimeComponents.valid(requested)){selected.clear();selected.add(requested);advanced=requested.equals("analysis")||requested.equals("ghidra");}displayed="";renderStatus();}
 private TextView secondary(String text){TextView view=label(text,13);view.setTextColor(paper==0xffFFFFFF?EvaUi.MUTED:0xffa0adbc);return view;}
 private void heading(String step,String title,String subtitle){body.addView(secondary(step));TextView h=label(title,25);h.setTypeface(null,android.graphics.Typeface.BOLD);body.addView(h);body.addView(secondary(subtitle));}
 private Button primary(String title,Runnable action){Button b=button(title,action);b.setTextColor(paper==0xffFFFFFF?0xffFFFFFF:EvaUi.INK);b.setBackground(EvaUi.surface(this,ink,12));body.addView(b);return b;}
 private void message(String title,String text){new AlertDialog.Builder(this).setTitle(title).setMessage(text).setPositiveButton("知道了",null).show();}
 private void launchCore(){try{RuntimeSetupService.launch(this,true);}catch(Exception error){message("暂时无法安装",error.getMessage());}displayed="";renderStatus();}
 private boolean targeted(){return RuntimeComponents.valid(requested);}
 private void renderStatus(){
  try{
   JSONObject core=RuntimeBootstrap.status(this),components=RuntimeComponents.status(this);
   String next=core.toString()+components.toString()+advanced+RuntimeSetupService.isActive();
   if(next.equals(displayed))return;displayed=next;body.removeAllViews();
   boolean ready=core.optBoolean("ready"),running=core.optBoolean("running");
   boolean onboarding=getIntent().getBooleanExtra("onboarding",false);
   pageTitle.setText(ready?(onboarding?"Eva · 选择能力":"能力与组件"):"Eva · 首次设置");
   if(!ready){
    heading("第 1 步 / 共 2 步",running?"正在准备运行环境":"准备好，开始使用 Eva","先安装必备环境，让 Eva 能在手机上执行任务。");
    section("必备能力");body.addView(label("核心运行环境                     必装",16));body.addView(secondary("代理运行、文件处理与基础命令"));body.addView(label("手机控制与内置浏览器          已内置",16));body.addView(secondary("使用手机控制时再引导系统授权。"));
    if(running){
     TextView summary=label(stageLabel(core.optString("stage")),16);statusCard(summary);body.addView(summary);
     ProgressBar progress=new ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal);progress.setMax(100);progress.setProgress(core.optInt("progress"));progress.setIndeterminate(core.optInt("progress")==0||core.optString("stage").equals("dependencies"));body.addView(progress);
     body.addView(secondary(core.optString("message")));body.addView(button("取消后续部署",()->{RuntimeBootstrap.cancel(this);displayed="";renderStatus();}));
    }else{
     String error=core.optString("error");if(!error.isEmpty())body.addView(label("上次部署未完成："+error,13));
     body.addView(secondary("需要联网完成安装。办公、编程等扩展能力可稍后选择，不影响先开始使用。中断后可重试继续。"));
     primary(core.optString("stage").equals("idle")?"安装必备环境":"继续安装必备环境",this::launchCore);
    }
    body.addView(button("查看下载与存储信息",()->showStorage()));
    body.addView(button("运行环境许可与来源",this::licenses));return;
   }
   if(targeted()&&RuntimeComponents.installed(this,requested)){if(!request.isEmpty())RuntimeComponents.answer(request,true);setResult(RESULT_OK);finish();return;}
   heading(onboarding?"第 2 步 / 共 2 步":"必备环境已就绪",targeted()?"需要安装"+RuntimeComponents.title(requested):"还想让 Eva 做些什么？",targeted()?(requestExpired?"原任务已中断。安装后返回会话，可重新继续任务。":"安装完成后将回到原任务继续执行。你也可以暂不安装。"):"以下全部可选，以后用到再装也可以。");
   JSONArray rows=components.getJSONArray("components");boolean installing=components.optBoolean("running");
   for(int i=0;i<RuntimeComponents.IDS.length;i++){
    String id=RuntimeComponents.IDS[i];if(targeted()&&!id.equals(requested))continue;if(!targeted()&&i>=3&&!advanced)continue;
    JSONObject row=rows.getJSONObject(i);boolean installed=row.optBoolean("ready");
    CheckBox box=new CheckBox(this);box.setText(RuntimeComponents.TITLES[i]+(installed?" · 已安装":""));box.setTextSize(16);box.setTextColor(ink);box.setMinHeight(dp(48));box.setChecked(!installed&&selected.contains(id));box.setEnabled(!targeted()&&!installed&&!installing&&!RuntimeSetupService.isActive());body.addView(box);
    body.addView(secondary(RuntimeComponents.DESCRIPTIONS[i]));
    if(!installed&&!row.optString("message").isEmpty()){String prefix=row.optString("state").equals("interrupted")?"上次安装中断，可重试：":"";body.addView(secondary(prefix+row.optString("message")));}
    box.setOnCheckedChangeListener((b,checked)->{if(checked)selected.add(id);else selected.remove(id);RuntimeComponents.prefs(this).edit().putStringSet("selection",new LinkedHashSet<>(selected)).apply();updateSelectionActions();});
   }
   if(!targeted())body.addView(button(advanced?"收起专业工具":"更多专业工具",()->{advanced=!advanced;displayed="";renderStatus();}));
   if(installing||RuntimeSetupService.isActive()){
    ProgressBar progress=new ProgressBar(this);body.addView(progress);
    body.addView(secondary(components.optBoolean("stopping")?"等待当前依赖事务结束，已安装内容会保留。":"正在逐项安装。单项失败不影响必备环境和其他组件。"));
    body.addView(button("停止后续安装",()->{RuntimeComponents.stop(this);displayed="";renderStatus();}));
   }else optionalAction=primary(targeted()?"安装并继续任务":"安装所选能力",this::confirmSelection);
   if(!targeted()){skipAction=button(onboarding?"暂不安装，开始使用":"完成",this::finishSetup);body.addView(skipAction);updateSelectionActions();}
   else body.addView(button("暂不安装",()->{RuntimeComponents.answer(request,false);request="";finish();}));
   body.addView(secondary("可在「设置 → 能力与组件」中继续安装。可用空间："+getFilesDir().getUsableSpace()/1024/1024+" MiB"));
   body.addView(button("许可与组件来源",this::licenses));
  }catch(Exception error){body.addView(label("无法读取部署状态："+error.getMessage(),13));}
 }
 private boolean hasSelection(){for(String id:selected)if(RuntimeComponents.valid(id)&&!RuntimeComponents.installed(this,id))return true;return false;}
 private void updateSelectionActions(){if(optionalAction!=null&&!targeted()){boolean any=hasSelection(),onboarding=getIntent().getBooleanExtra("onboarding",false);optionalAction.setText(any?"安装所选能力":onboarding?"开始使用 Eva":"完成");optionalAction.setOnClickListener(v->{if(hasSelection())confirmSelection();else finishSetup();});if(skipAction!=null)skipAction.setVisibility(any?View.VISIBLE:View.GONE);}}
 private void confirmSelection(){
  ArrayList<String> ids=new ArrayList<>();for(String id:RuntimeComponents.IDS)if(selected.contains(id)&&!RuntimeComponents.installed(this,id))ids.add(id);
  if(ids.isEmpty()){if(getIntent().getBooleanExtra("onboarding",false))finishSetup();else message("未选择新组件","勾选需要的能力后安装，也可以直接开始使用。");return;}
  StringBuilder names=new StringBuilder();for(String id:ids)names.append("• ").append(RuntimeComponents.title(id)).append('\n');
  new AlertDialog.Builder(this).setTitle("安装所选能力").setMessage(names+"\n将联网下载所需依赖，已有依赖会复用。各组件逐项安装，可取消后续步骤；失败可重试。\n\n当前可用空间："+getFilesDir().getUsableSpace()/1024/1024+" MiB。下载量随仓库版本和已有依赖变化，大型组件可能需要额外空间。").setPositiveButton("开始安装",(d,w)->{try{RuntimeSetupService.launchComponents(this,ids.toArray(new String[0]));}catch(Exception error){message("暂时无法安装",error.getMessage());}displayed="";renderStatus();}).setNegativeButton("取消",null).show();
 }
 private void finishSetup(){if(!RuntimeComponents.prefs(this).edit().putBoolean("onboardingComplete",true).remove("selection").commit()){message("暂时无法保存设置","请检查手机存储后重试。");return;}if(getIntent().getBooleanExtra("onboarding",false))startActivity(new Intent(this,ModelsActivity.class));finish();}
 private void showStorage(){try{
  JSONObject manifest;try(java.io.InputStream in=getAssets().open("runtime/bootstrap.json");java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream()){byte[] buffer=new byte[4096];int n;while((n=in.read(buffer))!=-1)out.write(buffer,0,n);manifest=new JSONObject(out.toString("UTF-8"));}
  JSONObject part=manifest.getJSONArray("components").getJSONObject(0);message("下载与存储","基础环境已随 APK 提供，无需重复联网下载。\n压缩包："+part.getLong("size")/1024/1024+" MiB\n解压内容：约 "+part.getLong("expandedSize")/1024/1024+" MiB\n可用空间："+getFilesDir().getUsableSpace()/1024/1024+" MiB\n\n额外必备依赖需联网安装。办公、开发与专业组件不在本步骤安装。");
  }catch(Exception error){message("存储信息",error.getMessage());}}
 private void licenses(){try(java.io.InputStream in=getAssets().open("runtime/NOTICE.txt");java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream()){byte[] buffer=new byte[4096];int n;while((n=in.read(buffer))!=-1&&out.size()<65536)out.write(buffer,0,n);message("运行环境许可与来源",out.toString("UTF-8")+"\n\n项目采用 PolyForm Noncommercial 1.0.0。第三方组件分别遵循其许可证。");}catch(Exception error){message("来源信息",error.getMessage());}}
 static String stageLabel(String stage){switch(stage){case "checking":return "检查设备与存储空间";case "interrupted":return "恢复中断部署";case "downloading":return "获取基础环境";case "extracting":return "解压基础环境";case "dependencies":return "安装必备依赖";case "verifying":return "验证环境可用性";case "ready":return "必备环境已就绪";case "error":return "安装未完成";case "cancelled":return "安装已取消";default:return "准备运行环境";}}
 protected void onSaveInstanceState(Bundle state){state.putBoolean("advanced",advanced);super.onSaveInstanceState(state);}
 protected void onResume(){super.onResume();handler.post(refresh);}
 protected void onPause(){handler.removeCallbacks(refresh);super.onPause();}
 void leavePage(){if(!request.isEmpty()){RuntimeComponents.answer(request,false);request="";}finish();}
 public void onBackPressed(){leavePage();}
}
