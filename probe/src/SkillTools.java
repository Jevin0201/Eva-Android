package ai.eva.android.probe;

import java.io.IOException;
import org.json.*;

/** Model-facing skill authoring through the same store used by settings. */
final class SkillTools {
    static JSONObject spec() throws Exception {
        JSONObject properties = new JSONObject()
            .put("action", new JSONObject().put("type", "string").put("enum",
                new JSONArray(new String[]{"list", "read", "validate", "save", "refresh"})))
            .put("name", new JSONObject().put("type", "string"))
            .put("project", new JSONObject().put("type", "string")
                .put("description", "Project ID. Omit for a global reusable skill."))
            .put("text", new JSONObject().put("type", "string")
                .put("description", "Complete SKILL.md with YAML name and description followed by instructions."))
            .put("overwrite", new JSONObject().put("type", "boolean")
                .put("description", "Set true only when the user requested updating an existing skill."));
        return new JSONObject().put("name", "eva_skills")
            .put("description", "Create and edit reusable Eva skills. Use list/read to inspect existing skills, validate to check SKILL.md, save to persist a global or project skill and refresh discovery, refresh after adding supporting scripts/references with file tools. save requires name and text; read requires name. Reuse existing instructions when editing. Verify saved=true and discoverable=true before claiming installation. A newly discovered skill may require a subsequent turn or reopening the Eva chat to enter model context.")
            .put("inputSchema", new JSONObject().put("type", "object").put("properties", properties)
                .put("required", new JSONArray().put("action")).put("additionalProperties", false));
    }

    static String instructions() {
        return "\n用户要求创建或修改技能时，使用 eva_skills 完成检查、编写、保存和读回。默认创建全局技能，用户指定项目时使用项目技能。SKILL.md 须含 YAML name、description 和可执行的正文。先读取已有技能，保留用户内容，仅在用户要求修改时覆盖。需要 scripts/references 时通过文件工具写入返回路径所在目录，再 refresh。保存后检查 saved、discoverable 和刷新错误；遇到错误继续修复。只有文本草稿时说明尚未保存。发现成功后，后续回合或重新打开 Eva 聊天可加载技能；自动调用取决于技能描述与任务匹配。\n";
    }

    static JSONObject execute(KernelHost host, JSONObject args) throws Exception {
        String action = args.getString("action");
        String project = args.optString("project", "");
        SkillStore.validateProject(project);
        if (action.equals("list") || action.equals("refresh")) return refresh(host, project);
        if (action.equals("read")) return SkillStore.call(host.context, "read", args);
        if (action.equals("validate")) {
            SkillStore.validate(args.getString("text"));
            return new JSONObject().put("valid", true);
        }
        if (!action.equals("save")) throw new IOException("未知技能操作");
        JSONObject result = SkillStore.call(host.context, "save", args);
        JSONObject readBack = SkillStore.call(host.context, "read", args);
        if (!args.getString("text").equals(readBack.getString("text")))
            throw new IOException("技能已保存，但读回内容不一致，请检查后重试");
        result.put("saved", true).put("text", readBack.getString("text"));
        try {
            JSONObject listing = refresh(host, project);
            String path = result.getString("path");
            boolean found = false;
            JSONArray groups = listing.optJSONArray("data");
            if (groups != null) for (int i = 0; i < groups.length(); i++) {
                JSONArray skills = groups.getJSONObject(i).optJSONArray("skills");
                if (skills == null) continue;
                for (int j = 0; j < skills.length(); j++)
                    found |= path.equals(skills.getJSONObject(j).optString("path"));
            }
            result.put("discoverable", found).put("discovery", listing);
            if (!found) result.put("nextAction", "检查 discovery 中的技能解析错误与路径，修复后调用 refresh。");
        } catch (Exception error) {
            result.put("discoverable", false).put("refreshError", String.valueOf(error.getMessage()))
                .put("nextAction", "文件已保存，检查错误后调用 refresh；继续修改时先 read。");
        }
        return result;
    }

    private static JSONObject refresh(KernelHost host, String project) throws Exception {
        String cwd = "/root/eva-workspace" + (project.isEmpty() ? "" : "/projects/" + project);
        JSONObject request = new JSONObject().put("cwds", new JSONArray().put(cwd)).put("forceReload", true);
        return host.refreshSkills(request);
    }

    static boolean handle(KernelHost host, JSONObject row) {
        JSONObject params = row.optJSONObject("params");
        if (!row.optString("method").equals("item/tool/call") || params == null
                || !params.optString("tool").equals("eva_skills")) return false;
        host.work.execute(() -> {
            JSONObject response = new JSONObject();
            try {
                KernelHost.guardTurn(params);
                JSONObject result = execute(host, params.getJSONObject("arguments"));
                response.put("success", true).put("contentItems", new JSONArray().put(
                    new JSONObject().put("type", "inputText").put("text", result.toString())));
            } catch (Exception error) {
                try {
                    response.put("success", false).put("contentItems", new JSONArray().put(
                        new JSONObject().put("type", "inputText").put("text", String.valueOf(error.getMessage()))));
                } catch (JSONException ignored) { }
            }
            try { host.write(new JSONObject().put("id", row.get("id")).put("result", response)); }
            catch (Exception ignored) { }
        });
        return true;
    }
}
