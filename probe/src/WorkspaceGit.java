package ai.eva.android.probe;

import android.content.Context;
import android.util.Base64;
import org.json.JSONObject;
import java.io.*;
import java.nio.file.*;
import java.util.concurrent.*;

/** Workspace Git API. Runs our audited helper, never a caller-supplied command. */
final class WorkspaceGit {
 static synchronized JSONObject execute(Context context,JSONObject request)throws Exception {
  String action=request.optString("action"),scope=request.optString("folder")+"|"+request.optString("remote","origin");
  String credentialId=android.util.Base64.encodeToString(java.security.MessageDigest.getInstance("SHA-256").digest(scope.getBytes("UTF-8")),android.util.Base64.NO_WRAP);
  android.content.SharedPreferences credentials=context.getSharedPreferences("eva-git-credentials",0);
  ModelStore vault=new ModelStore(context);
  if(action.equals("credential-save")||action.equals("credential-clear")){
   if(action.equals("credential-clear")){if(!credentials.edit().remove(credentialId).commit())throw new IOException("凭据清除失败");}
   else{
    java.net.URI url=new java.net.URI(request.getString("url"));
    if(!"https".equals(url.getScheme())||url.getHost()==null||url.getRawUserInfo()!=null||url.getRawQuery()!=null||url.getRawFragment()!=null)throw new IOException("凭据须绑定不含账号的 HTTPS 仓库地址");
    String user=request.optString("username","git"),password=request.getString("password");
    if(user.isEmpty()||password.isEmpty()||user.indexOf('\n')>=0||user.indexOf('\r')>=0||password.indexOf('\n')>=0||password.indexOf('\r')>=0||user.indexOf(0)>=0||password.indexOf(0)>=0)throw new IOException("凭据不能为空或包含换行");
    String secret=vault.encrypt(new JSONObject().put("url",url.toString()).put("username",user).put("password",password).toString());
    if(!credentials.edit().putString(credentialId,secret).commit())throw new IOException("凭据保存失败");
   }
   return execute(context,new JSONObject().put("action","status").put("folder",request.optString("folder")));
  }
  File files=context.getFilesDir().getCanonicalFile(),root=new File(files,"alpine");
  File helper=new File(root,"root/.eva-android/eva-git.py");helper.getParentFile().mkdirs();
  if(!helper.getCanonicalPath().startsWith(root.getCanonicalPath()+File.separator))throw new IOException("Git 运行路径无效");
  try(InputStream in=context.getAssets().open("eva-git.py")){Files.copy(in,helper.toPath(),StandardCopyOption.REPLACE_EXISTING);}
  String lib=context.getApplicationInfo().nativeLibraryDir;
  ProcessBuilder builder=new ProcessBuilder(lib+"/liboperit_proot.so","-0","-r",root.getAbsolutePath(),"-b","/dev","-b","/proc","-w","/root/eva-workspace","/usr/bin/python3","/root/.eva-android/eva-git.py",Base64.encodeToString(request.toString().getBytes("UTF-8"),Base64.NO_WRAP));
  builder.environment().put("PROOT_LOADER",lib+"/liboperit_loader.so");builder.environment().put("PROOT_TMP_DIR",new File(files,"tmp").getAbsolutePath());builder.environment().put("PATH","/usr/bin:/bin");
  if(java.util.Arrays.asList("clone","fetch","pull","push").contains(action)){
   String encrypted=credentials.getString(credentialId,"");
   if(!encrypted.isEmpty()){
    JSONObject secret=new JSONObject(vault.secret(new JSONObject().put("secret",encrypted)));
    builder.environment().put("EVA_GIT_AUTH_URL",secret.getString("url"));
    builder.environment().put("EVA_GIT_USERNAME",secret.getString("username"));
    builder.environment().put("EVA_GIT_PASSWORD",secret.getString("password"));
   }
  }
  File output=File.createTempFile("git-result-",".json",context.getCacheDir()),errors=File.createTempFile("git-error-",".txt",context.getCacheDir());
  try {
   builder.redirectOutput(output);builder.redirectError(errors);Process process=LinuxRuntime.start(context,builder);
   if(!process.waitFor(135,TimeUnit.SECONDS)){process.destroyForcibly();throw new IOException("Git 超时，请刷新检查状态，勿重复提交");}
   if(process.exitValue()!=0||output.length()>2097152)throw new IOException("Git 运行环境不可用或结果过大");
   JSONObject envelope=new JSONObject(new String(Files.readAllBytes(output.toPath()),"UTF-8"));
   if(!envelope.optBoolean("ok"))throw new IOException(envelope.optString("error","Git 操作失败"));
   return envelope.getJSONObject("result");
  }finally{output.delete();errors.delete();}
 }
}
