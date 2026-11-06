package ai.eva.android.probe;

import org.json.*;
import java.io.*;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.regex.Pattern;

/** Bounded HAR response inspection. Request headers and request bodies stay local. */
final class HttpCaptureSummary {
 static final long MAX_BYTES=16L*1024*1024;
 static final Pattern SECRET=Pattern.compile(".*(token|password|passwd|secret|cookie|authorization|session|credential|api.?key|access.?key|phone|mobile|email|idcard).*",Pattern.CASE_INSENSITIVE);
 static String safeUrl(String value){
  try{URI uri=new URI(value);return new URI(uri.getScheme(),null,uri.getHost(),uri.getPort(),uri.getPath(),null,null).toString();}
  catch(Exception error){return "[invalid URL]";}
 }
 static Object redact(Object value,int depth)throws JSONException{
  if(depth>12)return "[depth limit]";
  if(value instanceof JSONObject){
   JSONObject result=new JSONObject(),object=(JSONObject)value;Iterator<String> keys=object.keys();int count=0;
   while(keys.hasNext()&&count++<100){String key=keys.next();result.put(key,SECRET.matcher(key).matches()?"[redacted]":redact(object.get(key),depth+1));}
   if(keys.hasNext())result.put("_truncated",true);return result;
  }
  if(value instanceof JSONArray){JSONArray source=(JSONArray)value,result=new JSONArray();for(int i=0;i<Math.min(source.length(),100);i++)result.put(redact(source.get(i),depth+1));return result;}
  return value;
 }
 static JSONObject readEvents(File file,String query,boolean includeBodies,int limit)throws Exception{
  if(file.length()>MAX_BYTES)throw new IOException("HTTP 事件文件超过分析上限");
  JSONArray entries=new JSONArray(),diagnostics=new JSONArray();int tlsErrors=0,tcpErrors=0;
  try(BufferedReader input=new BufferedReader(new InputStreamReader(new FileInputStream(file),StandardCharsets.UTF_8))){
   String line;while((line=input.readLine())!=null){
    JSONObject event;try{event=new JSONObject(line);}catch(JSONException partial){continue;}
    String type=event.optString("type");
    if(type.equals("http"))entries.put(event.getJSONObject("entry"));
    else if(type.endsWith("error")){
     if(type.startsWith("tls_"))tlsErrors++;if(type.equals("tcp_error"))tcpErrors++;
     if(diagnostics.length()<20)diagnostics.put(event);
    }
   }
  }
  return summarize(entries,query,includeBodies,limit).put("tlsErrors",tlsErrors).put("tcpErrors",tcpErrors).put("transportDiagnostics",diagnostics);
 }
 static JSONObject read(File file,String query,boolean includeBodies,int limit)throws Exception{
  if(file.length()>MAX_BYTES)throw new IOException("HAR 超过 16 MiB 分析上限，原文件已保留");
  String raw=new String(java.nio.file.Files.readAllBytes(file.toPath()),StandardCharsets.UTF_8);
  return summarize(new JSONObject(raw).getJSONObject("log").getJSONArray("entries"),query,includeBodies,limit);
 }
 static JSONObject summarize(JSONArray entries,String query,boolean includeBodies,int limit)throws Exception{
  JSONArray rows=new JSONArray();
  int responses=0,decrypted=0,errors=0,matches=0;String needle=query.toLowerCase(Locale.ROOT);
  for(int i=0;i<entries.length();i++){
   JSONObject entry=entries.getJSONObject(i),request=entry.optJSONObject("request"),response=entry.optJSONObject("response");
   if(request==null||response==null)continue;
   String url=safeUrl(request.optString("url"));int status=response.optInt("status");
   JSONObject content=response.optJSONObject("content");String body=content==null?"":content.optString("text"),mime=content==null?"":content.optString("mimeType");
   if(content!=null&&"base64".equals(content.optString("encoding"))){
    try{body=new String(Base64.getDecoder().decode(body),StandardCharsets.UTF_8);}catch(IllegalArgumentException invalid){body="";}
   }
   if(status<=0){errors++;continue;}responses++;
   if(url.startsWith("https://")&&!body.isEmpty())decrypted++;
   if(!needle.isEmpty()&&!url.toLowerCase(Locale.ROOT).contains(needle)&&!body.toLowerCase(Locale.ROOT).contains(needle))continue;
   matches++;if(rows.length()>=limit)continue;
   JSONObject row=new JSONObject().put("url",url).put("method",request.optString("method")).put("status",status).put("mimeType",mime).put("bodyCharacters",body.length());
   if(includeBodies&&(mime.contains("json")||mime.startsWith("text/")||mime.contains("xml"))){
    if(mime.contains("json")&&!body.isEmpty()){
     try{Object parsed=new JSONTokener(body).nextValue();body=String.valueOf(redact(parsed,0));}
     catch(JSONException invalid){body="[invalid JSON body retained in HAR]";}
    }
    row.put("responseBody",body.substring(0,Math.min(8192,body.length()))).put("bodyTruncated",body.length()>8192);
   }
   rows.put(row);
  }
  return new JSONObject().put("httpEntries",entries.length()).put("responses",responses).put("failedHttpEntries",errors)
   .put("decryptedHttpsResponses",decrypted).put("tlsDecrypted",decrypted>0).put("matchedResponses",matches).put("truncated",matches>rows.length()).put("responsesPreview",rows)
   .put("instruction",responses==0?"尚未捕获 HTTP 响应。结合引擎状态、PCAP 数据量和 TLS 错误核对原因；此结果不能单独证明证书固定。":"仅根据实际响应提取信息；请求头、Cookie 和请求正文未回传。");
 }
}
