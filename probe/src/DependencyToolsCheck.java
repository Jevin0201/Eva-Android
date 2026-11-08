package ai.eva.android.probe;

import android.app.Instrumentation;
import android.os.Bundle;
import org.json.*;

/** Pure request/result checks. Does not install packages or contact a network. */
public final class DependencyToolsCheck extends Instrumentation {
    private int checks;
    interface Work { void run() throws Exception; }
    private void check(boolean value, String message) { if (!value) throw new AssertionError(message); checks++; }
    private void rejects(Work work, String message) throws Exception {
        boolean rejected = false;
        try { work.run(); } catch (Exception expected) { rejected = true; }
        check(rejected, message);
    }
    public void onCreate(Bundle args) { super.onCreate(args); start(); }
    public void onStart() {
        Bundle report = new Bundle();
        try {
            JSONObject request = DependencyTools.prepare(new JSONObject("{action:ensure,requirements:[{kind:python,name:'python-docx',module:docx},{kind:npm,name:'@scope/package'},{kind:java,version:'21'},{kind:android,profile:build},{kind:system,name:sox,binary:sox}]}"), "/root/eva-workspace/projects/fixture");
            check(request.getString("projectPath").equals("/root/eva-workspace/projects/fixture") && request.getJSONArray("requirements").length() == 5, "all dependency kinds keep thread project scope");
            check(DependencyTools.prepare(new JSONObject("{action:status,python:[{module:'PIL.Image',package:Pillow}]}"), "/root/eva-workspace").getJSONArray("python").length() == 1, "legacy Python requirements preserved");
            JSONObject schema = DependencyTools.spec().getJSONObject("inputSchema");
            check(schema.getJSONArray("anyOf").getJSONObject(0).getJSONArray("required").getString(0).equals("python")
                && schema.getJSONArray("anyOf").getJSONObject(1).getJSONArray("required").getString(0).equals("requirements")
                && schema.getJSONObject("properties").getJSONObject("python").getInt("minItems") == 1
                && schema.getJSONObject("properties").getJSONObject("requirements").getInt("minItems") == 1, "schema requires a nonempty dependency array");
            JSONArray alternatives = schema.getJSONObject("properties").getJSONObject("requirements").getJSONObject("items").getJSONArray("anyOf");
            check(alternatives.getJSONObject(0).getJSONObject("properties").has("package")
                && alternatives.getJSONObject(0).getJSONObject("properties").getJSONObject("kind").getJSONArray("enum").toString().equals("[\"python\"]")
                && !alternatives.getJSONObject(1).getJSONObject("properties").has("package")
                && !alternatives.getJSONObject(1).getBoolean("additionalProperties"), "schema scopes package alias to Python only");
            JSONObject aliasInput = new JSONObject("{action:ensure,requirements:[{kind:python,module:pyfiglet,package:pyfiglet,version:'1.0.2'}]}");
            JSONObject alias = DependencyTools.prepare(aliasInput, "/root/eva-workspace").getJSONArray("requirements").getJSONObject(0);
            check(alias.getString("name").equals("pyfiglet") && !alias.has("package") && alias.getString("version").equals("1.0.2"), "Python package alias normalizes before pipeline");
            check(aliasInput.getJSONArray("requirements").getJSONObject(0).has("package") && !aliasInput.getJSONArray("requirements").getJSONObject(0).has("name"), "normalization does not mutate caller arguments");
            check(DependencyTools.prepare(new JSONObject("{action:status,requirements:[{kind:python,module:docx,name:'python-docx',package:'python-docx'}]}"), "/root/eva-workspace").getJSONArray("requirements").getJSONObject(0).getString("name").equals("python-docx"), "identical name and package accepted");
            rejects(() -> DependencyTools.prepare(new JSONObject("{action:ensure,requirements:[{kind:python,module:docx,name:'python-docx',package:other}]}"), "/root/eva-workspace"), "conflicting Python aliases rejected before execution");
            for (String kind : new String[]{"npm", "java", "android", "system"}) {
                final String valueKind = kind;
                rejects(() -> DependencyTools.prepare(new JSONObject("{action:ensure,requirements:[{kind:'" + valueKind + "',package:example}]}"), "/root/eva-workspace"), "non-Python package alias rejected: " + kind);
            }
            rejects(() -> DependencyTools.prepare(new JSONObject("{action:status,requirements:[]}"), "/root/eva-workspace"), "empty supplied dependency array rejected");
            JSONObject example = DependencyTools.prepare(new JSONObject(DependencyTools.INPUT_EXAMPLE), "/root/eva-workspace");
            check(example.getJSONArray("requirements").length() == 2
                && example.getJSONArray("requirements").getJSONObject(0).getString("kind").equals("python")
                && example.getJSONArray("requirements").getJSONObject(1).getString("name").equals("is-number")
                && DependencyTools.spec().getString("description").contains(DependencyTools.INPUT_EXAMPLE), "published canonical example is accepted by the real request validator");
            JSONObject invalid = null;
            try { DependencyTools.prepare(new JSONObject("{action:ensure,python:[pyfiglet]}"), "/root/eva-workspace"); }
            catch (DependencyTools.RequestError error) { invalid = DependencyTools.requestErrorResult(error); }
            check(invalid != null && invalid.getString("errorType").equals("invalid_request") && !invalid.getBoolean("ready")
                && invalid.getString("nextAction").equals(DependencyTools.INPUT_NEXT_ACTION)
                && !invalid.getString("nextAction").equals(DependencyTools.RECOVERY_NEXT_ACTION)
                && invalid.getJSONObject("inputExample").toString().equals(new JSONObject(DependencyTools.INPUT_EXAMPLE).toString()), "parameter failure returns input correction and usable example instead of environment recovery");
            rejects(() -> DependencyTools.prepare(new JSONObject("{action:ensure,requirements:[{kind:system,name:sox}],projectPath:'/etc'}"), "/root/eva-workspace"), "model cannot override project scope");
            rejects(() -> DependencyTools.prepare(new JSONObject("{action:status,python:[{module:docx}]}"), "/root/eva-workspace/../../etc"), "workspace traversal rejected");
            rejects(() -> DependencyTools.prepare(new JSONObject("{action:ensure}"), "/root/eva-workspace"), "empty dependency plan rejected");
            rejects(() -> DependencyTools.prepare(new JSONObject("{action:ensure,requirements:[{kind:unknown,name:package}]}"), "/root/eva-workspace"), "unknown dependency kind rejected");
            rejects(() -> DependencyTools.prepare(new JSONObject("{action:ensure,requirements:[{kind:npm,name:'--global'}]}"), "/root/eva-workspace"), "package option injection rejected");
            rejects(() -> DependencyTools.prepare(new JSONObject("{action:ensure,python:[{module:'docx;echo',package:'python-docx'}]}"), "/root/eva-workspace"), "invalid import name rejected");
            rejects(() -> DependencyTools.prepare(new JSONObject("{action:ensure,python:[{module:docx,package:'https://unknown.invalid/module.whl'}]}"), "/root/eva-workspace"), "unknown direct package source rejected");
            JSONObject value = DependencyTools.parseOutput("{\"progress\":\"checking\"}\n{\"ready\":true,\"pythonExecutable\":\"/usr/bin/python3\",\"results\":[{\"ready\":true}],\"sourceAttempts\":[\"official\",\"mirror\"]}\n", 0, true);
            check(value.getBoolean("ready") && value.getJSONArray("sourceAttempts").length() == 2, "final verified result and mirror provenance preserved");
            check(!DependencyTools.parseOutput("{\"ready\":true,\"results\":[{\"ready\":false}]}", 0, false).getBoolean("ready"), "overall success cannot hide failed requirement");
            check(!DependencyTools.parseOutput("{\"ready\":true,\"results\":[{\"ready\":true}]}", 0, true).getBoolean("ready"), "Python success requires executable path");
            check(DependencyTools.parseOutput("{\"ready\":true,\"results\":[{\"kind\":\"npm\",\"ready\":true}]}", 0, false).getBoolean("ready"), "non-Python success does not require Python field");
            check(!DependencyTools.parseOutput("{\"ready\":true,\"results\":[{\"ready\":true}]}", 1, false).getBoolean("ready"), "failed executor cannot claim success");
            check(!DependencyTools.parseOutput("not a complete result", 0, false).getBoolean("ready"), "missing final verification fails closed");
            JSONObject networkFailure = DependencyTools.parseOutput("{\"ready\":false,\"error\":\"TLS certificate failure\",\"sourceAttempts\":[\"official\",\"mirror\"],\"retryable\":true}", 1, false);
            check(networkFailure.getString("error").equals("TLS certificate failure") && networkFailure.getBoolean("retryable") && networkFailure.getJSONArray("sourceAttempts").length() == 2, "specific failure and retry provenance retained on nonzero exit");
            JSONObject turn = new JSONObject().put("threadId", "dependency-check").put("turnId", "cancel-before-start");
            String turnKey = KernelHost.turnKey(turn);
            KernelHost.cancelledTurns.add(turnKey);
            try { rejects(() -> DependencyTools.guard(turn, false), "cancelled turn rejected before deployment or process launch"); }
            finally { KernelHost.cancelledTurns.remove(turnKey); }
            rejects(() -> DependencyTools.guard(turn, true), "scheduled read-only scope cannot invoke dependency installation");
            report.putString("stream", "PASS dependency tools " + checks + " checks\n");
        } catch (Throwable error) {
            report.putString("stream", "FAIL dependency tools " + error + "\n");
        }
        finish(report.getString("stream", "").startsWith("PASS") ? -1 : 0, report);
    }
}
