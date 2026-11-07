package ai.eva.android.probe;

import android.app.Instrumentation;
import android.content.ComponentName;
import android.os.Bundle;

/** Checks package isolation without changing the device's accessibility settings. */
public final class PhoneControlSetupCheck extends Instrumentation {
    public void onCreate(Bundle arguments) { super.onCreate(arguments); start(); }
    public void onStart() {
        Bundle result = new Bundle();
        try {
            String own = getTargetContext().getPackageName();
            String ownCommand = PhoneShellService.restoreCommand(new ComponentName(getTargetContext(), PhoneAccessibility.class));
            if (!ownCommand.startsWith("component=" + own + "/")) throw new AssertionError("wrong package");
            String otherPackage = own + ".isolated";
            String otherCommand = PhoneShellService.restoreCommand(new ComponentName(otherPackage, PhoneAccessibility.class.getName()));
            if (!otherCommand.startsWith("component=" + otherPackage + "/")) throw new AssertionError("package was hardcoded");
            try {
                PhoneShellService.restoreCommand(new ComponentName("bad;id", PhoneAccessibility.class.getName()));
                throw new AssertionError("unsafe package accepted");
            } catch (IllegalArgumentException expected) { }
            try {
                PhoneShellService.restoreCommand(new ComponentName(own, "other.Service"));
                throw new AssertionError("foreign service accepted");
            } catch (IllegalArgumentException expected) { }
            result.putString("evaApps", PhoneAppActions.apps(getTargetContext(), new org.json.JSONObject().put("query", "eva")).toString());
            result.putString("result", "PASS package isolation and component validation");
            finish(0, result);
        } catch (Throwable error) {
            result.putString("error", error.toString());
            finish(1, result);
        }
    }
}
