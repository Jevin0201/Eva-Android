// Authorized BuLu browser-logic port; provenance: port-manifest.json.
import { randomUUID } from "node:crypto";
import { BrowserNetworkArchive } from "./browser-network-archive.mjs";
import { sanitizeBrowserHeaders } from "./browser-host-state.mjs";
import { BrowserTargetProtocol } from "./browser-target-protocol.mjs";
import { captureWorkerHTTP } from "./browser-worker-network.mjs";
export const browserBackgroundSession = "@rae-browser-background";
export class BrowserNetworkRecorder {
    archive;
    tabID;
    sessions;
    enabled = new Set();
    requests = new WeakMap();
    pages = new WeakMap();
    contexts = new WeakSet();
    mocked = new WeakSet();
    watched = new Map();
    frameIDs = new WeakMap();
    jobs = new Map();
    error;
    streamSupport = "unknown";
    droppedRequests = 0;
    excludedBackgroundRequests = 0;
    droppedMessages = 0;
    overloaded = new WeakSet();
    incompleteStreams = new Set();
    targets;
    targetReady;
    targetPages = new Map();
    workerParents = new Map();
    workerTargets = new Map();
    constructor(archive, tabID, sessions, options={}){
        this.archive = archive;
        this.tabID = tabID;
        this.sessions = sessions;
        this.allowTarget = options.allowTarget;
        this.allowCapture = options.allowCapture;
    }
    prepare(endpoint) {
        if (this.targets?.connected) return this.targetReady ?? Promise.resolve();
        this.targets?.close();
        this.targets = new BrowserTargetProtocol(async (target, protocol, parent)=>{
            if (parent) this.workerParents.set(target.targetId, parent.targetId);
            if (![
                "worker",
                "shared_worker",
                "service_worker",
                "iframe"
            ].includes(target.type)) return;
            if(this.allowTarget&&!this.allowTarget(target,parent))return;
            this.workerTargets.set(target.targetId, target);
            const owners = ()=>this.workerOwners(target);
            if (target.type !== "iframe" && (target.type !== "worker" || !this.workerPage(target))) captureWorkerHTTP(protocol, this.archive, target, owners, (job, label)=>this.track(job, label), ()=>{
                if (!this.enabled.size) return false;
                if (this.jobs.size <= 512) return true;
                this.droppedRequests++;
                this.error = "Capture queue quota exceeded; some worker requests were not recorded";
                return false;
            });
            await this.attachRealtime(protocol, async (url, resourceType)=>Promise.all((await owners()).map((owner)=>this.archive.create({
                        ...owner,
                        targetId: target.targetId,
                        targetType: target.type,
                        targetURL: target.url,
                        attribution: owner.sessionID === browserBackgroundSession ? "browser-background" : target.type === "iframe" ? "page-frame" : "page-worker",
                        at: Date.now(),
                        method: "GET",
                        url,
                        resourceType,
                        source: target.type,
                        responseBody: {
                            state: "pending"
                        }
                    }))), (close)=>protocol.once("Inspector.detached", close), false);
        }, (error)=>{
            this.error = error.message;
        }, (target)=>{
            this.workerTargets.delete(target.targetId);
            this.workerParents.delete(target.targetId);
        });
        this.targetReady = this.targets.connect(endpoint).catch((error)=>{
            this.error = error instanceof Error ? error.message : String(error);
        });
        return this.targetReady;
    }
    automationTargetReady(targetId) {
        return this.targets?.waitForTarget(targetId) ?? Promise.resolve();
    }
    attach(context, endpoint) {
        if (this.contexts.has(context)) return;
        this.contexts.add(context);
        if (endpoint) void this.prepare(endpoint);
        const targets = this.targets;
        context.once("close", ()=>targets?.close());
        context.on("request", (request)=>{
            if (!this.enabled.size) return;
            if (this.jobs.size > 512) {
                this.droppedRequests++;
                this.error = "Capture queue quota exceeded; some requests were not recorded";
                return;
            }
            const started = Date.now();
            const captured = this.captureRequest(request, started);
            this.requests.set(request, captured);
            this.track(captured, `request ${request.url()}`);
        });
        context.on("response", (response)=>this.track(this.captureResponse(response), `response ${response.url()}`));
        context.on("requestfailed", (request)=>this.track(this.failed(request)));
        context.pages().forEach((page)=>this.track(this.attachPage(page)));
        context.on("page", (page)=>this.track(this.attachPage(page)));
    }
    async start(sessionID, page) {
        this.enabled.add(sessionID);
        await this.watch(sessionID, page);
        await this.targetReady;
    }
    async watch(sessionID, page) {
        const owners = this.watched.get(this.tabID(page)) ?? new Set();
        owners.add(sessionID);
        this.watched.set(this.tabID(page), owners);
        if (this.enabled.has(sessionID)) await this.attachPage(page);
    }
    stop(sessionID) {
        this.enabled.delete(sessionID);
    }
    markMocked(request) {
        this.mocked.add(request);
    }
    async diagnostics(tabId) {
        const owners = [
            ...new Set([
                ...this.watched.get(tabId) ?? [],
                ...[
                    ...this.sessions()
                ].filter(([, tab])=>tab === tabId).map(([session])=>session)
            ])
        ];
        const owner = owners.find((session)=>this.enabled.has(session)) ?? owners[0];
        return {
            network: owner ? (await this.archive.list(owner, {
                tabId,
                limit: 1
            })).total : 0,
            networkEnabled: owners.some((session)=>this.enabled.has(session))
        };
    }
    status(sessionID) {
        return {
            enabled: this.enabled.has(sessionID),
            storage: "local-sqlite-and-body-files",
            bodyRepresentation: "Browser-decoded content; sensitive authentication headers removed",
            limits: {
                defaultBodyBytes: 32 * 1024 * 1024,
                defaultArchiveBytes: 512 * 1024 * 1024,
                retentionDays: 7
            },
            coverage: {
                http: true,
                websocket: true,
                eventSource: true,
                fetchStreaming: this.streamSupport,
                realtimeTargets: this.targets?.connected ? "Pages, out-of-process frames, dedicated workers, shared workers and service workers" : "Pages only; browser target connection unavailable",
                workerTargets: this.workerTargets.size,
                workerAttribution: "Dedicated workers inherit their owning page; shared and background traffic is stored separately under scope=background"
            },
            droppedRequests: this.droppedRequests,
            excludedBackgroundRequests: this.excludedBackgroundRequests,
            droppedMessages: this.droppedMessages,
            ...this.error ? {
                captureError: this.error
            } : {}
        };
    }
    track(job, label = "protocol event") {
        this.jobs.set(job, label);
        void job.catch((error)=>{
            this.error = error instanceof Error ? error.message : String(error);
        }).finally(()=>this.jobs.delete(job));
    }
    async flush() {
        let timer;
        try {
            await Promise.race([
                Promise.allSettled([
                    ...this.jobs.keys()
                ]),
                new Promise((_, reject)=>{
                    timer = setTimeout(()=>reject(new Error(`Capture jobs still pending: ${[
                            ...this.jobs.values()
                        ].slice(0, 8).join(", ")}`)), 5000);
                })
            ]);
        } finally{
            clearTimeout(timer);
        }
    }
    async owners(page) {
        if (!page) return [];
        const direct = [
            ...new Set([
                ...this.watched.get(this.tabID(page)) ?? [],
                ...[
                    ...this.sessions()
                ].filter(([, tab])=>tab === this.tabID(page)).map(([id])=>id)
            ])
        ].filter((sessionID)=>this.enabled.has(sessionID));
        if (direct.length) return direct;
        const opener = await page.opener().catch(()=>null);
        return opener ? this.owners(opener) : [];
    }
    async captureRequest(request, started) {
        const worker = request.serviceWorker();
        if(worker&&this.allowTarget&&!this.allowTarget({type:'service_worker',url:worker.url()}))return {records:[],started};
        if (this.targets?.connected && worker && [
            ...this.workerTargets.values()
        ].some((target)=>target.type === "service_worker" && target.url === worker.url())) return {
            records: [],
            started
        };
        const frame = (()=>{
            try {
                return request.frame();
            } catch  {
                return undefined;
            }
        })();
        const page = frame?.page();
        const owners = !page && worker ? [
            browserBackgroundSession
        ] : await this.owners(page);
        if (!owners.length) {
            if (request.serviceWorker()) this.excludedBackgroundRequests++;
            return {
                records: [],
                started
            };
        }
        const previous = request.redirectedFrom();
        const parent = previous ? await this.requests.get(previous) : undefined;
        if (frame && !this.frameIDs.has(frame)) this.frameIDs.set(frame, randomUUID());
        const records = await Promise.all(owners.map((sessionID)=>this.archive.create({
                sessionID,
                tabId: page ? this.tabID(page) : `background:${worker.url()}`,
                at: started,
                method: request.method(),
                url: request.url(),
                resourceType: request.resourceType(),
                requestHeaders: sanitizeBrowserHeaders(request.headers(), Number.MAX_SAFE_INTEGER),
                requestBody: {
                    state: "pending"
                },
                responseBody: {
                    state: "pending"
                },
                redirectedFrom: parent?.records.find((record)=>record.sessionID === sessionID)?.id,
                source: request.serviceWorker() ? "service-worker" : "page",
                frameId: frame ? this.frameIDs.get(frame) : undefined,
                frameURL: frame?.url()
            })));
        const headers = records.length ? sanitizeBrowserHeaders(await captureDeadline(request.allHeaders(), 2000).catch(()=>request.headers()), Number.MAX_SAFE_INTEGER) : {};
        const oversized = Number(headers["content-length"]) > 32 * 1024 * 1024;
        const body = oversized ? null : request.postDataBuffer();
        await Promise.all(records.map(async (record)=>{
            await this.archive.update(record.id, {
                requestHeaders: headers
            });
            if (body !== null) {
                const descriptor = await this.archive.saveBody(record.id, "request", body, headers["content-type"] ?? "");
                if (descriptor && /multipart\/form-data/i.test(headers["content-type"] ?? "")) {
                    await this.archive.update(record.id, {
                        requestBody: {
                            ...descriptor,
                            state: "partial",
                            reason: "Browser multipart capture may omit file payloads; provide an explicit body for replay"
                        }
                    });
                }
            } else await this.archive.update(record.id, {
                requestBody: {
                    state: !oversized && (request.method() === "GET" || request.method() === "HEAD") ? "empty" : "unavailable",
                    reason: oversized ? "Request body exceeds capture memory quota" : "Browser provided no request body; multipart file bytes may be unavailable"
                }
            });
        }));
        return {
            records,
            started
        };
    }
    async captureResponse(response) {
        const captured = await this.requests.get(response.request());
        if (!captured?.records.length) return;
        const headers = sanitizeBrowserHeaders(await captureDeadline(response.allHeaders(), 2000).catch(()=>response.headers()), Number.MAX_SAFE_INTEGER);
        await Promise.all(captured.records.map((record)=>this.archive.update(record.id, {
                status: response.status(),
                responseHeaders: headers,
                source: this.mocked.has(response.request()) ? "mock" : response.fromServiceWorker() ? "service-worker" : record.source
            })));
        if (response.request().method() === "HEAD" || [
            204,
            205,
            304
        ].includes(response.status())) {
            await Promise.all(captured.records.map((record)=>this.archive.update(record.id, {
                    responseBody: {
                        state: "empty"
                    },
                    durationMs: Date.now() - captured.started
                })));
            return;
        }
        if ([
            301,
            302,
            303,
            307,
            308
        ].includes(response.status())) {
            await Promise.all(captured.records.map((record)=>this.archive.update(record.id, {
                    responseBody: {
                        state: "unavailable",
                        reason: "Browser redirect bodies are not exposed; follow the redirectedFrom chain"
                    }
                })));
            return;
        }
        if (/text\/event-stream/i.test(headers["content-type"] ?? "")) {
            await Promise.all(captured.records.map((record)=>this.archive.update(record.id, {
                    responseBody: {
                        state: "unavailable",
                        reason: "Live stream: list resourceType=eventsource with this URL, then read messages by its parentID"
                    }
                })));
            return;
        }
        if (Number(headers["content-length"]) > 32 * 1024 * 1024) {
            await Promise.all(captured.records.map((record)=>this.archive.update(record.id, {
                    responseBody: {
                        state: "unavailable",
                        bytes: Number(headers["content-length"]),
                        reason: "Body exceeds capture memory quota; download the file instead"
                    }
                })));
            return;
        }
        const failure = await captureDeadline(response.finished(), 30000).catch((error)=>error instanceof Error ? error : new Error(String(error)));
        await Promise.all(captured.records.map((record)=>this.archive.update(record.id, {
                durationMs: Date.now() - captured.started,
                timing: response.request().timing()
            })));
        if (failure) {
            await Promise.all(captured.records.map((record)=>this.archive.update(record.id, {
                    failure: failure.message,
                    responseBody: {
                        state: "unavailable",
                        reason: failure.message
                    }
                })));
            return;
        }
        try {
            const body = await captureDeadline(response.body(), 30000);
            await Promise.all(captured.records.map((record)=>this.archive.saveBody(record.id, "response", body, headers["content-type"] ?? "")));
        } catch (error) {
            await Promise.all(captured.records.map((record)=>this.archive.update(record.id, {
                    responseBody: {
                        state: "unavailable",
                        reason: error instanceof Error ? error.message : String(error)
                    }
                })));
        }
    }
    async failed(request) {
        const captured = await this.requests.get(request);
        if (!captured) return;
        const failure = request.failure()?.errorText ?? "Request failed";
        await Promise.all(captured.records.map((record)=>this.archive.update(record.id, {
                failure,
                durationMs: Date.now() - captured.started,
                responseBody: {
                    state: "unavailable",
                    reason: failure
                }
            })));
    }
    attachPage(page) {
        if(!this.tabID(page))return Promise.resolve();
        const existing = this.pages.get(page);
        if (existing) return existing;
        const attached = this.attachProtocols(page);
        this.pages.set(page, attached);
        return attached;
    }
    async attachProtocols(page) {
        const cdp = await page.context().newCDPSession(page);
        const { targetInfo } = await cdp.send("Target.getTargetInfo");
        this.targetPages.set(targetInfo.targetId, page);
        await this.attachRealtime(cdp, async (url, resourceType)=>Promise.all((await this.owners(page)).map((sessionID)=>this.archive.create({
                    sessionID,
                    tabId: this.tabID(page),
                    at: Date.now(),
                    method: "GET",
                    url,
                    resourceType,
                    source: "cdp",
                    responseBody: {
                        state: "pending"
                    }
                }))), (close)=>page.once("close", ()=>{
                this.watched.delete(this.tabID(page));
                this.targetPages.delete(targetInfo.targetId);
                close();
                void cdp.detach().catch(()=>undefined);
            }));
    }
    async workerOwners(target) {
        if (!this.enabled.size) return [];
        if (target.type === "worker" || target.type === "iframe") {
            const page = this.workerPage(target);
            if (page) return (await this.owners(page)).map((sessionID)=>({
                    sessionID,
                    tabId: this.tabID(page)
                }));
        }
        if(this.allowCapture&&!this.allowCapture(target))return [];
        return [
            {
                sessionID: browserBackgroundSession,
                tabId: `background:${target.targetId}`
            }
        ];
    }
    workerPage(target) {
        let parent = this.workerParents.get(target.targetId);
        const seen = new Set();
        while(parent && !seen.has(parent)){
            seen.add(parent);
            const page = this.targetPages.get(parent);
            if (page) return page;
            parent = this.workerParents.get(parent);
        }
    }
    async attachRealtime(cdp, create, onClose, awaitEnable = true) {
        const sockets = new Map();
        const streams = new Map();
        const chunk = async (parents, payload, resourceType, direction, eventName, eventID, opcode)=>{
            if (this.jobs.size > 512) {
                this.droppedMessages++;
                if (parents && !this.overloaded.has(parents)) {
                    this.overloaded.add(parents);
                    this.track(parents.then((records)=>Promise.all(records.map((record)=>{
                            this.incompleteStreams.add(record.id);
                            return this.archive.update(record.id, {
                                responseBody: {
                                    state: "partial",
                                    reason: "Some messages exceeded the capture queue quota"
                                }
                            });
                        }))));
                }
                return;
            }
            for (const parent of await parents ?? []){
                if (parent.sessionID === browserBackgroundSession ? !this.enabled.size : !this.enabled.has(parent.sessionID)) continue;
                const record = await this.archive.create({
                    sessionID: parent.sessionID,
                    tabId: parent.tabId,
                    at: Date.now(),
                    method: "MESSAGE",
                    url: parent.url,
                    resourceType,
                    parentID: parent.id,
                    direction,
                    eventName,
                    eventID,
                    opcode,
                    targetId: parent.targetId,
                    targetType: parent.targetType,
                    targetURL: parent.targetURL,
                    attribution: parent.attribution
                });
                await this.archive.saveBody(record.id, "response", payload, resourceType.includes("binary") ? "application/octet-stream" : "text/plain");
            }
        };
        cdp.on("Network.webSocketCreated", (event)=>{
            const records = create(event.url, "websocket");
            sockets.set(event.requestId, records);
            this.track(records);
        });
        cdp.on("Network.webSocketHandshakeResponseReceived", (event)=>this.track((async ()=>{
                for (const record of await sockets.get(event.requestId) ?? [])await this.archive.update(record.id, {
                    status: event.response.status,
                    responseHeaders: sanitizeBrowserHeaders(event.response.headers)
                });
            })()));
        cdp.on("Network.webSocketWillSendHandshakeRequest", (event)=>this.track((async ()=>{
                for (const record of await sockets.get(event.requestId) ?? [])await this.archive.update(record.id, {
                    requestHeaders: sanitizeBrowserHeaders(event.request.headers, Number.MAX_SAFE_INTEGER)
                });
            })()));
        cdp.on("Network.webSocketFrameSent", (event)=>this.track(chunk(sockets.get(event.requestId), Buffer.from(event.response.payloadData, event.response.opcode === 1 ? "utf8" : "base64"), event.response.opcode === 1 ? "websocket-text" : "websocket-binary", "sent", undefined, undefined, event.response.opcode)));
        cdp.on("Network.webSocketFrameReceived", (event)=>this.track(chunk(sockets.get(event.requestId), Buffer.from(event.response.payloadData, event.response.opcode === 1 ? "utf8" : "base64"), event.response.opcode === 1 ? "websocket-text" : "websocket-binary", "received", undefined, undefined, event.response.opcode)));
        cdp.on("Network.webSocketClosed", (event)=>this.track((async ()=>{
                const records = sockets.get(event.requestId);
                sockets.delete(event.requestId);
                for (const record of await records ?? [])await this.archive.update(record.id, {
                    responseBody: this.incompleteStreams.delete(record.id) ? {
                        state: "partial",
                        reason: "Some messages exceeded the capture queue quota"
                    } : {
                        state: "empty",
                        reason: "Closed; messages are stored as child records"
                    }
                });
            })()));
        cdp.on("Network.webSocketFrameError", (event)=>this.track((async ()=>{
                for (const record of await sockets.get(event.requestId) ?? [])await this.archive.update(record.id, {
                    failure: event.errorMessage
                });
            })()));
        cdp.on("Network.responseReceived", (event)=>{
            if (!/text\/event-stream/i.test(event.response.mimeType)) return;
            const records = create(event.response.url, "eventsource");
            const stream = {
                records
            };
            streams.set(event.requestId, stream);
            stream.ready = (async ()=>{
                if (!(await records).length) return;
                for (const record of (await records))await this.archive.update(record.id, {
                    status: event.response.status
                });
                if (event.type === "EventSource") return;
                await this.startStream(cdp, event.requestId, records, chunk);
            })();
            this.track(stream.ready);
        });
        cdp.on("Network.eventSourceMessageReceived", (event)=>this.track(chunk(streams.get(event.requestId)?.records, Buffer.from(event.data), "eventsource-message", "received", event.eventName, event.eventId)));
        cdp.on("Network.dataReceived", (event)=>{
            const stream = streams.get(event.requestId);
            if (!stream || !event.data) return;
            this.track((async ()=>{
                await stream.ready;
                await chunk(stream.records, Buffer.from(event.data, "base64"), "stream-chunk", "received");
            })());
        });
        const finish = (requestId, failure)=>{
            const stream = streams.get(requestId);
            streams.delete(requestId);
            if (!stream) return;
            this.track((async ()=>{
                for (const record of (await stream.records)){
                    const current = await this.archive.get(record.sessionID, record.id).catch(()=>undefined);
                    if (!current) continue;
                    await this.archive.update(record.id, {
                        failure,
                        responseBody: current.responseBody?.state === "unavailable" || current.responseBody?.state === "partial" ? current.responseBody : {
                            state: failure ? "partial" : "empty",
                            reason: failure ?? "Stream ended; read child events/chunks"
                        }
                    });
                    this.incompleteStreams.delete(record.id);
                }
            })());
        };
        cdp.on("Network.loadingFinished", (event)=>finish(event.requestId));
        cdp.on("Network.loadingFailed", (event)=>finish(event.requestId, event.errorText));
        onClose(()=>{
            const connections = [
                ...sockets.values(),
                ...[
                    ...streams.values()
                ].map((stream)=>stream.records)
            ];
            sockets.clear();
            streams.clear();
            this.track((async ()=>{
                for (const records of connections)for (const record of (await records)){
                    const current = await this.archive.get(record.sessionID, record.id).catch(()=>undefined);
                    if (!current) continue;
                    await this.archive.update(record.id, {
                        responseBody: current.responseBody?.state === "pending" ? {
                            state: "empty",
                            reason: "Page closed; available messages are retained as child records"
                        } : current.responseBody
                    });
                    this.incompleteStreams.delete(record.id);
                }
            })());
        });
        const enabled = cdp.send("Network.enable", {
            maxTotalBufferSize: 64 * 1024 * 1024,
            maxResourceBufferSize: 32 * 1024 * 1024,
            maxPostDataSize: 32 * 1024 * 1024
        });
        if (awaitEnable) await enabled;
        else this.track(enabled, "worker Network.enable");
    }
    async startStream(cdp, requestId, records, chunk) {
        try {
            const result = await cdp.send("Network.streamResourceContent", {
                requestId
            });
            this.streamSupport = "available";
            if (result.bufferedData) await chunk(records, Buffer.from(result.bufferedData, "base64"), "stream-chunk", "received");
        } catch (error) {
            this.streamSupport = "unavailable";
            for (const record of (await records))await this.archive.update(record.id, {
                responseBody: {
                    state: "unavailable",
                    reason: `Streaming API unavailable: ${error instanceof Error ? error.message : String(error)}`
                }
            });
        }
    }
}
async function captureDeadline(operation, timeoutMs) {
    let timer;
    try {
        return await Promise.race([
            operation,
            new Promise((_, reject)=>{
                timer = setTimeout(()=>reject(new Error("Browser capture operation exceeded its time quota")), timeoutMs);
            })
        ]);
    } finally{
        clearTimeout(timer);
    }
}
