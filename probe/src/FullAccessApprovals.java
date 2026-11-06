package ai.eva.android.probe;

import org.json.*;
import java.util.*;

/** Java adaptation of Eva src/main/full-access-approvals.js (desktop 0.2.7).
 * Advance approval applies only to the exact full-access running turn. */
final class FullAccessApprovals {
 static final class State {
  final String sandbox,reviewer,approval; final boolean full;
  State(String sandbox,String reviewer,String approval){this.sandbox=sandbox;this.reviewer=reviewer;this.approval=approval;full=(sandbox.equals("danger-full-access")||sandbox.equals("dangerFullAccess"))&&reviewer.equals("user")&&(approval.equals("never")||approval.equals("on-request"));}
 }
 static final class Request {
  final JSONObject params; final State state,previous; final String threadId;
  Request(JSONObject params,State state,State previous,String threadId){this.params=params;this.state=state;this.previous=previous;this.threadId=threadId;}
 }
 static final class Turn {final String id;final boolean full;Turn(String id,boolean full){this.id=id;this.full=full;}}
 private final Map<String,State> threads=new HashMap<>();
 private final Map<String,Turn> turns=new HashMap<>();
 synchronized Request prepare(String method,JSONObject params)throws JSONException{
  if(!Arrays.asList("thread/start","thread/resume","thread/fork","turn/start").contains(method))return new Request(params,null,null,null);
  String id=params.optString("threadId","");State previous=threads.get(id);
  JSONObject policy=params.optJSONObject("sandboxPolicy");
  String sandbox=params.optString("sandbox",policy==null?(previous==null?"":previous.sandbox):policy.optString("type"));
  State state=new State(sandbox,params.optString("approvalsReviewer",previous==null?"":previous.reviewer),params.optString("approvalPolicy",previous==null?"":previous.approval));
  String threadId=method.equals("thread/fork")?null:id;
  if(threadId!=null&&!threadId.isEmpty())threads.put(threadId,state);
  JSONObject wire=state.full?new JSONObject(params.toString()).put("approvalPolicy","on-request").put("approvalsReviewer","user"):params;
  return new Request(wire,state,previous,threadId);
 }
 synchronized void accepted(Request request,JSONObject result){
  if(request==null||request.state==null)return;
  JSONObject thread=result==null?null:result.optJSONObject("thread");String id=thread==null?request.threadId:thread.optString("id",request.threadId);
  if(id!=null&&!id.isEmpty())threads.put(id,request.state);
 }
 synchronized void rejected(Request request){
  if(request==null||request.threadId==null||threads.get(request.threadId)!=request.state)return;
  if(request.previous==null)threads.remove(request.threadId);else threads.put(request.threadId,request.previous);
 }
 synchronized void observe(String method,JSONObject params){
  if(params==null)return;String id=params.optString("threadId");JSONObject turn=params.optJSONObject("turn");String turnId=turn==null?"":turn.optString("id");Turn current=turns.get(id);
  if(method.equals("turn/started")&&!turnId.isEmpty()&&(current==null||!current.id.equals(turnId)))turns.put(id,new Turn(turnId,threads.containsKey(id)&&threads.get(id).full));
  if(method.equals("turn/completed")&&current!=null&&current.id.equals(turnId))turns.remove(id);
  if(method.equals("thread/closed")){turns.remove(id);threads.remove(id);}
 }
 synchronized JSONObject decision(JSONObject message)throws JSONException{
  String method=message.optString("method");if(!method.equals("item/commandExecution/requestApproval")&&!method.equals("item/fileChange/requestApproval"))return null;
  JSONObject params=message.optJSONObject("params");if(params==null)return null;
  Turn turn=turns.get(params.optString("threadId"));if(turn==null||!turn.full||!turn.id.equals(params.optString("turnId")))return null;
  if(params.has("availableDecisions")&&!params.isNull("availableDecisions")){
   JSONArray choices=params.optJSONArray("availableDecisions");boolean accepts=false;if(choices!=null)for(int n=0;n<choices.length();n++)if("accept".equals(choices.opt(n)))accepts=true;
   if(!accepts)return null;
  }
  return new JSONObject().put("decision","accept");
 }
 synchronized void cancel(String threadId,String turnId){Turn turn=turns.get(threadId);if(turn!=null&&turn.id.equals(turnId))turns.put(threadId,new Turn(turn.id,false));}
 synchronized void clear(){threads.clear();turns.clear();}
}
