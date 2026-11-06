package ai.eva.android.probe;

import android.app.Instrumentation;
import android.os.Bundle;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.zip.GZIPOutputStream;

/** Native archive checks run in a private scratch directory, without replacing a runtime. */
public final class RuntimeBootstrapCheck extends Instrumentation {
 private int checks;
 private void check(boolean condition,String name){if(!condition)throw new AssertionError(name);checks++;}
 private static void field(byte[] header,int offset,int size,String value){byte[] bytes=value.getBytes(StandardCharsets.UTF_8);System.arraycopy(bytes,0,header,offset,Math.min(size,bytes.length));}
 private static void octal(byte[] header,int offset,int size,long value){field(header,offset,size,String.format(java.util.Locale.ROOT,"%0"+(size-1)+"o",value));}
 private static byte[] tar(String name,byte type,String link,String data)throws Exception {
  ByteArrayOutputStream out=new ByteArrayOutputStream();append(out,name,type,link,data);out.write(new byte[1024]);return out.toByteArray();
 }
 private static void append(ByteArrayOutputStream out,String name,byte type,String link,String value)throws Exception {
  byte[] data=value.getBytes(StandardCharsets.UTF_8),header=new byte[512];field(header,0,100,name);octal(header,100,8,0755);octal(header,124,12,data.length);header[156]=type;field(header,157,100,link);field(header,257,6,"ustar");
  java.util.Arrays.fill(header,148,156,(byte)' ');long sum=0;for(byte item:header)sum+=item&255;octal(header,148,7,sum);header[155]=' ';out.write(header);out.write(data);out.write(new byte[(512-data.length%512)%512]);
 }
 private static final RuntimeArchive.Monitor MONITOR=new RuntimeArchive.Monitor(){public void check(){}public void progress(long bytes){}};
 private static void extract(byte[] bytes,File root,String format,long size,RuntimeArchive.Monitor monitor)throws Exception{RuntimeArchive.extract(new ByteArrayInputStream(bytes),format,root,size,monitor);}
 public void onCreate(Bundle arguments){super.onCreate(arguments);start();}
 public void onStart(){Bundle result=new Bundle();File scratch=new File(getTargetContext().getCacheDir(),"runtime-archive-check-"+java.util.UUID.randomUUID());
  try {
   if(!scratch.mkdirs())throw new IOException("scratch directory");
   File root=new File(scratch,"good");root.mkdir();ByteArrayOutputStream data=new ByteArrayOutputStream();append(data,"bin/",(byte)'5',"","");append(data,"bin/busybox",(byte)'0',"","hello");append(data,"bin/sh",(byte)'2',"busybox","");append(data,"shell",(byte)'2',"/bin/busybox","");data.write(new byte[1024]);
   extract(data.toByteArray(),root,"tar",4096,MONITOR);
   check(new File(root,"bin/busybox").canExecute(),"executable mode preserved");
   check(Files.readSymbolicLink(new File(root,"bin/sh").toPath()).toString().equals("busybox"),"relative runtime symlink");
   check(Files.readSymbolicLink(new File(root,"shell").toPath()).toString().equals("/bin/busybox"),"absolute sandbox symlink");
   ByteArrayOutputStream gzip=new ByteArrayOutputStream();try(GZIPOutputStream out=new GZIPOutputStream(gzip)){out.write(tar("file",(byte)'0',"","gzip"));}File gz=new File(scratch,"gzip");gz.mkdir();extract(gzip.toByteArray(),gz,"tar.gz",4096,MONITOR);check(new File(gz,"file").length()==4,"gzip extraction");
   String[] badNames={"../outside","/absolute","folder/../../outside","bad\\windows"};
   for(String name:badNames){File dir=new File(scratch,"bad-"+checks);dir.mkdir();boolean rejected=false;try{extract(tar(name,(byte)'0',"","x"),dir,"tar",4096,MONITOR);}catch(IOException expected){rejected=true;}check(rejected,"path traversal rejected");}
   for(byte type:new byte[]{'3','4','6'}){File dir=new File(scratch,"device-"+type);dir.mkdir();boolean rejected=false;try{extract(tar("node",type,"",""),dir,"tar",4096,MONITOR);}catch(IOException expected){rejected=true;}check(rejected,"special device rejected");}
   File linkDir=new File(scratch,"escape-link");linkDir.mkdir();boolean rejected=false;try{extract(tar("escape",(byte)'2',"../../outside",""),linkDir,"tar",4096,MONITOR);}catch(IOException expected){rejected=true;}check(rejected,"relative link escape rejected");
   File writeDir=new File(scratch,"write-link");writeDir.mkdir();ByteArrayOutputStream linked=new ByteArrayOutputStream();append(linked,"link",(byte)'2',"/outside","");append(linked,"link/file",(byte)'0',"","x");linked.write(new byte[1024]);rejected=false;try{extract(linked.toByteArray(),writeDir,"tar",4096,MONITOR);}catch(IOException expected){rejected=true;}check(rejected,"archive cannot write through symlink");
   File bound=new File(scratch,"bound");bound.mkdir();rejected=false;try{extract(tar("file",(byte)'0',"","12345"),bound,"tar",4,MONITOR);}catch(IOException expected){rejected=true;}check(rejected,"expanded size bound");
   File corrupt=new File(scratch,"corrupt");corrupt.mkdir();byte[] bytes=tar("file",(byte)'0',"","ok");bytes[2]^=1;rejected=false;try{extract(bytes,corrupt,"tar",4096,MONITOR);}catch(IOException expected){rejected=true;}check(rejected,"header checksum");
   File cancelled=new File(scratch,"cancelled");cancelled.mkdir();rejected=false;try{extract(tar("file",(byte)'0',"","ok"),cancelled,"tar",4096,new RuntimeArchive.Monitor(){public void check()throws IOException{throw new InterruptedIOException("cancelled");}public void progress(long bytes){}});}catch(InterruptedIOException expected){rejected=true;}check(rejected&&!new File(cancelled,"file").exists(),"cancellation before writes");
   result.putString("stream","PASS runtime bootstrap archive "+checks+" checks\n");
  }catch(Throwable error){result.putString("stream","FAIL runtime bootstrap archive "+error+"\n");}
  finally{try{if(scratch.getCanonicalFile().getParentFile().equals(getTargetContext().getCacheDir().getCanonicalFile()))Files.walkFileTree(scratch.toPath(),new SimpleFileVisitor<Path>(){public FileVisitResult visitFile(Path file,java.nio.file.attribute.BasicFileAttributes attrs)throws IOException{Files.delete(file);return FileVisitResult.CONTINUE;}public FileVisitResult postVisitDirectory(Path dir,IOException error)throws IOException{Files.delete(dir);return FileVisitResult.CONTINUE;}});}catch(Exception error){result.putString("cleanupError",error.toString());}}
  finish(result.getString("stream","").startsWith("PASS")?-1:0,result);
 }
}
