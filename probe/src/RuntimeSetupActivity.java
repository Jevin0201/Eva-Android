package ai.eva.android.probe;

import android.app.*;
import android.content.*;
import android.os.*;
import android.view.View;
import android.widget.*;
import org.json.JSONObject;

/** First-run deployment state is independent of model credentials and phone-control authorization. */
public final class RuntimeSetupActivity extends ToolPageActivity {
    private static final java.util.concurrent.ExecutorService checking = java.util.concurrent.Executors.newSingleThreadExecutor();
    private final Handler handler = new Handler(Looper.getMainLooper());
    private TextView summary, details, localError;
    private ProgressBar progress;
    private Button retry, cancel, done;
    private String displayed = "";
    private final Runnable refresh = new Runnable() {
        public void run() { renderStatus(); handler.postDelayed(this, 1000); }
    };
    static void checkOnLaunch(Activity activity) {
        checking.execute(() -> {
            try {
                JSONObject state = RuntimeBootstrap.status(activity.getApplicationContext());
                if (state.optBoolean("ready")) return;
                boolean stopped = state.optBoolean("cancelled") || "cancelled".equals(state.optString("stage")) || "error".equals(state.optString("stage"));
                activity.runOnUiThread(() -> {
                    if (activity.isFinishing() || activity.isDestroyed()) return;
                    if (!stopped) {
                        try { RuntimeSetupService.launch(activity, false); }
                        catch (Exception error) { android.util.Log.w("EvaRuntime", "Automatic setup needs foreground retry", error); }
                    }
                    if (!activity.getIntent().hasExtra("page")) activity.startActivity(new Intent(activity, RuntimeSetupActivity.class));
                });
            } catch (Exception error) { android.util.Log.w("EvaRuntime", "Runtime startup status unavailable", error); }
        });
    }
    public void onCreate(Bundle state) {
        super.onCreate(state);
        page("运行环境", "");
        ScrollView scroll = new ScrollView(this);
        LinearLayout content = new LinearLayout(this); content.setOrientation(1);
        scroll.addView(content); body.addView(scroll, new LinearLayout.LayoutParams(-1, -1)); body = content;
        section("手机本地执行环境");
        body.addView(label("首次打开自动部署，需要联网并保留至少 6 GiB 可用空间。部署完成后配置自己的模型服务。失败可重试继续，已有会话与工作区保留。",13));
        summary = label("正在检查运行环境", 16); statusCard(summary); body.addView(summary);
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal); progress.setMax(100); body.addView(progress);
        details = label("", 13); body.addView(details);
        localError = label("", 13); body.addView(localError);
        retry = button("重试部署", () -> launch(true)); body.addView(retry);
        cancel = button("取消部署", () -> { RuntimeBootstrap.cancel(this); stopService(new Intent(this, RuntimeSetupService.class)); renderStatus(); }); body.addView(cancel);
        done = button("返回 Eva", () -> { if(RuntimeBootstrap.status(this).optBoolean("ready"))startActivity(new Intent(this,ModelsActivity.class));finish(); }); body.addView(done);
        section("系统授权与账号");
        body.addView(label("运行环境部署不需要配置模型。手机控制、Shizuku 和账号按各自入口设置。", 13));
        body.addView(button("手机控制与系统授权", () -> startActivity(new Intent(this, PhoneControlActivity.class))));
        body.addView(button("账号与模型", () -> startActivity(new Intent(this, ModelsActivity.class))));
        section("组件来源");
        body.addView(button("运行环境许可证与对应源码", () -> {
            try(java.io.InputStream in=getAssets().open("runtime/NOTICE.txt");java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream()){
                byte[] buffer=new byte[4096];int count;while((count=in.read(buffer))!=-1){if(out.size()+count>65536)throw new java.io.IOException("来源声明过大");out.write(buffer,0,count);}
                out.write("\n\nEva Android\n".getBytes("UTF-8"));
                try(java.io.InputStream license=getAssets().open("EVA_LICENSE.md")){while((count=license.read(buffer))!=-1){if(out.size()+count>65536)throw new java.io.IOException("许可声明过大");out.write(buffer,0,count);}}
                new AlertDialog.Builder(this).setTitle("许可与来源").setMessage(out.toString("UTF-8")).setPositiveButton("关闭",null).show();
            }catch(Exception error){localError.setText(error.getMessage());}
        }));
        section("诊断");
        body.addView(button("运行环境诊断", () -> startActivity(new Intent(this, MainActivity.class))));
        renderStatus();
    }
    private void launch(boolean reset) {
        try { localError.setText(""); RuntimeSetupService.launch(this, reset); }
        catch (Exception error) { localError.setText("系统暂不允许后台部署，请保持本页打开后重试。\n" + error.getMessage()); }
        renderStatus();
    }
    static String stageLabel(String stage) {
        switch (stage) {
            case "checking": return "检查环境";
            case "interrupted": return "恢复中断部署";
            case "downloading": return "下载组件";
            case "extracting": return "解压部署";
            case "dependencies": return "部署完整依赖";
            case "verifying": return "校验与运行自检";
            case "ready": return "运行环境已就绪";
            case "error": return "部署未完成";
            case "cancelled": return "部署已取消";
            default: return "准备运行环境";
        }
    }
    private void renderStatus() {
        try {
            JSONObject state = RuntimeBootstrap.status(this);
            String next = state.toString();
            if (next.equals(displayed)) return;
            displayed = next;
            boolean ready = state.optBoolean("ready"), running = state.optBoolean("running");
            summary.setText(ready ? "运行环境已就绪" : stageLabel(state.optString("stage")));
            int value = Math.max(0, Math.min(100, state.optInt("progress", 0)));
            progress.setIndeterminate(running && (value == 0 || "dependencies".equals(state.optString("stage")))); progress.setProgress(value); progress.setVisibility(ready ? View.GONE : View.VISIBLE);
            String message = state.optString("message"), error = state.optString("error");
            details.setText(message + (error.isEmpty() ? "" : "\n" + error));
            retry.setVisibility(ready || running ? View.GONE : View.VISIBLE);
            retry.setText("idle".equals(state.optString("stage")) ? "开始部署" : "重试部署");
            cancel.setVisibility(running ? View.VISIBLE : View.GONE);
            done.setText(ready ? "完成部署并配置模型" : "返回 Eva");
        } catch (Exception error) { summary.setText("无法读取部署状态"); localError.setText(String.valueOf(error.getMessage())); }
    }
    protected void onResume() { super.onResume(); handler.post(refresh); }
    protected void onPause() { handler.removeCallbacks(refresh); super.onPause(); }
}
