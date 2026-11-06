package ai.eva.android.probe;

import android.app.Instrumentation;
import android.os.Bundle;
import java.io.*;
import java.util.List;
import java.util.concurrent.TimeUnit;
import org.json.*;

/** Runs the project-owned native analysis fixture in the actual app domain. */
public final class Java21RuntimeCheck extends Instrumentation {
 public void onCreate(Bundle args){super.onCreate(args);start();}
 public void onStart(){
  Bundle result=new Bundle();int code=0;Process process=null;
  try{
   OfficeRuntime.deploy(getTargetContext());
   ProcessBuilder builder=OfficeRuntime.process(getTargetContext());
   List<String> command=builder.command();
   command.set(command.size()-1,"/root/.eva-runtime/eva-native-analysis-check.py");
   process=LinuxRuntime.start(getTargetContext(),builder);
   final Process running=process;StringBuilder output=new StringBuilder();
   Thread reader=new Thread(()->{
    try(BufferedReader in=new BufferedReader(new InputStreamReader(running.getInputStream(),"UTF-8"))){
     String line;while((line=in.readLine())!=null){
      synchronized(output){if(output.length()<60000)output.append(line).append('\n');}
     }
    }catch(IOException ignored){}
   });
   reader.start();
   if(!process.waitFor(600,TimeUnit.SECONDS))throw new IOException("Native analysis fixture timed out");
   reader.join(5000);
   if(process.exitValue()!=0)throw new IOException(output.toString());
   KernelHost host=KernelHost.get(getTargetContext());
   synchronized(host.startup){host.ensureStarted();}
   JSONObject config=host.rpc("config/read",new JSONObject().put("includeLayers",false)).getJSONObject("config");
   JSONObject environment=config.getJSONObject("mcp_servers").getJSONObject("rea").getJSONObject("env");
   if(!environment.getString("JAVA_HOME").equals("/root/.eva-runtime/java21/current")||
      !environment.getString("GHIDRA_INSTALL_DIR").endsWith("/ghidra_12.1.4_PUBLIC")||
      !environment.getString("EVA_JAVA21_COMPAT").equals("1"))throw new IOException("REA runtime configuration not loaded");
   JSONObject status=host.rpc("mcpServerStatus/list",new JSONObject().put("serverName","rea").put("detail","toolsAndAuthOnly").put("limit",100));
   JSONArray servers=status.getJSONArray("data");int tools=0;
   for(int i=0;i<servers.length();i++){
    JSONObject server=servers.getJSONObject(i);
    if(server.optString("name").equals("rea")&&server.optJSONObject("tools")!=null)tools=server.getJSONObject("tools").length();
   }
   if(tools==0)throw new IOException("REA MCP tools not discovered");
   output.append(new JSONObject().put("evaKernelConfigLoaded",true).put("reaMcpTools",tools)).append('\n');
   result.putString("result",output.toString());
  }catch(Exception error){code=1;result.putString("error",error.toString());}
  finally{if(process!=null&&process.isAlive()){process.destroyForcibly();try{process.waitFor(5,TimeUnit.SECONDS);}catch(InterruptedException ignored){Thread.currentThread().interrupt();}}}
  finish(code,result);
 }
}
