package ai.eva.android.probe;
import java.util.*;
/** Host JVM test: exercises the production matcher without Android method calls. */
public final class PhoneAppActionsTest {
 static PhoneAppActions.App app(String pkg,String label){return new PhoneAppActions.App(pkg,label);}
 static void check(boolean ok,String message){if(!ok)throw new AssertionError(message);}
 public static void checkMatching(){
  List<PhoneAppActions.App> apps=Arrays.asList(app("chat.one","微信"),app("chat.one","微信"),app("chat.two","微信"),app("eva.main","Eva"),app("eva.other","Eva Test"),app("notes","My Notes"),app("punct","My-Notes"));
  check(PhoneAppActions.matches(apps,"微信").size()==2,"distinct packages must be ambiguous, repeated launcher deduplicated");
  check(PhoneAppActions.matches(apps,"ＥＶＡ").get(0).packageName.equals("eva.main"),"normalized fullwidth label");
  check(PhoneAppActions.matches(apps,"Eva").size()==1,"exact match does not select prefix apps");
  check(PhoneAppActions.matches(apps,"ev").isEmpty(),"partial label never starts an app");
  check(PhoneAppActions.matches(apps,"").isEmpty(),"empty name does not resolve");
  check(PhoneAppActions.matches(apps," \t\n").isEmpty(),"whitespace name does not resolve");
  check(PhoneAppActions.matches(apps,"  MY\t NOTES  ").size()==1,"case and whitespace normalization");
  check(PhoneAppActions.matches(apps,"MyNotes").isEmpty(),"do not erase word boundaries");
  check(PhoneAppActions.matches(apps,"My Notes").get(0).packageName.equals("notes"),"preserve punctuation distinction");
  check(PhoneAppActions.filter(apps,"eva",false).size()==2,"query label substring");
  check(PhoneAppActions.filter(apps,"chat.",false).size()==2,"query package substring and deduplicate");
  check(PhoneAppActions.filter(apps,"",false).size()==6,"list all distinct packages");
  List<PhoneAppActions.App> aliases=Arrays.asList(app("one","EVA"),app("two","Eva"));
  check(PhoneAppActions.matches(aliases,"eva").size()==2,"normalized collision must not select first");
  check(PhoneAppActions.matches(aliases,"Eva").get(0).packageName.equals("two"),"unique exact label wins");
 }
 public static void main(String[] args){checkMatching();System.out.println("PASS PhoneAppActions exact, normalized, ambiguous, aliases, empty, query and no-fuzzy matching");}
}
