package ai.eva.android.probe;
import android.app.*;import android.content.*;import android.os.*;import android.webkit.*;import java.util.concurrent.*;import org.json.*;
/** Isolated native browser regression; never targets the formal Eva package. */
public class BrowserTabsProbe extends Instrumentation {
 public void onCreate(Bundle args){super.onCreate(args);start();}
 String js(WebView view,String script)throws Exception{CompletableFuture<String> f=new CompletableFuture<>();runOnMainSync(()->view.evaluateJavascript(script,f::complete));return f.get(8,TimeUnit.SECONDS);}
 void check(boolean ok,String message)throws Exception{if(!ok)throw new Exception(message);}
 void waitJs(WebView v,String expression)throws Exception{long until=SystemClock.elapsedRealtime()+8000;while(SystemClock.elapsedRealtime()<until){if("true".equals(js(v,expression)))return;Thread.sleep(100);}throw new Exception("Timeout: "+expression);}
 String action(String action,String id)throws Exception{CompletableFuture<String> f=new CompletableFuture<>();runOnMainSync(()->{try{f.complete(DesktopBrowserHost.get(getTargetContext()).host(new JSONObject().put("action",action).put("id",id)).getString("active"));}catch(Exception e){f.completeExceptionally(e);}});return f.get(8,TimeUnit.SECONDS);}
 void fixture(WebView v,String title){runOnMainSync(()->v.loadDataWithBaseURL("https://eva-browser-test.invalid/","<html><head><title>"+title+"</title><meta name='viewport' content='width=device-width'><meta name='viewport' content='width=390'></head><body><input id='draft' value='"+title+"'><h1>"+title+"</h1></body></html>","text/html","UTF-8",null));}
 public void onStart(){Bundle result=new Bundle();int code=0;ShellActivity shell=null;
 try{
  check(getTargetContext().getPackageName().equals("ai.eva.android.browsercheck"),"Must use isolated package");
  getTargetContext().getSharedPreferences("eva-settings",0).edit().putBoolean("browserDesktop",true).commit();
  ActivityMonitor monitor=addMonitor(ShellActivity.class.getName(),null,false);getUiAutomation().executeShellCommand("am start -n ai.eva.android.browsercheck/ai.eva.android.probe.ShellActivity").close();shell=(ShellActivity)monitor.waitForActivityWithTimeout(15000);removeMonitor(monitor);check(shell!=null,"Shell launch timed out");ShellActivity app=shell;
  runOnMainSync(()->app.showBrowser(new Intent()));BrowserWindow b=BrowserWindow.live;WebView a=b.browser;String aid=action("state","");fixture(a,"A");waitJs(a,"!!document.querySelector('#draft')&&innerWidth>=1200");js(a,"document.querySelector('#draft').value='kept-A'");
  String bid=action("create","");WebView second=b.browser;fixture(second,"B");waitJs(second,"!!document.querySelector('#draft')&&innerWidth>=1200");js(second,"document.querySelector('#draft').value='kept-B'");
  action("activate",aid);check(b.browser==a,"A instance retained");check(js(a,"document.querySelector('#draft').value").equals("\"kept-A\""),"A input retained");
  fixture(a,"A-reload");waitJs(a,"document.title==='A-reload'&&navigator.platform==='Linux x86_64'&&innerWidth>=1200");
  js(a,"document.head.insertAdjacentHTML('beforeend','<meta name=viewport content=width=390>')");waitJs(a,"[...document.querySelectorAll('meta[name=viewport]')].every(m=>m.content.includes('width=1280'))&&innerWidth>=1200");
  action("activate",bid);check(js(second,"document.querySelector('#draft').value").equals("\"kept-B\""),"B input retained");
  runOnMainSync(()->b.changeMode(false));fixture(second,"mobile");waitJs(second,"!!document.querySelector('#draft')&&innerWidth<900");action("activate",aid);fixture(a,"mobile-A");waitJs(a,"!!document.querySelector('#draft')&&innerWidth<900");
  runOnMainSync(()->b.changeMode(true));fixture(a,"desktop-A");waitJs(a,"!!document.querySelector('#draft')&&innerWidth>=1200");
  String cid=action("create","");WebView third=b.browser;fixture(third,"C");waitJs(third,"!!document.querySelector('#draft')&&innerWidth>=1200");try(java.io.FileOutputStream shot=new java.io.FileOutputStream(new java.io.File(getTargetContext().getExternalFilesDir(null),"browser-tabs.png"))){android.graphics.Bitmap bitmap=getUiAutomation().takeScreenshot();bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG,100,shot);bitmap.recycle();}
  action("close",bid);check(b.browser==third,"Closing background tab preserves current tab");
  CompletableFuture<Integer> count=new CompletableFuture<>();runOnMainSync(()->count.complete(b.tabStrip.getChildCount()));check(count.get()==3,"Two tab chips plus add button");
  action("activate",aid);action("close",aid);check(b.browser==third,"Closing current selects remaining tab");action("close",cid);check(DesktopBrowserHost.instance.tabs.isEmpty()&&BrowserWindow.live==null,"Closing last tab returns to conversation");
  result.putString("result","PASS native WebView: create/switch/close, retained input, inactive close, tab strip, desktop across new tabs/navigation, duplicate viewport, mobile/desktop reconciliation, last-tab close");
 }catch(Exception error){code=1;result.putString("error",error.toString());}
 finally{ShellActivity app=shell;runOnMainSync(()->{if(BrowserWindow.live!=null)BrowserWindow.live.finish();if(app!=null)app.finish();});}
 finish(code,result);
 }
}
