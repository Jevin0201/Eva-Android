package ai.eva.android.probe;

import android.content.Context;
import android.util.Base64;
import org.json.JSONObject;
import java.io.*;
import java.nio.file.*;
import java.util.concurrent.*;

/** Narrow, local-only Git API. Runs our audited helper, never a caller-supplied command. */
final class WorkspaceGit {
 static synchronized JSONObject execute(Context context,JSONObject request)throws Exception {
  File files=context.getFilesDir().getCanonicalFile(),root=new File(files,"alpine");
  File helper=new File(root,"root/.eva-android/eva-git.py");helper.getParentFile().mkdirs();
  if(!helper.getCanonicalPath().startsWith(root.getCanonicalPath()+File.separator))throw new IOException("Git 运行路径无效");
  try(InputStream in=context.getAssets().open("eva-git.py")){Files.copy(in,helper.toPath(),StandardCopyOption.REPLACE_EXISTING);}
  String lib=context.getApplicationInfo().nativeLibraryDir;
  ProcessBuilder builder=new ProcessBuilder(lib+"/liboperit_proot.so","-0","-r",root.getAbsolutePath(),"-b","/dev","-b","/proc","-w","/root/eva-workspace","/usr/bin/python3","/root/.eva-android/eva-git.py",Base64.encodeToString(request.toString().getBytes("UTF-8"),Base64.NO_WRAP));
  builder.environment().put("PROOT_LOADER",lib+"/liboperit_loader.so");builder.environment().put("PROOT_TMP_DIR",new File(files,"tmp").getAbsolutePath());builder.environment().put("PATH","/usr/bin:/bin");
  File output=File.createTempFile("git-result-",".json",context.getCacheDir()),errors=File.createTempFile("git-error-",".txt",context.getCacheDir());
  try {
   builder.redirectOutput(output);builder.redirectError(errors);Process process=builder.start();
   if(!process.waitFor(35,TimeUnit.SECONDS)){process.destroyForcibly();throw new IOException("Git 超时，请刷新检查状态，勿重复提交");}
   if(process.exitValue()!=0||output.length()>2097152)throw new IOException("Git 运行环境不可用或结果过大");
   JSONObject envelope=new JSONObject(new String(Files.readAllBytes(output.toPath()),"UTF-8"));
   if(!envelope.optBoolean("ok"))throw new IOException(envelope.optString("error","Git 操作失败"));
   return envelope.getJSONObject("result");
  }finally{output.delete();errors.delete();}
 }
}
