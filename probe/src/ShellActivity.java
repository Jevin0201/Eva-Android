package ai.eva.android.probe;
import android.app.*;import android.os.*;import android.webkit.*;import android.content.*;import android.net.Uri;import java.io.*;import java.nio.file.*;import org.json.*;
/** Bundled UI only. Remote web pages never receive this bridge. */
public class ShellActivity extends Activity {
 static final java.util.concurrent.atomic.AtomicBoolean attachmentImporting=new java.util.concurrent.atomic.AtomicBoolean();
 android.webkit.ValueCallback<Uri[]> extensionFileCallback;Uri extensionSelectedFile;
 WebView web;Bundle restoredBrowser;volatile boolean trustedShell;boolean pageReady;boolean imeVisible;int imeHeight;
 final Handler eventHandler=new Handler(Looper.getMainLooper());final java.util.concurrent.atomic.AtomicBoolean eventQueued=new java.util.concurrent.atomic.AtomicBoolean();
 final Runnable eventSignal=this::signalKernel;
 void signalKernel(){if(!eventQueued.compareAndSet(false,true))return;eventHandler.postDelayed(()->{eventQueued.set(false);if(pageReady&&!isDestroyed()&&web!=null)web.evaluateJavascript("window.pollKernel&&pollKernel()",null);},32);}

 static long persistedSaveRevision;
 static final Object saveLock=new Object();static final java.util.concurrent.atomic.AtomicLong saveRevision=new java.util.concurrent.atomic.AtomicLong();static final java.util.concurrent.ExecutorService storage=java.util.concurrent.Executors.newSingleThreadExecutor();

