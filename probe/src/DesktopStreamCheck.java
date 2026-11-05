package ai.eva.android.probe;

import android.app.Activity;
import android.app.Instrumentation;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.os.SystemClock;
import java.util.UUID;
import org.json.JSONObject;

/** Isolated packaged-renderer exercise. It never opens the production UI store or kernel. */
public final class DesktopStreamCheck extends Instrumentation {
 @Override public void onCreate(Bundle arguments) { super.onCreate(arguments); start(); }
 @Override public void onStart() {
  Bundle output = new Bundle();
  Activity fixture = null;
  try {
   String runId = UUID.randomUUID().toString();
   SharedPreferences result = getTargetContext().getSharedPreferences("eva-stream-check", 0);
   if (!result.edit().clear().putString("runId", runId).commit()) throw new IllegalStateException("Cannot initialize fixture report");
   Intent launch = new Intent(getTargetContext(), DesktopStreamFixtureActivity.class);
   launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK).putExtra("runId", runId);
   fixture = startActivitySync(launch);
   long deadline = SystemClock.elapsedRealtime() + 120000;
   String raw = null;
   while (SystemClock.elapsedRealtime() < deadline) {
    raw = result.getString("result", null);
    if (raw != null) break;
    SystemClock.sleep(250);
   }
   if (raw == null) throw new IllegalStateException("Packaged WebView fixture timed out");
   JSONObject report = new JSONObject(raw);
   output.putString("result", raw);
   finish(report.optBoolean("passed") ? Activity.RESULT_OK : Activity.RESULT_CANCELED, output);
  } catch (Exception error) {
   output.putString("error", error.toString());
   finish(Activity.RESULT_CANCELED, output);
  } finally {
   final Activity current = fixture;
   if (current != null) runOnMainSync(() -> { if (!current.isFinishing()) current.finish(); });
  }
 }
}
