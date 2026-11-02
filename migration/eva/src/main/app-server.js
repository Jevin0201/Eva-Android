"use strict";

const { spawn } = require("node:child_process");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");

function resolveCodexBinary() {
  const selected=require('./kernel-policy').selectedKernel(require('./runtime-paths').workspaceRoot,process.env.CODEX_BIN);
  if(selected)return selected;
  // Isolated test/data workspaces may use Eva's verified code-root runtime only.
  if(process.env.CODEX_BIN){const own=require('./kernel-policy').selectedKernel(require('./runtime-paths').codeRoot,process.env.CODEX_BIN);if(own)return own;}
  throw Error('Eva 的独立内核尚未准备好，请先安装或校验 Eva 运行环境；不会借用系统 Codex CLI');
}

async function resolveCodexBinaryAsync(){const policy=require('./kernel-policy'),paths=require('./runtime-paths');const selected=await policy.selectedKernelAsync(paths.workspaceRoot,process.env.CODEX_BIN);if(selected)return selected;if(process.env.CODEX_BIN){const own=await policy.selectedKernelAsync(paths.codeRoot,process.env.CODEX_BIN);if(own)return own;}throw Error('Eva private kernel is unavailable');}

class AppServer extends EventEmitter {
  constructor(binary = resolveCodexBinary()) {
    super();
    this.binary = binary;
    this.proc = null;
    this.nextId = 1;
    this.pending = new Map();
    this.starting = null;
  }

  async start() {
    if (this.starting) return this.starting;
    if (this.proc) return;

    const launch={};this.launch=launch;
    this.starting = (async()=>{
      let env=require('./process-environment').isolatedEnvironment(process.env,{ ...this.environment, CODEX_CLI_PATH:this.binary });
      const {bundledHost,CodeModeHost}=require('./code-mode-host');
      const helper=bundledHost(this.binary);
      let hostURL;
      if(helper&&!(this.args||[]).includes('--code-mode-host')){
        env=require('./process-environment').withLoopbackBypass(env);
        const host=new CodeModeHost(helper,env);this.codeModeHost=host;
        host.on('unexpected-exit',error=>{if(this.codeModeHost===host){this.emit('stderr',error.message);this.proc?.kill();}});
        hostURL=await host.start();
      }
      if(this.launch!==launch)throw Error('app-server startup stopped');
      return new Promise((resolve, reject) => {
      const proc = spawn(this.binary, ["app-server", ...(hostURL?["--code-mode-host",hostURL]:[]), ...(this.args || [])], {
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
        env,
      });
      this.proc = proc;
      this.cancelStart = () => reject(new Error('app-server startup stopped'));

      const rl = readline.createInterface({ input: proc.stdout, crlfDelay: Infinity });
      rl.on("line", (line) => { if (this.proc === proc) this.#onLine(line); });

      let stderr = "";
      proc.stderr.on("data", (chunk) => {
        if (this.proc !== proc) return;
        stderr += chunk.toString();
        if (stderr.length > 20000) stderr = stderr.slice(-20000);
        this.emit("stderr", chunk.toString());
      });

      proc.on("error", (error) => {
        if (this.proc !== proc) return;
        this.proc = null;
        this.codeModeHost?.stop();this.codeModeHost=null;
        this.starting = null;
        this.cancelStart = null;
        for (const { reject: rejectRequest, timer } of this.pending.values()) { clearTimeout(timer); rejectRequest(error); }
        this.pending.clear();
        reject(error);
        this.emit("exit", { code:null, signal:null, error:error.message, stderr });
      });

      proc.on("spawn", () => {
        if (this.proc !== proc) { reject(new Error('app-server startup stopped')); return; }
        this.starting = null;
        this.cancelStart = null;
        this.emit("started", { binary: this.binary, pid: proc.pid });
        resolve();
      });

      proc.on("exit", (code, signal) => {
        if (this.proc !== proc) return;
        this.proc = null;
        this.codeModeHost?.stop();this.codeModeHost=null;
        this.starting = null;
        this.cancelStart = null;
        reject(new Error(`app-server exited before startup completed (code=${code})`));
        for (const { reject: rej, timer } of this.pending.values()) {
          clearTimeout(timer);
          rej(new Error(`app-server exited (code=${code}, signal=${signal}): ${stderr.slice(-500)}`));
        }
        this.pending.clear();
        this.emit("exit", { code, signal, stderr });
      });
      });
    })().catch(error=>{if(this.launch===launch){this.codeModeHost?.stop();this.codeModeHost=null;this.starting=null;}throw error;});

    return this.starting;
  }

  #send(message) {
    if (!this.proc || !this.proc.stdin.writable) {
      throw new Error("app-server is not running");
    }
    this.proc.stdin.write(JSON.stringify(message) + "\n");
  }

  #onLine(line) {
    const text = line.trim();
    if (!text) return;
    let msg;
    try {
      msg = JSON.parse(text);
    } catch {
      this.emit("raw", text);
      return;
    }

    if (msg.id !== undefined && msg.method) {
      this.emit("server-request", msg);
      return;
    }
    if (msg.id !== undefined) {
      const entry = this.pending.get(msg.id);
      if (!entry) {
        this.emit("orphan-response", msg);
        return;
      }
      this.pending.delete(msg.id);
      clearTimeout(entry.timer);
      if (msg.error) {
        const error = new Error(msg.error.message || "request failed");
        error.code = msg.error.code;
        error.data = msg.error.data;
        entry.reject(error);
      } else {
        entry.resolve(msg.result);
      }
      return;
    }
    if (msg.method) {
      this.emit("notification", msg.method, msg.params);
    }
  }

  request(method, params = {}, timeoutMs = 60000) {
    if (!this.proc) throw new Error("app-server is not running");
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = timeoutMs === null ? null : setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`request timed out: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer, method, threadId:params?.threadId });
      try {
        this.#send({ jsonrpc: "2.0", id, method, params });
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  notify(method, params = {}) {
    this.#send({ jsonrpc: "2.0", method, params });
  }

  respond(id, result) {
    this.#send({ jsonrpc: "2.0", id, result });
  }

  respondError(id, code, message) {
    this.#send({ jsonrpc: "2.0", id, error: { code, message } });
  }

  stop() {
    this.launch=null;this.codeModeHost?.stop();this.codeModeHost=null;this.starting=null;
    if (this.proc) {
      const proc = this.proc;
      this.proc = null;
      this.starting = null;
      this.cancelStart?.();
      this.cancelStart = null;
      for (const { reject, timer } of this.pending.values()) {
        clearTimeout(timer);
        reject(new Error('app-server stopped'));
      }
      this.pending.clear();
      let killed=false;
      if(process.platform==='win32'&&Number.isInteger(proc.pid)&&proc.exitCode===null){try{require('node:child_process').execFileSync('taskkill.exe',['/PID',String(proc.pid),'/T','/F'],{windowsHide:true,stdio:'ignore',timeout:3000});killed=true;}catch{}}
      if(!killed)proc.kill();
      try{proc.stdin.end();}catch{}
    }
  }
}

module.exports = { AppServer, resolveCodexBinary, resolveCodexBinaryAsync };
