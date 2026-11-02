# AndroidX WebKit dependency record

Source: Google Maven, https://dl.google.com/dl/android/maven2/ . Upstream source is Android Open Source Project, https://android.googlesource.com/platform/frameworks/support . Downloaded 2026-11-02. SHA-256 values for downloaded artifacts are in sha256.json.

Reviewed WebKit 1.14.0 POM and source headers: Apache License 2.0. Used unchanged classes.jar from its AAR. Full upstream license is bundled in probe/assets/ANDROIDX_LICENSE.txt. The AAR source archive includes Chromium support-library boundary interfaces used by WebView's supported compatibility APIs; no Git submodules are involved in these published artifacts.

The hand-built APK deliberately does not consume the entire Maven dependency graph. Source inspection of this pinned WebKit version found its only androidx.core import is Pair in WebViewAssetLoader. We include unchanged Pair.java and ObjectsCompat.java from core 1.1.0 sources, retaining their Apache 2.0 copyright headers, instead of the complete core UI library and its lifecycle/resource dependencies. Their annotation dependency is satisfied by annotation 1.1.0, whose POM also declares Apache 2.0 with no dependencies.

WebKit's POM also lists annotation-experimental 1.4.1, annotation 1.8.1 and jspecify 1.0.0. These are annotation-only dependencies for the inspected code; they are not bundled in this reduced development build. This is not a general-purpose AndroidX distribution or a claim that every WebKit API is covered. Revisit dependencies and normal resource/manifest merging before adding other AndroidX capabilities or upgrading WebKit.

Current exercised APIs: WebViewFeature checks, UserAgentMetadata, WebSettingsCompat metadata get/set, WebViewCompat document-start JavaScript, ScriptHandler removal. Compilation, dex conversion and these paths passed device verification on the connected phone.
