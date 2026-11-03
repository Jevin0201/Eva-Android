package ai.eva.android.probe;
import android.content.Intent;
import android.os.Bundle;
/** Exercises physical touch and Android IME visibility without submitting a message. */
public final class KeyboardCheck extends BrowserWindowCheck {
 public void onStart(){Bundle result=new Bundle();int code=0;ShellActivity shell=null;String draft=null;String stage="launch";
  try{shell=(ShellActivity)startActivitySync(new Intent(getTargetContext(),ShellActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));final ShellActivity s=shell;
   await(s,"!!document.querySelector('#prompt')&&typeof evaHideKeyboard==='function'");
   if(BrowserWindow.live!=null)runOnMainSync(()->BrowserWindow.live.windowMode(false,true));
   draft=js(s,"document.querySelector('#prompt').value");
   stage="first-focus";tap(s,"#prompt");await(s,"document.documentElement.classList.contains('ime-visible')");
   Thread.sleep(450);stage="dismiss-button";tap(s,"#eva-keyboard-toolbar button");await(s,"!document.documentElement.classList.contains('ime-visible')");
   if(!draft.equals(js(s,"document.querySelector('#prompt').value")))throw new Exception("Dismiss changed draft");
   Thread.sleep(450);stage="second-focus";tap(s,"#prompt");await(s,"document.documentElement.classList.contains('ime-visible')");
   Thread.sleep(450);stage="system-back";long now=android.os.SystemClock.uptimeMillis();getUiAutomation().injectInputEvent(new android.view.KeyEvent(now,now,android.view.KeyEvent.ACTION_DOWN,android.view.KeyEvent.KEYCODE_BACK,0),true);getUiAutomation().injectInputEvent(new android.view.KeyEvent(now,now+50,android.view.KeyEvent.ACTION_UP,android.view.KeyEvent.KEYCODE_BACK,0),true);await(s,"!document.documentElement.classList.contains('ime-visible')");
   Thread.sleep(450);stage="navigation";tap(s,"[data-action=drawer]");await(s,"document.querySelector('#phone').classList.contains('drawer-open')");
   js(s,"document.querySelector('#phone').classList.remove('drawer-open');true");
   result.putString("result","PASS physical dismiss button, system Back hides actual IME, draft retained, navigation remains interactive");
  }catch(Exception e){code=1;result.putString("error",stage+": "+e.toString());}finish(code,result);
 }
}
