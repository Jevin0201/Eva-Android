// Authorized BuLu browser-logic port; provenance: port-manifest.json.
import { EventEmitter } from "node:events";
export class BrowserTargetProtocol {
    attached;
    failed;
    detached;
    next = 0;
    pending = new Map();
    events = new Map();
    targets = new Map();
    parents = new Map();
    primary = new Map();
    ready = new Map();
    discovered = new EventEmitter();
    socket;
    closed = false;
    get connected() {
        return !this.closed && this.socket?.readyState === WebSocket.OPEN;
    }
    async waitForTarget(targetId) {
        if (this.ready.has(targetId)) return this.ready.get(targetId);
        await new Promise((resolve, reject)=>{
            const done = ()=>{
                clearTimeout(timer);
                this.discovered.off(targetId, done);
                resolve();
            };
            const timer = setTimeout(()=>{
                this.discovered.off(targetId, done);
                const error = new Error("Worker capture was not ready before automation startup");
                this.failed(error);
                reject(error);
            }, 5000);
            this.discovered.once(targetId, done);
        });
        await this.ready.get(targetId);
    }
    constructor(attached, failed, detached){
        this.attached = attached;
        this.failed = failed;
        this.detached = detached;
    }
    async connect(endpoint) {
        const version = await fetch(new URL("/json/version", endpoint), {
            signal: AbortSignal.timeout(5000)
        }).then((response)=>{
            if (!response.ok) throw new Error(`Chrome discovery failed: ${response.status}`);
            return response.json();
        });
        this.socket = new WebSocket(version.webSocketDebuggerUrl);
        await new Promise((resolve, reject)=>{
            const timer = setTimeout(()=>{
                this.close();
                reject(new Error("Browser capture connection timed out"));
            }, 5000);
            this.socket.addEventListener("open", ()=>{
                clearTimeout(timer);
                resolve();
            }, {
                once: true
            });
            this.socket.addEventListener("error", ()=>{
                clearTimeout(timer);
                reject(new Error("Browser capture connection failed"));
            }, {
                once: true
            });
        });
        this.socket.addEventListener("message", (event)=>this.receive(String(event.data)));
        this.socket.addEventListener("close", ()=>this.close(new Error("Browser capture connection closed")));
        await this.send("Target.setAutoAttach", {
            autoAttach: true,
            waitForDebuggerOnStart: true,
            flatten: true,
            filter: [
                {
                    type: "browser",
                    exclude: true
                },
                {
                    type: "tab",
                    exclude: true
                },
                {}
            ]
        });
        await Promise.all([
            ...this.ready.values()
        ]);
    }
    receive(message) {
        const event = JSON.parse(message);
        if (event.id !== undefined) {
            const pending = this.pending.get(event.id);
            if (!pending) return;
            this.pending.delete(event.id);
            clearTimeout(pending.timer);
            if (event.error) pending.reject(new Error(event.error.message));
            else pending.resolve(event.result);
            return;
        }
        if (event.method === "Target.attachedToTarget") {
            const params = event.params;
            const target = params.targetInfo;
            const parent = event.sessionId ? this.targets.get(event.sessionId) : undefined;
            this.targets.set(params.sessionId, target);
            this.parents.set(params.sessionId, event.sessionId);
            if (this.primary.has(target.targetId)) {
                void (this.ready.get(target.targetId) ?? Promise.resolve()).then(()=>this.send("Runtime.runIfWaitingForDebugger", {}, params.sessionId)).catch(()=>undefined);
                return;
            }
            this.primary.set(target.targetId, params.sessionId);
            const emitter = new EventEmitter();
            this.events.set(params.sessionId, emitter);
            const protocol = {
                send: (method, input)=>this.send(method, input, params.sessionId),
                on: emitter.on.bind(emitter),
                once: emitter.once.bind(emitter),
                off: emitter.off.bind(emitter)
            };
            let configured;
            const ready = new Promise((resolve)=>{
                configured = resolve;
            });
            this.ready.set(target.targetId, ready);
            this.discovered.emit(target.targetId);
            void (async ()=>{
                try {
                    await this.attached(target, protocol, parent);
                    const related = this.send("Target.setAutoAttach", {
                        autoAttach: true,
                        waitForDebuggerOnStart: true,
                        flatten: true
                    }, params.sessionId);
                    if ([
                        "worker",
                        "shared_worker",
                        "service_worker"
                    ].includes(target.type)) void related.catch((error)=>this.failed(error instanceof Error ? error : new Error(String(error))));
                    else await related;
                } catch (error) {
                    this.failed(error instanceof Error ? error : new Error(String(error)));
                } finally{
                    configured?.();
                    await this.send("Runtime.runIfWaitingForDebugger", {}, params.sessionId).catch(()=>undefined);
                }
            })();
            return;
        }
        if (event.method === "Target.detachedFromTarget") {
            const session = String(event.params?.sessionId);
            const target = this.targets.get(session);
            const primary = target && this.primary.get(target.targetId) === session;
            if (primary) {
                this.primary.delete(target.targetId);
                this.ready.delete(target.targetId);
                this.detached(target);
            }
            this.events.get(session)?.emit("Inspector.detached", {
                reason: "Target detached"
            });
            this.targets.delete(session);
            this.parents.delete(session);
            this.events.delete(session);
            for (const [id, pending] of this.pending){
                if (pending.session !== session) continue;
                clearTimeout(pending.timer);
                pending.reject(new Error("Capture target detached"));
                this.pending.delete(id);
            }
            if (primary) {
                const replacement = [
                    ...this.targets
                ].find(([, candidate])=>candidate.targetId === target.targetId);
                if (replacement) this.receive(JSON.stringify({
                    method: "Target.attachedToTarget",
                    sessionId: this.parents.get(replacement[0]),
                    params: {
                        sessionId: replacement[0],
                        targetInfo: replacement[1]
                    }
                }));
            }
            return;
        }
        if (event.method) this.events.get(event.sessionId ?? "")?.emit(event.method, event.params);
    }
    send(method, params = {}, sessionId) {
        if (this.closed || !this.socket || this.socket.readyState !== WebSocket.OPEN) return Promise.reject(new Error("Browser capture connection unavailable"));
        const id = ++this.next;
        return new Promise((resolve, reject)=>{
            const timer = setTimeout(()=>{
                this.pending.delete(id);
                reject(new Error(`Capture protocol timeout: ${method}`));
            }, 5000);
            this.pending.set(id, {
                resolve,
                reject,
                timer,
                session: sessionId
            });
            this.socket.send(JSON.stringify({
                id,
                method,
                params,
                ...sessionId ? {
                    sessionId
                } : {}
            }));
        });
    }
    close(error) {
        if (this.closed) return;
        this.closed = true;
        for (const pending of this.pending.values()){
            clearTimeout(pending.timer);
            pending.reject(error ?? new Error("Browser capture stopped"));
        }
        this.pending.clear();
        for (const [session, target] of this.targets){
            this.events.get(session)?.emit("Inspector.detached", {
                reason: "Connection closed"
            });
            this.detached(target);
        }
        this.targets.clear();
        this.parents.clear();
        this.primary.clear();
        this.ready.clear();
        this.events.clear();
        this.socket?.close();
        if (error) this.failed(error);
    }
}
