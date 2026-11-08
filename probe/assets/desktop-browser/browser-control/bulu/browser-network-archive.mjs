// Authorized BuLu browser-logic port; provenance: port-manifest.json.
import { createHash, randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { mkdir, open, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
export async function openNetworkArchive(directory, options = {}) {
    await mkdir(directory, {
        recursive: true
    });
    const database = options.database ?? new (await import("node:sqlite")).DatabaseSync(path.join(directory, "index.sqlite"));
    const archive = new BrowserNetworkArchive(directory, database, options);
    await archive.maintain();
    await archive.removeOrphans();
    return archive;
}
export class BrowserNetworkArchive {
    directory;
    db;
    tail = Promise.resolve();
    writes = 0;
    version = 0;
    changes = new EventEmitter();
    maxBytes;
    maxBodyBytes;
    retentionMs;
    usedBytes = 0;
    sequence = 0;
    constructor(directory, db, options = {}){
        this.directory = directory;
        this.db = db;
        this.maxBytes = integer(options.maxBytes, 1024, 8 * 1024 * 1024 * 1024, 512 * 1024 * 1024);
        this.maxBodyBytes = integer(options.maxBodyBytes, 1, 256 * 1024 * 1024, 32 * 1024 * 1024);
        this.retentionMs = integer(options.retentionMs, 1000, 30 * 24 * 60 * 60 * 1000, 7 * 24 * 60 * 60 * 1000);
        db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000;
      CREATE TABLE IF NOT EXISTS network_record (
        id TEXT PRIMARY KEY, seq INTEGER NOT NULL, session_id TEXT NOT NULL, tab_id TEXT NOT NULL, at INTEGER NOT NULL,
        parent_id TEXT, resource_type TEXT NOT NULL, status INTEGER, url TEXT NOT NULL,
        metadata TEXT NOT NULL, bytes INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS network_session_time ON network_record(session_id, seq DESC);
      CREATE INDEX IF NOT EXISTS network_parent ON network_record(session_id, parent_id);
    `);
        const rows = db.prepare("SELECT metadata FROM network_record WHERE json_extract(metadata,'$.requestBody.state')='pending' OR json_extract(metadata,'$.responseBody.state')='pending'").all();
        for (const row of rows){
            const record = JSON.parse(row.metadata);
            for (const body of [
                record.requestBody,
                record.responseBody
            ]){
                if (body?.state !== "pending") continue;
                body.state = "unavailable";
                body.reason = "Capture process ended before the body completed";
            }
            db.prepare("UPDATE network_record SET metadata=? WHERE id=?").run(JSON.stringify(record), record.id);
        }
        this.usedBytes = db.prepare("SELECT COALESCE(SUM(bytes),0) AS bytes FROM network_record").get().bytes;
        this.sequence = db.prepare("SELECT COALESCE(MAX(seq),0) AS seq FROM network_record").get().seq;
    }
    enqueue(run) {
        const result = this.tail.then(run).then((value)=>{
            this.version++;
            this.changes.emit("change");
            return value;
        });
        this.tail = result.catch(()=>undefined);
        return result;
    }
    create(input) {
        const record = {
            ...input,
            id: randomUUID(),
            sequence: ++this.sequence
        };
        return this.enqueue(async ()=>{
            const metadata = JSON.stringify(record);
            this.db.prepare("INSERT INTO network_record(id,seq,session_id,tab_id,at,parent_id,resource_type,status,url,metadata,bytes) VALUES(?,?,?,?,?,?,?,?,?,?,?)").run(record.id, record.sequence, record.sessionID, record.tabId, record.at, record.parentID ?? null, record.resourceType, record.status ?? null, record.url, metadata, Buffer.byteLength(metadata));
            this.usedBytes += Buffer.byteLength(metadata);
            if (++this.writes % 128 === 0 || this.usedBytes > this.maxBytes) await this.prune();
            return record;
        });
    }
    update(id, patch) {
        return this.enqueue(async ()=>{
            const record = this.lookup(id);
            if (!record) return;
            const metadata = JSON.stringify({
                ...record,
                ...patch,
                id: record.id,
                sessionID: record.sessionID
            });
            const delta = Buffer.byteLength(metadata) - Buffer.byteLength(JSON.stringify(record));
            this.db.prepare("UPDATE network_record SET metadata=?,status=?,bytes=bytes+? WHERE id=?").run(metadata, patch.status ?? record.status ?? null, delta, id);
            this.usedBytes += delta;
            if (this.usedBytes > this.maxBytes) await this.prune();
        });
    }
    saveBody(id, direction, body, contentType) {
        return this.enqueue(async ()=>{
            const record = this.lookup(id);
            if (!record) return;
            const text = /(?:json|text|xml|javascript|x-www-form-urlencoded|graphql|html)/i.test(contentType);
            const saved = body.subarray(0, Math.min(this.maxBodyBytes, Math.floor(this.maxBytes / 2)));
            const descriptor = {
                state: saved.length < body.length ? "partial" : body.length ? "complete" : "empty",
                bytes: body.length,
                savedBytes: saved.length,
                encoding: text ? "utf8" : "base64",
                ...saved.length < body.length ? {
                    reason: "Local body size quota exceeded"
                } : {}
            };
            await writeFile(this.bodyPath(id, direction), saved);
            const previous = record[`${direction}Body`]?.savedBytes ?? 0;
            const previousMetadata = JSON.stringify(record);
            record[`${direction}Body`] = descriptor;
            const delta = saved.length - previous + Buffer.byteLength(JSON.stringify(record)) - Buffer.byteLength(previousMetadata);
            this.db.prepare("UPDATE network_record SET metadata=?,bytes=bytes+? WHERE id=?").run(JSON.stringify(record), delta, id);
            this.usedBytes += delta;
            if (this.usedBytes > this.maxBytes) await this.prune();
            return descriptor;
        });
    }
    lookup(id) {
        const row = this.db.prepare("SELECT metadata FROM network_record WHERE id=?").get(id);
        return row ? JSON.parse(row.metadata) : undefined;
    }
    async get(sessionID, id) {
        await this.tail;
        const record = this.lookup(id);
        if (!record || record.sessionID !== sessionID) throw new Error("Network record not found in this conversation");
        return record;
    }
    filter(sessionID, query) {
        const clauses = [
            "session_id=?"
        ];
        const values = [
            sessionID
        ];
        for (const [column, value] of [
            [
                "tab_id",
                query.tabId
            ],
            [
                "resource_type",
                query.resourceType
            ],
            [
                "status",
                query.status
            ],
            [
                "parent_id",
                query.parentID
            ]
        ]){
            if (value === undefined) continue;
            clauses.push(`${column}=?`);
            values.push(value);
        }
        if (query.query) {
            clauses.push("instr(lower(url),lower(?))>0");
            values.push(query.query);
        }
        if (query.bodyState) {
            clauses.push("json_extract(metadata,'$.responseBody.state')=?");
            values.push(query.bodyState);
        }
        return {
            where: clauses.join(" AND "),
            values
        };
    }
    async list(sessionID, query = {}) {
        await this.tail;
        const { where, values } = this.filter(sessionID, query);
        const total = this.db.prepare(`SELECT COUNT(*) AS count FROM network_record WHERE ${where}`).get(...values).count;
        const offset = integer(query.offset, 0, 1_000_000, 0);
        const limit = integer(query.limit, 1, 100, 30);
        const order = query.parentID ? "ASC" : "DESC";
        const rows = this.db.prepare(`SELECT metadata FROM network_record WHERE ${where} ORDER BY seq ${order} LIMIT ? OFFSET ?`).all(...values, limit, offset);
        return {
            total,
            offset,
            nextOffset: offset + rows.length < total ? offset + rows.length : undefined,
            records: rows.map((row)=>{
                const record = JSON.parse(row.metadata);
                const { requestHeaders, responseHeaders, sessionID: owner, timing, frameURL, ...summary } = record;
                return summary;
            })
        };
    }
    async wait(sessionID, query, input = {}) {
        const deadline = Date.now() + integer(input.timeoutMs, 0, 25_000, 10_000);
        const minCount = integer(input.minCount, 1, 1000, 1);
        for(;;){
            const version = this.version;
            const result = await this.list(sessionID, query);
            if (result.total >= minCount || Date.now() >= deadline) return {
                ...result,
                conditionMet: result.total >= minCount
            };
            await new Promise((resolve)=>{
                const done = ()=>{
                    clearTimeout(timer);
                    this.changes.off("change", done);
                    resolve();
                };
                const timer = setTimeout(done, Math.max(0, deadline - Date.now()));
                this.changes.once("change", done);
                if (version !== this.version) done();
            });
        }
    }
    async compareResponse(sessionID, id, response) {
        const record = await this.get(sessionID, id);
        const descriptor = record.responseBody;
        const bytes = descriptor?.state === "complete" && descriptor.encoding === "utf8" ? await readFile(this.bodyPath(id, "response")).catch(()=>undefined) : undefined;
        const previousHash = bytes ? createHash("sha256").update(bytes.toString("utf8")).digest("hex") : undefined;
        return {
            previousStatus: record.status,
            statusChanged: record.status !== response.status,
            contentTypeChanged: record.responseHeaders?.["content-type"] !== response.contentType,
            bodyChanged: previousHash && response.sha256 ? previousHash !== response.sha256 : undefined,
            ...previousHash && response.sha256 ? {} : {
                bodyComparison: "Unavailable: requires a complete text reference and browser cryptographic digest"
            }
        };
    }
    async body(sessionID, id, direction, input = {}) {
        const record = await this.get(sessionID, id);
        const descriptor = record[`${direction}Body`];
        if (!descriptor || ![
            "complete",
            "partial",
            "empty"
        ].includes(descriptor.state)) return {
            body: descriptor ?? {
                state: "unavailable",
                reason: "No body recorded"
            }
        };
        if (descriptor.state === "empty" && !descriptor.savedBytes) return {
            body: descriptor,
            encoding: descriptor.encoding ?? "utf8",
            offset: 0,
            totalChars: 0,
            text: ""
        };
        const buffer = await readFile(this.bodyPath(id, direction)).catch(()=>undefined);
        if (!buffer) return {
            body: {
                state: "unavailable",
                reason: "Body file expired or is unavailable"
            }
        };
        const text = descriptor.encoding === "utf8" ? buffer.toString("utf8") : buffer.toString("base64");
        const selected = input.jsonPath ? JSON.stringify(selectJSON(JSON.parse(text), input.jsonPath)) ?? "null" : text;
        const offset = input.query ? Math.max(0, selected.indexOf(input.query, integer(input.offset, 0, selected.length, 0))) : integer(input.offset, 0, selected.length, 0);
        if (input.query && selected.indexOf(input.query, offset) === -1) return {
            body: descriptor,
            found: false
        };
        const limit = integer(input.limit, 1, 12_000, 4_000);
        return {
            body: descriptor,
            encoding: descriptor.encoding,
            offset,
            totalChars: selected.length,
            text: selected.slice(offset, offset + limit),
            nextOffset: offset + limit < selected.length ? offset + limit : undefined
        };
    }
    async replayData(sessionID, id) {
        const record = await this.get(sessionID, id);
        if (record.requestBody && ![
            "empty",
            "complete"
        ].includes(record.requestBody.state)) throw new Error("Cannot faithfully replay an incomplete request body; supply an explicit replacement body");
        if (record.requestBody?.encoding === "base64") throw new Error("Binary request replay requires an explicit replacement body");
        return {
            record,
            body: record.requestBody?.state === "complete" ? await readFile(this.bodyPath(id, "request"), "utf8") : undefined
        };
    }
    async export(sessionID, query = {}) {
        await this.tail;
        const directory = path.join(this.directory, "exports", randomUUID());
        await mkdir(directory, {
            recursive: true
        });
        const harPath = path.join(directory, "network.har");
        const eventsPath = path.join(directory, "events.jsonl");
        const har = await open(harPath, "w");
        const events = await open(eventsPath, "w");
        let entries = 0;
        let eventCount = 0;
        try {
            await har.write('{"log":{"version":"1.2","creator":{"name":"BuLu","version":"1"},"entries":[');
            const { where, values } = this.filter(sessionID, query);
            const ids = this.db.prepare(`SELECT id FROM network_record WHERE ${where} ORDER BY seq ASC`).all(...values);
            for (const { id } of ids){
                const record = await this.get(sessionID, id).catch(()=>undefined);
                if (!record) continue;
                const payload = async (direction)=>{
                    const descriptor = record[`${direction}Body`];
                    if (!descriptor?.savedBytes) return undefined;
                    const bytes = await readFile(this.bodyPath(id, direction)).catch(()=>undefined);
                    return bytes?.toString(descriptor.encoding === "utf8" ? "utf8" : "base64");
                };
                if (record.parentID || [
                    "websocket",
                    "eventsource"
                ].includes(record.resourceType)) {
                    await events.write(`${JSON.stringify({
                        ...record,
                        sessionID: undefined,
                        payload: await payload("response")
                    })}\n`);
                    eventCount++;
                    continue;
                }
                const headers = (input = {})=>Object.entries(input).map(([name, value])=>({
                            name,
                            value
                        }));
                const url = new URL(record.url);
                const requestText = await payload("request");
                const responseText = await payload("response");
                await har.write(`${entries ? "," : ""}${JSON.stringify({
                    startedDateTime: new Date(record.at).toISOString(),
                    time: record.durationMs ?? 0,
                    request: {
                        method: record.method,
                        url: record.url,
                        httpVersion: "",
                        cookies: [],
                        headers: headers(record.requestHeaders),
                        queryString: [
                            ...url.searchParams
                        ].map(([name, value])=>({
                                name,
                                value
                            })),
                        headersSize: -1,
                        bodySize: record.requestBody?.bytes ?? -1,
                        ...requestText === undefined ? {} : {
                            postData: {
                                mimeType: record.requestHeaders?.["content-type"] ?? "",
                                text: requestText,
                                _encoding: record.requestBody?.encoding
                            }
                        }
                    },
                    response: {
                        status: record.status ?? 0,
                        statusText: "",
                        httpVersion: "",
                        cookies: [],
                        headers: headers(record.responseHeaders),
                        content: {
                            size: record.responseBody?.bytes ?? 0,
                            mimeType: record.responseHeaders?.["content-type"] ?? "",
                            text: responseText,
                            ...record.responseBody?.encoding === "base64" ? {
                                encoding: "base64"
                            } : {}
                        },
                        redirectURL: record.responseHeaders?.location ?? "",
                        headersSize: -1,
                        bodySize: -1
                    },
                    cache: {},
                    timings: {
                        send: 0,
                        wait: record.durationMs ?? 0,
                        receive: 0
                    },
                    _bulu: {
                        id: record.id,
                        tabId: record.tabId,
                        source: record.source,
                        targetId: record.targetId,
                        targetType: record.targetType,
                        targetURL: record.targetURL,
                        attribution: record.attribution,
                        failure: record.failure,
                        requestBody: record.requestBody,
                        responseBody: record.responseBody,
                        timingDetail: "Only total duration available"
                    }
                })}`);
                entries++;
            }
            await har.write("]}}");
        } finally{
            await har.close();
            await events.close();
        }
        return {
            harPath,
            eventsPath,
            entries,
            eventCount,
            authenticationHeaders: "removed"
        };
    }
    clear(sessionID, tabId) {
        return this.enqueue(async ()=>{
            const rows = this.db.prepare(`SELECT id FROM network_record WHERE session_id=?${tabId ? " AND tab_id=?" : ""}`).all(...tabId ? [
                sessionID,
                tabId
            ] : [
                sessionID
            ]);
            for (const row of rows)await this.remove(row.id);
            return rows.length;
        });
    }
    bodyPath(id, direction) {
        if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Invalid network record ID");
        return path.join(this.directory, `${id}.${direction}.body`);
    }
    async remove(id) {
        const row = this.db.prepare("SELECT bytes FROM network_record WHERE id=?").get(id);
        this.db.prepare("DELETE FROM network_record WHERE id=?").run(id);
        this.usedBytes -= row?.bytes ?? 0;
        await Promise.all([
            "request",
            "response"
        ].map((direction)=>rm(this.bodyPath(id, direction), {
                force: true
            })));
    }
    async prune() {
        const rows = this.db.prepare("SELECT id,at,bytes FROM network_record ORDER BY at DESC,id DESC").all();
        let bytes = 0;
        for (const [index, row] of rows.entries()){
            bytes += row.bytes;
            if (bytes <= this.maxBytes && index < 50_000 && row.at >= Date.now() - this.retentionMs) continue;
            await this.remove(row.id);
        }
    }
    maintain() {
        return this.enqueue(()=>this.prune());
    }
    async removeOrphans() {
        for (const name of (await readdir(this.directory))){
            const match = /^([a-f0-9-]{36})\.(request|response)\.body$/.exec(name);
            if (!match) continue;
            const record = this.lookup(match[1]);
            if (record?.[`${match[2]}Body`]?.savedBytes !== undefined) continue;
            await rm(path.join(this.directory, name), {
                force: true
            });
        }
    }
    async close() {
        await this.tail;
        await this.prune();
        this.db.close();
    }
}
function integer(value, min, max, fallback) {
    return Number.isFinite(value) ? Math.max(min, Math.min(max, Math.floor(value))) : fallback;
}
function selectJSON(value, pointer) {
    if (pointer === "") return value;
    if (!pointer.startsWith("/")) throw new Error("jsonPath must be a JSON Pointer, for example /data/items/0/title");
    return pointer.slice(1).split("/").reduce((current, key)=>{
        const decoded = key.replace(/~1/g, "/").replace(/~0/g, "~");
        if (!current || typeof current !== "object" || !Object.hasOwn(current, decoded)) throw new Error("JSON field not found");
        return current[decoded];
    }, value);
}
