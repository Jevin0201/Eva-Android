"""Exercise the real skill store and model tool with a filesystem-backed host fixture."""
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "artifacts/skill-authoring-20261117/fixture"
OUT.mkdir(parents=True, exist_ok=True)
sources = {
    "android/content/Context.java": '''package android.content;
public class Context {
 public java.io.File getFilesDir(){return new java.io.File(System.getProperty("fixture.home"));}
 public ContentResolver getContentResolver(){return new ContentResolver();}
}''',
    "android/content/ContentResolver.java": '''package android.content;
public class ContentResolver {public java.io.InputStream openInputStream(android.net.Uri uri)throws java.io.IOException {throw new java.io.IOException("unused");}}''',
    "android/net/Uri.java": "package android.net; public class Uri {}",
    "ai/eva/android/probe/KernelHost.java": '''package ai.eva.android.probe;
import org.json.*;import java.io.*;import java.util.concurrent.*;
class KernelHost {
 android.content.Context context=new android.content.Context();
 ExecutorService work=Executors.newCachedThreadPool();boolean fail;
 static void guardTurn(JSONObject value){} void write(JSONObject value){}
 JSONObject refreshSkills(JSONObject request)throws Exception {
  if(fail)throw new IOException("fixture refresh failed");
  String cwd=request.getJSONArray("cwds").getString(0);
  String project=cwd.contains("/projects/")?cwd.substring(cwd.lastIndexOf('/')+1):"";
  JSONArray skills=new JSONArray();File[] dirs=SkillStore.root(context,project).listFiles();
  if(dirs!=null)for(File dir:dirs)skills.put(new JSONObject().put("name",dir.getName()).put("path",SkillStore.logical(project,dir.getName())));
  return new JSONObject().put("data",new JSONArray().put(new JSONObject().put("skills",skills)));
 }
}''',
    "ai/eva/android/probe/SkillAuthoringTest.java": '''package ai.eva.android.probe;
import org.json.*;
public class SkillAuthoringTest {
 static int checks; static void check(boolean ok)throws Exception {checks++;if(!ok)throw new Exception("check "+checks);}
 interface Action {void run()throws Exception;}
 static void reject(Action action)throws Exception {try{action.run();}catch(Exception expected){checks++;return;}throw new Exception("expected rejection");}
 public static void main(String[] args)throws Exception {
  KernelHost host=new KernelHost();String text="---\\nname: sample\\ndescription: A reusable sample\\n---\\n中文 instructions";
  check(SkillTools.spec().getString("name").equals("eva_skills"));
  JSONObject save=new JSONObject().put("action","save").put("name","sample").put("text",text);
  JSONObject result=SkillTools.execute(host,save);check(result.getBoolean("saved"));check(result.getBoolean("discoverable"));check(result.getString("text").equals(text));
  reject(()->SkillTools.execute(host,save));
  save.put("overwrite",true).put("text",text+" updated");check(SkillTools.execute(host,save).getString("text").endsWith("updated"));
  save.put("project","project_1").put("overwrite",false);check(SkillTools.execute(host,save).getString("path").contains("/projects/project_1/.agents/skills/"));
  reject(()->SkillTools.execute(host,new JSONObject(save.toString()).put("project","../outside")));
  reject(()->SkillTools.execute(host,new JSONObject(save.toString()).put("name","../outside")));
  reject(()->SkillTools.execute(host,new JSONObject(save.toString()).put("text","invalid")));
  check(SkillTools.execute(host,new JSONObject().put("action","validate").put("text",text)).getBoolean("valid"));
  host.fail=true;save.put("project","").put("name","refresh-failure");result=SkillTools.execute(host,save);
  check(result.getBoolean("saved")&&!result.getBoolean("discoverable")&&result.has("refreshError"));
  check(SkillTools.execute(host,new JSONObject().put("action","read").put("name","refresh-failure")).getString("text").equals(save.getString("text")));
  System.out.println("PASS skill authoring "+checks+" checks");
 }
}'''
}
for name, content in sources.items():
    target = OUT / name
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")
java_home = Path(os.environ.get("JAVA_HOME", "C:/Program Files/Eclipse Adoptium/jdk-17.0.20.101-hotspot"))
jar = ROOT / "artifacts/full-access-approvals/json.jar"
classes = OUT / "classes"
classes.mkdir(exist_ok=True)
subprocess.run([str(java_home / "bin/javac.exe"), "-encoding", "UTF-8", "-cp", str(jar), "-d", str(classes),
                *[str(OUT / name) for name in sources], str(ROOT / "probe/src/SkillStore.java"), str(ROOT / "probe/src/SkillTools.java")], check=True)
home = OUT / "home"
home.mkdir(exist_ok=True)
# Each run uses a fresh owned directory, preserving evidence from earlier runs.
import tempfile
home = Path(tempfile.mkdtemp(prefix="run-", dir=home))
subprocess.run([str(java_home / "bin/java.exe"), "-Dfixture.home=" + str(home), "-cp", str(classes) + os.pathsep + str(jar),
                "ai.eva.android.probe.SkillAuthoringTest"], check=True)
