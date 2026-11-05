package ai.eva.android.probe;
import java.io.*;import java.nio.file.*;import java.nio.charset.StandardCharsets;import org.json.*;
/** Host or isolated Android runner; all rollouts are generated in the supplied temporary directory. */
public final class ThreadRecoveryTest {
 static int checks;static final String ID="01a1a66f-7ded-7bf1-a913-a6c932e12b31",TURN="01a1a66f-7f0e-7f90-bdd7-c4ddf0b66902",NEXT="01a1a65e-a86d-75c1-96cd-0a104e267a25";
 static void require(boolean value,String name){checks++;if(!value)throw new AssertionError(name);}
 static String event(String type,String turn)throws Exception{return new JSONObject().put("type","event_msg").put("timestamp","2026-11-05T01:00:00Z").put("payload",new JSONObject().put("type",type).put("turn_id",turn)).toString()+"\n";}
 static void write(File f,String s)throws Exception{Files.write(f.toPath(),s.getBytes(StandardCharsets.UTF_8));}
 public static int run(File root)throws Exception{
  checks=0;File home=new File(root,"recovery-fixture"),sessions=new File(home,"sessions/2026/11/05");require(sessions.mkdirs(),"isolated folders");File f=new File(sessions,"rollout-"+ID+".jsonl");
  String start=event("task_started",TURN),done=event("task_complete",TURN);
  write(f,start);JSONObject p=ThreadRecovery.parse(f,ID);require(p.getString("state").equals("started")&&!p.getBoolean("terminal"),"started is not terminal");
  write(f,start+done);p=ThreadRecovery.parse(f,ID);require(p.getString("state").equals("completed")&&p.getBoolean("terminal")&&p.getString("turnId").equals(TURN),"completed persisted event");require(p.getLong("at")==1793840400000L,"UTC epoch millis");
  write(f,start+done+event("task_started",NEXT));p=ThreadRecovery.parse(f,ID);require(p.getString("state").equals("started")&&p.getString("turnId").equals(NEXT),"newest turn replaces prior completed state");
  write(f,start+event("turn_aborted",TURN));p=ThreadRecovery.parse(f,ID);require(p.getBoolean("terminal")&&p.getString("state").equals("interrupted"),"aborted state");
  write(f,start+"{\"type\":");require(ThreadRecovery.parse(f,ID).getString("state").equals("unknown"),"partial final line does not report previous complete state");
  write(f,start+"invalid json\n");require(ThreadRecovery.parse(f,ID).getString("state").equals("unknown"),"malformed line");
  write(f,new JSONObject().put("type","session_meta").put("payload",new JSONObject().put("id",NEXT)).toString()+"\n"+start);require(ThreadRecovery.parse(f,ID).getString("state").equals("unknown"),"identity mismatch");
  StringBuilder oversized=new StringBuilder();for(int i=0;i<=ThreadRecovery.MAX_LINE;i++)oversized.append('x');write(f,oversized.toString());require(ThreadRecovery.parse(f,ID).optString("reason").equals("line-limit"),"bounded line reader");
  write(f,start+done);require(ThreadRecovery.allowed(home.getCanonicalFile(),f,ID),"canonical local session");
  File outside=new File(root,"rollout-"+ID+".jsonl");write(outside,start);require(!ThreadRecovery.allowed(home.getCanonicalFile(),outside,ID),"outside directory rejected");
  require(!ThreadRecovery.allowed(home.getCanonicalFile(),f,NEXT),"filename identity rejected");
  JSONObject safe=ThreadRecovery.parse(f,ID);require(!safe.has("payload")&&!safe.has("text")&&!safe.has("reasoning"),"status only output");
  require(ID.matches(ThreadRecovery.UUID)&&!"../../auth.json".matches(ThreadRecovery.UUID),"UUID parameter validation");return checks;
 }
 public static void main(String[] args)throws Exception{File root=Files.createTempDirectory("eva-recovery-test-").toFile();try{System.out.println("PASS ThreadRecovery "+run(root)+" checks");}finally{try(java.util.stream.Stream<Path> paths=Files.walk(root.toPath())){paths.sorted(java.util.Comparator.reverseOrder()).forEach(path->{try{Files.delete(path);}catch(IOException e){throw new java.io.UncheckedIOException(e);}});}}}
}
