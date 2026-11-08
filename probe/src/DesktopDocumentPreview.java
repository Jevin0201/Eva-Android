package ai.eva.android.probe;

import android.net.Uri;
import android.os.Bundle;
import android.webkit.*;
import android.widget.LinearLayout;
import java.io.*;
import java.util.*;

/** Desktop readers in an isolated WebView: no native JavaScript bridge. */
final class DesktopDocumentPreview {
 private final WorkspacePreviewActivity host;
 private final File source;
 private WebView web;
 static boolean supports(File file){return Arrays.asList("pdf","docx","xlsx","pptx","csv","tsv","md","markdown","html","htm","mp3","wav","ogg","m4a","aac","flac","mp4","webm","mkv","mov","m4v","3gp","oga","opus").contains(DocumentPreview.ext(file));}
 DesktopDocumentPreview(WorkspacePreviewActivity host,File source,Bundle state){
  this(host,source,state,null);
 }
 DesktopDocumentPreview(WorkspacePreviewActivity host,File source,Bundle state,org.json.JSONArray sheetNames){
  this.host=host;this.source=source;host.clear();web=new WebView(host);
  WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setDomStorageEnabled(false);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
  web.setWebChromeClient(new WebChromeClient(){
   public void onShowCustomView(android.view.View view,CustomViewCallback callback){host.showMediaFullscreen(view,callback);}
   public void onHideCustomView(){host.hideMediaFullscreen();}
  });
  web.setWebViewClient(new WebViewClient(){
   public void onPageFinished(WebView view,String url){
    // Read-only provenance for diagnostics. This is a constant JS value, never a native bridge.
    String value=sourceInfo().toString().replace("<","\\u003c").replace("\u2028","\\u2028").replace("\u2029","\\u2029");
    view.evaluateJavascript("Object.defineProperty(window,'evaPreviewSourceInfo',{configurable:true,value:()=>Object.freeze("+value+")})",null);
   }
   public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return true;}
   public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){return resource(request);}
   public boolean onRenderProcessGone(WebView view,RenderProcessGoneDetail detail){host.hideMediaFullscreen();host.body.removeView(view);view.destroy();web=null;host.body.addView(host.label("预览进程退出，请返回重试。",14));return true;}
  });
  host.body.addView(web,new LinearLayout.LayoutParams(-1,0,1));
  web.loadUrl(readerUrl(source,sheetNames));
 }
 static String readerUrl(File source,org.json.JSONArray sheetNames){String url="https://reader.eva.invalid/desktop-reader/index.html?name="+Uri.encode(source.getName());return sheetNames==null?url:url+"&sheetNames="+Uri.encode(sheetNames.toString());}
 private WebResourceResponse resource(WebResourceRequest request){try{
  Uri uri=request.getUrl();if(!"https".equals(uri.getScheme())||!"reader.eva.invalid".equals(uri.getHost())||uri.getPort()!=-1||!"GET".equals(request.getMethod()))return blocked();
  String path=uri.getPath();InputStream input;String mime;
  if("/document".equals(path)){
   File checked=source.getCanonicalFile();if(!checked.toPath().startsWith(WorkspaceFiles.root(host).getCanonicalFile().toPath())||!checked.equals(source)||!checked.isFile()||(!Arrays.asList("audio","video").contains(DocumentPreview.kind(source))&&checked.length()>32L*1024*1024))return blocked();
   validateOffice(checked);
   android.os.ParcelFileDescriptor fd=android.os.ParcelFileDescriptor.open(checked,android.os.ParcelFileDescriptor.MODE_READ_ONLY);
   try{File opened=new File(android.system.Os.readlink("/proc/self/fd/"+fd.getFd())).getCanonicalFile();if(!opened.equals(checked))throw new IOException("文件已移动");input=new android.os.ParcelFileDescriptor.AutoCloseInputStream(fd);}catch(Exception e){fd.close();throw e;}mime=DocumentPreview.mime(source);
  }else if("/resource".equals(path)){
   String local=uri.getQueryParameter("path");if(local==null||!local.startsWith("/local/"))return blocked();
   File root=source.getParentFile().getCanonicalFile(),file=new File(root,local.substring(7)).getCanonicalFile();
   if(!file.toPath().startsWith(root.toPath())||!file.isFile()||file.length()>5L*1024*1024)return blocked();
   input=new FileInputStream(file);mime=DocumentPreview.mime(file);
  }else{
   if(path==null||!path.startsWith("/desktop-reader/")||path.contains("..")||path.contains("\\"))return blocked();
   input=host.getAssets().open(path.substring(1));mime=path.endsWith(".js")||path.endsWith(".mjs")?"text/javascript":path.endsWith(".css")?"text/css":path.endsWith(".html")?"text/html":"application/octet-stream";
  }
  Map<String,String> headers=new HashMap<>();
  if("/document".equals(path)&&Arrays.asList("audio","video").contains(DocumentPreview.kind(source))){
   long size=source.length(),start=0,end=size-1;String range=request.getRequestHeaders().get("Range");if(range==null)range=request.getRequestHeaders().get("range");
   if(range!=null){try{if(!range.matches("bytes=\\d+-\\d*"))throw new IOException();String[] parts=range.substring(6).split("-",-1);start=Long.parseLong(parts[0]);if(!parts[1].isEmpty())end=Math.min(end,Long.parseLong(parts[1]));if(start>end||start>=size)throw new IOException();}catch(Exception e){input.close();return blocked();}}
   long remaining=start;while(remaining>0){long skipped=input.skip(remaining);if(skipped<=0){input.close();return blocked();}remaining-=skipped;}
   final long length=end-start+1;input=new FilterInputStream(input){long left=length;public int read()throws IOException{if(left<=0)return -1;int value=super.read();if(value>=0)left--;return value;}public int read(byte[] bytes,int offset,int count)throws IOException{if(left<=0)return -1;int n=super.read(bytes,offset,(int)Math.min(count,left));if(n>0)left-=n;return n;}};
   headers.put("Accept-Ranges","bytes");headers.put("Content-Length",String.valueOf(length));if(range!=null){headers.put("Content-Range","bytes "+start+"-"+end+"/"+size);return new WebResourceResponse(mime,null,206,"Partial Content",headers,input);}
  }
  headers.put("Cache-Control","no-store");headers.put("X-Content-Type-Options","nosniff");return new WebResourceResponse(mime,mime.startsWith("text/")?"UTF-8":null,200,"OK",headers,input);
 }catch(Exception error){return blocked();}}
 private static void validateOffice(File file)throws IOException{
  if(!Arrays.asList("docx","xlsx","pptx").contains(DocumentPreview.ext(file)))return;
  try(java.util.zip.ZipFile zip=new java.util.zip.ZipFile(file)){
   if(zip.size()>10000)throw new IOException("Office 压缩条目过多");long total=0;Set<String> names=new HashSet<>();byte[] buffer=new byte[32768];
   java.util.Enumeration<? extends java.util.zip.ZipEntry> entries=zip.entries();while(entries.hasMoreElements()){
    java.util.zip.ZipEntry entry=entries.nextElement();String name=entry.getName();if(name.startsWith("/")||name.contains("\\")||Arrays.asList(name.split("/")).contains("..")||!names.add(name))throw new IOException("Office 压缩路径无效");if(entry.isDirectory())continue;
    long size=0;try(InputStream in=zip.getInputStream(entry)){int n;while((n=in.read(buffer))!=-1){size+=n;total+=n;if(total>128L*1024*1024||size>entry.getSize())throw new IOException("Office 解压内容超过限制");}}if(size!=entry.getSize())throw new IOException("Office 压缩条目大小不符");
   }
  }
 }
 private static WebResourceResponse blocked(){return new WebResourceResponse("text/plain","UTF-8",403,"Blocked",Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));}
 void pause(){if(web!=null){web.evaluateJavascript("dispatchEvent(new Event('eva-preview-pause'))",null);web.onPause();}}
 void resume(){if(web!=null)web.onResume();}
 File displayedSource(){return source;}
 void readSelection(ValueCallback<String> callback){if(web==null){callback.onReceiveValue("null");return;}web.evaluateJavascript("typeof window.evaReaderSelection==='function'?window.evaReaderSelection():null",callback);}
 org.json.JSONObject sourceInfo(){
  org.json.JSONObject info=new org.json.JSONObject();
  try{File root=WorkspaceFiles.root(host),actual=source.getCanonicalFile();boolean original=host.source!=null&&actual.equals(host.source.getCanonicalFile());
   info.put("name",source.getName()).put("extension",DocumentPreview.ext(source)).put("workspaceRelativePath",root.toPath().relativize(actual.toPath()).toString().replace('\\','/'))
    .put("readerUrl",readerUrl(source,null)).put("sourceMatchesHost",original).put("derivative",!original);
  }catch(Exception error){try{info.put("error","Source metadata unavailable");}catch(org.json.JSONException ignored){}}
  return info;
 }
 void destroy(){if(web!=null){host.body.removeView(web);web.stopLoading();web.destroy();web=null;}}
}
