// Authorized BuLu browser-logic port; provenance: port-manifest.json.
export async function enforceNavigationPolicy(page, command, policy) {
    if (command.steps) {
        for (const step of command.steps)await enforceNavigationPolicy(page, step, policy);
        return;
    }
    if (command.action === "pointer" && command.pointer !== "scroll") throw new Error("当前任务要求按钮导航，请使用可验证的元素 ref 或 selector，不能用坐标点击绕过约束");
    if (![
        "click",
        "act",
        "press_key"
    ].includes(command.action)) return;
    const press = command.action === "press_key";
    if (command.action === "act" && ![
        "click",
        "double_click"
    ].includes(command.interaction ?? "")) return;
    const target = command.ref ? `[data-rae-ref=${JSON.stringify(command.ref)}]` : command.selector;
    for (const frame of page.frames()){
        const locator = target ? frame.locator(target).first() : frame.locator(":focus");
        if (!await locator.count()) continue;
        const state = await locator.evaluate((element, input)=>{
            const next = element.closest(input.policy.nextSelector);
            const link = element.closest('a[href]:not([download]),[role="link"],[role="treeitem"]');
            const widget = element.closest('input,textarea,[contenteditable="true"],[role="radio"],[role="option"],[role="slider"]');
            if (input.press && !next && widget) return {
                allowed: true,
                bottom: true
            };
            if (input.press && !next && /^(?:ArrowLeft|ArrowRight|Alt\+ArrowLeft|Alt\+ArrowRight)$/.test(input.key ?? "")) return {
                allowed: false,
                bottom: true
            };
            if (!next) return {
                allowed: !link,
                bottom: true
            };
            const root = document.querySelector(input.policy.contentSelector);
            if (!root) return {
                allowed: true,
                bottom: false
            };
            let bottom = true;
            for(let node = root; node; node = node.parentElement){
                const style = getComputedStyle(node);
                if ((/auto|scroll|overlay/.test(style.overflowY) || node === document.scrollingElement) && node.scrollHeight > node.clientHeight + 1) bottom = bottom && node.scrollTop + node.clientHeight >= node.scrollHeight - 2;
            }
            return {
                allowed: true,
                bottom
            };
        }, {
            policy,
            press,
            key: command.key
        });
        if (!state.allowed) throw new Error("当前任务禁止地址或侧栏跳页；请使用已确认的下一页按钮");
        if (policy.requireBottom && !state.bottom) throw new Error("正文尚未滚动到底或正文区域不可用；未点击下一页按钮");
        return;
    }
    if (press) throw new Error("无法核实按键目标；当前任务要求通过按钮导航");
}
