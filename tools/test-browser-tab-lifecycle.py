"""Run production tab create/activate/close branches with minimal Android API fakes.

This verifies lifecycle/state ownership, not WebView rendering or touch geometry.
"""
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[1]
out = root / 'artifacts/performance-20261113/browser-tab-lifecycle'
out.mkdir(parents=True, exist_ok=True)
source = (root / 'probe/src/DesktopBrowserHost.java').read_text(encoding='utf-8')


def method(signature):
    start = source.index(signature)
    body = source.index('{', start)
    depth, end = 1, body + 1
    while depth:
        if source[end] == '{':
            depth += 1
        elif source[end] == '}':
            depth -= 1
        end += 1
    return source[start:end]


# Use the complete production branch tail, including response serialization.
host = method('JSONObject host(')
host = ('JSONObject host(JSONObject a)throws Exception{BrowserWindow b=BrowserWindow.live;'
        'String action=a.optString("action","state"),id=a.optString("id");'
        + host[host.index('if(action.equals("create"))'):])
fixture = r'''
import java.io.*;import java.util.*;
public class TabLifecycleCheck {
 static class android {static class view {static class ViewGroup {
  void removeView(WebView v){v.parent=null;v.detach++;}
 }}}
 static class JSONObject extends LinkedHashMap<String,Object> {
  public JSONObject put(String k,Object v){super.put(k,v);return this;}
  String optString(String k){return optString(k,"");}
  String optString(String k,String d){return containsKey(k)?String.valueOf(get(k)):d;}
 }
 static class JSONArray extends ArrayList<Object>{JSONArray put(Object v){add(v);return this;}}
 static class WebView {
  String url="",title="",input="typed text";int destroyed,detach,loads;
  android.view.ViewGroup parent=new android.view.ViewGroup();
  Object getParent(){return parent;}void destroy(){destroyed++;}
  void loadUrl(String s){url=s;loads++;}String getUrl(){return url;}String getTitle(){return title;}
 }
 static class BrowserTransfers {int closes;void close(){closes++;}}
 static class BrowserSitePermissions {int cancels;void cancel(){cancels++;}}
 static class BrowserWindow {
  static BrowserWindow live;TabLifecycleCheck owner;WebView browser;
  BrowserTransfers transfers;BrowserSitePermissions sitePermissions;
  boolean deferInitialNavigation,sawDeferred,finished,failBrowse;
  int browses,refreshes;Set<WebView> forgotten=new HashSet<>();
  BrowserWindow(TabLifecycleCheck h){owner=h;live=this;}
  void browse() throws Exception {
   browses++;sawDeferred=deferInitialNavigation;
   if(failBrowse)throw new IOException("injected creation failure");
   if(browser==null){browser=new WebView();transfers=new BrowserTransfers();sitePermissions=new BrowserSitePermissions();owner.register(browser,this);}
  }
  void forgetMode(WebView v){forgotten.add(v);}void finish(){finished=true;}
  void refreshTabs(){refreshes++;}void windowMode(boolean a,boolean b){}
 }
 final LinkedHashMap<String,WebView> tabs=new LinkedHashMap<>();
 final Map<WebView,BrowserTransfers> transfers=new HashMap<>();
 final Map<WebView,BrowserSitePermissions> permissions=new HashMap<>();String active="";
 void register(WebView v,BrowserWindow b){if(tabs.containsValue(v))return;active="tab"+(tabs.size()+1);tabs.put(active,v);transfers.put(v,b.transfers);permissions.put(v,b.sitePermissions);}
 void seed(String id,WebView v){tabs.put(id,v);transfers.put(v,new BrowserTransfers());permissions.put(v,new BrowserSitePermissions());}
 JSONObject action(String kind,String id)throws Exception{return host(new JSONObject().put("action",kind).put("id",id));}
 static void check(boolean condition,String msg){if(!condition)throw new AssertionError(msg);}
 public static void main(String[] args)throws Exception{
  TabLifecycleCheck h=new TabLifecycleCheck();BrowserWindow b=new BrowserWindow(h);
  WebView a=new WebView(),c=new WebView(),d=new WebView();h.seed("a",a);h.seed("c",c);h.seed("d",d);
  h.action("activate","c");int count=b.browses;
  BrowserTransfers ta=h.transfers.get(a);
  h.action("close","a");
  check(h.active.equals("c")&&b.browser==c&&b.browses==count,"background close preserves selected WebView without rebuilding it");
  check(a.destroyed==1&&a.detach==1&&ta.closes==1&&b.forgotten.contains(a),"close releases selected resources");
  check(c.input.equals("typed text")&&c.destroyed==0,"background close preserves input and selected view");
  h.action("close","c");
  check(h.active.equals("d")&&b.browser==d&&b.transfers==h.transfers.get(d)&&b.sitePermissions==h.permissions.get(d),"active close binds remaining tab resources");
  JSONObject result=h.action("close","d");
  check(h.tabs.isEmpty()&&h.active.isEmpty()&&b.browser==null&&b.finished,"last close dismisses browser without replacement tab");
  check(((JSONArray)result.get("tabs")).isEmpty(),"last close response is empty");
  try{h.action("close","missing");throw new AssertionError("missing tab accepted");}catch(IOException expected){}
  h=new TabLifecycleCheck();b=new BrowserWindow(h);b.browse();WebView first=b.browser;
  WebView second=h.createTab(b,true);
  check(h.tabs.size()==2&&b.sawDeferred&&!b.deferInitialNavigation,"create defers initial navigation and registers once");
  check(second.loads==1&&second.url.startsWith("about:blank#eva-")&&first.detach==1,"new blank tab loads once and detaches prior view");
  WebView popup=h.createTab(b,false);
  check(h.tabs.size()==3&&popup.loads==0&&second.detach==1,"popup creation leaves navigation to WebViewTransport");
  h.action("activate",h.tabs.keySet().iterator().next());
  check(b.browser==first&&first.input.equals("typed text")&&first.loads==0,"switch reuses original view and document state");
  b.failBrowse=true;try{h.createTab(b,true);throw new AssertionError("failure not raised");}catch(IOException expected){}
  check(!b.deferInitialNavigation,"navigation deferral is reset after failure");
  System.out.println("PASS background/current/last tab close; resource ownership; blank/popup creation; tab switch state; failed-create deferral cleanup");
 }
'''
fixture += '\n' + method('WebView createTab(') + '\n' + host + '\n}'
java_file = out / 'TabLifecycleCheck.java'
java_file.write_text(fixture, encoding='utf-8')
subprocess.run(['javac', '-encoding', 'UTF-8', '-d', str(out), str(java_file)], check=True, cwd=root)
result = subprocess.run(['java', '-cp', str(out), 'TabLifecycleCheck'], check=True, cwd=root, text=True, capture_output=True)
print(result.stdout, end='')
(out / 'result.txt').write_text(result.stdout, encoding='utf-8')
