package ai.eva.android.probe;
import java.util.regex.*;

/** Conservative submission guard, not a claim of complete semantic understanding. */
final class VoiceCommandPolicy {
 enum Kind { EMPTY, CANCEL, INCOMPLETE, READY, UNCERTAIN }
 static String compact(String text){return text==null?"":text.replaceAll("[\\s，。！？、,.!?：:；;]","");}
 static String withoutFinish(String text){
  if(text==null)return "";String s=text.trim();
  Matcher m=Pattern.compile("(?:我说完了|说完了|可以执行了|请执行|就这样吧)[。！!\\s]*$").matcher(s);
  if(m.find()&&!s.substring(0,m.start()).matches(".*(?:没|没有|还没|未|不)$"))return s.substring(0,m.start()).replaceAll("[，。\\s]+$","");return s;
 }
 static boolean explicitFinish(String text){return text!=null&&!withoutFinish(text).equals(text.trim());}
 static Kind classify(String input){
  String s=compact(VoiceText.command(withoutFinish(input)));
  if(s.isEmpty()||s.matches("(?:(?:你好|您好)?(?:艾瓦|艾娃|爱娃|爱瓦|埃瓦|伊娃|爱|艾|啊|哦|嗯|喂|呃|那个|就是|让我想想|稍等|等一下|等等|你好|您好|[Ee][Vv][Aa]))+"))return Kind.EMPTY;
  if(s.matches("取消|取消指令|不用了|算了|别执行|不要执行|停止执行|取消任务"))return Kind.CANCEL;
  if(s.matches(".*(?:我想|我想让你|我要|我需要|你帮我|帮我|请你|麻烦你|帮忙|帮我把|帮我给|打开|关闭|启动|搜索|查找|查询|查一下|找一下|看看|看一下|写|发送|发给|创建|然后|还有|以及|或者|并且|因为|比如|关于|那个|这个|的|和|给|把|到|怎么|如何|让我想想|等一下|稍等|等等|还没说完|没有说完|先别执行|嗯|呃)$"))return Kind.INCOMPLETE;
  if(s.length()<3)return Kind.UNCERTAIN;
  if(s.matches("(?:向|往)?(?:上|下|左|右)(?:滑动|滚动)|(?:返回|回到)(?:桌面|首页|上一页)|(?:暂停|继续|停止)(?:播放|音乐)|(?:今天|明天|现在)(?:天气|几点|几点了|时间)"))return Kind.READY;
  if(Pattern.compile("(?:打开|启动|进入|退出|关闭|返回|搜索|查找|查询|播放|发送|发给|整理|删除|移动|复制|新建|创建|生成|编写|写|修改|修改成|改成|翻译|总结|解释|介绍|告诉|提醒|设置|安装|卸载|下载|上传|计算|帮我找|帮我看|看看|查看|检查|分析).{2,}").matcher(s).find())return Kind.READY;
  if(s.length()>=4&&Pattern.compile("什么|怎么样|怎么|怎样|如何|哪里|哪儿|多少|几点|为什么|是否|能否|[吗么呢]$").matcher(s).find())return Kind.READY;
  return Kind.UNCERTAIN;
 }
 static int silenceMillis(int configured){return Math.max(2000,Math.min(5000,configured));}
}
