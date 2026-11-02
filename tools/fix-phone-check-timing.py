from pathlib import Path
Path('artifacts/phone-use-0.0.20/fixture-failed.png').unlink(missing_ok=True)
p=Path('probe/src/PhoneSelfCheck.java');s=p.read_text(encoding='utf-8');s=s.replace(' static JSONObject run(',''' static JSONObject awaitText(android.content.Context c,String text)throws Exception{for(int n=0;n<20;n++){Thread.sleep(150);JSONObject screen=run(c,"observe");if(!screen.optString("package").equals(c.getPackageName()))throw new Exception("测试被切换 App 中断，请留在测试页重试");try{find(screen,"text",text);return screen;}catch(Exception ignored){}}throw new Exception("操作后 3 秒仍未观察到测试文字："+text);}
 static JSONObject run(''')
s=s.replace('PhoneTools.execute(context,new JSONObject().put("action","input").put("snapshot",screen.getString("snapshot")).put("node",input).put("text","phone-use-check"));screen=run(context,"observe");find(screen,"text","phone-use-check");','JSONObject applied=PhoneTools.execute(context,new JSONObject().put("action","input").put("snapshot",screen.getString("snapshot")).put("node",input).put("text","phone-use-check"));if(!applied.optBoolean("dispatched"))throw new Exception("系统拒绝输入操作");screen=awaitText(context,"phone-use-check");')
s=s.replace('Thread.sleep(300);screen=run(context,"observe");find(screen,"text","fixture-clicked");','screen=awaitText(context,"fixture-clicked");')
s=s.replace('finally{PhoneAccessibility.stopControl();}', 'finally{PhoneAccessibility.stopControl();context.stopService(new android.content.Intent(context,PhoneTaskService.class));}')
p.write_text(s,encoding='utf-8')
