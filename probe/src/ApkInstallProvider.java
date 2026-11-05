package ai.eva.android.probe;

import android.content.*;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import java.io.*;

/** Read-only, per-URI grants for APKs explicitly opened in the workspace. */
public final class ApkInstallProvider extends ContentProvider {
    static final String MIME = "application/vnd.android.package-archive";
    static Uri uri(Context context, File source) throws IOException {
        File root = WorkspaceFiles.root(context);
        File file = source.getCanonicalFile();
        if (!file.toPath().startsWith(root.toPath())) throw new IOException("安装包不在工作区");
        String relative = root.toPath().relativize(file.toPath()).toString();
        return new Uri.Builder().scheme("content").authority(context.getPackageName() + ".install")
            .appendPath("apk").appendPath(relative).build();
    }
    File file(Uri uri) throws FileNotFoundException {
        try {
            if (!"content".equals(uri.getScheme()) || !uri.getAuthority().equals(getContext().getPackageName() + ".install")
                || uri.getPathSegments().size() != 2 || !uri.getPathSegments().get(0).equals("apk")) throw new IOException("安装地址无效");
            File file = WorkspaceFiles.resolve(getContext(), uri.getPathSegments().get(1));
            if (!file.isFile() || !file.getName().toLowerCase(java.util.Locale.ROOT).endsWith(".apk")) throw new IOException("请选择 APK 文件");
            return file;
        } catch (Exception error) {
            throw new FileNotFoundException("无法读取所选安装包");
        }
    }
    public boolean onCreate() { return true; }
    public String getType(Uri uri) { return MIME; }
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        if (!"r".equals(mode)) throw new FileNotFoundException("安装包只读");
        File checked = file(uri);
        ParcelFileDescriptor descriptor = ParcelFileDescriptor.open(checked, ParcelFileDescriptor.MODE_READ_ONLY);
        try {
            File opened = new File(android.system.Os.readlink("/proc/self/fd/" + descriptor.getFd())).getCanonicalFile();
            if (!opened.toPath().startsWith(WorkspaceFiles.root(getContext()).toPath()) || !opened.equals(checked))
                throw new IOException("安装包位置已变化");
            return descriptor;
        } catch (Exception error) {
            try { descriptor.close(); } catch (IOException ignored) {}
            throw new FileNotFoundException("安装包位置已变化，请重新选择");
        }
    }
    public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs, String order) {
        try {
            File file = file(uri);
            String[] columns = projection == null ? new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE} : projection;
            MatrixCursor cursor = new MatrixCursor(columns);
            Object[] row = new Object[columns.length];
            for (int index = 0; index < columns.length; index++) {
                if (OpenableColumns.DISPLAY_NAME.equals(columns[index])) row[index] = file.getName();
                else if (OpenableColumns.SIZE.equals(columns[index])) row[index] = file.length();
            }
            cursor.addRow(row);
            return cursor;
        } catch (FileNotFoundException error) { throw new IllegalArgumentException(error.getMessage()); }
    }
    public Uri insert(Uri uri, ContentValues values) { throw new UnsupportedOperationException("只读"); }
    public int update(Uri uri, ContentValues values, String where, String[] args) { throw new UnsupportedOperationException("只读"); }
    public int delete(Uri uri, String where, String[] args) { throw new UnsupportedOperationException("只读"); }
}
