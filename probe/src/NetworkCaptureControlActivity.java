package ai.eva.android.probe;

import android.app.*;
import android.content.*;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import android.security.KeyChain;
import android.widget.*;
import org.json.*;
import java.io.*;
import java.security.cert.X509Certificate;

/** Owns Android result callbacks so an authorization resumes the pending tool call. */
public final class NetworkCaptureControlActivity extends ToolPageActivity {
 static final int STATUS=301,START=302,VERIFY=303,STOP=304,CERTIFICATE=305,INSTALL=306,INSTALL_ACCESS=307,EXPORT_ACCESS=308,REPLACE=309,WARM=310,EXPORT_START=311,PHONE_ACCESS=312,BATTERY_ACCESS=313;
 NetworkCaptureSession.Operation operation;
 TextView progress;
 File installingFile;
 String installingPackage="";
 int verifyAttempts;
 int waitingAuthorization;
 boolean finished;
 boolean capturePrepared,cleanupRequested;
 Exception startError;
 final Handler authorizationMonitor=new Handler(Looper.getMainLooper());

 public void onCreate(Bundle state){
  super.onCreate(state);operation=NetworkCaptureSession.pending;
  if(operation==null||!operation.id.equals(getIntent().getStringExtra("operation"))){finish();return;}
  operation.cancel=()->fail(new IOException("抓包任务已取消"));
  page("抓包授权与准备","");
  String goal=operation.arguments.optString("goal");
  body.addView(label(goal.isEmpty()?"Eva 正在处理本次网络采集任务":goal,18));
  String target=operation.arguments.optString("targetPackage");
  if(!target.isEmpty())try{body.addView(label("目标应用 · "+getPackageManager().getApplicationLabel(getPackageManager().getApplicationInfo(target,0)),14));}catch(Exception ignored){}
  body.addView(label("Eva 会自动完成配置、采集和结果读取。系统要求确认时，请核对目标后授权；返回后任务会自动继续。",13));
  progress=label("正在检查环境…",14);body.addView(progress);
  body.addView(button("取消本次准备",()->{operation.cancelled=true;fail(new IOException("用户取消了抓包准备"));}));
  if(state!=null){installingPackage=state.getString("installingPackage","");String path=state.getString("installingFile");if(path!=null)installingFile=new File(path);verifyAttempts=state.getInt("verifyAttempts");capturePrepared=state.getBoolean("capturePrepared");cleanupRequested=state.getBoolean("cleanupRequested");return;}
  try{
   if(operation.action.equals("start")||operation.action.equals("setup"))ensureDependencies();
   else if(operation.action.equals("authorize_http_export")){
    show("请在系统页允许解密组件写入本次 HTTP 结果。返回后 Eva 会继续任务。");
    requestExportPermission(EXPORT_ACCESS);
   }else launch(NetworkCaptureSession.engine(operation.action.equals("stop")?"stop":"get_status"),operation.action.equals("stop")?STOP:STATUS);
  }catch(Exception error){fail(error);}
 }
 protected void onSaveInstanceState(Bundle state){
  state.putString("installingPackage",installingPackage);if(installingFile!=null)state.putString("installingFile",installingFile.getAbsolutePath());state.putInt("verifyAttempts",verifyAttempts);state.putBoolean("capturePrepared",capturePrepared);state.putBoolean("cleanupRequested",cleanupRequested);super.onSaveInstanceState(state);
 }
 void show(String message){progress.setText(message);try{NetworkCaptureSession.phase(this,"awaiting_authorization",message);}catch(Exception error){fail(error);}}
 void ensureDependencies(){
  if(operation.cancelled){fail(new IOException("任务已取消"));return;}
  boolean missingEngine=!NetworkCaptureSession.installed(this,NetworkCaptureSession.ENGINE);
  boolean missingAddon=operation.arguments.optBoolean("decryptHttps",true)&&!NetworkCaptureSession.installed(this,NetworkCaptureSession.MITM);
  if(!missingEngine&&!missingAddon){ensurePhoneControl();return;}
  installingPackage=missingEngine?NetworkCaptureSession.ENGINE:NetworkCaptureSession.MITM;
  show("正在下载并校验抓包组件，随后由系统确认安装…");
  NetworkCaptureSession.work.execute(()->{
   try{File file=NetworkCaptureDependencies.download(this,!missingEngine);runOnUiThread(()->{installingFile=file;installComponent();});}
   catch(Exception error){runOnUiThread(()->fail(error));}
  });
 }
 void ensurePhoneControl(){
  if(!operation.action.equals("start")||operation.arguments.optString("targetPackage").equals(getPackageName())||PhoneAccessibility.live!=null){launch(NetworkCaptureSession.engine("get_status"),STATUS);return;}
  PhoneTaskService.restore(this);
  NetworkCaptureSession.work.execute(()->{
   long deadline=System.currentTimeMillis()+12000;
   try{
    while(PhoneTaskService.keep(this)&&PhoneShell.authorized()&&PhoneAccessibility.live==null&&System.currentTimeMillis()<deadline)Thread.sleep(200);
    runOnUiThread(()->{
     if(PhoneAccessibility.live!=null){launch(NetworkCaptureSession.engine("get_status"),STATUS);return;}
     show("请授权 Eva 按本次目标操作手机。授权后将自动配置抓包并打开目标应用。");
     Intent settings=new Intent("android.settings.ACCESSIBILITY_DETAILS_SETTINGS").putExtra(Intent.EXTRA_COMPONENT_NAME,new ComponentName(this,PhoneAccessibility.class));
     if(settings.resolveActivity(getPackageManager())==null)settings=new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
     waitingAuthorization=PHONE_ACCESS;
     launch(settings,PHONE_ACCESS);
     authorizationMonitor.postDelayed(new Runnable(){public void run(){
      if(finished||waitingAuthorization!=PHONE_ACCESS)return;
      if(PhoneAccessibility.live!=null){waitingAuthorization=0;PhoneAccessibility.armed=true;returnToControl(()->launch(NetworkCaptureSession.engine("get_status"),STATUS));}
      else authorizationMonitor.postDelayed(this,500);
     }},500);
    });
   }catch(Exception error){runOnUiThread(()->fail(error));}
  });
 }
 void installComponent(){
  if(isFinishing()||operation.cancelled){fail(new IOException("任务已取消"));return;}
  try{
   if(!getPackageManager().canRequestPackageInstalls()){
    show("请允许 Eva 安装已校验的抓包组件。返回后会自动打开系统安装确认。");
    startActivityForResult(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:"+getPackageName())),INSTALL_ACCESS);return;
   }
   Uri uri=ApkInstallProvider.uri(this,installingFile);
   Intent intent=new Intent(Intent.ACTION_VIEW).setDataAndType(uri,ApkInstallProvider.MIME).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION).putExtra(Intent.EXTRA_RETURN_RESULT,true);
   startActivityForResult(intent,INSTALL);
  }catch(Exception error){fail(error);}
 }
 void launch(Intent intent,int code){
  if(isFinishing())return;
  try{startActivityForResult(intent,code);}catch(Exception error){fail(error);}
 }
 void prepareCertificate(){
  if(!operation.arguments.optBoolean("decryptHttps",true)){begin();return;}
  show("正在核对 HTTPS 解密证书…");
  NetworkCaptureSession.work.execute(()->{
   try{
    X509Certificate certificate=NetworkMitmCertificate.read(this);boolean trusted=NetworkMitmCertificate.trusted(certificate);
    runOnUiThread(()->{
     if(trusted){checkExportPermission();return;}
     try{
      show("系统需要确认抓包证书信任。请核对 PCAPdroid CA 后授权，Eva 会接着执行。");
      Intent intent=KeyChain.createInstallIntent().putExtra(KeyChain.EXTRA_CERTIFICATE,certificate.getEncoded()).putExtra(KeyChain.EXTRA_NAME,"PCAPdroid CA");
      startActivityForResult(intent,CERTIFICATE);
     }catch(Exception error){fail(error);}
    });
   }catch(Exception error){runOnUiThread(()->fail(error));}
  });
 }
 void requestExportPermission(int code){
  waitingAuthorization=code;
  launch(new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION,Uri.parse("package:"+NetworkCaptureSession.MITM)),code);
  authorizationMonitor.postDelayed(new Runnable(){public void run(){
   if(finished||waitingAuthorization!=code)return;
   if(NetworkCaptureSession.canExportHttp(NetworkCaptureControlActivity.this)){
    waitingAuthorization=0;
    returnToControl(()->{if(code==EXPORT_START)checkBackgroundPermission();else finishResult(null);});
   }else authorizationMonitor.postDelayed(this,500);
  }},500);
 }
 void checkExportPermission(){
  if(operation.arguments.optBoolean("decryptHttps",true)&&!NetworkCaptureSession.canExportHttp(this)){
   show("请允许解密组件保存本次 HTTP 结果。授权完成后 Eva 会自动返回并开始采集。");requestExportPermission(EXPORT_START);
  }else checkBackgroundPermission();
 }
 void checkBackgroundPermission(){
  if(operation.arguments.optBoolean("decryptHttps",true)&&!NetworkCaptureSession.proxyBackgroundAllowed(this)){
   show("请允许解密组件在后台运行，避免切换到美团后代理被系统暂停。确认后 Eva 自动继续。");
   waitingAuthorization=BATTERY_ACCESS;
   launch(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,Uri.parse("package:"+NetworkCaptureSession.MITM)),BATTERY_ACCESS);
   authorizationMonitor.postDelayed(new Runnable(){public void run(){
    if(finished||waitingAuthorization!=BATTERY_ACCESS)return;
    if(NetworkCaptureSession.proxyBackgroundAllowed(NetworkCaptureControlActivity.this)){waitingAuthorization=0;returnToControl(()->begin());}
    else authorizationMonitor.postDelayed(this,500);
   }},500);
  }else begin();
 }
 void returnToControl(Runnable next){
  if(finished)return;
  startActivity(new Intent(this,NetworkCaptureControlActivity.class).putExtra("operation",operation.id).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP));
  authorizationMonitor.postDelayed(()->{if(!finished)next.run();},200);
 }
 void begin(){
  if(operation.cancelled){fail(new IOException("任务已取消"));return;}
  if(operation.action.equals("setup")){finishResult(null);return;}
  try{
   NetworkCaptureSession.begin(this,operation);
   capturePrepared=true;
   show("配置已完成，正在请求启动采集。系统授权后将自动继续。");
   launch(NetworkCaptureSession.startIntent(this),START);
  }catch(Exception error){fail(error);}
 }
 protected void onActivityResult(int code,int result,Intent data){
  super.onActivityResult(code,result,data);if(finished)return;
  try{
   if(code==WARM)return;
   if(code==PHONE_ACCESS||code==EXPORT_ACCESS||code==EXPORT_START||code==BATTERY_ACCESS){
    if(waitingAuthorization!=code)return;
    waitingAuthorization=0;authorizationMonitor.removeCallbacksAndMessages(null);
   }
   if(code==BATTERY_ACCESS){
    if(!NetworkCaptureSession.proxyBackgroundAllowed(this))throw new IOException("解密组件后台运行授权未完成");
    begin();return;
   }
   if(code==PHONE_ACCESS){
    authorizationMonitor.removeCallbacksAndMessages(null);
    if(PhoneAccessibility.live==null)throw new IOException("手机操作授权未完成");
    PhoneAccessibility.armed=true;launch(NetworkCaptureSession.engine("get_status"),STATUS);return;
   }
   if(code==INSTALL_ACCESS){if(!getPackageManager().canRequestPackageInstalls())throw new IOException("安装来源授权未完成");installComponent();return;}
   if(code==INSTALL){if(!NetworkCaptureSession.installed(this,installingPackage))throw new IOException("抓包组件安装未完成");ensureDependencies();return;}
   if(code==EXPORT_ACCESS||code==EXPORT_START){
    authorizationMonitor.removeCallbacksAndMessages(null);
    if(!NetworkCaptureSession.canExportHttp(this))throw new IOException("HTTP 结果保存授权未完成");
    if(code==EXPORT_START)checkBackgroundPermission();else finishResult(null);return;
   }
   if(code==CERTIFICATE){
    NetworkCaptureSession.work.execute(()->{
     try{
      boolean trusted=NetworkMitmCertificate.trusted(NetworkMitmCertificate.read(this));
      runOnUiThread(()->{
       if(trusted)checkExportPermission();
       else try{finishResult(new JSONObject().put("certificateTrustRequired",true).put("instruction","继续用 eva_phone 完成系统证书页面的普通导航和 PCAPdroid CA 选择，仅最终信任确认或密码交给用户。完成后自动重试 start，用户无需按教程操作或发送继续。"));}catch(Exception error){fail(error);}
      });
     }catch(Exception error){runOnUiThread(()->fail(error));}
    });return;
   }
   if(result!=RESULT_OK)throw new IOException("系统或抓包引擎未批准本次操作");
   if(code==STATUS){
    boolean running=data!=null&&data.getBooleanExtra("running",false);NetworkCaptureSession.observed(this,data,running);
    if(!operation.action.equals("start")&&!operation.action.equals("setup")){finishResult(null);return;}
    if(running){
     JSONObject previous=NetworkCaptureSession.read(this);
     if(NetworkCaptureService.active&&previous.optString("targetPackage").equals(operation.arguments.optString("targetPackage"))&&previous.optBoolean("decryptHttpsRequested")==operation.arguments.optBoolean("decryptHttps",true)){finishResult(null);return;}
     new AlertDialog.Builder(this).setTitle("允许替换当前采集？").setMessage("已有采集正在运行。Eva 需要停止它，再按本次目标重新配置。").setPositiveButton("允许并继续",(dialog,which)->launch(NetworkCaptureSession.engine("stop"),REPLACE)).setNegativeButton("保留当前采集",(dialog,which)->fail(new IOException("用户保留了原采集"))).setOnCancelListener(dialog->fail(new IOException("用户取消替换采集"))).show();
    }else prepareCertificate();return;
   }
   if(code==REPLACE){NetworkCaptureSession.work.execute(()->{try{NetworkCaptureSession.stopped(this);Thread.sleep(150);runOnUiThread(this::prepareCertificate);}catch(Exception error){runOnUiThread(()->fail(error));}});return;}
   if(code==START){
    if(operation.cancelled){launch(NetworkCaptureSession.engine("stop"),STOP);return;}
    new Handler(getMainLooper()).postDelayed(()->launch(NetworkCaptureSession.engine("get_status"),VERIFY),200);return;
   }
   if(code==VERIFY){
    boolean running=data!=null&&data.getBooleanExtra("running",false);NetworkCaptureSession.observed(this,data,running);
    if(!running&&verifyAttempts++<12){new Handler(getMainLooper()).postDelayed(()->launch(NetworkCaptureSession.engine("get_status"),VERIFY),250);return;}
    if(!running)throw new IOException("引擎接受启动后未进入运行状态，请检查解密组件或系统授权");
    if(operation.cancelled){launch(NetworkCaptureSession.engine("stop"),STOP);return;}
    if(NetworkCaptureSession.read(this).optBoolean("decryptHttpsRequested")){
     show("正在唤醒解密组件并确认代理就绪，随后自动返回任务。");
     launch(new Intent().setClassName(NetworkCaptureSession.MITM,NetworkCaptureSession.MITM+".MainActivity"),WARM);
    }
    NetworkCaptureSession.work.execute(()->{
     try{
      if(NetworkCaptureSession.read(this).optBoolean("decryptHttpsRequested"))NetworkCaptureSession.awaitProxy(operation);
      NetworkCaptureSession.phase(this,"capturing","采集与解密代理已就绪，Eva 继续操作目标 App 并验证数据");
      runOnUiThread(()->returnToControl(()->finishResult(null)));
     }catch(Exception error){runOnUiThread(()->returnToControl(()->{startError=error;launch(NetworkCaptureSession.engine("stop"),STOP);}));}
    });return;
   }
   if(code==STOP){
    NetworkCaptureSession.observed(this,data,false);
    NetworkCaptureSession.work.execute(()->{
     try{NetworkCaptureSession.stopped(this);NetworkCaptureSession.awaitHttpExport(this);JSONObject value=NetworkCaptureSession.results(this,operation.arguments);runOnUiThread(()->{if(startError!=null)fail(startError);else finishResult(value);});}
     catch(Exception error){runOnUiThread(()->fail(error));}
    });
   }
  }catch(Exception error){fail(error);}
 }
 void finishResult(JSONObject result){
  if(finished)return;
   try{if(result==null)result=NetworkCaptureSession.status(this);result.remove("pendingAction");NetworkCaptureSession.complete(this,operation,result,null);finished=true;authorizationMonitor.removeCallbacksAndMessages(null);finish();}
  catch(Exception error){fail(error);}
 }
 void fail(Exception error){
  if(finished)return;
  if(capturePrepared&&!cleanupRequested){cleanupRequested=true;startError=error;launch(NetworkCaptureSession.engine("stop"),STOP);return;}
  finished=true;authorizationMonitor.removeCallbacksAndMessages(null);
  try{JSONObject current=NetworkCaptureSession.read(this);if(!current.optBoolean("engineRunning")){NetworkCaptureService.stop(this);NetworkCaptureSession.phase(this,"failed",error.getMessage());}}catch(Exception ignored){}
  NetworkCaptureSession.complete(this,operation,null,error);finish();
 }
}
