package ai.eva.android.probe;
import android.app.*;import android.os.*;import android.widget.*;import android.view.inputmethod.*;import org.json.*;import java.util.concurrent.*;
/** Own-app fixture only: no chat sends, no other app content. */
final class PhoneFocusedInputCheck {
 static void check(Activity activity,EditText input){new Thread(()->{String result;boolean armed=PhoneAccessibility.armed;try{
  for(int n=0;n<80&&PhoneAccessibility.live==null;n++)Thread.sleep(100);
  if(PhoneAccessibility.live==null)throw new Exception("Accessibility service not connected");
  PhoneAccessibility.armed=true;long epoch=PhoneAccessibility.generation;
  activity.runOnUiThread(()->{input.requestFocus();((InputMethodManager)activity.getSystemService(Activity.INPUT_METHOD_SERVICE)).showSoftInput(input,InputMethodManager.SHOW_IMPLICIT);});
  boolean ready=false;for(int n=0;n<30;n++){CompletableFuture<Boolean> f=new CompletableFuture<>();activity.runOnUiThread(()->{android.accessibilityservice.InputMethod m=PhoneAccessibility.live.getInputMethod();f.complete(m!=null&&m.getCurrentInputStarted()&&m.getCurrentInputEditorInfo()!=null&&activity.getPackageName().equals(m.getCurrentInputEditorInfo().packageName));});if(f.get(2,TimeUnit.SECONDS)){ready=true;break;}Thread.sleep(100);}if(!ready)throw new Exception("Focused input connection not ready");
  JSONObject state=PhoneTools.execute(activity,new JSONObject().put("action","observe"));if(!activity.getPackageName().equals(state.optString("package")))throw new Exception("Fixture no longer foreground");
  JSONObject output=PhoneTools.executeObserved(activity,new JSONObject().put("action","input").put("snapshot",state.getString("snapshot")).put("text","中文输入验收 😀"),epoch);
  if(!output.optBoolean("dispatched"))throw new Exception("Input was not dispatched");
  CompletableFuture<String> text=new CompletableFuture<>();activity.runOnUiThread(()->text.complete(input.getText().toString()));if(!"中文输入验收 😀".equals(text.get(2,TimeUnit.SECONDS)))throw new Exception("Unicode input mismatch");
  EditorInfo editor=new EditorInfo();editor.packageName="other.app";editor.inputType=1;boolean blocked=false;try{PhoneAccessibility.validateEditor(editor,activity.getPackageName());}catch(java.io.IOException expected){blocked=true;}if(!blocked)throw new Exception("Wrong package accepted");
  editor.packageName=activity.getPackageName();editor.inputType=android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD;blocked=false;try{PhoneAccessibility.validateEditor(editor,activity.getPackageName());}catch(java.io.IOException expected){blocked=true;}if(!blocked)throw new Exception("Password input accepted");
  result="PASS focused Unicode+emoji input without node ID; app identity and password guard; no Send action; elapsedMs="+output.optLong("elapsedMs");
 }catch(Exception e){result="FAIL "+e.toString();}finally{PhoneAccessibility.armed=armed;}final String done=result;activity.getSharedPreferences("eva-phone-check",0).edit().putString("focusedInput",done).commit();activity.runOnUiThread(()->android.widget.Toast.makeText(activity,done,android.widget.Toast.LENGTH_LONG).show());}).start();}
}
