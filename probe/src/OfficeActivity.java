package ai.eva.android.probe;
import android.os.*;
import android.widget.*;
import android.app.AlertDialog;
import android.content.Intent;

/** User-facing install/check and roundtrip verification; output remains in workspace. */
public class OfficeActivity extends ToolPageActivity {
 TextView status,log;Button install,check,test,stop;final Handler handler=new Handler();
 final Runnable repaint=new Runnable(){public void run(){if(status==null)return;status.setText(OfficeRuntime.state);if(!log.getText().toString().equals(OfficeRuntime.output))log.setText(OfficeRuntime.output);boolean busy=OfficeRuntime.busy;install.setEnabled(!busy);check.setEnabled(!busy);test.setEnabled(!busy);stop.setEnabled(busy);handler.postDelayed(this,500);}};
 public void onCreate(Bundle b){super.onCreate(b);page("办公文档","");
  body.addView(label("在手机本地生成和读取 Word、Excel、PowerPoint 与 PDF。首次使用需下载依赖；文档保存在工作区。",14));
  status=label("正在检查…",14);body.addView(status);
  check=button("检查环境",()->OfficeRuntime.start(this,"status"));body.addView(check);
  install=button("安装或修复办公依赖",()->new AlertDialog.Builder(this).setTitle("安装办公依赖").setMessage("从 Alpine 官方镜像和 Python 官方包及其镜像下载依赖与中文字体。需要网络及存储空间；不会上传你的文档。已安装的系统依赖会保留。是否开始？").setPositiveButton("开始安装",(d,w)->OfficeRuntime.start(this,"install")).setNegativeButton("取消",null).show());body.addView(install);
  test=button("生成四种格式验收样例",()->OfficeRuntime.start(this,"selftest"));body.addView(test);
  stop=button("取消后续步骤",()->{try{OfficeRuntime.cancel(this);}catch(Exception e){status.setText(e.getMessage());}});body.addView(stop);
  body.addView(button("打开工作区文件",()->startActivity(new Intent(this,FilesActivity.class))));
  body.addView(label("不含 Office 排版渲染引擎；Excel 公式保留但不自动重算。安装时保持本页打开，系统回收后可重新检查与重试。",12));
  ScrollView scroll=new ScrollView(this);log=label("",11);log.setTypeface(android.graphics.Typeface.MONOSPACE);log.setTextIsSelectable(true);scroll.addView(log);body.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
  if(!OfficeRuntime.busy)OfficeRuntime.start(this,"status");
 }
 protected void onResume(){super.onResume();handler.post(repaint);}
 protected void onPause(){handler.removeCallbacks(repaint);super.onPause();}
 void leavePage(){if(OfficeRuntime.busy){new AlertDialog.Builder(this).setMessage("办公环境操作仍在进行。可取消后续步骤，等待当前包事务结束后离开。").setPositiveButton("取消后续步骤",(d,w)->{try{OfficeRuntime.cancel(this);}catch(Exception e){status.setText(e.getMessage());}}).setNegativeButton("继续等待",null).show();}else finish();}
 public void onBackPressed(){leavePage();}
}
