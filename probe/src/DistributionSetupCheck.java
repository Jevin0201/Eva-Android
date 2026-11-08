package ai.eva.android.probe;

import android.app.Instrumentation;
import android.content.Context;
import android.content.ContextWrapper;
import android.content.SharedPreferences;
import android.os.Bundle;
import java.io.File;

/** Empty-root acceptance without clearing an existing app or importing user data. */
public final class DistributionSetupCheck extends Instrumentation {
 private boolean fresh,accept;private String profile="",requestComponent="";
 public void onCreate(Bundle args){super.onCreate(args);fresh=args!=null&&"true".equals(args.getString("freshRoot"));accept=args!=null&&"true".equals(args.getString("acceptSetup"));if(args!=null){profile=args.getString("profile","");requestComponent=args.getString("requestComponent","");}start();}
 public void onStart(){
  Bundle result=new Bundle();
  try{
   Context context=getTargetContext();
   if(fresh){
    final Context original=context;
    final File directory=new File(original.getFilesDir(),"distribution-firstinstall-check");
    if(!directory.isDirectory()&&!directory.mkdirs())throw new java.io.IOException("Unable to create isolated test root");
    context=new ContextWrapper(original){
     public File getFilesDir(){return directory;}
     public Context getApplicationContext(){return this;}
     public File getCacheDir(){File cache=new File(directory,"cache");cache.mkdirs();return cache;}
     public SharedPreferences getSharedPreferences(String name,int mode){return original.getSharedPreferences("firstinstall-check-"+name,mode);}
    };
   }
   if(accept)context.getSharedPreferences("eva-runtime-bootstrap",0).edit().putBoolean("accepted",true).commit();
   RuntimeBootstrap.ensure(context);
   if(!profile.isEmpty()){if(!accept||!RuntimeComponents.valid(profile))throw new java.io.IOException("Explicit consent and a known profile required");RuntimeComponents.stopping=false;RuntimeComponents.install(context,new String[]{profile});result.putString("components",RuntimeComponents.status(context).toString());}
   if(!requestComponent.isEmpty()){if(!RuntimeComponents.valid(requestComponent))throw new java.io.IOException("Unknown requested component");try(android.os.ParcelFileDescriptor descriptor=getUiAutomation().executeShellCommand("am start -W -n "+context.getPackageName()+"/ai.eva.android.probe.ShellActivity");java.io.InputStream in=new android.os.ParcelFileDescriptor.AutoCloseInputStream(descriptor)){byte[] buffer=new byte[4096];while(in.read(buffer)!=-1){}}result.putString("requestResult",RuntimeComponents.ensureForTask(context,requestComponent,new org.json.JSONObject().put("threadId","modular-setup-fixture").put("turnId","consent-check")).toString());}
   result.putString("result",RuntimeBootstrap.status(context).toString());
   result.putString("isolatedRoot",context.getFilesDir().getAbsolutePath());
   finish(0,result);
  }catch(Exception error){result.putString("error",error.toString());finish(1,result);}
 }
}
