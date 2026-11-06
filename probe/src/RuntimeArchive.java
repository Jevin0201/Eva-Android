package ai.eva.android.probe;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.zip.GZIPInputStream;

/** Native bounded tar reader for a private, empty runtime staging directory. */
final class RuntimeArchive {
 interface Monitor { void check() throws IOException; void progress(long bytes); }
 private static final int BLOCK=512;
 private static final class Link { final Path file;final String target;final boolean hard;Link(Path file,String target,boolean hard){this.file=file;this.target=target;this.hard=hard;} }
 static void extract(InputStream source,String format,File destination,long limit,Monitor monitor)throws Exception {
  if(!format.equals("tar")&&!format.equals("tar.gz"))throw new IOException("不支持的运行环境格式");
  Path root=destination.toPath().toAbsolutePath().normalize();
  if(Files.isSymbolicLink(root)||!Files.isDirectory(root,LinkOption.NOFOLLOW_LINKS))throw new IOException("解包目录无效");
  List<Link> links=new ArrayList<>();Set<Path> seen=new HashSet<>();
  String pendingName=null,pendingLink=null;long total=0;int count=0;
  try(InputStream in=new BufferedInputStream(format.equals("tar.gz")?new GZIPInputStream(source,65536):source,65536)) {
   byte[] header=new byte[BLOCK];
   while(readHeader(in,header)) {
    monitor.check(); if(++count>300000)throw new IOException("运行环境条目过多");
    boolean zero=true;for(byte value:header)if(value!=0){zero=false;break;}if(zero)break;
    long checksum=number(header,148,8),sum=0;for(int i=0;i<BLOCK;i++)sum+=(i>=148&&i<156)?32:(header[i]&255);if(checksum!=sum)throw new IOException("tar 头校验失败");
    long size=number(header,124,12);if(size<0||size>limit-total)throw new IOException("解包数据超过声明上限");
    total+=size;byte type=header[156];String name=text(header,0,100),prefix=text(header,345,155);
    if(!prefix.isEmpty())name=prefix+"/"+name;
    String target=text(header,157,100);
    if(type=='x'||type=='g'||type=='L'||type=='K') {
     if(size>1024*1024)throw new IOException("tar 扩展头过大");
     byte[] data=readBytes(in,(int)size,monitor);skip(in,padding(size),monitor);
     if(type=='L')pendingName=trimZero(data);else if(type=='K')pendingLink=trimZero(data);
     else {Map<String,String> pax=pax(data);if(pax.containsKey("size")||pax.keySet().stream().anyMatch(k->k.startsWith("GNU.sparse")))throw new IOException("不支持 tar 稀疏或大小扩展");if(type=='x'){if(pax.containsKey("path"))pendingName=pax.get("path");if(pax.containsKey("linkpath"))pendingLink=pax.get("linkpath");}else if(pax.containsKey("path")||pax.containsKey("linkpath"))throw new IOException("不支持全局 tar 路径");}
     continue;
    }
    if(pendingName!=null){name=pendingName;pendingName=null;}if(pendingLink!=null){target=pendingLink;pendingLink=null;}
    Path file=entry(root,name);checkParents(root,file.getParent());
    if(file.equals(root)){if(type!='5')throw new IOException("根条目必须为目录");skip(in,size+padding(size),monitor);continue;}
    if(!seen.add(file))throw new IOException("tar 存在重复条目 "+name);
    if(type=='5'){Files.createDirectories(file);if(size!=0)throw new IOException("目录包含异常数据");}
    else if(type==0||type=='0') {
     Files.createDirectories(file.getParent());
     try(OutputStream out=Files.newOutputStream(file,StandardOpenOption.CREATE_NEW,StandardOpenOption.WRITE)) {copy(in,out,size,monitor);}
     android.system.Os.chmod(file.toString(),(int)(number(header,100,8)&0777));
    } else if(type=='2'||type=='1') {
     if(size!=0)throw new IOException("链接包含异常数据");validateLink(root,file,target,type=='1');links.add(new Link(file,target,type=='1'));
    } else throw new IOException("禁止 tar 设备、FIFO 或未知条目类型 "+type);
    skip(in,padding(size),monitor);monitor.progress(total);
   }
   // Links are materialized only after all writes, preventing archive writes through links.
   for(Link link:links) {
    monitor.check();checkParents(root,link.file.getParent());Files.createDirectories(link.file.getParent());
    Path target=validateLink(root,link.file,link.target,link.hard);
    if(link.hard){checkParents(root,target.getParent());if(!Files.isRegularFile(target,LinkOption.NOFOLLOW_LINKS))throw new IOException("硬链接目标不是普通文件");Files.createLink(link.file,target);}
    else Files.createSymbolicLink(link.file,Paths.get(link.target));
   }
  }
 }
 static Path entry(Path root,String name)throws IOException {
  if(name.indexOf('\0')>=0||name.indexOf('\\')>=0||name.startsWith("/")||name.length()>4096)throw new IOException("tar 路径无效");
  Path relative=Paths.get(name);for(Path part:relative)if(part.toString().equals(".."))throw new IOException("tar 路径越界");
  Path file=root.resolve(relative).normalize();if(!file.startsWith(root))throw new IOException("tar 路径越界");return file;
 }
 static Path validateLink(Path root,Path file,String target,boolean hard)throws IOException {
  if(target.isEmpty()||target.length()>4096||target.indexOf('\0')>=0||target.indexOf('\\')>=0)throw new IOException("链接目标无效");
  Path resolved=hard?entry(root,target):target.startsWith("/")?root.resolve(target.substring(1)).normalize():file.getParent().resolve(target).normalize();
  if(!resolved.startsWith(root))throw new IOException("链接目标越界");return resolved;
 }
 static void checkParents(Path root,Path parent)throws IOException {
  if(parent==null||!parent.startsWith(root))throw new IOException("父目录越界");
  Path current=root;for(Path part:root.relativize(parent)){current=current.resolve(part);if(Files.isSymbolicLink(current)||Files.exists(current,LinkOption.NOFOLLOW_LINKS)&&!Files.isDirectory(current,LinkOption.NOFOLLOW_LINKS))throw new IOException("不能经过链接或非目录写入");}
 }
 private static boolean readHeader(InputStream in,byte[] header)throws IOException {int offset=0,n;while(offset<header.length&&(n=in.read(header,offset,header.length-offset))!=-1)offset+=n;if(offset==0)return false;if(offset!=header.length)throw new IOException("tar 头被截断");return true;}
 private static String text(byte[] bytes,int at,int length){int end=at;while(end<at+length&&bytes[end]!=0)end++;return new String(bytes,at,end-at,StandardCharsets.UTF_8);}
 private static String trimZero(byte[] bytes){return text(bytes,0,bytes.length).replaceAll("\\n$","");}
 private static long number(byte[] bytes,int at,int length)throws IOException {String value=text(bytes,at,length).trim();if(value.isEmpty())return 0;if(!value.matches("[0-7]+"))throw new IOException("不支持 tar 数字编码");try{return Long.parseLong(value,8);}catch(NumberFormatException error){throw new IOException("tar 数值溢出");}}
 private static long padding(long size){return (BLOCK-size%BLOCK)%BLOCK;}
 private static byte[] readBytes(InputStream in,int size,Monitor monitor)throws IOException {ByteArrayOutputStream out=new ByteArrayOutputStream(size);copy(in,out,size,monitor);return out.toByteArray();}
 private static void copy(InputStream in,OutputStream out,long size,Monitor monitor)throws IOException {byte[] buffer=new byte[65536];while(size>0){monitor.check();int n=in.read(buffer,0,(int)Math.min(buffer.length,size));if(n<0)throw new IOException("tar 数据被截断");out.write(buffer,0,n);size-=n;}}
 private static void skip(InputStream in,long size,Monitor monitor)throws IOException {copy(in,new OutputStream(){public void write(int value){}public void write(byte[] value,int at,int length){}},size,monitor);}
 private static Map<String,String> pax(byte[] data)throws IOException {Map<String,String> result=new HashMap<>();int at=0;while(at<data.length){int space=at;while(space<data.length&&data[space]!=' ')space++;if(space==data.length)throw new IOException("PAX 记录无效");int length;try{length=Integer.parseInt(new String(data,at,space-at,StandardCharsets.US_ASCII));}catch(Exception error){throw new IOException("PAX 长度无效");}if(length<=space-at+1||length>data.length-at)throw new IOException("PAX 长度越界");String row=new String(data,space+1,at+length-space-2,StandardCharsets.UTF_8);int equals=row.indexOf('=');if(equals<1)throw new IOException("PAX 字段无效");result.put(row.substring(0,equals),row.substring(equals+1));at+=length;}return result;}
}
