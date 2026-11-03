package ai.eva.android.probe;
public final class McpSettingsValidationTest {
 interface Check{void run()throws Exception;}
 static void rejected(Check f)throws Exception{boolean rejected=false;try{f.run();}catch(Exception expected){rejected=true;}if(!rejected)throw new AssertionError("Invalid value accepted");}
 public static void main(String[] args)throws Exception{
  McpSettings.validateToken("fixture-token");McpSettings.validateToken("");rejected(()->McpSettings.validateToken("token\r\nInjected: header"));rejected(()->McpSettings.validateToken(new String(new char[8193])));McpSettings.validateName("my-server_1");McpSettings.validateUrl("https://example.test/mcp");
  for(String name:new String[]{"", "../escape", "a.b", "a b", "a\n"})rejected(()->McpSettings.validateName(name));
  for(String url:new String[]{"http://example.test/mcp","https://user:secret@example.test/mcp","https://example.test/mcp?token=secret","https://example.test/mcp#secret","file:///private","https:///missing-host"})rejected(()->McpSettings.validateUrl(url));
  System.out.println("PASS native MCP names, endpoint scheme, host, credentials, query and fragment validation");
 }
}
