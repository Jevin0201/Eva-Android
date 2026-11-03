package ai.eva.android.probe;
/** No Android execution: tests the exact shared provider stamp used by KernelHost. */
public final class KernelProviderCacheTest {
 static int n;static void check(boolean value,String message){n++;if(!value)throw new AssertionError(message);}
 public static void main(String[] args){KernelHost.ProviderConfigCache cache=new KernelHost.ProviderConfigCache();Object account=new Object(),api=new Object();String a="openai\ndefinitions-v1",b="deepseek\ndefinitions-v1";
 check(!cache.matches(account,a,"disk1"),"cold process must write");
 cache.accepted(account,a,"disk1");check(cache.matches(account,a,"disk1"),"same live process and config may reuse");
 check(!cache.matches(api,a,"disk1"),"other process must acknowledge config itself");
 check(!cache.matches(account,b,"disk1"),"provider switch must write");
 check(!cache.matches(account,"openai\ndefinitions-v2","disk1"),"definition change must write");
 check(!cache.matches(account,a,"disk2"),"external config write invalidates reuse");
 check(!cache.matches(account,a,null),"unreadable config cannot reuse");
 check(!cache.matches(null,a,"disk1"),"dead process cannot reuse");
 cache.accepted(api,b,"disk2");check(cache.matches(api,b,"disk2"),"API process may reuse its acknowledged write");check(!cache.matches(account,a,"disk1"),"other process changed shared stamp");
 cache.invalidate();check(!cache.matches(api,b,"disk2"),"failure/logout/start/exit invalidation");
 cache.accepted(api,b,null);check(!cache.matches(api,b,null),"successful RPC without disk fingerprint remains uncached");
 cache.accepted(api,b,"disk3");check(!cache.matches(new Object(),b,"disk3"),"replacement child cannot reuse old process stamp");
 cache.accepted(account,a,"disk4");check(cache.matches(account,a,"disk4"),"switch back writes then reuses");
 cache.invalidate();check(!cache.matches(account,a,"disk4"),"cache never grants after invalidation");
 System.out.println("PASS shared provider config cache "+n+" checks");}
}
