package ai.eva.android.probe;

import android.content.Context;
import android.os.SystemClock;
import java.io.*;
import java.nio.file.Files;
import java.util.*;
import java.util.concurrent.TimeUnit;
import org.json.JSONObject;
import org.json.JSONArray;

/** Private, stateless wire adapter for Chat Completions providers. */
final class ModelProtocolGateway {
    private static final Map<String, Instance> instances = new HashMap<>();
    private static final class Instance {
        final String revision, url;
        final Process process;
        Instance(String revision, String url, Process process) {
            this.revision = revision; this.url = url; this.process = process;
        }
    }
    static synchronized String baseUrl(Context context, JSONObject provider) throws Exception {
        String protocol = provider.optString("protocol", "responses");
        if (protocol.equals("responses")) return provider.getString("url");
        if (!protocol.equals("chat_completions")) throw new IOException("不支持的模型接口协议，请检查提供商设置");
        String id = provider.getString("id"), revision = ModelStore.connectionRevision(provider);
        Instance previous = instances.get(id);
        if (previous != null && previous.revision.equals(revision) && previous.process.isAlive()) return previous.url;
        if (previous != null) { previous.process.destroy(); instances.remove(id); }
        File launcher = new File(context.getFilesDir(), "alpine/root/.eva-runtime/eva-model-gateway.py");
        if (!launcher.getParentFile().isDirectory() && !launcher.getParentFile().mkdirs()) throw new IOException("无法创建模型协议适配目录");
        try (InputStream input = context.getAssets().open("office/eva-model-gateway.py"); OutputStream output = new FileOutputStream(launcher)) {
            byte[] buffer = new byte[8192]; int count;
            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
        }
        ProcessBuilder builder = OfficeRuntime.process(context);
        List<String> command = builder.command();
        command.set(command.size() - 1, "/root/.eva-runtime/eva-model-gateway.py");
        String token = UUID.randomUUID().toString();
        builder.environment().put("EVA_MODEL_GATEWAY_CONFIG", new JSONObject()
            .put("url", provider.getString("url")).put("key", new ModelStore(context).secret(provider)).toString());
        builder.environment().put("EVA_MODEL_GATEWAY_READY", token);
        File ready = File.createTempFile("eva-model-gateway-", ".log", context.getCacheDir());
        Process child = null;
        boolean accepted = false;
        try {
            child = LinuxRuntime.start(context, builder.redirectErrorStream(true).redirectOutput(ready));
            long deadline = SystemClock.elapsedRealtime() + 20000;
            while (SystemClock.elapsedRealtime() < deadline) {
                if (ready.length() < 16384) {
                    String text = new String(Files.readAllBytes(ready.toPath()), "UTF-8");
                    for (String line : text.split("\\r?\\n")) {
                        try {
                            JSONObject message = new JSONObject(line);
                            if (!token.equals(message.optString("ready"))) continue;
                            int port = message.getInt("port");
                            if (port < 1 || port > 65535) throw new IOException("模型协议适配端口无效");
                            String url = "http://127.0.0.1:" + port + "/v1";
                            instances.put(id, new Instance(revision, url, child)); accepted = true;
                            return url;
                        } catch (org.json.JSONException ignored) { }
                    }
                }
                if (child.waitFor(100, TimeUnit.MILLISECONDS)) break;
            }
            throw new IOException("模型协议适配启动失败，请检查运行环境后重试");
        } finally {
            if (!accepted && child != null) child.destroyForcibly();
            ready.delete();
        }
    }
    static synchronized String currentBaseUrl(JSONObject provider) throws Exception {
        Instance instance = instances.get(provider.getString("id"));
        if (instance != null && instance.process.isAlive() && instance.revision.equals(ModelStore.connectionRevision(provider))) return instance.url;
        return provider.getString("url");
    }
    static synchronized void prune(Context context) throws Exception {
        JSONArray providers = new ModelStore(context).read().getJSONArray("providers");
        Set<String> retained = new HashSet<>();
        for (int i = 0; i < providers.length(); i++) {
            JSONObject provider = providers.getJSONObject(i);
            Instance instance = instances.get(provider.getString("id"));
            if (instance != null && provider.optString("protocol", "responses").equals("chat_completions") && instance.revision.equals(ModelStore.connectionRevision(provider))) retained.add(provider.getString("id"));
        }
        prune(retained);
    }
    static synchronized void prune(Set<String> retained) {
        Iterator<Map.Entry<String, Instance>> iterator = instances.entrySet().iterator();
        while (iterator.hasNext()) {
            Map.Entry<String, Instance> entry = iterator.next();
            if (!retained.contains(entry.getKey())) { entry.getValue().process.destroy(); iterator.remove(); }
        }
    }
}
