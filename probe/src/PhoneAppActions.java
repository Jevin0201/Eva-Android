package ai.eva.android.probe;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.IOException;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;

/** Synchronous launcher actions. Caller must guard phone control/lock/generation before invoking. */
final class PhoneAppActions {
 static final int LIMIT=250;
 static final class App {
  final String packageName,label;
  App(String packageName,String label){this.packageName=packageName;this.label=label;}
 }
 // Preserve punctuation and word boundaries: normalization must not guess another application.
 static String normalize(String value){
  String source=Normalizer.normalize(value==null?"":value,Normalizer.Form.NFKC);StringBuilder result=new StringBuilder();boolean space=false;
  for(int i=0;i<source.length();){int cp=source.codePointAt(i);i+=Character.charCount(cp);
   if(Character.isWhitespace(cp)||Character.isSpaceChar(cp)){space=result.length()>0;continue;}
   if(space)result.append(' ');result.appendCodePoint(cp);space=false;
  }
  return result.toString().toLowerCase(Locale.ROOT);
 }
 static List<App> installed(Context context){
  PackageManager manager=context.getPackageManager();
  List<App> apps=new ArrayList<>();
  for(ResolveInfo info:manager.queryIntentActivities(new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER),0)){
   if(info.activityInfo==null||info.activityInfo.packageName==null)continue;
   CharSequence label=info.loadLabel(manager);
   apps.add(new App(info.activityInfo.packageName,label==null?info.activityInfo.packageName:label.toString()));
  }
  Collections.sort(apps,Comparator.comparing((App a)->normalize(a.label)).thenComparing(a->a.packageName).thenComparing(a->a.label));
  return apps;
 }
 static List<App> filter(List<App> apps,String query,boolean exact){
  String key=normalize(query);LinkedHashMap<String,App> found=new LinkedHashMap<>();
  for(App app:apps){String label=normalize(app.label);
   if(exact?label.equals(key):(key.isEmpty()||label.contains(key)||normalize(app.packageName).contains(key)))found.putIfAbsent(app.packageName,app);
  }
  return new ArrayList<>(found.values());
 }
 static List<App> matches(List<App> apps,String name){
  LinkedHashMap<String,App> exact=new LinkedHashMap<>();
  for(App app:apps)if(app.label.equals(name))exact.putIfAbsent(app.packageName,app);
  return exact.isEmpty()?filter(apps,name,true):new ArrayList<>(exact.values());
 }
 static JSONArray json(List<App> apps)throws Exception{
  JSONArray result=new JSONArray();for(App app:apps){if(result.length()>=LIMIT)break;result.put(new JSONObject().put("package",app.packageName).put("label",app.label));}return result;
 }
 static JSONObject apps(Context context,JSONObject args)throws Exception{
  List<App> found=filter(installed(context),args.optString("query",""),false);
  return new JSONObject().put("apps",json(found)).put("total",found.size()).put("truncated",found.size()>LIMIT);
 }
 /** Call on the existing guarded main-thread action path. Does not wait for UI or clear snapshots. */
 static JSONObject openApp(Context context,JSONObject args)throws Exception{
  String packageName=args.optString("package","").trim();
  if(packageName.isEmpty()){
   String name=args.optString("app","");
   if(normalize(name).isEmpty())throw new IOException("open_app 需要 package 或 app 应用名称");
   List<App> installed=installed(context),matches=matches(installed,name);
   if(matches.size()!=1){
    List<App> candidates=matches.isEmpty()?filter(installed,name,false):matches;
    return new JSONObject().put("dispatched",false).put("actionExecuted",false)
     .put("actionError",matches.isEmpty()?"没有精确匹配的应用名称":"应用名称不唯一")
     .put("candidates",json(candidates)).put("total",candidates.size()).put("truncated",candidates.size()>LIMIT)
     .put("instruction","请根据候选 package 确认目标后调用 open_app；没有候选时使用 apps 的 query 查询。未启动任何应用。");
   }
   packageName=matches.get(0).packageName;
  }
  Intent intent=context.getPackageManager().getLaunchIntentForPackage(packageName);
  if(intent==null)throw new IOException("找不到可启动的 App，请先 apps 查询");
  intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
  if(PhoneAgentDisplay.active!=null){
   PhoneAgentDisplay.active.launching();
   android.app.ActivityOptions options=android.app.ActivityOptions.makeBasic();options.setLaunchDisplayId(PhoneAgentDisplay.displayId());
   context.startActivity(intent,options.toBundle());
  }else context.startActivity(intent);
  return new JSONObject().put("dispatched",true).put("package",packageName)
   .put("instruction","observe 验证前台页面；应用启动不代表任务完成");
 }
}
