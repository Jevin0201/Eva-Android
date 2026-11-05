package ai.eva.android.probe;

import android.app.Instrumentation;
import android.content.*;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.*;
import android.provider.DocumentsContract;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import org.json.JSONObject;

/** Explicit native fixture. Its provider exposes only a test-owned cache directory. */
public final class AttachmentImportCheck extends Instrumentation {
 private static final String AUTHORITY = "ai.eva.android.probe.attachment-fixture";
 private static final String ROOT = "attachment-import-check";
 @Override public void onCreate(Bundle arguments) { super.onCreate(arguments); start(); }
 @Override public void onStart() {
  Context context = getTargetContext();
  File fixture = new File(context.getCacheDir(), ROOT);
  List<File> imported = new ArrayList<>();
  Bundle result = new Bundle();
  int code = android.app.Activity.RESULT_CANCELED;
  boolean fixtureCreated = false;
  try {
   if (fixture.exists()) throw new IOException("Previous fixture remains, inspect before retrying");
   if (!fixture.mkdirs()) throw new IOException("Cannot create fixture");
   fixtureCreated = true;
   File source = new File(fixture, "source");source.mkdir();
   new File(source, "nested/empty").mkdirs();
   try (RandomAccessFile large = new RandomAccessFile(new File(source, "large.bin"), "rw")) {
    large.setLength(33L * 1024 * 1024 + 17);
   }
   for (int i = 0; i < 12; i++) {
    try (FileOutputStream output = new FileOutputStream(new File(source, "file-" + i + ".txt"))) { output.write(i); }
   }
   Uri tree = DocumentsContract.buildTreeDocumentUri(AUTHORITY, "source");
   JSONObject folder = WorkspaceFiles.importSelection(context, tree, "");
   File copied = importedFile(context, folder);imported.add(copied.getParentFile());
   require(folder.getString("kind").equals("directory"), "Directory metadata");
   require(new File(copied, "nested/empty").isDirectory(), "Empty nested directory retained");
   require(new File(copied, "large.bin").length() == 33L * 1024 * 1024 + 17, "Large file retained");
   require(folder.getLong("size") == 33L * 1024 * 1024 + 29, "Directory byte count");
   require(copied.listFiles().length == 14, "More than ten entries copied");
   JSONObject leaf = WorkspaceFiles.importUri(context,
     DocumentsContract.buildDocumentUriUsingTree(tree, "source/large.bin"), "");
   File leafFile = importedFile(context, leaf);imported.add(leafFile.getParentFile());
   require(leafFile.length() == 33L * 1024 * 1024 + 17, "Single file exceeds former cap");
   File attachments = new File(WorkspaceFiles.root(context), "attachments");
   Set<String> before = new HashSet<>(Arrays.asList(attachments.list()));
   boolean failed = false;
   try { WorkspaceFiles.importSelection(context, DocumentsContract.buildDocumentUriUsingTree(tree, "broken"), ""); }
   catch (FileNotFoundException expected) { failed = true; }
   require(failed, "Read failure is reported");
   require(before.equals(new HashSet<>(Arrays.asList(attachments.list()))), "Failed import leaves no partial directory");
   result.putString("result", "PASS attachment native import: >32MiB file, >10 entries, nested empty directory, exact size, partial cleanup");
   code = android.app.Activity.RESULT_OK;
  } catch (Exception error) { result.putString("result", "FAIL " + error); }
  finally {
   try {
    for (File container : imported) {
     File attachments = new File(WorkspaceFiles.root(context), "attachments").getCanonicalFile();
     if (!container.getCanonicalFile().getParentFile().equals(attachments) || !container.getName().matches("[a-f0-9-]{36}")) throw new IOException("Unexpected cleanup path");
     deleteOwned(container.toPath());
    }
    if (fixtureCreated && fixture.getCanonicalFile().getParentFile().equals(context.getCacheDir().getCanonicalFile())) deleteOwned(fixture.toPath());
   } catch (Exception error) { result.putString("cleanupError", error.toString());code = android.app.Activity.RESULT_CANCELED; }
  }
  finish(code, result);
 }
 private static void require(boolean condition, String message) throws IOException { if (!condition) throw new IOException(message); }
 private static File importedFile(Context context, JSONObject metadata) throws Exception {
  return WorkspaceFiles.resolve(context, metadata.getString("path").substring("/root/eva-workspace/".length()));
 }
 private static void deleteOwned(Path path) throws IOException {
  if (!Files.exists(path, LinkOption.NOFOLLOW_LINKS)) return;
  Files.walkFileTree(path, new SimpleFileVisitor<Path>() {
   @Override public FileVisitResult visitFile(Path file, java.nio.file.attribute.BasicFileAttributes attributes) throws IOException { Files.delete(file);return FileVisitResult.CONTINUE; }
   @Override public FileVisitResult postVisitDirectory(Path folder, IOException error) throws IOException { if (error != null) throw error;Files.delete(folder);return FileVisitResult.CONTINUE; }
  });
 }
 public static final class FixtureProvider extends ContentProvider {
  @Override public boolean onCreate() { return true; }
  private File file(String id) throws IOException {
   File root = new File(getContext().getCacheDir(), ROOT).getCanonicalFile();
   File file = new File(root, id).getCanonicalFile();
   if (!file.toPath().startsWith(root.toPath())) throw new IOException("Outside fixture");
   return file;
  }
  private String id(Uri uri) { return DocumentsContract.getDocumentId(uri); }
  @Override public String getType(Uri uri) {
   try { return file(id(uri)).isDirectory() ? DocumentsContract.Document.MIME_TYPE_DIR : "application/octet-stream"; }
   catch (Exception error) { throw new IllegalArgumentException(error); }
  }
  @Override public Cursor query(Uri uri, String[] projection, String selection, String[] arguments, String order) {
   String[] columns = projection == null ? new String[]{DocumentsContract.Document.COLUMN_DISPLAY_NAME} : projection;
   MatrixCursor cursor = new MatrixCursor(columns);
   try {
    String id = id(uri);
    File selected = file(id);
    boolean children = uri.getPath().endsWith("/children");
    File[] files = children ? selected.listFiles() : new File[]{selected};
    if (files == null) throw new IOException("Missing fixture directory");
    for (File child : files) {
     Object[] row = new Object[columns.length];
     for (int i = 0; i < columns.length; i++) {
      String column = columns[i];
      if (column.equals(DocumentsContract.Document.COLUMN_DOCUMENT_ID)) row[i] = children ? id + "/" + child.getName() : id;
      else if (column.equals(DocumentsContract.Document.COLUMN_DISPLAY_NAME)) row[i] = child.getName();
      else if (column.equals(DocumentsContract.Document.COLUMN_MIME_TYPE)) row[i] = child.isDirectory() ? DocumentsContract.Document.MIME_TYPE_DIR : "application/octet-stream";
     }
     cursor.addRow(row);
    }
    return cursor;
   } catch (Exception error) { cursor.close();throw new IllegalArgumentException(error); }
  }
  @Override public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
   try { return ParcelFileDescriptor.open(file(id(uri)), ParcelFileDescriptor.MODE_READ_ONLY); }
   catch (IOException error) { throw new FileNotFoundException(error.toString()); }
  }
  @Override public Uri insert(Uri uri, ContentValues values) { throw new UnsupportedOperationException(); }
  @Override public int delete(Uri uri, String selection, String[] arguments) { throw new UnsupportedOperationException(); }
  @Override public int update(Uri uri, ContentValues values, String selection, String[] arguments) { throw new UnsupportedOperationException(); }
 }
}
