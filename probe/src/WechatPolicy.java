package ai.eva.android.probe;
import java.text.Normalizer;
import java.util.*;
/** Pure policy, shared by the native workflow and host regression checks. */
final class WechatPolicy {
 static String normalized(String s){return Normalizer.normalize(s==null?"":s,Normalizer.Form.NFKC).replaceAll("\\s+","");}
 static boolean recipientMatches(String requested,String observed){String a=normalized(requested),b=normalized(observed);return !a.isEmpty()&&(a.equals(b)||b.matches(java.util.regex.Pattern.quote(a)+"\\([0-9]{1,5}\\)"));}
 static String titleBase(String s){return normalized(s).replaceFirst("\\([0-9]{1,5}\\)$","");}
 static boolean profile(int w,int h,int density,String model,String version){return w==1280&&h==2772&&density==520&&model.equals("M332BF")&&version.equals("8.0.79");}
 static String direction(boolean green,double leftAvatar,double rightAvatar){if(green)return "outgoing";if(rightAvatar>.3&&rightAvatar>leftAvatar+.15)return "outgoing";if(leftAvatar>.3&&leftAvatar>rightAvatar+.15)return "incoming";return "unknown";}
 static List<String> added(List<String> before,List<String> after){if(before==null)return new ArrayList<>(after);int overlap=Math.min(before.size(),after.size());while(overlap>0&&!before.subList(before.size()-overlap,before.size()).equals(after.subList(0,overlap)))overlap--;return new ArrayList<>(after.subList(overlap,after.size()));}
}
