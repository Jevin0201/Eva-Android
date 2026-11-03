package ai.eva.android.probe;
import android.app.Activity;import android.content.Intent;import android.os.Bundle;
/** Compatibility entry point; the browser is a non-modal window owned by Eva's host. */
public class BrowserActivity extends Activity {
 public void onCreate(Bundle state){super.onCreate(state);Intent target=new Intent(this,ShellActivity.class).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);if(getIntent().getExtras()!=null)target.putExtras(getIntent().getExtras());target.putExtra("page","browser");startActivity(target);finish();}
}
