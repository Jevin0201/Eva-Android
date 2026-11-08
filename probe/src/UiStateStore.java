package ai.eva.android.probe;

import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.content.ContentValues;
import java.io.*;
import org.json.*;

/** Transactional UI metadata and per-conversation snapshots. Native rollouts remain canonical. */
final class UiStateStore {
 static final String SELECTION_EPOCH=java.util.UUID.randomUUID().toString();
 static final java.util.concurrent.atomic.AtomicLong OPERATIONS=new java.util.concurrent.atomic.AtomicLong();
 static long nextOperation(){return OPERATIONS.incrementAndGet();}
 static final String DEFAULT="{\"chats\":[],\"drafts\":[],\"projects\":[],\"draft\":\"\",\"active\":null}";
 static File file(Context c){return new File(c.getFilesDir(),"ui-state.sqlite");}
 static SQLiteDatabase open(Context c){
  SQLiteDatabase db=SQLiteDatabase.openOrCreateDatabase(file(c),null);
  db.execSQL("CREATE TABLE IF NOT EXISTS snapshots (key TEXT PRIMARY KEY, digest TEXT NOT NULL, bytes INTEGER NOT NULL, parts INTEGER NOT NULL)");
  db.execSQL("CREATE TABLE IF NOT EXISTS chunks (key TEXT NOT NULL, ordinal INTEGER NOT NULL, body BLOB NOT NULL, PRIMARY KEY(key, ordinal))");
  db.execSQL("CREATE TABLE IF NOT EXISTS model_selections (key TEXT PRIMARY KEY, body TEXT NOT NULL, epoch TEXT NOT NULL, operation INTEGER NOT NULL)");
  return db;
 }
 static final int CHUNK_BYTES=65536;
 static String digest(byte[] bytes){try{
  byte[] hash=java.security.MessageDigest.getInstance("SHA-256").digest(bytes);char[] out=new char[hash.length*2];String hex="0123456789abcdef";
  for(int n=0;n<hash.length;n++){int value=hash[n]&255;out[n*2]=hex.charAt(value>>>4);out[n*2+1]=hex.charAt(value&15);}return new String(out);
 }catch(java.security.NoSuchAlgorithmException impossible){throw new IllegalStateException(impossible);}}
 static String row(SQLiteDatabase db,String key){
  String hash;int length,parts;
  try(Cursor cur=db.rawQuery("SELECT digest,bytes,parts FROM snapshots WHERE key=?",new String[]{key})){
   if(!cur.moveToFirst())return null;hash=cur.getString(0);length=cur.getInt(1);parts=cur.getInt(2);
  }
  // CursorWindow never receives an entire conversation or metadata document.
  ByteArrayOutputStream out=new ByteArrayOutputStream();int ordinal=0;
  try(Cursor cur=db.rawQuery("SELECT ordinal,body FROM chunks WHERE key=? ORDER BY ordinal",new String[]{key})){
   while(cur.moveToNext()){
    if(cur.getInt(0)!=ordinal++)throw new IllegalStateException("会话分块顺序错误");
    byte[] bytes=cur.getBlob(1);if(bytes.length>CHUNK_BYTES)throw new IllegalStateException("会话分块过大");out.write(bytes,0,bytes.length);
   }
  }
  byte[] body=out.toByteArray();if(ordinal!=parts||body.length!=length||!digest(body).equals(hash))throw new IllegalStateException("会话分块不完整");
  return new String(body,java.nio.charset.StandardCharsets.UTF_8);
 }
 static String load(Context c){synchronized(ShellActivity.saveLock){
  if(!file(c).isFile())return c.getSharedPreferences("eva-ui",0).getString("state",DEFAULT);
  try(SQLiteDatabase db=open(c)){
   // The host serializes readers/writers; rollback-journal transactions give a
   // coherent snapshot without requiring a long-lived WAL connection pool.
   db.beginTransaction();try{
    String raw=row(db,"metadata");if(raw==null)return applySelections(db,new JSONObject(c.getSharedPreferences("eva-ui",0).getString("state",DEFAULT))).toString();
    JSONObject state=new JSONObject(raw);
    for(String group:new String[]{"chats","drafts"}){
     JSONArray keys=state.getJSONArray(group),rows=new JSONArray();
     for(int n=0;n<keys.length();n++){String body=row(db,keys.getString(n));if(body==null)throw new IOException("会话记录缺失");rows.put(new JSONObject(body));}
     state.put(group,rows);
    }
    db.setTransactionSuccessful();return applySelections(db,state).toString();
   }finally{db.endTransaction();}
  }catch(Exception e){throw new IllegalStateException("会话存储读取失败，请保留应用数据后重试",e);}
 }}
 static void put(SQLiteDatabase db,String key,String body){
  byte[] bytes=body.getBytes(java.nio.charset.StandardCharsets.UTF_8);String hash=digest(bytes);
  try(Cursor cur=db.rawQuery("SELECT digest,bytes FROM snapshots WHERE key=?",new String[]{key})){
   if(cur.moveToFirst()&&cur.getString(0).equals(hash)&&cur.getInt(1)==bytes.length)return;
  }
  db.delete("chunks","key=?",new String[]{key});int parts=0;
  for(int offset=0;offset<bytes.length;offset+=CHUNK_BYTES){
   ContentValues part=new ContentValues();part.put("key",key);part.put("ordinal",parts++);
   part.put("body",java.util.Arrays.copyOfRange(bytes,offset,Math.min(bytes.length,offset+CHUNK_BYTES)));
   db.insertOrThrow("chunks",null,part);
  }
  ContentValues values=new ContentValues();values.put("key",key);values.put("digest",hash);values.put("bytes",bytes.length);values.put("parts",parts);
  if(db.insertWithOnConflict("snapshots",null,values,SQLiteDatabase.CONFLICT_REPLACE)==-1)throw new IllegalStateException("会话记录写入失败");
 }
 // Commit the current conversation and index without reading or transmitting other histories.
 // Return false for an unsaved index entry so the caller can use a complete checkpoint.
 static boolean checkpoint(Context context,String raw)throws Exception{return checkpoint(context,raw,nextOperation());}
 static boolean checkpoint(Context context,String raw,long operation)throws Exception{
  JSONObject request=new JSONObject(raw),state=request.getJSONObject("state");
  JSONObject conversation=request.getJSONObject("conversation");
  String selectedGroup=request.getString("group"),selectedId=conversation.getString("id");
  if(!selectedGroup.equals("chats")&&!selectedGroup.equals("drafts"))throw new IOException("Invalid conversation group");
  try(SQLiteDatabase db=open(context)){
   db.beginTransaction();try{
    boolean selected=false;
    for(String group:new String[]{"chats","drafts"}){
     JSONArray rows=state.getJSONArray(group),keys=new JSONArray();
     java.util.Set<String> ids=new java.util.HashSet<>();
     for(int index=0;index<rows.length();index++){
      String id=rows.getJSONObject(index).getString("id");
      if(!ids.add(id))return false;
      String key=group+":"+digest(id.getBytes(java.nio.charset.StandardCharsets.UTF_8))+":0";
      keys.put(key);
      if(group.equals(selectedGroup)&&id.equals(selectedId)){
       put(db,key,conversation.toString());reconcileSelection(db,selectionKey(selectedId),operation);selected=true;
      }else{
       try(Cursor cursor=db.rawQuery("SELECT 1 FROM snapshots WHERE key=?",new String[]{key})){
        if(!cursor.moveToFirst())return false;
       }
      }
     }
     state.put(group,keys);
    }
    if(!selected)return false;
    put(db,"metadata",state.toString());reconcileSelection(db,"composer",operation);db.setTransactionSuccessful();return true;
   }finally{db.endTransaction();}
  }
 }
 // Selection-only updates never inspect or rewrite conversation chunks.
 static boolean saveNavigation(Context c,String raw)throws Exception{synchronized(ShellActivity.saveLock){
  if(!file(c).isFile())return false;JSONObject request=new JSONObject(raw);
  try(SQLiteDatabase db=open(c)){db.beginTransaction();try{
   String prior=row(db,"metadata");if(prior==null)return false;JSONObject metadata=new JSONObject(prior);
   if(!request.isNull("active")){String id=request.getString("active"),hash=digest(id.getBytes(java.nio.charset.StandardCharsets.UTF_8));boolean found=false;
    for(String group:new String[]{"chats","drafts"}){JSONArray keys=metadata.getJSONArray(group);for(int i=0;i<keys.length();i++)if(keys.getString(i).startsWith(group+":"+hash+":"))found=true;}
    if(!found)return false;
   }
   metadata.put("active",request.isNull("active")?JSONObject.NULL:request.getString("active"));metadata.put("projectId",request.optString("projectId",""));put(db,"metadata",metadata.toString());db.setTransactionSuccessful();return true;
  }finally{db.endTransaction();}}
 }}
 // Metadata-only edits: keep conversation chunks intact; fall back if any row is not durable yet.
 static boolean saveStructure(Context c,String raw,long operation)throws Exception{synchronized(ShellActivity.saveLock){
  if(!file(c).isFile())return false;
  JSONObject state=new JSONObject(raw);
  try(SQLiteDatabase db=open(c)){db.beginTransaction();try{
   String prior=row(db,"metadata");if(prior==null)return false;
   java.util.Set<String> live=new java.util.HashSet<>();
   for(String group:new String[]{"chats","drafts"}){
    JSONArray rows=state.getJSONArray(group),keys=new JSONArray();java.util.Set<String> ids=new java.util.HashSet<>();
    for(int i=0;i<rows.length();i++){String id=rows.getJSONObject(i).optString("id","");if(id.isEmpty()||!ids.add(id))return false;
     String key=group+":"+digest(id.getBytes(java.nio.charset.StandardCharsets.UTF_8))+":0";
     try(Cursor cursor=db.rawQuery("SELECT 1 FROM snapshots WHERE key=?",new String[]{key})){if(!cursor.moveToFirst())return false;}
     live.add(key);keys.put(key);
    }state.put(group,keys);
   }
   JSONObject old=new JSONObject(prior);
   for(String group:new String[]{"chats","drafts"}){JSONArray keys=old.getJSONArray(group);for(int i=0;i<keys.length();i++){String key=keys.getString(i);if(!live.contains(key)){db.delete("chunks","key=?",new String[]{key});db.delete("snapshots","key=?",new String[]{key});}}}
   put(db,"metadata",state.toString());reconcileSelection(db,"composer",operation);db.setTransactionSuccessful();return true;
  }finally{db.endTransaction();}}
 }}
 static void save(Context c,String raw)throws Exception{save(c,raw,nextOperation());}
 static void save(Context c,String raw,long operation)throws Exception{synchronized(ShellActivity.saveLock){
  JSONObject state=new JSONObject(raw);
  try(SQLiteDatabase db=open(c)){
   db.beginTransaction();try{
    java.util.Set<String> live=new java.util.HashSet<>();live.add("metadata");java.util.Set<String> selectedKeys=new java.util.HashSet<>();selectedKeys.add("composer");
    for(String group:new String[]{"chats","drafts"}){
     JSONArray rows=state.optJSONArray(group),keys=new JSONArray();if(rows==null)rows=new JSONArray();
     java.util.Map<String,Integer> occurrences=new java.util.HashMap<>();
     for(int n=0;n<rows.length();n++){
      JSONObject chat=rows.getJSONObject(n);String id=chat.optString("id");
      int occurrence=occurrences.getOrDefault(id,0);occurrences.put(id,occurrence+1);
      // IDs survive reordering; occurrence disambiguates legacy duplicate/missing IDs.
      // Hashing bounds keys even when an imported historical ID is unusually large.
      String key=group+":"+digest(id.getBytes(java.nio.charset.StandardCharsets.UTF_8))+":"+occurrence;
      live.add(key);keys.put(key);put(db,key,chat.toString());String selectionKey=selectionKey(id);selectedKeys.add(selectionKey);reconcileSelection(db,selectionKey,operation);
     }
     state.put(group,keys);
    }
    put(db,"metadata",state.toString());reconcileSelection(db,"composer",operation);
    java.util.ArrayList<String> selectionStale=new java.util.ArrayList<>();try(Cursor cursor=db.rawQuery("SELECT key FROM model_selections",null)){while(cursor.moveToNext()){String key=cursor.getString(0);if(!selectedKeys.contains(key))selectionStale.add(key);}}for(String key:selectionStale)reconcileSelection(db,key,operation);
    java.util.ArrayList<String> stale=new java.util.ArrayList<>();try(Cursor cur=db.rawQuery("SELECT key FROM snapshots",null)){while(cur.moveToNext()){String key=cur.getString(0);if(!live.contains(key))stale.add(key);}}
    for(String key:stale){db.delete("chunks","key=?",new String[]{key});db.delete("snapshots","key=?",new String[]{key});}
    db.setTransactionSuccessful();
   }finally{db.endTransaction();}
  }
  // The old snapshot is retained as a migration recovery source, never overwritten.
 }}
 static String selectionKey(String chatId){return "chat:"+digest(chatId.getBytes(java.nio.charset.StandardCharsets.UTF_8));}
 // Full snapshots may have been queued before a newer selection. Their history
 // is still saved, while a more recent selection remains an independent overlay.
 static void reconcileSelection(SQLiteDatabase db,String key,long operation){
  try(Cursor cursor=db.rawQuery("SELECT epoch,operation FROM model_selections WHERE key=?",new String[]{key})){
   if(cursor.moveToFirst()&&cursor.getString(0).equals(SELECTION_EPOCH)&&cursor.getLong(1)>operation)return;
  }
  ContentValues values=new ContentValues();values.put("key",key);values.put("body","null");values.put("epoch",SELECTION_EPOCH);values.put("operation",operation);
  if(db.insertWithOnConflict("model_selections",null,values,SQLiteDatabase.CONFLICT_REPLACE)==-1)throw new IllegalStateException("模型选择版本保存失败");
 }
 static JSONObject applySelections(SQLiteDatabase db,JSONObject state)throws Exception{
  java.util.Map<String,JSONObject> selections=new java.util.HashMap<>();
  try(Cursor cursor=db.rawQuery("SELECT key,body FROM model_selections",null)){
   while(cursor.moveToNext())if(!cursor.getString(1).equals("null"))selections.put(cursor.getString(0),new JSONObject(cursor.getString(1)));
  }
  JSONObject composer=selections.get("composer");if(composer!=null)state.put("composerSelection",composer);
  for(String group:new String[]{"chats","drafts"}){
   JSONArray chats=state.optJSONArray(group);if(chats==null)continue;
   for(int i=0;i<chats.length();i++){
    JSONObject chat=chats.getJSONObject(i),selection=selections.get(selectionKey(chat.optString("id")));
    if(selection==null)continue;
    for(String field:new String[]{"providerId","model","effort","serviceTier"}){
     if(selection.has(field))chat.put(field,selection.get(field));else chat.remove(field);
    }
   }
  }
  return state;
 }
 static boolean modelSelection(Context context,String raw,long operation)throws Exception{
  if(raw==null||raw.length()>8192)throw new IOException("模型选择数据无效");
  JSONObject request=new JSONObject(raw),selection=request.getJSONObject("selection"),clean=new JSONObject();
  if(!request.has("chatId"))throw new IOException("缺少会话作用域");
  java.util.Iterator<String> fields=selection.keys();
  while(fields.hasNext()){
   String field=fields.next();int max=field.equals("effort")?40:field.equals("serviceTier")?80:200;
   if(!java.util.Arrays.asList("providerId","model","effort","serviceTier").contains(field))throw new IOException("未知模型选择字段");
   if(selection.isNull(field)&&!field.equals("providerId")&&!field.equals("model"))continue;
   if(!(selection.get(field) instanceof String))throw new IOException("模型选择字段类型无效");
   String value=selection.getString(field);if(value.length()>max||value.indexOf(0)>=0||value.indexOf('\n')>=0||value.indexOf('\r')>=0)throw new IOException("模型选择字段无效");
   if(!value.isEmpty())clean.put(field,value);
  }
  if(clean.optString("providerId").isEmpty()||clean.optString("model").isEmpty())throw new IOException("请选择提供商和模型");
  ModelStore.validateDshChoice(context,clean.getString("providerId"),clean.getString("model"));
  boolean composer=request.isNull("chatId");String chatId=composer?null:request.getString("chatId");
  if(chatId!=null&&(chatId.isEmpty()||chatId.length()>2000))throw new IOException("会话编号无效");
  synchronized(ShellActivity.saveLock){
   try(SQLiteDatabase db=open(context)){
    db.beginTransaction();try{
     if(!composer){
      String metadata=row(db,"metadata");int matches=0;
      if(metadata!=null){JSONObject index=new JSONObject(metadata);for(String group:new String[]{"chats","drafts"}){JSONArray keys=index.optJSONArray(group);if(keys==null)continue;String prefix=group+":"+digest(chatId.getBytes(java.nio.charset.StandardCharsets.UTF_8))+":";for(int i=0;i<keys.length();i++)if(keys.getString(i).startsWith(prefix))matches++;}}
      else{JSONObject legacy=new JSONObject(context.getSharedPreferences("eva-ui",0).getString("state",DEFAULT));for(String group:new String[]{"chats","drafts"}){JSONArray chats=legacy.optJSONArray(group);if(chats!=null)for(int i=0;i<chats.length();i++)if(chatId.equals(chats.getJSONObject(i).optString("id")))matches++;}}
      if(matches!=1)return false;
     }
     String key=composer?"composer":selectionKey(chatId);
     // Keep the latest explicit choice if asynchronous calls arrive out of order.
     try(Cursor cursor=db.rawQuery("SELECT epoch,operation FROM model_selections WHERE key=?",new String[]{key})){
      if(cursor.moveToFirst()&&cursor.getString(0).equals(SELECTION_EPOCH)&&cursor.getLong(1)>operation){db.setTransactionSuccessful();return true;}
     }
     ContentValues values=new ContentValues();values.put("key",key);values.put("body",clean.toString());values.put("epoch",SELECTION_EPOCH);values.put("operation",operation);
     if(db.insertWithOnConflict("model_selections",null,values,SQLiteDatabase.CONFLICT_REPLACE)==-1)throw new IOException("模型选择保存失败");
     db.setTransactionSuccessful();return true;
    }finally{db.endTransaction();}
   }
  }
 }

}
