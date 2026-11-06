package ai.eva.android.probe;

import android.content.*;
import android.os.*;
import java.io.*;
import java.security.KeyStore;
import java.security.cert.*;
import java.util.*;
import java.util.concurrent.*;

/** Reads the addon's public CA through its documented Messenger API. */
final class NetworkMitmCertificate {
 static X509Certificate read(Context context)throws Exception{
  CompletableFuture<String> result=new CompletableFuture<>();Handler main=new Handler(Looper.getMainLooper());
  ServiceConnection connection=new ServiceConnection(){
   public void onServiceConnected(ComponentName name,IBinder binder){
    try{
     Message request=Message.obtain(null,2);
     request.replyTo=new Messenger(new Handler(Looper.getMainLooper(),message->{
      if(message.what==2)result.complete(message.getData().getString("certificate"));
      else result.completeExceptionally(new IOException("解密组件未能提供 CA 证书"));return true;
     }));
     new Messenger(binder).send(request);
    }catch(Exception error){result.completeExceptionally(error);}
   }
   public void onServiceDisconnected(ComponentName name){result.completeExceptionally(new IOException("解密组件连接中断"));}
  };
  main.post(()->{try{if(!context.bindService(new Intent().setClassName(NetworkCaptureSession.MITM,NetworkCaptureSession.MITM+".MitmService"),connection,Context.BIND_AUTO_CREATE))result.completeExceptionally(new IOException("无法连接解密组件"));}catch(Exception error){result.completeExceptionally(error);}});
  try{
   String pem=result.get(20,TimeUnit.SECONDS);if(pem==null)throw new IOException("解密组件未生成证书");
   return (X509Certificate)CertificateFactory.getInstance("X.509").generateCertificate(new ByteArrayInputStream(pem.getBytes(java.nio.charset.StandardCharsets.US_ASCII)));
  }finally{main.post(()->{try{context.unbindService(connection);}catch(IllegalArgumentException ignored){}});}
 }
 static boolean trusted(X509Certificate certificate)throws Exception{
  certificate.checkValidity();KeyStore store=KeyStore.getInstance("AndroidCAStore");store.load(null);
  Enumeration<String> names=store.aliases();byte[] expected=certificate.getEncoded();
  while(names.hasMoreElements()){java.security.cert.Certificate candidate=store.getCertificate(names.nextElement());if(candidate!=null&&Arrays.equals(expected,candidate.getEncoded()))return true;}
  return false;
 }
}
