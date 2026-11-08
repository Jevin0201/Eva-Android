// Authorized BuLu browser-logic port; provenance: port-manifest.json.
import { setTimeout } from "node:timers/promises";
import { parseBrowserRef } from "./browser-host-state.mjs";
export function validateBrowserExpectation(value) {
    if (!value || typeof value !== "object") throw new Error("Invalid browser expectation");
    const input = value;
    if (input.checked !== undefined && ![
        true,
        false,
        "mixed"
    ].includes(input.checked)) throw new Error("Invalid expectation checked state");
    for (const field of [
        "disabled",
        "selected"
    ])if (input[field] !== undefined && typeof input[field] !== "boolean") throw new Error("Invalid expectation boolean state");
    for (const field of [
        "selector",
        "text",
        "value",
        "url"
    ])if (input[field] !== undefined && typeof input[field] !== "string") throw new Error("Invalid expectation field");
    if (!input.selector && !input.url) throw new Error("An expectation requires selector or URL");
    if (input.selector && input.url) throw new Error("Use one expectation target at a time");
    if (input.state !== undefined && ![
        "attached",
        "detached",
        "visible",
        "hidden"
    ].includes(String(input.state))) throw new Error("Invalid expectation state");
    if (input.timeoutMs !== undefined && (typeof input.timeoutMs !== "number" || !Number.isFinite(input.timeoutMs))) throw new Error("Invalid expectation timeout");
    if (typeof input.url === "string") new URL(input.url);
}
export function validateBrowserSteps(steps) {
    if (!Array.isArray(steps) || steps.length < 1 || steps.length > 8) throw new Error("A browser batch must contain 1 to 8 actions");
    for (const [index, step] of steps.entries()){
        if (!step || ![
            "type",
            "select",
            "check",
            "uncheck",
            "click",
            "press_key"
        ].includes(step.action)) throw new Error("Unsupported batch action");
        for (const field of [
            step.ref,
            step.selector,
            step.key
        ])if (field !== undefined && typeof field !== "string") throw new Error("Invalid batch target");
        if ([
            "click",
            "press_key"
        ].includes(step.action) && index !== steps.length - 1 && !steps.every((item)=>item.action === "press_key" && /^Arrow(Up|Down|Left|Right)$/.test(item.key ?? "") && !item.ref && !item.selector)) throw new Error("A click or keyboard action must be the last batch step; inspect its result before continuing");
        if (step.action !== "press_key" && !step.ref?.trim() && !step.selector?.trim()) throw new Error(`Batch step ${index + 1} requires ref or selector`);
        if (step.ref && step.selector) throw new Error("Choose ref or selector, not both");
        if (step.action === "type" && typeof step.text !== "string") throw new Error("Type step requires text");
        if (step.action === "select" && typeof step.option !== "string") throw new Error("Select step requires option");
        if (step.action === "press_key" && !step.key?.trim()) throw new Error("Keyboard step requires key");
        if (step.expect !== undefined) validateBrowserExpectation(step.expect);
    }
}
export async function waitForBrowserExpectation(page, expected, signal) {
    validateBrowserExpectation(expected);
    const timeoutMs = Number.isFinite(expected.timeoutMs) ? Math.max(0, Math.min(25000, expected.timeoutMs)) : 5000;
    const deadline = Date.now() + timeoutMs;
    for(;;){
        signal?.throwIfAborted();
        if (page.isClosed()) throw new Error("Browser page closed before the expectation was verified");
        const states = expected.url ? [
            page.url() === new URL(expected.url).href
        ] : await Promise.all(page.frames().map((frame)=>frame.locator(expected.selector).evaluateAll((elements, expected)=>{
                const visible = (element)=>{
                    const style = getComputedStyle(element);
                    const rect = element.getBoundingClientRect();
                    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
                };
                const candidates = expected.state === "hidden" ? elements.filter(visible) : elements;
                if (expected.state === "detached") return elements.length === 0;
                if (expected.state === "hidden") return candidates.length === 0;
                return candidates.some((element)=>{
                    const input = element instanceof HTMLInputElement && [
                        "checkbox",
                        "radio"
                    ].includes(element.type) ? element : undefined;
                    const checked = input ? input.indeterminate ? "mixed" : input.checked : element.getAttribute("aria-checked") === "mixed" ? "mixed" : element.hasAttribute("aria-checked") ? element.getAttribute("aria-checked") === "true" : undefined;
                    const selected = element instanceof HTMLOptionElement ? element.selected : element.hasAttribute("aria-selected") ? element.getAttribute("aria-selected") === "true" : undefined;
                    return (expected.state === "attached" || visible(element)) && (expected.text === undefined || (element.textContent ?? "").includes(expected.text)) && (expected.value === undefined || "value" in element && String(element.value) === expected.value) && (expected.checked === undefined || checked === expected.checked) && (expected.selected === undefined || selected === expected.selected) && (expected.disabled === undefined || (element.matches(":disabled") || element.getAttribute("aria-disabled") === "true") === expected.disabled);
                });
            }, expected).catch(()=>false)));
        const absent = !expected.url && (expected.state === "hidden" || expected.state === "detached");
        const satisfied = absent ? states.every(Boolean) : states.some(Boolean);
        if (satisfied) return {
            verified: true,
            elapsedMs: timeoutMs - Math.max(0, deadline - Date.now())
        };
        if (Date.now() >= deadline) throw new Error("Expected browser state was not reached before the deadline");
        await setTimeout(Math.min(40, deadline - Date.now()), undefined, {
            signal
        });
    }
}
export async function executeBrowserSteps(page, steps, options) {
    validateBrowserSteps(steps);
    const results = [];
    const signal = AbortSignal.any([
        ...options.signal ? [
            options.signal
        ] : [],
        AbortSignal.timeout(Math.max(1, Math.min(25000, options.timeoutMs ?? 25000)))
    ]);
    let boundary = "";
    const onNavigation = ()=>{
        boundary = "navigation";
    };
    const onNavigationRequest = (request)=>{
        if (request.isNavigationRequest()) boundary = "navigation";
    };
    const onPopup = ()=>{
        boundary = "popup";
    };
    const onDialog = ()=>{
        boundary = "dialog";
    };
    const onDownload = ()=>{
        boundary = "download";
    };
    page.on("framenavigated", onNavigation);
    page.on("request", onNavigationRequest);
    page.on("popup", onPopup);
    page.on("dialog", onDialog);
    page.on("download", onDownload);
    const unsubscribeDialog = options.subscribeDialog?.(onDialog);
    let current = 0;
    let inFlight = false;
    const initialEpoch = options.epoch();
    const initialModals = await visibleModals(page);
    const grid = steps.length > 1 && steps.every((step)=>step.action === "press_key") ? await page.evaluateHandle(()=>document.activeElement?.closest('[role="grid"]') ?? null) : undefined;
    try {
        const gridText = grid ? await grid.evaluate((element)=>element?.textContent) : undefined;
        if (grid && gridText === undefined) throw new Error("Arrow batches require focus inside an ARIA grid; use browser_key for individual keys. No actions were executed.");
        for (const [index, step] of steps.entries()){
            current = index;
            signal.throwIfAborted();
            if (boundary || page.isClosed() || initialEpoch !== options.epoch()) break;
            if (grid && !await grid.evaluate((element, text)=>!!element?.isConnected && document.activeElement?.closest('[role="grid"]') === element && element.textContent === text, gridText)) {
                boundary = "grid-changed";
                break;
            }
            if (step.ref && parseBrowserRef(step.ref).epoch !== options.epoch()) throw new Error("Page refs are stale; capture a fresh snapshot");
            const locator = step.action === "press_key" && !step.ref && !step.selector ? undefined : await findTarget(page, step);
            const timeout = 3000;
            let dialogOpened;
            const dialog = new Promise((resolve)=>{
                dialogOpened = ()=>resolve("dialog");
            });
            const listener = ()=>dialogOpened?.();
            page.once("dialog", listener);
            const unsubscribeStepDialog = options.subscribeDialog?.(listener);
            let rejectAborted;
            const aborted = new Promise((_, reject)=>{
                if (signal.aborted) reject(signal.reason);
                else {
                    rejectAborted = ()=>reject(signal.reason);
                    signal.addEventListener("abort", rejectAborted, {
                        once: true
                    });
                }
            });
            inFlight = true;
            const action = (async ()=>{
                signal.throwIfAborted();
                if (step.action === "type") {
                    await locator.fill(step.text, {
                        timeout
                    });
                    const valid = await locator.evaluate((element, text)=>"value" in element ? String(element.value) === text : (element.innerText ?? element.textContent ?? "") === text, step.text);
                    if (!valid) throw new Error("Input value could not be verified; inspect before retrying");
                }
                if (step.action === "select") await selectBrowserOption(locator, step.option, timeout);
                if (step.action === "check") await locator.check({
                    timeout
                });
                if (step.action === "uncheck") await locator.uncheck({
                    timeout
                });
                if (step.action === "click") await locator.click({
                    timeout
                });
                if (step.action === "press_key") {
                    if (locator) await locator.press(step.key, {
                        timeout
                    });
                    else await page.keyboard.press(step.key);
                }
            })();
            try {
                const outcome = await Promise.race([
                    action.then(()=>"completed"),
                    dialog,
                    aborted
                ]);
                if (outcome === "dialog") {
                    boundary = "dialog";
                    break;
                }
            } finally{
                page.off("dialog", listener);
                unsubscribeStepDialog?.();
                if (rejectAborted) signal.removeEventListener("abort", rejectAborted);
                void action.catch(()=>undefined);
            }
            inFlight = false;
            const verified = ![
                "click",
                "press_key"
            ].includes(step.action);
            results.push({
                index,
                action: step.action,
                completed: true,
                verified
            });
            if (step.expect && boundary !== "dialog") {
                await waitForBrowserExpectation(page, step.expect, signal);
                results[results.length - 1].verified = true;
            }
            if (boundary || initialEpoch !== options.epoch()) break;
            if (await visibleModals(page) !== initialModals) {
                boundary = "modal";
                break;
            }
        }
        return {
            outcome: boundary || results.length < steps.length ? "boundary" : "completed",
            reason: boundary || undefined,
            results,
            completed: results.length,
            total: steps.length,
            nextStep: results.length < steps.length ? results.length : undefined,
            inFlight
        };
    } catch (error) {
        return {
            outcome: signal.aborted ? "cancelled" : "failed",
            error: error instanceof Error ? error.message : String(error),
            results,
            completed: results.length,
            total: steps.length,
            failedStep: current,
            nextStep: results.length < steps.length ? results.length : undefined,
            inFlight,
            retry: "Inspect the current state; completed actions must not be replayed automatically"
        };
    } finally{
        unsubscribeDialog?.();
        await grid?.dispose();
        page.off("framenavigated", onNavigation);
        page.off("request", onNavigationRequest);
        page.off("popup", onPopup);
        page.off("dialog", onDialog);
        page.off("download", onDownload);
    }
}
export async function selectBrowserOption(locator, option, timeout = 3000) {
    const value = await locator.evaluate((element, requested)=>{
        if (!(element instanceof HTMLSelectElement)) throw new Error("Target is not a select control");
        const options = Array.from(element.options);
        return (options.find((item)=>item.label === requested) ?? options.find((item)=>item.value === requested))?.value;
    }, option);
    if (value === undefined) throw new Error("Select option is not ready or unavailable; inspect before retrying");
    return locator.selectOption(value, {
        timeout
    });
}
async function findTarget(page, step) {
    const selector = step.ref ? `[data-rae-ref=${JSON.stringify(step.ref)}]` : step.selector;
    const targets = await Promise.all(page.frames().map(async (frame)=>{
        const locator = frame.locator(selector);
        return {
            locator,
            count: await locator.count().catch(()=>0)
        };
    }));
    if (targets.reduce((sum, item)=>sum + item.count, 0) !== 1) throw new Error("Batch target is missing or ambiguous; inspect before continuing");
    return targets.find((target)=>target.count === 1).locator;
}
async function visibleModals(page) {
    return (await Promise.all(page.frames().map((frame)=>frame.locator('dialog[open],[role="dialog"],[aria-modal="true"]').evaluateAll((elements)=>elements.filter((element)=>{
                const rect = element.getBoundingClientRect();
                const style = getComputedStyle(element);
                return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
            }).map((element)=>`${element.tagName}#${element.id}`).join("|")).catch(()=>"")))).join(";");
}
