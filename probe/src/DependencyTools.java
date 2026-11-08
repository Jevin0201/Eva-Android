package ai.eva.android.probe;

import java.io.*;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.*;
import java.util.concurrent.*;
import org.json.*;

/** Task-scoped dependency diagnosis and repair through Eva's private Linux runtime. */
final class DependencyTools {
    private static final ExecutorService worker = Executors.newFixedThreadPool(2);
    static final int MAX_OUTPUT = 256 * 1024;
    static final String RECOVERY_NEXT_ACTION = "按 error/results 调查当前失败项。若尚无对应环境 recipe，继续读取项目官方安装说明，核对 Alpine/ARM64/Java 版本，使用已有终端、签名仓库或隔离官方安装器补齐并实际验证。仅在确证架构、权限、账号或全部可用来源阻断后报告具体证据。";
    static final String INPUT_EXAMPLE = "{\"action\":\"ensure\",\"requirements\":[{\"kind\":\"python\",\"name\":\"pyfiglet\",\"module\":\"pyfiglet\",\"version\":\"1.0.2\"},{\"kind\":\"npm\",\"name\":\"is-number\",\"version\":\"7.0.0\"}]}";
    static final String INPUT_NEXT_ACTION = "修正调用参数后重试；本次尚未执行依赖检查或安装。使用 inputExample 的对象结构，按当前任务替换依赖。requirements 每项使用 kind（不是 type），npm 包名使用 name；python 是模块对象数组，不是字符串数组；没有顶层 npm 字段。至少提供一项依赖。不要因参数错误调查网络、镜像或安装环境。";

    static final class RequestError extends IOException {
        RequestError(Exception cause) { super("依赖调用参数无效：" + String.valueOf(cause.getMessage()), cause); }
    }

    static JSONObject requestErrorResult(RequestError error) throws JSONException {
        return new JSONObject().put("ready", false).put("cancelled", false).put("errorType", "invalid_request")
            .put("error", error.getMessage()).put("nextAction", INPUT_NEXT_ACTION).put("inputExample", new JSONObject(INPUT_EXAMPLE));
    }

    static JSONObject spec() throws Exception {
        JSONObject item = new JSONObject().put("type", "object").put("additionalProperties", false)
            .put("properties", new JSONObject().put("module", new JSONObject().put("type", "string"))
                .put("package", new JSONObject().put("type", "string"))
                .put("version", new JSONObject().put("type", "string")))
            .put("required", new JSONArray().put("module"));
        JSONObject requirement = new JSONObject().put("type", "object").put("additionalProperties", false)
            .put("properties", new JSONObject().put("kind", new JSONObject().put("type", "string").put("enum", new JSONArray(new String[]{"python", "npm", "java", "android", "system"})))
                .put("name", new JSONObject().put("type", "string")).put("module", new JSONObject().put("type", "string"))
                .put("version", new JSONObject().put("type", "string")).put("binary", new JSONObject().put("type", "string"))
                .put("profile", new JSONObject().put("type", "string")))
            .put("required", new JSONArray().put("kind"));
        JSONObject pythonRequirement = new JSONObject(requirement.toString());
        pythonRequirement.getJSONObject("properties").put("kind", new JSONObject().put("type", "string").put("enum", new JSONArray().put("python")))
            .put("package", new JSONObject().put("type", "string").put("description", "Python-only alias for name. If both are supplied they must be identical."));
        requirement.getJSONObject("properties").getJSONObject("kind").put("enum", new JSONArray(new String[]{"npm", "java", "android", "system"}));
        JSONObject requirementItem = new JSONObject().put("anyOf", new JSONArray().put(pythonRequirement).put(requirement));
        JSONObject properties = new JSONObject().put("action", new JSONObject().put("type", "string")
            .put("enum", new JSONArray().put("status").put("ensure")))
            .put("python", new JSONObject().put("type", "array").put("minItems", 1).put("maxItems", 16).put("items", item))
            .put("requirements", new JSONObject().put("type", "array").put("minItems", 1).put("maxItems", 16).put("items", requirementItem));
        return new JSONObject().put("name", "eva_dependencies")
            .put("description", "Check, repair, verify and continue dependencies needed by the current authorized task: Python imports/pip, npm modules or CLI tools, Java, Android SDK and signed system packages. Prefer existing managed capabilities, otherwise use official sources and isolated project environments. Supply at least one requirement with its real package/module/version or known profile; never guess unknown package names. Legacy python[] remains supported. Project scope is injected by Eva. status reports actual availability; ensure repairs recoverable gaps and verifies imports/binaries before ready=true. Use returned commands/environment/pythonExecutable for the original task. Missing pip/npm/Java/SDK is not a reason to abandon or downgrade immediately. Respect existing large-component confirmation and prior user authorization; do not ask for the same approval again. Failures preserve environment and return diagnostics for safe retry. Canonical JSON example: " + INPUT_EXAMPLE + ". Use kind, not type; npm package names go in name. python[] contains objects, never strings. There is no top-level npm field. Include only dependencies needed for the current task.")
            .put("inputSchema", new JSONObject().put("type", "object").put("properties", properties)
                .put("anyOf", new JSONArray().put(new JSONObject().put("required", new JSONArray().put("python")))
                    .put(new JSONObject().put("required", new JSONArray().put("requirements"))))
                .put("required", new JSONArray().put("action")).put("additionalProperties", false));
    }

