package ai.eva.android.probe;

import android.content.Context;
import java.io.*;
import java.nio.charset.*;
import java.nio.file.*;
import java.security.*;
import java.util.*;
import org.json.*;

/** Private provider working-copy projection. Never edits a source rollout or sends a task. */
public final class ProviderHistoryProjection {
 static final long MAX_BYTES=128L*1024*1024;
 static final int MAX_LINE=32*1024*1024,MAX_DEPTH=16,MAX_FILES=20000,MAX_RECORDS=500000;
 static final String UUID="(?i)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
 static final class Source {File file;String id,provider;JSONObject meta;long limit,ordinalLimit,size,modified;boolean prefix;}
 static final class Work {
  String target;boolean explicit;long bytes,ordinal;int records,removed,checkpointRemoved;
  final Set<String> visiting=new HashSet<>();final List<Source> sources=new ArrayList<>();
  final Map<String,String> origin=new HashMap<>();final Map<String,Boolean> activeReasoning=new HashMap<>();
  final JSONArray audit=new JSONArray();final Map<String,File> index=new HashMap<>();
 }
 public static JSONObject project(Context c,String id,String provider,boolean explicit)throws Exception{
  return project(c,id,provider,explicit,null);
 }
 public static JSONObject project(Context c,String id,String provider,boolean explicit,JSONArray tools)throws Exception{
  File root=new File(c.getFilesDir(),"alpine/root").getCanonicalFile(),home=new File(root,".eva-codex").getCanonicalFile();String date=java.time.LocalDate.now(java.time.ZoneOffset.UTC).toString().replace('-','/');
  File destination=new File(home,"sessions/"+date).getCanonicalFile();if(!destination.toPath().startsWith(home.toPath()))throw new IOException("工作副本目录越界");
  return project(home,destination,"/root/.eva-codex/sessions/"+date,id,provider,explicit,tools);
 }
 static JSONObject project(File home,File output,String guest,String id,String provider,boolean explicit)throws Exception{
  return project(home,output,guest,id,provider,explicit,null);
 }
 static JSONObject project(File home,File output,String guest,String id,String provider,boolean explicit,JSONArray tools)throws Exception{
  if(!id.matches(UUID)||provider==null||provider.isEmpty()||provider.length()>200)throw new IOException("会话或提供商编号无效");
  home=home.getCanonicalFile();Work work=new Work();work.target=provider;work.explicit=explicit;int[] count={0};
  for(String group:new String[]{"sessions","archived_sessions"})index(new File(home,group),work.index,count,0);
  if(!work.index.containsKey(id.toLowerCase(Locale.ROOT)))return new JSONObject().put("needed",false).put("reason","unmaterialized");
  resolve(work,id,null,null,0);
  Source current=work.sources.get(work.sources.size()-1);
  JSONArray oldTools=current.meta.getJSONObject("payload").optJSONArray("dynamic_tools");
  JSONArray newTools=tools==null?oldTools:upgradeTools(oldTools,tools);
  boolean toolsChanged=tools!=null&&!sameJson(oldTools,newTools);
  if(!explicit){boolean conflicting=false;for(Source source:work.sources)if(!source.provider.isEmpty()&&!source.provider.equals(provider)){conflicting=true;break;}
   if(!conflicting&&!toolsChanged)return new JSONObject().put("needed",false).put("reason","same-provider-lineage");
  }
  if(Files.isSymbolicLink(output.toPath()))throw new IOException("工作副本目录不能使用链接");
  output=output.getCanonicalFile();
  if(!output.isDirectory()&&!output.mkdirs())throw new IOException("无法创建提供商工作副本目录");
  String copyId=java.util.UUID.randomUUID().toString(),timestamp=java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd\'T\'HH-mm-ss").withZone(java.time.ZoneOffset.UTC).format(java.time.Instant.now()),name="rollout-"+timestamp+"-"+copyId+".jsonl";
  File temp=new File(output,"."+name+".tmp"),file=new File(output,name),auditFile=new File(output,name+".audit.json");
  if(!temp.createNewFile())throw new IOException("工作副本名称冲突");
  try(FileOutputStream stream=new FileOutputStream(temp);BufferedWriter writer=new BufferedWriter(new OutputStreamWriter(stream,StandardCharsets.UTF_8))){
   JSONObject meta=new JSONObject(current.meta.toString());JSONObject payload=meta.getJSONObject("payload");payload.put("id",copyId).put("model_provider",provider);payload.remove("history_base");
   if(toolsChanged)payload.put("dynamic_tools",newTools);
   emit(work,writer,meta);
   for(Source source:work.sources)process(work,source,writer);
   writer.flush();stream.getFD().sync();
  }catch(Exception error){temp.delete();throw error;}
  int active=0;for(boolean conflicting:work.activeReasoning.values())if(conflicting)active++;
  JSONObject audit=new JSONObject().put("format","eva-provider-history-projection-v1").put("sourceThreadId",id).put("sourceProvider",current.provider).put("targetProvider",provider).put("explicitCrossProvider",explicit).put("projectedThreadId",copyId).put("sources",work.audit).put("removedReasoningItems",work.removed).put("removedCheckpointReasoningItems",work.checkpointRemoved).put("activeConflictingReasoningItems",active).put("sourceFilesUnchanged",true);
  audit.put("nativeToolsUpdated",toolsChanged);
  if(active==0&&!toolsChanged){temp.delete();return new JSONObject().put("needed",false).put("audit",audit);}
  audit.put("projectedSha256",hash(temp,temp.length())).put("projectedBytes",temp.length());
  File auditTemp=new File(output,"."+name+".audit.tmp");
  try{
   try(FileOutputStream out=new FileOutputStream(auditTemp)){out.write(audit.toString().getBytes(StandardCharsets.UTF_8));out.getFD().sync();}
   Files.move(temp.toPath(),file.toPath(),StandardCopyOption.ATOMIC_MOVE);Files.move(auditTemp.toPath(),auditFile.toPath(),StandardCopyOption.ATOMIC_MOVE);
   return new JSONObject().put("needed",true).put("path",guest+"/"+name).put("auditPath",guest+"/"+name+".audit.json").put("removedReasoningItems",work.removed).put("removedCheckpointReasoningItems",work.checkpointRemoved).put("nativeToolsUpdated",toolsChanged).put("audit",audit);
  }catch(Exception error){temp.delete();auditTemp.delete();file.delete();auditFile.delete();throw error;}
 }
 static JSONArray upgradeTools(JSONArray previous,JSONArray specs)throws Exception{
  JSONArray result=previous==null?new JSONArray():new JSONArray(previous.toString());
  for(int i=0;i<specs.length();i++){
   JSONObject spec=specs.getJSONObject(i);int position=-1;
   for(int n=0;n<result.length();n++)if(result.getJSONObject(n).optString("name").equals(spec.getString("name"))){position=n;break;}
   JSONObject tool=position<0?new JSONObject():new JSONObject(result.getJSONObject(position).toString());
   tool.put("name",spec.getString("name")).put("description",spec.getString("description")).put("input_schema",spec.getJSONObject("inputSchema"));
   if(position<0)result.put(tool);else result.put(position,tool);
  }
  return result;
 }
 static boolean sameJson(Object left,Object right)throws JSONException{
  if(left==null||right==null)return left==right;
  if(left instanceof JSONObject&&right instanceof JSONObject){
   JSONObject a=(JSONObject)left,b=(JSONObject)right;if(a.length()!=b.length())return false;
   Iterator<String> keys=a.keys();while(keys.hasNext()){String key=keys.next();if(!b.has(key)||!sameJson(a.get(key),b.get(key)))return false;}return true;
  }
  if(left instanceof JSONArray&&right instanceof JSONArray){JSONArray a=(JSONArray)left,b=(JSONArray)right;if(a.length()!=b.length())return false;for(int i=0;i<a.length();i++)if(!sameJson(a.get(i),b.get(i)))return false;return true;}
  return left.equals(right);
 }
 static void index(File directory,Map<String,File> result,int[] count,int depth)throws Exception{
  if(!directory.exists())return;if(depth>6||Files.isSymbolicLink(directory.toPath())||!directory.getCanonicalFile().equals(directory.getAbsoluteFile()))throw new IOException("历史目录结构无效");
  File[] files=directory.listFiles();if(files==null)throw new IOException("无法读取历史目录");
  for(File file:files){if(++count[0]>MAX_FILES)throw new IOException("历史目录超过检查上限");if(Files.isSymbolicLink(file.toPath()))continue;if(file.isDirectory()){index(file,result,count,depth+1);continue;}
   String name=file.getName();if(!name.endsWith(".jsonl")||name.length()<43)continue;String id=name.substring(name.length()-42,name.length()-6);if(!id.matches(UUID))continue;
   String key=id.toLowerCase(Locale.ROOT);if(result.put(key,file.getCanonicalFile())!=null)throw new IOException("历史会话编号存在重复文件，未进行迁移");
  }
 }
 static void resolve(Work w,String id,Long limit,Long ordinalLimit,int depth)throws Exception{
  if(depth>=MAX_DEPTH||!id.matches(UUID)||!w.visiting.add(id.toLowerCase(Locale.ROOT)))throw new IOException("历史依赖循环或超过深度上限");
  File file=w.index.get(id.toLowerCase(Locale.ROOT));if(file==null)throw new IOException("历史依赖缺失，未进行迁移");
  Source s=new Source();s.file=file;s.id=id;s.size=file.length();s.modified=file.lastModified();s.limit=limit==null?s.size:limit;s.ordinalLimit=ordinalLimit==null?-1:ordinalLimit;s.prefix=limit!=null;
  if(s.limit<1||s.limit>s.size||s.limit>MAX_BYTES||(w.bytes+=s.limit)>MAX_BYTES||s.ordinalLimit>MAX_RECORDS)throw new IOException("历史边界或总量超过迁移上限");
  try(InputStream in=new FileInputStream(file)){byte[] first=line(in,s.limit);if(first==null)throw new IOException("历史缺少元数据");s.meta=new JSONObject(decode(first));}
  if(!"session_meta".equals(s.meta.optString("type"))||!id.equalsIgnoreCase(s.meta.getJSONObject("payload").optString("id")))throw new IOException("历史元数据与会话编号不一致");
  JSONObject meta=s.meta.getJSONObject("payload");s.provider=meta.optString("model_provider","");JSONObject base=meta.optJSONObject("history_base");
  if(base!=null){String parent=base.getString("thread_id");long end=base.getLong("end_byte_offset"),ord=base.getLong("end_ordinal_exclusive");if(ord<1)throw new IOException("父历史回合边界无效");resolve(w,parent,end,ord,depth+1);}
  w.sources.add(s);w.visiting.remove(id.toLowerCase(Locale.ROOT));
 }
 static boolean conflict(Work w,String origin){return !origin.isEmpty()?!origin.equals(w.target):w.explicit;}
 static String key(JSONObject item,Source s,long ordinal,int n){String id=item.optString("id");return id.isEmpty()?s.id+":"+ordinal+":"+n:id;}
 static void track(Work w,JSONObject item,Source s,long ordinal,int n){if(!"reasoning".equals(item.optString("type")))return;String key=key(item,s,ordinal,n),origin=w.origin.getOrDefault(key,s.provider);w.origin.put(key,origin);w.activeReasoning.put(key,conflict(w,origin));}
 static void process(Work w,Source s,BufferedWriter out)throws Exception{
  String originalHash=hash(s.file,s.size);MessageDigest prefix=MessageDigest.getInstance("SHA-256");long consumed=0,records=0,lastOrdinal=-1;
  try(InputStream in=new BufferedInputStream(new FileInputStream(s.file),65536)){
   while(consumed<s.limit){byte[] bytes=line(in,s.limit-consumed);if(bytes==null)break;consumed+=bytes.length;prefix.update(bytes);if(++w.records>MAX_RECORDS)throw new IOException("历史记录数量超过迁移上限");JSONObject row=new JSONObject(decode(bytes));long ordinal=row.has("ordinal")?row.getLong("ordinal"):records;
    if(ordinal<0||ordinal<=lastOrdinal)throw new IOException("历史记录顺序无效");lastOrdinal=ordinal;records++;
    if("session_meta".equals(row.optString("type"))){if(records!=1)throw new IOException("历史重复元数据");continue;}
    JSONObject payload=row.optJSONObject("payload");boolean remove=false;
    if("response_item".equals(row.optString("type"))&&payload!=null){track(w,payload,s,ordinal,0);if("reasoning".equals(payload.optString("type"))&&conflict(w,w.origin.get(key(payload,s,ordinal,0)))){remove=true;w.removed++;}}
    if("compacted".equals(row.optString("type"))){w.activeReasoning.clear();JSONArray history=payload==null?null:payload.optJSONArray("replacement_history");if(history!=null){JSONArray kept=new JSONArray();for(int n=0;n<history.length();n++){JSONObject item=history.getJSONObject(n);track(w,item,s,ordinal,n);if("reasoning".equals(item.optString("type"))&&conflict(w,w.origin.get(key(item,s,ordinal,n))))w.checkpointRemoved++;else kept.put(item);}payload.put("replacement_history",kept);}}
    if(!remove)emit(w,out,row);
   }
  }
  if(consumed!=s.limit||s.prefix&&lastOrdinal+1!=s.ordinalLimit)throw new IOException("父历史字节或序号边界不完整");
  if(s.file.length()!=s.size||s.file.lastModified()!=s.modified||!originalHash.equals(hash(s.file,s.size)))throw new IOException("迁移期间历史发生变化，未继续操作");
  w.audit.put(new JSONObject().put("threadId",s.id).put("provider",s.provider).put("fileName",s.file.getName()).put("originalBytes",s.size).put("originalSha256",originalHash).put("includedBytes",s.limit).put("includedPrefixSha256",hex(prefix.digest())).put("endOrdinalExclusive",s.prefix?s.ordinalLimit:JSONObject.NULL));
 }
 static byte[] line(InputStream in,long remaining)throws Exception{
  ByteArrayOutputStream out=new ByteArrayOutputStream();while(remaining-->0){int b=in.read();if(b<0){if(out.size()==0)return null;throw new IOException("历史末尾记录不完整");}if(out.size()>=MAX_LINE)throw new IOException("历史单条记录超过32MiB");out.write(b);if(b=='\n')return out.toByteArray();}throw new IOException("父历史边界不是完整记录");
 }
 static String decode(byte[] bytes)throws Exception{return StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT).decode(java.nio.ByteBuffer.wrap(bytes)).toString();}
 static void emit(Work w,BufferedWriter out,JSONObject row)throws Exception{row.put("ordinal",w.ordinal++);out.write(row.toString());out.newLine();}
 static String hash(File file,long size)throws Exception{MessageDigest digest=MessageDigest.getInstance("SHA-256");long total=0;try(InputStream in=new BufferedInputStream(new FileInputStream(file))){byte[] bytes=new byte[65536];int n;while((n=in.read(bytes))!=-1){total+=n;if(total>MAX_BYTES)throw new IOException("原始历史文件超过128MiB");digest.update(bytes,0,n);}}if(total!=size)throw new IOException("历史读取期间发生变化");return hex(digest.digest());}
 static String hex(byte[] bytes){char[] result=new char[bytes.length*2];String digits="0123456789abcdef";for(int n=0;n<bytes.length;n++){int v=bytes[n]&255;result[n*2]=digits.charAt(v>>>4);result[n*2+1]=digits.charAt(v&15);}return new String(result);}
}
