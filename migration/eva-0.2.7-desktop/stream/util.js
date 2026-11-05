/* Codex clone — shared utilities */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function basename(p) {
  if (!p) return "";
  const norm = String(p).replace(/[\\/]+$/, "");
  const parts = norm.split(/[\\/]/);
  return parts[parts.length - 1] || norm;
}

function projectKey(p) {
  return String(p || "")
    .replace(/\//g, "\\")
    .replace(/[\\/]+$/, "")
    .toLowerCase();
}

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function uniqueThreadRows(rows) {
  const byId = new Map();
  for (const row of rows || []) {
    if (!row?.id) continue;
    const previous = byId.get(row.id);
    // Keep a complete authoritative snapshot rather than mixing paths/previews.
    if (!previous || toMs(row.updatedAt) > toMs(previous.updatedAt) ||
        toMs(row.updatedAt) === toMs(previous.updatedAt) && toMs(row.recencyAt) > toMs(previous.recencyAt)) byId.set(row.id, row);
  }
  return [...byId.values()].sort((a,b) => toMs(b.recencyAt || b.updatedAt) - toMs(a.recencyAt || a.updatedAt));
}

function toMs(ts) {
  if (!ts) return 0;
  return ts > 1e12 ? ts : ts * 1000;
}

function fmtTime(ts) {
  return new Date(toMs(ts)).toLocaleTimeString(LANG === "zh" ? "zh-CN" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function fmtFull(ts) {
  if (!ts) return "";
  return new Date(toMs(ts)).toLocaleString(LANG === "zh" ? "zh-CN" : "en-US", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function fmtRel(ts) {
  const n = nowSec();
  const s = Number(ts) || 0;
  const d = new Date(toMs(ts));
  const today = new Date();
  if (s >= n - 86400 && d.getDate() === today.getDate()) return fmtTime(ts);
  if (s >= n - 172800) return t("yesterday");
  return d.toLocaleDateString(LANG === "zh" ? "zh-CN" : "en-US", {
    month: "numeric",
    day: "numeric",
  });
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function threadTitle(thread) {
  if (!thread) return t("newChat");
  if (thread.name && thread.name.trim()&&!thread.name.startsWith('# Files mentioned by the user:')) return thread.name.trim();
  const preview = String(thread.preview || "").trim();
  if (preview&&!preview.startsWith('# Files mentioned by the user:')) return preview.split("\n")[0].slice(0, 80);
  if(preview.startsWith('# Files mentioned by the user:')&&typeof parseAttachedMessage==='function'){const parsed=parseAttachedMessage(preview);if(parsed.files.length)return parsed.text.split('\n')[0].slice(0,80);}
  const firstUser = (thread.turns || [])
    .flatMap((turn) => turn.items || [])
    .find((item) => item?.type === "userMessage");
  const text = firstUser?.content?.find((part) => part.type === "text")?.text;
  if (text) return (typeof parseAttachedMessage==='function'?parseAttachedMessage(String(text)).text:String(text)).split("\n")[0].slice(0, 80);
  return t("untitled");
}

function threadPreview(thread) {
  const preview = String(thread.preview || "").trim();
  if (!preview) return "";
  const title = threadTitle(thread);
  if (preview === title) return "";
  return preview.length > 180 ? preview.slice(0, 180) : preview;
}

function safeJson(value) {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return "";
  }
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(scopedStoreKey(key));
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(scopedStoreKey(key), JSON.stringify(value));
      if(['eva.thread-read-markers','codex-rae.pinnedThreads'].includes(key))queueMicrotask(()=>globalThis.workspaceProtection?.sync());
    } catch {
      /* ignore */
    }
  },
};

function scopedStoreKey(key) {
  const side = typeof location !== 'undefined' && new URLSearchParams(location.search).get('sidechat');
  return side && ['codex.thread','codex.model','codex.provider','codex.effort','codex.mode','codex-rae.draftCwd'].includes(key) ? `codex-rae.sidechat.${side}.${key}` : key;
}
function isThreadPinned(id) { return store.get('codex-rae.pinnedThreads', []).includes(id); }
function toggleThreadPinned(id) {
  const ids = new Set(store.get('codex-rae.pinnedThreads', []));
  if (ids.has(id)) ids.delete(id); else ids.add(id);
  try { localStorage.setItem('codex-rae.pinnedThreads',JSON.stringify([...ids])); renderSidebar();globalThis.workspaceProtection?.sync(); }
  catch(error) { toast(error.message); }
}

const MODES = {
  auto: { approvalPolicy: "on-request", approvalsReviewer:'user', sandbox: "workspace-write", label: "ask", icon: "approvalHand", tone: "" },
  assisted: { approvalPolicy:'on-request', approvalsReviewer:'auto_review', sandbox:'workspace-write',label:'assisted',icon:'shield',tone:'' },
  full: { approvalPolicy: "never", approvalsReviewer:'user', sandbox: "danger-full-access", label: "full", icon: "shieldAlert", tone: "warn" },
  read: { approvalPolicy: "never", approvalsReviewer:'user', sandbox: "read-only", label: "read", icon: "shield", tone: "" },
};

const EFFORT_LABELS = {
  none: "effortLow",
  minimal: "effortLow",
  low: "effortLow",
  medium: "effortMedium",
  high: "effortHigh",
  xhigh: "effortXHigh",
  max: "effortMax",
  ultra: "effortUltra",
};

function diffStats(diff) {
  let add = 0;
  let del = 0;
  for (const line of String(diff || "").split("\n")) {
    if (line.startsWith("+++") || line.startsWith("---")) continue;
    if (line.startsWith("+")) add++;
    else if (line.startsWith("-")) del++;
  }
  return { add, del };
}

// fileChange additions/deletions may contain the file body, not a unified diff.
function fileChangeStats(change) {
  const body = String(change.diff || "");
  const kind = typeof change.kind === "string" ? change.kind : change.kind?.type;
  const unified = /^@@ |^diff --git |^--- .*\n\+\+\+ /m.test(body);
  if (!unified && ["add", "create", "created", "delete", "remove", "deleted"].includes(kind)) {
    const lines = body ? body.replace(/\r?\n$/, "").split(/\r?\n/).length : 0;
    return { add: ["add", "create", "created"].includes(kind) ? lines : 0,
      del: ["delete", "remove", "deleted"].includes(kind) ? lines : 0, known: true };
  }
  const stats = diffStats(body);
  return { ...stats, known: unified || stats.add > 0 || stats.del > 0 };
}

function unifiedDiffPath(value) {
  let path = value.split("\t")[0].trim();
  if (path.startsWith('"') && path.endsWith('"')) {
    const encoded = path.slice(1, -1).replace(/%/g, "%25")
      .replace(/\\([0-7]{1,3})/g, (_, octal) => "%" + parseInt(octal, 8).toString(16).padStart(2, "0"))
      .replace(/\\([\\"tnr])/g, (_, char) => ({ t: "\t", n: "\n", r: "\r" }[char] || char));
    try { path = decodeURIComponent(encoded); } catch { return null; }
  }
  return path === "/dev/null" ? null : path.replace(/^[ab]\//, "");
}

// Prefer the kernel's turn-wide net diff over summing intermediate edit events.
// Null means unsupported input; an empty Map means a confirmed empty net diff.
function unifiedDiffFiles(diff) {
  if (!String(diff || "").trim()) return new Map();
  const files = new Map();
  let file = null, oldPath = null, inHunk = false, sawFile = false;
  for (const line of String(diff).split(/\r?\n/)) {
    if (line.startsWith("diff --git ")) {
      file = null; oldPath = null; inHunk = false;
    } else if (!inHunk && line.startsWith("--- ")) {
      oldPath = unifiedDiffPath(line.slice(4));
    } else if (!inHunk && line.startsWith("+++ ")) {
      const path = unifiedDiffPath(line.slice(4)) || oldPath;
      if (!path) return null;
      file = files.get(path) || { path, add: 0, del: 0, known: true };
      files.set(path, file); sawFile = true;
    } else if (line.startsWith("@@ ")) {
      if (!file) return null;
      inHunk = true;
    } else if (inHunk && file) {
      if (line.startsWith("+")) file.add++;
      else if (line.startsWith("-")) file.del++;
    }
  }
  // Metadata-only changes (rename, binary, empty file) need the item fallback.
  return sawFile ? files : null;
}

/* ---------- markdown ---------- */

function inlineMd(text) {
  const tokens = [];
  const keep = html => `\u0000${tokens.push(html) - 1}\u0000`;
  let out = String(text).replace(/\u0000/g, "");
  out = out.replace(/`([^`\n]+)`/g, (_m, code) => keep(`<code>${esc(code)}</code>`));
  out = out.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~])/g, (_m, literal) => keep(esc(literal)));
  out = out.replace(/(!?)\[([^\]\n]+)\]\((<[^>\n]+>|(?:[^()\n]|\([^()\n]*\))+)\)/g, (raw, image, label, destination) => {
    const link = transcriptLink(destination);
    if (!link) return raw;
    if (image) {
      const src = link.kind === "local" ? mediaUrl(link.path) : link.href;
      return keep(`<img src="${esc(src)}" alt="${esc(label)}" data-zoom="${esc(src)}" loading="lazy" />`);
    }
    if (link.kind === "local") return keep(`<button class="inline-file-link" data-local-path="${esc(link.path)}"${link.line ? ` data-file-line="${link.line}"` : ""} title="${esc(link.path)}">${ic(/\.(zip|7z|tar|gz)$/i.test(link.path) ? "folder" : "doc")}${esc(label)}</button>`);
    return keep(`<a href="${esc(link.href)}" target="_blank" rel="noreferrer">${esc(label)}</a>`);
  });
  out = out.replace(/https?:\/\/[^\s<)\u0000]+/g, url => keep(`<a href="${esc(url)}" target="_blank" rel="noreferrer">${esc(url)}</a>`));
  out = esc(out);
  out = out.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/~~([^~\n]+)~~/g, "<del>$1</del>");
  out = out.replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  for (let depth = 0; depth < 3; depth++) out = out.replace(/\u0000(\d+)\u0000/g, (_m, index) => tokens[Number(index)] || "");
  return out;
}

function mediaUrl(path) { return `media://local/?path=${encodeURIComponent(path)}`; }

function transcriptLink(destination) {
  let href = String(destination || "").trim().replace(/^<|>$/g, "");
  if (/^https?:\/\//i.test(href)) return { kind: "web", href };
  // sandbox:/mnt paths are remote artifacts; never pretend they exist locally.
  if (/^(?:javascript|data|sandbox):/i.test(href)) return null;
  if (href.startsWith("file://")) {
    try { href = decodeURIComponent(new URL(href).pathname); } catch { return null; }
  }
  if (/^\/[a-z]:[\\/]/i.test(href)) href = href.slice(1);
  if (!/^[a-z]:[\\/]/i.test(href) && !/^\/(?!\/)/.test(href)) return null;
  const position = /(?::(\d+)(?::\d+)?)?(?:#L(\d+)(?:C\d+)?)?$/.exec(href);
  const line = Number(position?.[1] || position?.[2]) || null;
  if (position?.[0]) href = href.slice(0, -position[0].length);
  return { kind: "local", path: href, line };
}

function renderMarkdown(source) {
  const text = String(source ?? "").replace(/\r\n/g, "\n");
  const lines = text.split("\n");
  const out = [];
  let i = 0;

  const isTableRow = (line) => /^\s*\|.*\|\s*$/.test(line || "");
  const isTableSep = (line) => /^\s*\|?[\s:|-]+\|?\s*$/.test(line || "") && (line || "").includes("-");

  while (i < lines.length) {
    const line = lines[i];

    if (/^\s*```/.test(line)) {
      const lang = line.replace(/^\s*```/, "").trim();
      i++;
      const code = [];
      while (i < lines.length && !/^\s*```/.test(lines[i])) {
        code.push(lines[i]);
        i++;
      }
      i++;
      out.push(
        `<div class="code-block"><div class="code-head"><span>${esc(lang || "code")}</span><button class="code-copy" data-copy-code="1" title="${esc(t("copy"))}">${ic("copy")}</button></div><pre><code${lang ? ` class="language-${esc(lang)}"` : ""}>${esc(code.join("\n"))}</code></pre></div>`,
      );
      continue;
    }

    if (!line.trim()) {
      i++;
      continue;
    }

    if (isTableRow(line) && isTableSep(lines[i + 1])) {
      const splitRow = (row) =>
        row
          .trim()
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split("|")
          .map((cell) => cell.trim());
      const header = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && isTableRow(lines[i])) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      out.push(
        `<table><thead><tr>${header
          .map((cell) => `<th>${inlineMd(cell)}</th>`)
          .join("")}</tr></thead><tbody>${rows
          .map((row) => `<tr>${row.map((cell) => `<td>${inlineMd(cell)}</td>`).join("")}</tr>`)
          .join("")}</tbody></table>`,
      );
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      out.push(`<h${level}>${inlineMd(heading[2])}</h${level}>`);
      i++;
      continue;
    }

    if (/^\s*([-*_]){3,}\s*$/.test(line)) {
      out.push("<hr/>");
      i++;
      continue;
    }

    if (/^\s*>/.test(line)) {
      const quote = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        quote.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      out.push(`<blockquote>${inlineMd(quote.join("\n")).replaceAll("\n", "<br/>")}</blockquote>`);
      continue;
    }

    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const tag = ordered ? "ol" : "ul";
      const items = [];
      const base = /^\s*/.exec(line)[0].length;
      const firstNumber = ordered ? Number(/^\s*(\d+)/.exec(line)[1]) : 1;
      while (i < lines.length) {
        const match = /^(\s*)([-*+]|\d+\.)\s+(.*)$/.exec(lines[i]);
        if (!match || match[1].length !== base || /^\d/.test(match[2]) !== ordered) break;
        const indentation = match[0].length - match[3].length;
        const body = [match[3]];
        i++;
        while (i < lines.length) {
          const next = lines[i];
          const leading = /^\s*/.exec(next)[0].length;
          if (!next.trim()) {
            if (lines[i + 1]?.trim() && /^\s*/.exec(lines[i + 1])[0].length >= indentation) { body.push(""); i++; continue; }
            break;
          }
          if (leading < indentation) break;
          body.push(next.slice(indentation));
          i++;
        }
        let content = renderMarkdown(body.join("\n")).replace(/^<p>([\s\S]*?)<\/p>/, "$1");
        content = content.replace(/^\[([ xX])\]\s*/, (_m, check) => `<span class="task-check${check.trim() ? " checked" : ""}" role="img" aria-label="${check.trim() ? "已完成" : "未完成"}">${check.trim() ? ic("check") : ""}</span>`);
        items.push(`<li>${content}</li>`);
      }
      out.push(`<${tag}${ordered && firstNumber !== 1 ? ` start="${firstNumber}"` : ""}>${items.join("")}</${tag}>`);
      continue;
    }

    const paragraph = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^\s*```/.test(lines[i]) &&
      !/^(#{1,6})\s+/.test(lines[i]) &&
      !/^\s*>/.test(lines[i]) &&
      !/^\s*([-*+]|\d+\.)\s+/.test(lines[i]) &&
      !isTableRow(lines[i])
    ) {
      paragraph.push(lines[i]);
      i++;
    }
    out.push(`<p>${inlineMd(paragraph.join("\n")).replaceAll("\n", "<br/>")}</p>`);
  }
  return out.join("");
}
