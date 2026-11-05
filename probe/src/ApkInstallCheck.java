package ai.eva.android.probe;

import android.app.Instrumentation;
import android.os.Bundle;
import android.os.ParcelFileDescriptor;
import android.net.Uri;
import java.io.*;
import java.nio.file.Files;

/** Isolated checks for the per-file read-only system installer grant. */
public final class ApkInstallCheck extends Instrumentation {
    public void onCreate(Bundle args) { super.onCreate(args); start(); }
    public void onStart() {
        Bundle report = new Bundle();
        File fixture = null;
        int code = -1;
        try {
            fixture = File.createTempFile(".eva-install-check-", ".apk", WorkspaceFiles.root(getTargetContext()));
            Files.write(fixture.toPath(), new byte[]{80, 75, 3, 4});
            Uri uri = ApkInstallProvider.uri(getTargetContext(), fixture);
            try (ParcelFileDescriptor descriptor = getTargetContext().getContentResolver().openFileDescriptor(uri, "r")) {
                if (descriptor == null || descriptor.getStatSize() != 4) throw new IOException("APK read grant failed");
            }
            boolean denied = false;
            try (ParcelFileDescriptor descriptor = getTargetContext().getContentResolver().openFileDescriptor(uri, "rw")) {
                throw new IOException("APK write grant accepted");
            } catch (FileNotFoundException expected) { denied = true; }
            if (!denied) throw new IOException("APK write rejection missing");
            Uri outside = new Uri.Builder().scheme("content").authority(getTargetContext().getPackageName() + ".install")
                .appendPath("apk").appendPath("../../.eva-codex/auth.json").build();
            denied = false;
            try (ParcelFileDescriptor descriptor = getTargetContext().getContentResolver().openFileDescriptor(outside, "r")) {
                throw new IOException("Outside workspace grant accepted");
            } catch (FileNotFoundException expected) { denied = true; }
            if (!denied) throw new IOException("APK boundary rejection missing");
            report.putString("result", "PASS read-only APK provider and workspace boundary");
        } catch (Exception error) {
            code = 1; report.putString("result", "FAIL " + error.getMessage());
        } finally {
            if (fixture != null && fixture.exists() && !fixture.delete()) {
                code = 1; report.putString("cleanupError", "Cannot remove owned APK fixture");
            }
        }
        finish(code, report);
    }
}