    static JSONObject prepare(JSONObject arguments, String cwd) throws Exception {
        try { return prepareRequest(arguments, cwd); }
        catch (Exception error) { throw new RequestError(error); }
    }

    private static JSONObject prepareRequest(JSONObject arguments, String cwd) throws Exception {
        if (cwd == null || cwd.length() > 4096 || cwd.indexOf(0) >= 0) throw new IOException("依赖安装缺少当前任务工作区");
        String project = Paths.get(cwd).normalize().toString();
        if (!project.equals("/root/eva-workspace") && !project.startsWith("/root/eva-workspace/"))
            throw new IOException("依赖环境必须位于当前任务工作区");
        Iterator<String> fields = arguments.keys();
        while (fields.hasNext()) if (!Arrays.asList("action", "python", "requirements").contains(fields.next()))
            throw new IOException("依赖请求包含未知字段或工作区覆盖");
        String action = arguments.getString("action");
        if (!action.equals("status") && !action.equals("ensure")) throw new IOException("未知依赖操作");
        JSONArray modules = arguments.has("python") ? arguments.getJSONArray("python") : new JSONArray();
        JSONArray requirements = arguments.has("requirements") ? new JSONArray(arguments.getJSONArray("requirements").toString()) : new JSONArray();
        if ((arguments.has("python") && modules.length() == 0) || (arguments.has("requirements") && requirements.length() == 0))
            throw new IOException("依赖数组至少需要一项");
        if (modules.length() + requirements.length() < 1 || modules.length() + requirements.length() > 16)
            throw new IOException("请指定 1 至 16 项当前任务所需依赖");
        for (int i = 0; i < requirements.length(); i++) {
            JSONObject requirement = requirements.getJSONObject(i);
            String kind = requirement.getString("kind");
            if (!Arrays.asList("python", "npm", "java", "android", "system").contains(kind)) throw new IOException("未知依赖类型");
            Iterator<String> keys = requirement.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                if (!Arrays.asList("kind", "name", "module", "version", "binary", "profile", "package").contains(key)) throw new IOException("依赖包含未知字段");
                Object value = requirement.get(key);
                if (!(value instanceof String)) throw new IOException("依赖字段类型无效");
                String text = (String) value;
                if (text.isEmpty() || text.length() > 200 || text.indexOf(0) >= 0 || text.contains("\n") || text.contains("\r")) throw new IOException("依赖字段无效");
            }
            if (requirement.has("package")) {
                if (!kind.equals("python")) throw new IOException("package 仅是 Python 依赖 name 的别名");
                String alias = requirement.getString("package");
                if (!alias.matches("[A-Za-z0-9][A-Za-z0-9._-]{0,199}")) throw new IOException("Python 发行包名无效");
                if (requirement.has("name") && !requirement.getString("name").equals(alias)) throw new IOException("Python 依赖 name 与 package 冲突");
                requirement.put("name", alias);
                requirement.remove("package");
            }
            if (requirement.has("name") && !requirement.getString("name").matches("[A-Za-z0-9@][A-Za-z0-9@._/+~-]{0,199}")) throw new IOException("依赖包名无效，请提供官方发行包名");
            if (requirement.has("version") && !requirement.getString("version").matches("[A-Za-z0-9][A-Za-z0-9.!+_-]{0,79}")) throw new IOException("依赖版本无效");
            if (requirement.has("binary") && !requirement.getString("binary").matches("[A-Za-z0-9][A-Za-z0-9._+-]{0,127}")) throw new IOException("工具名称无效");
            if (requirement.has("profile") && !requirement.getString("profile").matches("[A-Za-z0-9][A-Za-z0-9._-]{0,79}")) throw new IOException("能力配置名称无效");
            if (kind.equals("python") && requirement.has("module") && !requirement.getString("module").matches("[A-Za-z_][A-Za-z0-9_]*(\\.[A-Za-z_][A-Za-z0-9_]*)*")) throw new IOException("Python 模块名无效");
        }
        for (int i = 0; i < modules.length(); i++) {
            JSONObject module = modules.getJSONObject(i);
            Iterator<String> keys = module.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                if (!Arrays.asList("module", "package", "version").contains(key)) throw new IOException("Python 依赖包含未知字段");
                if (!(module.get(key) instanceof String) || module.getString(key).length() > 200) throw new IOException("Python 依赖字段类型或长度无效");
            }
            if (!module.getString("module").matches("[A-Za-z_][A-Za-z0-9_]*(\\.[A-Za-z_][A-Za-z0-9_]*)*"))
                throw new IOException("Python 模块名无效");
            if (module.has("package") && !module.getString("package").matches("[A-Za-z0-9][A-Za-z0-9._-]{0,199}"))
                throw new IOException("Python 发行包名无效");
            if (module.has("version") && !module.getString("version").matches("[A-Za-z0-9][A-Za-z0-9.!+_-]{0,79}"))
                throw new IOException("Python 包版本无效");
        }
        return new JSONObject().put("action", action).put("projectPath", project).put("python", new JSONArray(modules.toString())).put("requirements", new JSONArray(requirements.toString()));
    }

    static JSONObject parseOutput(String text, int exitCode, boolean requiresPython) throws Exception {
        JSONObject result = null;
        for (String line : text.split("\\r?\\n")) {
            try {
                JSONObject candidate = new JSONObject(line);
                if (candidate.opt("ready") instanceof Boolean) result = candidate;
            } catch (JSONException ignored) { }
        }
        if (result == null) result = new JSONObject().put("ready", false).put("error", "依赖执行器未返回完整验证结果");
        if (exitCode != 0) {
            boolean inconsistent = result.optBoolean("ready");
            result.put("ready", false);
            // The dispatcher uses exit 1 for an inspected but missing dependency.
            // Keep those concrete per-item results rather than claiming a crash.
            if ((inconsistent || result.optJSONArray("results") == null) && (!result.has("error") || result.isNull("error") || result.optString("error").isEmpty())) result.put("error", "依赖执行器失败，请检查实际诊断和安装日志");
        }
        if (result.has("error") && !result.isNull("error") && !result.optString("error").isEmpty()) result.put("ready", false);
        if (result.optBoolean("ready")) {
            JSONArray results = result.optJSONArray("results");
            if (results == null || results.length() == 0) result.put("ready", false).put("error", "依赖执行器缺少逐项验证结果");
            else for (int i = 0; i < results.length(); i++) if (!results.getJSONObject(i).optBoolean("ready")) result.put("ready", false).put("error", "存在尚未通过验证的依赖");
        }
        if (result.optBoolean("ready") && requiresPython) {
            String python = result.optString("pythonExecutable");
            if (!python.startsWith("/") || python.indexOf(0) >= 0 || python.contains("\n") || python.contains("\r"))
                result.put("ready", false).put("error", "依赖检查缺少可核验的 Python 执行路径");
        }
        result.put("exitCode", exitCode);
        if (!result.optBoolean("ready")) {
            result.put("diagnostics", text.substring(Math.max(0, text.length() - 12000)));
            if (!result.has("nextAction")) result.put("nextAction", result.optBoolean("cancelled") ? "原任务已取消，不继续安装或重跑；后续任务先 status 核验环境。" : RECOVERY_NEXT_ACTION);
        }
        return result;
    }

    private static String redact(KernelHost host, ProcessBuilder builder, String text) {
        text = host.redact(text);
        for (String key : new String[]{"HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy"}) {
            String proxy = builder.environment().get(key);
            if (proxy == null || proxy.isEmpty()) continue;
            text = text.replace(proxy, "[Eva 本机网络通道]");
            try {
                String auth = new URI(proxy).getUserInfo();
                if (auth != null && auth.contains(":")) text = text.replace(auth.substring(auth.indexOf(':') + 1), "[REDACTED]");
            } catch (Exception ignored) { }
        }
        return text;
    }

    static void guard(JSONObject params, boolean scheduled) throws IOException {
        if (scheduled) throw new IOException("定时任务保持只读，不能安装或修改依赖环境");
        KernelHost.guardTurn(params);
    }

    static JSONObject execute(KernelHost host, JSONObject params) throws Exception {
        String thread = params.getString("threadId");
        guard(params, host.context.getSharedPreferences("eva-scheduled-routing", 0).contains(thread));
        Process kernel = host.process;
        if (kernel == null) throw new IOException("原任务内核已停止，未启动依赖操作");
        JSONObject request = prepare(params.getJSONObject("arguments"), host.threadCwds.get(thread));
        OfficeRuntime.deploy(host.context);
        ProcessBuilder builder = OfficeRuntime.process(host.context);
        List<String> command = builder.command();
        command.set(command.size() - 1, "/root/.eva-runtime/eva-dependencies.py");
        builder.environment().put("EVA_DEPENDENCY_REQUEST", request.toString());
        File root = new File(host.context.getFilesDir(), "alpine").getCanonicalFile();
        File temporary = new File(root, "tmp");
        if (!temporary.getCanonicalFile().equals(temporary.getAbsoluteFile()) || !temporary.getCanonicalPath().startsWith(root.getPath() + File.separator)) throw new IOException("依赖取消标记目录无效");
        if (!temporary.isDirectory() && !temporary.mkdirs()) throw new IOException("无法准备依赖取消标记");
        File cancel = new File(temporary, "eva-dependency-" + UUID.randomUUID() + ".cancel");
        builder.environment().put("EVA_DEPENDENCY_CANCEL_FILE", "/tmp/" + cancel.getName());
        File output = File.createTempFile("eva-dependencies-", ".jsonl", host.context.getCacheDir());
        Process process = null;
        boolean finishing = false;
        ExecutionLease executionLease = null;
        try {
            executionLease = ExecutionLease.acquire(host.context, "dependency:" + UUID.randomUUID());
            builder.redirectErrorStream(true).redirectOutput(output);
            KernelHost.guardTurn(params);
            if (host.process != kernel) throw new IOException("原任务内核已停止，未启动依赖操作");
            process = LinuxRuntime.start(host.context, builder);
            long limit = request.getString("action").equals("status") ? 60000 : 600000;
            long deadline = android.os.SystemClock.elapsedRealtime() + limit;
            while (!process.waitFor(250, TimeUnit.MILLISECONDS)) {
                KernelHost.guardTurn(params);
                if (host.process != kernel) throw new IOException("原任务内核已停止，依赖操作已中断");
                if (android.os.SystemClock.elapsedRealtime() >= deadline) throw new IOException("依赖操作超时，请先检查环境再重试");
                if (output.length() > MAX_OUTPUT) throw new IOException("依赖输出超过限额，请检查环境日志");
            }
            KernelHost.guardTurn(params);
            if (host.process != kernel) throw new IOException("原任务内核已停止，结果未标记成功");
            if (output.length() > MAX_OUTPUT) throw new IOException("依赖输出超过限额，请检查环境日志");
            String text = redact(host, builder, new String(Files.readAllBytes(output.toPath()), StandardCharsets.UTF_8));
            boolean needsPython = request.getJSONArray("python").length() > 0;
            JSONArray requirements = request.getJSONArray("requirements");
            for (int i = 0; i < requirements.length(); i++) if (requirements.getJSONObject(i).getString("kind").equals("python")) needsPython = true;
            return parseOutput(text, process.exitValue(), needsPython);
        } catch (Exception error) {
            if (process == null || !process.isAlive()) throw error;
            // Do not kill a package database transaction midway. The dispatcher
            // observes this marker at safe boundaries, and flock guards retries.
            boolean cancellationRequested = false;
            try { cancellationRequested = cancel.createNewFile() || cancel.isFile(); } catch (IOException ignored) { }
            finishing = true;
            final Process pending = process;
            final ExecutionLease pendingLease = executionLease;
            Thread cleanup = new Thread(() -> {
                try { pending.waitFor(); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }
                finally { output.delete(); cancel.delete(); if (pendingLease != null) pendingLease.close(); }
            }, "eva-dependency-cleanup");
            cleanup.setDaemon(true); cleanup.start();
            boolean cancelled = KernelHost.cancelledTurns.contains(KernelHost.turnKey(params)) || host.process != kernel;
            return new JSONObject().put("ready", false).put("cancelled", cancelled)
                .put("installationMayBeFinishing", process.isAlive()).put("cancellationRequested", cancellationRequested).put("projectPath", request.getString("projectPath"))
                .put("error", host.redact(String.valueOf(error.getMessage())))
                .put("instruction", cancellationRequested ? "依赖操作已请求在安全边界结束，包事务可能仍在收尾；未继续原任务。后续先用 status 核验环境，再决定是否重试。" : "未能提交取消标记，安装进程可能继续收尾；未继续原任务。后续先用 status 核验环境。");
        } finally {
            if (!finishing) { output.delete(); cancel.delete(); if (executionLease != null) executionLease.close(); }
        }
    }

    static boolean handle(KernelHost host, JSONObject row) {
        JSONObject params = row.optJSONObject("params");
        if (!row.optString("method").equals("item/tool/call") || params == null || !params.optString("tool").equals("eva_dependencies")) return false;
        Process originatingKernel = host.process;
        worker.execute(() -> {
            JSONObject response = new JSONObject();
            try {
                if (host.process != originatingKernel || originatingKernel == null) throw new IOException("原任务内核已停止，未启动依赖操作");
                JSONObject value = execute(host, params);
                boolean failed = value.has("error") && !value.isNull("error") && !value.optString("error").isEmpty();
                boolean success = !failed && (params.getJSONObject("arguments").optString("action").equals("status") || value.optBoolean("ready"));
                response.put("success", success).put("contentItems", new JSONArray().put(new JSONObject().put("type", "inputText").put("text", value.toString())));
            } catch (Exception error) {
                try {
                    boolean cancelled = KernelHost.cancelledTurns.contains(KernelHost.turnKey(params));
                    boolean scheduled = host.context.getSharedPreferences("eva-scheduled-routing", 0).contains(params.optString("threadId"));
                    String next = cancelled ? "原任务已取消，不再派发安装或任务重跑；后续任务先 status 核验环境。" : scheduled ? "定时任务保持只读，本次不安装；请在用户授权的交互任务中处理依赖。" : RECOVERY_NEXT_ACTION;
                    JSONObject value = new JSONObject().put("ready", false).put("cancelled", cancelled).put("error", host.redact(String.valueOf(error.getMessage()))).put("nextAction", next);
                    if (!cancelled && !scheduled && error instanceof RequestError) {
                        value = requestErrorResult((RequestError) error);
                        value.put("error", host.redact(value.getString("error")));
                    }
                    response.put("success", false).put("contentItems", new JSONArray().put(new JSONObject().put("type", "inputText").put("text", value.toString())));
                } catch (Exception ignored) { }
            }
            try { if (host.process == originatingKernel && originatingKernel != null) host.write(new JSONObject().put("id", row.get("id")).put("result", response)); }
            catch (Exception ignored) { }
        });
        return true;
    }
}
