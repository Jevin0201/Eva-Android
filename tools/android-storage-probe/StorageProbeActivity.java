package ai.eva.android.probe;
/** Dedicated package: executes production backup/storage probe without Eva user data. */
public class StorageProbeActivity extends android.app.Activity {
 public void onCreate(android.os.Bundle saved){super.onCreate(saved);DataBackupProbe.check(this);new Thread(()->{String result;try{java.io.File root=new java.io.File(getCacheDir(),"thread-recovery-"+java.util.UUID.randomUUID());root.mkdirs();result="PASS "+ThreadRecoveryTest.run(root)+" checks";}catch(Throwable e){result="FAIL "+e.toString();}getSharedPreferences("thread-recovery-result",0).edit().putString("result",result).commit();},"thread-recovery-probe").start();}
}
