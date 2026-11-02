package ai.eva.android.probe;
/** Compatibility route for old internal links; has no UI or tabs. */
public class LocalToolsActivity extends android.app.Activity {
 public void onCreate(android.os.Bundle state){super.onCreate(state);String tool=getIntent().getStringExtra("tool");Class<?> target="browser".equals(tool)?BrowserActivity.class:"files".equals(tool)?FilesActivity.class:TerminalActivity.class;startActivity(new android.content.Intent(this,target));finish();}
}
