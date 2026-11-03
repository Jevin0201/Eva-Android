package ai.eva.android.probe;
import java.io.*;import java.nio.file.*;import java.nio.charset.StandardCharsets;import java.util.*;
public final class MemoryStoreTest {
 interface Work{void run()throws Exception;}
 static int assertions=0;
 static void check(boolean ok,String message){assertions++;if(!ok)throw new AssertionError(message);}
 static void rejects(Work work,String message)throws Exception{boolean failed=false;try{work.run();}catch(IOException expected){failed=true;}check(failed,message);}
 public static void main(String[] args)throws Exception{
  Path base=Paths.get(args[0]).toAbsolutePath().normalize();Files.createDirectories(base);Path test=Files.createTempDirectory(base,"memory-test-");
  try{MemoryStore store=new MemoryStore(test.resolve("home").toFile());check(store.list().isEmpty(),"empty list");
   MemoryStore.Document original=store.create("偏好.md","请用中文回答 😀");check(original.content.equals("请用中文回答 😀"),"Unicode roundtrip");check(original.revision.length()==64,"SHA256 revision");
   check(store.list().get(0).id.equals("偏好.md"),"listed filename");check(store.list().get(0).size>original.content.length(),"UTF8 byte size");
   rejects(()->store.create("偏好.md","overwrite"),"no duplicate overwrite");
   MemoryStore.Document changed=store.save(original.id,"更新的内容",original.revision);check(!changed.revision.equals(original.revision),"revision changed");
   rejects(()->store.save(original.id,"lost update",original.revision),"stale save rejected");rejects(()->store.delete(original.id,original.revision),"stale delete rejected");check(store.read(original.id).content.equals("更新的内容"),"conflict keeps current content");
   for(String id:new String[]{"../escape.md","/etc/a.md","C:/a.md",".hidden.md","sub/../a.md","sub\\a.md","sub//a.md","a.exe","nul\u0000.md"})rejects(()->store.read(id),"reject path "+id);
   rejects(()->store.create("sub/a.md","nested"),"new filenames only");rejects(()->store.create("empty.md"," "),"empty new memory rejected");
   Files.createDirectories(store.root.resolve("group"));Files.write(store.root.resolve("group/note.txt"),"nested".getBytes(StandardCharsets.UTF_8));check(store.read("group/note.txt").content.equals("nested"),"existing nested file readable");check(store.list().size()==2,"recursive listing");
   Files.write(store.root.resolve("group/note.txt"),"external update".getBytes(StandardCharsets.UTF_8));check(store.read("group/note.txt").content.equals("external update"),"external changes visible");
   byte[] large=new byte[MemoryStore.MAX_BYTES+1];Files.write(store.root.resolve("large.md"),large);rejects(()->store.read("large.md"),"read size bound");
   boolean symlinks=true;try{Files.createSymbolicLink(store.root.resolve("outside.md"),test.resolve("outside.md"));}catch(FileSystemException|UnsupportedOperationException e){symlinks=false;}
   if(symlinks){rejects(()->store.read("outside.md"),"symlink read blocked");rejects(()->store.create("outside.md","data"),"symlink create blocked");}
   store.delete(original.id,changed.revision);rejects(()->store.read(original.id),"delete removed only selected memory");check(Files.exists(store.root.resolve("group/note.txt")),"other memory kept");
   check(MemoryStore.instructions().contains(MemoryStore.LOGICAL_ROOT),"model instructions exact root");System.out.println("PASS MemoryStore "+assertions+" assertions; symlink test "+(symlinks?"passed":"unavailable on host"));
  }finally{if(!test.startsWith(base))throw new AssertionError("cleanup path outside fixture root");try(java.util.stream.Stream<Path> paths=Files.walk(test)){paths.sorted(Comparator.reverseOrder()).forEach(p->{try{Files.delete(p);}catch(IOException e){throw new RuntimeException(e);}});}}
 }
}
