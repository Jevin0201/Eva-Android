package ai.eva.android.probe;

import android.os.*;
import android.webkit.*;
import android.widget.*;
import android.view.*;
import java.net.URI;

/** Eva's scoped OAuth browser. Pages have no native JavaScript interface. */
public final class McpOAuthActivity extends ToolPageActivity {
 private McpOAuth.Session session;
 private WebView browser;
 private TextView status;
 private Button cancel;
 private boolean closing,callbackUnverified;
 private final Handler handler=new Handler(Looper.getMainLooper());
 private final Runnable completion=new Runnable(){public void run(){if(session==null||isFinishing())return;if(session.terminal){finish();return;}handler.postDelayed(this,300);}};
 @Override public void onCreate(Bundle saved){
  super.onCreate(saved);page("MCP 授权","");
  session=McpOAuth.sessions.get(getIntent().getStringExtra("session"));
  if(session==null||session.terminal){body.addView(label("授权会话已结束，请返回连接设置重新授权。",14));return;}
  status=label("在 Eva 浏览器完成 "+session.name+" 的授权",13);body.addView(status);
  browser=new WebView(this);WebSettings settings=browser.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
  browser.setWebViewClient(new WebViewClient(){
   @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){
    String url=request.getUrl().toString();
    if(request.isForMainFrame()&&session.matches(url)){accept(url);return true;}
    try{URI target=new URI(url);return !"https".equals(target.getScheme())||target.getHost()==null||target.getUserInfo()!=null;}catch(Exception error){return true;}
   }
   @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError error){if(request.isForMainFrame())status.setText("页面加载失败，可刷新重试或取消授权。");}
  });
  browser.setWebChromeClient(new WebChromeClient());body.addView(browser,new LinearLayout.LayoutParams(-1,0,1));
  LinearLayout actions=new LinearLayout(this);actions.addView(button("刷新",()->browser.reload()));cancel=button("取消授权",this::cancel);actions.addView(cancel);body.addView(actions);
  if(saved==null||browser.restoreState(saved)==null)browser.loadUrl(session.url);handler.post(completion);
 }
 private void accept(String url){
  cancel.setEnabled(false);status.setText("正在提交授权结果并等待内核确认…");
  session.host.work.execute(()->{try{McpOAuth.forward(session,url,false);}catch(Exception error){runOnUiThread(()->{callbackUnverified=true;cancel.setEnabled(true);cancel.setText("返回连接设置");status.setText("授权回调未获内核确认，请返回连接设置检查状态。");});}});
 }
 private void cancel(){
  if(closing)return;
  if(session==null||session.terminal||callbackUnverified){finish();return;}
  if(session.forwarded){status.setText("内核正在处理授权结果，请等待确认。");return;}
  closing=true;cancel.setEnabled(false);
  session.host.work.execute(()->{try{McpOAuth.cancel(session.host,session.name);}catch(Exception ignored){/* The kernel timeout remains the terminal authority. */}runOnUiThread(this::finish);});
 }
 @Override public void onBackPressed(){cancel();}
 @Override void leavePage(){cancel();}
 @Override protected void onSaveInstanceState(Bundle out){super.onSaveInstanceState(out);if(browser!=null)browser.saveState(out);}
 @Override protected void onDestroy(){handler.removeCallbacks(completion);if(browser!=null){browser.stopLoading();browser.destroy();}super.onDestroy();}
}
