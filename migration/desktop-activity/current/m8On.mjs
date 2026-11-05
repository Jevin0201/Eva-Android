// Inert original factory; not executed.
const m8On = function(e,t,n){let r=Symbol("resizeObserverCallbacks"),i=Symbol("resizeObserverLastEntry");function a(e=s){return"u"<typeof ResizeObserver?null:new ResizeObserver(e)}function s(e){for(let t of e){let e=t.target,n=e[r];if(null!=n)for(let r of(e[i]=t,Array.from(n)))r(t)}}function o({callback:e,element:t,observer:n}){let a=t[r];if(null!=a){a.add(e);let n=t[i];null!=n&&e(n);return}t[r]=new Set([e]),n?.observe(t)}function l({callback:e,element:t,observer:n}){let a=t[r];null==a||(a.delete(e),a.size>0||(t[r]=void 0,t[i]=void 0,n?.unobserve(t)))}n.d(t,{c2:()=>o,ub:()=>a,w:()=>l})};

export default m8On;
