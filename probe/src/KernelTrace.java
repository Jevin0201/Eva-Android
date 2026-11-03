package ai.eva.android.probe;
import android.os.SystemClock;
import org.json.*;
import java.util.*;
/** Bounded timing metadata only: never records prompts, credentials or output. */
final class KernelTrace {
 static long start=SystemClock.elapsedRealtime();static final ArrayDeque<JSONObject> rows=new ArrayDeque<>();static final Set<String> first=new HashSet<>();
 static synchronized void mark(String stage){try{if(rows.size()>=128)rows.removeFirst();rows.add(new JSONObject().put("ms",SystemClock.elapsedRealtime()-start).put("stage",stage));}catch(Exception ignored){}}
 static synchronized void once(String stage){if(first.add(stage))mark(stage);}
 static synchronized String read(boolean reset){JSONArray result=new JSONArray();for(JSONObject row:rows)result.put(row);if(reset){rows.clear();first.clear();start=SystemClock.elapsedRealtime();}return result.toString();}
}
