package ai.eva.android.probe;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONArray;
import org.json.JSONObject;

/** Non-exported isolated WebView with synthetic bridge data and packaged assets only. */
public final class DesktopStreamFixtureActivity extends Activity {
 private WebView web;
 private String runId;
 private final AtomicBoolean reported = new AtomicBoolean();
 private final List<String> errors = Collections.synchronizedList(new ArrayList<>());
 private final List<String> missing = Collections.synchronizedList(new ArrayList<>());

 @Override public void onCreate(Bundle saved) {
  super.onCreate(saved);
  runId = getIntent().getStringExtra("runId");
  web = new WebView(this);
  web.getSettings().setJavaScriptEnabled(true);
  web.getSettings().setDomStorageEnabled(true);
  web.getSettings().setAllowFileAccess(false);
  web.getSettings().setAllowContentAccess(false);
  web.addJavascriptInterface(new FixtureBridge(), "EvaHost");
  web.addJavascriptInterface(new ResultsBridge(), "TestHost");
  web.setWebChromeClient(new WebChromeClient() {
   @Override public boolean onConsoleMessage(ConsoleMessage message) {
    if (message.messageLevel() == ConsoleMessage.MessageLevel.ERROR && errors.size() < 100) errors.add(message.message());
    return true;
   }
  });
  web.setWebViewClient(new WebViewClient() {
   @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { return true; }
   @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
    String path = request.getUrl().getPath();
    try {
     if (!"https".equals(request.getUrl().getScheme()) || !"eva-stream-fixture.invalid".equals(request.getUrl().getHost()) || path == null || !path.startsWith("/") || path.contains("\\") || path.contains("\u0000")) throw new IllegalArgumentException("Fixture request rejected");
     for (String part : path.split("/")) if (part.equals(".") || part.equals("..")) throw new IllegalArgumentException("Fixture path rejected");
     String asset = path.substring(1);
     byte[] bytes;
     try (InputStream input = getAssets().open(asset); ByteArrayOutputStream buffer = new ByteArrayOutputStream()) {
      byte[] chunk = new byte[16384]; int length;
      while ((length = input.read(chunk)) != -1) buffer.write(chunk, 0, length);
      bytes = buffer.toByteArray();
     }
     if (asset.equals("index.html")) {
      String html = new String(bytes, StandardCharsets.UTF_8);
      String entry = "<script src=\"app.js\">";
      if (!html.contains(entry)) throw new IllegalStateException("Fixture entry not found");
      String check=getIntent().getBooleanExtra("storageBenchmark",false)?"storage-performance-check.js":"desktop-stream-check.js";
      html = html.replace(entry, "<script src=\""+check+"\"></script>" + entry);
      bytes = html.getBytes(StandardCharsets.UTF_8);
     }
     return new WebResourceResponse(mime(asset), mime(asset).startsWith("font/") ? null : "UTF-8", 200, "OK", Collections.singletonMap("Cache-Control", "no-store"), new ByteArrayInputStream(bytes));
    } catch (Exception error) {
     if (missing.size() < 100) missing.add(request.getUrl().toString());
     return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
    }
   }
  });
  setContentView(web);
  web.loadUrl("https://eva-stream-fixture.invalid/index.html");
 }
 private static String mime(String name) {
  if (name.endsWith(".js") || name.endsWith(".mjs")) return "text/javascript";
  if (name.endsWith(".css")) return "text/css";
  if (name.endsWith(".woff2")) return "font/woff2";
  if (name.endsWith(".woff")) return "font/woff";
  if (name.endsWith(".ttf")) return "font/ttf";
  if (name.endsWith(".svg")) return "image/svg+xml";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".json")) return "application/json";
  return "text/html";
 }
 private String fixtureData() {
  try {
   JSONArray turns = new JSONArray();
   for (int i = 0; i < 24; i++) {
    JSONArray items = new JSONArray();
    items.put(new JSONObject().put("id", "past-user" + i).put("type", "userMessage").put("content", new JSONArray().put(new JSONObject().put("type", "text").put("text", "历史问题" + i))));
    StringBuilder text = new StringBuilder("历史回答 "); for (int n = 0; n < 30; n++) text.append("用于检查阅读时的滚动位置。");
    items.put(new JSONObject().put("id", "past-agent" + i).put("type", "agentMessage").put("phase", "final_answer").put("text", text.toString()));
    turns.put(new JSONObject().put("id", "past" + i).put("status", "completed").put("items", items));
   }
   JSONObject chat = new JSONObject().put("id", "fixture").put("title", "Isolated stream fixture").put("providerId", "fixture").put("model", "fixture").put("messages", new JSONArray()).put("kernelThread", new JSONObject().put("id", "fixture-thread").put("turns", turns));
   return new JSONObject().put("projects", new JSONArray()).put("drafts", new JSONArray()).put("chats", new JSONArray().put(chat)).put("active", "fixture").toString();
  } catch (Exception error) { throw new IllegalStateException(error); }
 }
 public final class FixtureBridge {
  @JavascriptInterface public String load() { return fixtureData(); }
  @JavascriptInterface public boolean save(String ignored) { return true; }
  @JavascriptInterface public void saveLater(String ignored) { }
  @JavascriptInterface public String settings() { return "{}"; }
  @JavascriptInterface public String providers() { return "{\"providers\":[{\"id\":\"fixture\",\"name\":\"fixture\",\"model\":\"fixture\"}],\"active\":\"fixture\"}"; }
  @JavascriptInterface public String tasks() { return "[]"; }
  @JavascriptInterface public String kernelDrain() { return "[]"; }
  @JavascriptInterface public String pendingQuestions() { return "[]"; }
  @JavascriptInterface public boolean supportsHistoryActivity() { return false; }
  @JavascriptInterface public void kernelCall(String ticket, String method, String ignored) {
   // Synthetic read-only acknowledgements. No KernelHost instance is constructed.
   JSONObject result = new JSONObject();
   try {
    if (method.equals("skills/list")) result.put("data", new JSONArray());
    if (method.equals("plugin/installed")) result.put("marketplaces", new JSONArray());
    final String event = new JSONObject().put("ticket", ticket).put("result", result).toString();
    runOnUiThread(() -> { if (web != null) web.evaluateJavascript("if(typeof kernelEvent==='function')kernelEvent(" + event + ")", null); });
   } catch (Exception error) { errors.add(error.toString()); }
  }
 }
 public final class ResultsBridge {
  @JavascriptInterface public void done(String raw) {
   if (!reported.compareAndSet(false, true)) return;
   try {
    JSONObject report = new JSONObject(raw);
    report.put("consoleErrors", new JSONArray(errors.toArray())).put("missingAssets", new JSONArray(missing.toArray()));
    if (!errors.isEmpty() || !missing.isEmpty()) report.put("passed", false);
    report.put("runId", runId);
    if (runId != null && runId.equals(getSharedPreferences("eva-stream-check", 0).getString("runId", ""))) getSharedPreferences("eva-stream-check", 0).edit().putString("result", report.toString()).commit();
   } catch (Exception error) {
    getSharedPreferences("eva-stream-check", 0).edit().putString("result", "{\"passed\":false,\"error\":\"Invalid fixture report\"}").commit();
   }
   runOnUiThread(() -> finish());
  }
 }
 @Override protected void onDestroy() {
  if (web != null) { web.stopLoading(); web.removeJavascriptInterface("EvaHost"); web.removeJavascriptInterface("TestHost"); web.destroy(); web = null; }
  android.webkit.WebStorage.getInstance().deleteOrigin("https://eva-stream-fixture.invalid");
  super.onDestroy();
 }
}
