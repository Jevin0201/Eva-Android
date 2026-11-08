// Authorized extraction of BuLu inspection and verified form interaction.
import {selectBrowserOption} from "./browser-action-sequence.mjs";
export async function inspectPage(page, command) {
    const selector = command.selector?.trim();
    if (!selector) throw new Error("Browser inspection requires a CSS selector");
    const timeoutMs = clampInteger(command.timeoutMs, 0, 30_000, command.waitFor ? 10_000 : 0);
    const minCount = clampInteger(command.minCount, 0, 100_000, 0);
    const maxResults = clampInteger(command.maxResults, 1, 200, 50);
    const styles = (command.styles?.length ? command.styles : [
        "display",
        "visibility",
        "opacity",
        "position",
        "z-index",
        "overflow",
        "color",
        "background-color"
    ]).filter((value)=>/^(?:--[\w-]{1,60}|[a-z-]{1,64})$/.test(value)).slice(0, 32);
    const probe = async ()=>{
        const states = await Promise.all(page.frames().map((frame)=>frame.locator(selector).evaluateAll((elements, expected)=>{
                const normalize = (value)=>String(value ?? "").replace(/\s+/g, " ").trim();
                const visible = (element)=>{
                    const style = getComputedStyle(element);
                    const rect = element.getBoundingClientRect();
                    return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0 && rect.width > 0 && rect.height > 0;
                };
                const expectedText = expected.text;
                return {
                    count: elements.length,
                    visible: elements.filter(visible).length,
                    text: expectedText ? elements.some((element)=>normalize(element.textContent).includes(expectedText)) : true,
                    value: expected.value === undefined ? true : elements.some((element)=>"value" in element && String(element.value) === expected.value)
                };
            }, {
                text: command.text,
                value: command.value
            })));
        return states.reduce((result, state)=>({
                count: result.count + state.count,
                visible: result.visible + state.visible,
                text: result.text || state.text,
                value: result.value || state.value
            }), {
            count: 0,
            visible: 0,
            text: command.text === undefined,
            value: command.value === undefined
        });
    };
    const satisfied = (state)=>{
        const presence = command.waitFor === "detached" ? state.count === 0 : command.waitFor === "visible" ? state.visible > 0 : command.waitFor === "hidden" ? state.count === 0 || state.visible === 0 : command.waitFor === "attached" ? state.count > 0 : true;
        return presence && state.count >= minCount && state.text && state.value;
    };
    const deadline = Date.now() + timeoutMs;
    let state = await probe();
    while(!satisfied(state) && Date.now() < deadline){
        await page.waitForTimeout(100);
        state = await probe();
    }
    if (!satisfied(state)) throw new Error(`Browser inspection condition was not met: ${JSON.stringify({
        selector,
        waitFor: command.waitFor,
        expectedText: command.text,
        expectedValue: command.value,
        minCount,
        ...state
    })}`);
    const elements = [];
    for (const frame of page.frames()){
        if (elements.length >= maxResults) break;
        const details = await frame.locator(selector).evaluateAll((matches, input)=>{
            const normalize = (value)=>String(value ?? "").replace(/\s+/g, " ").trim();
            const describe = (element)=>{
                if (!element) return undefined;
                return {
                    tag: element.tagName.toLowerCase(),
                    id: element.id || undefined,
                    role: element.getAttribute("role") || undefined,
                    text: normalize(element.textContent).slice(0, 160) || undefined
                };
            };
            const componentPath = (element)=>{
                if (!input.includeComponents) return undefined;
                const record = element;
                const reactKey = Object.keys(record).find((key)=>key.startsWith("__reactFiber$") || key.startsWith("__reactInternalInstance$"));
                const names = [];
                let node = reactKey ? record[reactKey] : undefined;
                while(node && names.length < 12){
                    const type = node.type;
                    const name = typeof type === "string" ? type : type?.displayName ?? type?.name;
                    if (name && !names.includes(name)) names.push(name);
                    node = node.return;
                }
                let vue = record.__vueParentComponent;
                while(vue && names.length < 12){
                    const type = vue.type;
                    const name = type?.name ?? type?.__name;
                    if (name && !names.includes(name)) names.push(name);
                    vue = vue.parent;
                }
                return names.length ? names : undefined;
            };
            return matches.slice(0, input.limit).map((element, index)=>{
                const style = getComputedStyle(element);
                const rect = element.getBoundingClientRect();
                const viewportLeft = Math.max(0, rect.left);
                const viewportTop = Math.max(0, rect.top);
                const viewportRight = Math.min(innerWidth, rect.right);
                const viewportBottom = Math.min(innerHeight, rect.bottom);
                const intersection = Math.max(0, viewportRight - viewportLeft) * Math.max(0, viewportBottom - viewportTop);
                const area = Math.max(0, rect.width * rect.height);
                const x = Math.min(Math.max(rect.left + rect.width / 2, 0), Math.max(0, innerWidth - 1));
                const y = Math.min(Math.max(rect.top + rect.height / 2, 0), Math.max(0, innerHeight - 1));
                const top = area > 0 ? document.elementFromPoint(x, y) : null;
                const visible = style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0 && area > 0;
                const inputElement = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement ? element : undefined;
                const attributes = Object.fromEntries(Array.from(element.attributes).filter((attribute)=>!attribute.name.startsWith("data-bulu-ref") && attribute.name !== "style").slice(0, 40).map((attribute)=>[
                        attribute.name,
                        attribute.value.slice(0, 300)
                    ]));
                const image = element instanceof HTMLImageElement ? {
                    src: element.currentSrc || element.src,
                    alt: element.alt,
                    complete: element.complete,
                    naturalWidth: element.naturalWidth,
                    naturalHeight: element.naturalHeight
                } : element instanceof HTMLCanvasElement ? {
                    canvas: true,
                    width: element.width,
                    height: element.height
                } : undefined;
                return {
                    index,
                    frameUrl: input.frameUrl,
                    tag: element.tagName.toLowerCase(),
                    role: element.getAttribute("role") || undefined,
                    text: normalize(element.textContent).slice(0, 1_000) || undefined,
                    value: inputElement instanceof HTMLInputElement && inputElement.type === "password" ? undefined : inputElement?.value,
                    checked: element instanceof HTMLInputElement && [
                        "checkbox",
                        "radio"
                    ].includes(element.type) ? element.checked : undefined,
                    disabled: "disabled" in element ? Boolean(element.disabled) : undefined,
                    scroll: {
                        top: Math.round(element.scrollTop),
                        left: Math.round(element.scrollLeft),
                        maxTop: Math.max(0, element.scrollHeight - element.clientHeight),
                        maxLeft: Math.max(0, element.scrollWidth - element.clientWidth),
                        atBottom: element.scrollTop >= element.scrollHeight - element.clientHeight - 1
                    },
                    attributes,
                    visible,
                    inViewport: intersection > 0,
                    visibleRatio: area > 0 ? Math.round(intersection / area * 10_000) / 10_000 : 0,
                    boundingBox: {
                        x: rect.x,
                        y: rect.y,
                        width: rect.width,
                        height: rect.height,
                        top: rect.top,
                        right: rect.right,
                        bottom: rect.bottom,
                        left: rect.left
                    },
                    occluded: visible && intersection > 0 && !!top && top !== element && !element.contains(top),
                    topElement: top !== element && !element.contains(top) ? describe(top) : undefined,
                    styles: Object.fromEntries(input.styles.map((property)=>[
                            property,
                            style.getPropertyValue(property)
                        ])),
                    image,
                    components: componentPath(element)
                };
            });
        }, {
            limit: maxResults - elements.length,
            styles,
            includeComponents: command.includeComponents === true,
            frameUrl: frame.url()
        });
        elements.push(...details);
    }
    return {
        inspection: {
            selector,
            count: state.count,
            visible: state.visible,
            returned: elements.length,
            truncated: elements.length < state.count || undefined,
            waitFor: command.waitFor,
            assertions: {
                text: command.text,
                value: command.value,
                minCount
            },
            passed: true
        },
        elements
    };
}
function clampInteger(value, minimum, maximum, fallback) {
    if (value === undefined || !Number.isFinite(value)) return fallback;
    return Math.min(maximum, Math.max(minimum, Math.trunc(value)));
}
export async function interact(locator, command) {
    if (command.interaction === "click") return locator.click();
    if (command.interaction === "double_click") return locator.dblclick();
    if (command.interaction === "hover") return locator.hover();
    if (command.interaction === "type") {
        if (command.text === undefined) throw new Error("Type action requires text");
        return fillAndVerify(locator, command.text);
    }
    if (command.interaction === "select") {
        if (command.option === undefined) throw new Error("Select action requires an option");
        await selectBrowserOption(locator, command.option);
        return;
    }
    if (command.interaction === "check") return locator.check();
    if (command.interaction === "uncheck") return locator.uncheck();
    throw new Error("Unsupported browser interaction");
}
async function fillAndVerify(locator, text) {
    await locator.fill(text);
    const value = await locator.evaluate((element)=>{
        const input = element;
        return "value" in input ? String(input.value) : input.innerText ?? input.textContent ?? "";
    });
    if (value !== text) throw new Error("输入已发送，但控件值未验证；请重新读取页面后再判断是否重试");
}
