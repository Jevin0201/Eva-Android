package ai.eva.android.probe;

import android.os.Bundle;
import android.os.Handler;
import android.widget.*;
import java.io.*;
import java.util.concurrent.Executors;

/** Phone-local build UI over the same runtime and CLI used by the agent. */
public class AndroidBuildActivity extends ToolPageActivity {
    static final java.util.concurrent.ExecutorService worker = Executors.newSingleThreadExecutor();
    static volatile boolean busy, cancelled, installingPackages;
    static volatile Boolean toolchainReady;
    static volatile Process process;
    static volatile String result = "", state = "就绪";
    final Handler handler = new Handler();
    EditText project, destination;
    TextView status, log;
    Button install, build, check, cancel;
    final Runnable repaint = new Runnable() {
        public void run() {
            status.setText(state);
            if (!log.getText().toString().equals(result)) log.setText(result);
            install.setEnabled(!busy); build.setEnabled(!busy); check.setEnabled(!busy);
            cancel.setEnabled(busy);
            handler.postDelayed(this, 400);
        }
    };

    public void onCreate(Bundle saved) {
        super.onCreate(saved);
        page("从源码构建 APK", "");
        if (!busy && result.isEmpty()) {
            android.content.SharedPreferences savedState = getSharedPreferences("eva-android-build", 0);
            result = savedState.getString("lastOutput", "");
            state = savedState.getString("lastState", "就绪");
        }
        body.addView(label("使用手机本地的 ARM64 SDK、JDK 和 Gradle。源码与交付目录位于工作区。", 13));
        body.addView(label("源码项目目录", 12));
        String selectedFolder = getIntent().getStringExtra("folder");
        project = input("项目路径", selectedFolder == null ? getSharedPreferences("eva-android-build", 0).getString("project", "/root/eva-workspace/") : "/root/eva-workspace/" + selectedFolder);
        body.addView(label("APK 交付目录", 12));
        destination = input("新的 APK 交付目录", "/root/eva-workspace/apk-" + System.currentTimeMillis());
        check = button("检查工具链", () -> execute("status")); body.addView(check);
        install = button("安装构建工具链", () -> execute("install")); body.addView(install);
        build = button("构建调试 APK", () -> execute("build")); body.addView(build);
        cancel = button("停止构建", () -> { cancelled = true; state = installingPackages ? "等待依赖事务结束后停止…" : "正在停止…"; Process active = process; if (active != null && !installingPackages) active.destroy(); }); body.addView(cancel);
        status = label(state, 13); body.addView(status);
        ScrollView scroll = new ScrollView(this);
        log = label(result, 11); log.setTypeface(android.graphics.Typeface.MONOSPACE); log.setTextIsSelectable(true);
        scroll.addView(log); body.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));
        if (!busy && result.isEmpty()) execute("status");
    }

    EditText input(String hint, String value) {
        EditText field = new EditText(this);
        field.setTextSize(13); field.setTextColor(ink); field.setHint(hint); field.setText(value);
        field.setSingleLine(true); body.addView(field); return field;
    }

    void execute(String action) {
        synchronized (AndroidBuildActivity.class) {
            if (busy) return;
            busy = true; cancelled = false;
        }
        final String source = project.getText().toString().trim();
        final String output = destination.getText().toString().trim();
        getSharedPreferences("eva-android-build", 0).edit().putString("project", source).apply();
        result = ""; toolchainReady = null; state = "正在运行";
        android.content.Context context = getApplicationContext();
        worker.execute(() -> {
            try {
                OfficeRuntime.deploy(context);
                if (cancelled) throw new InterruptedException("已取消");
                if (action.equals("install")) {
                    ProcessBuilder packages = OfficeRuntime.process(context, "status");
                    java.util.List<String> command = packages.command();
                    command.set(command.indexOf("/root/eva-office.py"), "/root/.eva-runtime/eva-capabilities.py");
                    command.set(command.size() - 1, "install");
                    command.addAll(java.util.Arrays.asList("--apk", "openjdk17-jdk", "gradle"));
                    installingPackages = true;
                    try { consume(LinuxRuntime.start(context, packages)); }
                    finally { installingPackages = false; }
                }
                if (cancelled) throw new InterruptedException("已取消");
                ProcessBuilder builder = OfficeRuntime.process(context, action);
                java.util.List<String> command = builder.command();
                command.set(command.indexOf("/root/eva-office.py"), "/root/.eva-runtime/eva-android-build.py");
                if (action.equals("build")) command.addAll(java.util.Arrays.asList("--project", source, "--output-dir", output));
                consume(LinuxRuntime.start(context, builder));
                state = cancelled ? "已取消" : action.equals("status")
                    ? (Boolean.TRUE.equals(toolchainReady) ? "工具链已就绪" : "工具链未就绪") : "已完成";
            } catch (Exception error) {
                state = cancelled ? "已取消" : "执行失败"; result += "\n" + error.getMessage();
            } finally {
                process = null; busy = false;
                context.getSharedPreferences("eva-android-build", 0).edit().putString("lastOutput", result).putString("lastState", state).apply();
            }
        });
    }

    static void consume(Process child) throws Exception {
        process = child;
        if (cancelled && !installingPackages) child.destroy();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(child.getInputStream(), "UTF-8"))) {
            String line;
            while ((line = reader.readLine()) != null) {
                try {
                    org.json.JSONObject row = new org.json.JSONObject(line);
                    if (row.has("ready")) toolchainReady = row.getBoolean("ready");
                } catch (org.json.JSONException ignored) {}
                String next = result + line + "\n";
                result = next.length() > 150000 ? next.substring(next.length() - 150000) : next;
            }
        }
        if (child.waitFor() != 0) throw new IOException("请检查构建日志后重试");
    }

    protected void onResume() { super.onResume(); handler.post(repaint); }
    protected void onPause() { handler.removeCallbacks(repaint); super.onPause(); }
}
