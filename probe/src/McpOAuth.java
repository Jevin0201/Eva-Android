package ai.eva.android.probe;

import android.content.Intent;
import android.net.Uri;
import org.json.*;
import java.io.*;
import java.net.*;
import java.util.*;
import java.util.concurrent.*;

/** Native session ownership. OAuth exchange, refresh and credential storage belong to Codex. */
final class McpOAuth {
 static final Map<String,Session> sessions=new ConcurrentHashMap<>();
 static final class Session {
  final String id=UUID.randomUUID().toString(),name,loginId,url,state;
  final URI callback;
  final KernelHost host;
  volatile boolean forwarded,terminal,cancelled;
  Session(KernelHost host,String name,JSONObject result)throws Exception {
   this.host=host;this.name=name;loginId=result.optString("loginId");url=result.getString("authorizationUrl");
   URI authorization=new URI(url);
   if(!"https".equals(authorization.getScheme())||authorization.getHost()==null||authorization.getUserInfo()!=null)throw new IOException("授权地址必须为 HTTPS");
   Uri parsed=Uri.parse(url);state=parsed.getQueryParameter("state");String redirect=parsed.getQueryParameter("redirect_uri");
   if(state==null||state.isEmpty()||redirect==null)throw new IOException("授权请求缺少回调或状态校验");
   callback=new URI(redirect);
   String address=callback.getHost();
   if(!"http".equals(callback.getScheme())||!Arrays.asList("localhost","127.0.0.1","[::1]","::1").contains(address)||callback.getPort()<1||callback.getUserInfo()!=null||callback.getFragment()!=null||callback.getRawQuery()!=null)throw new IOException("内核授权回调不是有效本机地址");
  }
  boolean matches(String value){try{URI target=new URI(value);return Objects.equals(callback.getScheme(),target.getScheme())&&Objects.equals(callback.getHost(),target.getHost())&&callback.getPort()==target.getPort()&&Objects.equals(callback.getRawPath(),target.getRawPath())&&Uri.parse(value).getQueryParameters("state").size()==1&&Objects.equals(state,Uri.parse(value).getQueryParameter("state"));}catch(Exception ignored){return false;}}
 }
 static JSONObject login(KernelHost host,String name)throws Exception {
  for(Session previous:sessions.values())if(previous.host==host&&previous.name.equals(name)&&!previous.terminal)throw new IOException("此连接已有进行中的授权");
  JSONObject result=host.rpc("mcpServer/oauth/login",new JSONObject().put("name",name).put("timeoutSecs",180));
  Session session=new Session(host,name,result);sessions.put(session.id,session);
  host.context.startActivity(new Intent(host.context,McpOAuthActivity.class).putExtra("session",session.id).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
  new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(()->{session.terminal=true;sessions.remove(session.id,session);},185000);
  return new JSONObject().put("opened",true).put("loginId",session.loginId).put("name",name);
 }
 static void observe(KernelHost host,JSONObject event){
  if("android/kernelExited".equals(event.optString("method"))){
   for(Session session:sessions.values())if(session.host==host){session.terminal=true;sessions.remove(session.id,session);}
   return;
  }
  if(!"mcpServer/oauthLogin/completed".equals(event.optString("method")))return;
  JSONObject p=event.optJSONObject("params");if(p==null)return;
  for(Session session:sessions.values())if(session.host==host&&session.name.equals(p.optString("name"))&&(session.loginId.isEmpty()||p.optString("loginId").isEmpty()||session.loginId.equals(p.optString("loginId"))))session.terminal=true;
 }
 static boolean forward(Session session,String value,boolean cancel)throws Exception {
  synchronized(session){if(session.forwarded||session.terminal)return false;if(!session.matches(value))throw new IOException("授权回调校验失败");session.forwarded=true;session.cancelled=cancel;}
  URI target=new URI(value);InetAddress address=InetAddress.getByName(target.getHost());
  if(!address.isLoopbackAddress())throw new IOException("授权回调必须位于本机");
  try(Socket socket=new Socket()){
   socket.connect(new InetSocketAddress(address,target.getPort()),5000);socket.setSoTimeout(10000);
   String request=target.getRawPath()+"?"+target.getRawQuery();
   Writer output=new OutputStreamWriter(socket.getOutputStream(),"US-ASCII");output.write("GET "+request+" HTTP/1.1\r\nHost: "+target.getRawAuthority()+"\r\nConnection: close\r\n\r\n");output.flush();
   Reader input=new InputStreamReader(socket.getInputStream(),"US-ASCII");StringBuilder line=new StringBuilder();int next;
   while(line.length()<512&&(next=input.read())!=-1&&next!='\n')line.append((char)next);
   String status=line.toString().trim();
   boolean accepted=status.matches("HTTP/1[.][01] [23][0-9]{2}.*")||cancel&&status.matches("HTTP/1[.][01] 400.*");
   if(!accepted)throw new IOException("内核未接受授权回调");
   return true;
  }
 }
 static JSONObject cancel(KernelHost host,String name)throws Exception {
  for(Session session:sessions.values())if(session.host==host&&session.name.equals(name)&&!session.terminal){
   String url=Uri.parse(session.callback.toString()).buildUpon().appendQueryParameter("state",session.state).appendQueryParameter("error","access_denied").build().toString();
   boolean accepted=forward(session,url,true);return new JSONObject().put("cancelled",accepted).put("committing",!accepted);
  }
  return new JSONObject().put("cancelled",false);
 }
 static JSONObject logout(KernelHost host,String name)throws Exception {
  for(Session session:sessions.values())if(session.host==host&&session.name.equals(name)&&!session.terminal){
   if(session.forwarded)throw new IOException("授权结果正在处理中，请等待完成后退出授权");
   cancel(host,name);
  }
  JSONObject states=host.rpc("mcpServerStatus/list",new JSONObject().put("serverName",name).put("limit",100).put("detail","toolsAndAuthOnly"));
  boolean found=false;JSONArray data=states.optJSONArray("data");if(data!=null)for(int i=0;i<data.length();i++)if(name.equals(data.getJSONObject(i).optString("name")))found=true;
  if(!found)throw new IOException("未找到此 MCP 服务");
  File root=new File(host.context.getFilesDir(),"alpine");String lib=host.context.getApplicationInfo().nativeLibraryDir;
  ProcessBuilder builder=new ProcessBuilder(lib+"/liboperit_proot.so","-0","-r",root.getAbsolutePath(),"-b","/dev","-b","/proc","-w","/root/eva-workspace","/root/eva-kernel/bin/codex","-c","analytics.enabled=false","mcp","logout","--",name);
  Map<String,String> env=builder.environment();env.put("PROOT_LOADER",lib+"/liboperit_loader.so");env.put("PROOT_TMP_DIR",new File(host.context.getFilesDir(),"tmp").getAbsolutePath());env.put("CODEX_HOME","/root/.eva-codex");env.put("PATH","/root/eva-kernel/bin:/usr/bin:/bin");builder.redirectErrorStream(true);builder.redirectOutput(new File("/dev/null"));
  Process process=LinuxRuntime.start(host.context,builder);
  try{if(!process.waitFor(30,TimeUnit.SECONDS))throw new IOException("撤销本地授权超时");if(process.exitValue()!=0)throw new IOException("撤销本地授权失败");}finally{if(process.isAlive())process.destroy();}
  host.reloadMcpConnections();return new JSONObject().put("loggedOut",true).put("name",name);
 }
}
