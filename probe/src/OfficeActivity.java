package ai.eva.android.probe;
import android.os.*;
import android.widget.*;
import android.app.AlertDialog;
import android.content.Intent;

/** User-facing install/check and roundtrip verification; output remains in workspace. */
public class OfficeActivity extends ToolPageActivity {
 TextView status,log;Button install,check,test,stop;final java.util.ArrayList<Button> extraActions=new java.util.ArrayList<>();final Handler handler=new Handler();
 final Runnable repaint=new Runnable(){public void run(){if(status==null)return;status.setText(OfficeRuntime.state);if(!log.getText().toString().equals(OfficeRuntime.output))log.setText(OfficeRuntime.output);boolean busy=OfficeRuntime.busy;install.setEnabled(!busy);check.setEnabled(!busy);test.setEnabled(!busy);stop.setEnabled(busy);for(Button action:extraActions)action.setEnabled(!busy);handler.postDelayed(this,500);}};
 public void onCreate(Bundle b){super.onCreate(b);page("办公文档","");
  body.addView(label("在手机本地生成和读取 Word、Excel、PowerPoint 与 PDF。首次使用需下载依赖；文档保存在工作区。",14));
  status=label("正在检查…",14);body.addView(status);
  check=button("检查环境",()->OfficeRuntime.start(this,"status"));body.addView(check);addAction("检查渲染引擎",()->OfficeRuntime.start(this,"render-status"));addAction("安装或修复渲染引擎",()->openComponents());addAction("验证模板与逐页渲染",()->OfficeRuntime.start(this,"render-selftest"));addAction("检查软件安装环境",()->OfficeRuntime.start(this,"runtime-status"));
  install=button("安装办公组件",this::openComponents);body.addView(install);
  test=button("生成四种格式验收样例",()->OfficeRuntime.start(this,"selftest"));body.addView(test);
  stop=button("取消后续步骤",()->{try{OfficeRuntime.cancel(this);}catch(Exception e){status.setText(e.getMessage());}});body.addView(stop);
  body.addView(button("打开工作区文件",()->startActivity(new Intent(this,FilesActivity.class))));
  body.addView(label("可安装 Office 与 HTML 渲染组件。基础 Excel 写入器保留公式；需要重算时使用 Calc。静态页面预览不验证播放动画。安装时保持本页打开，完成后运行检查与验收。",12));
  ScrollView scroll=new ScrollView(this);log=label("",11);log.setTypeface(android.graphics.Typeface.MONOSPACE);log.setTextIsSelectable(true);scroll.addView(log);body.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
  if(!OfficeRuntime.busy)OfficeRuntime.start(this,"status");
 }
 void openComponents(){startActivity(new Intent(this,RuntimeSetupActivity.class).putExtra("component","office"));}
 void addAction(String title,Runnable work){Button action=button(title,work);extraActions.add(action);body.addView(action);}
 protected void onResume(){super.onResume();handler.post(repaint);}
 protected void onPause(){handler.removeCallbacks(repaint);super.onPause();}
 void leavePage(){if(OfficeRuntime.busy){new AlertDialog.Builder(this).setMessage("办公环境操作仍在进行。可取消后续步骤，等待当前包事务结束后离开。").setPositiveButton("取消后续步骤",(d,w)->{try{OfficeRuntime.cancel(this);}catch(Exception e){status.setText(e.getMessage());}}).setNegativeButton("继续等待",null).show();}else finish();}
 public void onBackPressed(){leavePage();}
}
