// Authorized BuLu browser-logic port; provenance: port-manifest.json.
export async function scrollBrowserPage(page, command) {
    if (command.x === undefined !== (command.y === undefined)) throw new Error("Scroll target requires both x and y");
    // A page scroll has no pointer target. Do not reuse a cursor left inside an
    // iframe or nested scroller by a preceding operation.
    if (command.x === undefined) {
        await page.evaluate(input => document.scrollingElement?.scrollBy({left:input.deltaX??0,top:input.deltaY??0,behavior:'instant'}),command);
        return;
    }
    if (command.x !== undefined && command.y !== undefined) await page.mouse.move(command.x, command.y);
    const before = await page.evaluateHandle((input)=>{
        let element = input.x !== undefined && input.y !== undefined ? document.elementFromPoint(input.x, input.y) : document.scrollingElement;
        const positions = [];
        while(element){
            const style = getComputedStyle(element);
            const scrollable = element === document.scrollingElement || /auto|scroll|overlay/.test(`${style.overflowY} ${style.overflowX}`);
            positions.push({
                element,
                top: element.scrollTop,
                left: element.scrollLeft,
                movable: scrollable && ((input.deltaY ?? 0) > 0 && element.scrollTop < element.scrollHeight - element.clientHeight - 1 || (input.deltaY ?? 0) < 0 && element.scrollTop > 0 || (input.deltaX ?? 0) > 0 && element.scrollLeft < element.scrollWidth - element.clientWidth - 1 || (input.deltaX ?? 0) < 0 && element.scrollLeft > 0)
            });
            const root = element.getRootNode();
            element = element.parentElement ?? (root instanceof ShadowRoot ? root.host : null);
        }
        return positions;
    }, command);
    try {
        await page.mouse.wheel(command.deltaX ?? 0, command.deltaY ?? 0);
        if (await before.evaluate((positions)=>positions.some((item)=>item.movable))) {
            await page.waitForFunction((positions)=>positions.some((item)=>item.element.scrollTop !== item.top || item.element.scrollLeft !== item.left), before, {
                timeout: 250
            }).then((result)=>result.dispose()).catch((error)=>{
                if (!(error instanceof Error) || error.name !== "TimeoutError") throw error;
            });
        }
    } finally{
        await before.dispose();
    }
}
