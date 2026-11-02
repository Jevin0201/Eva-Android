package ai.eva.android.probe;
import android.app.*;import android.os.*;import android.content.*;
/** Uses synthetic text only; never saves a provider or logs clipboard contents. */
public class CredentialPasteCheck extends Instrumentation {
 public void onCreate(Bundle b){super.onCreate(b);start();}
 public void onStart(){Bundle out=new Bundle();int code=0;ModelsActivity page=null;try{
  page=(ModelsActivity)startActivitySync(new Intent(getTargetContext(),ModelsActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));final ModelsActivity a=page;waitForIdleSync();Thread.sleep(300);
  runOnMainSync(()->{a.editor("");a.apiKey.requestFocus();});waitForIdleSync();Thread.sleep(300);
  final Throwable[] failure={null};runOnMainSync(()->{ClipboardManager cb=(ClipboardManager)a.getSystemService(Context.CLIPBOARD_SERVICE);ClipData previous=cb.getPrimaryClip();try{
   String fixture="fixture-only-"+new String(new char[300]).replace('\0','x');cb.setPrimaryClip(ClipData.newPlainText("Eva paste test",fixture));a.pasteKey.performClick();if(!a.apiKey.getText().toString().equals(fixture))throw new AssertionError("long key paste failed");
   a.apiKey.setSelection(0,a.apiKey.length());cb.setPrimaryClip(ClipData.newPlainText("Eva paste test","replacement"));a.pasteKey.performClick();if(!a.apiKey.getText().toString().equals("replacement"))throw new AssertionError("selection replacement failed");
   a.apiKey.setText("");a.apiKey.onTextContextMenuItem(android.R.id.paste);if(!a.apiKey.getText().toString().equals("replacement"))throw new AssertionError("native paste failed");
   if(!(a.apiKey.getTransformationMethod() instanceof android.text.method.PasswordTransformationMethod))throw new AssertionError("password masking lost");
  }catch(Throwable e){failure[0]=e;}finally{a.apiKey.setText("");if(previous==null)cb.clearPrimaryClip();else cb.setPrimaryClip(previous);}});if(failure[0]!=null)throw failure[0];
  out.putString("result","PASS: actual Android clipboard, 313-character synthetic key, paste button, selection replacement, native paste, password masking; no provider saved");
 }catch(Throwable e){code=1;out.putString("error",e.getClass().getSimpleName());}finally{if(page!=null){final ModelsActivity a=page;runOnMainSync(()->a.finish());}}finish(code,out);}
}
