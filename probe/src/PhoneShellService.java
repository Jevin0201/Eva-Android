package ai.eva.android.probe;
import android.os.*;import java.io.*;import java.util.concurrent.*;import org.json.*;
/** Instantiated by Shizuku as shell/root, never as an exported Android service. */
public class PhoneShellService extends Binder {
 static final String TOKEN="ai.eva.phone.shell.v1";volatile java.lang.Process active;volatile int processGroup;
 public PhoneShellService(){}
 private android.hardware.display.VirtualDisplay agentDisplay;
 private int agentDisplayId=-1;
 private synchronized int createAgentDisplay(android.view.Surface surface,int width,int height,int dpi)throws Exception{
  if(agentDisplay!=null)throw new IOException("后台屏已存在");
  Class<?> type=Class.forName("android.app.ActivityThread");Object thread=type.getMethod("currentActivityThread").invoke(null);
  if(thread==null)thread=type.getMethod("systemMain").invoke(null);
  android.content.Context base=(android.content.Context)type.getMethod("getSystemContext").invoke(thread);
  android.content.Context context=new android.content.ContextWrapper(base){
   public String getPackageName(){return "com.android.shell";}
   public String getOpPackageName(){return "com.android.shell";}
   public android.content.AttributionSource getAttributionSource(){return new android.content.AttributionSource.Builder(android.os.Process.myUid()).setPackageName("com.android.shell").build();}
  };
  android.hardware.display.DisplayManager manager=(android.hardware.display.DisplayManager)android.hardware.display.DisplayManager.class.getConstructor(android.content.Context.class).newInstance(context);
  // Public, own content, touch, destroy-on-removal, trusted, own focus, and no focus stealing.
  int flags=1|8|64|128|1024|16384|65536;
  agentDisplay=manager.createVirtualDisplay("eva-agent",width,height,dpi,surface,flags);
  if(agentDisplay==null)throw new IOException("系统拒绝后台屏");
  agentDisplayId=agentDisplay.getDisplay().getDisplayId();return agentDisplayId;
 }
 private synchronized void releaseAgentDisplay(){if(agentDisplay!=null)agentDisplay.release();agentDisplay=null;agentDisplayId=-1;}
 static String restoreCommand(android.content.ComponentName service){
  String packageName=service.getPackageName(),className=service.getClassName();
  if(!packageName.matches("[A-Za-z0-9_]+(?:\\.[A-Za-z0-9_]+)+")||!className.equals(PhoneAccessibility.class.getName()))throw new IllegalArgumentException("无效的无障碍组件");
  return "component="+service.flattenToString()+"; short="+service.flattenToShortString()+"; current=$(settings get secure enabled_accessibility_services); kept=; oldIFS=$IFS; IFS=:; for entry in $current; do case \"$entry\" in \"$component\"|\"$short\"|null|'') ;; *) kept=\"${kept:+$kept:}$entry\";; esac; done; IFS=$oldIFS; if [ \"$kept\" != \"$current\" ] && [ \"$current\" != null ]; then settings put secure enabled_accessibility_services \"$kept\" || exit 1; sleep 0.3; fi; current=$(settings get secure enabled_accessibility_services); case \":$current:\" in *:\"$component\":*|*:\"$short\":*) ;; *) if [ \"$current\" = null ] || [ -z \"$current\" ]; then current=$component; else current=\"$current:$component\"; fi; settings put secure enabled_accessibility_services \"$current\" || exit 1;; esac; settings put secure accessibility_enabled 1";}
 private String restoreForCaller(String value) throws Exception {
  android.content.ComponentName service=android.content.ComponentName.unflattenFromString(value);
  if(service==null)throw new IOException("无效的无障碍组件");
  Class<?> type=Class.forName("android.app.ActivityThread");
  Object thread=type.getMethod("currentActivityThread").invoke(null);
  if(thread==null)thread=type.getMethod("systemMain").invoke(null);
  android.content.Context context=(android.content.Context)type.getMethod("getSystemContext").invoke(thread);
  android.content.pm.ServiceInfo info=context.getPackageManager().getServiceInfo(service,0);
  if(info.applicationInfo.uid!=Binder.getCallingUid()||!"android.permission.BIND_ACCESSIBILITY_SERVICE".equals(info.permission))
   throw new SecurityException("无障碍组件不属于调用应用");
  return restoreCommand(service);
 }
 void cancel(){java.lang.Process p=active;if(p!=null){int group=processGroup;if(group>0)try{new ProcessBuilder("/system/bin/kill","-KILL","--","-"+group).start().waitFor(2,TimeUnit.SECONDS);}catch(Exception ignored){}p.destroy();p.destroyForcibly();}}
 protected boolean onTransact(int code,Parcel data,Parcel reply,int flags)throws RemoteException{if(code==16777115){cancel();System.exit(0);return true;}if(code==INTERFACE_TRANSACTION){reply.writeString(TOKEN);return true;}data.enforceInterface(TOKEN);if(code==2){cancel();reply.writeNoException();return true;}if(code==4){try{android.view.Surface surface=android.view.Surface.CREATOR.createFromParcel(data);try{int id=createAgentDisplay(surface,data.readInt(),data.readInt(),data.readInt());reply.writeNoException();reply.writeInt(id);}finally{surface.release();}}catch(Exception e){reply.writeException(new IllegalStateException("后台屏创建失败",e));}return true;}if(code==5){releaseAgentDisplay();reply.writeNoException();return true;}if(code!=1&&code!=3)return super.onTransact(code,data,reply,flags);String command=null;JSONObject result=new JSONObject();boolean owned=false;try{command=code==3?restoreForCaller(data.readString()):data.readString();if(command==null||command.length()>16000)throw new IOException("命令过长");synchronized(this){if(active!=null)throw new IOException("已有命令正在执行");owned=true;active=new ProcessBuilder("/system/bin/setsid","/system/bin/sh","-c","echo $$; exec /system/bin/sh -c \"$1\"","eva-shell",command).redirectErrorStream(true).start();}java.lang.Process p=active;ByteArrayOutputStream output=new ByteArrayOutputStream();Thread reader=new Thread(()->{try(InputStream stream=p.getInputStream()){ByteArrayOutputStream pid=new ByteArrayOutputStream();int first;while((first=stream.read())!=-1&&first!=10&&pid.size()<20)pid.write(first);processGroup=Integer.parseInt(pid.toString("UTF-8").trim());byte[] buffer=new byte[4096];int n;while((n=stream.read(buffer))!=-1){synchronized(output){int remaining=65536-output.size();if(remaining>0)output.write(buffer,0,Math.min(n,remaining));}}}catch(Exception ignored){}});reader.start();boolean done=p.waitFor(20,TimeUnit.SECONDS);if(!done)cancel();reader.join(1000);synchronized(output){result.put("output",output.toString("UTF-8")).put("truncated",output.size()>=65536);}result.put("uid",android.os.Process.myUid()).put("timedOut",!done);if(done)result.put("exitCode",p.exitValue());}catch(Exception e){try{result.put("error",e.getMessage());}catch(Exception ignored){}}finally{if(owned){cancel();active=null;processGroup=0;}}reply.writeNoException();reply.writeString(result.toString());return true;}
}
