package ai.eva.android.probe;

import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import java.io.*;
import java.nio.charset.*;
import java.time.Instant;
import org.json.*;

/** Local status inspection only: never starts a kernel or returns transcript content. */
final class ThreadRecovery {
 static final String UUID="(?i)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
 static final int MAX_LINE=4*1024*1024,MAX_FILES=20000,MAX_LINES=250000;
 static final long MAX_BYTES=128L*1024*1024;
 static JSONObject unknown(boolean found,String reason)throws JSONException{return new JSONObject().put("found",found).put("terminal",false).put("state","unknown").put("turnId",JSONObject.NULL).put("at",JSONObject.NULL).put("reason",reason);}
 static JSONObject read(Context c,JSONObject request)throws Exception{
  String id=request.optString("threadId");if(!id.matches(UUID))throw new IOException("会话编号无效");
  File home=new File(c.getFilesDir(),"alpine/root/.eva-codex").getCanonicalFile();
  File file=null,dbFile=new File(home,"state_5.sqlite");
  if(dbFile.isFile())try(SQLiteDatabase db=SQLiteDatabase.openDatabase(dbFile.getPath(),null,SQLiteDatabase.OPEN_READONLY);Cursor cur=db.rawQuery("SELECT rollout_path FROM threads WHERE id=?",new String[]{id})){
   if(cur.moveToFirst()){String path=cur.getString(0);if(path!=null&&path.length()<4096){
    String prefix="/root/.eva-codex/";File candidate=path.startsWith(prefix)?new File(home,path.substring(prefix.length())):new File(path);
    if(allowed(home,candidate,id))file=candidate.getCanonicalFile();
   }}
  }catch(Exception ignored){/* A missing/locked index does not start the kernel. */}
  if(file==null){int[] count={0};for(String group:new String[]{"sessions","archived_sessions"}){file=find(home,new File(home,group),id,0,count);if(file!=null)break;}if(count[0]>MAX_FILES)return unknown(false,"inventory-limit");}
  return file==null?unknown(false,"not-found"):parse(file,id);
 }
 static boolean allowed(File home,File file,String id)throws IOException{
  if(!file.isFile()||!file.getName().toLowerCase(java.util.Locale.ROOT).endsWith("-"+id.toLowerCase(java.util.Locale.ROOT)+".jsonl"))return false;
  File canonical=file.getCanonicalFile();for(String group:new String[]{"sessions","archived_sessions"}){
   File root=new File(home,group);if(!root.getCanonicalFile().equals(root.getAbsoluteFile()))continue;
   if(canonical.toPath().startsWith(root.toPath()))return true;
  }return false;
 }
 static File find(File home,File dir,String id,int depth,int[] count)throws IOException{
  if(depth>5||count[0]>MAX_FILES||!dir.isDirectory()||!dir.getCanonicalFile().equals(dir.getAbsoluteFile()))return null;
  File[] files=dir.listFiles();if(files==null)return null;
  for(File file:files){if(++count[0]>MAX_FILES)return null;if(file.isDirectory()){File found=find(home,file,id,depth+1,count);if(found!=null)return found;}else if(allowed(home,file,id))return file;}
  return null;
 }
 static JSONObject parse(File file,String id)throws Exception{
  long size=file.length();if(size>MAX_BYTES)return unknown(true,"file-limit");
  String state="unknown",turn=null;Long at=null;int lines=0;
  CharsetDecoder decoder=StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT);
  try(BufferedReader reader=new BufferedReader(new InputStreamReader(new FileInputStream(file),decoder))){
   StringBuilder line=new StringBuilder();int ch;while((ch=reader.read())!=-1){
    if(ch!='\n'){if(line.length()>=MAX_LINE)return unknown(true,"line-limit");line.append((char)ch);continue;}
    if(++lines>MAX_LINES)return unknown(true,"line-count-limit");
    if(line.length()==0)continue;
    JSONObject record=new JSONObject(line.toString());line.setLength(0);JSONObject payload=record.optJSONObject("payload");if(payload==null)continue;
    if("session_meta".equals(record.optString("type"))&&!id.equalsIgnoreCase(payload.optString("id")))return unknown(true,"identity-mismatch");
    if(!"event_msg".equals(record.optString("type")))continue;
    String kind=payload.optString("type");if(!kind.equals("task_started")&&!kind.equals("task_complete")&&!kind.equals("turn_aborted"))continue;
    String next=payload.optString("turn_id",turn==null?"":turn);if(!next.matches(UUID))return unknown(true,"invalid-turn");
    state=kind.equals("task_started")?"started":kind.equals("task_complete")?"completed":"interrupted";turn=next;
    try{at=Instant.parse(record.getString("timestamp")).toEpochMilli();}catch(Exception invalidTime){return unknown(true,"invalid-time");}
   }
   if(line.length()>0)return unknown(true,"partial-line");
  }catch(Exception malformed){return unknown(true,"unreadable-or-damaged");}
  if(file.length()!=size)return unknown(true,"changed-during-read");
  return new JSONObject().put("found",true).put("terminal",state.equals("completed")||state.equals("interrupted")).put("state",state).put("turnId",turn==null?JSONObject.NULL:turn).put("at",at==null?JSONObject.NULL:at);
 }
}
