package ai.eva.android.probe;
import android.app.*;import android.os.*;import org.json.*;
/** Requests and cancels a fresh device code; never signs in or prints codes/tokens. */
public class AccountCheck extends Instrumentation{
 public void onCreate(Bundle b){super.onCreate(b);start();}
 public void onStart(){Bundle out=new Bundle();int code=0;KernelHost host=KernelHost.get(getTargetContext());String id=null;try{
  JSONObject state=host.nativeRequest("account/read",new JSONObject().put("refreshToken",false));if(!state.isNull("account")){out.putString("result","SKIP: account already signed in; existing login preserved");finish(0,out);return;}
  JSONObject login=host.nativeRequest("account/login/start",new JSONObject().put("type","chatgpt"));id=login.getString("loginId");android.net.Uri auth=android.net.Uri.parse(login.getString("authUrl"));if(!"https".equals(auth.getScheme())||!"auth.openai.com".equals(auth.getHost()))throw new Exception("Invalid browser login response");String callback=auth.getQueryParameter("redirect_uri");java.net.URI target=new java.net.URI(callback);if(!"localhost".equals(target.getHost())&&!"127.0.0.1".equals(target.getHost()))throw new Exception("Expected loopback callback");try(java.net.Socket socket=new java.net.Socket()){socket.connect(new java.net.InetSocketAddress("127.0.0.1",target.getPort()),3000); }
  host.nativeRequest("account/login/cancel",new JSONObject().put("loginId",id));id=null;out.putString("result","PASS: Codex browser OAuth URL issued, Android loopback callback listening, login cancelled; no account signed in");
 }catch(Exception e){code=1;out.putString("error",host.redact(e.getMessage()==null?e.getClass().getSimpleName():e.getMessage()));}finally{if(id!=null)try{host.nativeRequest("account/login/cancel",new JSONObject().put("loginId",id));}catch(Exception ignored){}}finish(code,out);}
}
