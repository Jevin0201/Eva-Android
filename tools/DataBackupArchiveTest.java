package ai.eva.android.probe;
import java.io.*;import java.nio.charset.StandardCharsets;import java.util.*;import java.util.zip.*;
public final class DataBackupArchiveTest {
 interface Work{void run()throws Exception;}static int checks;
 static void check(boolean value,String message){checks++;if(!value)throw new AssertionError(message);}
 static void rejects(Work work,String message)throws Exception{boolean failed=false;try{work.run();}catch(IOException expected){failed=true;}check(failed,message);}
 static byte[] zip(String[] names,byte[][] values)throws Exception{ByteArrayOutputStream out=new ByteArrayOutputStream();try(ZipOutputStream z=new ZipOutputStream(out)){for(int i=0;i<names.length;i++){z.putNextEntry(new ZipEntry(names[i]));z.write(values[i]);z.closeEntry();}}return out.toByteArray();}
 public static void main(String[] args)throws Exception{
  String manifest="{\"format\":\"eva-android-history\",\"version\":1}",state="{\"chats\":[{\"title\":\"中文 😀\"}]}";byte[] encoded=DataBackupArchive.encode(manifest,state);Map<String,String> decoded=DataBackupArchive.decode(new ByteArrayInputStream(encoded));check(decoded.get("conversations.json").equals(state),"Unicode roundtrip");check(decoded.size()==2,"only allowlisted entries");
  for(String name:new String[]{"../outside.json","/absolute.json","C:/outside.json","..\\outside.json","folder/conversations.json","auth.json","workspace/secrets.txt","manifest.json/"}){byte[] bad=zip(new String[]{name},new byte[][]{"{}".getBytes(StandardCharsets.UTF_8)});rejects(()->DataBackupArchive.decode(new ByteArrayInputStream(bad)),"reject ZIP path "+name);}
  byte[] missing=zip(new String[]{"manifest.json"},new byte[][]{manifest.getBytes(StandardCharsets.UTF_8)});rejects(()->DataBackupArchive.decode(new ByteArrayInputStream(missing)),"missing conversation entry");
  byte[] manifestLarge=zip(new String[]{"manifest.json","conversations.json"},new byte[][]{new byte[DataBackupArchive.MAX_MANIFEST+1],state.getBytes(StandardCharsets.UTF_8)});rejects(()->DataBackupArchive.decode(new ByteArrayInputStream(manifestLarge)),"manifest size limit");
  byte[] bomb=zip(new String[]{"manifest.json","conversations.json"},new byte[][]{manifest.getBytes(StandardCharsets.UTF_8),new byte[(int)DataBackupArchive.MAX_TOTAL+1]});rejects(()->DataBackupArchive.decode(new ByteArrayInputStream(bomb)),"decompressed ZIP bomb limit");
  byte[] invalid=zip(new String[]{"manifest.json","conversations.json"},new byte[][]{manifest.getBytes(StandardCharsets.UTF_8),new byte[]{(byte)0xc3,(byte)0x28}});rejects(()->DataBackupArchive.decode(new ByteArrayInputStream(invalid)),"strict UTF8");
  byte[] truncated=Arrays.copyOf(encoded,encoded.length/2);rejects(()->DataBackupArchive.decode(new ByteArrayInputStream(truncated)),"truncated archive");
  StringBuilder deep=new StringBuilder();for(int n=0;n<70;n++)deep.append('[');rejects(()->DataBackupArchive.checkJsonDepth(deep.toString()),"deep JSON");DataBackupArchive.checkJsonDepth("{\"quoted\":\"[[[[[\"}");check(true,"quoted JSON bracket ignored");
  // Build duplicate entries by replacing a same-length second name in ZIP bytes.
  byte[] duplicate=zip(new String[]{"manifest.json","manifesx.json"},new byte[][]{manifest.getBytes(StandardCharsets.UTF_8),manifest.getBytes(StandardCharsets.UTF_8)});byte[] needle="manifesx.json".getBytes(StandardCharsets.UTF_8);for(int i=0;i<=duplicate.length-needle.length;i++){boolean equal=true;for(int j=0;j<needle.length;j++)if(duplicate[i+j]!=needle[j])equal=false;if(equal)duplicate[i+7]='t';}rejects(()->DataBackupArchive.decode(new ByteArrayInputStream(duplicate)),"duplicate entry");
  System.out.println("PASS DataBackupArchive "+checks+" assertions including ZIP traversal, expansion limit, duplicate, UTF8 and truncation");
 }
}
