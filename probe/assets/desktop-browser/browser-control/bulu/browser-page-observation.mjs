// Authorized BuLu browser-logic port; provenance: port-manifest.json.
import { waitForScrollControls } from "./browser-scroll-controls.mjs";
export function createPageObservation(bindings) {
    const counters = new WeakMap();
    async function capture(page, options = {}) {
        if (options.selector) await page.mainFrame().evaluate((selector)=>{
            document.querySelector(selector);
        }, options.selector);
        const maxRefs = clampInteger(options.maxRefs, 0, 500, 60);
        const includeRefs = maxRefs > 0;
        if (includeRefs && !options.preserveRefs) bindings.bumpEpoch(page);
        const epoch = bindings.epoch(page);
        const previous = counters.get(page);
        const counter = previous?.epoch === epoch ? previous : {
            epoch,
            next: 0
        };
        counters.set(page, counter);
        const textOffset = clampInteger(options.textOffset, 0, Number.MAX_SAFE_INTEGER, 0);
        const refOffset = clampInteger(options.refOffset, 0, Number.MAX_SAFE_INTEGER, 0);
        const maxTextChars = clampInteger(options.maxTextChars, 1, 50_000, 6_000);
        const frames = page.frames();
        const capturedURL = page.url();
        const snapshots = [];
        let seenText = 0;
        let seenRefs = 0;
        for (const frame of frames){
            const snapshot = await frame.evaluate(readFrame, {
                assignRefs: true,
                includeRefs,
                textSelector: options.selector,
                documentSelector: options.includeDocument === false ? undefined : options.selector,
                main: frame === page.mainFrame(),
                epoch,
                preserveRefs: options.preserveRefs === true,
                nextRef: counter.next,
                textOffset: Math.max(0, textOffset - seenText),
                refOffset: Math.max(0, refOffset - seenRefs),
                maxTextChars: Math.max(0, maxTextChars - snapshots.reduce((sum, item)=>sum + item.text.length, 0)),
                maxRefs: Math.max(0, maxRefs - snapshots.reduce((sum, item)=>sum + item.refs.length, 0))
            }).catch(()=>undefined);
            if (!snapshot) continue;
            snapshots.push(snapshot);
            counter.next = snapshot.nextRef;
            seenText += snapshot.totalTextChars;
            seenRefs += snapshot.totalRefs;
        }
        const text = snapshots.map((item)=>item.text).filter(Boolean).join("\n").slice(0, maxTextChars);
        const refs = snapshots.flatMap((item)=>item.refs).slice(0, maxRefs);
        const returnedTextChars = snapshots.reduce((sum, item)=>sum + item.text.length, 0);
        const totalTextChars = snapshots.reduce((sum, item)=>sum + item.totalTextChars, 0);
        const totalRefs = snapshots.reduce((sum, item)=>sum + item.totalRefs, 0);
        const nextTextOffset = textOffset + returnedTextChars < totalTextChars ? textOffset + returnedTextChars : undefined;
        const nextRefOffset = refOffset + refs.length < totalRefs ? refOffset + refs.length : undefined;
        const signals = snapshots.flatMap((item)=>item.challenge ? [
                item.challenge
            ] : []);
        return {
            result: {
                text,
                ...options.selector && options.includeDocument !== false ? {
                    document: {
                        selector: options.selector,
                        blocks: snapshots.flatMap((item)=>item.document?.blocks ?? []),
                        complete: snapshots.length === frames.length && capturedURL === page.url() && snapshots.every((item)=>!item.document || item.document.complete) && snapshots.some((item)=>(item.document?.blocks.length ?? 0) > 0)
                    }
                } : {},
                refs,
                scroll: snapshots.map((item)=>({
                        frameUrl: item.frameUrl,
                        areas: item.scroll
                    })),
                snapshot: {
                    textOffset,
                    refOffset,
                    returnedTextChars,
                    returnedRefs: refs.length,
                    totalTextChars,
                    totalRefs,
                    refsOmitted: !includeRefs || undefined,
                    nextTextOffset,
                    nextRefOffset,
                    textComplete: nextTextOffset === undefined,
                    refsComplete: nextRefOffset === undefined,
                    ...options.selector ? {
                        textSelector: options.selector,
                        matchedTextTargets: snapshots.reduce((sum, item)=>sum + item.matchedTextTargets, 0)
                    } : {},
                    complete: nextTextOffset === undefined && nextRefOffset === undefined,
                    observationComplete: snapshots.length === frames.length && capturedURL === page.url() && epoch === bindings.epoch(page),
                    loading: snapshots.some((item)=>item.loading)
                },
                surfaces: snapshots.flatMap((item)=>item.details).slice(0, options.includeDocument === true ? 100 : 20),
                challenge: signals.length ? {
                    detected: true,
                    providers: [
                        ...new Set(signals.flatMap((item)=>item.providers))
                    ],
                    evidence: signals.map((item)=>item.text).filter(Boolean).slice(0, 5),
                    action: "User interaction may be required; do not attempt to bypass the site challenge."
                } : undefined
            },
            state: stateFromFrames(page, snapshots)
        };
    }
    function stateFromFrames(page, frames) {
        return {
            url: page.url(),
            title: frames.find((item)=>item.main)?.title ?? "",
            lines: frames.flatMap((item)=>item.lines).slice(0, 2000),
            controls: frames.flatMap((item)=>item.controls),
            surfaces: frames.flatMap((item)=>item.surfaces),
            scroll: frames.map((item)=>({
                    frameUrl: item.frameUrl,
                    areas: item.scroll
                })),
            tabs: page.context().pages().filter((item)=>!item.isClosed()).map((item)=>({
                    id: bindings.pageID(item),
                    url: item.url()
                }))
        };
    }
    async function semanticPageState(page) {
        const frames = await Promise.all(page.frames().map((frame)=>frame.evaluate(readFrame, {
                assignRefs: false,
                includeRefs: false,
                main: frame === page.mainFrame(),
                epoch: 0,
                preserveRefs: true,
                nextRef: 0,
                textOffset: 0,
                refOffset: 0,
                maxTextChars: 0,
                maxRefs: 0
            }).catch(()=>undefined)));
        return stateFromFrames(page, frames.filter((item)=>item !== undefined));
    }
    async function snapshotData(page, options = {}) {
        return (await capture(page, { ...options, preserveRefs: true })).result;
    }
    async function finishAction(page, before, options = {}) {
        if (page.url() !== before.url) await page.waitForLoadState("domcontentloaded", {
            timeout: 750
        }).catch(()=>undefined);
        const navigated = page.url() !== before.url;
        const first = await capture(page, {
            selector: options.selector,
            includeDocument: false,
            maxTextChars: options.maxTextChars ?? (navigated ? 16000 : 4000),
            maxRefs: options.maxRefs ?? 60,
            preserveRefs: true
        });
        const firstChanges = diffSemanticPageState(before, first.state);
        const sync = firstChanges.scrolled && !options.signal?.aborted ? await waitForScrollControls(page, first.result.scroll, options.signal) : undefined;
        const titleChanged = first.state.title !== before.title;
        const after = (sync?.checked || titleChanged && first.result.snapshot.nextTextOffset !== undefined) && !options.signal?.aborted ? await capture(page, {
            selector: options.selector,
            includeDocument: false,
            maxTextChars: options.maxTextChars ?? (navigated || titleChanged ? 16000 : 4000),
            maxRefs: options.maxRefs ?? 60,
            preserveRefs: true
        }) : first;
        return {
            ...after.result,
            changes: {
                ...after === first ? firstChanges : diffSemanticPageState(before, after.state),
                observationComplete: after.result.snapshot.observationComplete,
                successVerified: options.verified === true,
                scrollControlsPending: sync?.pending || undefined
            }
        };
    }
    return {
        snapshotData,
        semanticPageState,
        finishAction
    };
}
export function readFrame(input) {
    const attribute = "data-rae-ref";
    const normalize = (value)=>String(value ?? "").replace(/\s+/g, " ").trim();
    const truncate = (value)=>value.length > 160 ? `${value.slice(0, 159)}…` : value;
    const visibility = new WeakMap();
    const appearance = (element)=>{
        const cached = visibility.get(element);
        if (cached) return cached;
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        const value = {
            visible: style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0,
            opacity: style.opacity
        };
        visibility.set(element, value);
        return value;
    };
    const visible = (element)=>appearance(element).visible;
    const roots = [];
    const scrolling = document.scrollingElement ? [
        document.scrollingElement
    ] : [];
    const discover = (root)=>{
        roots.push(root);
        for (const element of root.querySelectorAll("*")){
            if (element.shadowRoot) discover(element.shadowRoot);
            if (scrolling.length < 16 && element !== document.scrollingElement && element.clientHeight > 0 && (element.scrollHeight > element.clientHeight + 1 || element.scrollWidth > element.clientWidth + 1) && visible(element)) {
                const style = getComputedStyle(element);
                if (/auto|scroll|overlay/.test(`${style.overflowY} ${style.overflowX}`)) scrolling.push(element);
            }
        }
    };
    discover(document);
    const scroll = scrolling.map((element, index)=>{
        const rect = element.getBoundingClientRect();
        const root = element === document.scrollingElement;
        const maxTop = Math.max(0, element.scrollHeight - (root ? innerHeight : element.clientHeight));
        const maxLeft = Math.max(0, element.scrollWidth - (root ? innerWidth : element.clientWidth));
        return {
            index,
            tag: element.tagName.toLowerCase(),
            id: element.id || undefined,
            top: Math.round(element.scrollTop),
            left: Math.round(element.scrollLeft),
            maxTop,
            maxLeft,
            atTop: element.scrollTop <= 1,
            atBottom: element.scrollTop >= maxTop - 1,
            x: Math.round(Math.max(0, Math.min(innerWidth - 1, (Math.max(0, rect.left) + Math.min(innerWidth, rect.right)) / 2))),
            y: Math.round(Math.max(0, Math.min(innerHeight - 1, (Math.max(0, rect.top) + Math.min(innerHeight, rect.bottom)) / 2)))
        };
    });
    const popupSelector = 'dialog,[role="dialog"],[aria-modal="true"],[popover],[aria-expanded="true"]';
    const controlSelector = "a,button,input,textarea,select,summary,[role=button],[role=link],[role=textbox],[role=checkbox],[role=radio],[role=switch],[role=combobox],[role=tab],[role=option],[contenteditable=true],[contenteditable=\"\"],[contenteditable=plaintext-only],[role=gridcell],[role=columnheader],[role=rowheader],[role=menuitem],[role=treeitem]";
    const detailSelector = 'dialog,[role="dialog"],[aria-modal="true"],[popover],[aria-haspopup],[aria-controls],[popovertarget],a[download],a[href*="download" i],form[action*="download" i],[data-download],button,a,[role="button"],[role="menuitem"]';
    const selector = [
        popupSelector,
        ...input.includeRefs || !input.assignRefs ? [
            controlSelector
        ] : [],
        ...input.includeRefs ? [
            `[${attribute}]`
        ] : [],
        ...input.assignRefs ? [
            detailSelector
        ] : []
    ].join(",");
    const candidates = roots.flatMap((root)=>Array.from(root.querySelectorAll(selector)));
    const matching = (selector)=>candidates.filter((element)=>element.matches(selector));
    const raw = document.body?.innerText ?? "";
    const targets = input.textSelector ? roots.flatMap((root)=>Array.from(root.querySelectorAll(input.textSelector))).filter(visible) : [];
    const scoped = targets.filter((element)=>!targets.some((other)=>other !== element && other.contains(element)));
    const source = input.documentSelector ? roots.flatMap((root)=>Array.from(root.querySelectorAll(input.documentSelector))).filter(visible) : [];
    const blocks = [];
    let documentChars = 0;
    let documentComplete = document.readyState !== "loading";
    const record = (block)=>{
        documentChars += JSON.stringify(block).length;
        if (documentChars > 200_000 || blocks.length >= 2000) {
            documentComplete = false;
            return;
        }
        blocks.push(block);
    };
    const read = (node)=>{
        if (node.nodeType === Node.TEXT_NODE) {
            const text = normalize(node.textContent);
            if (text) record({
                type: "paragraph",
                text
            });
            return;
        }
        if (!(node instanceof Element) || !visible(node) || node.matches('script,style,noscript,button,input,select,textarea,[aria-hidden="true"]')) return;
        const tag = node.tagName.toLowerCase();
        const text = node instanceof HTMLElement ? node.innerText : node.textContent ?? "";
        if (/^h[1-6]$/.test(tag)) return record({
            type: "heading",
            level: Number(tag[1]),
            text: normalize(text)
        });
        if (tag === "pre") return record({
            type: "code",
            text
        });
        if (tag === "table") {
            const rows = Array.from(node.rows).map((row)=>Array.from(row.cells).map((cell)=>normalize(cell.innerText)));
            if (!rows.length || rows.every((row)=>row.every((cell)=>!cell))) documentComplete = false;
            return record({
                type: "table",
                rows
            });
        }
        if (tag === "ul" || tag === "ol") {
            const items = Array.from(node.children).filter((item)=>item.tagName === "LI");
            if (node.querySelector("li ul,li ol")) documentComplete = false;
            if (items.length) record({
                type: "list",
                ordered: tag === "ol",
                items: items.map((item)=>normalize(item.innerText))
            });
            return;
        }
        if (tag === "p" && !node.querySelector("table,ul,ol,pre")) {
            if (normalize(text)) record({
                type: "paragraph",
                text: normalize(text)
            });
            return;
        }
        for (const child of node.childNodes)read(child);
        if (node.shadowRoot) for (const child of node.shadowRoot.childNodes)read(child);
    };
    for (const root of source.filter((node)=>!source.some((other)=>other !== node && other.contains(node))))read(root);
    const allText = input.assignRefs ? normalize(input.textSelector ? scoped.map((element)=>element instanceof HTMLElement ? element.innerText : element.textContent ?? "").join("\n") : raw) : "";
    const controlElements = input.includeRefs || !input.assignRefs ? matching(controlSelector) : [];
    const states = new Map(controlElements.map((element)=>{
        const aria = (name)=>{
            const value = element.getAttribute(name);
            return value === "true" ? true : value === "false" ? false : value === "mixed" ? "mixed" : undefined;
        };
        const field = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement ? element : undefined;
        return [
            element,
            {
                checked: element instanceof HTMLInputElement && [
                    "checkbox",
                    "radio"
                ].includes(element.type) ? element.indeterminate ? "mixed" : element.checked : aria("aria-checked"),
                selected: aria("aria-selected"),
                expanded: aria("aria-expanded"),
                pressed: aria("aria-pressed"),
                disabled: element.matches(":disabled") || aria("aria-disabled") === true ? true : "disabled" in element || aria("aria-disabled") === false ? false : undefined,
                value: field && field.type !== "password" && field.type !== "hidden" ? truncate(field.value) : undefined
            }
        ];
    }));
    const controls = controlElements.flatMap((element, index)=>{
        const state = states.get(element);
        const meaningful = Object.entries(state).some(([key, value])=>value !== undefined && !(key === "disabled" && value === false) && !(key === "value" && value === ""));
        return meaningful && visible(element) ? [
            `${index}:${JSON.stringify(state)}`
        ] : [];
    });
    const popupElements = matching(popupSelector);
    const surfaces = popupElements.filter((element)=>visible(element) && appearance(element).opacity !== "0").map((element)=>`${element.tagName.toLowerCase()}#${element.id}[role=${element.getAttribute("role") ?? ""}]:${truncate(normalize(element.textContent))}`);
    if (input.includeRefs && !input.preserveRefs) for (const element of matching(`[${attribute}]`))element.removeAttribute(attribute);
    const elements = input.includeRefs ? matching(controlSelector).filter(visible) : [];
    const refCounts = new Map();
    if(input.preserveRefs)for(const element of matching(`[${attribute}]`)){const ref=element.getAttribute(attribute);refCounts.set(ref,(refCounts.get(ref)||0)+1);}
    let nextRef = input.nextRef;
    const refs = elements.slice(input.refOffset, input.refOffset + input.maxRefs).map((element)=>{
        const assigned = input.preserveRefs ? element.getAttribute(attribute) : null;
        const existing = assigned && refCounts.get(assigned) === 1 ? assigned : null;
        const ref = existing?.startsWith(`${input.epoch}:`) ? existing : `${input.epoch}:${++nextRef}`;
        if (existing !== ref) element.setAttribute(attribute, ref);
        const field = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement ? element : undefined;
        return {
            ref,
            tag: element.tagName.toLowerCase(),
            role: element.getAttribute("role") || undefined,
            editable: element.isContentEditable || undefined,
            rowIndex: element.getAttribute("aria-rowindex") || element.closest('[aria-rowindex]')?.getAttribute("aria-rowindex") || undefined,
            columnIndex: element.getAttribute("aria-colindex") || undefined,
            type: field?.type || undefined,
            label: element.getAttribute("aria-label") || undefined,
            text: truncate(normalize(element.textContent)) || undefined,
            placeholder: field?.placeholder || undefined,
            value: field?.type === "password" ? undefined : truncate(field?.value ?? "") || undefined,
            ...states.get(element)
        };
    });
    const keywords = /(?:download|export|save as|下载|导出|另存为)/i;
    const details = input.assignRefs ? matching(detailSelector).flatMap((element)=>{
        const text = normalize(element.textContent).slice(0, 240);
        const popup = element.matches('dialog,[role="dialog"],[aria-modal="true"],[popover],[aria-haspopup],[aria-controls],[popovertarget]');
        const download = element.matches('a[download],a[href*="download" i],form[action*="download" i],[data-download]') || keywords.test(text);
        if (!popup && !download) return [];
        return [
            {
                kind: popup && download ? "popup-download" : popup ? "popup" : "download",
                frameUrl: location.href,
                tag: element.tagName.toLowerCase(),
                text: text || undefined,
                href: element instanceof HTMLAnchorElement ? element.href : undefined,
                action: element instanceof HTMLFormElement ? element.action : undefined,
                id: element.id || undefined,
                role: element.getAttribute("role") || undefined,
                controls: element.getAttribute("aria-controls") || undefined,
                visible: visible(element) && appearance(element).opacity !== "0"
            }
        ];
    }).slice(0, 100) : [];
    const evidence = input.assignRefs ? `${document.title}\n${raw}\n${Array.from(document.querySelectorAll("iframe")).map((item)=>item.src).join("\n")}`.slice(0, 100000) : "";
    const providers = [
        [
            /cf-chl|just a moment|checking your browser|cloudflare ray id/i,
            "Cloudflare"
        ],
        [
            /recaptcha|g-recaptcha/i,
            "reCAPTCHA"
        ],
        [
            /hcaptcha|h-captcha/i,
            "hCaptcha"
        ],
        [
            /turnstile|cf-turnstile/i,
            "Turnstile"
        ]
    ];
    const detected = input.assignRefs ? providers.filter(([pattern])=>pattern.test(evidence)).map(([, name])=>name) : [];
    const challengeText = evidence.match(/.{0,80}(?:verify (?:you are|that you are) human|unusual traffic|access denied|验证码|人机验证|访问被拒绝).{0,80}/i)?.[0];
    return {
        document: input.documentSelector ? {
            blocks,
            complete: documentComplete
        } : undefined,
        main: input.main,
        frameUrl: location.href,
        scroll,
        title: document.title,
        loading: document.readyState === "loading",
        text: allText.slice(input.textOffset, input.textOffset + input.maxTextChars),
        totalTextChars: allText.length,
        matchedTextTargets: scoped.length,
        controls,
        totalRefs: elements.length,
        refs,
        nextRef,
        lines: raw.split(/\r?\n/).map(normalize).filter(Boolean).slice(0, 2000),
        surfaces,
        details,
        challenge: input.assignRefs && (detected.length || challengeText) ? {
            providers: detected,
            text: challengeText
        } : undefined
    };
}
function diffSemanticPageState(before, after) {
    const controlsChanged = before.controls.length !== after.controls.length || before.controls.some((state, index)=>state !== after.controls[index]);
    const scrolled = after.scroll.some((frame)=>{
        const previous = before.scroll.find((item)=>item.frameUrl === frame.frameUrl);
        return frame.areas.some((area)=>{
            const old = previous?.areas.find((item)=>area.id ? item.id === area.id : item.index === area.index && item.tag === area.tag);
            return old !== undefined && (old.top !== area.top || old.left !== area.left);
        });
    });
    const oldLines = new Set(before.lines);
    const newLines = new Set(after.lines);
    const allAdded = after.lines.filter((line)=>!oldLines.has(line));
    const allRemoved = before.lines.filter((line)=>!newLines.has(line));
    const openedSurfaces = after.surfaces.filter((surface)=>!before.surfaces.includes(surface)).slice(0, 20);
    const closedSurfaces = before.surfaces.filter((surface)=>!after.surfaces.includes(surface)).slice(0, 20);
    const openedTabs = after.tabs.filter((tab)=>!before.tabs.some((old)=>old.id === tab.id));
    const closedTabs = before.tabs.filter((tab)=>!after.tabs.some((current)=>current.id === tab.id));
    const addedText=allAdded.slice(0,40).join('\n'),removedText=allRemoved.slice(0,40).join('\n');
    return {
        url: before.url === after.url ? undefined : {
            before: before.url,
            after: after.url
        },
        title: before.title === after.title ? undefined : {
            before: before.title,
            after: after.title
        },
        scrolled,
        controlsChanged,
        added: allAdded.length ? addedText.slice(0,2000).split("\n") : [],
        removed: allRemoved.length ? removedText.slice(0,2000).split("\n") : [],
        openedSurfaces,
        closedSurfaces,
        openedTabs,
        closedTabs,
        addedTruncated: allAdded.length > 40 || addedText.length > 2000 || undefined,
        removedTruncated: allRemoved.length > 40 || removedText.length > 2000 || undefined,
        changed: before.url !== after.url || before.title !== after.title || scrolled || controlsChanged || !!(allAdded.length || allRemoved.length || openedSurfaces.length || closedSurfaces.length || openedTabs.length || closedTabs.length)
    };
}
function clampInteger(value, minimum, maximum, fallback) {
    if (value === undefined || !Number.isFinite(value)) return fallback;
    return Math.min(maximum, Math.max(minimum, Math.trunc(value)));
}
