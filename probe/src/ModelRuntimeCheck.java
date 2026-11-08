package ai.eva.android.probe;

import android.app.Instrumentation;
import android.os.Bundle;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.json.*;

/** Real private kernel + loopback fixtures. No cloud requests or user App actions. */
public final class ModelRuntimeCheck extends Instrumentation {
    private int checks;
    private String restoreThread = "";
    private void check(boolean value, String message) { if (!value) throw new AssertionError(message); checks++; }
    public void onCreate(Bundle args) { super.onCreate(args); if(args!=null)restoreThread=args.getString("restoreThread", ""); start(); }
    private static final class Fixture implements AutoCloseable {
        final ServerSocket socket = new ServerSocket(0, 20, InetAddress.getByName("127.0.0.1"));
        final ExecutorService workers = Executors.newCachedThreadPool();
        final AtomicInteger chats = new AtomicInteger();
        final AtomicInteger abortedHeaders = new AtomicInteger();
        final AtomicInteger rateLimits = new AtomicInteger();
        final AtomicInteger initialResults = new AtomicInteger(-1);
        void beginRoundTrip() { initialResults.set(-1); }
        volatile String error = "", schema = "";
        Fixture() throws Exception {
            workers.execute(() -> { while (!socket.isClosed()) try { Socket client = socket.accept(); workers.execute(() -> serve(client)); } catch (IOException ignored) { } });
        }
        String url() { return "http://127.0.0.1:" + socket.getLocalPort() + "/v1"; }
        void serve(Socket client) {
            boolean headersComplete=false;
            try (Socket owned = client) {
                owned.setSoTimeout(20000);InputStream input = owned.getInputStream();ByteArrayOutputStream header = new ByteArrayOutputStream();int matched = 0;
                while (header.size() < 32768) { int b = input.read(); if (b < 0) { if (header.size() == 0) return; throw new EOFException("fixture truncated headers"); } header.write(b); matched = b == new int[]{13,10,13,10}[matched] ? matched + 1 : b == 13 ? 1 : 0; if (matched == 4) break; }
                if (matched != 4) throw new IOException("fixture headers");headersComplete=true;
                String[] lines = header.toString("US-ASCII").split("\\r\\n");int length = 0;
                for (String line : lines) if (line.toLowerCase(Locale.ROOT).startsWith("content-length:")) length = Integer.parseInt(line.substring(15).trim());
                if (length < 1 || length > 8 * 1024 * 1024) throw new IOException("fixture body");
                byte[] bytes = new byte[length];int at = 0;while (at < length) { int n = input.read(bytes, at, length-at);if (n < 0) throw new EOFException();at += n; }
                JSONObject body = new JSONObject(new String(bytes, StandardCharsets.UTF_8));OutputStream output = owned.getOutputStream();if(schema.isEmpty()&&body.optJSONArray("tools")!=null)schema=toolSummary(body.getJSONArray("tools")).toString();
                if(body.optString("model").equals("fixture-rate-limit")){
                    rateLimits.incrementAndGet();byte[] data="{\"error\":{\"message\":\"fixture HTTP 429\",\"type\":\"rate_limit_error\"}}".getBytes(StandardCharsets.UTF_8);
                    output.write(("HTTP/1.1 429 Too Many Requests\r\nContent-Type: application/json\r\nContent-Length: "+data.length+"\r\nConnection: close\r\n\r\n").getBytes(StandardCharsets.US_ASCII));output.write(data);output.flush();return;
                }
                if (lines[0].contains("/chat/completions")) {
                    chats.incrementAndGet();JSONArray messages = body.getJSONArray("messages");int results = 0;
                    for (int i=0;i<messages.length();i++) if (messages.getJSONObject(i).optString("role").equals("tool")) results++;
                    initialResults.compareAndSet(-1, results);
                    int newResults = results - initialResults.get();
                    if(newResults<0)throw new IOException("fixture tool history unexpectedly shrank");
                    JSONObject message = new JSONObject().put("role","assistant");String finish = "stop";
                    if (newResults < 3) {
                        String name = "";JSONArray tools = body.optJSONArray("tools");
                        if (tools != null) for(int i=0;i<tools.length();i++){String candidate=tools.getJSONObject(i).getJSONObject("function").optString("name");if(candidate.equals("eva_phone_route")||candidate.startsWith("eva_ns_eva_phone_route_"))name=candidate;}
                        if (name.isEmpty()) throw new IOException("fixture did not receive eva_phone_route");
                        JSONObject call = new JSONObject().put("id","upstream-reused-id").put("type","function").put("function",new JSONObject().put("name",name).put("arguments","{\"action\":\"list\",\"package\":\"com.miui.calculator\"}"));
                        message.put("content",JSONObject.NULL).put("tool_calls",new JSONArray().put(call));finish="tool_calls";
                    } else message.put("content","protocol_smoke_ok");
                    JSONObject chunk = new JSONObject().put("choices",new JSONArray().put(new JSONObject().put("message",message).put("finish_reason",finish)));
                    byte[] data=chunk.toString().getBytes(StandardCharsets.UTF_8);output.write(("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: "+data.length+"\r\nConnection: close\r\n\r\n").getBytes(StandardCharsets.US_ASCII));output.write(data);
                } else {
                    output.write("HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nConnection: close\r\n\r\n".getBytes(StandardCharsets.US_ASCII));
                    String id="resp_"+UUID.randomUUID().toString().replace("-","");JSONObject item = new JSONObject().put("id","msg_"+id).put("type","message").put("role","assistant").put("status","completed").put("content",new JSONArray().put(new JSONObject().put("type","output_text").put("text","protocol_smoke_ok").put("annotations",new JSONArray())));
                    JSONObject response = new JSONObject().put("id",id).put("object","response").put("created_at",System.currentTimeMillis()/1000).put("model",body.getString("model")).put("status","in_progress").put("output",new JSONArray());
                    event(output,0,"response.created",new JSONObject().put("response",response));
                    event(output,1,"response.output_item.added",new JSONObject().put("output_index",0).put("item",item));
                    event(output,2,"response.output_text.delta",new JSONObject().put("item_id",item.getString("id")).put("output_index",0).put("content_index",0).put("delta","protocol_smoke_ok"));
                    event(output,3,"response.output_item.done",new JSONObject().put("output_index",0).put("item",item));
                    response.put("status","completed").put("output",new JSONArray().put(item));
                    event(output,4,"response.completed",new JSONObject().put("response",response));
                }
                output.flush();
            } catch (Exception failure) { if(failure instanceof EOFException&&!headersComplete){abortedHeaders.incrementAndGet();return;}error = failure.getClass().getSimpleName() + ": " + (failure.getMessage() == null ? "no details" : failure.getMessage()); }
        }
        JSONArray toolSummary(JSONArray tools) throws Exception {
            JSONArray rows=new JSONArray();for(int i=0;i<tools.length();i++){JSONObject tool=tools.getJSONObject(i),row=new JSONObject().put("type",tool.opt("type")).put("name",tool.opt("name")).put("namespace",tool.opt("namespace"));JSONArray children=tool.optJSONArray("tools");if(children!=null)row.put("tools",toolSummary(children));rows.put(row);}return rows;
        }
        void event(OutputStream stream,int seq,String name,JSONObject body) throws Exception { body.put("type",name).put("sequence_number",seq);stream.write(("event: "+name+"\ndata: "+body+"\n\n").getBytes(StandardCharsets.UTF_8));stream.flush(); }
        public void close() throws Exception { socket.close();workers.shutdownNow(); }
    }
    JSONObject start(KernelHost host,String provider,Set<String> created) throws Exception {
        JSONObject result=host.dispatch("thread/start",new JSONObject().put("modelProvider",provider).put("model","fixture-model").put("ephemeral",false).put("approvalPolicy","never").put("approvalsReviewer","user").put("sandbox","read-only"));
        String id=result.getJSONObject("thread").getString("id");created.add(id);return result.getJSONObject("thread");
    }
    String run(KernelHost host,String thread) throws Exception {return run(host,thread,"fixture-model",false);}
    String run(KernelHost host,String thread,String model,boolean direct) throws Exception {
        StringBuilder reply = new StringBuilder();
        JSONObject request=new JSONObject().put("threadId",thread).put("model",model).put("approvalPolicy","never").put("approvalsReviewer","user").put("sandboxPolicy",new JSONObject().put("type","readOnly")).put("input",new JSONArray().put(new JSONObject().put("type","text").put("text","Run the read-only protocol fixture, then reply protocol_smoke_ok").put("text_elements",new JSONArray())));
        if(direct)host.rpc("turn/start",host.params("turn/start",request));else host.dispatch("turn/start",request);
        long end=System.currentTimeMillis()+80000;
        while(System.currentTimeMillis()<end){JSONArray rows=new JSONArray(KernelHost.get(getTargetContext()).drain());for(int i=0;i<rows.length();i++){JSONObject row=rows.getJSONObject(i),p=row.optJSONObject("params");if(p!=null&&thread.equals(p.optString("threadId"))){
                if(row.optString("method").equals("item/agentMessage/delta"))reply.append(p.optString("delta"));
                JSONObject item=p.optJSONObject("item");
                if(row.optString("method").equals("item/completed")&&item!=null&&item.optString("type").equals("agentMessage"))reply.append(item.optString("text"));
            }
            if(p!=null&&thread.equals(p.optString("threadId"))&&row.optString("method").equals("turn/completed")){JSONObject turn=p.getJSONObject("turn");if(!turn.optString("status").equals("completed"))throw new IOException("fixture turn failed: "+turn.optString("status")+" "+turn.optString("error"));return reply.toString();}}Thread.sleep(100);}
        throw new IOException("fixture turn timeout");
    }
    public void onStart() {
        Bundle result=new Bundle();ModelStore store=new ModelStore(getTargetContext());String original=store.prefs().getString("config",null);Set<String> created=new HashSet<>();Fixture fixture=null;KernelHost host=null;
        File originalThreadFile=null;String originalThreadHash=null;long originalThreadBytes=0;
        File configFile=new File(getTargetContext().getFilesDir(),"alpine/root/.eva-codex/config.toml");byte[] priorConfig=null;boolean hadConfig=configFile.isFile(),configCaptured=false;
        try {
            if(hadConfig)priorConfig=Files.readAllBytes(configFile.toPath());configCaptured=true;
            fixture=new Fixture();String a=store.save("","Fixture Responses",fixture.url(),"fixture-model","fixture-key","responses");
            host=KernelHost.api(getTargetContext());synchronized(host.startup){host.ensureStarted();}
            String first=start(host,a,created).getString("id");run(host,first);check(host.activeTurns.isEmpty(),"completed turn released runtime");check(ExecutionLease.countOwner(host.executionOwner)==0,"completed turn released execution lease");
            Process originalProcess=host.process;
            store.save(a,"Renamed Fixture",fixture.url(),"fixture-model","","responses");
            host.dispatch("thread/resume",new JSONObject().put("threadId",first).put("modelProvider",a).put("model","fixture-model").put("approvalPolicy","never").put("approvalsReviewer","user").put("sandbox","read-only"));
            check(host.process==originalProcess,"provider rename did not restart kernel");
            String b=store.save("","Fixture Chat",fixture.url(),"fixture-model","fixture-key","chat_completions");
            run(host,first);check(host.process==originalProcess,"adding unrelated provider did not block or restart existing thread");
            String second=start(host,b,created).getString("id");check(host.process!=originalProcess,"new connection reloaded idle kernel automatically");
            fixture.beginRoundTrip();run(host,second);check(fixture.chats.get()==4,"Chat gateway completed three dynamic tool round trips and final reply");
            check(fixture.error.isEmpty(),"fixture transport clean");
            if(!restoreThread.isEmpty()) {
                if(!restoreThread.matches(ProviderHistoryProjection.UUID))throw new IOException("restoreThread must be a UUID");
                File home=new File(getTargetContext().getFilesDir(),"alpine/root/.eva-codex").getCanonicalFile();
                Map<String,File> sources=new HashMap<>();int[] count={0};
                ProviderHistoryProjection.index(new File(home,"sessions"),sources,count,0);
                ProviderHistoryProjection.index(new File(home,"archived_sessions"),sources,count,0);
                originalThreadFile=sources.get(restoreThread.toLowerCase(Locale.ROOT));
                if(originalThreadFile==null)throw new IOException("restoreThread rollout not found");
                originalThreadBytes=originalThreadFile.length();
                originalThreadHash=ProviderHistoryProjection.hash(originalThreadFile,originalThreadBytes);
                JSONArray tools=PhoneTools.specs().put(BrowserTools.spec()).put(NetworkTools.spec()).put(RuntimeComponentTools.spec());
                JSONObject projection=ProviderHistoryProjection.project(getTargetContext(),restoreThread,b,true,tools);
                JSONObject prepared=new JSONObject().put("threadId",restoreThread).put("modelProvider",b).put("model","fixture-model").put("config",host.threadModelConfig(b))
                    .put("approvalPolicy","never").put("approvalsReviewer","user").put("sandbox","read-only");
                JSONObject restored;
                if(projection.optBoolean("needed")) {
                    String copy=projection.getJSONObject("audit").optString("projectedThreadId");
                    if(!copy.isEmpty())created.add(copy);
                    restored=host.projectedProviderFork(prepared,b,projection);
                } else restored=ProviderSwitch.forkProvider(prepared,b,host::rpc);
                JSONObject thread=restored.getJSONObject("thread");String id=thread.getString("id");
                if(id.equals(restoreThread))throw new IOException("restore fixture must fork the original");
                created.add(id);host.rememberThread(id,b,thread.optString("cwd","/root/eva-workspace"));
                int before=fixture.chats.get();fixture.beginRoundTrip();String reply=run(host,id);
                check(fixture.chats.get()-before==4,"restored real history completed three new tool calls and final response");
                check(reply.contains("protocol_smoke_ok"),"restored history final reply received");
                check(originalThreadFile.length()==originalThreadBytes&&ProviderHistoryProjection.hash(originalThreadFile,originalThreadBytes).equals(originalThreadHash),"original restore source hash and size unchanged");
                check(fixture.error.isEmpty(),"restored history fixture transport clean");result.putInt("restorePriorToolResults",fixture.initialResults.get());result.putLong("restoreSourceBytes",originalThreadBytes);result.putString("restoreSourceSha256",originalThreadHash);
            }
            JSONObject definitions=host.providerDefinitions();
            definitions.getJSONObject(b).put("request_max_retries",0).put("stream_max_retries",0);
            JSONObject limited=host.rpc("thread/start",new JSONObject().put("modelProvider",b).put("model","fixture-rate-limit")
                .put("config",new JSONObject().put("model_providers",definitions).put("web_search","disabled"))
                .put("cwd","/root/eva-workspace").put("ephemeral",false).put("approvalPolicy","never").put("approvalsReviewer","user").put("sandbox","read-only"));
            String limitedId=limited.getJSONObject("thread").getString("id");created.add(limitedId);host.rememberThread(limitedId,b,"/root/eva-workspace");
            boolean rateFailed=false;
            try{run(host,limitedId,"fixture-rate-limit",true);}catch(IOException error){rateFailed=error.getMessage()!=null&&error.getMessage().contains("429");}
            check(rateFailed,"fixture HTTP 429 reported without successful completion");
            check(fixture.rateLimits.get()==1,"explicit zero retries performs exactly one HTTP request");
            check(host.activeTurns.isEmpty(),"HTTP 429 releases active turn");check(ExecutionLease.countOwner(host.executionOwner)==0,"HTTP 429 releases execution lease");
            result.putInt("fixtureAbortedBeforeHeaders",fixture.abortedHeaders.get());result.putString("stream","PASS model runtime "+checks+" checks\n");
        } catch(Throwable error){result.putString("stream","FAIL model runtime "+error+"; checks="+checks+"; chats="+(fixture==null?0:fixture.chats.get())+"; fixture="+(fixture==null?"not started":fixture.error)+"\n");}
        finally {
            if(host!=null)for(String id:created){try{host.rpc("thread/archive",new JSONObject().put("threadId",id));host.rpc("thread/unsubscribe",new JSONObject().put("threadId",id));}catch(Exception ignored){}host.threadProviders.remove(id);host.threadCwds.remove(id);host.activeTurns.remove(id);getTargetContext().getSharedPreferences("eva-kernel-routing",0).edit().remove(id).commit();PhoneRouteTools.clear(id);PhoneBatch.end(id);}
            if(host!=null){host.clearExecutionTurns();synchronized(host){Process old=host.process;host.process=null;host.input=null;host.ready=false;if(old!=null)old.destroy();host.loadedConnections.clear();host.activeTurns.clear();}KernelHost.providerConfigCache.invalidate();}
            if(original==null)store.prefs().edit().remove("config").commit();else store.prefs().edit().putString("config",original).commit();
            try{if(configCaptured){if(hadConfig){try(FileOutputStream output=new FileOutputStream(configFile)){output.write(priorConfig);}}else configFile.delete();}}catch(Exception error){result.putString("stream",result.getString("stream")+"FAIL restore config\n");}
            try{Set<String> retained=new HashSet<>();JSONArray providers=store.read().getJSONArray("providers");for(int i=0;i<providers.length();i++)retained.add(providers.getJSONObject(i).getString("id"));ModelProtocolGateway.prune(retained);}catch(Exception ignored){}
            if(originalThreadFile!=null&&originalThreadHash!=null)try{
                if(originalThreadFile.length()!=originalThreadBytes||!ProviderHistoryProjection.hash(originalThreadFile,originalThreadBytes).equals(originalThreadHash))result.putString("stream",result.getString("stream","")+"FAIL original restore source modified\n");
            }catch(Exception error){result.putString("stream",result.getString("stream","")+"FAIL original restore source verification\n");}
            if(fixture!=null&&result.getString("stream","").contains("FAIL"))result.putString("stream",result.getString("stream")+"TOOLS "+fixture.schema+"\n");
            if(fixture!=null)try{fixture.close();}catch(Exception ignored){}
        }
        finish(result.getString("stream","").contains("FAIL")?0:-1,result);
    }
}
