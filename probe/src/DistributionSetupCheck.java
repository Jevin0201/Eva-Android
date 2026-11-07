package ai.eva.android.probe;

import android.app.Instrumentation;
import android.content.Context;
import android.content.ContextWrapper;
import android.content.SharedPreferences;
import android.os.Bundle;
import java.io.File;

/** Empty-root acceptance without clearing an existing app or importing user data. */
public final class DistributionSetupCheck extends Instrumentation {
 private boolean fresh;
 public void onCreate(Bundle args){super.onCreate(args);fresh=args!=null&&"true".equals(args.getString("freshRoot"));start();}
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
   RuntimeBootstrap.ensure(context);
   result.putString("result",RuntimeBootstrap.status(context).toString());
   result.putString("isolatedRoot",context.getFilesDir().getAbsolutePath());
   finish(0,result);
  }catch(Exception error){result.putString("error",error.toString());finish(1,result);}
 }
}
