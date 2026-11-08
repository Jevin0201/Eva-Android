package ai.eva.android.probe;
import android.app.*;import android.content.*;import android.os.*;import android.widget.*;import org.json.*;
public class PhoneControlActivity extends ToolPageActivity {
 PhoneControlSetup setup;int learningRevision;
 TextView status;Switch background,preview;boolean requestedKeep,awaitingPreviewPermission;final Handler stateTimer=new Handler();final Runnable statusTick=new Runnable(){public void run(){refreshStatus();if(setup!=null)setup.advance();stateTimer.postDelayed(this,1000);}};
 public void onCreate(Bundle b){super.onCreate(b);setup=new PhoneControlSetup(this,b);if(b==null&&getIntent().getBooleanExtra("setup",false))new Handler(getMainLooper()).post(()->setup.start());page("手机控制","");root.removeView(body);ScrollView scroll=new ScrollView(this);scroll.setFillViewport(true);scroll.addView(body,new ScrollView.LayoutParams(-1,-2));root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));if(getIntent().getBooleanExtra("report-preview",false))new Handler().postDelayed(()->PhoneTaskReport.preview(this),1000);}
 protected void onResume(){super.onResume();PhoneTaskService.restore(this);draw();setup.advance();if(awaitingPreviewPermission){awaitingPreviewPermission=false;if(android.provider.Settings.canDrawOverlays(this))PhoneAgentPreview.show(this);}stateTimer.post(statusTick);}protected void onPause(){stateTimer.removeCallbacks(statusTick);super.onPause();}void refreshStatus(){PhoneAgentDisplay.restore(this);if(background!=null&&background.isChecked()!=PhoneAgentDisplay.desired(this)){background.setOnCheckedChangeListener(null);background.setChecked(PhoneAgentDisplay.desired(this));bindBackgroundSwitch();}if(preview!=null&&preview.isChecked()!=PhoneAgentPreview.enabled(this)){preview.setOnCheckedChangeListener(null);preview.setChecked(PhoneAgentPreview.enabled(this));bindPreviewSwitch();}if(status==null)return;String state=PhoneAccessibility.live==null?"无障碍未连接":PhoneAccessibility.armed?"控制已开启":"控制已停止";String reason=getSharedPreferences("eva-phone",0).getString("reason","");status.setText(state+(PhoneTaskService.keep(this)?" · 保持开启":"")+(reason.isEmpty()?"":"\n"+reason)+"\n"+PhoneAgentDisplay.status(this)+"\n"+PhoneAgentPreview.state(this));}
 void draw(){clear();section("连接状态");status=label(PhoneAccessibility.live==null?"无障碍：尚未连接":PhoneAccessibility.armed?"无障碍：已连接 · 控制已开启":"无障碍：已连接 · 控制已停止",14);statusCard(status);body.addView(status);section("控制授权");body.addView(button("一键启用全部手机能力",()->setup.start()));body.addView(label("按顺序引导系统授权，完成后记住选择并自动恢复。系统确认后返回 Eva，会继续下一步。",13));Switch keepSwitch=new Switch(this);keepSwitch.setText("保持手机控制开启");keepSwitch.setTextColor(ink);keepSwitch.setPadding(0,dp(12),0,dp(12));keepSwitch.setChecked(PhoneTaskService.keep(this));keepSwitch.setOnCheckedChangeListener((v,checked)->{if(checked){requestedKeep=true;requestEnable();}else{setup.cancel();PhoneTools.stop(this);draw();}});body.addView(keepSwitch);body.addView(label("开启后记住选择，切换 App 和返回桌面不关闭；服务断开时自动重连；若已授权且运行 Shizuku，会恢复系统无障碍启用项。手动停止会关闭自动恢复。",13));body.addView(label("开启后 Eva 可读取当前页面、截图、点击和输入。任务涉及的页面内容将交给你选择的云端模型。请保持手机解锁；可选择主屏或独立后台屏执行。",14));body.addView(label(((PowerManager)getSystemService(POWER_SERVICE)).isIgnoringBatteryOptimizations(getPackageName())?"后台保活：已豁免系统电池优化":"后台保活：仍受电池优化限制",13));body.addView(button("后台与电池设置",()->startActivity(new Intent(android.provider.Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))));body.addView(button("1 · 打开系统无障碍设置",()->startActivity(new Intent(android.provider.Settings.ACTION_ACCESSIBILITY_SETTINGS))));section("应用启动确认");addReportSwitch("自动选择始终允许","allowAppLaunchConfirmations");body.addView(label("自动确认 Eva 为当前任务发起的应用打开提示，可随时关闭。",13));section("后台执行屏");background=new Switch(this);background.setText("在独立后台屏操作 App");background.setTextColor(ink);background.setChecked(PhoneAgentDisplay.desired(this));bindBackgroundSwitch();body.addView(background);body.addView(label("需要 Android 14 及以上和 Shizuku 授权。开启后记住选择，连接中断时保留并自动恢复。App 启动、读屏、节点输入和手势使用后台屏；恢复期间暂停手机操作。手动停止控制会关闭此选择。",13));preview=new Switch(this);preview.setText("显示实时悬浮预览");preview.setTextColor(ink);preview.setChecked(PhoneAgentPreview.enabled(this));bindPreviewSwitch();body.addView(preview);body.addView(label("后台操作时显示实时画面，可拖动、收起或关闭。预览仅查看，关闭预览不停止后台任务。",13));body.addView(button("授权悬浮窗 / 打开实时预览",()->showAgentPreview()));section("任务反馈");addReportSwitch("任务结束后返回 Eva","returnAfterTask");addReportSwitch("灵动岛显示任务进度","taskPill");section("手动控制");body.addView(button("临时开启手机控制",()->{requestedKeep=false;requestEnable();}));body.addView(button("停止控制",()->{setup.cancel();PhoneTools.stop(this);draw();}));learningSection();section("测试与诊断");body.addView(button("预览任务进度提示",()->PhoneTaskReport.preview(this)));body.addView(button("运行安全测试页",()->startActivity(new Intent(this,PhoneFixtureActivity.class))));body.addView(label(getSharedPreferences("eva-phone-check",0).getString("result",""),12));body.addView(button("测试：打开手机相册",()->{PhoneTools.serial.execute(()->{String message;try{PhoneTools.execute(this,new JSONObject().put("action","open_gallery"));message="已请求打开相册";}catch(Exception e){message=e.getMessage();}final String text=message;runOnUiThread(()->status.setText(text));});}));section("增强能力");body.addView(button("授权 Shizuku / ADB 增强",()->{try{PhoneShell.authorize();}catch(Exception e){status.setText(e.getMessage());}}));body.addView(label(PhoneShell.authorized()?"Shizuku：已授权":"Shizuku：未授权",13));body.addView(label("ADB / Shell 增强：需启动 Shizuku 并单独授权，未授权时不会执行系统命令。\n开启后返回 Eva，新建对话并说明要执行的手机任务。通知栏可随时停止。",13));}
 void learningSection(){
  section("按软件学习流程");
  TextView learning=label("正在读取学习状态…",13);body.addView(learning);
  body.addView(label("成功的安全节点导航会按软件与版本自动记录。已学待复核表示已观察到操作完成；核验目标后才标记已核验。其他 App 可在任务中学习，截图坐标、输入和发送等操作仍需实时处理。",12));
  body.addView(button("刷新学习状态",()->refreshLearning(learning)));refreshLearning(learning);
 }
 void refreshLearning(TextView learning){
  final int revision=++learningRevision;
  new Thread(()->{
   String message;
   try{
    JSONArray routes=PhoneRouteTools.list(this,new PhoneRouteStore(this),"","").getJSONArray("routes");
    java.util.TreeMap<String,int[]> groups=new java.util.TreeMap<>();
    for(int i=0;i<routes.length();i++){
     JSONObject route=routes.getJSONObject(i);String app=route.optString("package");if(app.isEmpty())app="旧版未绑定流程";
     int[] count=groups.get(app);if(count==null){count=new int[4];groups.put(app,count);}
     String state=route.getJSONObject("calibration").getString("state");
     if(state.equals("verified"))count[0]++;else if(state.equals("observed")||state.equals("candidate"))count[1]++;else if(state.equals("app_unavailable"))count[3]++;else count[2]++;
    }
    StringBuilder text=new StringBuilder();
    for(java.util.Map.Entry<String,int[]> entry:groups.entrySet()){
     String name=entry.getKey();try{name=getPackageManager().getApplicationLabel(getPackageManager().getApplicationInfo(name,0)).toString()+" · "+name;}catch(android.content.pm.PackageManager.NameNotFoundException ignored){}
     int[] count=entry.getValue();if(text.length()>0)text.append("\n\n");text.append(name);
     if(count[0]>0)text.append("\n已核验 ").append(count[0]);if(count[1]>0)text.append(" · 已学待复核 ").append(count[1]);if(count[2]>0)text.append(" · 待重学 ").append(count[2]);if(count[3]>0)text.append(" · 软件不可用 ").append(count[3]);
    }
    message=text.length()==0?"可学习：还没有保存流程。让 Eva 使用多步手机工具完成一次安全导航后，这里会显示对应软件。":text.toString();
   }catch(Exception error){message="学习状态读取失败，请刷新重试";}
   final String value=message;runOnUiThread(()->{if(revision==learningRevision&&!isFinishing()&&learning.getParent()!=null)learning.setText(value);});
  },"eva-route-summary").start();
 }
 void bindBackgroundSwitch(){background.setOnCheckedChangeListener((view,on)->{try{PhoneAgentDisplay.setEnabled(this,on);refreshStatus();}catch(Exception error){draw();status.setText(error.getMessage()+"\n"+PhoneAgentDisplay.status(this)+"\n"+PhoneAgentPreview.state(this));}});}
 void bindPreviewSwitch(){preview.setOnCheckedChangeListener((view,on)->{PhoneAgentPreview.setEnabled(this,on);refreshStatus();});}
 void showAgentPreview(){
  PhoneAgentPreview.setEnabled(this,true);
  if(!android.provider.Settings.canDrawOverlays(this)){
   awaitingPreviewPermission=true;
   try{startActivity(new Intent(android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION,android.net.Uri.parse("package:"+getPackageName())));}
   catch(Exception error){awaitingPreviewPermission=false;status.setText("无法打开悬浮窗权限设置，请在系统应用设置中授权");}
  }else{PhoneAgentPreview.show(this);refreshStatus();}
 }
 void addReportSwitch(String title,String key){Switch toggle=new Switch(this);toggle.setText(title);toggle.setTextColor(ink);toggle.setPadding(0,dp(12),0,dp(12));toggle.setChecked(PhoneTaskReport.enabled(this,key));toggle.setOnCheckedChangeListener((v,on)->{getSharedPreferences("eva-phone",0).edit().putBoolean(key,on).apply();if(key.equals("taskPill")&&!on)PhoneTaskReport.close(this);});body.addView(toggle);}
 void requestEnable(){if(PhoneAccessibility.live==null&&!requestedKeep){draw();status.setText("请先在系统无障碍设置中开启 Eva");return;}if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)!=0){requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS},20);return;}enable();}
 void enable(){try{if(requestedKeep)PhoneTaskService.setKeep(this,true);PhoneAccessibility.generation++;PhoneAccessibility.armed=PhoneAccessibility.live!=null;startForegroundService(new Intent(this,PhoneTaskService.class).setAction("session").putExtra("generation",PhoneAccessibility.generation));PhoneTaskService.reason(this,"");PhoneAgentDisplay.restore(this);draw();}catch(Exception e){PhoneAccessibility.stopControl();PhoneTaskService.reason(this,"启动失败："+e.getMessage());draw();}}
 public void onRequestPermissionsResult(int r,String[] p,int[] g){super.onRequestPermissionsResult(r,p,g);if(r==20){if(g.length>0&&g[0]==0)enable();else{draw();status.setText("请允许通知，以便从通知栏随时停止控制");}}}
 protected void onSaveInstanceState(Bundle state){super.onSaveInstanceState(state);setup.save(state);}
 static final class PackageManagerPermission{static final int GRANTED=0;}
}
