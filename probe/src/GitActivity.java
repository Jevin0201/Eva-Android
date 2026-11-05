package ai.eva.android.probe;

import android.app.AlertDialog;
import android.os.Bundle;
import android.widget.*;
import android.view.View;
import org.json.*;

/** Local and remote version management through the scoped workspace Git service. */
public class GitActivity extends ToolPageActivity {
 String folder;JSONObject state;boolean busy;String commitDraft="";
 public void onCreate(Bundle saved){super.onCreate(saved);folder=getIntent().getStringExtra("folder");if(folder==null)folder="";page("版本管理","");header.addView(actionIcon("file","远程与分支",()->operations()));header.addView(actionIcon("refresh","刷新 Git 状态",()->load()));load();}
 JSONObject request(String action)throws JSONException{return new JSONObject().put("action",action).put("folder",folder).put("token",state==null?"":state.optString("token"));}
 interface Result {void accept(JSONObject result)throws Exception;}
 void run(JSONObject request,Result result){if(busy)return;busy=true;clear();body.addView(label("正在读取或更新仓库…",14));new Thread(()->{JSONObject response=null;String error=null;try{response=WorkspaceGit.execute(this,request);}catch(Exception e){error=e.getMessage();}final JSONObject done=response;final String failure=error;runOnUiThread(()->{busy=false;if(isFinishing()||isDestroyed())return;if(failure!=null){clear();body.addView(label(failure,14));body.addView(button("刷新状态",()->load()));return;}try{result.accept(done);}catch(Exception e){clear();body.addView(label("无法显示 Git 结果",14));}});},"eva-git").start();}
 void load(){try{run(request("status"),result->{state=result;draw();});}catch(Exception ignored){}}
 void mutate(String action,String path){try{JSONObject req=request(action);if(path!=null)req.put("path",path);run(req,result->{state=result;draw();});}catch(Exception ignored){}}
 void draw()throws Exception {clear();body.addView(label("工作区 / "+folder,12));
  if(!state.optBoolean("repository")){body.addView(label("这个目录尚未初始化 Git。初始化将创建本地版本记录。",14));body.addView(button("从远程克隆",()->operationForm("clone","克隆到当前空目录",new String[]{"url"},new String[]{"HTTPS 或 ssh:// 仓库地址"})));body.addView(button("初始化仓库",()->new AlertDialog.Builder(this).setTitle("初始化本地仓库").setMessage("目录："+folder+"\n不会自动暂存或提交任何文件。").setPositiveButton("初始化",(d,w)->mutate("init",null)).setNegativeButton("取消",null).show()));return;}
  body.addView(label("分支："+state.optString("branch")+"  "+state.optString("upstream"),13));if(state.optBoolean("merging"))body.addView(label("合并进行中，解决冲突、暂存后提交，或在远程与分支中中止合并。",12));JSONArray files=state.getJSONArray("files");
  body.addView(label(files.length()==0?"工作区干净":files.length()+" 个变更 · 点击查看与暂存",12));
  ScrollView scroll=new ScrollView(this);LinearLayout list=new LinearLayout(this);list.setOrientation(1);scroll.addView(list);body.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));boolean staged=false;
  for(int i=0;i<files.length();i++){JSONObject item=files.getJSONObject(i);String code=item.getString("code"),path=item.getString("path");if(code.charAt(0)!=' '&&code.charAt(0)!='?')staged=true;Button row=button(code+"  "+path,()->showFile(item));row.setGravity(android.view.Gravity.START|android.view.Gravity.CENTER_VERTICAL);list.addView(row,new LinearLayout.LayoutParams(-1,-2));}
  Button commit=button("提交已暂存的变更",()->commitForm());commit.setEnabled(staged);body.addView(commit);body.addView(button("远程与分支",()->operations()));
 }
 void showFile(JSONObject item){String path=item.optString("path"),code=item.optString("code");java.util.ArrayList<String> titles=new java.util.ArrayList<>();java.util.ArrayList<Runnable> actions=new java.util.ArrayList<>();titles.add("查看工作区差异");actions.add(()->diff(path,false));if(java.util.Arrays.asList("UU","AA","DD","AU","UA","DU","UD").contains(code)){for(String side:new String[]{"ours","theirs"}){titles.add(side.equals("ours")?"采用本地版本并标记解决":"采用合入版本并标记解决");actions.add(()->new AlertDialog.Builder(this).setMessage("替换此文件的冲突内容并暂存？\n"+path).setNegativeButton("取消",null).setPositiveButton("采用",(d,w)->{try{run(request("resolve").put("path",path).put("side",side),result->{state=result;draw();});}catch(Exception ignored){}}).show());}}if(code.charAt(0)!=' '&&code.charAt(0)!='?'){titles.add("查看已暂存差异");actions.add(()->diff(path,true));titles.add("取消暂存（保留文件）");actions.add(()->mutate("unstage",path));}if(code.charAt(1)!=' '){titles.add("暂存此文件");actions.add(()->mutate("stage",path));}new AlertDialog.Builder(this).setTitle(path).setItems(titles.toArray(new String[0]),(d,n)->actions.get(n).run()).setNegativeButton("关闭",null).show();}
 void diff(String path,boolean staged){try{run(request("diff").put("path",path).put("staged",staged),result->{clear();body.addView(label((staged?"已暂存":"工作区")+" · "+path,13));ScrollView scroll=new ScrollView(this);TextView content=label(result.optString("text").isEmpty()?"没有文本差异":result.optString("text"),12);content.setTypeface(android.graphics.Typeface.MONOSPACE);content.setTextIsSelectable(true);scroll.addView(content);body.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));if(result.optBoolean("truncated"))body.addView(label("内容超过 256 KB，仅显示前段。",11));body.addView(button("返回变更列表",()->load()));});}catch(Exception ignored){}}
 void commitForm(){if(busy)return;LinearLayout form=new LinearLayout(this);form.setOrientation(1);form.setPadding(dp(20),0,dp(20),0);EditText message=new EditText(this),name=new EditText(this),email=new EditText(this);message.setHint("提交说明");message.setText(commitDraft);name.setHint("作者名称");email.setHint("作者邮箱");name.setSingleLine();email.setSingleLine();name.setText(getPreferences(0).getString("name",""));email.setText(getPreferences(0).getString("email",""));form.addView(message);form.addView(name);form.addView(email);form.addView(label("仅提交已暂存内容；未暂存修改会保留。提交不会推送到远程，也不会运行仓库钩子。",12));AlertDialog dialog=new AlertDialog.Builder(this).setTitle("创建本地提交").setView(form).setPositiveButton("提交",null).setNegativeButton("取消",null).create();dialog.setOnDismissListener(d->commitDraft=message.getText().toString());dialog.setOnShowListener(d->dialog.getButton(-1).setOnClickListener(v->{try{String m=message.getText().toString().trim(),n=name.getText().toString().trim(),e=email.getText().toString().trim();if(m.isEmpty()||n.isEmpty()||!e.contains("@")){Toast.makeText(this,"请填写提交说明、作者和邮箱",1).show();return;}JSONObject req=request("commit").put("message",m).put("name",n).put("email",e);getPreferences(0).edit().putString("name",n).putString("email",e).apply();dialog.dismiss();run(req,result->{commitDraft="";state=result;draw();Toast.makeText(this,"本地提交已创建",0).show();});}catch(Exception ignored){}}));dialog.show();}
 void operations(){
  if(busy)return;
  String[] titles={"设置远端","保存 HTTPS 凭据","清除 HTTPS 凭据","获取远端 fetch","快进拉取 pull","推送当前分支 push","新建分支","切换分支","合并分支","中止合并","查看提交历史"};
  new AlertDialog.Builder(this).setTitle("远程与分支").setItems(titles,(dialog,index)->{
   switch(index){
    case 0:operationForm("remote-set","设置远端",new String[]{"remote","url"},new String[]{"远端名称，例如 origin","HTTPS、ssh:// 或工作区内远端路径"});break;
    case 1:operationForm("credential-save","保存 HTTPS 凭据",new String[]{"remote","url","username","password"},new String[]{"远端名称，例如 origin","完整 HTTPS 仓库地址","用户名","访问令牌或密码"});break;
    case 2:operationForm("credential-clear","清除 HTTPS 凭据",new String[]{"remote"},new String[]{"远端名称"});break;
    case 3:operationForm("fetch","获取远端",new String[]{"remote"},new String[]{"远端名称"});break;
    case 4:operationForm("pull","快进拉取",new String[]{"remote","branch"},new String[]{"远端名称","远端分支"});break;
    case 5:operationForm("push","推送当前 HEAD",new String[]{"remote","branch"},new String[]{"远端名称","目标分支"});break;
    case 6:operationForm("branch-create","从当前 HEAD 新建分支",new String[]{"branch"},new String[]{"新分支名称"});break;
    case 7:chooseBranch();break;
    case 8:operationForm("merge","合并后检查并提交",new String[]{"branch"},new String[]{"本地分支或 origin/main"});break;
    case 9:new AlertDialog.Builder(this).setMessage("中止当前合并并返回合并前状态？").setNegativeButton("取消",null).setPositiveButton("中止",(d,w)->mutate("merge-abort",null)).show();break;
    case 10:history(0);break;
   }
  }).setNegativeButton("关闭",null).show();
 }
 void history(int offset){
  try{run(request("history").put("offset",offset),result->{
   clear();ScrollView scroll=new ScrollView(this);TextView text=label(result.optString("text").isEmpty()?"没有更早记录":result.optString("text"),12);text.setTextIsSelectable(true);scroll.addView(text);body.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
   if(result.optBoolean("hasMore"))body.addView(button("更早提交",()->history(offset+40)));
   body.addView(button("返回变更列表",()->load()));
  });}catch(Exception ignored){}
 }
 void chooseBranch(){
  JSONArray values=state==null?null:state.optJSONArray("branches");if(values==null)return;
  String[] branches=new String[values.length()];for(int i=0;i<branches.length;i++)branches[i]=values.optString(i);
  new AlertDialog.Builder(this).setTitle("切换分支").setItems(branches,(d,index)->{try{run(request("branch-switch").put("branch",branches[index]),result->{state=result;draw();});}catch(Exception ignored){}}).setNegativeButton("取消",null).show();
 }
 void operationForm(String action,String title,String[] keys,String[] hints){
  LinearLayout form=new LinearLayout(this);form.setOrientation(1);form.setPadding(dp(20),0,dp(20),0);
  EditText[] inputs=new EditText[keys.length];
  for(int i=0;i<keys.length;i++){
   EditText input=new EditText(this);input.setSingleLine();input.setHint(hints[i]);input.setSaveEnabled(false);
   if(keys[i].equals("remote"))input.setText("origin");
   if(keys[i].equals("branch")&&state!=null)input.setText(state.optString("branch"));
   if(keys[i].equals("username"))input.setText("git");
   if(keys[i].equals("password")){input.setInputType(android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD);input.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO);}
   inputs[i]=input;form.addView(input);
  }
  if(action.equals("credential-save"))form.addView(label("凭据使用 Android Keystore 加密，仅用于绑定的 HTTPS 仓库。",12));
  AlertDialog dialog=new AlertDialog.Builder(this).setTitle(title).setView(form).setPositiveButton(action.equals("push")?"检查推送":"确认",null).setNegativeButton("取消",null).create();
  dialog.setOnShowListener(d->{if(action.equals("credential-save"))dialog.getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE);dialog.getButton(-1).setOnClickListener(v->{
   try{
    JSONObject req=request(action);for(int i=0;i<keys.length;i++){String raw=inputs[i].getText().toString();String value=keys[i].equals("password")?raw:raw.trim();if(value.isEmpty()){inputs[i].setError("请填写此项");return;}req.put(keys[i],value);}
    Runnable execute=()->{dialog.dismiss();for(EditText input:inputs)input.setText("");run(req,result->{state=result;draw();});};
    if(action.equals("push"))new AlertDialog.Builder(this).setTitle("推送到远程").setMessage("将当前 HEAD 推送到 "+req.optString("remote")+"/"+req.optString("branch")+"？").setNegativeButton("取消",null).setPositiveButton("推送",(x,w)->execute.run()).show();else execute.run();
   }catch(Exception error){Toast.makeText(this,"无法创建 Git 请求",1).show();}
  });});dialog.show();
 }
 void leavePage(){if(busy){Toast.makeText(this,"正在处理 Git 操作，请稍候",0).show();return;}finish();}
 public void onBackPressed(){leavePage();}
}
