package ai.eva.android.probe;
import java.io.*;import java.nio.file.*;import java.nio.charset.StandardCharsets;import java.util.*;
/** JVM contract checks, exclusively in a unique fixture directory. */
public final class WorkspaceEditorTest {
 interface Action{void run()throws Exception;}
 static int assertions;
 static void check(boolean yes,String message){assertions++;if(!yes)throw new AssertionError(message);}
 static void rejects(Action action,String message)throws Exception{boolean rejected=false;try{action.run();}catch(IOException expected){rejected=true;}check(rejected,message);}
 public static void main(String[] args)throws Exception{
  Path parent=Paths.get(args[0]).toAbsolutePath().normalize();Files.createDirectories(parent);Path base=Files.createTempDirectory(parent,"editor-fixture-");
  try{WorkspaceEditor store=new WorkspaceEditor(base.resolve("workspace").toFile());
   store.create("项目", "",true);store.create("项目/笔记.md","中文与 emoji 😀\n第二行",false);
   WorkspaceEditor.Document first=store.read("项目/笔记.md");check(first.text.equals("中文与 emoji 😀\n第二行"),"UTF8 roundtrip");check(first.revision.length()==64,"revision hash");
   WorkspaceEditor.Document saved=store.save("项目/笔记.md","新的内容\n",first.revision);check(saved.text.equals("新的内容\n"),"save content");check(!saved.revision.equals(first.revision),"save new revision");
   rejects(()->store.save("项目/笔记.md","stale",first.revision),"stale revision rejected");check(store.read("项目/笔记.md").text.equals(saved.text),"stale does not overwrite");
   Files.write(store.root.resolve("项目/笔记.md"),"agent update".getBytes(StandardCharsets.UTF_8));rejects(()->store.save("项目/笔记.md","editor update",saved.revision),"external update rejected");check(store.read("项目/笔记.md").text.equals("agent update"),"external update intact");
   rejects(()->store.create("项目/笔记.md","overwrite",false),"duplicate file rejected");rejects(()->store.create("项目","",true),"duplicate directory rejected");
   store.create("empty.txt","",false);check(store.read("empty.txt").text.isEmpty(),"empty file supported");store.create(".hidden","hidden",false);check(store.read(".hidden").text.equals("hidden"),"project hidden text supported");
   for(String path:new String[]{"../escape","a/../escape","/absolute","a\\b","a//b","./a","a/","C:/outside","bad\nname",""})rejects(()->store.create(path,"x",false),"invalid path rejected "+path);
   rejects(()->store.read("项目"),"directory read rejected");rejects(()->store.read("missing.txt"),"missing read rejected");
   Files.write(store.root.resolve("invalid.txt"),new byte[]{(byte)0xc3,0x28});rejects(()->store.read("invalid.txt"),"invalid UTF8 rejected");
   Files.write(store.root.resolve("binary.bin"),new byte[]{65,0,66});rejects(()->store.read("binary.bin"),"binary rejected");rejects(()->store.create("nul.txt","a\u0000b",false),"binary create rejected");
   byte[] huge=new byte[WorkspaceEditor.MAX_BYTES+1];Arrays.fill(huge,(byte)'x');Files.write(store.root.resolve("huge.txt"),huge);rejects(()->store.read("huge.txt"),"large read rejected");rejects(()->store.create("too-big.txt",new String(huge,StandardCharsets.UTF_8),false),"large create rejected");
   WorkspaceEditor.Document empty=store.read("empty.txt");rejects(()->store.save("empty.txt",new String(huge,StandardCharsets.UTF_8),empty.revision),"large save rejected");check(store.read("empty.txt").text.isEmpty(),"failed save keeps old content");
   Files.delete(store.root.resolve("empty.txt"));rejects(()->store.save("empty.txt","resurrect",empty.revision),"deleted target not recreated");
   boolean posix=Files.getFileStore(store.root).supportsFileAttributeView("posix");if(posix){store.create("run.sh","before",false);java.util.Set<java.nio.file.attribute.PosixFilePermission> mode=java.nio.file.attribute.PosixFilePermissions.fromString("rwxr-xr-x");Files.setPosixFilePermissions(store.root.resolve("run.sh"),mode);WorkspaceEditor.Document executable=store.read("run.sh");store.save("run.sh","after",executable.revision);check(Files.getPosixFilePermissions(store.root.resolve("run.sh")).equals(mode),"executable permission preserved");}
   boolean links=true;try{Files.createSymbolicLink(store.root.resolve("outside-link"),base.resolve("outside.txt"));}catch(FileSystemException|UnsupportedOperationException e){links=false;}
   if(links){Files.write(base.resolve("outside.txt"),"outside".getBytes(StandardCharsets.UTF_8));rejects(()->store.read("outside-link"),"symlink read rejected");rejects(()->store.create("outside-link","overwrite",false),"symlink create rejected");Files.createSymbolicLink(store.root.resolve("dir-link"),base);rejects(()->store.create("dir-link/new.txt","escape",false),"directory symlink rejected");check(!Files.exists(base.resolve("new.txt")),"link rejection no outside write");}
   try(java.util.stream.Stream<Path> paths=Files.walk(store.root)){check(paths.noneMatch(p->p.getFileName().toString().startsWith(".eva-edit-")),"no temporary editor files");}
   System.out.println("PASS WorkspaceEditor "+assertions+" checks; host symlinks "+(links?"verified":"unavailable"));
  }finally{if(!base.startsWith(parent))throw new AssertionError("cleanup boundary");try(java.util.stream.Stream<Path> stream=Files.walk(base)){stream.sorted(Comparator.reverseOrder()).forEach(p->{try{Files.delete(p);}catch(IOException e){throw new RuntimeException(e);}});}}
 }
}
