package ai.eva.android.probe;

/** Text policy shared by microphone and deterministic tests. */
final class VoiceText {
 static String command(String text) {
  if(text==null)return "";
  return text.trim().replaceFirst("(?i)^[，。！？、\\s]*(?:你好|您好)[，。！？、\\s]*(?:(?:艾|爱|埃|伊)(?:瓦|娃|哇|我|哦)?|eva)[，。！？、：\\s]*", "").trim();
 }
 static boolean cancel(String text){return text.matches("[取消停止不要]+[了吧。！!\\s]*")||text.equals("取消指令")||text.equals("不用了");}
}
