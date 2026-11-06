package ai.eva.android.probe;

import org.json.*;
import java.util.*;

/** Exercises the identity adapter used by every outgoing kernel RPC. */
public final class KernelIdentityTest {
 static int checks;
 static void check(boolean value,String message){checks++;if(!value)throw new AssertionError(message);}
 public static void main(String[] args)throws Exception{
  for(String method:Arrays.asList("thread/start","thread/resume","thread/fork")){
   for(Object existing:Arrays.asList(JSONObject.NULL,"","project instructions\n记忆与工具说明")){
    JSONObject source=new JSONObject().put("developerInstructions",existing).put("modelProvider","fixture").put("threadId","original").put("sandbox","read-only");
    String before=source.toString();
    JSONObject prepared=KernelHost.withProductIdentity(method,source);
    String instructions=prepared.getString("developerInstructions");
    check(instructions.endsWith(KernelHost.PRODUCT_IDENTITY),method+" includes Eva identity");
    check(!instructions.startsWith("null"),"JSON null handled");
    if(existing instanceof String&&!existing.equals(""))check(instructions.startsWith((String)existing),"caller instructions preserved");
    check(source.toString().equals(before),"caller params preserved");
    check(prepared.getString("modelProvider").equals("fixture")&&prepared.getString("sandbox").equals("read-only"),"routing and permissions preserved");
    check(KernelHost.withProductIdentity(method,prepared).getString("developerInstructions").equals(instructions),"retry does not duplicate identity");
   }
   check(KernelHost.withProductIdentity(method,new JSONObject()).getString("developerInstructions").equals(KernelHost.PRODUCT_IDENTITY),"missing instructions handled");
  }
  for(String method:Arrays.asList("turn/start","turn/steer","thread/read","config/batchWrite")){
   JSONObject source=new JSONObject().put("threadId","original");
   check(KernelHost.withProductIdentity(method,source)==source,"other RPC schemas preserved");
  }
  JSONObject prepared=KernelHost.withProductIdentity("thread/resume",new JSONObject().put("threadId","old").put("model","fixture-model"));
  ProviderSwitch.forkProvider(prepared,"fixture",(method,params)->{
   check(method.equals("thread/fork"),"provider fallback forks");
   check(params.getString("developerInstructions").contains(KernelHost.PRODUCT_IDENTITY),"provider fallback retains identity");
   return new JSONObject().put("thread",new JSONObject().put("id","new")).put("modelProvider","fixture").put("model","fixture-model");
  });
  System.out.println("PASS Eva product identity "+checks+" checks");
 }
}
