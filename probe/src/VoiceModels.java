package ai.eva.android.probe;
import android.content.Context;import java.io.*;import java.nio.file.*;

/** Extract the bundled models atomically into app-private storage for native file loading. */
final class VoiceModels {
 static synchronized String path(Context c,String asset){
  try{
   File file=new File(c.getFilesDir(),"voice-models-v1/"+asset);file.getParentFile().mkdirs();
   if(asset.equals("kws/keywords.txt")||!file.isFile()||file.length()==0){File temp=new File(file.getPath()+".tmp");try(java.util.zip.ZipFile apk=new java.util.zip.ZipFile(c.getApplicationInfo().sourceDir)){
    java.util.zip.ZipEntry entry=apk.getEntry("assets/voice/"+asset);if(entry==null)throw new IOException("APK 中缺少模型文件，请重新安装语音测试版");
    try(InputStream in=apk.getInputStream(entry);OutputStream out=new FileOutputStream(temp)){byte[] b=new byte[65536];int n;while((n=in.read(b))!=-1)out.write(b,0,n);}
    if(temp.length()!=entry.getSize())throw new IOException("模型文件不完整");
   }Files.move(temp.toPath(),file.toPath(),StandardCopyOption.REPLACE_EXISTING);}
   return file.getAbsolutePath();
  }catch(IOException e){throw new IllegalStateException("无法准备本地语音文件 "+asset+": "+e.getMessage(),e);}
 }
}
