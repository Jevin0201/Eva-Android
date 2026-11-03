package ai.eva.android.probe;
public final class HookStoreValidationTest {
 interface Check{void run()throws Exception;}static void reject(Check f)throws Exception{boolean failed=false;try{f.run();}catch(Exception e){failed=true;}if(!failed)throw new AssertionError();}
 public static void main(String[] args)throws Exception{HookStore.validate("PreToolUse","echo fixture","Bash",10);reject(()->HookStore.validate("Unknown","echo fixture","",10));reject(()->HookStore.validate("Stop","","",10));reject(()->HookStore.validate("Stop","echo x","",0));reject(()->HookStore.validate("Stop","echo x","",301));reject(()->HookStore.validate("Stop","echo x\u0000","",10));reject(()->HookStore.validate("Stop","echo x","x\ny",10));System.out.println("PASS HookStore event/command/matcher/timeout validation");}
}
