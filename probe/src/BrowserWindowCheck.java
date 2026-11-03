package ai.eva.android.probe;

import android.app.Instrumentation;
import android.content.Intent;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.MotionEvent;
import org.json.JSONObject;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

/** Uses real input dispatch, not DOM click(), to detect modal browser regressions. */
public class BrowserWindowCheck extends Instrumentation {
 public void onCreate(Bundle args){super.onCreate(args);start();}
 String js(ShellActivity shell,String script)throws Exception{
  CompletableFuture<String> value=new CompletableFuture<>();
  runOnMainSync(()->shell.web.evaluateJavascript(script,value::complete));
  return value.get(5,TimeUnit.SECONDS);
 }
 void await(ShellActivity shell,String expression)throws Exception{
  long deadline=SystemClock.elapsedRealtime()+5000;
  while(SystemClock.elapsedRealtime()<deadline){if("true".equals(js(shell,expression)))return;Thread.sleep(50);}
  throw new Exception("Timed out: "+expression);
 }
 void tap(ShellActivity shell,String selector)throws Exception{
  JSONObject box=new JSONObject(js(shell,"(()=>{const r=document.querySelector("+JSONObject.quote(selector)+").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,width:innerWidth}})()"));
  int[] origin=new int[2];int[] width=new int[1];runOnMainSync(()->{shell.web.getLocationOnScreen(origin);width[0]=shell.web.getWidth();});
  float scale=(float)(width[0]/box.getDouble("width"));float x=origin[0]+(float)box.getDouble("x")*scale,y=origin[1]+(float)box.getDouble("y")*scale;
  long now=SystemClock.uptimeMillis();MotionEvent down=MotionEvent.obtain(now,now,MotionEvent.ACTION_DOWN,x,y,0),up=MotionEvent.obtain(now,now+70,MotionEvent.ACTION_UP,x,y,0);
  try{sendPointerSync(down);sendPointerSync(up);}finally{down.recycle();up.recycle();}
 }
 public void onStart(){Bundle output=new Bundle();int code=0;BrowserWindow browser=null;
  try{
   ShellActivity shell=(ShellActivity)startActivitySync(new Intent(getTargetContext(),ShellActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
   await(shell,"typeof navigate==='function'&&!!document.querySelector('[data-action=drawer]')");
   js(shell,"document.querySelector('#phone').classList.remove('drawer-open');true");
   runOnMainSync(()->shell.showBrowser(new Intent()));browser=BrowserWindow.live;
   BrowserWindow b=browser;runOnMainSync(()->{b.browser.loadDataWithBaseURL("https://eva-browser-test.invalid/","<h1>Browser window check</h1><input value='retained'>","text/html","UTF-8",null);b.windowMode(false,false);});
   Thread.sleep(350);
   tap(shell,"[data-action=drawer]");await(shell,"document.querySelector('#phone').classList.contains('drawer-open')");
   js(shell,"document.querySelector('#phone').classList.remove('drawer-open');true");
   int[] originalWidth=new int[1];runOnMainSync(()->{originalWidth[0]=b.browser.getWidth();b.windowMode(false,true);});Thread.sleep(350);
   tap(shell,"[data-action=drawer]");await(shell,"document.querySelector('#phone').classList.contains('drawer-open')");
   js(shell,"document.querySelector('#phone').classList.remove('drawer-open');true");
   TerminalActivity terminal=(TerminalActivity)startActivitySync(new Intent(getTargetContext(),TerminalActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
   runOnMainSync(terminal::finish);waitForIdleSync();
   runOnMainSync(()->shell.startActivity(new Intent(shell,ShellActivity.class).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP)));
   Thread.sleep(350);
   if(BrowserWindow.live!=b||!b.minimized)throw new Exception("Browser lost minimized state after host return");
   tap(shell,"[data-action=drawer]");await(shell,"document.querySelector('#phone').classList.contains('drawer-open')");
   js(shell,"document.querySelector('#phone').classList.remove('drawer-open');true");
   tap(shell,"#prompt");await(shell,"document.activeElement.id==='prompt'");
   CompletableFuture<Boolean> retained=new CompletableFuture<>();runOnMainSync(()->{((android.view.inputmethod.InputMethodManager)shell.getSystemService(android.content.Context.INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(shell.web.getWindowToken(),0);boolean sameWidth=b.browser.getWidth()==originalWidth[0];b.windowMode(false,false);b.browser.evaluateJavascript("document.querySelector('input')?.value==='retained'",value->retained.complete(sameWidth&&"true".equals(value)));});
   if(!retained.get(5,TimeUnit.SECONDS))throw new Exception("Browser state/viewport not retained");
   output.putString("result","PASS native touch reaches conversation behind expanded/minimized browser; native Activity roundtrip and launcher return remain interactive; composer focus works; browser viewport/page state retained");
  }catch(Exception e){code=1;output.putString("error",e.toString());}
  finally{if(browser!=null){BrowserWindow b=browser;runOnMainSync(b::finish);}}
  finish(code,output);
 }
}
