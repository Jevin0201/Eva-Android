package ai.eva.android.probe;
import java.io.*;
import java.lang.reflect.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.json.*;

/** Runs the actual Android host's generation guards with an injected slow transport. */
public final class ScheduledTaskGenerationTest {
 static class Child extends Process {
  final InputStream output;
  Child(String output)throws Exception{this.output=new ByteArrayInputStream(output.getBytes("UTF-8"));}
  public OutputStream getOutputStream(){return new ByteArrayOutputStream();}
  public InputStream getInputStream(){return output;}
  public InputStream getErrorStream(){return new ByteArrayInputStream(new byte[0]);}
  public int waitFor(){return 0;}
  public int exitValue(){return 0;}
  public void destroy(){}
  public boolean isAlive(){return true;}
 }
 static void field(Object host,String name,Object value)throws Exception{Field f=ScheduledTaskHost.class.getDeclaredField(name);f.setAccessible(true);f.set(host,value);}
 static Object field(Object host,String name)throws Exception{Field f=ScheduledTaskHost.class.getDeclaredField(name);f.setAccessible(true);return f.get(host);}
 static void check(boolean value,String message){if(!value)throw new AssertionError(message);}
 public static void main(String[] args)throws Exception{
  CountDownLatch entered=new CountDownLatch(1),release=new CountDownLatch(1);AtomicInteger dispatches=new AtomicInteger();
  ScheduledTaskHost host=new ScheduledTaskHost(null,(context,method,params,binding)->{if(dispatches.incrementAndGet()==1){entered.countDown();if(!release.await(3,TimeUnit.SECONDS))throw new Exception("fixture timeout");}return new JSONObject().put("marker",params.getString("marker"));});
  Method kernel=ScheduledTaskHost.class.getDeclaredMethod("kernel",Process.class,JSONObject.class);kernel.setAccessible(true);
  Child oldChild=new Child("{\"type\":\"result\",\"id\":7,\"result\":{\"marker\":\"stale-reader\"}}\n"),newChild=new Child("");
  StringWriter oldOutput=new StringWriter(),newOutput=new StringWriter();
  synchronized(host){field(host,"process",oldChild);field(host,"input",new BufferedWriter(oldOutput));}
  JSONObject row=new JSONObject().put("id",1).put("method","turn/start").put("params",new JSONObject().put("marker","old"));
  Thread oldRequest=new Thread(()->{try{kernel.invoke(host,oldChild,row);}catch(Exception e){throw new RuntimeException(e);}});oldRequest.start();check(entered.await(3,TimeUnit.SECONDS),"slow old transport entered");
  synchronized(host){field(host,"process",newChild);field(host,"input",new BufferedWriter(newOutput));}
  release.countDown();oldRequest.join(3000);check(!oldRequest.isAlive(),"old dispatch returned");
  check(newOutput.toString().isEmpty(),"late old reply must not write to new child ID 1");
  kernel.invoke(host,oldChild,row);check(dispatches.get()==1,"queued stale generation must not dispatch another native side effect");
  @SuppressWarnings("unchecked") ConcurrentHashMap<Long,CompletableFuture<JSONObject>> replies=(ConcurrentHashMap<Long,CompletableFuture<JSONObject>>)field(host,"replies");
  CompletableFuture<JSONObject> currentPending=new CompletableFuture<>();replies.put(7L,currentPending);
  Method reader=ScheduledTaskHost.class.getDeclaredMethod("readOutput",Process.class);reader.setAccessible(true);reader.invoke(host,oldChild);
  check(!currentPending.isDone()&&replies.get(7L)==currentPending,"old reader result must not complete or fail new pending ID 7");
  JSONObject current=new JSONObject(row.toString());current.getJSONObject("params").put("marker","new");kernel.invoke(host,newChild,current);
  check(new JSONObject(newOutput.toString().trim()).getJSONObject("result").getString("marker").equals("new"),"current generation still receives its own ID 1 reply");
  ((ExecutorService)field(host,"requests")).shutdownNow();
  System.out.println("PASS actual host: late old native reply dropped, stale queued dispatch blocked, old reader cannot affect new pending, current replies preserved");
 }
}
