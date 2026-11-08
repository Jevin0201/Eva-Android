package ai.eva.android.probe;

import android.content.Context;
import java.io.*;
import java.nio.file.Files;
import java.util.*;
import java.util.concurrent.TimeUnit;
import org.json.*;

/** Lifecycle adapter for the user's already installed standalone DSH service. */
final class LocalFreeModels {
    static final String URL = DshAvailability.URL;
    private static KernelNetwork network;
    private static Process managedProcess;

    // DSH connectivity checks run independently of model selection and UI lifetime.
    static void refreshCatalogAsync(Context original, Runnable updated) {
        DshModelMonitor.refresh(original, false);
    }
    static void ensureProvider(Context context, JSONObject provider) throws Exception {
        if (URL.equals(provider.optString("url"))) ensure(context);
    }
    // The native core accepts a fixed effort enum. DSH exposes additional real
    // values (off/light/balanced/deep), transported in its documented model suffix.
    static JSONObject turnOptions(JSONObject provider, JSONObject params) throws Exception {
        if (!URL.equals(provider.optString("url")) || !"chat_completions".equals(provider.optString("protocol"))) return params;
        String effort = params.optString("effort", params.optString("reasoningEffort", ""));
        if (effort.isEmpty()) return params;
        if (!effort.matches("[A-Za-z0-9_-]{1,40}")) throw new IOException("DSH插件推理档位格式无效");
        String model = params.optString("model");
        if (model.isEmpty()) throw new IOException("DSH插件缺少模型 ID");
        params.put("model", model + "(" + effort + ")");
        params.remove("effort"); params.remove("reasoningEffort");
        return params;
    }
    private static boolean healthy() {
        java.net.HttpURLConnection connection = null;
        try {
            connection = (java.net.HttpURLConnection) new java.net.URL("http://127.0.0.1:18900/health").openConnection(java.net.Proxy.NO_PROXY);
            connection.setConnectTimeout(800); connection.setReadTimeout(800);
            try (InputStream input = connection.getInputStream()) {
                ByteArrayOutputStream output = new ByteArrayOutputStream();
                byte[] bytes = new byte[1024]; int count;
                while ((count = input.read(bytes)) != -1) { output.write(bytes, 0, count); if (output.size() > 4096) return false; }
                return new JSONObject(output.toString("UTF-8")).optString("service").equals("our-free-model-standalone");
            }
        } catch (Exception ignored) { return false; }
        finally { if (connection != null) connection.disconnect(); }
    }
    static synchronized void ensure(Context context) throws Exception {
        if (managedProcess != null && healthy()) return;
        File project = new File(context.getFilesDir(), "alpine/root/eva-workspace/projects/our-free-model-eva");
        if (!new File(project, "packages/standalone/cli.mjs").isFile()) throw new IOException("DSH插件项目未安装，请先在工作区安装 dsh-our-free-model 的 standalone 服务");
        File launcher = new File(context.getFilesDir(), "alpine/root/.eva-runtime/eva-local-free-models.py");
        launcher.getParentFile().mkdirs();
        for (String asset : new String[]{"eva-local-free-models.py", "eva-local-free-models-compat.py"}) {
            File destination = new File(launcher.getParentFile(), asset);
            try (InputStream input = context.getAssets().open("office/" + asset); OutputStream output = new FileOutputStream(destination)) {
                byte[] buffer = new byte[8192]; int count;
                while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
            }
        }
        if (network == null) network = new KernelNetwork();
        ProcessBuilder builder = OfficeRuntime.process(context);
        List<String> command = builder.command();
        command.set(command.size() - 1, "/root/.eva-runtime/eva-local-free-models.py");
        Map<String, String> env = builder.environment();
        for (String key : new String[]{"HTTPS_PROXY", "HTTP_PROXY", "https_proxy", "http_proxy"}) env.put(key, network.proxyUrl);
        env.put("NO_PROXY", "localhost,127.0.0.1,::1");
        env.put("no_proxy", "localhost,127.0.0.1,::1");
        String readyToken = java.util.UUID.randomUUID().toString();
        env.put("EVA_LOCAL_READY_TOKEN", readyToken);
        File result = File.createTempFile("eva-local-service-", ".log", context.getCacheDir());
        try {
            builder.redirectErrorStream(true).redirectOutput(result);
            Process process = LinuxRuntime.start(context, builder);
            long deadline = android.os.SystemClock.elapsedRealtime() + 25000;
            // PRoot remains alive while tracking the detached Node child. The
            // launcher acknowledges readiness independently of tracer exit.
            while (android.os.SystemClock.elapsedRealtime() < deadline) {
                if (result.length() <= 16384) {
                    String text = new String(Files.readAllBytes(result.toPath()), "UTF-8");
                    for (String line : text.split("\\r?\\n")) if (line.startsWith("EVA_LOCAL_ERROR:")) {
                        process.destroy();
                        throw new IOException(line.substring("EVA_LOCAL_ERROR:".length()));
                    }
                    if (java.util.Arrays.asList(text.split("\\r?\\n")).contains("EVA_LOCAL_READY:" + readyToken) && healthy()) {
                        managedProcess = process;
                        return;
                    }
                }
                if (process.waitFor(100, TimeUnit.MILLISECONDS) && process.exitValue() != 0) break;
                Thread.sleep(100);
            }
            process.destroyForcibly();
            throw new IOException("DSH插件服务尚未确认就绪，请检查项目数据目录中的 eva-service.log");
        } finally { result.delete(); }
    }
    static String install(Context context) throws Exception {
        ensure(context);
        File settings = new File(context.getFilesDir(), "alpine/root/eva-workspace/projects/our-free-model-eva-data/settings.json");
        JSONObject config = new JSONObject(new String(Files.readAllBytes(settings.toPath()), "UTF-8"));
        String key = config.getString("forwardKey");
        if (key.isEmpty()) throw new IOException("本机服务尚未生成访问凭据");
        ModelStore store = new ModelStore(context);
        String id = "", model = "kilo-auto/free";
        JSONArray providers = store.read().getJSONArray("providers");
        for (int i = 0; i < providers.length(); i++) {
            JSONObject provider = providers.getJSONObject(i);
            if (URL.equals(provider.optString("url"))) { id = provider.getString("id"); model = provider.optString("model", model); break; }
        }
        String credential = !id.isEmpty() && key.equals(store.secret(store.provider(id))) ? "" : key;
        id = store.save(id, "DSH插件", URL, model, credential);
        JSONObject provider = store.provider(id);
        JSONObject catalog = ModelClient.request(provider, key, "models", null, new ModelClient.Job());
        JSONArray rows = catalog.getJSONArray("data");
        if (rows.length() == 0) throw new IOException("服务已接入，模型列表仍在加载，请稍后刷新");
        store.cacheModels(id, rows);
        return id;
    }
}
