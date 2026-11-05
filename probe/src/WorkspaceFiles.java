package ai.eva.android.probe;

import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.provider.OpenableColumns;
import java.io.*;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.*;
import org.json.JSONObject;

/** Copies the documents explicitly selected by the user into the local workspace. */
final class WorkspaceFiles {
 static File root(Context context) throws IOException {
  return new File(context.getFilesDir(), "alpine/root/eva-workspace").getCanonicalFile();
 }
 static File resolve(Context context, String relative) throws IOException {
  File root = root(context);
  File file = new File(root, relative).getCanonicalFile();
  if (!file.toPath().startsWith(root.toPath())) throw new IOException("文件不在工作区内");
  return file;
 }
 static File project(Context context, String id) throws IOException {
  if (!id.isEmpty() && !id.matches("[a-zA-Z0-9-]{1,64}")) throw new IOException("无效项目编号");
  File folder = resolve(context, id.isEmpty() ? "" : "projects/" + id);
  if (!folder.isDirectory() && !folder.mkdirs()) throw new IOException("无法创建项目目录");
  return folder;
 }
 static JSONObject importUri(Context context, Uri uri, String project) throws Exception {
  return importSelection(context, uri, project);
 }
 static JSONObject importSelection(Context context, Uri selected, String projectId) throws Exception {
  Uri uri = selected;
  boolean document = DocumentsContract.isDocumentUri(context, uri);
  if (!document && DocumentsContract.isTreeUri(uri)) {
   uri = DocumentsContract.buildDocumentUriUsingTree(uri, DocumentsContract.getTreeDocumentId(uri));
   document = true;
  }
  String name = "附件";
  String mime = context.getContentResolver().getType(uri);
  String[] columns = document
    ? new String[]{DocumentsContract.Document.COLUMN_DISPLAY_NAME, DocumentsContract.Document.COLUMN_MIME_TYPE}
    : new String[]{OpenableColumns.DISPLAY_NAME};
  try (Cursor cursor = context.getContentResolver().query(uri, columns, null, null, null)) {
   if (cursor != null && cursor.moveToFirst()) {
    name = cursor.getString(0);
    if (document) mime = cursor.getString(1);
   }
  }
  boolean directory = DocumentsContract.Document.MIME_TYPE_DIR.equals(mime);
  name = safeName(name);
  File attachments = new File(project(context, projectId), "attachments");
  if (!attachments.isDirectory() && !attachments.mkdirs()) throw new IOException("无法创建附件目录");
  attachments = attachments.getCanonicalFile();
  if (!attachments.toPath().startsWith(root(context).toPath())) throw new IOException("附件目录不在工作区内");
  Path container = attachments.toPath().resolve(UUID.randomUUID().toString());
  Files.createDirectory(container);
  try {
   Path destination = container.resolve(name);
   long size;
   if (directory) {
    Files.createDirectory(destination);
    size = copyDirectory(context, uri, destination);
   } else {
    size = copyFile(context, uri, destination);
   }
   String relative = root(context).toPath().relativize(destination).toString().replace('\\', '/');
   JSONObject result = new JSONObject().put("id", UUID.randomUUID().toString()).put("name", name)
     .put("size", size).put("mime", mime).put("path", "/root/eva-workspace/" + relative);
   if (directory) result.put("kind", "directory");
   return result;
  } catch (Exception error) {
   try { removeImport(container); } catch (IOException cleanupError) { error.addSuppressed(cleanupError); }
   throw error;
  }
 }
 private static String safeName(String value) {
  String name = value == null ? "附件" : value.replaceAll("[\\\\/\\p{Cntrl}]", "_");
  if (name.isEmpty() || name.equals(".") || name.equals("..")) name = "附件";
  while (name.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 180) {
   name = name.substring(0, name.offsetByCodePoints(name.length(), -1));
  }
  return name;
 }
 private static long copyFile(Context context, Uri uri, Path destination) throws IOException {
  try (InputStream input = context.getContentResolver().openInputStream(uri);
       OutputStream output = Files.newOutputStream(destination, StandardOpenOption.CREATE_NEW,
         StandardOpenOption.WRITE, LinkOption.NOFOLLOW_LINKS)) {
   if (input == null) throw new IOException("无法读取文件");
   byte[] buffer = new byte[32768];
   long size = 0;
   int count;
   while ((count = input.read(buffer)) != -1) {
    if (Thread.currentThread().isInterrupted()) throw new InterruptedIOException("已取消导入");
    output.write(buffer, 0, count);
    size = Math.addExact(size, count);
   }
   return size;
  }
 }
 private static final class DirectoryCopy {
  final Uri uri;
  final Path destination;
  DirectoryCopy(Uri uri, Path destination) { this.uri = uri; this.destination = destination; }
 }
 private static long copyDirectory(Context context, Uri rootUri, Path destination) throws Exception {
  ArrayDeque<DirectoryCopy> pending = new ArrayDeque<>();
  Set<String> seen = new HashSet<>();
  pending.push(new DirectoryCopy(rootUri, destination));
  long total = 0;
  String[] columns = {DocumentsContract.Document.COLUMN_DOCUMENT_ID,
    DocumentsContract.Document.COLUMN_DISPLAY_NAME, DocumentsContract.Document.COLUMN_MIME_TYPE};
  while (!pending.isEmpty()) {
   if (Thread.currentThread().isInterrupted()) throw new InterruptedIOException("已取消导入");
   DirectoryCopy folder = pending.pop();
   String id = DocumentsContract.getDocumentId(folder.uri);
   if (!seen.add(id)) throw new IOException("目录提供方返回了循环或重复目录");
   Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(folder.uri, id);
   try (Cursor cursor = context.getContentResolver().query(children, columns, null, null, null)) {
    if (cursor == null) throw new IOException("无法读取文件夹内容");
    while (cursor.moveToNext()) {
     Uri child = DocumentsContract.buildDocumentUriUsingTree(folder.uri, cursor.getString(0));
     String name = safeName(cursor.getString(1));
     Path target = uniqueDestination(folder.destination, name);
     if (DocumentsContract.Document.MIME_TYPE_DIR.equals(cursor.getString(2))) {
      Files.createDirectory(target);
      pending.push(new DirectoryCopy(child, target));
     } else {
      total = Math.addExact(total, copyFile(context, child, target));
     }
    }
   }
  }
  return total;
 }
 private static Path uniqueDestination(Path parent, String name) {
  Path target = parent.resolve(name);
  for (int suffix = 2; Files.exists(target, LinkOption.NOFOLLOW_LINKS); suffix++) {
   target = parent.resolve(name + " (" + suffix + ")");
  }
  return target;
 }
 private static void removeImport(Path container) throws IOException {
  Files.walkFileTree(container, new SimpleFileVisitor<Path>() {
   @Override public FileVisitResult visitFile(Path file, BasicFileAttributes attributes) throws IOException {
    Files.delete(file); return FileVisitResult.CONTINUE;
   }
   @Override public FileVisitResult postVisitDirectory(Path directory, IOException error) throws IOException {
    if (error != null) throw error;
    Files.delete(directory); return FileVisitResult.CONTINUE;
   }
  });
 }
 static Intent picker(Context context, boolean photos) {
  if (photos && android.os.Build.VERSION.SDK_INT >= 33) {
   Intent photo = new Intent(android.provider.MediaStore.ACTION_PICK_IMAGES).setType("image/*")
     .putExtra(android.provider.MediaStore.EXTRA_PICK_IMAGES_MAX, android.provider.MediaStore.getPickImagesMaxLimit());
   if (photo.resolveActivity(context.getPackageManager()) != null) return photo;
  }
  return new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
    .setType(photos ? "image/*" : "*/*").putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
 }
 static void export(Context context, File file, Uri uri) throws Exception {
  File source = resolve(context, root(context).toPath().relativize(file.getCanonicalFile().toPath()).toString());
  if (!source.isFile()) throw new IOException("文件不存在");
  try (InputStream input = new FileInputStream(source);
       OutputStream output = context.getContentResolver().openOutputStream(uri, "wt")) {
   if (output == null) throw new IOException("无法写入目标文件");
   byte[] buffer = new byte[32768];
   int count;
   while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
  }
 }
}
