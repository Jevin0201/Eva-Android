/* Eva desktop compatibility; installed before site scripts, no native bridge. */
(() => {
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
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) { meta = document.createElement('meta'); meta.name = 'viewport'; document.head.appendChild(meta); }
    if (meta.content !== content) meta.content = content;
  };
  new MutationObserver(viewport).observe(document, {childList: true, subtree: true, attributes: true, attributeFilter: ['content','name']});
  viewport();
})();
