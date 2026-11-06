package ai.eva.android.probe;

import java.io.*;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.json.*;

public final class HttpCaptureSummaryTest {
 static int checks;
 static void check(boolean value,String message){checks++;if(!value)throw new AssertionError(message);}
 static JSONObject entry(String url,int status,String mime,String body)throws Exception{
  return new JSONObject().put("request",new JSONObject().put("url",url).put("method","GET").put("headers",new JSONArray().put("Authorization: private_fixture_secret")).put("postData",new JSONObject().put("text","private_fixture_secret")))
   .put("response",new JSONObject().put("status",status).put("headers",new JSONArray().put("Set-Cookie: private_fixture_secret")).put("content",new JSONObject().put("mimeType",mime).put("text",body)));
 }
 public static void main(String[] args)throws Exception{
  Path root=Paths.get(args[0]);Files.createDirectories(root);Path file=root.resolve("fixture.har");
  JSONArray entries=new JSONArray().put(entry("https://fixture.example/products?token=private_fixture_secret#fragment",200,"application/json","{\"name\":\"猪脚饭\",\"price\":18,\"accessToken\":\"private_fixture_secret\",\"nested\":{\"phone\":\"private_fixture_secret\"}}"))
   .put(entry("http://fixture.example/plain",200,"text/plain","fixture response"))
   .put(entry("https://fixture.example/failed",0,"text/plain",""));
  Files.write(file,new JSONObject().put("log",new JSONObject().put("entries",entries)).toString().getBytes(StandardCharsets.UTF_8));
  JSONObject result=HttpCaptureSummary.read(file.toFile(),"猪脚饭",true,10);
  check(result.getBoolean("tlsDecrypted"),"actual HTTPS response establishes decryption");
  check(result.getInt("responses")==2&&result.getInt("failedHttpEntries")==1,"response/error counts");
  check(result.getInt("matchedResponses")==1,"content filter");
  check(result.toString().contains("猪脚饭")&&result.toString().contains("18"),"product fields retained");
  check(!result.toString().contains("private_fixture_secret"),"secrets, headers, body parameters and URL queries withheld");
  check(!result.getJSONArray("responsesPreview").getJSONObject(0).getString("url").contains("?"),"query removed");
  result=HttpCaptureSummary.read(file.toFile(),"",false,1);
  check(result.getBoolean("truncated"),"preview limit exposed");
  check(!result.getJSONArray("responsesPreview").getJSONObject(0).has("responseBody"),"metadata-only option");
  entries=new JSONArray().put(entry("https://fixture.example",0,"text/plain",""));
  Files.write(file,new JSONObject().put("log",new JSONObject().put("entries",entries)).toString().getBytes(StandardCharsets.UTF_8));
  result=HttpCaptureSummary.read(file.toFile(),"",true,10);
  check(!result.getBoolean("tlsDecrypted"),"handshake failure is not decrypted content");
  Files.write(file,"invalid HAR".getBytes(StandardCharsets.UTF_8));boolean rejected=false;
  try{HttpCaptureSummary.read(file.toFile(),"",true,10);}catch(JSONException expected){rejected=true;}
  check(rejected,"malformed HAR rejected");
  Path events=root.resolve("fixture.jsonl");
  Files.write(events,(new JSONObject().put("type","proxy_ready")+"\n"+
   new JSONObject().put("type","tls_client_error").put("server","fixture.example").put("error","certificate unknown")+"\n"+
   new JSONObject().put("type","http").put("entry",entry("https://fixture.example/product",200,"application/json","{\"name\":\"猪脚饭\",\"price\":18}"))+"\npartial").getBytes(StandardCharsets.UTF_8));
  result=HttpCaptureSummary.readEvents(events.toFile(),"猪脚饭",true,10);
  check(result.getBoolean("tlsDecrypted")&&result.getInt("matchedResponses")==1,"event response survives a partial final line");
  check(result.getInt("tlsErrors")==1&&result.getJSONArray("transportDiagnostics").length()==1,"TLS diagnostics retained alongside successful responses");
  Files.delete(events);
  Files.delete(file);
  System.out.println("PASS HTTP capture summary "+checks+" checks");
 }
}
