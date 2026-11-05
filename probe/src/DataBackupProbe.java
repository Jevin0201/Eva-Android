package ai.eva.android.probe;
import android.app.Activity;import android.content.*;import android.widget.Toast;import java.io.*;import java.nio.file.*;import java.nio.file.attribute.BasicFileAttributes;import java.util.*;import org.json.*;

/** Actual Android JSON/SharedPreferences/ZIP test, isolated from all user data. Not a SAF test. */
final class DataBackupProbe {
 static int checks;static final java.util.concurrent.atomic.AtomicBoolean testing=new java.util.concurrent.atomic.AtomicBoolean();
 interface Checked {void run()throws Exception;}
 static void require(boolean value,String label)throws IOException{checks++;if(!value)throw new IOException("Assertion failed: "+label);}
 static void rejects(Checked operation,String label)throws Exception{boolean rejected=false;try{operation.run();}catch(IOException expected){rejected=true;}require(rejected,label);}
 static final class FixtureContext extends ContextWrapper {
  final File directory;final String prefName;
  FixtureContext(Context base,File directory,String prefName){super(base);this.directory=directory;this.prefName=prefName;}
  public File getFilesDir(){return directory;}
  public SharedPreferences getSharedPreferences(String name,int mode){if(!"eva-ui".equals(name))throw new IllegalArgumentException("Fixture requested unexpected preferences");return getBaseContext().getSharedPreferences(prefName,mode);}
 }
 static void check(Activity activity){if(!testing.compareAndSet(false,true))return;new Thread(()->{
  JSONObject report=new JSONObject();String pref="eva-backup-fixture-"+UUID.randomUUID();File directory=null;checks=0;
  try{
   File sandbox=activity.getCacheDir().getCanonicalFile();directory=new File(sandbox,"backup-fixture-"+UUID.randomUUID());require(directory.mkdir(),"fixture directory created");
   final FixtureContext fixture=new FixtureContext(activity.getApplicationContext(),directory,pref);
   JSONObject keptChat=new JSONObject().put("id","keep").put("title","fixture original").put("messages",new JSONArray().put("preserve this fixture")).put("running",false);
   JSONObject current=new JSONObject().put("chats",new JSONArray().put(keptChat)).put("drafts",new JSONArray()).put("projects",new JSONArray().put(new JSONObject().put("id","keep-project").put("name","fixture project"))).put("active","keep").put("draft","current draft").put("apiKey","EXCLUDED_FIXTURE_VALUE").put("agentQuestionDrafts",new JSONObject().put("test","EXCLUDED_DRAFT"));
   String original=current.toString();require(fixture.getSharedPreferences("eva-ui",0).edit().putString("state",original).commit(),"fixture initialized");
   require(UiStateStore.load(fixture).equals(original),"legacy state read without mutation");
   char[] payload=new char[2100000];java.util.Arrays.fill(payload,'中');
   JSONObject large=new JSONObject(original);large.getJSONArray("chats").getJSONObject(0).put("draft",new String(payload));
   UiStateStore.save(fixture,large.toString());
   require(new JSONObject(UiStateStore.load(fixture)).getJSONArray("chats").getJSONObject(0).getString("draft").equals(new String(payload)),"snapshot above former 2M limit roundtrips across UTF8 chunk boundaries");
   try(android.database.sqlite.SQLiteDatabase db=UiStateStore.open(fixture);android.database.Cursor cur=db.rawQuery("SELECT MAX(length(body)),COUNT(*) FROM chunks",null)){
    require(cur.moveToFirst()&&cur.getInt(0)<=UiStateStore.CHUNK_BYTES&&cur.getInt(1)>90,"large history stored in bounded CursorWindow-safe chunks");
   }
   JSONObject largeMetadata=new JSONObject(large.toString()).put("draft",new String(payload)+"😀");UiStateStore.save(fixture,largeMetadata.toString());
   require(new JSONObject(UiStateStore.load(fixture)).getString("draft").equals(new String(payload)+"😀"),"metadata above 2M also roundtrips with emoji");
   UiStateStore.save(fixture,large.toString());
   require(fixture.getSharedPreferences("eva-ui",0).getString("state","").equals(original),"legacy recovery source retained");
   String valid=UiStateStore.load(fixture);boolean malformed=false;try{UiStateStore.save(fixture,"{");}catch(Exception expected){malformed=true;}
   require(malformed&&UiStateStore.load(fixture).equals(valid),"malformed write preserves committed snapshot");
   JSONObject twoChats=new JSONObject(valid);twoChats.getJSONArray("chats").put(new JSONObject().put("id","second").put("title","second chat").put("draft","second draft"));
   UiStateStore.save(fixture,twoChats.toString());valid=UiStateStore.load(fixture);
   try(android.database.sqlite.SQLiteDatabase db=UiStateStore.open(fixture)){
    db.execSQL("CREATE TRIGGER reject_chat BEFORE INSERT ON snapshots WHEN NEW.key LIKE 'chats:%' BEGIN SELECT RAISE(ABORT, 'fixture write failure'); END");
   }
   JSONObject metadataOnly=new JSONObject(valid).put("draft","metadata update");UiStateStore.save(fixture,metadataOnly.toString());
   require(new JSONObject(UiStateStore.load(fixture)).getString("draft").equals("metadata update"),"unchanged chat snapshot is not rewritten");
   JSONObject reordered=new JSONObject(UiStateStore.load(fixture));JSONArray prior=reordered.getJSONArray("chats");
   reordered.put("chats",new JSONArray().put(prior.getJSONObject(1)).put(prior.getJSONObject(0)));
   UiStateStore.save(fixture,reordered.toString());
   require(new JSONObject(UiStateStore.load(fixture)).getJSONArray("chats").getJSONObject(0).getString("id").equals("second"),"reorder changes metadata without rewriting chat rows");
   String committed=UiStateStore.load(fixture);JSONObject changed=new JSONObject(committed);changed.getJSONArray("chats").getJSONObject(0).put("title","must rollback");
   boolean rolledBack=false;try{UiStateStore.save(fixture,changed.toString());}catch(Exception expected){rolledBack=true;}
   require(rolledBack&&UiStateStore.load(fixture).equals(committed),"failed row write rolls back entire transaction");
   try(android.database.sqlite.SQLiteDatabase db=UiStateStore.open(fixture)){db.execSQL("DROP TRIGGER reject_chat");}
   JSONObject duplicates=new JSONObject(original);duplicates.getJSONArray("chats").put(new JSONObject(keptChat.toString()).put("title","same id different history"));
   UiStateStore.save(fixture,duplicates.toString());
   require(new JSONObject(UiStateStore.load(fixture)).getJSONArray("chats").getJSONObject(1).getString("title").equals("same id different history"),"legacy duplicate IDs retain independent records");
   UiStateStore.save(fixture,original);
   JSONObject turn=new JSONObject().put("id","old-turn").put("status","inProgress").put("items",new JSONArray().put(new JSONObject().put("id","item").put("type","agentMessage").put("text","验收历史 😀")));
   JSONObject importedChat=new JSONObject().put("id","old-local-id").put("title","验收对话").put("messages",new JSONArray()).put("running",true).put("projectId","old-project").put("attachments",new JSONArray().put(new JSONObject().put("name","not-included.txt"))).put("kernelThread",new JSONObject().put("id","old-thread").put("turns",new JSONArray().put(turn)));
   JSONObject incoming=new JSONObject().put("chats",new JSONArray().put(importedChat)).put("drafts",new JSONArray()).put("projects",new JSONArray().put(new JSONObject().put("id","old-project").put("name","验收项目"))).put("draft","未发送的验收草稿");
   byte[] encoded=DataBackupStore.encodeState(incoming.toString());DataBackupStore.Preview preview=DataBackupStore.preview(new ByteArrayInputStream(encoded));
   require(preview.chats==1&&preview.drafts==1&&preview.projects==1,"preview counts");require(preview.state.getJSONArray("chats").getJSONObject(0).getString("title").equals("验收对话"),"UTF8 serialization");
   Map<String,String> exported=DataBackupArchive.decode(new ByteArrayInputStream(DataBackupStore.encodeState(original)));require(!exported.get("conversations.json").contains("EXCLUDED_FIXTURE_VALUE")&&!exported.get("conversations.json").contains("EXCLUDED_DRAFT"),"non-history fields excluded");
   // Lock the same revision boundary as the production writer. No real UI prefs
   // or files are ever written, copied into a ZIP, or sent outside the app.
   synchronized(ShellActivity.saveLock){
    String realBefore=DataBackupStore.current(activity);long revision=ShellActivity.saveRevision.get();
    File before=DataBackupStore.restore(fixture,preview,original,revision);
    require(before.getCanonicalFile().toPath().startsWith(directory.getCanonicalFile().toPath()),"snapshot restricted to fixture");
    require(before.isFile()&&before.length()>0,"pre-restore snapshot saved");
    DataBackupStore.Preview snapshot;try(InputStream in=new FileInputStream(before)){snapshot=DataBackupStore.preview(in);}require(snapshot.chats==1&&snapshot.state.getJSONArray("chats").getJSONObject(0).getString("id").equals("keep"),"snapshot has pre-restore state");
    JSONObject merged=new JSONObject(DataBackupStore.current(fixture));JSONArray chats=merged.getJSONArray("chats");require(chats.length()==3,"history and global draft merged");require(chats.getJSONObject(0).toString().equals(keptChat.toString()),"existing fixture record unchanged");require(merged.getString("active").equals("keep")&&merged.getString("draft").equals("current draft"),"active and current draft unchanged");
    JSONObject copy=chats.getJSONObject(1);require(copy.getBoolean("importedReadOnly")&&!copy.getBoolean("running"),"read-only non-running import");require(!copy.getString("id").equals("old-local-id"),"new local UUID");require(copy.getJSONObject("kernelThread").getString("id").equals("old-thread"),"history retains display thread ID");require(copy.getJSONObject("kernelThread").getJSONArray("turns").getJSONObject(0).getString("status").equals("interrupted"),"in-progress history no longer running");require(copy.getJSONArray("attachments").length()==0&&copy.getJSONArray("importedAttachments").length()==1,"missing attachment files not attached for sending");require(!copy.getString("projectId").equals("old-project"),"new project UUID");require(chats.getJSONObject(2).getString("draft").equals("未发送的验收草稿"),"global imported draft retained");
    final String stable=DataBackupStore.current(fixture);final long now=ShellActivity.saveRevision.get();
    rejects(()->DataBackupStore.restore(fixture,preview,stable,now-1),"stale revision rejected");require(DataBackupStore.current(fixture).equals(stable),"revision rejection writes nothing");
    rejects(()->DataBackupStore.restore(fixture,preview,original,ShellActivity.saveRevision.get()),"changed content rejected");require(DataBackupStore.current(fixture).equals(stable),"content rejection writes nothing");
    JSONObject busy=new JSONObject(stable);busy.getJSONArray("chats").getJSONObject(0).put("running",true);String busyRaw=busy.toString();UiStateStore.save(fixture,busyRaw);rejects(()->DataBackupStore.restore(fixture,preview,busyRaw,ShellActivity.saveRevision.get()),"running fixture task rejected");require(DataBackupStore.current(fixture).equals(busyRaw),"running rejection writes nothing");
    require(DataBackupStore.current(activity).equals(realBefore),"real user state unchanged");
   }
   report.put("result","PASS").put("assertions",checks).put("isolated",true).put("userStateUnchanged",true).put("safTested",false);
  }catch(Exception e){try{report.put("result","FAIL").put("assertions",checks).put("error",e.toString());}catch(Exception ignored){}}
  finally{activity.deleteSharedPreferences(pref);try{if(directory!=null)cleanup(directory,activity.getCacheDir().getCanonicalFile());report.put("fixtureCleaned",true);}catch(Exception e){try{report.put("cleanupError",e.getMessage());}catch(Exception ignored){}}}
  activity.getSharedPreferences("eva-backup-probe",0).edit().putString("result",report.toString()).commit();testing.set(false);final String done=report.optString("result")+" backup fixture "+checks+" checks";activity.runOnUiThread(()->Toast.makeText(activity,done,Toast.LENGTH_LONG).show());
 },"EvaBackupProbe").start();}
 static void cleanup(File target,File cache)throws IOException{final Path root=target.getCanonicalFile().toPath(),base=cache.getCanonicalFile().toPath();if(!root.startsWith(base)||root.equals(base)||!target.getName().startsWith("backup-fixture-"))throw new IOException("Fixture cleanup path invalid");if(!Files.exists(root,LinkOption.NOFOLLOW_LINKS))return;Files.walkFileTree(root,new SimpleFileVisitor<Path>(){public FileVisitResult visitFile(Path file,BasicFileAttributes attrs)throws IOException{if(!file.normalize().startsWith(root))throw new IOException("Fixture file outside root");Files.delete(file);return FileVisitResult.CONTINUE;}public FileVisitResult postVisitDirectory(Path dir,IOException error)throws IOException{if(error!=null)throw error;if(!dir.normalize().startsWith(root))throw new IOException("Fixture directory outside root");Files.delete(dir);return FileVisitResult.CONTINUE;}});}
}