 void openRequestedPage(){if(!pageReady)return;if(receiveSharedIntent())return;if(PreviewSelectionRouting.consume(this,web,getIntent()))return;String scheduled=getIntent().getStringExtra("scheduledThreadId");if(scheduled!=null){getIntent().removeExtra("scheduledThreadId");if(getSharedPreferences("eva-scheduled-routing",0).contains(scheduled))web.evaluateJavascript("window.evaScheduledTasks&&evaScheduledTasks.openThread("+JSONObject.quote(scheduled)+")",null);return;}if("scheduled-tasks".equals(getIntent().getStringExtra("page"))){getIntent().removeExtra("page");startActivity(new Intent(this,ScheduledTaskActivity.class));return;}if("network-capture".equals(getIntent().getStringExtra("page"))){getIntent().removeExtra("page");startActivity(new Intent(ShellActivity.this,NetworkCaptureActivity.class));return;}if("preview-ui-check".equals(getIntent().getStringExtra("page"))){String folder=getIntent().getStringExtra("preview-folder");getIntent().removeExtra("page");getIntent().removeExtra("preview-folder");DocumentPreviewUiProbe.start(this,folder);return;}if("preview-selfcheck".equals(getIntent().getStringExtra("page"))){String folder=getIntent().getStringExtra("preview-folder");getIntent().removeExtra("page");getIntent().removeExtra("preview-folder");DocumentPreviewProbe.check(this,folder);return;}if("file-preview".equals(getIntent().getStringExtra("page"))){String path=getIntent().getStringExtra("preview-path");getIntent().removeExtra("page");getIntent().removeExtra("preview-path");startActivity(new Intent(this,WorkspacePreviewActivity.class).putExtra("path",path));return;}if("generated-image-check".equals(getIntent().getStringExtra("page"))){getIntent().removeExtra("page");GeneratedImages.check(this);return;}if("git-native-check".equals(getIntent().getStringExtra("page"))){getIntent().removeExtra("page");WorkspaceGitProbe.check(this);return;}if("workspace-edit-check".equals(getIntent().getStringExtra("page"))){getIntent().removeExtra("page");WorkspaceEditingProbe.check(this);return;}if("workspace-editor-ui-check".equals(getIntent().getStringExtra("page"))){getIntent().removeExtra("page");WorkspaceEditorUiProbe.check(this);return;}if("office-runtime".equals(getIntent().getStringExtra("page"))){getIntent().removeExtra("page");startActivity(new Intent(this,OfficeActivity.class));return;}if("backup-probe".equals(getIntent().getStringExtra("page"))){getIntent().removeExtra("page");web.evaluateJavascript("saveKernel()",ignored->DataBackupProbe.check(this));return;}if("skill-import-check".equals(getIntent().getStringExtra("page"))){getIntent().removeExtra("page");SkillImportProbe.check(this);return;}if("browser-transfers-check".equals(getIntent().getStringExtra("page"))){getIntent().removeExtra("page");BrowserTransfersProbe.run(this);return;}if("extension-check".equals(getIntent().getStringExtra("page"))){getIntent().removeExtra("page");ExtensionCheck.run(this);return;}if("phone-performance-check".equals(getIntent().getStringExtra("page"))){getIntent().removeExtra("page");startActivity(new Intent(this,PhoneFixtureActivity.class).putExtra("performance-check",true));return;}if("phone-input-check".equals(getIntent().getStringExtra("page"))){getIntent().removeExtra("page");startActivity(new Intent(this,PhoneFixtureActivity.class).putExtra("focused-input-check",true));return;}if("voice".equals(getIntent().getStringExtra("page"))){getIntent().removeExtra("page");startActivity(new Intent(this,VoiceActivity.class));return;}String phoneThread=getIntent().getStringExtra("phone-thread");if(phoneThread!=null){getIntent().removeExtra("phone-thread");web.evaluateJavascript("window.openPhoneTask&&openPhoneTask("+JSONObject.quote(phoneThread)+")",null);return;}if("browser-check".equals(getIntent().getStringExtra("page"))){getIntent().removeExtra("page");showBrowser(new Intent().putExtra("browser-check",true));return;}if("browser".equals(getIntent().getStringExtra("page"))){getIntent().removeExtra("page");showBrowser(new Intent(getIntent()));return;}if("phone-report-preview".equals(getIntent().getStringExtra("page"))){getIntent().removeExtra("page");startActivity(new Intent(this,PhoneControlActivity.class).putExtra("report-preview",true));return;}if("phone-test".equals(getIntent().getStringExtra("page"))){getIntent().removeExtra("page");startActivity(new Intent(this,PhoneFixtureActivity.class));return;}if("phone-control".equals(getIntent().getStringExtra("page"))){getIntent().removeExtra("page");startActivity(new Intent(this,PhoneControlActivity.class));return;}String panel=getIntent().getStringExtra("panel");if(panel!=null){getIntent().removeExtra("panel");web.evaluateJavascript("models".equals(panel)?"openModelSheet()":"openAccountSheet()",null);}if("account".equals(getIntent().getStringExtra("page"))){getIntent().removeExtra("page");startActivity(new Intent(ShellActivity.this,AccountActivity.class));return;}if("settings".equals(getIntent().getStringExtra("page"))){getIntent().removeExtra("page");web.evaluateJavascript("settingsGo('settings')",null);}}
 boolean receiveSharedIntent(){
  Intent incoming=getIntent();String action=incoming.getAction();
  if(!Intent.ACTION_SEND.equals(action)&&!Intent.ACTION_SEND_MULTIPLE.equals(action))return false;
  // Consume once, including a rejected share; never replay it on page reload.
  setIntent(new Intent(this,ShellActivity.class));
  String operation=null;
  try{
   java.util.LinkedHashSet<Uri> unique=new java.util.LinkedHashSet<>();
   if(Intent.ACTION_SEND_MULTIPLE.equals(action)){java.util.ArrayList<Uri> streams=incoming.getParcelableArrayListExtra(Intent.EXTRA_STREAM);if(streams!=null)unique.addAll(streams);}
   else {Uri stream=incoming.getParcelableExtra(Intent.EXTRA_STREAM);if(stream!=null)unique.add(stream);}
   ClipData clip=incoming.getClipData();if(clip!=null){if(clip.getItemCount()>64)throw new IOException("分享文件过多，请分批分享");for(int n=0;n<clip.getItemCount();n++){Uri uri=clip.getItemAt(n).getUri();if(uri!=null)unique.add(uri);}}
   if(unique.size()>64)throw new IOException("分享文件过多，请分批分享");
   for(Uri uri:unique)if(uri==null||!"content".equals(uri.getScheme()))throw new IOException("不支持此分享文件地址，请通过手机文件选择器导入");
   CharSequence extra=incoming.getCharSequenceExtra(Intent.EXTRA_TEXT);String text=extra==null?"":extra.toString();
   if(text.length()>200000)throw new IOException("分享文字过长，请保存为文件后分享");
   if(unique.isEmpty()&&text.isEmpty())throw new IOException("没有收到可导入的文件或文字");
   String target="share-"+java.util.UUID.randomUUID().toString();
   operation=reserveAttachmentImport("share",target,"");
   final String owner=operation;final java.util.ArrayList<Uri> uris=new java.util.ArrayList<>(unique);
   web.evaluateJavascript("window.prepareSharedDraft&&prepareSharedDraft("+JSONObject.quote(target)+","+JSONObject.quote(text)+")",result->{
    if("true".equals(result))importAttachments(owner,target,"",uris);
    else {finishAttachmentImport(owner,target,new JSONArray(),new IOException("分享草稿创建失败，请重新分享"));android.widget.Toast.makeText(this,"分享草稿创建失败，请重新分享",1).show();}
   });
  }catch(Exception error){if(operation!=null)finishAttachmentImport(operation,"",new JSONArray(),error);android.widget.Toast.makeText(this,attachmentError(error),1).show();}
  return true;
 }
 protected void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);openRequestedPage();}
 public void onCreate(Bundle state){super.onCreate(state);if(!attachmentImporting.get())getSharedPreferences("eva-transfer",0).edit().putBoolean("busy",false).commit();if(Build.VERSION.SDK_INT>=33)getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,()->onBackPressed());ScheduledTaskService.restore(this);if(getSharedPreferences("eva-plugin-import",0).getBoolean("busy",false)&&!ExtensionAuthoring.importing.get())getSharedPreferences("eva-plugin-import",0).edit().putBoolean("busy",false).putString("result","{\"id\":\"interrupted\",\"error\":\"上次插件导入已中断，请检查已安装项目后再操作；没有自动重试\"}").commit();restoredBrowser=state==null?null:state.getBundle("eva-browser");web=new WebView(this);web.setBackgroundColor(-1);android.widget.FrameLayout frame=new android.widget.FrameLayout(this);frame.setBackgroundColor(-1);frame.addView(web,new android.widget.FrameLayout.LayoutParams(-1,-1));frame.setOnApplyWindowInsetsListener((v,i)->{if(Build.VERSION.SDK_INT>=30){android.graphics.Insets bars=i.getInsets(android.view.WindowInsets.Type.systemBars()),ime=i.getInsets(android.view.WindowInsets.Type.ime());v.setPadding(bars.left,bars.top,bars.right,Math.max(bars.bottom,ime.bottom));setKeyboardState(i.isVisible(android.view.WindowInsets.Type.ime()),ime.bottom);}else{v.setPadding(i.getSystemWindowInsetLeft(),i.getSystemWindowInsetTop(),i.getSystemWindowInsetRight(),i.getSystemWindowInsetBottom());setKeyboardState(i.getSystemWindowInsetBottom()>getResources().getDisplayMetrics().density*100,i.getSystemWindowInsetBottom());}return i;});setContentView(frame);web.getSettings().setJavaScriptEnabled(true);web.setWebChromeClient(new android.webkit.WebChromeClient(){public boolean onShowFileChooser(WebView view,android.webkit.ValueCallback<Uri[]> callback,android.webkit.WebChromeClient.FileChooserParams params){if(!"https://eva.invalid/index.html".equals(view.getUrl()))return false;if(extensionFileCallback!=null)extensionFileCallback.onReceiveValue(null);extensionFileCallback=callback;extensionSelectedFile=null;try{startActivityForResult(new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*"),704);}catch(Exception e){extensionFileCallback=null;callback.onReceiveValue(null);}return true;}});web.getSettings().setAllowFileAccess(false);web.getSettings().setAllowContentAccess(false);web.getSettings().setDomStorageEnabled(true);web.addJavascriptInterface(new Bridge(),"EvaHost");web.setWebViewClient(new WebViewClient(){
 public void onPageStarted(WebView v,String url,android.graphics.Bitmap icon){trustedShell=false;}
 public void onPageFinished(WebView v,String url){trustedShell="https://eva.invalid/index.html".equals(url);pageReady=trustedShell;openRequestedPage();signalKernel();publishKeyboardState();if(restoredBrowser!=null)showBrowser(new Intent());}
 public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){Uri uri=r.getUrl();String path=uri.getPath();if(r.isForMainFrame()&&r.hasGesture()&&"https".equals(uri.getScheme())&&"eva.invalid".equals(uri.getHost())&&path!=null&&path.startsWith("/root/eva-workspace/")){try{String relative=path.substring("/root/eva-workspace/".length());File file=WorkspaceFiles.resolve(ShellActivity.this,relative);if(!file.isFile())throw new IOException("文件不存在或已移动");startActivity(new Intent(ShellActivity.this,WorkspacePreviewActivity.class).putExtra("path",relative));}catch(Exception e){android.widget.Toast.makeText(ShellActivity.this,e.getMessage(),1).show();}}return true;}
 public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest r){String path=r.getUrl().getPath();if("https".equals(r.getUrl().getScheme())&&!"eva.invalid".equals(r.getUrl().getHost())&&!r.isForMainFrame()&&r.getRequestHeaders().getOrDefault("Accept","").contains("image/"))return null;if("https".equals(r.getUrl().getScheme())&&"eva.invalid".equals(r.getUrl().getHost())&&"/extension-icon".equals(path))return ExtensionIconCache.serve(ShellActivity.this,r.getUrl());if("https".equals(r.getUrl().getScheme())&&"eva.invalid".equals(r.getUrl().getHost())&&"/extension-media".equals(path))return ExtensionAuthoring.media(ShellActivity.this,r.getUrl());if("eva.invalid".equals(r.getUrl().getHost())&&"/generated-image".equals(path))return GeneratedImages.serve(ShellActivity.this,r.getUrl());if("https".equals(r.getUrl().getScheme())&&"eva.invalid".equals(r.getUrl().getHost())&&(path.matches("/desktop-stream/native-steering/assets/[a-f0-9]+\\.(woff2?|ttf)")||path.matches("/desktop-stream/(?:[A-Za-z0-9_-]+/)*[A-Za-z0-9_.-]+\\.(js|css|svg|woff2?|ttf)")||path.equals("/clipboard.js")||path.equals("/chat-scroll.js")||path.equals("/chat-scroll.css")||path.equals("/desktop-thread-activity.js")||path.equals("/desktop-task-status.css")||path.equals("/composer-bottom-layout.css")||path.equals("/composer-bottom-layout.js")||path.equals("/android-navigation.js")||path.equals("/desktop-stream-layout.css")||path.equals("/desktop-stream-renderer.js")||path.equals("/desktop-stream-disclosure.js")||path.equals("/desktop-stream-actions.js")||path.equals("/desktop-stream-host.js")||path.equals("/scheduled-task-ui.js")||path.equals("/desktop-stream-image-bridge.js")||path.equals("/desktop-stream/native-image-preview/bootstrap.js")||path.equals("/desktop-stream/native-image-preview/tool.js")||path.equals("/desktop-stream/native-image-preview/common.js")||path.equals("/desktop-stream/work-duration.js")||path.equals("/desktop-stream/work-timer.js")||path.equals("/desktop-stream/native-transcript/original-core.js")||path.equals("/desktop-stream/native-transcript/activity-core.js")||path.equals("/desktop-stream/native-transcript/statistics-core.js")||path.equals("/desktop-stream/native-transcript/disclosure-core.js")||path.equals("/desktop-stream/native-transcript/host.js")||path.equals("/desktop-stream/native-steering/bootstrap.js")||path.equals("/desktop-stream/native-steering/bundle.js")||path.equals("/kernel-paged-history.js")||path.equals("/delivery-files.js")||path.equals("/delivery-files.css")||path.equals("/eva-flow-projection.js")||path.equals("/eva-native-transcript/original-core.js")||path.equals("/eva-native-transcript/activity-core.js")||path.equals("/eva-native-transcript/statistics-core.js")||path.equals("/eva-native-transcript/disclosure-core.js")||path.equals("/eva-native-transcript/host.js")||path.equals("/eva-transcript-mobile.css")||path.equals("/eva-transcript-dom.js")||path.equals("/eva-flow-feedback.js")||path.equals("/backup-history.js")||path.equals("/memory-settings.js")||path.equals("/hooks-settings.js")||path.equals("/plugin-manager.js")||path.equals("/desktop-mcp-auth-lifecycle.js")||path.equals("/mcp-settings.js")||path.equals("/desktop-user-input.js")||path.equals("/desktop-preview-types.js")||path.equals("/desktop-runtime-diagnostics.js")||path.equals("/agent-questions.js")||path.equals("/composer-references.js")||path.equals("/preview-selection.js")||path.equals("/composer-references.css")||path.equals("/extension-list.js")||path.equals("/skill-manager.js")||path.equals("/task-controls.js")||path.equals("/original-activity.js")||path.equals("/codex-message-adapter.js")||path.equals("/codex-message-adapter.css")||path.equals("/codex-message-original.css")||path.equals("/codex-user-original.css")||path.equals("/user-attachments.js")||path.equals("/user-attachments.css")||path.equals("/voice.js")||path.equals("/keyboard.js")||path.equals("/keyboard.css")||path.equals("/product-ui.css")||path.equals("/desktop-extensions.js")||path.equals("/desktop-extensions.css")||path.equals("/native-plugin-add/bundle.js")||path.equals("/native-plugin-add/controls.css")||path.equals("/native-plugin-add/host-adapter.css")||path.equals("/index.html")||path.equals("/app.js")||path.equals("/context-compaction-core.js")||path.equals("/context-compaction.js")||path.equals("/context-compaction.css")||path.equals("/eva-desktop-delivery-scanner.js")||path.equals("/settings.js")||path.equals("/settings-product.css")||path.equals("/settings-refresh.css")||path.equals("/pages.js")||path.equals("/models.js")||path.equals("/eva-stream-state.js")||path.equals("/generated-images.js")||path.equals("/eva-flow-view.js")||path.equals("/eva-markdown.js")||path.equals("/eva-account-quota.js")||path.equals("/model-panels.js")||path.equals("/eva-composer-icons.js")||path.equals("/eva-model-control-core.js")||path.equals("/eva-model-control-adapter.js")||path.equals("/eva-model-control.css")||path.equals("/workflows.js")||path.equals("/eva-permissions.js")||path.equals("/eva-permissions.css")||path.equals("/mobile-subagents.js")||path.equals("/mobile-subagents.css"))){try{return new WebResourceResponse(path.endsWith(".svg")?"image/svg+xml":path.endsWith(".js")?"text/javascript":path.endsWith(".css")?"text/css":path.endsWith(".woff2")?"font/woff2":path.endsWith(".woff")?"font/woff":path.endsWith(".ttf")?"font/ttf":"text/html","UTF-8",getAssets().open(path.substring(1)));}catch(Exception ignored){}}return new WebResourceResponse("text/plain","UTF-8",new ByteArrayInputStream(new byte[0]));}
 });web.loadUrl("https://eva.invalid/index.html");RuntimeSetupActivity.checkOnLaunch(this);}
 protected void onActivityResult(int request,int result,Intent intent){super.onActivityResult(request,result,intent);if(request==705){if(android.provider.Settings.canDrawOverlays(this)&&PhoneAgentPreview.enabled(this)){PhoneAgentDisplay.restore(this);PhoneAgentPreview.show(this);}return;}if(BrowserTransfers.onActivityResult(this,request,result,intent))return;if(request==704){Uri selected=result==RESULT_OK&&intent!=null?intent.getData():null;extensionSelectedFile=selected;android.webkit.ValueCallback<Uri[]> callback=extensionFileCallback;extensionFileCallback=null;if(callback!=null)callback.onReceiveValue(selected==null?null:new Uri[]{selected});return;}if(request==703){new Thread(()->{JSONObject value=new JSONObject();try{if(result==RESULT_OK&&intent!=null&&intent.getData()!=null)value=ExtensionAuthoring.importUri(this,intent.getData());else value.put("cancelled",true);}catch(Exception e){try{value.put("error",e.getMessage());}catch(Exception ignored){}}try{value.put("id",java.util.UUID.randomUUID().toString());}catch(Exception ignored){}getSharedPreferences("eva-plugin-import",0).edit().putString("result",value.toString()).putBoolean("busy",false).commit();}).start();return;}if(request==702){handleSkillImport(result,intent);return;}if(request!=701)return;
 final android.content.SharedPreferences transfer=getSharedPreferences("eva-transfer",0);
 final String operation=transfer.getString("operation","");
 if(!operation.startsWith("picker-")||!attachmentImporting.get())return;
 final String target=transfer.getString("target",""),project=transfer.getString("project","");
 final java.util.ArrayList<Uri> uris=new java.util.ArrayList<>();
 if(result==RESULT_OK&&intent!=null){if(intent.getClipData()!=null){for(int n=0;n<intent.getClipData().getItemCount();n++){Uri uri=intent.getClipData().getItemAt(n).getUri();if(uri!=null)uris.add(uri);}}else if(intent.getData()!=null)uris.add(intent.getData());}
 importAttachments(operation,target,project,uris);
 }

 public void onRequestPermissionsResult(int request,String[] permissions,int[] results){super.onRequestPermissionsResult(request,permissions,results);BrowserSitePermissions.onRequestPermissionsResult(this,request,permissions,results);}
 void setKeyboardState(boolean visible,int height){if(imeVisible==visible&&imeHeight==height)return;imeVisible=visible;imeHeight=height;publishKeyboardState();}
 void publishKeyboardState(){if(pageReady&&web!=null)web.evaluateJavascript("window.evaKeyboardState&&evaKeyboardState({visible:"+imeVisible+",height:"+imeHeight+"})",null);}
 void hideKeyboard(){if(web==null)return;web.evaluateJavascript("(()=>{const e=document.activeElement;if(e&&e.blur)e.blur()})()",null);if(Build.VERSION.SDK_INT>=30&&web.getWindowInsetsController()!=null)web.getWindowInsetsController().hide(android.view.WindowInsets.Type.ime());((android.view.inputmethod.InputMethodManager)getSystemService(INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(web.getWindowToken(),0);setKeyboardState(false,0);}
 void handleSkillImport(int result,Intent intent){String project=getSharedPreferences("eva-skill-import",0).getString("project",""),name=getSharedPreferences("eva-skill-import",0).getString("name","");new Thread(()->{JSONObject r=new JSONObject();try{if(result==RESULT_OK&&intent!=null&&intent.getData()!=null)r=SkillStore.importUri(this,intent.getData(),project,name);else r.put("cancelled",true);}catch(Exception e){try{r.put("error",e.getMessage());}catch(Exception ignored){}}try{r.put("id",java.util.UUID.randomUUID().toString());}catch(Exception ignored){}getSharedPreferences("eva-skill-import",0).edit().putString("result",r.toString()).putBoolean("busy",false).commit();}).start();}

 /** A single owner covers both an open picker and a background clipboard import. */
 String reserveAttachmentImport(String kind,String target,String project) throws Exception {
  if(target==null||target.isEmpty()||target.length()>256)throw new IOException("无效附件目标");
  if(project==null||(!project.isEmpty()&&!project.matches("[a-zA-Z0-9-]{1,64}")))throw new IOException("无效项目编号");
  synchronized(ShellActivity.class){
   android.content.SharedPreferences p=getSharedPreferences("eva-transfer",0);
   if(attachmentImporting.get()||p.getBoolean("busy",false))throw new IOException("正在选择或导入附件，请稍候");
   if(p.contains("result")&&!"{}".equals(p.getString("result","{}")))throw new IOException("上一批附件正在处理，请稍候");
   String id=kind+"-"+java.util.UUID.randomUUID().toString();
   attachmentImporting.set(true);
   try{
    if(!p.edit().putString("operation",id).putString("target",target).putString("project",project).putBoolean("busy",true).commit())throw new IOException("无法保存附件导入状态");
    return id;
   }catch(Exception error){try{p.edit().remove("operation").putBoolean("busy",false).apply();}finally{attachmentImporting.set(false);}throw error;}
  }
 }
 static String attachmentError(Exception error){return error instanceof SecurityException?"文件访问授权已失效，请重新复制或选择":error.getMessage()==null?"无法读取或导入剪贴板内容":error.getMessage();}
 void finishAttachmentImport(String operation,String target,JSONArray files,Exception error){
  JSONObject response=new JSONObject();
  try{response.put("target",target).put("id",operation).put("files",files);if(error!=null)response.put("error",attachmentError(error));}catch(Exception ignored){}
  synchronized(ShellActivity.class){
   android.content.SharedPreferences p=getSharedPreferences("eva-transfer",0);
   if(!operation.equals(p.getString("operation","")))return;
   try{p.edit().putString("result",response.toString()).putBoolean("busy",false).remove("operation").commit();}finally{attachmentImporting.set(false);}
  }
 }
 void importAttachments(String operation,String target,String project,java.util.List<Uri> uris){
  try{new Thread(()->{
   JSONArray files=new JSONArray();Exception failure=null;boolean completed=false;
   try{if(!uris.isEmpty()){RuntimeBootstrap.requireAvailable(ShellActivity.this);WorkspaceFiles.project(ShellActivity.this,project);for(Uri uri:uris)files.put(WorkspaceFiles.importSelection(ShellActivity.this,uri,project));}completed=true;}
   catch(Exception error){failure=error;}
   finally{finishAttachmentImport(operation,target,files,!completed&&failure==null?new IOException("附件导入已中断"):failure);}
  },"eva-attachment-import").start();}
  catch(Exception error){finishAttachmentImport(operation,target,new JSONArray(),error);}
 }
 void openAttachmentPicker(String target,String project,boolean photos,boolean folder){
  String operation=null;
  try{
   operation=reserveAttachmentImport("picker",target,project);
   RuntimeBootstrap.requireAvailable(this);WorkspaceFiles.project(this,project);
   if(folder)startActivityForResult(new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION),701);
   else try{startActivityForResult(WorkspaceFiles.picker(this,photos),701);}
   catch(ActivityNotFoundException unavailable){startActivityForResult(new Intent(Intent.ACTION_GET_CONTENT).addCategory(Intent.CATEGORY_OPENABLE).setType(photos?"image/*":"*/*").putExtra(Intent.EXTRA_ALLOW_MULTIPLE,true),701);}
  }catch(Exception error){if(operation!=null)finishAttachmentImport(operation,target,new JSONArray(),error);android.widget.Toast.makeText(this,attachmentError(error),1).show();}
 }
 /** Classifies ClipData without resolving content URIs on the JavaScript bridge thread. */
 static final class ClipboardSelection {
  String text;final java.util.ArrayList<Uri> uris=new java.util.ArrayList<>();
  static ClipboardSelection read(Context context) throws Exception {
   android.content.ClipboardManager clipboard=(android.content.ClipboardManager)context.getSystemService(CLIPBOARD_SERVICE);
   android.content.ClipData clip=clipboard==null?null:clipboard.getPrimaryClip();
   return fromClip(context,clip);
  }
  static ClipboardSelection fromClip(Context context,android.content.ClipData clip) throws Exception {
   if(clip==null||clip.getItemCount()==0)throw new IOException("剪贴板为空或当前无法读取");
   if(clip.getItemCount()>64)throw new IOException("剪贴板内容过多，请分批粘贴");
   ClipboardSelection result=new ClipboardSelection();StringBuilder text=new StringBuilder();
   for(int n=0;n<clip.getItemCount();n++){
    android.content.ClipData.Item item=clip.getItemAt(n);CharSequence value=item.getText();
    // Coercing a content URI may synchronously read an arbitrarily large provider stream.
    if(value==null&&item.getUri()==null&&item.getIntent()==null)value=item.coerceToText(context);
    if(value!=null&&value.length()>0){
     if(value.length()>400000||text.length()+value.length()+(text.length()>0?1:0)>400000)throw new IOException("剪贴板文字过长（最多 400000 字符）");
     String plain=value.toString();
     if(plain.trim().regionMatches(true,0,"content://",0,10))continue;
     if(text.length()>0)text.append('\n');text.append(plain);
    }
   }
   // HTML/text copies have one text representation; never also import their URI flavor.
   if(text.length()>0){result.text=text.toString();return result;}
   java.util.LinkedHashSet<Uri> unique=new java.util.LinkedHashSet<>();
   for(int n=0;n<clip.getItemCount();n++){Uri uri=clip.getItemAt(n).getUri();if(uri!=null){if(!"content".equalsIgnoreCase(uri.getScheme()))throw new IOException("此剪贴板资源不支持导入，请使用文件选择器");unique.add(uri);}}
   if(unique.isEmpty())throw new IOException("剪贴板中没有可粘贴的文字、图片或文件");
   result.uris.addAll(unique);return result;
  }
 }
 class Bridge {
 @JavascriptInterface public String scheduledThreadBinding(String threadId){return getSharedPreferences("eva-scheduled-routing",0).getString(threadId,"null");}
 @JavascriptInterface public String revealWorkspaceFile(String path){try{File file=WorkspaceFiles.resolve(ShellActivity.this,path);if(!file.exists())return "文件不存在或已移动";File folder=file.isDirectory()?file:file.getParentFile();String relative=WorkspaceFiles.root(ShellActivity.this).toPath().relativize(folder.toPath()).toString();runOnUiThread(()->startActivity(new Intent(ShellActivity.this,FilesActivity.class).putExtra("open-folder",relative)));return "";}catch(Exception error){return "文件不在工作区内或无法打开";}}
 @JavascriptInterface public String previewWorkspaceFile(String path){try{File file=WorkspaceFiles.resolve(ShellActivity.this,path);if(file.isDirectory())return revealWorkspaceFile(path);if(!file.isFile())return "文件不存在或已移动";runOnUiThread(()->startActivity(new Intent(ShellActivity.this,WorkspacePreviewActivity.class).putExtra("path",path)));return "";}catch(Exception error){return "文件不在工作区内或无法打开";}}
 @JavascriptInterface public void exportWorkspaceFile(String path){runOnUiThread(()->{try{File file=WorkspaceFiles.resolve(ShellActivity.this,path);if(!file.isFile())throw new IOException("文件不存在");startActivity(new Intent(ShellActivity.this,WorkspacePreviewActivity.class).putExtra("path",path).putExtra("export-on-open",true));}catch(Exception e){android.widget.Toast.makeText(ShellActivity.this,"无法下载："+e.getMessage(),1).show();}});}
 @JavascriptInterface public void openUrl(String url){try{java.net.URI u=new java.net.URI(url);if(!"https".equals(u.getScheme())||u.getHost()==null||u.getUserInfo()!=null)return;runOnUiThread(()->showBrowser(new Intent().putExtra("initialUrl",url)));}catch(Exception ignored){}}
 @JavascriptInterface public String pickPluginArchive(){synchronized(ShellActivity.class){if(getSharedPreferences("eva-plugin-import",0).getBoolean("busy",false))return "{\"error\":\"已有插件包操作正在进行\"}";getSharedPreferences("eva-plugin-import",0).edit().remove("result").putBoolean("busy",true).commit();}if(extensionSelectedFile!=null){final Uri selected=extensionSelectedFile;extensionSelectedFile=null;new Thread(()->{JSONObject value=new JSONObject();try{value=ExtensionAuthoring.importUri(ShellActivity.this,selected);}catch(Exception e){try{value.put("error",e.getMessage());}catch(Exception ignored){}}try{value.put("id",java.util.UUID.randomUUID().toString());}catch(Exception ignored){}getSharedPreferences("eva-plugin-import",0).edit().putString("result",value.toString()).putBoolean("busy",false).commit();}).start();return "{}";}runOnUiThread(()->{try{startActivityForResult(new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*"),703);}catch(Exception e){getSharedPreferences("eva-plugin-import",0).edit().putBoolean("busy",false).commit();}});return "{}";}
 @JavascriptInterface public String pluginArchiveResult(){return getSharedPreferences("eva-plugin-import",0).getString("result","{}");}
 @JavascriptInterface public void pluginArchiveAck(){getSharedPreferences("eva-plugin-import",0).edit().remove("result").commit();}

 @JavascriptInterface public String skillCall(String action,String json){try{RuntimeBootstrap.requireAvailable(ShellActivity.this);return SkillStore.call(ShellActivity.this,action,new JSONObject(json)).toString();}catch(Exception e){return "{\"error\":"+JSONObject.quote(e.getMessage())+"}";}}
 @JavascriptInterface public String pickSkill(String project,String name){try{RuntimeBootstrap.requireAvailable(ShellActivity.this);SkillStore.skill(ShellActivity.this,project,name);if(getSharedPreferences("eva-skill-import",0).getBoolean("busy",false))throw new IOException("文件选择器已打开");getSharedPreferences("eva-skill-import",0).edit().putString("project",project).putString("name",name).putBoolean("busy",true).commit();runOnUiThread(()->{try{startActivityForResult(new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*"),702);}catch(Exception e){getSharedPreferences("eva-skill-import",0).edit().putBoolean("busy",false).commit();}});return "{}";}catch(Exception e){return "{\"error\":"+JSONObject.quote(e.getMessage())+"}";}}
 @JavascriptInterface public String skillImportResult(){return getSharedPreferences("eva-skill-import",0).getString("result","{}");}
 @JavascriptInterface public void skillImportAck(){getSharedPreferences("eva-skill-import",0).edit().remove("result").commit();}
 @JavascriptInterface public String pendingQuestions(){return KernelHost.get(ShellActivity.this).pendingQuestions();}
 @JavascriptInterface public String voiceThreads(){return getSharedPreferences("eva-voice",0).getString("threads","[]");}
 @JavascriptInterface public void voiceThreadsImported(String ids){try{synchronized(VoiceAgent.class){JSONArray imported=new JSONArray(ids),current=new JSONArray(getSharedPreferences("eva-voice",0).getString("threads","[]")),keep=new JSONArray();java.util.HashSet<String> seen=new java.util.HashSet<>();for(int n=0;n<imported.length();n++)seen.add(imported.getString(n));for(int n=0;n<current.length();n++){JSONObject c=current.getJSONObject(n);if(!seen.contains(c.getJSONObject("kernelThread").getString("id")))keep.put(c);}getSharedPreferences("eva-voice",0).edit().putString("threads",keep.toString()).commit();}}catch(Exception ignored){}}
 @JavascriptInterface public void voiceOpen(String config){try{JSONObject c=new JSONObject(config);if(config.length()>4096)return;getSharedPreferences("eva-voice",0).edit().putString("config",c.toString()).commit();runOnUiThread(()->startActivity(new Intent(ShellActivity.this,VoiceActivity.class)));}catch(Exception ignored){}}

 @JavascriptInterface public void hideKeyboard(){runOnUiThread(ShellActivity.this::hideKeyboard);}
 @JavascriptInterface public String createProject(String id){try{RuntimeBootstrap.requireAvailable(ShellActivity.this);WorkspaceFiles.project(ShellActivity.this,id);return "";}catch(Exception e){return e.getMessage();}}
 @JavascriptInterface public String attachmentResult(){return getSharedPreferences("eva-transfer",0).getString("result","{}");}
 @JavascriptInterface public void attachmentAck(){getSharedPreferences("eva-transfer",0).edit().remove("result").commit();}
 @JavascriptInterface public void pickAttachmentFolder(String target,String project){runOnUiThread(()->openAttachmentPicker(target,project,false,true));}
 @JavascriptInterface public void pickAttachments(String target,String project,boolean photos){runOnUiThread(()->openAttachmentPicker(target,project,photos,false));}
 /** Invoked only by the bundled frontend's explicit paste action; never polled. */
 @JavascriptInterface public String clipboardPaste(String target,String project){
  try{
   if(!trustedShell||isDestroyed())throw new IOException("当前页面不可读取剪贴板");
   ClipboardSelection selected=ClipboardSelection.read(ShellActivity.this);
   if(selected.text!=null)return new JSONObject().put("text",selected.text).toString();
   String operation=reserveAttachmentImport("clipboard",target,project);
   importAttachments(operation,target,project,selected.uris);
   return new JSONObject().put("importing",true).put("id",operation).put("target",target).toString();
  }catch(Exception error){return "{\"error\":"+JSONObject.quote(attachmentError(error))+"}";}
 }


 @JavascriptInterface public boolean providerChoice(String id){try{new ModelStore(ShellActivity.this).select(id);return true;}catch(Exception e){return false;}}
 @JavascriptInterface public boolean accountChoice(String model,String effort,String tier){return modelDefault("openai",model,effort,tier);}
 @JavascriptInterface public boolean modelDefault(String providerId,String model,String effort,String tier){try{new ModelStore(ShellActivity.this).setDefaultSelection(providerId,model,effort,tier);return true;}catch(Exception e){return false;}}
 @JavascriptInterface public boolean modelPreference(String providerId,String model,String json){try{new ModelStore(ShellActivity.this).modelPreference(providerId,model,new JSONObject(json));return true;}catch(Exception e){return false;}}
 long cachedProvidersUntil;String cachedProvidersRaw=null,cachedProvidersJson=null;java.util.Map<String,?> cachedAccountSettings=null;
 @JavascriptInterface public String providers(){synchronized(ModelStore.LOCK){try{
  String raw=getSharedPreferences("eva-providers",0).getString("config","");java.util.Map<String,?> account=getSharedPreferences("eva-account",0).getAll();
  if(cachedProvidersJson!=null&&System.currentTimeMillis()<cachedProvidersUntil&&raw.equals(cachedProvidersRaw)&&account.equals(cachedAccountSettings))return cachedProvidersJson;
  String value=new ModelStore(ShellActivity.this).publicConfig().toString();
  cachedProvidersRaw=getSharedPreferences("eva-providers",0).getString("config","");cachedAccountSettings=new java.util.HashMap<String,Object>(account);cachedProvidersJson=value;cachedProvidersUntil=value.contains("\"managedBy\":\"dsh\"")?System.currentTimeMillis()+60000:Long.MAX_VALUE;return value;
 }catch(Exception e){return "{\"providers\":[],\"active\":\"\",\"error\":\"配置读取失败\"}";}}}

 @JavascriptInterface public void kernelCall(String ticket,String method,String params){KernelHost.get(ShellActivity.this).call(ticket,method,params);}
 @JavascriptInterface public boolean copyText(String text){try{if(text==null||text.length()>400000)return false;((android.content.ClipboardManager)getSystemService(CLIPBOARD_SERVICE)).setPrimaryClip(android.content.ClipData.newPlainText("Eva",text));return true;}catch(Exception error){return false;}}
 @JavascriptInterface public boolean supportsHistoryActivity(){return true;}
 @JavascriptInterface public String kernelTrace(boolean reset){return KernelTrace.read(reset);}
 @JavascriptInterface public String kernelDrain(){return KernelHost.get(ShellActivity.this).drain();}
 @JavascriptInterface public void kernelRespond(String id,String result){KernelHost.get(ShellActivity.this).respond(id,result);}
 @JavascriptInterface public String modelStart(String id,String provider,String model,String input){return "{\"state\":\"failed\",\"error\":\"Direct transport retired; use Codex app-server\"}";}
 @JavascriptInterface public String modelPoll(String id){return ModelClient.poll(ShellActivity.this,id);}
 @JavascriptInterface public void modelCancel(String id){ModelClient.cancel(id);}
 @JavascriptInterface public void modelAck(String id){getSharedPreferences("eva-model-jobs",0).edit().remove(id).commit();}

 @JavascriptInterface public String settingsBasic(){try{android.content.SharedPreferences p=getSharedPreferences("eva-settings",0);return new JSONObject().put("commandTimeout",p.getInt("commandTimeout",120)).put("browserHome",p.getString("browserHome","https://example.com")).put("browserDesktop",p.getBoolean("browserDesktop",true)).put("theme",p.getString("theme","light")).toString();}catch(Exception e){return "{}";}}
 @JavascriptInterface public String settings(){try{android.content.SharedPreferences p=getSharedPreferences("eva-settings",0);JSONObject o=new JSONObject();o.put("commandTimeout",p.getInt("commandTimeout",120));o.put("browserHome",p.getString("browserHome","https://example.com"));o.put("browserDesktop",p.getBoolean("browserDesktop",true));o.put("theme",p.getString("theme","light"));o.put("freeMiB",getFilesDir().getUsableSpace()/1024/1024);o.put("rootfs",new File(getFilesDir(),"alpine/bin/busybox").isFile());return o.toString();}catch(Exception e){return "{}";}}
 @JavascriptInterface public String setSetting(String key,String value){try{android.content.SharedPreferences.Editor e=getSharedPreferences("eva-settings",0).edit();if(key.equals("commandTimeout")){int n=Integer.parseInt(value);if(n!=30&&n!=60&&n!=120&&n!=300)throw new IllegalArgumentException("不支持的超时值");e.putInt(key,n);}else if(key.equals("browserHome")){if(value.length()>2048)throw new IllegalArgumentException("地址过长");e.putString(key,SettingsActivity.validateUrl(value));}else if(key.equals("browserDesktop")){if(!value.equals("true")&&!value.equals("false"))throw new IllegalArgumentException("无效浏览模式");e.putBoolean(key,Boolean.parseBoolean(value));}else if(key.equals("theme")){if(!value.equals("light")&&!value.equals("dark"))throw new IllegalArgumentException("不支持的主题");e.putString(key,value);}else throw new IllegalArgumentException("不支持的设置");if(!e.commit())throw new IOException("保存失败");return settings();}catch(Exception e){try{return new JSONObject().put("error",e.getMessage()).toString();}catch(Exception ignored){return "{}";}}}
 @JavascriptInterface public String load(){return UiStateStore.load(ShellActivity.this);}
 @JavascriptInterface public void saveNavigationLater(String value){long revision=saveRevision.get();storage.execute(()->{try{synchronized(saveLock){if(persistedSaveRevision>revision)return;if(!UiStateStore.saveNavigation(ShellActivity.this,value))throw new IOException("会话选择保存失败");}}catch(Exception error){try{KernelHost.get(ShellActivity.this).emit(new JSONObject().put("method","android/storageError"));}catch(Exception ignored){}}});}
 @JavascriptInterface public String saveUiStructure(String value){synchronized(saveLock){if(persistedSaveRevision!=saveRevision.get())return "full";long operation=UiStateStore.nextOperation();long revision=saveRevision.incrementAndGet();try{boolean saved=UiStateStore.saveStructure(ShellActivity.this,value,operation);if(saved)persistedSaveRevision=revision;return saved?"saved":"full";}catch(Exception e){return "error";}}}
 @JavascriptInterface public boolean save(String value){long operation=UiStateStore.nextOperation();long revision=saveRevision.incrementAndGet();synchronized(saveLock){return saveValue(value,revision,operation);}}
 boolean saveValue(String value,long revision,long operation){try{if(revision!=saveRevision.get())return true;UiStateStore.save(ShellActivity.this,value,operation);persistedSaveRevision=revision;return true;}catch(Exception ignored){return false;}}
 @JavascriptInterface public void refreshLocalModelCatalog(){LocalFreeModels.refreshCatalogAsync(ShellActivity.this,null);}
 @JavascriptInterface public void refreshDshModels(){DshModelMonitor.refresh(ShellActivity.this,true);}
 @JavascriptInterface public void saveModelSelection(String ticket,String value){
  long operation=UiStateStore.nextOperation();
  storage.execute(()->{
   JSONObject response=new JSONObject();
   boolean saved=false;
   try{saved=UiStateStore.modelSelection(ShellActivity.this,value,operation);}catch(Exception ignored){}
   try{response.put("ticket",ticket).put("result",saved);KernelHost.get(ShellActivity.this).emit(response);}catch(Exception ignored){}
  });
 }
 @JavascriptInterface public void saveConversationCheckpoint(String ticket,String value){
  long operation=UiStateStore.nextOperation();long revision=saveRevision.get();
  storage.execute(()->{
   JSONObject response=new JSONObject();
   try{
    boolean saved;
    synchronized(saveLock){
     saved=persistedSaveRevision>revision||UiStateStore.checkpoint(ShellActivity.this,value,operation);
    }
    response.put("ticket",ticket).put("result",new JSONObject().put("needsFullSnapshot",!saved));
   }catch(Exception error){
    try{response.put("ticket",ticket).put("error","发送前保存失败，原文字已保留");}catch(JSONException ignored){}
   }
   KernelHost.get(ShellActivity.this).emit(response);
  });
 }
 @JavascriptInterface public void saveCheckpoint(String ticket,String value){
  long operation=UiStateStore.nextOperation();long revision=saveRevision.incrementAndGet();
  storage.execute(()->{
   JSONObject response=new JSONObject();
   try{
    synchronized(saveLock){
     if(persistedSaveRevision<revision){
      UiStateStore.save(ShellActivity.this,value,operation);
      persistedSaveRevision=revision;
     }
    }
    response.put("ticket",ticket).put("result",new JSONObject());
   }catch(Exception error){
    try{response.put("ticket",ticket).put("error","发送前保存失败，原文字已保留");}catch(JSONException ignored){}
   }
   KernelHost.get(ShellActivity.this).emit(response);
  });
 }
 @JavascriptInterface public void saveLater(String value){long operation=UiStateStore.nextOperation();long revision=saveRevision.incrementAndGet();storage.execute(()->{boolean ok;synchronized(saveLock){ok=saveValue(value,revision,operation);}if(!ok)try{KernelHost.get(ShellActivity.this).emit(new JSONObject().put("method","android/storageError"));}catch(Exception ignored){}});}
 @JavascriptInterface public String tasks(){JSONArray result=new JSONArray();File[] list=new File(getFilesDir(),"alpine/root/eva-tasks").listFiles();if(list!=null){java.util.Arrays.sort(list,(a,b)->Long.compare(b.lastModified(),a.lastModified()));for(File f:list){try{JSONObject t=new JSONObject(new String(Files.readAllBytes(new File(f,"state.json").toPath()),"UTF-8"));JSONObject item=new JSONObject();item.put("id",f.getName());item.put("state",t.optString("state"));item.put("command",t.getJSONArray("argv").optString(2));result.put(item);}catch(Exception ignored){}}}return result.toString();}
 @JavascriptInterface public String taskDetail(String id){try{
 if(!id.matches("[a-zA-Z0-9-]{1,64}"))throw new IOException("无效任务编号");
 File folder=new File(getFilesDir(),"alpine/root/eva-tasks/"+id),file=new File(folder,"state.json");
 JSONObject t=new JSONObject(new String(Files.readAllBytes(file.toPath()),"UTF-8"));
 t.put("id",id);t.put("command",t.getJSONArray("argv").optString(2));t.put("updated",file.lastModified());t.put("errorMessage",t.optString("error"));t.remove("error");
 ByteArrayOutputStream out=new ByteArrayOutputStream(),err=new ByteArrayOutputStream();boolean truncated=t.optBoolean("outputTruncated");
 File events=new File(folder,"events.jsonl");if(events.isFile())try(BufferedReader reader=new BufferedReader(new InputStreamReader(new FileInputStream(events),"UTF-8"))){String line;while((line=reader.readLine())!=null){try{JSONObject e=new JSONObject(line);if(e.optString("type").equals("output")){ByteArrayOutputStream dest=e.optString("stream").equals("stderr")?err:out;byte[] bytes=android.util.Base64.decode(e.getString("base64"),android.util.Base64.DEFAULT);int remain=131072-dest.size();dest.write(bytes,0,Math.min(remain,bytes.length));if(bytes.length>remain)truncated=true;}}catch(JSONException ignored){}}}
 t.put("stdout",out.toString("UTF-8"));t.put("stderr",err.toString("UTF-8"));t.put("truncated",truncated);return t.toString();
 }catch(Exception e){try{return new JSONObject().put("error",e.getMessage()).toString();}catch(Exception ignored){return "{}";}}}
 @JavascriptInterface public String pluginIcon(String path){try{if(path==null||path.contains("..")||!(path.startsWith("/root/.eva-codex/plugins/")||path.startsWith("/root/.eva-codex/skills/")||path.startsWith("/root/eva-workspace/")))return "";File root=new File(getFilesDir(),"alpine").getCanonicalFile(),file=new File(root,path.substring(1)).getCanonicalFile();if(!file.toPath().startsWith(root.toPath())||!file.isFile()||file.length()>262144)return "";android.graphics.BitmapFactory.Options options=new android.graphics.BitmapFactory.Options();options.inJustDecodeBounds=true;android.graphics.BitmapFactory.decodeFile(file.getPath(),options);if(options.outWidth<=0||options.outHeight<=0||options.outWidth>4096||options.outHeight>4096)return "";String mime=options.outMimeType;if(!java.util.Arrays.asList("image/png","image/jpeg","image/webp","image/gif").contains(mime))return "";return "data:"+mime+";base64,"+android.util.Base64.encodeToString(java.nio.file.Files.readAllBytes(file.toPath()),android.util.Base64.NO_WRAP);}catch(Exception e){return "";}}
 @JavascriptInterface public void open(String kind){runOnUiThread(()->{if(java.util.Arrays.asList("terminal","files","office-runtime","android-build").contains(kind)&&!RuntimeBootstrap.present(new File(getFilesDir(),"alpine"))){startActivity(new Intent(ShellActivity.this,RuntimeSetupActivity.class).putExtra("onboarding",true));return;}if(kind.equals("phone-preview")){togglePhonePreview();return;}if(kind.equals("phone-setup")){startActivity(new Intent(ShellActivity.this,PhoneControlActivity.class).putExtra("setup",true));return;}if(kind.equals("scheduled-tasks")){startActivity(new Intent(ShellActivity.this,ScheduledTaskActivity.class));return;}if(kind.equals("network-capture")){startActivity(new Intent(ShellActivity.this,NetworkCaptureActivity.class));return;}if(kind.equals("android-build")){startActivity(new Intent(ShellActivity.this,AndroidBuildActivity.class));return;}if(kind.equals("office-runtime")){startActivity(new Intent(ShellActivity.this,OfficeActivity.class));return;}if(kind.equals("data-backup")){startActivity(new Intent(ShellActivity.this,DataBackupActivity.class));return;}if(kind.equals("voice")){startActivity(new Intent(ShellActivity.this,VoiceActivity.class));return;}if(kind.equals("phone-control")){startActivity(new Intent(ShellActivity.this,PhoneControlActivity.class));return;}if(kind.equals("account")){startActivity(new Intent(ShellActivity.this,AccountActivity.class));return;}if(kind.equals("models")){startActivity(new Intent(ShellActivity.this,ModelsActivity.class));return;}if(kind.equals("settings")){web.evaluateJavascript("settingsGo('settings')",null);return;}if(kind.equals("app-settings")){startActivity(new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS,Uri.parse("package:"+getPackageName())));return;}if(kind.equals("runtime-setup")||kind.equals("diagnostics")){startActivity(new Intent(ShellActivity.this,RuntimeSetupActivity.class));return;}if(kind.equals("tools")){new AlertDialog.Builder(ShellActivity.this).setTitle("此手机工具").setItems(new String[]{"本地终端","工作区","Eva 浏览器"},(d,n)->open(new String[]{"terminal","files","browser"}[n])).show();return;}if(kind.equals("browser")){showBrowser(new Intent());return;}if(kind.equals("terminal")||kind.equals("files")){Intent intent=new Intent(ShellActivity.this,kind.equals("terminal")?TerminalActivity.class:FilesActivity.class);startActivity(intent);}});}
 }
 // The chat shortcut only changes preview visibility; execution permissions stay in settings.
 void togglePhonePreview(){
  if(PhoneAgentPreview.isShowing()){PhoneAgentPreview.setEnabled(this,false);return;}
  if(!PhoneAgentDisplay.desired(this)){android.widget.Toast.makeText(this,"请先在手机控制设置中开启后台执行屏",1).show();return;}
  PhoneAgentPreview.setEnabled(this,true);
  if(!android.provider.Settings.canDrawOverlays(this)){
   try{startActivityForResult(new Intent(android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION,Uri.parse("package:"+getPackageName())),705);}
   catch(Exception error){android.widget.Toast.makeText(this,"请在系统应用设置中允许 Eva 显示悬浮窗",1).show();}
   return;
  }
  PhoneAgentDisplay.restore(this);
  PhoneAgentPreview.show(this);
  if(!PhoneAgentDisplay.connected(this,PhoneAgentDisplay.active))android.widget.Toast.makeText(this,PhoneAgentDisplay.status(this),1).show();
 }
 void showBrowser(Intent request){BrowserWindow.open(this,request,restoredBrowser);restoredBrowser=null;}
 protected void onSaveInstanceState(Bundle out){super.onSaveInstanceState(out);BrowserWindow b=BrowserWindow.live;if(b!=null&&b.host==this)out.putBundle("eva-browser",b.saveBrowserState());}
 protected void onResume(){super.onResume();new Bridge().refreshLocalModelCatalog();BrowserWindow b=BrowserWindow.live;if(b!=null&&b.host==this)b.resumeBrowser();PhoneTaskService.restore(this);KernelHost.get(this).eventSignal=eventSignal;KernelHost.get(this).warm();KernelHost.get(this).refreshAccount();if(web!=null)web.evaluateJavascript("window.importVoiceThreads&&importVoiceThreads();window.kernelPollingEnabled=true;window.modelRefresh&&modelRefresh()",null);}
 protected void onPause(){BrowserWindow b=BrowserWindow.live;if(b!=null&&b.host==this)b.pauseBrowser();if(web!=null)web.evaluateJavascript("window.flushKernelSave&&flushKernelSave(true);window.kernelPollingEnabled=false",null);new Handler().postDelayed(()->{if(!isDestroyed()&&BrowserWindow.live!=null&&web!=null)web.evaluateJavascript("window.kernelPollingEnabled=true",null);},500);super.onPause();}
 public void onBackPressed(){if(imeVisible){hideKeyboard();return;}web.evaluateJavascript("window.evaAndroidBack?evaAndroidBack():window.evaBack?evaBack():false",result->{if(!"true".equals(result))finish();});}
 protected void onDestroy(){trustedShell=false;BrowserWindow b=BrowserWindow.live;if(b!=null&&b.host==this)b.dismiss();KernelHost h=KernelHost.get(this);if(h.eventSignal==eventSignal)h.eventSignal=null;eventHandler.removeCallbacksAndMessages(null);web.removeJavascriptInterface("EvaHost");web.destroy();super.onDestroy();}
}
