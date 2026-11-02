package ai.eva.android.probe;
import android.app.*;
import android.os.Bundle;
import android.view.*;
import android.widget.*;
import android.webkit.*;
import java.io.*;
import java.nio.file.*;
import java.util.concurrent.TimeUnit;

/** Dedicated terminal screen and execution lifecycle. */
public class TerminalActivity extends ToolPageActivity {
    TextView output,taskState;EditText command;volatile boolean running;File cancel;View runControl,stopControl,historyControl;
    static String stateLabel(String value){switch(value){case "succeeded":return "已完成";case "failed":return "失败";case "cancelled":return "已取消";case "timed_out":return "已超时";case "interrupted":return "已中断";case "running":return "执行中";default:return value;}}
    public void onCreate(Bundle state){super.onCreate(state);page("终端","");android.content.SharedPreferences prefs=getSharedPreferences("eva-terminal",0);if(!prefs.contains("command"))prefs.edit().putString("command",getSharedPreferences("LocalToolsActivity",0).getString("command","python3 --version; node --version; git --version")).apply();terminal();}
    void terminal(){clear();
        stopControl=actionIcon("stop","停止任务",()->{if(running&&cancel!=null)try{cancel.createNewFile();taskState.setText("正在停止…");}catch(Exception e){taskState.setText("停止失败");}});historyControl=actionIcon("history","命令历史",()->showHistory());header.addView(stopControl);header.addView(historyControl);
        LinearLayout context=new LinearLayout(this);context.setGravity(Gravity.CENTER_VERTICAL);TextView path=label("工作区  /root/eva-workspace",11);path.setTextColor(0xff858b92);path.setSingleLine();path.setEllipsize(android.text.TextUtils.TruncateAt.MIDDLE);context.addView(path,new LinearLayout.LayoutParams(0,dp(40),1));taskState=label("就绪",11);taskState.setTextColor(0xff568466);context.addView(taskState);body.addView(context);
        ScrollView scroll=new ScrollView(this);scroll.setFillViewport(true);scroll.setBackground(EvaUi.surface(this,0xff171b22,14));output=new TextView(this);output.setTextSize(13);output.setTextColor(0xffdce3ed);output.setTextIsSelectable(true);output.setTypeface(android.graphics.Typeface.MONOSPACE);output.setPadding(dp(14),dp(16),dp(14),dp(16));output.setLineSpacing(dp(3),1);output.setText("Eva Terminal\n\n在手机工作区运行命令。\n输入命令后，点击右侧运行按钮。");try{File previous=new File(getFilesDir(),"last-command.txt");if(previous.isFile()){output.setText(new String(Files.readAllBytes(previous.toPath()),"UTF-8"));taskState.setText("上次输出");}}catch(Exception ignored){}scroll.addView(output);body.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
        LinearLayout editor=new LinearLayout(this);editor.setGravity(Gravity.CENTER_VERTICAL);editor.setPadding(dp(12),dp(6),dp(6),dp(6));editor.setBackground(EvaUi.surface(this,paper==0xffFFFFFF?0xfff3f5f7:0xff282c32,14));LinearLayout.LayoutParams editorLp=new LinearLayout.LayoutParams(-1,-2);editorLp.topMargin=dp(12);body.addView(editor,editorLp);
        TextView prompt=label("$",18);prompt.setTextColor(0xff3984ff);editor.addView(prompt,new LinearLayout.LayoutParams(dp(24),-2));command=new EditText(this);command.setTextSize(13);command.setTextColor(ink);command.setHintTextColor(0xff858b92);command.setTypeface(android.graphics.Typeface.MONOSPACE);command.setBackgroundColor(android.graphics.Color.TRANSPARENT);command.setHint("输入命令…");command.setInputType(android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_FLAG_MULTI_LINE|android.text.InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);command.setImeOptions(android.view.inputmethod.EditorInfo.IME_FLAG_NO_EXTRACT_UI);command.setMinLines(2);command.setMaxLines(4);command.setText(getSharedPreferences("eva-terminal",0).getString("command",""));editor.addView(command,new LinearLayout.LayoutParams(0,-2,1));runControl=actionIcon("send","运行命令",()->runCommand());runControl.setBackground(EvaUi.surface(this,0xff3984ff,22));((ImageView)runControl).setColorFilter(0xffFFFFFF);editor.addView(runControl);
        command.addTextChangedListener(new android.text.TextWatcher(){public void beforeTextChanged(CharSequence s,int start,int count,int after){}public void onTextChanged(CharSequence s,int start,int before,int count){terminalControls();}public void afterTextChanged(android.text.Editable e){}});terminalControls();
    }
    void terminalControls(){runControl.setEnabled(!running&&!command.getText().toString().trim().isEmpty());runControl.setAlpha(runControl.isEnabled()?1f:.35f);stopControl.setEnabled(running);stopControl.setAlpha(running?1f:.3f);historyControl.setEnabled(!running);historyControl.setAlpha(running?.3f:1f);}
    void runCommand(){if(running)return;String text=command.getText().toString().trim();if(text.isEmpty())return;
        String id=java.util.UUID.randomUUID().toString();cancel=new File(getFilesDir(),"alpine/root/cancel-"+id);running=true;terminalControls();output.setText("");taskState.setText("正在启动任务");getSharedPreferences("eva-terminal",0).edit().putString("command",text).apply();
        new Thread(()->{try{
            String lib=getApplicationInfo().nativeLibraryDir;
            ProcessBuilder pb=new ProcessBuilder(lib+"/liboperit_proot.so","-0","-r",new File(getFilesDir(),"alpine").getAbsolutePath(),"-b","/dev","-b","/proc","-w","/root/eva-workspace","/usr/bin/python3","/root/eva-command.py",text,"/root/cancel-"+id,String.valueOf(getSharedPreferences("eva-settings",MODE_PRIVATE).getInt("commandTimeout",120)));
            pb.environment().put("PROOT_LOADER",lib+"/liboperit_loader.so");pb.environment().put("PROOT_TMP_DIR",new File(getFilesDir(),"tmp").getAbsolutePath());pb.environment().put("PATH","/usr/bin:/bin:/usr/sbin:/sbin");pb.redirectErrorStream(true);
            Process p=pb.start();StringBuilder result=new StringBuilder();String finalState="unknown";long lastPaint=0;
            try(BufferedReader reader=new BufferedReader(new InputStreamReader(p.getInputStream(),"UTF-8"))){String line;while((line=reader.readLine())!=null){
                try{org.json.JSONObject event=new org.json.JSONObject(line);String type=event.optString("type");
                    if(type.equals("output")){String chunk=event.optString("text");int remaining=150000-result.length();if(remaining>0)result.append(chunk.substring(0,Math.min(remaining,chunk.length())));if(System.currentTimeMillis()-lastPaint>100){lastPaint=System.currentTimeMillis();String update=result.toString();runOnUiThread(()->output.setText(update));}}
                    else if(type.equals("started")){String taskId=event.optString("taskId");runOnUiThread(()->taskState.setText("执行中 · "+taskId.substring(0,8)));}
                    else if(type.equals("result")){finalState=event.optString("state");String status=stateLabel(finalState)+" · 退出码 "+event.optInt("exitCode");runOnUiThread(()->taskState.setText(status));}
                }catch(org.json.JSONException malformed){result.append(line).append('\n');}
            }}
            int code=p.waitFor();String done=result+"\n状态："+stateLabel(finalState)+" · 执行器退出码："+code;
            File temp=new File(getFilesDir(),"last-command.tmp");Files.write(temp.toPath(),done.getBytes("UTF-8"));Files.move(temp.toPath(),new File(getFilesDir(),"last-command.txt").toPath(),StandardCopyOption.REPLACE_EXISTING);runOnUiThread(()->output.setText(done));
        }catch(Exception e){runOnUiThread(()->{output.setText("执行失败："+e.getMessage());taskState.setText("执行失败");});}finally{running=false;runOnUiThread(()->terminalControls());}},"eva-local-command").start();
    }
    void showHistory(){if(running)return;File folder=new File(getFilesDir(),"alpine/root/eva-tasks");File[] tasks=folder.listFiles();if(tasks==null)return;java.util.Arrays.sort(tasks,(a,b)->Long.compare(b.lastModified(),a.lastModified()));java.util.ArrayList<String> labels=new java.util.ArrayList<>();java.util.ArrayList<File> selected=new java.util.ArrayList<>();for(File task:tasks){try{org.json.JSONObject state=new org.json.JSONObject(new String(Files.readAllBytes(new File(task,"state.json").toPath()),"UTF-8"));labels.add(stateLabel(state.optString("state"))+" · "+state.optJSONArray("argv").optString(2));selected.add(task);}catch(Exception ignored){}}if(labels.isEmpty()){Toast.makeText(this,"还没有命令历史",Toast.LENGTH_SHORT).show();return;}new AlertDialog.Builder(this).setTitle("命令历史").setItems(labels.toArray(new String[0]),(dialog,n)->{try{StringBuilder text=new StringBuilder();java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream();for(String line:Files.readAllLines(new File(selected.get(n),"events.jsonl").toPath())){org.json.JSONObject e=new org.json.JSONObject(line);if(e.optString("type").equals("output")&&bytes.size()<150000)bytes.write(android.util.Base64.decode(e.getString("base64"),android.util.Base64.DEFAULT));}text.append(bytes.toString("UTF-8"));output.setText(text);taskState.setText(labels.get(n));}catch(Exception e){output.setText(e.toString());}}).setNegativeButton("关闭",null).show();}

    protected void onPause(){if(command!=null)getSharedPreferences("eva-terminal",0).edit().putString("command",command.getText().toString()).apply();super.onPause();}
    void leavePage(){if(running){new AlertDialog.Builder(this).setMessage("任务仍在运行。停止后可离开终端。").setPositiveButton("停止任务",(d,w)->{try{cancel.createNewFile();taskState.setText("正在停止…");}catch(Exception e){taskState.setText("停止失败："+e.getMessage());}}).setNegativeButton("继续等待",null).show();return;}finish();}
    public void onBackPressed(){leavePage();}
    protected void onDestroy(){if(running&&cancel!=null)try{cancel.createNewFile();}catch(IOException ignored){}super.onDestroy();}
}
