package ai.eva.android.probe;

import android.app.AlertDialog;
import android.os.Bundle;
import android.widget.*;
import android.view.View;
import org.json.*;

/** Local version management; no remote credentials, push, checkout or destructive reset. */
public class GitActivity extends ToolPageActivity {
 String folder;JSONObject state;boolean busy;String commitDraft="";
 public void onCreate(Bundle saved){super.onCreate(saved);folder=getIntent().getStringExtra("folder");if(folder==null)folder="";page("版本管理","");header.addView(actionIcon("refresh","刷新 Git 状态",()->load()));load();}
 JSONObject request(String action)throws JSONException{return new JSONObject().put("action",action).put("folder",folder).put("token",state==null?"":state.optString("token"));}
 interface Result {void accept(JSONObject result)throws Exception;}
 void run(JSONObject request,Result result){if(busy)return;busy=true;clear();body.addView(label("正在读取或更新仓库…",14));new Thread(()->{JSONObject response=null;String error=null;try{response=WorkspaceGit.execute(this,request);}catch(Exception e){error=e.getMessage();}final JSONObject done=response;final String failure=error;runOnUiThread(()->{busy=false;if(isFinishing()||isDestroyed())return;if(failure!=null){clear();body.addView(label(failure,14));body.addView(button("刷新状态",()->load()));return;}try{result.accept(done);}catch(Exception e){clear();body.addView(label("无法显示 Git 结果",14));}});},"eva-git").start();}
 void load(){try{run(request("status"),result->{state=result;draw();});}catch(Exception ignored){}}
 void mutate(String action,String path){try{JSONObject req=request(action);if(path!=null)req.put("path",path);run(req,result->{state=result;draw();});}catch(Exception ignored){}}
 void draw()throws Exception {clear();body.addView(label("工作区 / "+folder,12));
  if(!state.optBoolean("repository")){body.addView(label("这个目录尚未初始化 Git。初始化将创建本地版本记录。",14));body.addView(button("初始化仓库",()->new AlertDialog.Builder(this).setTitle("初始化本地仓库").setMessage("目录："+folder+"\n不会自动暂存或提交任何文件。").setPositiveButton("初始化",(d,w)->mutate("init",null)).setNegativeButton("取消",null).show()));return;}
  body.addView(label("分支："+state.optString("branch"),13));JSONArray files=state.getJSONArray("files");
  body.addView(label(files.length()==0?"工作区干净":files.length()+" 个变更 · 点击查看与暂存",12));
  ScrollView scroll=new ScrollView(this);LinearLayout list=new LinearLayout(this);list.setOrientation(1);scroll.addView(list);body.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));boolean staged=false;
  for(int i=0;i<files.length();i++){JSONObject item=files.getJSONObject(i);String code=item.getString("code"),path=item.getString("path");if(code.charAt(0)!=' '&&code.charAt(0)!='?')staged=true;Button row=button(code+"  "+path,()->showFile(item));row.setGravity(android.view.Gravity.START|android.view.Gravity.CENTER_VERTICAL);list.addView(row,new LinearLayout.LayoutParams(-1,-2));}
  Button commit=button("提交已暂存的变更",()->commitForm());commit.setEnabled(staged);body.addView(commit);body.addView(label("只操作本地仓库；不会推送到远程。",11));
 }
 void showFile(JSONObject item){String path=item.optString("path"),code=item.optString("code");java.util.ArrayList<String> titles=new java.util.ArrayList<>();java.util.ArrayList<Runnable> actions=new java.util.ArrayList<>();titles.add("查看工作区差异");actions.add(()->diff(path,false));if(code.charAt(0)!=' '&&code.charAt(0)!='?'){titles.add("查看已暂存差异");actions.add(()->diff(path,true));titles.add("取消暂存（保留文件）");actions.add(()->mutate("unstage",path));}if(code.charAt(1)!=' '){titles.add("暂存此文件");actions.add(()->mutate("stage",path));}new AlertDialog.Builder(this).setTitle(path).setItems(titles.toArray(new String[0]),(d,n)->actions.get(n).run()).setNegativeButton("关闭",null).show();}
 void diff(String path,boolean staged){try{run(request("diff").put("path",path).put("staged",staged),result->{clear();body.addView(label((staged?"已暂存":"工作区")+" · "+path,13));ScrollView scroll=new ScrollView(this);TextView content=label(result.optString("text").isEmpty()?"没有文本差异":result.optString("text"),12);content.setTypeface(android.graphics.Typeface.MONOSPACE);content.setTextIsSelectable(true);scroll.addView(content);body.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));if(result.optBoolean("truncated"))body.addView(label("内容超过 256 KB，仅显示前段。",11));body.addView(button("返回变更列表",()->load()));});}catch(Exception ignored){}}
 void commitForm(){if(busy)return;LinearLayout form=new LinearLayout(this);form.setOrientation(1);form.setPadding(dp(20),0,dp(20),0);EditText message=new EditText(this),name=new EditText(this),email=new EditText(this);message.setHint("提交说明");message.setText(commitDraft);name.setHint("作者名称");email.setHint("作者邮箱");name.setSingleLine();email.setSingleLine();name.setText(getPreferences(0).getString("name",""));email.setText(getPreferences(0).getString("email",""));form.addView(message);form.addView(name);form.addView(email);form.addView(label("仅提交已暂存内容；未暂存修改会保留。提交不会推送到远程，也不会运行仓库钩子。",12));AlertDialog dialog=new AlertDialog.Builder(this).setTitle("创建本地提交").setView(form).setPositiveButton("提交",null).setNegativeButton("取消",null).create();dialog.setOnDismissListener(d->commitDraft=message.getText().toString());dialog.setOnShowListener(d->dialog.getButton(-1).setOnClickListener(v->{try{String m=message.getText().toString().trim(),n=name.getText().toString().trim(),e=email.getText().toString().trim();if(m.isEmpty()||n.isEmpty()||!e.contains("@")){Toast.makeText(this,"请填写提交说明、作者和邮箱",1).show();return;}JSONObject req=request("commit").put("message",m).put("name",n).put("email",e);getPreferences(0).edit().putString("name",n).putString("email",e).apply();dialog.dismiss();run(req,result->{commitDraft="";state=result;draw();Toast.makeText(this,"本地提交已创建",0).show();});}catch(Exception ignored){}}));dialog.show();}
 void leavePage(){if(busy){Toast.makeText(this,"正在处理 Git 操作，请稍候",0).show();return;}finish();}
 public void onBackPressed(){leavePage();}
}
