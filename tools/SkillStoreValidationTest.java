package ai.eva.android.probe;
import java.io.*;import java.nio.file.*;
public final class SkillStoreValidationTest {
 interface Check{void run()throws Exception;}static void reject(Check f)throws Exception{boolean failed=false;try{f.run();}catch(Exception e){failed=true;}if(!failed)throw new AssertionError("Invalid input accepted");}
 public static void main(String[] ignored)throws Exception{
  SkillStore.validate("---\nname: fixture\ndescription: A fixture\n---\n中文");SkillStore.validate("---\r\nname: fixture\r\ndescription: A fixture\r\n---\r\nBody");reject(()->SkillStore.validate("---\nname: fixture\n---\nBody"));
  SkillStore.validateName("test-123_a");for(String n:new String[]{"../outside","X","","a/b","a\\b"})reject(()->SkillStore.validateName(n));SkillStore.validateProject("");SkillStore.validateProject("project_1");reject(()->SkillStore.validateProject("../x"));
  if(!SkillStore.utf8("中文😀".getBytes("UTF-8")).equals("中文😀"))throw new AssertionError();reject(()->SkillStore.utf8(new byte[]{(byte)0xc3,0x28}));reject(()->SkillStore.read(new ByteArrayInputStream(new byte[11]),10));
  File staging=Files.createTempDirectory(new File("probe/build").toPath(),"skill-test-").toFile();try{SkillStore.zipTarget(staging,"bundle/SKILL.md");for(String n:new String[]{"../outside","nested/../../outside","/absolute","C:/outside","..\\outside",""})reject(()->SkillStore.zipTarget(staging,n));}finally{Files.delete(staging.toPath());}
  System.out.println("PASS skill UTF8/size/YAML/name/project/ZIP traversal validation");
 }
}
