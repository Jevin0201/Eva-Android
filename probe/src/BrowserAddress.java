package ai.eva.android.probe;
import java.net.*;import java.util.Locale;
/** Browser navigation addresses, separate from API/runtime download policies. */
final class BrowserAddress {
 static String normalize(String input){
  if(input==null)throw new IllegalArgumentException("请输入网址");String value=input.trim();if(value.isEmpty())throw new IllegalArgumentException("请输入网址");
  for(int i=0;i<value.length();i++)if(Character.isISOControl(value.charAt(i)))throw new IllegalArgumentException("网址包含无效字符");
  if(value.equalsIgnoreCase("about:blank"))return "about:blank";
  if(value.startsWith("//"))value="https:"+value;
  if(!value.matches("(?i)^https?://.*")){
   if(value.contains("://")||value.matches("(?i)^(javascript|data|file|content|about|intent|mailto|tel):.*"))throw new IllegalArgumentException("此地址不是网页；请输入 HTTP、HTTPS 或域名");
   String authority=value.split("[/?#]",2)[0].toLowerCase(Locale.ROOT);boolean local=authority.matches("(?:localhost|127\\.[0-9.]+|10\\.[0-9.]+|192\\.168\\.[0-9.]+|172\\.(?:1[6-9]|2[0-9]|3[01])\\.[0-9.]+)(?::[0-9]+)?")||authority.startsWith("[::1]");
   value=(local?"http://":"https://")+value;
  }
  try{URI uri=new URI(value.replace(" ","%20"));String scheme=uri.getScheme().toLowerCase(Locale.ROOT),authority=uri.getRawAuthority();if(authority==null||authority.isEmpty()||uri.getRawUserInfo()!=null)throw new Exception();
   String host=uri.getHost();if(host==null){String raw=authority;String port="";int colon=raw.lastIndexOf(':');if(colon>=0){port=raw.substring(colon);if(!port.matches(":[0-9]+"))throw new Exception();raw=raw.substring(0,colon);}host=IDN.toASCII(raw,IDN.USE_STD3_ASCII_RULES);uri=new URI(scheme+"://"+host+port+(uri.getRawPath()==null?"":uri.getRawPath())+(uri.getRawQuery()==null?"":"?"+uri.getRawQuery())+(uri.getRawFragment()==null?"":"#"+uri.getRawFragment()));}
   if(host.isEmpty()||uri.getPort()>65535||authority.endsWith(":"))throw new Exception();return uri.toASCIIString();
  }catch(Exception error){throw new IllegalArgumentException("网址格式不正确，请输入域名或 HTTP/HTTPS 地址");}
 }
}
