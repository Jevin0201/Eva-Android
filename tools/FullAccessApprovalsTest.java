package ai.eva.android.probe;
import org.json.*;
public final class FullAccessApprovalsTest {
 static int checks;
 static void check(boolean value,String label){checks++;if(!value)throw new AssertionError(label);}
 static JSONObject params(String id,String sandbox,String approval)throws Exception{return new JSONObject().put("threadId",id).put("sandbox",sandbox).put("approvalPolicy",approval).put("approvalsReviewer","user");}
 static JSONObject event(String thread,String turn)throws Exception{return new JSONObject().put("threadId",thread).put("turn",new JSONObject().put("id",turn));}
 static JSONObject approval(String method,String thread,String turn)throws Exception{return new JSONObject().put("id",7).put("method",method).put("params",new JSONObject().put("threadId",thread).put("turnId",turn));}
 public static void main(String[] ignored)throws Exception{
  FullAccessApprovals host=new FullAccessApprovals();JSONObject full=params("a","danger-full-access","never");
  FullAccessApprovals.Request request=host.prepare("thread/start",full);
  check(full.getString("approvalPolicy").equals("never"),"original choice preserved");
  check(request.params.getString("approvalPolicy").equals("on-request"),"wire advance approvals");
  host.accepted(request,new JSONObject().put("thread",new JSONObject().put("id","a")));
  JSONObject command=approval("item/commandExecution/requestApproval","a","1");
  check(host.decision(command)==null,"no running turn");host.observe("turn/started",event("a","1"));
  check("accept".equals(host.decision(command).getString("decision")),"command approval");
  check(host.decision(approval("item/fileChange/requestApproval","a","1"))!=null,"file approval");
  check(host.decision(approval("item/permissions/requestApproval","a","1"))==null,"no unrelated methods");
  check(host.decision(approval("item/commandExecution/requestApproval","b","1"))==null,"exact thread");
  check(host.decision(approval("item/commandExecution/requestApproval","a","2"))==null,"exact turn");
  command.getJSONObject("params").put("availableDecisions",new JSONArray().put("decline"));check(host.decision(command)==null,"constrained decisions");
  command.getJSONObject("params").put("availableDecisions","accept");check(host.decision(command)==null,"invalid decisions");
  command.getJSONObject("params").put("availableDecisions",new JSONArray().put("accept"));check(host.decision(command)!=null,"explicit accept available");
  check(new FullAccessApprovals().decision(command)==null,"host isolation");
  host.observe("turn/completed",event("a","old"));check(host.decision(command)!=null,"old completion cannot clear current turn");
  host.observe("turn/completed",event("a","1"));check(host.decision(command)==null,"completion clears turn");
  FullAccessApprovals.Request rejected=host.prepare("thread/resume",params("a","workspace-write","on-request"));host.rejected(rejected);host.observe("turn/started",event("a","1"));check(host.decision(command)!=null,"rejected change restores full state");
  host.cancel("a","1");check(host.decision(command)==null,"interrupt revokes pending decisions");
  host.observe("turn/started",event("a","1"));check(host.decision(command)==null,"late started cannot restore cancelled grant");host.observe("thread/closed",event("a","1"));host.observe("turn/started",event("a","1"));check(host.decision(command)==null,"closed thread has no inherited grant");
  request=host.prepare("thread/resume",params("a","read-only","never"));check(request.params.getString("approvalPolicy").equals("never"),"read mode unchanged");host.accepted(request,new JSONObject());host.observe("turn/started",event("a","2"));check(host.decision(approval("item/fileChange/requestApproval","a","2"))==null,"read never authorizes write");
  request=host.prepare("thread/fork",full);host.accepted(request,new JSONObject().put("thread",new JSONObject().put("id","fork")));host.observe("turn/started",event("fork","3"));check(host.decision(approval("item/fileChange/requestApproval","fork","3"))!=null,"fork binds new identity");
  host.clear();host.observe("turn/started",event("fork","3"));check(host.decision(approval("item/fileChange/requestApproval","fork","3"))==null,"restart clears grant");
  System.out.println("PASS "+checks+" full-access lifecycle and read-only checks");
 }
}
