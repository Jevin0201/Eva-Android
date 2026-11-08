// Authorized BuLu browser-logic port; provenance: port-manifest.json.
import { sanitizeBrowserHeaders } from "./browser-host-state.mjs";
export function captureWorkerHTTP(protocol, archive, target, owners, track, canCapture) {
    const requests = new Map();
    const started = new Map();
    protocol.on("Network.requestWillBeSent", (event)=>{
        if (!canCapture()) return;
        const previous = requests.get(event.requestId);
        const records = (async ()=>{
            const parent = event.redirectResponse ? await previous : undefined;
            if (event.redirectResponse) {
                for (const record of parent ?? [])await archive.update(record.id, {
                    status: event.redirectResponse.status,
                    responseHeaders: sanitizeBrowserHeaders(event.redirectResponse.headers, Number.MAX_SAFE_INTEGER),
                    responseBody: {
                        state: "unavailable",
                        reason: "Chrome does not expose redirect response bodies"
                    }
                });
            }
            return Promise.all((await owners()).map(async (owner)=>{
                const record = await archive.create({
                    ...owner,
                    targetId: target.targetId,
                    targetType: target.type,
                    targetURL: target.url,
                    attribution: target.type === "worker" && !owner.tabId.startsWith("background:") ? "page-worker" : "browser-background",
                    at: Date.now(),
                    url: event.request.url,
                    method: event.request.method,
                    resourceType: (event.type ?? "Other").toLowerCase(),
                    source: target.type,
                    requestHeaders: sanitizeBrowserHeaders(event.request.headers, Number.MAX_SAFE_INTEGER),
                    requestBody: {
                        state: "pending"
                    },
                    responseBody: {
                        state: "pending"
                    },
                    redirectedFrom: parent?.find((item)=>item.sessionID === owner.sessionID)?.id
                });
                if (event.request.hasPostData) {
                    try {
                        const entries = event.request.postDataEntries;
                        const raw = entries?.length && entries.every((entry)=>entry.bytes !== undefined) ? Buffer.concat(entries.map((entry)=>Buffer.from(entry.bytes, "base64"))) : undefined;
                        const body = raw ?? Buffer.from(event.request.postData ?? (await protocol.send("Network.getRequestPostData", {
                            requestId: event.requestId
                        })).postData);
                        const saved = await archive.saveBody(record.id, "request", body, event.request.headers["Content-Type"] ?? event.request.headers["content-type"] ?? "");
                        if ((/multipart\/form-data/i.test(event.request.headers["Content-Type"] ?? event.request.headers["content-type"] ?? "") || !raw && !/(?:text|json|xml|javascript|graphql|x-www-form-urlencoded)/i.test(event.request.headers["Content-Type"] ?? event.request.headers["content-type"] ?? "")) && saved) await archive.update(record.id, {
                            requestBody: {
                                ...saved,
                                state: "partial",
                                reason: "Chrome did not provide verified raw bytes for this binary/multipart request"
                            }
                        });
                    } catch (error) {
                        await archive.update(record.id, {
                            requestBody: {
                                state: "unavailable",
                                reason: String(error)
                            }
                        });
                    }
                } else await archive.update(record.id, {
                    requestBody: {
                        state: "empty"
                    }
                });
                return record;
            }));
        })();
        requests.set(event.requestId, records);
        started.set(event.requestId, Date.now());
        track(records, `worker request ${event.request.url}`);
    });
    protocol.on("Network.responseReceived", (event)=>{
        track((async ()=>{
            for (const record of await requests.get(event.requestId) ?? [])await archive.update(record.id, {
                status: event.response.status,
                responseHeaders: sanitizeBrowserHeaders(event.response.headers, Number.MAX_SAFE_INTEGER),
                timing: event.response.timing ? {
                    ...event.response.timing
                } : undefined
            });
        })(), "worker response");
    });
    const finish = (requestId, failure)=>{
        const records = requests.get(requestId);
        requests.delete(requestId);
        const at = started.get(requestId);
        started.delete(requestId);
        if (!records) return;
        track((async ()=>{
            for (const record of (await records)){
                const current = await archive.get(record.sessionID, record.id).catch(()=>undefined);
                if (!current) continue;
                await archive.update(record.id, {
                    failure,
                    durationMs: at === undefined ? undefined : Date.now() - at
                });
                if (failure) {
                    await archive.update(record.id, {
                        responseBody: {
                            state: "unavailable",
                            reason: failure
                        }
                    });
                    continue;
                }
                if (record.method === "HEAD" || [
                    204,
                    205,
                    304
                ].includes(current.status ?? 0)) {
                    await archive.update(record.id, {
                        responseBody: {
                            state: "empty"
                        }
                    });
                    continue;
                }
                if (/text\/event-stream/i.test(current.responseHeaders?.["content-type"] ?? "")) {
                    await archive.update(record.id, {
                        responseBody: {
                            state: "unavailable",
                            reason: "Stream payloads are stored as eventsource child events/chunks"
                        }
                    });
                    continue;
                }
                try {
                    const body = await protocol.send("Network.getResponseBody", {
                        requestId
                    });
                    await archive.saveBody(record.id, "response", Buffer.from(body.body, body.base64Encoded ? "base64" : "utf8"), current.responseHeaders?.["content-type"] ?? "");
                } catch (error) {
                    await archive.update(record.id, {
                        responseBody: {
                            state: "unavailable",
                            reason: String(error)
                        }
                    });
                }
            }
        })(), "worker body");
    };
    protocol.on("Network.loadingFinished", (event)=>finish(event.requestId));
    protocol.on("Network.loadingFailed", (event)=>finish(event.requestId, event.errorText));
    protocol.once("Inspector.detached", ()=>{
        for (const id of requests.keys())finish(id, "Worker target detached before response capture completed");
    });
}
