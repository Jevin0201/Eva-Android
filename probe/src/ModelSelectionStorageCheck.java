package ai.eva.android.probe;

import android.app.Instrumentation;
import android.content.Context;
import android.content.ContextWrapper;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.os.Bundle;
import java.io.File;
import java.util.UUID;
import org.json.JSONArray;
import org.json.JSONObject;

/** Isolated selection persistence checks. Never opens the user's UI database. */
public final class ModelSelectionStorageCheck extends Instrumentation {
    private int checks;
    private void check(boolean value, String name) {
        if (!value) throw new AssertionError(name);
        checks++;
    }
    private String selection(String chatId, String model) throws Exception {
        return new JSONObject().put("chatId", chatId == null ? JSONObject.NULL : chatId)
            .put("selection", new JSONObject().put("providerId", "fixture").put("model", model)
                .put("effort", "high").put("serviceTier", JSONObject.NULL)).toString();
    }
    private String snapshotDigests(Context context) {
        StringBuilder result = new StringBuilder();
        try (SQLiteDatabase db = UiStateStore.open(context);
             Cursor cursor = db.rawQuery("SELECT key,digest FROM snapshots ORDER BY key", null)) {
            while (cursor.moveToNext()) result.append(cursor.getString(0)).append(cursor.getString(1));
        }
        return result.toString();
    }
    public void onCreate(Bundle arguments) { super.onCreate(arguments); start(); }
    public void onStart() {
        Bundle result = new Bundle();
        File folder = new File(getTargetContext().getCacheDir(), "model-selection-" + UUID.randomUUID());
        try {
            if (!folder.mkdirs()) throw new IllegalStateException("Cannot create fixture");
            Context context = new ContextWrapper(getTargetContext()) {
                public File getFilesDir() { return folder; }
            };
            char[] history = new char[2 * 1024 * 1024];
            java.util.Arrays.fill(history, 'x');
            JSONObject chat = new JSONObject().put("id", "chat").put("providerId", "old")
                .put("model", "old-model").put("serviceTier", "old-tier").put("history", new String(history));
            JSONObject draft = new JSONObject().put("id", "draft").put("model", "draft-old");
            JSONObject state = new JSONObject().put("chats", new JSONArray().put(chat))
                .put("drafts", new JSONArray().put(draft)).put("active", "chat");
            UiStateStore.save(context, state.toString());
            String digests = snapshotDigests(context);
            check(UiStateStore.modelSelection(context, selection("chat", "chosen"), UiStateStore.nextOperation()), "chat selection saved");
            check(snapshotDigests(context).equals(digests), "selection never rewrites snapshot/history chunks");
            JSONObject restored = new JSONObject(UiStateStore.load(context));
            JSONObject selected = restored.getJSONArray("chats").getJSONObject(0);
            check(selected.getString("model").equals("chosen") && selected.getString("providerId").equals("fixture"), "chat selection overlay loaded");
            check(!selected.has("serviceTier") && selected.getString("history").length() == history.length, "optional fields cleared and history retained");
            check(restored.getJSONArray("drafts").getJSONObject(0).getString("model").equals("draft-old"), "unrelated draft unchanged");
            long oldFull = UiStateStore.nextOperation();
            UiStateStore.modelSelection(context, selection("chat", "newer"), UiStateStore.nextOperation());
            UiStateStore.save(context, state.toString(), oldFull);
            check(new JSONObject(UiStateStore.load(context)).getJSONArray("chats").getJSONObject(0).getString("model").equals("newer"), "delayed full snapshot keeps newer choice");
            long oldCheckpoint = UiStateStore.nextOperation();
            JSONObject index = new JSONObject().put("chats", new JSONArray().put(new JSONObject().put("id", "chat")))
                .put("drafts", new JSONArray().put(new JSONObject().put("id", "draft")));
            String checkpoint = new JSONObject().put("state", index).put("conversation", chat).put("group", "chats").toString();
            UiStateStore.modelSelection(context, selection("chat", "newest"), UiStateStore.nextOperation());
            check(UiStateStore.checkpoint(context, checkpoint, oldCheckpoint), "checkpoint succeeds without full snapshot");
            check(new JSONObject(UiStateStore.load(context)).getJSONArray("chats").getJSONObject(0).getString("model").equals("newest"), "delayed conversation checkpoint keeps newer choice");
            long delayedChoice = UiStateStore.nextOperation();
            chat.put("model", "snapshot-newest");
            UiStateStore.save(context, state.toString(), UiStateStore.nextOperation());
            UiStateStore.modelSelection(context, selection("chat", "delayed"), delayedChoice);
            check(new JSONObject(UiStateStore.load(context)).getJSONArray("chats").getJSONObject(0).getString("model").equals("snapshot-newest"), "delayed choice never overwrites newer snapshot metadata");
            long oldComposerSnapshot = UiStateStore.nextOperation();
            UiStateStore.modelSelection(context, selection(null, "composer"), UiStateStore.nextOperation());
            UiStateStore.save(context, state.toString(), oldComposerSnapshot);
            check(new JSONObject(UiStateStore.load(context)).getJSONObject("composerSelection").getString("model").equals("composer"), "composer selection survives old snapshot");
            UiStateStore.save(context, state.toString(), UiStateStore.nextOperation());
            check(!new JSONObject(UiStateStore.load(context)).has("composerSelection"), "consumed composer choice does not resurrect");
            UiStateStore.modelSelection(context, selection("draft", "draft-new"), UiStateStore.nextOperation());
            check(new JSONObject(UiStateStore.load(context)).getJSONArray("drafts").getJSONObject(0).getString("model").equals("draft-new"), "draft selection persisted");
            check(!UiStateStore.modelSelection(context, selection("missing", "missing"), UiStateStore.nextOperation()), "missing chat rejected without inventing empty chat");
            boolean rejected = false;
            try { UiStateStore.modelSelection(context, "{selection:{providerId:fixture,model:fixture}}", UiStateStore.nextOperation()); }
            catch (Exception expected) { rejected = true; }
            check(rejected, "missing scope rejected");
            result.putString("stream", "PASS model selection storage " + checks + " checks\n");
        } catch (Throwable error) {
            result.putString("stream", "FAIL model selection storage " + error + "\n");
        } finally {
            File[] files = folder.listFiles();
            if (files != null) for (File file : files) if (!file.delete()) result.putString("cleanupError", "fixture file retained");
            if (folder.exists() && !folder.delete()) result.putString("cleanupError", "fixture directory retained");
        }
        finish(result.getString("stream", "").startsWith("PASS") && !result.containsKey("cleanupError") ? -1 : 0, result);
    }
}
