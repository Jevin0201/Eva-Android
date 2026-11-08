package ai.eva.android.probe;
import android.app.*;import android.os.*;import android.view.*;import android.widget.*;import org.json.*;

/** API credentials are entered only in this native window. */
public class ModelsActivity extends ToolPageActivity {
 ModelStore store;String editing="";EditText name,url,model,apiKey;TextView message;Button pasteKey;Spinner protocol;boolean busy,manualProtocol;
 public void onCreate(Bundle state){super.onCreate(state);getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);store=new ModelStore(this);page("API 提供商","");listing();}
 LinearLayout content(){clear();ScrollView scroll=new ScrollView(this);LinearLayout box=new LinearLayout(this);box.setOrientation(1);scroll.addView(box);body.addView(scroll,new LinearLayout.LayoutParams(-1,-1));return box;}
 void listing(){editor("");}

 String defaultLabel(JSONObject config,JSONObject selection)throws Exception {
  String providerId=selection.optString("providerId"),modelId=selection.optString("model"),providerName=providerId,modelName=modelId;
  JSONObject preferences=null;
  if(providerId.equals("openai")) {
   JSONObject account=config.getJSONObject("account");
   providerName="OpenAI / ChatGPT"+(account.optBoolean("loggedIn")?"":" · 未登录，不可用");
   preferences=account.optJSONObject("modelPreferences");
  } else {
   JSONArray providers=config.getJSONArray("providers");
   for(int i=0;i<providers.length();i++) {
    JSONObject provider=providers.getJSONObject(i);
    if(!providerId.equals(provider.optString("id")))continue;
    providerName=provider.optString("name",providerId);
    preferences=provider.optJSONObject("modelPreferences");
    JSONArray models=provider.optJSONArray("models");
    if(models!=null)for(int n=0;n<models.length();n++){JSONObject row=models.getJSONObject(n);if(modelId.equals(row.optString("id")))modelName=row.optString("name",modelId);}
   }
  }
  if(preferences!=null&&preferences.optJSONObject(modelId)!=null)modelName=preferences.getJSONObject(modelId).optString("name",modelName);
  return providerName+" / "+modelName;
 }
 EditText field(LinearLayout box,String title,String value,String hint,int type){box.addView(label(title,12));EditText edit=new EditText(this);edit.setTextSize(14);edit.setTextColor(ink);edit.setHintTextColor(0xff858b92);edit.setInputType(type);edit.setSingleLine();edit.setText(value);edit.setHint(hint);edit.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO);box.addView(edit);return edit;}
 void editor(String id){editing=id;manualProtocol=false;LinearLayout box=content();try{JSONObject p=id.isEmpty()?new JSONObject():store.provider(id);
 name=field(box,"供应商名称",p.optString("name"),"填写名称",1);
 url=field(box,"URL",p.optString("url"),"https://api.example.com/v1",17);
 apiKey=field(box,"API Key","",id.isEmpty()?"填写 API Key":"留空保留已保存的 Key",129);apiKey.setImeOptions(android.view.inputmethod.EditorInfo.IME_FLAG_NO_PERSONALIZED_LEARNING);apiKey.setTransformationMethod(android.text.method.PasswordTransformationMethod.getInstance());apiKey.setLongClickable(true);
 pasteKey=button("粘贴 API Key",()->pasteApiKey());box.addView(pasteKey);
 model=field(box,"模型名称",p.optString("model"),"填写接口提供的模型名称或 ID",1);
 LinearLayout advanced=new LinearLayout(this);advanced.setOrientation(1);advanced.setVisibility(View.GONE);protocol=new Spinner(this);protocol.setAdapter(new ArrayAdapter<String>(this,android.R.layout.simple_spinner_dropdown_item,new String[]{"Responses","Chat Completions"}));protocol.setSelection(p.optString("protocol","chat_completions").equals("chat_completions")?1:0);advanced.addView(label("接口格式",12));advanced.addView(protocol);box.addView(button("高级设置",()->{manualProtocol=true;advanced.setVisibility(advanced.getVisibility()==View.GONE?View.VISIBLE:View.GONE);}));box.addView(advanced);
 message=label("",12);box.addView(message);box.addView(button("保存",()->save()));box.addView(button("测试连接",()->test(false)));
 if(!id.isEmpty()){box.addView(button("模型目录",()->catalog(id)));box.addView(button("删除此连接",()->new AlertDialog.Builder(this).setTitle("删除此连接？").setMessage("聊天记录会保留。使用此连接的会话需重新选择模型。").setPositiveButton("删除",(d,w)->{try{store.delete(id);listing();}catch(Exception e){message.setText("删除失败");}}).setNegativeButton("取消",null).show()));box.addView(button("添加其他 API",()->editor("")));}
 JSONArray providers=store.publicConfig().getJSONArray("providers");boolean header=false;for(int i=0;i<providers.length();i++){JSONObject row=providers.getJSONObject(i);if(DshAvailability.managed(row))continue;if(!header){box.addView(label("已保存的 API 连接",14));header=true;}String saved=row.getString("id");box.addView(button(row.getString("name"),()->editor(saved)));}
 }catch(Exception e){box.addView(label("连接配置读取失败",14));}}

 void installLocal(){
  if(busy)return;busy=true;Toast.makeText(this,"正在检查DSH插件…",Toast.LENGTH_SHORT).show();
  ModelClient.workers.execute(()->{try{LocalFreeModels.install(this);runOnUiThread(()->{if(!isFinishing())listing();});}
   catch(Exception e){runOnUiThread(()->{if(!isFinishing())new AlertDialog.Builder(this).setTitle("DSH插件连接失败").setMessage(e.getMessage()).setPositiveButton("确定",null).show();});}
   finally{busy=false;}});
 }
 void pasteApiKey(){
  apiKey.requestFocus();
  try{android.content.ClipboardManager clipboard=(android.content.ClipboardManager)getSystemService(CLIPBOARD_SERVICE);android.content.ClipData clip=clipboard.getPrimaryClip();CharSequence value=clip!=null&&clip.getItemCount()>0?clip.getItemAt(0).getText():null;
   if(value==null||value.length()==0){Toast.makeText(this,"剪贴板中没有可粘贴的文本，请先复制 API Key",Toast.LENGTH_SHORT).show();return;}
   int start=apiKey.getSelectionStart(),end=apiKey.getSelectionEnd();if(start<0||end<0){start=end=apiKey.length();}int from=Math.min(start,end),to=Math.max(start,end);apiKey.getText().replace(from,to,value);apiKey.setSelection(Math.min(from+value.length(),apiKey.length()));
  }catch(Exception e){Toast.makeText(this,"暂时无法读取剪贴板，请重新复制后再试",Toast.LENGTH_SHORT).show();}
 }
 static String automaticProtocol(String value){try{return "api.deepseek.com".equals(new java.net.URI(value.trim()).getHost())?"responses":"chat_completions";}catch(Exception ignored){return "chat_completions";}}
 String resolvedProtocol()throws Exception{return manualProtocol?(protocol.getSelectedItemPosition()==1?"chat_completions":"responses"):editing.isEmpty()?automaticProtocol(url.getText().toString()):store.provider(editing).optString("protocol","responses");}
 boolean save(){if(busy){message.setText("正在请求，请稍候");return false;}try{editing=store.save(editing,name.getText().toString(),url.getText().toString(),model.getText().toString(),apiKey.getText().toString(),resolvedProtocol());protocol.setSelection(store.provider(editing).optString("protocol","responses").equals("chat_completions")?1:0);apiKey.setText("");apiKey.setHint("已保存；留空保留原密钥");message.setText("连接配置已保存。模型目录、文本调用和多次工具调用分别验证，测试可能计费。");return true;}catch(Exception e){message.setText(e instanceof java.io.IOException?e.getMessage():"凭据保存失败，请检查设备密钥存储");return false;}}
 void test(boolean discover){
  if(!discover&&model.getText().toString().trim().isEmpty()){message.setText("请填写测试模型 ID，或在模型目录选择");return;}
  if(!save())return;String id=editing;String selected=model.getText().toString().trim();runCheck(id,selected,discover?"models":"text");
 }
 void runCheck(String id,String selected,String kind){
  if(busy)return;busy=true;Toast.makeText(this,kind.equals("models")?"正在获取目录…":"正在执行实际调用，可能计费…",Toast.LENGTH_SHORT).show();
  ModelClient.workers.execute(()->{String result;
   try{JSONObject provider=store.provider(id);LocalFreeModels.ensureProvider(this,provider);String secret=store.secret(provider);
    if(kind.equals("models")){JSONObject response=ModelClient.request(provider,secret,"models",null,new ModelClient.Job());JSONArray data=response.getJSONArray("data");store.cacheModels(id,provider,data);result="目录获取通过 · "+ModelStore.modelCatalog(data).length()+" 个模型。文本和工具调用仍需分别验证。";}
    else if(kind.equals("tools")){checkTools(provider,secret,selected);result="多次工具往返通过 · 连续三次调用及结果回传已核验。";}
    else{boolean chat=provider.optString("protocol","responses").equals("chat_completions");JSONObject request=new JSONObject().put("model",selected).put("stream",false);if(chat)request.put("messages",new JSONArray().put(new JSONObject().put("role","user").put("content","Reply with exactly: pong")));else request.put("input","Reply with exactly: pong").put("store",false);JSONObject response=ModelClient.request(provider,secret,chat?"chat/completions":"responses",request,new ModelClient.Job());String text=chat?response.getJSONArray("choices").getJSONObject(0).getJSONObject("message").optString("content"):ModelClient.text(response);if(!text.trim().equalsIgnoreCase("pong"))throw new java.io.IOException("文本测试未返回预期 pong");result="文本调用通过。多次工具往返仍需独立验证。";}
   }catch(Exception error){result="本次验证未通过 · "+ModelClient.safeError(error);}
   final String report=result;runOnUiThread(()->{busy=false;if(isFinishing())return;new AlertDialog.Builder(this).setTitle("验证结果").setMessage(report).setPositiveButton("确定",(d,w)->{if(kind.equals("models"))catalog(id);}).show();});
  });
 }
 void checkTools(JSONObject provider,String secret,String selected)throws Exception{
  boolean chat=provider.optString("protocol","responses").equals("chat_completions");
  JSONObject function=new JSONObject().put("name","eva_probe").put("description","Return the requested step number. No external effects.").put("parameters",new JSONObject("{type:object,properties:{step:{type:integer}},required:[step],additionalProperties:false}"));
  JSONArray tools=new JSONArray().put(chat?new JSONObject().put("type","function").put("function",function):new JSONObject(function.toString()).put("type","function"));
  String prompt="Call eva_probe exactly three times sequentially with step 1, then 2, then 3. Wait for each result before the next call. Do not merely state a plan.";
  JSONArray history=new JSONArray().put(new JSONObject().put("role","user").put("content",prompt));
  for(int step=1;step<=3;step++){
   JSONObject request=new JSONObject().put("model",selected).put("stream",false).put("tools",tools).put(chat?"messages":"input",history);if(!chat)request.put("store",false);
   JSONObject response=ModelClient.request(provider,secret,chat?"chat/completions":"responses",request,new ModelClient.Job());
   if(response.optString("status").equals("incomplete")||response.optString("status").equals("failed")||response.has("error"))throw new java.io.IOException("工具测试返回未完成或失败响应");
   JSONArray calls=new JSONArray();JSONObject message=null;
   if(chat){if(response.getJSONArray("choices").getJSONObject(0).optString("finish_reason").equals("length"))throw new java.io.IOException("工具测试输出被截断");message=response.getJSONArray("choices").getJSONObject(0).getJSONObject("message");JSONArray rows=message.optJSONArray("tool_calls");if(rows!=null)calls=rows;}
   else{JSONArray rows=response.getJSONArray("output");for(int n=0;n<rows.length();n++){JSONObject row=rows.getJSONObject(n);history.put(row);if(row.optString("type").equals("function_call"))calls.put(row);}}
   if(calls.length()!=1)throw new java.io.IOException("第 "+step+" 次未返回单独工具调用");
   JSONObject call=calls.getJSONObject(0),definition=chat?call.getJSONObject("function"):call;
   if(!definition.optString("name").equals("eva_probe")||new JSONObject(definition.getString("arguments")).optInt("step")!=step)throw new java.io.IOException("第 "+step+" 次工具参数未匹配");
   String callId=call.getString(chat?"id":"call_id");
   if(chat){history.put(message);history.put(new JSONObject().put("role","tool").put("tool_call_id",callId).put("content",String.valueOf(step)));}
   else history.put(new JSONObject().put("type","function_call_output").put("call_id",callId).put("output",String.valueOf(step)));
  }
 }
 void catalog(String id){editing=id;name=null;LinearLayout box=content();try{JSONObject provider=store.provider(id);box.addView(label(provider.getString("name")+" · 模型目录",16));box.addView(button("获取模型目录",()->runCheck(id,"","models")));box.addView(button("手动添加模型",()->manualModel(id)));JSONArray models=provider.optJSONArray("models");if(models==null||models.length()==0)box.addView(label("目录为空，可获取或手动添加模型。",13));if(models!=null)for(int n=0;n<models.length();n++){JSONObject row=models.getJSONObject(n);String modelId=row.getString("id");JSONObject prefs=provider.optJSONObject("modelPreferences"),preference=prefs==null?null:prefs.optJSONObject(modelId);String display=preference==null?row.optString("name",modelId):preference.optString("name",row.optString("name",modelId));boolean visible=preference==null||preference.optBoolean("visible",true);box.addView(button(display+" · "+(visible?"显示":"隐藏")+"\n"+modelId,()->modelMenu(id,modelId,display,visible)));}box.addView(button("编辑连接配置",()->editor(id)));}catch(Exception e){box.addView(label("模型目录读取失败",13));}}
 void manualModel(String id){LinearLayout fields=new LinearLayout(this);fields.setOrientation(1);EditText modelId=field(fields,"模型 ID","","服务商提供的准确 ID",1),display=field(fields,"显示名称","","便于识别的名称",1);new AlertDialog.Builder(this).setTitle("添加模型").setView(fields).setPositiveButton("添加",(d,w)->{try{store.addModel(id,modelId.getText().toString(),display.getText().toString());catalog(id);}catch(Exception error){Toast.makeText(this,error.getMessage(),Toast.LENGTH_LONG).show();}}).setNegativeButton("取消",null).show();}
 void modelMenu(String id,String modelId,String display,boolean visible){new AlertDialog.Builder(this).setTitle(display).setItems(new String[]{"修改显示名称",visible?"在选择器隐藏":"在选择器显示","配置推理档位","设为全局默认","测试文本调用","测试三次工具往返"},(dialog,which)->{try{if(which==0||which==2){EditText input=new EditText(this);input.setText(which==0?display:"");new AlertDialog.Builder(this).setTitle(which==0?"显示名称":"填写服务已明确支持的档位，用逗号分隔").setView(input).setPositiveButton("保存",(d,w)->{try{JSONObject patch=new JSONObject();if(which==0)patch.put("name",input.getText().toString());else{JSONArray efforts=new JSONArray();for(String effort:input.getText().toString().split(","))if(!effort.trim().isEmpty())efforts.put(effort.trim());patch.put("reasoningEfforts",efforts);}store.modelPreference(id,modelId,patch);catalog(id);}catch(Exception e){Toast.makeText(this,e.getMessage(),Toast.LENGTH_LONG).show();}}).setNegativeButton("取消",null).show();}else if(which==1){store.modelPreference(id,modelId,new JSONObject().put("visible",!visible));catalog(id);}else if(which==3){store.setDefaultSelection(id,modelId,"","");Toast.makeText(this,"已设为全局默认",Toast.LENGTH_SHORT).show();catalog(id);}else runCheck(id,modelId,which==4?"text":"tools");}catch(Exception e){Toast.makeText(this,e.getMessage(),Toast.LENGTH_LONG).show();}}).show();}

 void leavePage(){onBackPressed();}
 public void onBackPressed(){if(busy){Toast.makeText(this,"请求仍在进行，请稍候",Toast.LENGTH_SHORT).show();return;}if(!editing.isEmpty()){listing();return;}finish();}
}
