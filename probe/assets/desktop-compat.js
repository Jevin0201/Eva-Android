/* Eva desktop compatibility; installed before site scripts, no native bridge. */
(() => {
  if (window.__evaDesktopCompatibilityApplied) return;
  Object.defineProperty(window, "__evaDesktopCompatibilityApplied", {value: true});
  const property = (target, name, value) => {
    try { Object.defineProperty(target, name, {configurable: true, get: () => value}); } catch (_) {}
  };
  property(Navigator.prototype, 'platform', 'Linux x86_64');
  property(Navigator.prototype, 'maxTouchPoints', 0);
  property(Screen.prototype, 'width', 1280);
  property(Screen.prototype, 'height', 800);
  property(Screen.prototype, 'availWidth', 1280);
  property(Screen.prototype, 'availHeight', 800);
  if (window.top !== window) return;
  const content = 'width=1280, minimum-scale=0.1, maximum-scale=5, user-scalable=yes';
  const viewport = () => {
    if (!document.head) return;
    const metas = [...document.querySelectorAll('meta[name="viewport" i]')];
    if (!metas.length) { const meta = document.createElement('meta'); meta.name = 'viewport'; document.head.appendChild(meta); metas.push(meta); }
    for (const meta of metas) if (meta.content !== content) meta.content = content;
  };
  new MutationObserver(viewport).observe(document, {childList: true, subtree: true, attributes: true, attributeFilter: ['content','name']});
  viewport();
})();
