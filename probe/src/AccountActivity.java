package ai.eva.android.probe;
import android.app.*;import android.os.*;import android.content.*;import android.widget.*;import org.json.*;

/** Official Codex account flow. Passwords and OAuth tokens never enter Eva's UI bridge. */
public class AccountActivity extends ToolPageActivity {
 KernelHost host;LinearLayout box;TextView status,details,quotaDetails;boolean busy,resumed;long seenRevision=-1,lastCatalogAt;String seenLoginError="",modelIdentity="";Handler timer=new Handler();JSONArray models=new JSONArray();JSONObject account;Button loginButton,reopenButton,cancelButton,backupButton,modelButton,logoutButton,quotaButton;
 final Runnable poll=new Runnable(){public void run(){if(resumed){if(!busy&&(host.loginSession!=null||seenRevision!=host.accountRevision||!seenLoginError.equals(host.loginError)))refresh();timer.postDelayed(this,4000);}}};
 public void onCreate(Bundle b){super.onCreate(b);host=KernelHost.get(this);if(prefs().getBoolean("loggedIn",false))account=new JSONObject();page("OpenAI / ChatGPT 账号","");show();}
 android.content.SharedPreferences prefs(){return getSharedPreferences("eva-account",0);}
 void show(){clear();ScrollView scroll=new ScrollView(this);box=new LinearLayout(this);box.setOrientation(1);scroll.addView(box);body.addView(scroll,new LinearLayout.LayoutParams(-1,-1));status=label(account==null?"正在读取账号状态…":"已保存登录，正在确认账号状态…",16);box.addView(status);details=label("",13);details.setTextIsSelectable(true);box.addView(details);quotaDetails=label("登录后可查看账号额度",14);quotaDetails.setTextIsSelectable(true);quotaDetails.setVisibility(8);box.addView(quotaDetails);quotaButton=button("查看账号额度",()->startActivity(new Intent(this,ShellActivity.class).putExtra("panel","account")));box.addView(quotaButton);
  loginButton=button("登录 OpenAI / ChatGPT 账号",()->login());box.addView(loginButton);
  box.addView(label("点击登录后打开手机 Chrome，完成官方网页授权即可。无需手动复制验证码。",12));
  reopenButton=button("重新打开登录网页",()->openLogin());box.addView(reopenButton);backupButton=button("其他登录方式",()->new AlertDialog.Builder(this).setTitle("备用登录方式").setItems(new String[]{"使用设备码授权"},(d,n)->deviceLogin()).setNegativeButton("取消",null).show());box.addView(backupButton);cancelButton=button("取消本次登录",()->cancelLogin());box.addView(cancelButton);box.addView(button("刷新账号与额度",()->refresh()));modelButton=button("设置新会话默认模型",()->chooseModel());box.addView(modelButton);box.addView(button("管理账号模型显示",()->manageModelVisibility()));logoutButton=button("退出账号",()->new AlertDialog.Builder(this).setTitle("退出此手机的 OpenAI 账号？").setMessage("清除此内核的登录状态；API 提供商和聊天记录保留。").setPositiveButton("退出",(d,w)->logout()).setNegativeButton("取消",null).show());box.addView(logoutButton);box.addView(label("使用此账号的 Codex 模型与额度；具体可用性以服务端返回为准。账号凭据由手机内的 Codex 内核管理，不复制桌面登录信息。",12));updateButtons();}
 void updateButtons(){boolean signed=account!=null,pending=host.loginSession!=null;loginButton.setVisibility(!signed&&!pending?0:8);backupButton.setVisibility(!signed&&!pending?0:8);reopenButton.setVisibility(!signed&&pending?0:8);cancelButton.setVisibility(!signed&&pending?0:8);modelButton.setVisibility(signed?0:8);quotaButton.setVisibility(signed?0:8);logoutButton.setVisibility(signed?0:8);for(Button b:new Button[]{loginButton,backupButton,reopenButton,cancelButton,modelButton,logoutButton})b.setEnabled(!busy);}
 interface Request {JSONObject run()throws Exception;}
 interface Done {void accept(JSONObject result)throws Exception;}
 void request(String message,Request call,Done done){if(busy)return;busy=true;status.setText(message);updateButtons();host.work.execute(()->{try{JSONObject result=call.run();runOnUiThread(()->{busy=false;if(isFinishing()||isDestroyed())return;try{done.accept(result);}catch(Exception e){status.setText("账号数据暂时无法显示，请刷新");}finally{updateButtons();}});}catch(Exception e){runOnUiThread(()->{busy=false;if(host.loginSession==null)LoginService.end(this);if(!isFinishing()&&!isDestroyed())status.setText((account==null?"账号连接暂不可用：":"登录记录已保留；连接暂不可用：")+host.redact(e.getMessage()==null?"请检查网络后重试":e.getMessage()));if(!isDestroyed())updateButtons();});}});}
 void login(){if(host.loginSession!=null){displayLogin();openLogin();return;}LoginService.begin(this);request("正在打开官方账号登录…",()->host.nativeRequest("account/login/start",new JSONObject().put("type","chatgpt")),r->{displayLogin();openLogin();});}
 void deviceLogin(){if(host.loginSession!=null){status.setText("请先取消当前登录，再使用备用方式");return;}LoginService.begin(this);request("正在申请备用验证码…",()->host.nativeRequest("account/login/start",new JSONObject().put("type","chatgptDeviceCode")),r->displayLogin());}
 void displayLogin(){JSONObject login=host.loginSession;if(login==null){details.setText("");return;}status.setText("等待你完成账号授权");updateButtons();if("chatgpt".equals(login.optString("type"))){details.setText("请在 Chrome 完成登录和授权，完成后返回 Eva。登录结果会自动更新。");return;}details.setText("一次性验证码："+login.optString("userCode")+"\n授权地址："+login.optString("verificationUrl")+"\n\n备用方式：在 Chrome 登录后填写以上验证码。可长按选择复制。完成后返回此页；验证码失效时，请取消后重新申请。");}
 void openLogin(){JSONObject login=host.loginSession;if(login==null){status.setText("请先点击登录，申请验证码");return;}try{String url=login.getString("chatgpt".equals(login.optString("type"))?"authUrl":"verificationUrl");android.net.Uri uri=android.net.Uri.parse(url);if(!"https".equals(uri.getScheme())||!"auth.openai.com".equals(uri.getHost()))throw new Exception();LoginService.begin(this);Intent browserIntent=new Intent(Intent.ACTION_VIEW,uri);try{startActivity(browserIntent.setPackage("com.android.chrome"));}catch(ActivityNotFoundException missingChrome){startActivity(browserIntent.setPackage(null));}}catch(Exception e){status.setText("授权地址无效，请重新申请登录");}}
 void copyCode(){JSONObject login=host.loginSession;if(login==null){status.setText("尚未申请验证码");return;}((ClipboardManager)getSystemService(CLIPBOARD_SERVICE)).setPrimaryClip(ClipData.newPlainText("OpenAI 一次性验证码",login.optString("userCode")));Toast.makeText(this,"验证码已复制",Toast.LENGTH_SHORT).show();}
 void cancelLogin(){JSONObject login=host.loginSession;if(login==null){status.setText("没有待处理的登录");return;}request("正在取消登录…",()->host.nativeRequest("account/login/cancel",new JSONObject().put("loginId",login.getString("loginId"))),r->{LoginService.end(this);details.setText("");status.setText("已取消登录");});}
 void refresh(){if(busy)return;seenRevision=host.accountRevision;seenLoginError=host.loginError;request("正在读取账号…",()->host.nativeRequest("account/read",new JSONObject().put("refreshToken",false)),r->{account=r.optJSONObject("account");String identity=account==null?"":account.optString("id",account.optString("accountId",account.optString("email")))+"/"+account.optString("planType");if(!identity.equals(modelIdentity)){models=new JSONArray();lastCatalogAt=0;modelIdentity=identity;}if(account==null){quotaDetails.setText("登录后可查看账号额度");if(host.loginSession!=null)displayLogin();else{status.setText(host.loginError.isEmpty()?"尚未登录 OpenAI / ChatGPT 账号":host.loginError);details.setText("");}return;}status.setText("已登录 · "+account.optString("planType",""));details.setText(account.optString("email",""));if(models.length()==0||SystemClock.elapsedRealtime()-lastCatalogAt>60000)loadModels();});}
 void loadModels(){request("已登录 · 正在更新可用模型…",()->{
  JSONArray rows=new JSONArray();java.util.Set<String> cursors=new java.util.HashSet<>(),ids=new java.util.HashSet<>();String cursor=null;
  do{JSONObject params=new JSONObject().put("limit",100);if(cursor!=null)params.put("cursor",cursor);JSONObject page=host.nativeRequest("model/list",params);JSONArray data=page.getJSONArray("data");
   for(int i=0;i<data.length();i++){JSONObject model=data.getJSONObject(i);String id=model.optString("model",model.optString("id"));if(!id.isEmpty()&&ids.add(id))rows.put(model);}
   cursor=page.isNull("nextCursor")?null:page.optString("nextCursor",null);if(cursor!=null&&(cursor.isEmpty()||!cursors.add(cursor)))throw new java.io.IOException("账号模型目录分页无效，请刷新重试");
  }while(cursor!=null);
  return new JSONObject().put("models",rows);
 },result->{models=result.getJSONArray("models");lastCatalogAt=SystemClock.elapsedRealtime();status.setText("已登录 · "+account.optString("planType",""));
  JSONObject selected=new ModelStore(this).read().getJSONObject("defaultSelection");String text=account.optString("email","")+"\n"+models.length()+" 个账号模型";
  if(selected.optString("providerId").equals("openai"))text+="\n新会话默认模型："+selected.optString("model");
  details.setText(text);
 });}
 void chooseModel(){
  if(busy)return;if(models.length()==0){loadModels();Toast.makeText(this,"正在更新模型目录，请稍后选择",Toast.LENGTH_SHORT).show();return;}
  java.util.ArrayList<String> ids=new java.util.ArrayList<>(),names=new java.util.ArrayList<>();
  for(int i=0;i<models.length();i++){JSONObject model=models.optJSONObject(i);if(model==null||model.optBoolean("hidden"))continue;String id=model.optString("model",model.optString("id"));if(id.isEmpty())continue;ids.add(id);names.add(model.optString("displayName",id));}
  new AlertDialog.Builder(this).setTitle("选择新会话默认模型").setItems(names.toArray(new String[0]),(dialog,index)->{
   try{new ModelStore(this).setDefaultSelection("openai",ids.get(index),"","");status.setText("新会话默认模型已保存；已有会话保留原选择");details.setText(account.optString("email","")+"\n新会话默认模型："+ids.get(index));}
   catch(Exception error){status.setText("默认模型保存失败，请重试");}
  }).setNegativeButton("取消",null).show();
 }
 void manageModelVisibility(){
  if(busy)return;if(models.length()==0){loadModels();Toast.makeText(this,"正在更新模型目录，请稍后打开",Toast.LENGTH_SHORT).show();return;}
  try{
   JSONObject preferences=new ModelStore(this).publicConfig().getJSONObject("account").getJSONObject("modelPreferences");
   java.util.ArrayList<String> ids=new java.util.ArrayList<>(),names=new java.util.ArrayList<>();java.util.ArrayList<Boolean> visible=new java.util.ArrayList<>();
   for(int i=0;i<models.length();i++){JSONObject entry=models.getJSONObject(i);if(entry.optBoolean("hidden"))continue;String id=entry.optString("model",entry.optString("id"));if(id.isEmpty())continue;JSONObject preference=preferences.optJSONObject(id);ids.add(id);names.add(preference==null?entry.optString("displayName",id):preference.optString("name",entry.optString("displayName",id)));visible.add(preference==null||preference.optBoolean("visible",true));}
   boolean[] checked=new boolean[visible.size()];for(int i=0;i<checked.length;i++)checked[i]=visible.get(i);
   new AlertDialog.Builder(this).setTitle("在前台显示的账号模型").setMultiChoiceItems(names.toArray(new String[0]),checked,(dialog,index,value)->{
    try{new ModelStore(this).modelPreference("openai",ids.get(index),new JSONObject().put("visible",value));}
    catch(Exception error){((AlertDialog)dialog).getListView().setItemChecked(index,!value);Toast.makeText(this,"模型显示偏好保存失败",Toast.LENGTH_LONG).show();}
   }).setPositiveButton("完成",null).show();
  }catch(Exception error){status.setText("模型显示配置读取失败，请刷新");}
 }
 void logout(){request("正在退出…",()->host.nativeRequest("account/logout",new JSONObject()),r->{LoginService.end(this);account=null;models=new JSONArray();prefs().edit().putBoolean("loggedIn",false).putBoolean("preferred",false).remove("model").commit();status.setText("已退出账号");details.setText("");quotaDetails.setText("登录后可查看账号额度");});}
 protected void onResume(){super.onResume();resumed=true;refresh();timer.postDelayed(poll,4000);}
 protected void onPause(){resumed=false;timer.removeCallbacks(poll);super.onPause();}
}
