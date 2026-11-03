package ai.eva.android.probe;
import android.Manifest;import android.app.*;import android.content.*;import android.content.pm.PackageManager;import android.webkit.PermissionRequest;import java.util.*;

/** Separate per-HTTPS-origin consent and Android runtime permission checks. */
final class BrowserSitePermissions {
 static final int REQUEST_MEDIA=709;
 static final Map<ShellActivity,BrowserSitePermissions> requests=new WeakHashMap<>();
 final BrowserWindow window;AlertDialog prompt;PermissionRequest pending;String site;String[] resources;boolean remember;
 BrowserSitePermissions(BrowserWindow window){this.window=window;}
 SharedPreferences prefs(){return window.getSharedPreferences("eva-browser-sites",0);}
 static String androidPermission(String resource){if(PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource))return Manifest.permission.CAMERA;if(PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource))return Manifest.permission.RECORD_AUDIO;return null;}
 static String resourceLabel(String resource){return PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)?"摄像头":PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)?"麦克风":"不支持的权限";}
 void request(PermissionRequest request){window.runOnUiThread(()->{
  cancel();if(window.minimized||window.browser==null){request.deny();window.status("网站请求权限；请展开浏览器后重新操作");return;}
  try{site=BrowserTransfers.origin(request.getOrigin().toString());resources=request.getResources();if(resources.length==0)throw new Exception("没有可授权的资源");for(String resource:resources)if(androidPermission(resource)==null)throw new Exception("网站请求了尚不支持的权限");}
  catch(Exception e){request.deny();window.status("网站权限未授予："+e.getMessage());return;}
  pending=request;boolean allAllowed=true;ArrayList<String> labels=new ArrayList<>();for(String resource:resources){String decision=prefs().getString(site+"|"+resource,"");if(decision.equals("deny")){request.deny();pending=null;window.status("该站点权限已拒绝，可在网站权限中修改");return;}if(!decision.equals("allow"))allAllowed=false;labels.add(resourceLabel(resource));}
  if(allAllowed){remember=true;grantAfterSystem();return;}
  prompt=new AlertDialog.Builder(window.getContext()).setTitle("网站权限请求").setMessage("请求站点："+site+"\n使用："+android.text.TextUtils.join("、",labels)+"\n允许站点后仍需 Android 系统授权。").setNegativeButton("拒绝",(d,n)->{store("deny");cancel();}).setNeutralButton("仅本次",(d,n)->{remember=false;grantAfterSystem();}).setPositiveButton("允许此站点",(d,n)->{remember=true;grantAfterSystem();}).setOnCancelListener(d->cancel()).show();
 });}
 void grantAfterSystem(){if(pending==null)return;if(window.minimized||window.browser==null){cancel();return;}ArrayList<String> missing=new ArrayList<>();for(String resource:resources){String permission=androidPermission(resource);if(window.host.checkSelfPermission(permission)!=PackageManager.PERMISSION_GRANTED&&!missing.contains(permission))missing.add(permission);}if(missing.isEmpty()){finishGrant();return;}requests.put(window.host,this);window.host.requestPermissions(missing.toArray(new String[0]),REQUEST_MEDIA);}
 static boolean onRequestPermissionsResult(ShellActivity host,int request,String[] permissions,int[] results){if(request!=REQUEST_MEDIA)return false;BrowserSitePermissions owner=requests.remove(host);if(owner!=null)owner.finishGrant();return true;}
 void finishGrant(){if(pending==null)return;for(String resource:resources)if(window.host.checkSelfPermission(androidPermission(resource))!=PackageManager.PERMISSION_GRANTED){window.status("Android 系统未授予"+resourceLabel(resource));cancel();return;}if(window.minimized||window.browser==null){cancel();return;}PermissionRequest request=pending;if(remember)store("allow");pending=null;request.grant(resources);}
 void store(String value){if(pending==null||site==null||resources==null)return;SharedPreferences.Editor edit=prefs().edit();for(String resource:resources)edit.putString(site+"|"+resource,value);edit.apply();}
 void cancelled(PermissionRequest request){if(request==pending){if(prompt!=null){prompt.dismiss();prompt=null;}pending=null;requests.remove(window.host);}}
 void cancel(){if(prompt!=null){prompt.dismiss();prompt=null;}requests.remove(window.host);if(pending!=null){PermissionRequest old=pending;pending=null;old.deny();}}
 void show(){Map<String,?> values=prefs().getAll();ArrayList<String> keys=new ArrayList<>(values.keySet());Collections.sort(keys);String[] labels=new String[keys.size()];for(int n=0;n<keys.size();n++){String key=keys.get(n);int split=key.lastIndexOf('|');labels[n]=(split<0?key:key.substring(0,split)+" · "+resourceLabel(key.substring(split+1)))+" · "+("allow".equals(values.get(key))?"允许":"拒绝");}if(keys.isEmpty()){new AlertDialog.Builder(window.getContext()).setTitle("网站权限").setMessage("尚未保存站点授权。网站请求摄像头或麦克风时会单独询问。").setPositiveButton("关闭",null).show();return;}new AlertDialog.Builder(window.getContext()).setTitle("网站权限 · 点击重置").setItems(labels,(d,n)->new AlertDialog.Builder(window.getContext()).setTitle("重置站点权限").setMessage(labels[n]+"\n重置后下次请求会重新询问；当前页面将重新加载以结束已有媒体连接。").setNegativeButton("取消",null).setPositiveButton("重置",(dialog,which)->{prefs().edit().remove(keys.get(n)).apply();cancel();if(window.browser!=null)window.browser.reload();}).show()).setNegativeButton("关闭",null).show();}
}
