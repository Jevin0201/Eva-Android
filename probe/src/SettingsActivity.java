package ai.eva.android.probe;
import android.app.*;
import android.os.*;
import android.content.*;
import android.net.Uri;
import android.view.*;
import android.widget.*;
import java.io.File;

/** Settings backed by application preferences and observed local state. */
public class SettingsActivity extends Activity {
    LinearLayout content;
    android.content.SharedPreferences prefs;
    int dp(int n){return (int)(n*getResources().getDisplayMetrics().density+.5f);}
    TextView text(String value,int size){TextView v=new TextView(this);v.setText(value);v.setTextSize(size);v.setTextColor(0xff1a1c1f);v.setPadding(0,dp(8),0,dp(8));return v;}
    void section(String name){TextView v=text(name,19);v.setTypeface(null,1);content.addView(v);}
    void action(String title,Runnable task){Button b=new Button(this);b.setText(title);b.setAllCaps(false);EvaUi.style(b);b.setOnClickListener(v->task.run());content.addView(b);}
    void detail(String title,String message){new AlertDialog.Builder(this).setTitle(title).setMessage(message).setPositiveButton("关闭",null).show();}
    public static String validateUrl(String value){return BrowserAddress.normalize(value);}
    public void onCreate(Bundle state){super.onCreate(state);prefs=getSharedPreferences("eva-settings",MODE_PRIVATE);LinearLayout root=new LinearLayout(this);root.setOrientation(1);root.setBackgroundColor(0xffffffff);root.setOnApplyWindowInsetsListener((v,i)->{v.setPadding(i.getSystemWindowInsetLeft(),i.getSystemWindowInsetTop(),i.getSystemWindowInsetRight(),i.getSystemWindowInsetBottom());return i;});setContentView(root);Button back=new Button(this);back.setText("返回 · 设置");EvaUi.style(back);back.setOnClickListener(v->finish());root.addView(back);ScrollView scroll=new ScrollView(this);content=new LinearLayout(this);content.setOrientation(1);content.setPadding(dp(20),dp(8),dp(20),dp(24));scroll.addView(content);root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));render();}
    void render(){content.removeAllViews();
        section("账号与模型");content.addView(text("尚未连接模型",14));content.addView(text("沿用桌面 Eva 的账号登录与 Responses API 提供商方式。手机端认证与模型调用尚未接通。",13));action("查看接入方式",()->detail("账号与模型","账号登录：需要手机端代理内核支持授权。\n\nAPI 提供商：需要实现安全密钥存储、模型发现和调用测试。\n\n本页不会读取桌面账号或密钥。"));
        section("任务执行");content.addView(text("命令超时："+prefs.getInt("commandTimeout",120)+" 秒",14));action("设置命令超时",()->new AlertDialog.Builder(this).setTitle("命令超时").setItems(new String[]{"30 秒","60 秒","120 秒","300 秒"},(d,n)->{prefs.edit().putInt("commandTimeout",new int[]{30,60,120,300}[n]).apply();render();}).show());content.addView(text("超时会取消命令进程组。后台长期运行服务尚未接入。",13));
        section("内置浏览器");content.addView(text("启动页："+prefs.getString("browserHome","https://example.com"),14));action("修改启动页",()->{EditText field=new EditText(this);field.setSingleLine();field.setInputType(17);field.setText(prefs.getString("browserHome","https://example.com"));AlertDialog dialog=new AlertDialog.Builder(this).setTitle("浏览器启动页").setView(field).setPositiveButton("保存",null).setNegativeButton("取消",null).create();dialog.setOnShowListener(d->dialog.getButton(-1).setOnClickListener(v->{try{String url=validateUrl(field.getText().toString());prefs.edit().putString("browserHome",url).apply();dialog.dismiss();render();}catch(IllegalArgumentException e){field.setError(e.getMessage());}}));dialog.show();});
        section("手机权限");content.addView(text("无障碍控制和截图服务尚未接入；本机终端不等于跨 App 控制。",13));action("系统应用设置",()->startActivity(new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS,Uri.parse("package:"+getPackageName()))));
        section("工作区与运行环境");File linux=new File(getFilesDir(),"alpine");content.addView(text("Linux 文件："+(new File(linux,"bin/busybox").isFile()?"已导入":"未导入")+"\nPython："+(new File(linux,"usr/bin/python3").exists()?"文件存在":"未发现")+"\nNode.js："+(new File(linux,"usr/bin/node").exists()?"文件存在":"未发现")+"\n可用空间："+(getFilesDir().getUsableSpace()/1024/1024)+" MiB",14));content.addView(text("必备环境部署与可选能力分别管理，办公、开发和专业工具可随用随装。",12));action("能力与组件",()->startActivity(new Intent(this,RuntimeSetupActivity.class)));action("打开工作区",()->{Intent i=new Intent(this,LocalToolsActivity.class);i.putExtra("tool","files");startActivity(i);});action("运行环境诊断",()->startActivity(new Intent(this,MainActivity.class)));
        section("数据与版本");content.addView(text("会话与任务记录保存在此手机。当前为开发版，云模型、手机控制、完整浏览器工具与 APK 构建尚未完成。",13));content.addView(text("Android "+Build.VERSION.RELEASE+" · API "+Build.VERSION.SDK_INT+"\nEva Android 开发版 0.0.2",12));
    }
}
