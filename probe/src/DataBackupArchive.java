package ai.eva.android.probe;
import java.io.*;import java.nio.ByteBuffer;import java.nio.charset.*;import java.util.*;import java.util.zip.*;
/** Small allowlisted ZIP format. Nothing from an archive becomes a filesystem path. */
final class DataBackupArchive {
 static final long MAX_ZIP=12L*1024*1024,MAX_TOTAL=8L*1024*1024;
 static final int MAX_MANIFEST=16384;
 static final Set<String> NAMES=new HashSet<>(Arrays.asList("manifest.json","conversations.json"));
 static void validateName(String name)throws IOException{if(name==null||!NAMES.contains(name))throw new IOException("备份包含不支持的路径或文件："+String.valueOf(name));}
 static byte[] encode(String manifest,String conversations)throws IOException{byte[] m=manifest.getBytes(StandardCharsets.UTF_8),c=conversations.getBytes(StandardCharsets.UTF_8);if(m.length>MAX_MANIFEST||m.length+c.length>MAX_TOTAL)throw new IOException("备份数据过大");ByteArrayOutputStream bytes=new ByteArrayOutputStream();try(ZipOutputStream zip=new ZipOutputStream(bytes)){write(zip,"manifest.json",m);write(zip,"conversations.json",c);}return bytes.toByteArray();}
 static void write(ZipOutputStream out,String name,byte[] bytes)throws IOException{validateName(name);out.putNextEntry(new ZipEntry(name));out.write(bytes);out.closeEntry();}
 static void checkJsonDepth(String text)throws IOException{int depth=0;boolean quoted=false,escaped=false;for(int i=0;i<text.length();i++){char c=text.charAt(i);if(quoted){if(escaped)escaped=false;else if(c=='\\')escaped=true;else if(c=='"')quoted=false;}else if(c=='"')quoted=true;else if(c=='{'||c=='['){if(++depth>64)throw new IOException("备份 JSON 层级过深");}else if(c=='}'||c==']')depth--;}}
 static Map<String,String> decode(InputStream source)throws IOException{
  InputStream bounded=new FilterInputStream(source){long read;void count(long n)throws IOException{if(n>0&&(read+=n)>MAX_ZIP)throw new IOException("压缩包超过 12 MB");}public int read()throws IOException{int n=super.read();if(n>=0)count(1);return n;}public int read(byte[] b,int off,int len)throws IOException{int n=in.read(b,off,len);count(n);return n;}};
  Map<String,String> result=new LinkedHashMap<>();long total=0;try(ZipInputStream zip=new ZipInputStream(bounded)){ZipEntry entry;while((entry=zip.getNextEntry())!=null){String name=entry.getName();validateName(name);if(entry.isDirectory()||result.containsKey(name)||result.size()>=2)throw new IOException("备份存在重复或无效条目");ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] buffer=new byte[16384];int n;while((n=zip.read(buffer))!=-1){total+=n;if(total>MAX_TOTAL||name.equals("manifest.json")&&out.size()+n>MAX_MANIFEST)throw new IOException("解压后的备份数据过大");out.write(buffer,0,n);}try{result.put(name,StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(out.toByteArray())).toString());}catch(CharacterCodingException e){throw new IOException("备份不是有效的 UTF-8 文本",e);}zip.closeEntry();}}
  if(!result.keySet().equals(NAMES))throw new IOException("备份缺少 manifest.json 或 conversations.json");return result;
 }
}
