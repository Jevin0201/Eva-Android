package ai.eva.android.probe;
public class SettingsCheck extends android.app.Instrumentation {
 public void onCreate(android.os.Bundle args){super.onCreate(args);start();}
 public void onStart(){android.os.Bundle result=new android.os.Bundle();try{
  String good=SettingsActivity.validateUrl(" https://example.com/path ");if(!good.equals("https://example.com/path"))throw new AssertionError("url trim");
  if(!SettingsActivity.validateUrl("http://example.com").equals("http://example.com")||!SettingsActivity.validateUrl("example.com/path").equals("https://example.com/path"))throw new AssertionError("browser addresses");
  for(String bad:new String[]{"javascript:alert(1)","https://user:pass@example.com","https://"}){boolean rejected=false;try{SettingsActivity.validateUrl(bad);}catch(IllegalArgumentException e){rejected=true;}if(!rejected)throw new AssertionError(bad);}
  android.content.Intent intent=new android.content.Intent(getTargetContext(),SettingsActivity.class);intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
  android.app.Activity activity=startActivitySync(intent);waitForIdleSync();if(!(activity instanceof SettingsActivity))throw new AssertionError("wrong activity");
  runOnMainSync(()->{SettingsActivity settings=(SettingsActivity)activity;if(settings.content.getChildCount()<15)throw new AssertionError("missing sections");});
  android.content.Intent homeIntent=new android.content.Intent(getTargetContext(),EvaActivity.class);homeIntent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
  EvaActivity home=(EvaActivity)startActivitySync(homeIntent);waitForIdleSync();
  runOnMainSync(()->home.toggleDrawer());waitForIdleSync();
  runOnMainSync(()->{if(home.drawerDialog==null||!home.drawerDialog.isShowing()||home.drawer.getWidth()<100)throw new AssertionError("drawer missing");});
  android.graphics.Bitmap shot=getUiAutomation().takeScreenshot();try(java.io.FileOutputStream f=new java.io.FileOutputStream(new java.io.File(getTargetContext().getFilesDir(),"drawer-check.png"))){shot.compress(android.graphics.Bitmap.CompressFormat.PNG,100,f);}shot.recycle();
  runOnMainSync(()->home.closeDrawer());waitForIdleSync();
  result.putString("result","PASS: settings activity, sections, HTTP/HTTPS validation, native drawer open/close");finish(-1,result);
 }catch(Throwable e){result.putString("error",e.toString());finish(0,result);}}
}
