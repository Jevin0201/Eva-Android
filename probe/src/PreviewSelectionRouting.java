package ai.eva.android.probe;
import android.content.Intent;import android.webkit.WebView;import android.widget.Toast;import org.json.*;
/** Receives an explicit document-selection action; never sends a model turn. */
final class PreviewSelectionRouting {
 static boolean consume(ShellActivity host,WebView web,Intent intent){
  if(!"preview-selection".equals(intent.getStringExtra("page")))return false;
  String raw=intent.getStringExtra("preview-selection");
  try{
   if(raw==null||raw.length()>96000)throw new Exception("选区信息无效");
   JSONObject value=new JSONObject(raw);String path=value.getString("path");
   if(path.startsWith("/")||!WorkspaceFiles.resolve(host,path).isFile())throw new Exception("选区文件不存在");
   web.evaluateJavascript("(()=>{try{return !!(window.evaPreviewSelection&&evaPreviewSelection.receive("+value.toString()+"))}catch(e){return false}})()",reply->{
    if("true".equals(reply)){intent.removeExtra("page");intent.removeExtra("preview-selection");}
    else Toast.makeText(host,"选区未能加入草稿，请返回文档后重试",Toast.LENGTH_LONG).show();
   });
  }catch(Exception error){Toast.makeText(host,"无法接收文档选区："+error.getMessage(),Toast.LENGTH_LONG).show();intent.removeExtra("page");intent.removeExtra("preview-selection");}
  return true;
 }
}
