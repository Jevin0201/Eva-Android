package ai.eva.android.probe;
import android.app.Activity;
import android.os.Bundle;
import android.webkit.*;
import android.widget.*;
import java.io.*;
import java.nio.file.*;
import java.util.concurrent.TimeUnit;
import org.json.JSONObject;

public class MainActivity extends Activity {
    final JSONObject report = new JSONObject();
    TextView status;
    synchronized void record(String key, Object value) {
        try {
            report.put(key, value);
            try (FileOutputStream f = openFileOutput("probe.json", MODE_PRIVATE)) {
                f.write(report.toString(2).getBytes("UTF-8"));
            }
            final String text = report.toString(2);
            runOnUiThread(() -> status.setText("Eva 环境验证（非完整代理）\n\n" + text));
        } catch (Exception e) { android.util.Log.e("EvaProbe", "record", e); }
    }
    String execute(String... args) throws Exception {
        ProcessBuilder builder = new ProcessBuilder(args).redirectErrorStream(true);
        File tmp = new File(getFilesDir(), "tmp"); tmp.mkdirs();
        builder.environment().put("PROOT_TMP_DIR", tmp.getAbsolutePath());
        builder.environment().put("PROOT_LOADER", getApplicationInfo().nativeLibraryDir + "/liboperit_loader.so");
        Process p = builder.start();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Thread reader = new Thread(() -> {
            try { byte[] b = new byte[4096]; int n;
                while ((n = p.getInputStream().read(b)) != -1) {
                    synchronized(out) { if (out.size() < 2000000) out.write(b,0,n); }
                }
            } catch (IOException ignored) {}
        });
        reader.start();
        if (!p.waitFor(120, TimeUnit.SECONDS)) { p.destroyForcibly(); reader.join(2000); throw new IOException("timeout: " + out.toString("UTF-8")); }
        reader.join(2000);
        return "exit=" + p.exitValue() + " " + out.toString("UTF-8").trim();
    }    public void onCreate(Bundle state) {
        super.onCreate(state);
        LinearLayout layout = new LinearLayout(this); layout.setOrientation(1); layout.setPadding(24,64,24,32);
        status = new TextView(this); status.setTextSize(14);
        ScrollView scroll = new ScrollView(this); scroll.addView(status);
        layout.addView(scroll, new LinearLayout.LayoutParams(-1,0,1));
        WebView web = new WebView(this); layout.addView(web, new LinearLayout.LayoutParams(-1,240)); setContentView(layout);
        record("uid", android.os.Process.myUid()); record("targetSdk", getApplicationInfo().targetSdkVersion);
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.setWebViewClient(new WebViewClient() {
            public void onPageFinished(WebView v, String url) {
                v.evaluateJavascript("document.getElementById('test').click(); document.getElementById('test').textContent", result -> record("webviewDomClick", result));
            }
        });
        web.loadDataWithBaseURL("https://eva.invalid/", "<meta name='viewport' content='width=device-width'><h3>Eva 内置 WebView 本地测试</h3><button id='test' onclick=\"this.textContent='DOM_OK'\">点击测试</button>", "text/html", "UTF-8", null);
        new Thread(() -> {
            try {
                File f = new File(getFilesDir(), "workspace-test.txt");
                Files.write(f.toPath(), "EVA_FILE_OK".getBytes("UTF-8"));
                record("fileRoundtrip", new String(Files.readAllBytes(f.toPath()), "UTF-8"));
                record("systemShell", execute("/system/bin/sh", "-c", "printf EVA_SHELL_OK"));
                File script = new File(getFilesDir(), "probe.sh");
                Files.write(script.toPath(), "#!/system/bin/sh\necho EVA_SCRIPT_OK\n".getBytes("UTF-8"));
                record("scriptChmod", script.setExecutable(true, true));
                record("interpretedScript", execute("/system/bin/sh", script.getAbsolutePath()));
                try { record("directPrivateExecution", execute(script.getAbsolutePath())); }
                catch (Exception e) { record("directPrivateExecution", e.toString()); }
                String proot = getApplicationInfo().nativeLibraryDir + "/liboperit_proot.so";
                record("prootVersion", execute(proot, "--version"));
                record("prootSystemShell", execute(proot, "/system/bin/sh", "-c", "printf EVA_PROOT_OK"));
                File privateShell = new File(getFilesDir(), "private-sh");
                Files.copy(new File("/system/bin/sh").toPath(), privateShell.toPath(), StandardCopyOption.REPLACE_EXISTING);
                privateShell.setExecutable(true, true);
                try { record("directPrivateElf", execute(privateShell.getAbsolutePath(), "-c", "printf EVA_PRIVATE_OK")); }
                catch (Exception e) { record("directPrivateElf", e.toString()); }
                record("prootPrivateElf", execute(proot, privateShell.getAbsolutePath(), "-c", "printf EVA_PRIVATE_OK"));
                File rootfs = new File(getFilesDir(), "alpine");
                if (rootfs.isDirectory()) {
                    Files.write(new File(rootfs, "etc/resolv.conf").toPath(), "nameserver 223.5.5.5\nnameserver 119.29.29.29\n".getBytes("UTF-8"));
                    record("linuxBase", execute(proot, "-0", "-r", rootfs.getAbsolutePath(), "-b", "/dev", "-b", "/proc", "-w", "/root", "/bin/sh", "-c", "export PATH=/usr/bin:/bin:/usr/sbin:/sbin; cat /etc/alpine-release; uname -m; printf EVA_LINUX_OK"));
                }
                if (rootfs.isDirectory()) {
                    record("linuxPackages", execute(proot, "-0", "-r", rootfs.getAbsolutePath(), "-b", "/dev", "-b", "/proc", "-w", "/root", "/bin/sh", "-c", "export PATH=/usr/bin:/bin:/usr/sbin:/sbin; set -e; apk --timeout 20 add python3 nodejs git; python3 --version; node --version; git --version; python3 /root/eva-smoke.py; python3 /root/test_task_runner.py"));
                }
                record("workerComplete", true);
            } catch (Exception e) { record("error", e.toString()); }
        }, "eva-probe").start();
    }
}







