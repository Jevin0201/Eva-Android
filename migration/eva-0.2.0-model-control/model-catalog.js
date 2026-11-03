"use strict";

// Reuse the installed kernel's model instruction structure. Never replace the
// shared cache or copy the closed desktop frontend into application sources.
function buildCatalog(native, custom) {
  const reference = native.find(m => m.slug === "gpt-5.6-sol" && m.model_messages?.instructions_template)
    || native.find(m => m.model_messages?.instructions_template && m.shell_type === "unified_exec");
  if (!reference) throw Error("未找到 Codex 提示词模板，请先使用原生模型刷新模型目录后重启本应用");
  const models = custom.map(model => {
    const result = { ...model, model_messages: structuredClone(reference.model_messages),
      shell_type: reference.shell_type, apply_patch_tool_type: reference.apply_patch_tool_type,
      include_skills_usage_instructions: reference.include_skills_usage_instructions,
      include_plugin_usage_instructions: reference.include_plugin_usage_instructions,
      include_apps_usage_instructions: reference.include_apps_usage_instructions,
      multi_agent_version: reference.multi_agent_version,
      node_repl_disabled: reference.node_repl_disabled,
      // DeepSeek rejects the custom `exec` code-mode envelope. `direct` is
      // Codex's supported tool exposure mode, retaining the same kernel handlers.
      tool_mode: "direct",
      // Only tested tools are enabled for this third-party profile. Native
      // provider image/search services cannot be inferred from text support.
      experimental_supported_tools: [], supports_parallel_tool_calls: false,
      input_modalities: ["text"], supports_image_detail_original: false };
    delete result.base_instructions;
    result.model_messages.instructions_template = result.model_messages.instructions_template.replace(
      /^You are Codex, an agent based on [^.]+\./,
      "You are Eva, a coding agent using the configured third-party model.");
    return result;
  });
  return { models: [...native.filter(n => !models.some(m => m.slug === n.slug)), ...models],
    profile: { instructionSource: reference.slug, shell: reference.shell_type, toolMode: "direct", identityAdapted: true, thirdPartyImageGeneration: false,
      thirdPartyWebSearch: false, requiresRestart: true } };
}
module.exports = { buildCatalog };
