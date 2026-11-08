// Authorized BuLu browser-logic port; provenance: port-manifest.json.
function controlsSettled(ids) {
    const targets = ids.filter((id)=>{
        const target = document.getElementById(id);
        return target && target.scrollHeight > target.clientHeight + 1 && target.scrollTop >= target.scrollHeight - target.clientHeight - 1;
    });
    return !Array.from(document.querySelectorAll("[aria-controls]")).some((element)=>{
        if (!element.getAttribute("aria-controls")?.split(/\s+/).some((id)=>targets.includes(id))) return false;
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        if (!rect.width || !rect.height || style.display === "none" || style.visibility === "hidden") return false;
        return /\bscroll down\b|向下滚动|向下翻|继续下滑/i.test(element instanceof HTMLElement ? element.innerText : element.textContent ?? "");
    });
}
export async function waitForScrollControls(page, scroll, signal) {
    const targets = scroll.flatMap((frame)=>{
        const ids = frame.areas.flatMap((area)=>area.id && area.maxTop > 0 && area.atBottom ? [
                area.id
            ] : []);
        return ids.length ? [
            {
                frameUrl: frame.frameUrl,
                ids
            }
        ] : [];
    });
    if (!targets.length || signal?.aborted) return {
        checked: false,
        pending: false
    };
    const results = await Promise.all(page.frames().map(async (frame)=>{
        const target = targets.find((item)=>item.frameUrl === frame.url());
        if (!target || signal?.aborted) return false;
        try {
            if (await frame.evaluate(controlsSettled, target.ids)) return false;
            const result = await frame.waitForFunction(controlsSettled, target.ids, {
                timeout: 350
            });
            await result.dispose();
            return false;
        } catch (error) {
            if (frame.isDetached() || signal?.aborted) return false;
            if (error instanceof Error && error.name === "TimeoutError") return true;
            throw error;
        }
    }));
    return {
        checked: true,
        pending: results.some(Boolean)
    };
}
