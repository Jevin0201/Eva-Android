package ai.eva.android.probe;

import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.content.ContentValues;
import java.io.*;
import org.json.*;

/** Transactional UI metadata and per-conversation snapshots. Native rollouts remain canonical. */
final class UiStateStore {
 static final String DEFAULT="{\"chats\":[],\"drafts\":[],\"projects\":[],\"draft\":\"\",\"active\":null}";
 static File file(Context c){return new File(c.getFilesDir(),"ui-state.sqlite");}
 static SQLiteDatabase open(Context c){
  SQLiteDatabase db=SQLiteDatabase.openOrCreateDatabase(file(c),null);
  db.execSQL("CREATE TABLE IF NOT EXISTS snapshots (key TEXT PRIMARY KEY, digest TEXT NOT NULL, bytes INTEGER NOT NULL, parts INTEGER NOT NULL)");
  db.execSQL("CREATE TABLE IF NOT EXISTS chunks (key TEXT NOT NULL, ordinal INTEGER NOT NULL, body BLOB NOT NULL, PRIMARY KEY(key, ordinal))");
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
    String raw=row(db,"metadata");if(raw==null)return c.getSharedPreferences("eva-ui",0).getString("state",DEFAULT);
    JSONObject state=new JSONObject(raw);
    for(String group:new String[]{"chats","drafts"}){
     JSONArray keys=state.getJSONArray(group),rows=new JSONArray();
     for(int n=0;n<keys.length();n++){String body=row(db,keys.getString(n));if(body==null)throw new IOException("会话记录缺失");rows.put(new JSONObject(body));}
     state.put(group,rows);
    }
    db.setTransactionSuccessful();return state.toString();
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
 static void save(Context c,String raw)throws Exception{synchronized(ShellActivity.saveLock){
  JSONObject state=new JSONObject(raw);
  try(SQLiteDatabase db=open(c)){
   db.beginTransaction();try{
    java.util.Set<String> live=new java.util.HashSet<>();live.add("metadata");
    for(String group:new String[]{"chats","drafts"}){
     JSONArray rows=state.optJSONArray(group),keys=new JSONArray();if(rows==null)rows=new JSONArray();
     java.util.Map<String,Integer> occurrences=new java.util.HashMap<>();
     for(int n=0;n<rows.length();n++){
      JSONObject chat=rows.getJSONObject(n);String id=chat.optString("id");
      int occurrence=occurrences.getOrDefault(id,0);occurrences.put(id,occurrence+1);
      // IDs survive reordering; occurrence disambiguates legacy duplicate/missing IDs.
      // Hashing bounds keys even when an imported historical ID is unusually large.
      String key=group+":"+digest(id.getBytes(java.nio.charset.StandardCharsets.UTF_8))+":"+occurrence;
      live.add(key);keys.put(key);put(db,key,chat.toString());
     }
     state.put(group,keys);
    }
    put(db,"metadata",state.toString());
    java.util.ArrayList<String> stale=new java.util.ArrayList<>();try(Cursor cur=db.rawQuery("SELECT key FROM snapshots",null)){while(cur.moveToNext()){String key=cur.getString(0);if(!live.contains(key))stale.add(key);}}
    for(String key:stale){db.delete("chunks","key=?",new String[]{key});db.delete("snapshots","key=?",new String[]{key});}
    db.setTransactionSuccessful();
   }finally{db.endTransaction();}
  }
  // The old snapshot is retained as a migration recovery source, never overwritten.
 }}
}
