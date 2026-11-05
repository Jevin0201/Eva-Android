package ai.eva.android.probe;
import android.app.Instrumentation;
import android.os.Bundle;
import java.net.*;
import java.io.*;
import java.util.concurrent.*;
import org.json.*;
/** Isolated loopback fixture. Does not access account credentials or external services. */
public final class McpOAuthCheck extends Instrumentation {
 @Override public void onCreate(Bundle args){super.onCreate(args);start();}
 static void require(boolean value,String message)throws Exception{if(!value)throw new Exception(message);}
 static McpOAuth.Session session(int port,String name)throws Exception{
  String redirect="http://127.0.0.1:"+port+"/callback";
  return new McpOAuth.Session(null,name,new JSONObject().put("loginId","test-login").put("authorizationUrl","https://auth.fixture/authorize?redirect_uri="+URLEncoder.encode(redirect,"UTF-8")+"&state=fixture-state"));
 }
 @Override public void onStart(){Bundle report=new Bundle();McpOAuth.Session cancel=null;
  try(ServerSocket listener=new ServerSocket(0,2,InetAddress.getByName("127.0.0.1"))){
   listener.setSoTimeout(10000);ExecutorService executor=Executors.newSingleThreadExecutor();
   try{
    Future<String> received=executor.submit(()->{try(Socket socket=listener.accept()){BufferedReader input=new BufferedReader(new InputStreamReader(socket.getInputStream(),"US-ASCII"));String line=input.readLine();socket.getOutputStream().write("HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n".getBytes("US-ASCII"));return line;}});
    McpOAuth.Session active=session(listener.getLocalPort(),"fixture-login");String callback=active.callback+"?code=fixture-code&state=fixture-state";
    require(active.matches(callback),"valid callback rejected");require(!active.matches(callback.replace("fixture-state","wrong")),"state mismatch accepted");require(!active.matches(callback.replace("/callback","/other")),"wrong endpoint accepted");require(!active.matches(callback+"&state=wrong"),"duplicate state accepted");
    require(McpOAuth.forward(active,callback,false),"callback not forwarded");require(received.get(10,TimeUnit.SECONDS).contains("code=fixture-code"),"code not delivered");require(!McpOAuth.forward(active,callback,false),"duplicate callback forwarded");
    Future<String> cancelled=executor.submit(()->{try(Socket socket=listener.accept()){BufferedReader input=new BufferedReader(new InputStreamReader(socket.getInputStream(),"US-ASCII"));String line=input.readLine();socket.getOutputStream().write("HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\n\r\n".getBytes("US-ASCII"));return line;}});
    cancel=session(listener.getLocalPort(),"fixture-cancel");McpOAuth.sessions.put(cancel.id,cancel);require(McpOAuth.cancel(null,cancel.name).getBoolean("cancelled"),"cancel rejected");require(cancelled.get(10,TimeUnit.SECONDS).contains("error=access_denied"),"cancel not delivered");
    boolean denied=false;try{new McpOAuth.Session(null,"bad",new JSONObject().put("authorizationUrl","https://auth.fixture/?state=s&redirect_uri="+URLEncoder.encode("http://example.com/callback","UTF-8")));}catch(IOException expected){denied=true;}require(denied,"external callback accepted");
    report.putString("result","PASS scoped loopback callback, state/path binding, duplicate suppression and cancellation");finish(0,report);
   }finally{executor.shutdownNow();}
  }catch(Exception error){report.putString("result","FAIL "+error.getMessage());finish(1,report);}finally{if(cancel!=null)McpOAuth.sessions.remove(cancel.id,cancel);}
 }
}
