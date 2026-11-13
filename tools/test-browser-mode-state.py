"""Exercise the production per-tab mode methods against small WebView API fakes."""
from pathlib import Path
import subprocess
root=Path(__file__).resolve().parents[1]
out=root/'artifacts/performance-20261113/browser-mode';out.mkdir(parents=True,exist_ok=True)
source=(root/'probe/src/BrowserWindow.java').read_text(encoding='utf-8')
def method(signature):
 start=source.index(signature);body=source.index('{',start);depth=1;end=body+1
 while depth:
  if source[end]=='{':depth+=1
  elif source[end]=='}':depth-=1
  end+=1
 return source[start:end]
fixture=r'''
import java.io.*;import java.nio.file.*;import java.util.*;
public class ModeCheck {
 static class ScriptHandler {boolean removed;void remove(){removed=true;}}
 static class UserAgentMetadata {
  String identity;UserAgentMetadata(String s){identity=s;}String getFullVersion(){return "130.0.0.0";}
  static class BrandVersion {static class Builder {Builder setBrand(String s){return this;}Builder setMajorVersion(String s){return this;}Builder setFullVersion(String s){return this;}BrandVersion build(){return new BrandVersion();}}}
  static class Builder {Builder setBrandVersionList(Object o){return this;}Builder setFullVersion(String s){return this;}Builder setPlatform(String s){return this;}Builder setPlatformVersion(String s){return this;}Builder setArchitecture(String s){return this;}Builder setBitness(int n){return this;}Builder setModel(String s){return this;}Builder setMobile(boolean b){return this;}Builder setWow64(boolean b){return this;}UserAgentMetadata build(){return new UserAgentMetadata("desktop");}}
 }
 static class WebSettings {String ua;UserAgentMetadata metadata;WebSettings(String id){metadata=new UserAgentMetadata(id);}static String getDefaultUserAgent(Object c){return "Mozilla/5.0 (Linux; Android 14) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36";}void setUserAgentString(String s){ua=s;}void setUseWideViewPort(boolean b){}void setLoadWithOverviewMode(boolean b){}}
 static class WebView {WebSettings settings;WebView(String id){settings=new WebSettings(id);}WebSettings getSettings(){return settings;}void setInitialScale(int n){}}
 static class WebSettingsCompat {static UserAgentMetadata getUserAgentMetadata(WebSettings s){return s.metadata;}static void setUserAgentMetadata(WebSettings s,UserAgentMetadata m){s.metadata=m;}}
 static class WebViewCompat {static ScriptHandler addDocumentStartJavaScript(WebView v,String s,Set<String> origins){return new ScriptHandler();}}
 static class Label {String text;void setText(String s){text=s;}void setContentDescription(String s){}}
 static class Prefs {boolean value=true;boolean getBoolean(String k,boolean fallback){return value;}}
 static final class TabMode {ScriptHandler script;UserAgentMetadata originalMetadata;Boolean desktop;}
 final Map<WebView,TabMode> tabModes=new IdentityHashMap<>();
 WebView browser;boolean desktop,metadataSupported=true,earlyScriptSupported=true;Label mode=new Label();Prefs prefs=new Prefs();
 Prefs getSharedPreferences(String key,int flags){return prefs;}Object getContext(){return this;}String desktopCompatibilityScript()throws IOException{return new String(Files.readAllBytes(copyDesktopScript().toPath()),"UTF-8");}File copyDesktopScript(){return new File("probe/assets/desktop-compat.js");}
 static void check(boolean value,String message){if(!value)throw new AssertionError(message);}
 public static void main(String[] args){
  ModeCheck b=new ModeCheck();WebView a=new WebView("mobile-A"),c=new WebView("mobile-B");
  b.browser=a;check(b.applyMode(),"initial A");ScriptHandler sa=b.tabModes.get(a).script;
  b.browser=c;check(b.applyMode(),"initial B");ScriptHandler sc=b.tabModes.get(c).script;check(!sa.removed&&!sc.removed,"new tab must not remove old tab script");
  b.prefs.value=false;check(b.applyMode(),"B mobile");check(sc.removed&&!sa.removed,"switch only affects selected tab");check(c.settings.metadata.identity.equals("mobile-B"),"restore B metadata");
  b.browser=a;check(b.applyMode(),"activate stale A applies selected mode");check(sa.removed&&a.settings.metadata.identity.equals("mobile-A"),"restore A own metadata");
  b.prefs.value=true;check(b.applyMode(),"A desktop again");sa=b.tabModes.get(a).script;check(!b.applyMode()&&!sa.removed,"unchanged resume keeps script");
  b.browser=c;check(b.applyMode(),"B inherits desktop on activation");check(!sa.removed,"A still desktop after B activated");b.forgetMode(a);check(sa.removed&&!b.tabModes.containsKey(a),"closed tab releases script");
  check(b.mode.text.equals("桌面")&&!c.settings.ua.contains("Mobile"),"mode label and UA agree");
  System.out.println("PASS per-tab script ownership, mode reconciliation, original metadata restoration, unchanged resume and close cleanup");
 }
'''
fixture+='\n'+method('static String desktopAgent(')+'\n'+method('boolean applyMode(')+'\n'+method('void forgetMode(')+'\n}'
f=out/'ModeCheck.java';f.write_text(fixture,encoding='utf-8')
subprocess.run(['javac','-encoding','UTF-8','-d',str(out),str(f)],check=True,cwd=root)
subprocess.run(['java','-cp',str(out),'ModeCheck'],check=True,cwd=root)
