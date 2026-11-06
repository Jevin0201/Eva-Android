package ai.eva.android.probe;

import android.app.Instrumentation;
import android.os.Bundle;
import org.json.*;
import java.io.*;
import java.security.*;
import java.security.cert.*;
import javax.net.ssl.*;

/** Uses production entry points in the app domain, with an Eva-only HTTPS fixture. */
public final class NetworkCaptureCheck extends Instrumentation {
 Bundle arguments;
 public void onCreate(Bundle value){super.onCreate(value);arguments=value;start();}
 public void onStart(){
  Bundle output=new Bundle();int code=0;
  try{
   String action=arguments.getString("action","status");JSONObject result;
   if(action.equals("driver")){
    driver();result=new JSONObject().put("driverStopped",true);
   }else if(action.equals("flow")){
    java.security.cert.X509Certificate certificate=NetworkMitmCertificate.read(getTargetContext());
    JSONObject request=new JSONObject().put("targetPackage",getTargetContext().getPackageName()).put("goal","验证 Eva 自动 HTTPS 采集与响应读取").put("decryptHttps",true).put("durationSeconds",120);
    JSONObject started=NetworkTools.execute(getTargetContext(),new JSONObject(request.toString()).put("action","start"));
    if(!started.optBoolean("engineRunning"))throw new IOException("Capture did not enter running state: "+started);
    try{Thread.sleep(500);testTraffic(certificate);Thread.sleep(1000);}
    finally{NetworkTools.execute(getTargetContext(),new JSONObject().put("action","stop").put("includeBodies",true));}
    result=NetworkTools.execute(getTargetContext(),new JSONObject().put("action","results").put("includeBodies",true));
    if(!result.optBoolean("tlsDecrypted"))throw new IOException("No decrypted HTTPS response: "+result);
    result.put("passed",true);
   }else if(action.equals("phone")){
    PhoneTaskService.restore(getTargetContext());
    long deadline=System.currentTimeMillis()+12000;while(PhoneTaskService.keep(getTargetContext())&&PhoneAccessibility.live==null&&System.currentTimeMillis()<deadline)Thread.sleep(200);
    result=PhoneTools.executeObserved(getTargetContext(),new JSONObject(arguments.getString("json","{\"action\":\"observe\"}")),PhoneAccessibility.generation);
    if(result.has("imageUrl")){
     String value=result.getString("imageUrl");byte[] bytes=android.util.Base64.decode(value.substring(value.indexOf(',')+1),android.util.Base64.DEFAULT);
     java.nio.file.Files.write(new File(getTargetContext().getFilesDir(),"network-phone-view.jpg").toPath(),bytes);result.remove("imageUrl");result.put("imageFile","network-phone-view.jpg");
    }
   }else result=NetworkTools.execute(getTargetContext(),new JSONObject(arguments.getString("json","{}")).put("action",action));
   java.nio.file.Files.write(new File(getTargetContext().getFilesDir(),"network-capture-check.json").toPath(),result.toString(2).getBytes("UTF-8"));
   output.putString("result",result.toString());
  }catch(Exception error){code=1;output.putString("error",error.toString());}
  finish(code,output);
 }
 void driver()throws Exception{
  File folder=new File(getTargetContext().getFilesDir(),"network-agent-fixture");folder.mkdirs();
  File request=new File(folder,"request.json"),response=new File(folder,"response.json"),ready=new File(folder,"ready.json");
  request.delete();response.delete();java.nio.file.Files.write(ready.toPath(),"{\"ready\":true}".getBytes("UTF-8"));
  PhoneTaskService.restore(getTargetContext());String ownedCapture="";long deadline=System.currentTimeMillis()+1800000;
  try{
   while(System.currentTimeMillis()<deadline){
    if(!request.isFile()){Thread.sleep(150);continue;}
    JSONObject row=new JSONObject(new String(java.nio.file.Files.readAllBytes(request.toPath()),"UTF-8"));request.delete();
    JSONObject result=new JSONObject().put("id",row.getString("id"));String kind=row.getString("kind");
    try{
     if(kind.equals("finish")){result.put("finished",true);java.nio.file.Files.write(response.toPath(),result.toString().getBytes("UTF-8"));break;}
     JSONObject args=row.getJSONObject("arguments"),value;
     if(kind.equals("network")){
      value=NetworkTools.execute(getTargetContext(),args);
      if(args.optString("action").equals("start")&&value.optBoolean("engineRunning"))ownedCapture=value.optString("captureId");
     }else if(kind.equals("phone")){
      value=PhoneTools.executeObserved(getTargetContext(),args,PhoneAccessibility.generation);
      if(value.has("imageUrl")){
       String encoded=value.getString("imageUrl");byte[] bytes=android.util.Base64.decode(encoded.substring(encoded.indexOf(',')+1),android.util.Base64.DEFAULT);
       java.nio.file.Files.write(new File(folder,"view.jpg").toPath(),bytes);value.remove("imageUrl");value.put("imageFile","network-agent-fixture/view.jpg");
      }
     }else throw new IOException("Unknown fixture action");
     result.put("result",value);
    }catch(Exception error){result.put("error",error.toString());}
    File temp=new File(folder,"response.tmp");java.nio.file.Files.write(temp.toPath(),result.toString().getBytes("UTF-8"));java.nio.file.Files.move(temp.toPath(),response.toPath(),java.nio.file.StandardCopyOption.REPLACE_EXISTING);
   }
  }finally{
   ready.delete();JSONObject current=NetworkCaptureSession.read(getTargetContext());
   if(!ownedCapture.isEmpty()&&ownedCapture.equals(current.optString("captureId"))&&current.optBoolean("engineRunning"))NetworkTools.execute(getTargetContext(),new JSONObject().put("action","stop"));
  }
 }
 void testTraffic(X509Certificate certificate)throws Exception{
  TrustManagerFactory defaults=TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());defaults.init((KeyStore)null);
  KeyStore store=KeyStore.getInstance(KeyStore.getDefaultType());store.load(null);store.setCertificateEntry("capture-fixture",certificate);
  TrustManagerFactory fixture=TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());fixture.init(store);
  X509TrustManager system=(X509TrustManager)defaults.getTrustManagers()[0],capture=(X509TrustManager)fixture.getTrustManagers()[0];
  X509TrustManager combined=new X509TrustManager(){
   public X509Certificate[] getAcceptedIssuers(){return system.getAcceptedIssuers();}
   public void checkClientTrusted(X509Certificate[] chain,String auth)throws CertificateException{system.checkClientTrusted(chain,auth);}
   public void checkServerTrusted(X509Certificate[] chain,String auth)throws CertificateException{try{system.checkServerTrusted(chain,auth);}catch(CertificateException error){capture.checkServerTrusted(chain,auth);}}
  };
  SSLContext ssl=SSLContext.getInstance("TLS");ssl.init(null,new TrustManager[]{combined},null);
  HttpsURLConnection connection=(HttpsURLConnection)new java.net.URL("https://example.org/").openConnection();
  connection.setSSLSocketFactory(ssl.getSocketFactory());connection.setConnectTimeout(20000);connection.setReadTimeout(20000);
  try{if(connection.getResponseCode()!=200)throw new IOException("Fixture HTTPS request failed");try(InputStream in=connection.getInputStream()){byte[] buffer=new byte[4096];while(in.read(buffer)!=-1){}}}finally{connection.disconnect();}
 }
}
