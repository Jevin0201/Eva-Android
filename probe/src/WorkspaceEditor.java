package ai.eva.android.probe;
import java.io.*;
import java.nio.*;
import java.nio.charset.*;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;

/** Bounded UTF-8 edits; rejects linked paths and stale editor versions. */
final class WorkspaceEditor {
 static final int MAX_BYTES=262144;
 static final Object LOCK=new Object();
 final Path root;
 WorkspaceEditor(File base)throws IOException{root=base.getCanonicalFile().toPath();Files.createDirectories(root);}
 Path path(String relative)throws IOException{
  if(relative==null||relative.isEmpty()||relative.length()>2048||relative.startsWith("/")||relative.indexOf('\\')>=0||relative.indexOf(':')>=0)throw new IOException("无效工作区路径");
  Path at=root;for(String part:relative.split("/",-1)){if(part.isEmpty()||part.equals(".")||part.equals("..")||part.matches(".*[\\p{Cntrl}].*"))throw new IOException("无效工作区路径");at=at.resolve(part);if(Files.isSymbolicLink(at))throw new IOException("编辑器不修改链接文件或链接目录");}
  if(!at.normalize().startsWith(root))throw new IOException("路径不在工作区内");return at;
 }
 static String hash(byte[] bytes)throws IOException{try{byte[] digest=MessageDigest.getInstance("SHA-256").digest(bytes);StringBuilder s=new StringBuilder();for(byte b:digest)s.append(String.format(Locale.ROOT,"%02x",b&255));return s.toString();}catch(Exception e){throw new IOException(e);}}
 static final class Document{final String text,revision;Document(String t,String r){text=t;revision=r;}}
 Document read(String relative)throws IOException{synchronized(LOCK){Path p=path(relative);if(!Files.isRegularFile(p,LinkOption.NOFOLLOW_LINKS))throw new IOException("文件不存在");if(Files.size(p)>MAX_BYTES)throw new IOException("编辑器支持不超过 256 KB 的 UTF-8 文本");byte[] bytes=Files.readAllBytes(p);if(bytes.length>MAX_BYTES)throw new IOException("文件过大");for(byte b:bytes)if(b==0)throw new IOException("二进制文件不能作为文本编辑");try{return new Document(StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes)).toString(),hash(bytes));}catch(CharacterCodingException e){throw new IOException("文件不是有效 UTF-8 文本",e);}}}
 Document save(String relative,String text,String revision)throws IOException{synchronized(LOCK){byte[] bytes=text.getBytes(StandardCharsets.UTF_8);if(bytes.length>MAX_BYTES||text.indexOf('\0')>=0)throw new IOException("文本过大或包含二进制内容");if(!read(relative).revision.equals(revision))throw new IOException("文件已被其他任务修改。你的草稿已保留，请另存为或重新读取。");Path p=path(relative),tmp=Files.createTempFile(p.getParent(),".eva-edit-",".tmp");try{Files.write(tmp,bytes);try{Files.setPosixFilePermissions(tmp,Files.getPosixFilePermissions(p,LinkOption.NOFOLLOW_LINKS));}catch(UnsupportedOperationException ignored){}path(relative);if(!read(relative).revision.equals(revision))throw new IOException("文件已更新，请另存草稿");Files.move(tmp,p,StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING);}finally{Files.deleteIfExists(tmp);}return read(relative);}}
 void create(String relative,String text,boolean directory)throws IOException{synchronized(LOCK){Path p=path(relative);if(directory){Files.createDirectory(p);return;}byte[] bytes=text.getBytes(StandardCharsets.UTF_8);if(bytes.length>MAX_BYTES||text.indexOf('\0')>=0)throw new IOException("文本过大或包含二进制内容");try{Files.write(p,bytes,StandardOpenOption.CREATE_NEW);}catch(FileAlreadyExistsException e){throw new IOException("已存在同名文件或目录",e);}}}
}
