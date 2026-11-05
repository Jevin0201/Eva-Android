// Inert original factory; not executed.
const aqd9 = function(e,t,i){let o=new WeakMap,n="--decorative-animation-play-state";function r(e,t){let i;if(null==e)return;if("u"<typeof IntersectionObserver)return void t?.(!0);let r=e.ownerDocument,a=o.get(r);null==a&&(i=new Map,a={observer:new IntersectionObserver(e=>{for(let t of e)i.get(t.target)?.(t.isIntersecting)}),targets:i},o.set(r,a));let h=i=>{i?e.style.removeProperty(n):e.style.setProperty(n,"paused"),t?.(i)};return h(!1),a.targets.set(e,h),a.observer.observe(e),()=>{a.targets.delete(e),a.observer.unobserve(e),e.style.removeProperty(n),0===a.targets.size&&(a.observer.disconnect(),o.delete(r))}}i.d(t,{d:()=>r})};

export default aqd9;
