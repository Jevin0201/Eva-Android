from pathlib import Path
s=Path('probe/src/PhoneCheck.java').read_text(encoding='utf-8')
a=s.index('PhoneAccessibility.armed=true;');b=s.index('output.putString("result"',a);body=s[a:b]
body=body.replace('getTargetContext()','context').replace('JSONObject screen=run("observe")','JSONObject screen=run(context,"observe")').replace('run("observe")','run(context,"observe")').replace('run("screenshot")','run(context,"screenshot")')
find=s[s.index(' String find('):s.index(' public void onStart')].replace(' String find(', ' static String find(')
find=find[:find.index(' JSONObject run(')]+''' static JSONObject run(android.content.Context context,String action)throws Exception{return PhoneTools.execute(context,new JSONObject().put("action",action));}
'''
Path('probe/src/PhoneSelfCheck.java').write_text('''package ai.eva.android.probe;
import android.os.*;import org.json.*;
final class PhoneSelfCheck {
'''+find+''' static String check(android.content.Context context){try{'''+body+'''return "PASS: 真机控件读取、输入、点击、截图、停止后拒绝访问；Shell 流测试仅使用应用 UID，未验证 Shizuku 授权。";}catch(Exception e){return "FAIL: "+e.toString();}finally{PhoneAccessibility.stopControl();}}
}
''',encoding='utf-8')
p=Path('probe/src/PhoneFixtureActivity.java');s=p.read_text(encoding='utf-8').replace('setContentView(layout);','setContentView(layout);new Handler().postDelayed(()->new Thread(()->{String result=PhoneSelfCheck.check(this);getSharedPreferences("eva-phone-check",0).edit().putString("result",result).commit();runOnUiThread(()->title.setText(result));}).start(),1000);');p.write_text(s,encoding='utf-8')
p=Path('probe/src/PhoneControlActivity.java');s=p.read_text(encoding='utf-8').replace('body.addView(button("测试：打开手机相册"','body.addView(button("运行安全测试页",()->startActivity(new Intent(this,PhoneFixtureActivity.class))));body.addView(label(getSharedPreferences("eva-phone-check",0).getString("result",""),12));body.addView(button("测试：打开手机相册"');p.write_text(s,encoding='utf-8')
p=Path('probe/src/ShellActivity.java');s=p.read_text(encoding='utf-8').replace('void openRequestedPage(){if(!pageReady)return;', 'void openRequestedPage(){if(!pageReady)return;if("phone-test".equals(getIntent().getStringExtra("page"))){getIntent().removeExtra("page");startActivity(new Intent(this,PhoneFixtureActivity.class));return;}if("phone-control".equals(getIntent().getStringExtra("page"))){getIntent().removeExtra("page");startActivity(new Intent(this,PhoneControlActivity.class));return;}');p.write_text(s,encoding='utf-8')
p=Path('tools/build-probe.ps1');s=p.read_text(encoding='utf-8').replace("'probe/src/PhoneCheck.java'","'probe/src/PhoneCheck.java','probe/src/PhoneSelfCheck.java'");p.write_text(s,encoding='utf-8')
