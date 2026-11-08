// Authorized BuLu browser-logic port; provenance: port-manifest.json.
export function missingTabObservation(requested, tabs) {
    if (!requested || tabs.some((tab)=>tab.id === requested)) return undefined;
    return {
        tabs,
        execution: {
            outcome: "target-unavailable",
            actionIssued: false,
            requestedTabId: requested,
            recovery: "The previous tab no longer exists. Select the intended tab from the returned list, or open the known task URL. No other tab was selected or operated."
        }
    };
}
const sensitiveBrowserHeaders = new Set([
    "authorization",
    "cookie",
    "proxy-authorization",
    "set-cookie",
    "x-api-key",
    "x-auth-token"
]);
export function sanitizeBrowserHeaders(headers, maxValueChars = 2_048) {
    return Object.fromEntries(Object.entries(headers).filter(([key])=>!sensitiveBrowserHeaders.has(key.toLowerCase())).map(([key, value])=>[
            key.toLowerCase(),
            String(value).length > maxValueChars ? `${String(value).slice(0, maxValueChars)}…` : String(value)
        ]));
}
export function resolveBrowserOpenTab(input) {
    if (input.newTab && input.requested) throw new Error("新建标签不能同时指定已有 tabId");
    if (input.newTab) return undefined;
    if (input.requested) {
        if (!input.tabs.some((tab)=>tab.id === input.requested)) throw new Error("目标标签已关闭，请重新读取标签列表");
        return input.requested;
    }
    if (input.current && input.tabs.some((tab)=>tab.id === input.current)) return input.current;
    const claimed = new Set(input.claimed);
    return input.tabs.find((tab)=>tab.url === "about:blank" && !claimed.has(tab.id))?.id;
}
export function createBrowserNavigationQueue() {
    const pending = new Map();
    return function enqueue(sessionID, run) {
        const next = (pending.get(sessionID) ?? Promise.resolve()).catch(()=>undefined).then(run);
        pending.set(sessionID, next);
        return next.finally(()=>{
            if (pending.get(sessionID) === next) pending.delete(sessionID);
        });
    };
}
export function normalizeBrowserUrl(input) {
    const value = input.trim();
    if (!value) throw new Error("请输入网址");
    if (value === "about:blank") return value;
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("仅支持 http:// 和 https:// 网址");
    if (url.username || url.password) throw new Error("网址中不能包含账号或密码");
    return url.toString();
}
export function normalizeManagedChromeUrl(input) {
    const value = input.trim();
    if (/^chrome:\/\/(?:extensions|settings)\/?$/i.test(value)) return value;
    return normalizeBrowserUrl(value);
}
export function browserUrlAllowed(input) {
    try {
        normalizeBrowserUrl(input);
        return true;
    } catch  {
        return false;
    }
}
export function normalizeBrowserBounds(bounds, scale = 1) {
    const number = (value)=>Number.isFinite(value) ? value : 0;
    const factor = Number.isFinite(scale) && scale > 0 ? scale : 1;
    return {
        x: Math.max(0, Math.round(number(bounds.x) * factor)),
        y: Math.max(0, Math.round(number(bounds.y) * factor)),
        width: Math.max(1, Math.round(number(bounds.width) * factor)),
        height: Math.max(1, Math.round(number(bounds.height) * factor))
    };
}
export function parseBrowserRef(ref) {
    const match = /^(\d+):(\d+)$/.exec(ref);
    if (!match) throw new Error("页面元素引用无效，请重新读取页面");
    return {
        epoch: Number(match[1]),
        index: Number(match[2])
    };
}
export function resolveBrowserTarget(input) {
    const ref = input.ref ?? (input.selector && /^\d+:\d+$/.test(input.selector) ? input.selector : undefined);
    if (ref) {
        parseBrowserRef(ref);
        return {
            ref
        };
    }
    if (input.selector?.trim()) return {
        selector: input.selector
    };
    throw new Error("浏览器操作需要 snapshot ref 或 CSS selector");
}
