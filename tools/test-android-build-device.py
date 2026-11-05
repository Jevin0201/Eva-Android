"""Run inside the phone runtime. Creates only task-owned source and APK fixtures."""
import json
from pathlib import Path
import runpy
import uuid

module = runpy.run_path('/root/.eva-runtime/eva-android-build.py')
root = Path('/root/eva-workspace') / ('.eva-apk-check-' + uuid.uuid4().hex[:10])
root.mkdir()
source = root / 'java source'
(source / 'src/ai/eva/buildcheck').mkdir(parents=True)
(source / 'res/values').mkdir(parents=True)
(source / 'eva-android.json').write_text(json.dumps({'minSdk': 28}))
(source / 'AndroidManifest.xml').write_text('''<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="ai.eva.buildcheck"><application android:theme="@android:style/Theme.Material.Light.NoActionBar" android:label="Eva 本机构建验收"><activity android:name=".MainActivity" android:exported="true"><intent-filter><action android:name="android.intent.action.MAIN"/><category android:name="android.intent.category.LAUNCHER"/></intent-filter></activity></application></manifest>''')
(source / 'res/values/strings.xml').write_text('<resources><string name="message">Eva 手机本地源码构建成功</string></resources>')
(source / 'src/ai/eva/buildcheck/MainActivity.java').write_text('''package ai.eva.buildcheck; public class MainActivity extends android.app.Activity { public void onCreate(android.os.Bundle b) { super.onCreate(b); android.widget.TextView text = new android.widget.TextView(this); text.setText(R.string.message); text.setTextSize(24); text.setGravity(17); setContentView(text); } }''')
result = module['build'](str(source), str(root / 'java-apk'), 'assembleDebug')
try:
    module['build'](str(source), str(root / 'java-apk'), 'assembleDebug')
    raise AssertionError('Existing output was accepted')
except ValueError:
    pass
result['fixtureRoot'] = str(root)
print(json.dumps(result, ensure_ascii=False), flush=True)
(root / 'acceptance.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))

# A normal AGP project deliberately omits buildToolsVersion so AGP selects 35.0.0.
gradle = root / 'gradle source'
(gradle / 'app/src/main/java/ai/eva/gradlecheck').mkdir(parents=True)
(gradle / 'settings.gradle').write_text("pluginManagement { repositories { google(); mavenCentral(); gradlePluginPortal() } }\ndependencyResolutionManagement { repositories { google(); mavenCentral() } }\nrootProject.name='EvaBuildCheck'\ninclude ':app'\n")
(gradle / 'build.gradle').write_text("plugins { id 'com.android.application' version '8.10.1' apply false }\n")
(gradle / 'app/build.gradle').write_text("plugins { id 'com.android.application' }\nandroid { namespace 'ai.eva.gradlecheck'; compileSdk 36; defaultConfig { applicationId 'ai.eva.gradlecheck'; minSdk 28; targetSdk 36; versionCode 1; versionName '1.0' }; compileOptions { sourceCompatibility JavaVersion.VERSION_1_8; targetCompatibility JavaVersion.VERSION_1_8 } }\n")
(gradle / 'app/src/main/AndroidManifest.xml').write_text('<manifest xmlns:android="http://schemas.android.com/apk/res/android"><application android:label="Eva Gradle Check"><activity android:name=".MainActivity" android:exported="true"><intent-filter><action android:name="android.intent.action.MAIN"/><category android:name="android.intent.category.LAUNCHER"/></intent-filter></activity></application></manifest>')
(gradle / 'app/src/main/java/ai/eva/gradlecheck/MainActivity.java').write_text('package ai.eva.gradlecheck; public class MainActivity extends android.app.Activity { public void onCreate(android.os.Bundle b){super.onCreate(b);android.widget.TextView text=new android.widget.TextView(this);text.setTextSize(24);text.setTextColor(0xff202020);text.setGravity(17);Runnable label=()->text.setText("Gradle ARM64 lambda build passed");label.run();setContentView(text);} }')
result['gradle'] = module['build'](str(gradle), str(root / 'gradle-apk'), 'assembleDebug')
print(json.dumps(result, ensure_ascii=False), flush=True)
(root / 'acceptance.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
