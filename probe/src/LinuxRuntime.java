package ai.eva.android.probe;
import android.content.Context;import java.io.*;import java.nio.file.*;import java.util.*;
/** Shared compatibility setup for Eva's private Linux userland, without changing Android policy. */
final class LinuxRuntime {
 private static KernelNetwork localNetwork;
 static synchronized ProcessBuilder configure(Context context,ProcessBuilder builder)throws IOException {
  List<String> args=builder.command();if(args.isEmpty()||!args.get(0).endsWith("/liboperit_proot.so")||!args.contains("-r"))return builder;
  File files=context.getFilesDir().getCanonicalFile(),root=new File(files,"alpine");int rootAt=args.indexOf("-r");if(rootAt+1>=args.size())throw new IOException("运行环境根目录不匹配");File requested=new File(args.get(rootAt+1)).getCanonicalFile(),staging=new File(files,"bootstrap/staging-root").getCanonicalFile();if(!requested.equals(root.getCanonicalFile())&&!requested.equals(staging))throw new IOException("运行环境根目录不匹配");
  File bindings=new File(files,"runtime-bindings");if(Files.isSymbolicLink(bindings.toPath())||(!bindings.isDirectory()&&!bindings.mkdirs()))throw new IOException("无法准备运行环境映射");
  File version=new File(bindings,"proc-version");if(Files.isSymbolicLink(version.toPath()))throw new IOException("运行环境映射不能使用链接");String text="Linux version "+System.getProperty("os.version","unknown")+" (Eva Android user-space runtime)\n";
  if(!version.isFile()||!new String(Files.readAllBytes(version.toPath()),"UTF-8").equals(text)){File tmp=File.createTempFile("version-",".tmp",bindings);try{Files.write(tmp.toPath(),text.getBytes("UTF-8"));Files.move(tmp.toPath(),version.toPath(),StandardCopyOption.REPLACE_EXISTING);}finally{tmp.delete();}}
  if(!args.contains("--link2symlink"))args.add(1,"--link2symlink");if(!args.contains("--sysvipc"))args.add(1,"--sysvipc");String binding=version.getAbsolutePath()+":/proc/version";if(!args.contains(binding)){int at=args.indexOf("-w");if(at<0)at=1;args.addAll(at,Arrays.asList("-b",binding));}
  if(localNetwork==null)try{localNetwork=new KernelNetwork();}catch(Exception error){throw new IOException("无法准备 Android 本机网络通道",error);}
  Map<String,String> env=builder.environment();
  env.putIfAbsent("HTTPS_PROXY",localNetwork.proxyUrl);env.putIfAbsent("https_proxy",localNetwork.proxyUrl);
  env.putIfAbsent("NO_PROXY","localhost,127.0.0.1,::1");env.putIfAbsent("no_proxy","localhost,127.0.0.1,::1");env.put("HOME","/root");env.put("USER","root");env.put("LOGNAME","root");env.put("TMPDIR","/tmp");env.put("XDG_CACHE_HOME","/root/.cache");env.put("XDG_CONFIG_HOME","/root/.config");env.put("XDG_DATA_HOME","/root/.local/share");env.putIfAbsent("LANG","C.UTF-8");
  return builder;
 }
 static Process start(Context context,ProcessBuilder builder)throws IOException{return configure(context,builder).start();}
}
