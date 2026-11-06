package ai.eva.android.probe;

import android.content.Context;
import java.io.*;
import java.net.*;
import java.nio.file.*;
import java.security.MessageDigest;

/** Pinned, independently installed engines. GPL notices and sources are recorded in docs. */
final class NetworkCaptureDependencies {
 static File download(Context context,boolean addon)throws Exception{
  String name=addon?"PCAPdroid-mitm_v2.6_arm64-v8a.apk":"PCAPdroid_v2.0.2.apk";
  String url=addon?"https://github.com/emanuele-f/PCAPdroid-mitm/releases/download/v2.6/"+name:"https://github.com/emanuele-f/PCAPdroid/releases/download/v2.0.2/"+name;
  String expected=addon?"6af79dad56faa84e1ae80278c801adb4e4cbd9cffee73b93c986e78a4ac6af22":"eb437cbe10e2c7e332c06d7401d8f9036c3722747f541e6e231d1bd9ab6dbffc";
  File file=WorkspaceFiles.resolve(context,"network-captures/dependencies/"+name);file.getParentFile().mkdirs();
  if(file.isFile()&&hash(file).equals(expected))return file;
  File temp=File.createTempFile("download-",".part",file.getParentFile());
  try{
   HttpURLConnection connection=(HttpURLConnection)new URL(url).openConnection();connection.setConnectTimeout(20000);connection.setReadTimeout(30000);
   try(InputStream in=connection.getInputStream();OutputStream out=new FileOutputStream(temp)){
    if(!"https".equals(connection.getURL().getProtocol()))throw new IOException("安装包下载地址必须为 HTTPS");
    byte[] buffer=new byte[32768];long total=0;int count;
    while((count=in.read(buffer))!=-1){total+=count;if(total>40L*1024*1024)throw new IOException("安装包超过固定大小上限");out.write(buffer,0,count);}
   }finally{connection.disconnect();}
   if(!hash(temp).equals(expected))throw new IOException("抓包组件 SHA-256 校验失败");
   android.content.pm.PackageInfo info=context.getPackageManager().getPackageArchiveInfo(temp.getAbsolutePath(),0);
   if(info==null||!info.packageName.equals(addon?NetworkCaptureSession.MITM:NetworkCaptureSession.ENGINE))throw new IOException("抓包组件包名校验失败");
   Files.move(temp.toPath(),file.toPath(),StandardCopyOption.REPLACE_EXISTING);return file;
  }finally{temp.delete();}
 }
 static String hash(File file)throws Exception{
  MessageDigest digest=MessageDigest.getInstance("SHA-256");
  try(InputStream input=new FileInputStream(file)){byte[] buffer=new byte[32768];int count;while((count=input.read(buffer))!=-1)digest.update(buffer,0,count);}
  StringBuilder hex=new StringBuilder();for(byte value:digest.digest())hex.append(String.format(java.util.Locale.ROOT,"%02x",value&255));return hex.toString();
 }
}
