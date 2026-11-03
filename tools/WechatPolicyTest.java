package ai.eva.android.probe;
import java.util.*;
public final class WechatPolicyTest {
 static int checks;static void check(boolean v,String s){checks++;if(!v)throw new AssertionError(s);}
 public static void main(String[] args){
  check(WechatPolicy.recipientMatches("刘文浩","刘 文 浩"),"OCR whitespace");
  check(WechatPolicy.recipientMatches("老友记","老友记(4)"),"group count");
  check(WechatPolicy.recipientMatches("老友记","老友记（4）"),"fullwidth group count");
  check(!WechatPolicy.recipientMatches("方昊","方昊2"),"no substring match");
  check(!WechatPolicy.recipientMatches("小白","小白龙"),"no name prefix");
  check(!WechatPolicy.recipientMatches("小白","大白"),"different contact");
  check(!WechatPolicy.recipientMatches("",""),"empty recipient");
  check(WechatPolicy.recipientMatches("FDE前哨Ai·Jevin","FDE 前哨 Ai·Jevin"),"punctuation retained");
  check(!WechatPolicy.recipientMatches("FDE前哨Ai·Jevin","FDE前哨Ai.Jevin"),"no punctuation guessing");
  check(WechatPolicy.normalized("Ｅｖａ， 测试").equals("Eva,测试"),"NFKC punctuation");
  check(WechatPolicy.profile(1280,2772,520,"M332BF","8.0.79"),"calibrated profile");
  check(!WechatPolicy.profile(1280,2772,480,"M332BF","8.0.79"),"changed density");
  check(!WechatPolicy.profile(2772,1280,520,"M332BF","8.0.79"),"rotated screen");
  check(!WechatPolicy.profile(1280,2772,520,"other","8.0.79"),"different phone");
  check(!WechatPolicy.profile(1280,2772,520,"M332BF","8.0.80"),"changed WeChat");
  check(WechatPolicy.added(Arrays.asList("incoming:a","outgoing:b"),Arrays.asList("incoming:a","outgoing:b","incoming:c")).equals(Arrays.asList("incoming:c")),"new incoming");
  check(WechatPolicy.added(Arrays.asList("a","b"),Arrays.asList("b","c")).equals(Arrays.asList("c")),"scrolled overlap");
  check(WechatPolicy.added(Arrays.asList("a","a"),Arrays.asList("a","a","a")).equals(Arrays.asList("a")),"duplicate message count");
  check(WechatPolicy.added(Arrays.asList("a"),Arrays.asList("a")).isEmpty(),"unchanged read");
  check(WechatPolicy.added(null,Arrays.asList("a")).equals(Arrays.asList("a")),"first-read explicit history");
  check(WechatPolicy.direction(true,0,0).equals("outgoing"),"green outgoing");
  check(WechatPolicy.direction(false,.05,.8).equals("outgoing"),"right white attachment");
  check(WechatPolicy.direction(false,.8,.05).equals("incoming"),"left white message");
  check(WechatPolicy.direction(false,.7,.7).equals("unknown"),"ambiguous avatars");
  check(WechatPolicy.direction(false,.05,.05).equals("unknown"),"missing avatars");
  System.out.println("PASS "+checks+" WeChat policy checks");
 }
}