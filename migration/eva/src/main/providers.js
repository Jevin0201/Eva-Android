"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {readJson,writeJson}=require('./atomic-json');

// The renderer receives metadata only. Secrets are encrypted by Electron safeStorage
// (DPAPI on Windows), then supplied exclusively to the app-server environment.
class ProviderStore {
  constructor(file, secure) {
    this.file = file;
    this.secure = secure;
    this.loadedKeys = new Map();
    this.redactionKeys = new Set();
  }
  read() {
    return readJson(this.file,{providers:[]});
  }
  write(data) {
    writeJson(this.file,data);
  }
  key(entry) {
    if (!entry.secret) return "";
    if (!this.secure.isEncryptionAvailable()) throw new Error("系统安全存储不可用，无法读取 API Key");
    const key = this.secure.decryptString(Buffer.from(entry.secret, "base64"));
    if (key) this.redactionKeys.add(key);
    return key;
  }
  list() {
    return this.read().providers.map(({ secret, ...entry }) => ({
      ...entry, hasKey: Boolean(secret),
      ...(new URL(entry.baseUrl).hostname === "api.deepseek.com" && entry.model === "deepseek-flash"
        ? { capabilities: { imageInput: false, imageGeneration: false, webSearch: false, toolMode: "direct" } } : {}),
      needsRestart: this.loadedKeys.get(entry.id) !== JSON.stringify({ ...entry, secret }),
    }));
  }
  save(input) {
    const data = this.read();
    const id = String(input.id || "").trim();
    if (!/^[a-z][a-z0-9_-]{0,47}$/.test(id) || ["openai", "ollama", "lmstudio", "amazon-bedrock"].includes(id))
      throw new Error("提供商 ID 须为小写字母开头的 1–48 位字母、数字、下划线或连字符，不能使用内置 ID");
    const url = new URL(input.baseUrl);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash)
      throw new Error("Base URL 必须是无凭据、查询参数或片段的 HTTP(S) 地址");
    const old = data.providers.find(p => p.id === id);
    if (!String(input.name || "").trim() || !String(input.model || "").trim()) throw new Error("请填写提供商名称与模型 ID");
    let secret = old?.secret || null;
    if (input.apiKey) {
      if (!this.secure.isEncryptionAvailable()) throw new Error("系统安全存储不可用，未保存 API Key");
      secret = this.secure.encryptString(String(input.apiKey).trim()).toString("base64");
      this.redactionKeys.add(String(input.apiKey).trim());
    }
    if (!secret) throw new Error("请填写 API Key");
    const entry = { id, name: String(input.name).trim(), baseUrl: url.href.replace(/\/$/, ""),
      model: String(input.model).trim(), displayName: String(input.displayName || input.model).trim(), secret };
    data.providers = [...data.providers.filter(p => p.id !== id), entry];
    this.write(data);
    return this.list();
  }
  remove(id) {
    const data = this.read();
    data.providers = data.providers.filter(p => p.id !== id);
    data.removedIds = [...new Set([...(data.removedIds || []), id])];
    this.write(data);
    return this.list();
  }
  manages(id) { const data = this.read(); return data.providers.some(p => p.id === id) || (data.removedIds || []).includes(id); }
  environment() {
    const env = {};
    this.loadedKeys.clear();
    for (const entry of this.read().providers) {
      env[this.envName(entry.id)] = this.key(entry);
      this.loadedKeys.set(entry.id, JSON.stringify(entry));
    }
    return env;
  }
  envName(id) { return `CODEX_RAE_KEY_${Buffer.from(id).toString("hex").toUpperCase()}`; }
  config(providerId) {
    const definitions = {};
    for (const p of this.read().providers) definitions[p.id] = {
      name: p.name, base_url: p.baseUrl, env_key: this.envName(p.id),
      wire_api: "responses", requires_openai_auth: false, supports_websockets: false,
    };
    const config = Object.keys(definitions).length ? { model_providers: definitions } : {};
    const provider = this.read().providers.find(p => p.id === providerId);
    if (provider && new URL(provider.baseUrl).hostname === "api.deepseek.com" && provider.model === "deepseek-flash") {
      config.web_search = "disabled";
    }
    return config;
  }
  requireReady(id) {
    const entry = this.list().find(p => p.id === id);
    if (!entry) throw new Error(`提供商 ${id} 已删除或未配置，请重新添加后再打开此会话`);
    if (entry.needsRestart) throw new Error("API Key 已保存，请先在模型设置中重启应用以启用");
    return entry;
  }
  redact(text) {
    let result = String(text);
    for (const key of this.redactionKeys) result = result.split(key).join("[REDACTED]");
    return result;
  }
  async test(id, discover = false) {
    const entry = this.read().providers.find(p => p.id === id);
    if (!entry) throw new Error("提供商不存在");
    const secret = this.key(entry);
    let response;
    try {
      response = await fetch(`${entry.baseUrl}/${discover ? "models" : "responses"}`, {
        method: discover ? "GET" : "POST", redirect: "error", signal: AbortSignal.timeout(30000),
        headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
        ...(discover ? {} : { body: JSON.stringify({ model: entry.model, input: "Reply with exactly: pong", store: false, stream: false }) }),
      });
      // Never forward arbitrary server error bodies: a provider may echo credentials.
      if (!response.ok) throw new Error(`HTTP ${response.status}：${response.status === 401 || response.status === 403 ? "认证失败，请检查 API Key 与访问权限" : "服务拒绝请求，请核对地址、模型与 Responses 支持"}`);
      const data = await response.json();
      if (discover) return { models: (data.data || []).map(p => String(p.id)).slice(0, 500) };
      if (data.status !== "completed" || !Array.isArray(data.output) || !data.output.some(p => p.type === "message" && p.content?.some(c => c.type === "output_text" && c.text)))
        throw new Error("服务未返回已完成的 Responses 文本响应");
      return { ok: true, model: data.model || entry.model };
    } catch (error) {
      if (error.message.startsWith("HTTP ") || error.message.startsWith("服务未")) throw error;
      throw new Error("连接失败或响应格式无效，请检查服务地址、网络与 Responses API 支持");
    }
  }
}
module.exports = { ProviderStore };
