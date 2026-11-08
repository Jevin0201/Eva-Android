// Authorized BuLu browser-logic port; provenance: port-manifest.json.
export async function requestInPage(page, input) {
    if (!input.url?.trim()) throw new Error("Browser request requires a URL");
    const maxResponseChars = Number.isFinite(input.maxResponseChars) ? Math.max(1, Math.min(200_000, Math.floor(input.maxResponseChars))) : 4000;
    const headers = Object.fromEntries(Object.entries(input.headers ?? {}).filter(([name])=>!/^(?:cookie|host|origin|referer|content-length|sec-|proxy-)/i.test(name)));
    return page.evaluate(async ({ requestURL, method, headers, body, maxResponseChars, digestResponse, timeoutMs })=>{
        const target = new URL(requestURL, location.href);
        if (!/^https?:$/.test(target.protocol)) throw new Error("Browser request URL must use HTTP or HTTPS");
        const response = await fetch(target.href, {
            method,
            headers,
            body: method === "GET" ? undefined : body,
            credentials: "include",
            redirect: "follow",
            signal: AbortSignal.timeout(timeoutMs)
        });
        const text = await response.text();
        const digest = digestResponse && globalThis.crypto?.subtle ? await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)) : undefined;
        return {
            url: response.url,
            status: response.status,
            ok: response.ok,
            redirected: response.redirected,
            contentType: response.headers.get("content-type") ?? "",
            sha256: digest ? Array.from(new Uint8Array(digest), (byte)=>byte.toString(16).padStart(2, "0")).join("") : undefined,
            text: text.slice(0, maxResponseChars),
            totalChars: text.length,
            truncated: text.length > maxResponseChars || undefined
        };
    }, {
        requestURL: input.url,
        method: input.method ?? "GET",
        headers,
        body: input.body,
        maxResponseChars,
        digestResponse: input.digestResponse ?? false,
        timeoutMs: Number.isFinite(input.timeoutMs) ? Math.max(1, Math.min(25000, Math.floor(input.timeoutMs))) : 25000
    });
}
export async function replayBrowserRequest(archive, sessionID, page, input) {
    if (!input.recordID) throw new Error("Replay requires recordID");
    const original = input.body === undefined ? await archive.replayData(sessionID, input.recordID) : {
        record: await archive.get(sessionID, input.recordID),
        body: input.body
    };
    const method = input.method ?? original.record.method;
    if (![
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE"
    ].includes(method)) throw new Error("Unsupported replay method");
    const response = await requestInPage(page, {
        url: input.url ?? original.record.url,
        method: method,
        headers: {
            ...original.record.requestHeaders,
            ...input.headers
        },
        body: original.body,
        maxResponseChars: input.maxResponseChars ?? 4000,
        digestResponse: true,
        timeoutMs: input.timeoutMs
    });
    return {
        replayedFrom: original.record.id,
        comparison: await archive.compareResponse(sessionID, original.record.id, response),
        response
    };
}
const mocks = new WeakMap();
export async function mockBrowserResponse(page, input, mark) {
    if (!input.url) throw new Error("Mock requires an exact HTTP(S) URL");
    const target = new URL(input.url, page.url());
    target.hash = "";
    const url = target.href;
    if (!/^https?:/.test(url)) throw new Error("Mock requires an HTTP(S) URL");
    const status = Number.isInteger(input.status) && input.status >= 200 && input.status <= 599 ? input.status : 200;
    const key = `${input.method ?? "*"} ${url}`;
    const registered = mocks.get(page) ?? new Map();
    const previous = registered.get(key);
    if (previous) await page.unroute(previous.matcher, previous.handler);
    const matcher = (candidate)=>candidate.href === url;
    const handler = async (route)=>{
        if (input.method && route.request().method() !== input.method) return route.fallback();
        mark(route.request());
        await route.fulfill({
            status,
            headers: {
                "content-type": "application/json",
                ...input.headers
            },
            body: input.body ?? ""
        });
    };
    await page.route(matcher, handler);
    registered.set(key, {
        url,
        matcher,
        handler
    });
    mocks.set(page, registered);
    return {
        mocking: true,
        url,
        method: input.method ?? "*",
        status,
        note: "Test response interception is active for this page. It changes real browser behavior; remove it after testing. Service Worker interception is not guaranteed."
    };
}
export async function unmockBrowserResponse(page, url) {
    const registered = mocks.get(page);
    const target = url ? new URL(url, page.url()).href : undefined;
    let removed = 0;
    for (const [key, mock] of registered ?? []){
        if (target && target !== mock.url) continue;
        await page.unroute(mock.matcher, mock.handler);
        registered.delete(key);
        removed++;
    }
    return {
        mocking: !!registered?.size,
        removed
    };
}
