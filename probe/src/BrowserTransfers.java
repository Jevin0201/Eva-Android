package ai.eva.android.probe;
import android.app.*;import android.content.*;import android.net.Uri;import android.os.*;import android.webkit.*;import android.widget.*;import java.io.*;import java.net.*;import java.nio.file.*;import java.util.*;import java.util.concurrent.*;

/** User-selected uploads and bounded HTTPS downloads, without a JavaScript bridge. */
final class BrowserTransfers {
 static final int PICK_FILE=708;
 static final ExecutorService downloads=Executors.newFixedThreadPool(2);
 static final Map<ShellActivity,BrowserTransfers> pickers=new WeakHashMap<>();
 static final long MAX_BYTES=256L*1024*1024;
 final BrowserWindow window;final ArrayList<Transfer> items=new ArrayList<>();
 AlertDialog uploadPrompt,downloadPrompt,records;ValueCallback<Uri[]> upload;String uploadOrigin;boolean uploadMultiple;
 BrowserTransfers(BrowserWindow window){this.window=window;}
 static String origin(String value)throws IOException{try{URI u=new URI(value);if(!"https".equalsIgnoreCase(u.getScheme())||u.getHost()==null||u.getUserInfo()!=null)throw new Exception();return "https://"+u.getHost().toLowerCase(Locale.ROOT)+(u.getPort()!=-1&&u.getPort()!=443?":"+u.getPort():"");}catch(Exception e){throw new IOException("只支持安全的 HTTPS 来源");}}
 static String safeName(String value){String name=value==null?"download":value.replaceAll("[\\\\/\\p{Cntrl}]","_").replaceAll("^\\.+","");if(name.trim().isEmpty())name="download";return name.length()>120?name.substring(name.length()-120):name;}
 boolean choose(ValueCallback<Uri[]> callback,WebChromeClient.FileChooserParams params){
  cancelUpload();if(window.minimized){callback.onReceiveValue(null);window.status("请展开浏览器后重新选择上传文件");return true;}
  try{uploadOrigin=origin(window.browser.getUrl());}catch(Exception e){callback.onReceiveValue(null);window.status(e.getMessage());return true;}
  if(params.getMode()!=WebChromeClient.FileChooserParams.MODE_OPEN&&params.getMode()!=WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE){callback.onReceiveValue(null);window.status("此文件选择方式尚不支持");return true;}
  upload=callback;uploadMultiple=params.getMode()==WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE;
  uploadPrompt=new AlertDialog.Builder(window.getContext()).setTitle("选择上传文件").setMessage("当前网页："+uploadOrigin+"\n系统选择器中选中的文件将交给发起上传的网页。").setNegativeButton("取消",(d,n)->cancelUpload()).setOnCancelListener(d->cancelUpload()).setPositiveButton("选择文件",(d,n)->{
   if(upload==null)return;
   try{Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);ArrayList<String> types=new ArrayList<>();for(String type:params.getAcceptTypes())if(type!=null&&type.matches("[a-zA-Z0-9.+*-]+/[a-zA-Z0-9.+*-]+"))types.add(type);if(types.size()==1)intent.setType(types.get(0));else if(!types.isEmpty())intent.putExtra(Intent.EXTRA_MIME_TYPES,types.toArray(new String[0]));intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,uploadMultiple);pickers.put(window.host,this);window.host.startActivityForResult(intent,PICK_FILE);}catch(Exception e){cancelUpload();window.status("无法打开文件选择器："+e.getMessage());}
  }).show();return true;
 }
 static boolean onActivityResult(ShellActivity host,int request,int result,Intent data){if(request!=PICK_FILE)return false;BrowserTransfers owner=pickers.remove(host);if(owner!=null)owner.finishUpload(result,data);return true;}
 void finishUpload(int result,Intent data){
  ValueCallback<Uri[]> callback=upload;upload=null;if(callback==null)return;Uri[] selected=null;
  try{if(result==Activity.RESULT_OK&&data!=null&&window.browser!=null&&uploadOrigin.equals(origin(window.browser.getUrl()))){ArrayList<Uri> uris=new ArrayList<>();if(data.getClipData()!=null){if(data.getClipData().getItemCount()>10)throw new IOException("每次最多选择 10 个文件");for(int i=0;i<data.getClipData().getItemCount()&&i<10;i++)uris.add(data.getClipData().getItemAt(i).getUri());}else if(data.getData()!=null)uris.add(data.getData());if(!uploadMultiple&&uris.size()>1)throw new IOException("本次只能选择一个文件");for(Uri uri:uris){if(!"content".equals(uri.getScheme()))throw new IOException("无效文件来源");}if(!uris.isEmpty())selected=uris.toArray(new Uri[0]);}}
  catch(Exception e){window.status("上传文件选择失败："+e.getMessage());}finally{callback.onReceiveValue(selected);}
 }
 void cancelUpload(){if(uploadPrompt!=null){uploadPrompt.dismiss();uploadPrompt=null;}pickers.remove(window.host);if(upload!=null){ValueCallback<Uri[]> old=upload;upload=null;old.onReceiveValue(null);}}
 void pageChanged(){cancelUpload();} void hidePrompts(){cancelUpload();if(downloadPrompt!=null){downloadPrompt.dismiss();downloadPrompt=null;}if(records!=null){records.dismiss();records=null;}}
 void offer(String url,String userAgent,String disposition,String mime,long size){
  try{String source=origin(url),page=origin(window.browser.getUrl()),name=safeName(URLUtil.guessFileName(url,disposition,mime));Transfer item=new Transfer(url,userAgent,source,page,name,size);items.add(0,item);while(items.size()>30&&items.get(items.size()-1).terminal())items.remove(items.size()-1);if(window.minimized){window.status("有待确认下载，请展开浏览器后打开“下载记录”");return;}confirm(item);}catch(Exception e){window.status("无法下载："+e.getMessage());}
 }
 void confirm(Transfer item){if(!"pending".equals(item.state))return;downloadPrompt=new AlertDialog.Builder(window.getContext()).setTitle("下载到工作区").setMessage("文件："+item.name+"\n来源："+item.source+"\n保存到：工作区 / downloads\n单个文件上限 256 MB；关闭浏览器会取消未完成下载。").setNegativeButton("取消",(d,n)->{item.cancel();status();}).setOnCancelListener(d->{item.cancel();status();}).setPositiveButton("下载",(d,n)->start(item)).show();}
 void start(Transfer item){if(!"pending".equals(item.state))return;item.state="downloading";status();downloads.execute(()->{try{download(item);}catch(Exception e){item.state=item.cancelled?"cancelled":"failed";item.error=item.cancelled?"已取消":String.valueOf(e.getMessage());}finally{if(item.connection!=null)item.connection.disconnect();if(item.partial!=null&&item.partial.exists())item.partial.delete();window.runOnUiThread(this::status);}});}
 void download(Transfer item)throws Exception{
  File directory=WorkspaceFiles.resolve(window.host,"downloads/"+UUID.randomUUID());if(!directory.mkdirs())throw new IOException("无法创建下载目录");item.partial=new File(directory,item.name+".part");File destination=new File(directory,item.name);String next=item.url;
  try{
   for(int redirect=0;redirect<=5;redirect++){
    if(item.cancelled)throw new IOException("已取消");origin(next);HttpURLConnection c=(HttpURLConnection)new URL(next).openConnection();item.connection=c;c.setInstanceFollowRedirects(false);c.setConnectTimeout(15000);c.setReadTimeout(15000);c.setRequestProperty("Accept-Encoding","identity");if(item.userAgent!=null)c.setRequestProperty("User-Agent",item.userAgent);c.setRequestProperty("Referer",item.page+"/");String cookies=android.webkit.CookieManager.getInstance().getCookie(next);if(cookies!=null&&!cookies.isEmpty())c.setRequestProperty("Cookie",cookies);
    int code=c.getResponseCode();if(code==301||code==302||code==303||code==307||code==308){String location=c.getHeaderField("Location");if(location==null)throw new IOException("重定向缺少地址");next=new URL(new URL(next),location).toString();origin(next);c.disconnect();if(redirect==5)throw new IOException("重定向次数过多");continue;}if(code<200||code>=300)throw new IOException("下载返回 HTTP "+code);
    item.total=c.getContentLengthLong();if(item.total>MAX_BYTES)throw new IOException("文件超过 256 MB 上限");long shown=0;
    try(InputStream in=c.getInputStream();OutputStream out=new FileOutputStream(item.partial)){byte[] buffer=new byte[32768];int n;while((n=in.read(buffer))!=-1){if(item.cancelled)throw new IOException("已取消");item.received+=n;if(item.received>MAX_BYTES)throw new IOException("文件超过 256 MB 上限");out.write(buffer,0,n);long now=SystemClock.elapsedRealtime();if(now-shown>250){shown=now;window.runOnUiThread(this::status);}}}
    if(item.cancelled)throw new IOException("已取消");if(item.total>=0&&item.received!=item.total)throw new IOException("下载长度不完整");Files.move(item.partial.toPath(),destination.toPath());item.path="/root/eva-workspace/"+WorkspaceFiles.root(window.host).toPath().relativize(destination.toPath()).toString().replace('\\','/');item.state="completed";return;
   }
  }finally{if(!"completed".equals(item.state)){if(item.partial!=null)item.partial.delete();directory.delete();}}
 }
 void status(){if(window.browser==null)return;for(Transfer item:items)if(item.state.equals("downloading")){window.status("下载中："+item.name+" · "+item.received/1024+" KB"+(item.total>0?" / "+item.total/1024+" KB":"")+" · 浏览器菜单可取消");return;}if(!items.isEmpty()){Transfer item=items.get(0);window.status(item.state.equals("completed")?"已下载到工作区："+item.path:item.state.equals("failed")?"下载失败："+item.error:item.state.equals("cancelled")?"下载已取消": "有待确认下载，打开下载记录继续");}}
 void show(){LinearLayout list=new LinearLayout(window.getContext());list.setOrientation(1);int padding=window.dp(16);list.setPadding(padding,padding,padding,padding);ScrollView scroll=new ScrollView(window.getContext());scroll.addView(list);AlertDialog dialog=new AlertDialog.Builder(window.getContext()).setTitle("下载记录").setView(scroll).setNegativeButton("关闭",null).create();
  records=dialog;Runnable refresh=new Runnable(){public void run(){if(!dialog.isShowing())return;list.removeAllViews();if(items.isEmpty())list.addView(window.label("尚无下载记录",14));for(Transfer item:items){TextView text=window.label(item.name+"\n来源："+item.source+"\n"+item.label(),13);text.setTextIsSelectable(true);list.addView(text);if(item.state.equals("pending")||item.state.equals("downloading")){Button button=new Button(window.getContext());button.setText(item.state.equals("pending")?"确认下载":"取消下载");button.setOnClickListener(v->{if(item.state.equals("pending")){dialog.dismiss();confirm(item);}else{item.cancel();status();}});list.addView(button);}}list.postDelayed(this,500);}};dialog.setOnShowListener(d->refresh.run());dialog.show();}
 void close(){hidePrompts();for(Transfer item:items)if(!item.terminal())item.cancel();}
 static final class Transfer {
  final String url,userAgent,source,page,name;volatile String state="pending",error="",path="";volatile long total,received;volatile boolean cancelled;volatile HttpURLConnection connection;File partial;
  Transfer(String url,String userAgent,String source,String page,String name,long total){this.url=url;this.userAgent=userAgent;this.source=source;this.page=page;this.name=name;this.total=total;}
  boolean terminal(){return state.equals("completed")||state.equals("failed")||state.equals("cancelled");}
  void cancel(){cancelled=true;if(state.equals("pending"))state="cancelled";HttpURLConnection c=connection;if(c!=null)c.disconnect();}
  String label(){if(state.equals("completed"))return "已完成 · "+received+" 字节\n"+path;if(state.equals("failed"))return "失败："+error;if(cancelled||state.equals("cancelled"))return "已取消";if(state.equals("pending"))return "等待确认";return "下载中 · "+received/1024+" KB"+(total>0?" / "+total/1024+" KB":"");}
 }
}
