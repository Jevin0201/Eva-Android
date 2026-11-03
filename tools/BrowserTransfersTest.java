package ai.eva.android.probe;
import java.net.*;
public final class BrowserTransfersTest {
 static void check(boolean ok,String message){if(!ok)throw new AssertionError(message);}
 static void rejects(String input)throws Exception{try{BrowserTransfers.origin(input);throw new AssertionError("Accepted "+input);}catch(java.io.IOException expected){}}
 public static void main(String[] args)throws Exception{
  check(BrowserTransfers.origin("https://Example.COM:443/a?private=secret").equals("https://example.com"),"origin drops path/query and normalizes host");
  check(BrowserTransfers.origin("https://example.com:8443/a").equals("https://example.com:8443"),"nondefault port is distinct");
  rejects("http://example.com");rejects("file:///tmp/a");rejects("content://a/b");rejects("https://user:password@example.com/a");rejects("https:///a");
  check(!BrowserTransfers.safeName("../../a\\b\n.txt").contains("/"),"forward slash stripped");check(!BrowserTransfers.safeName("../../a\\b\n.txt").contains("\\"),"backslash stripped");check(!BrowserTransfers.safeName("../../a\\b\n.txt").contains("\n"),"control stripped");check(BrowserTransfers.safeName("...").equals("download"),"dot path rejected");
  BrowserTransfers.Transfer t=new BrowserTransfers.Transfer("https://example.com","ua","https://example.com","https://example.com","x",20);t.cancel();check(t.cancelled&&t.terminal()&&t.state.equals("cancelled"),"pending cancellation terminal");
  check(BrowserSitePermissions.androidPermission("unknown")==null,"unknown resources rejected");check(BrowserSitePermissions.androidPermission("android.webkit.resource.VIDEO_CAPTURE").equals("android.permission.CAMERA"),"camera mapping");
  System.out.println("PASS HTTPS origin and credential validation; filename path/control safety; cancellation; resource allowlist");
 }
}
