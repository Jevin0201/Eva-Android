/* Bottom-follow intent survives asynchronous React, images and disclosure layout. */
window.evaChatScroll = (() => {
 const states = new WeakMap();
 const threshold = 24;
 let current = null;
 function atBottom(flow) {
  return flow.scrollHeight - flow.clientHeight - flow.scrollTop <= threshold;
 }
 function position(flow, state) {
  const rect = flow.getBoundingClientRect();
  const parent = flow.parentElement.getBoundingClientRect();
  state.button.style.top = Math.max(0, rect.bottom - parent.top - 56) + 'px';
  state.button.style.left = rect.left - parent.left + rect.width / 2 + 'px';
 }
 function paint(flow, state) {
  state.button.hidden = state.follow;
  state.button.dataset.visible = String(!state.follow);
  state.button.dataset.working = String(!!active()?.running);
  position(flow, state);
 }
 function place(flow, state) {
  const target = state.follow ? flow.scrollHeight : state.readingTop;
  flow.scrollTop = target;
  state.expectedTop = flow.scrollTop;
  paint(flow, state);
 }
 function disconnect(flow) {
  const state = states.get(flow);
  if (!state) return;
  state.listeners.abort();
  state.resize.disconnect();
  state.mutations.disconnect();
  state.button.remove();
  states.delete(flow);
  if (current === flow) current = null;
 }
 function attach(flow, id) {
  if (current && current !== flow) disconnect(current);
  let state = states.get(flow);
  if (state?.id === id) {
   current = flow;
   return state;
  }
  disconnect(flow);
  current = flow;
  const button = document.createElement('button');
  button.className = 'chat-scroll-bottom';
  button.type = 'button';
  button.hidden = true;
  button.setAttribute('aria-label', '回到最新内容');
  button.title = '回到最新内容';
  button.innerHTML = '<span class="transcript-jump-dots" aria-hidden="true"><i></i><i></i><i></i></span><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 3.5v13m-5-5 5 5 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  flow.parentElement.append(button);
  state = {id, button, follow: true, readingTop: 0, expectedTop: null, userUntil: 0, listeners: new AbortController()};
  states.set(flow, state);
  const intent = earlier => {
   state.userUntil = performance.now() + 1000;
   state.expectedTop = null;
   if (earlier && flow.scrollTop > 0) {
    state.follow = false;
    state.readingTop = flow.scrollTop;
   }
  };
  flow.addEventListener('wheel', event => intent(event.deltaY < 0), {passive: true, signal: state.listeners.signal});
  let touchY = null;
  flow.addEventListener('touchstart', event => { touchY = event.touches[0]?.clientY; }, {passive: true, signal: state.listeners.signal});
  flow.addEventListener('touchmove', event => {
   const next = event.touches[0]?.clientY;
   intent(touchY != null && next > touchY);
   touchY = next;
  }, {passive: true, signal: state.listeners.signal});
  flow.addEventListener('keydown', event => {
   if (['ArrowUp', 'PageUp', 'Home', 'ArrowDown', 'PageDown', 'End'].includes(event.key)) {
    intent(['ArrowUp', 'PageUp', 'Home'].includes(event.key));
   }
  }, {signal: state.listeners.signal});
  flow.addEventListener('scroll', event => {
   if (!flow.isConnected || states.get(flow) !== state) return;
   const expected = state.expectedTop != null && Math.abs(flow.scrollTop - state.expectedTop) < 1;
   // Synthetic scroll is an explicit caller gesture. Native layout/programmatic
   // events require input intent before changing the follow policy.
   if (!event.isTrusted || !expected && performance.now() < state.userUntil) {
    state.follow = atBottom(flow);
    state.readingTop = flow.scrollTop;
    state.expectedTop = null;
   }
   paint(flow, state);
  }, {passive: true, signal: state.listeners.signal});
  button.addEventListener('click', () => {
   state.follow = true;
   state.userUntil = 0;
   place(flow, state);
  });
  state.resize = new ResizeObserver(() => {
   if (!flow.isConnected) return disconnect(flow);
   place(flow, state);
  });
  state.mutations = new MutationObserver(() => {
   if (!flow.isConnected) return disconnect(flow);
   for (const child of flow.children) state.resize.observe(child);
   place(flow, state);
  });
  state.mutations.observe(flow, {childList: true});
  return state;
 }
 function before(flow, id) {
  return attach(flow, id).follow;
 }
 function after(flow) {
  const state = states.get(flow);
  if (!state) return;
  state.resize.disconnect();
  state.resize.observe(flow);
  for (const child of flow.children) state.resize.observe(child);
  if (!state.follow && flow.scrollHeight - flow.clientHeight >= state.readingTop) {
   state.readingTop = flow.scrollTop;
  }
  place(flow, state);
 }
 function restore(flow, id, saved) {
  const state = attach(flow, id);
  state.follow = !saved || saved.bottom;
  state.readingTop = saved?.top || 0;
  state.userUntil = 0;
  place(flow, state);
 }
 function sync(flow) {
  const state = states.get(flow);
  if (state) paint(flow, state);
 }
 function snapshot(flow) {
  const state = states.get(flow);
  return state ? {top: state.follow ? flow.scrollTop : state.readingTop, bottom: state.follow} : null;
 }
 return {before, after, restore, sync, snapshot};
})();
