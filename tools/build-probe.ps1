param([string]$Sdk = "$env:LOCALAPPDATA\Android\Sdk", [string]$ApplicationId = "ai.eva.android.probe", [switch]$Release)
$ErrorActionPreference = 'Stop'
if ($Release) {
    foreach ($name in @('EVA_RELEASE_KEYSTORE','EVA_RELEASE_KEY_ALIAS','EVA_RELEASE_STORE_PASSWORD','EVA_RELEASE_KEY_PASSWORD')) {
        if (![Environment]::GetEnvironmentVariable($name)) { throw "Release signing configuration missing: $name" }
    }
    if (!(Test-Path -LiteralPath $env:EVA_RELEASE_KEYSTORE)) { throw 'Release keystore does not exist' }
    if ($env:EVA_RELEASE_KEY_ALIAS -eq 'androiddebugkey') { throw 'Release builds require a production signing alias' }
}
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
$bt = Join-Path $Sdk 'build-tools\36.0.0'
$platform = Join-Path $Sdk 'platforms\android-36\android.jar'
function Run([string]$Exe, [string[]]$Arguments) {
    & $Exe @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Exe exited $LASTEXITCODE" }
}
New-Item -ItemType Directory -Force probe/build/classes,probe/build/dex | Out-Null
Copy-Item probe/voice-keywords.txt probe/assets/voice/kws/keywords.txt -Force
$libraries = @(Get-ChildItem probe/libs -Filter *.jar | ForEach-Object FullName)
$compilePath = (@($platform) + $libraries) -join ';'
Run javac @('-encoding','UTF-8','--release','8','-classpath',$compilePath,'-d','probe/build/classes','probe/src/VoiceModels.java','probe/src/VoiceCheck.java','probe/src/VoiceText.java','probe/src/VoiceCommandPolicy.java','probe/src/VoiceAudio.java','probe/src/VoiceAgent.java','probe/src/VoiceIsland.java','probe/src/VoiceService.java','probe/src/VoiceActivity.java','probe/src/MainActivity.java','probe/src/EvaActivity.java','probe/src/LocalToolsActivity.java','probe/src/ToolPageActivity.java','probe/src/TerminalActivity.java','probe/src/FilesActivity.java','probe/src/WorkspaceEditor.java','probe/src/WorkspaceEditingProbe.java','probe/src/WorkspaceEditorUiProbe.java','probe/src/OfficeRuntime.java','probe/src/OfficeActivity.java','probe/src/WorkspaceGit.java','probe/src/WorkspaceGitProbe.java','probe/src/GitActivity.java','probe/src/WorkspaceEditActivity.java','probe/src/WorkspacePreviewActivity.java','probe/src/DesktopNotebookPreview.java','probe/src/OfficeLayoutPreview.java','probe/src/DocumentPreview.java','probe/src/RichPreview.java','probe/src/DocumentPreviewProbe.java','probe/src/DocumentPreviewUiProbe.java','probe/src/BrowserActivity.java','probe/src/BrowserWindow.java','probe/src/BrowserTransfers.java','probe/src/BrowserTransfersProbe.java','probe/src/BrowserSitePermissions.java','probe/src/BrowserWindowCheck.java','probe/src/KeyboardCheck.java','probe/src/BrowserTools.java','probe/src/SettingsActivity.java','probe/src/SettingsCheck.java','probe/src/PageCheck.java','probe/src/EvaUi.java','probe/src/ShellActivity.java','probe/src/McpOAuth.java','probe/src/McpOAuthActivity.java','probe/src/McpOAuthCheck.java','probe/src/AndroidBuildActivity.java','probe/src/ApkInstallProvider.java','probe/src/ApkInstallCheck.java','probe/src/AttachmentImportCheck.java','probe/src/BrowserTransfersCheck.java','probe/src/DesktopStreamCheck.java','probe/src/DesktopStreamFixtureActivity.java','probe/src/UiStateStore.java','probe/src/SkillStore.java','probe/src/SkillImportProbe.java','probe/src/McpSettings.java','probe/src/HookStore.java','probe/src/ExtensionCheck.java','probe/src/ExtensionAuthoring.java','probe/src/ExtensionIconCache.java','probe/src/ExtensionMediaCheck.java','probe/src/McpCredentialActivity.java','probe/src/MemoryStore.java','probe/src/DataBackupActivity.java','probe/src/DataBackupProbe.java','probe/src/DataBackupStore.java','probe/src/DataBackupArchive.java','probe/src/WorkspaceFiles.java','probe/src/GeneratedImages.java','probe/src/WorkspaceCheck.java','probe/src/KernelHost.java','probe/src/FullAccessApprovals.java','probe/src/ScheduledTaskHost.java','probe/src/ScheduledTaskCheck.java','probe/src/ScheduledTaskActivity.java','probe/src/ScheduledTaskService.java','probe/src/ScheduledTaskReceiver.java','probe/src/ThreadRecovery.java','probe/src/ThreadActivitySummary.java','probe/src/LinuxRuntime.java','probe/src/RuntimeBootstrap.java','probe/src/RuntimeArchive.java','probe/src/RuntimeBootstrapCheck.java','probe/src/RuntimeSetupActivity.java','probe/src/RuntimeSetupService.java','probe/src/PhoneAgentPreview.java','probe/src/PhoneAgentPreviewCheck.java','probe/src/RuntimeAuthoringCheck.java','probe/src/Java21RuntimeCheck.java','probe/src/KernelTrace.java','probe/src/KernelModelCatalog.java','probe/src/PhoneAccessibility.java','probe/src/PhoneTools.java','probe/src/PhoneBatch.java','probe/src/PhoneRouteStore.java','probe/src/PhoneRouteTools.java','probe/src/PhoneRouteCheck.java','probe/src/PhoneResourceScheduler.java','probe/src/PhoneResourceSchedulerCheck.java','probe/src/PhoneBatchCheck.java','probe/src/PhoneAgentDisplay.java','probe/src/PhoneAgentDisplayCheck.java','probe/src/BrowserOwnership.java','probe/src/BrowserOwnershipCheck.java','probe/src/BrowserHandoverDeviceCheck.java','probe/src/PacketSummary.java','probe/src/ApkInventory.java','probe/src/NetworkCaptureService.java','probe/src/NetworkCaptureActivity.java','probe/src/NetworkTools.java','probe/src/NetworkCaptureSession.java','probe/src/NetworkCaptureControlActivity.java','probe/src/NetworkCaptureDependencies.java','probe/src/NetworkMitmCertificate.java','probe/src/HttpCaptureSummary.java','probe/src/NetworkCaptureCheck.java','probe/src/WechatPolicy.java','probe/src/WechatFlow.java','probe/src/PhoneAppActions.java','probe/src/PhonePerformanceCheck.java','probe/src/PhoneOwnershipCheck.java','probe/src/ProviderConnectionCheck.java','probe/src/PhoneTaskReport.java','probe/src/PhoneFixtureActivity.java','probe/src/PhoneCheck.java','probe/src/PhoneObservationCheck.java','probe/src/PhoneFocusedInputCheck.java','probe/src/PhoneSelfCheck.java','probe/src/PhoneShell.java','probe/src/PhoneShellService.java','probe/src/PhoneTaskService.java','probe/src/PhoneRecovery.java','probe/src/PhoneControlActivity.java','probe/src/KernelNetwork.java','probe/src/AccountCheck.java','probe/src/AccountState.java','probe/src/AccountStateCheck.java','probe/src/AccountReadCheck.java','probe/src/KernelCheck.java','probe/src/ProviderSwitchCheck.java','probe/src/ProviderSwitch.java','probe/src/ProviderHistoryProjection.java','probe/src/ModelCheck.java','probe/src/ModelStore.java','probe/src/ModelClient.java','probe/src/ModelsActivity.java','probe/src/AccountActivity.java','probe/src/LoginService.java','probe/src/AccountQuota.java','probe/src/QuotaCheck.java','probe/src/CredentialPasteCheck.java','probe/third_party/androidx/core/util/Pair.java','probe/third_party/androidx/core/util/ObjectsCompat.java')
Run jar @('--create','--file','probe/build/classes.jar','-C','probe/build/classes','.')
Run "$bt\d8.bat" (@('--lib',$platform,'--min-api','28','--output','probe/build/dex','probe/build/classes.jar') + $libraries)
Run "$bt\aapt2.exe" @('compile','--dir','probe/res','-o','probe/build/resources.zip')
$manifestPath = 'probe/AndroidManifest.xml'
if ($Release -or $ApplicationId -ne 'ai.eva.android.probe') {
    if ($ApplicationId -notmatch '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$') { throw 'Invalid application ID' }
    $manifest = Get-Content -LiteralPath 'probe/AndroidManifest.xml' -Raw -Encoding UTF8
    $manifest = [regex]::Replace($manifest, 'android:name="\.([^"]+)"', 'android:name="ai.eva.android.probe.$1"')
    $manifest = $manifest.Replace('package="ai.eva.android.probe"', 'package="' + $ApplicationId + '"')
    $manifest = $manifest.Replace('android:authorities="ai.eva.android.probe', 'android:authorities="' + $ApplicationId)
    $manifest = $manifest.Replace('android:targetPackage="ai.eva.android.probe"', 'android:targetPackage="' + $ApplicationId + '"')
    $manifest = $manifest.Replace('android:label="Eva Android 开发版"', 'android:label="Eva 新装验收"')
    if ($Release) {
        $manifest = $manifest.Replace('android:debuggable="true"','android:debuggable="false"')
        $manifest = $manifest.Replace('android:label="Eva 新装验收"','android:label="Eva Android"')
        $manifest = [regex]::Replace($manifest, '<instrumentation\b[^>]*/>', '')
    }
    $manifestPath = 'probe/build/bootstrap-check-manifest.xml'
    [IO.File]::WriteAllText((Join-Path $root $manifestPath), $manifest, [Text.UTF8Encoding]::new($false))
}
Run "$bt\aapt2.exe" @('link','-0','onnx','-0','gz','-I',$platform,'--manifest',$manifestPath,'probe/build/resources.zip','-A','probe/assets','-o','probe/build/base.apk')
Run python @('tools/normalize-apk-assets.py','probe/build/base.apk')
Copy-Item probe/build/base.apk probe/build/unsigned.apk -Force
Push-Location probe/build/dex
try { Run "$bt\aapt.exe" @('add','../unsigned.apk','classes.dex') } finally { Pop-Location }
Push-Location probe/native
try { Run "$bt\aapt.exe" @('add','../build/unsigned.apk','lib/arm64-v8a/liboperit_proot.so','lib/arm64-v8a/liboperit_loader.so','lib/arm64-v8a/libsherpa-onnx-jni.so','lib/arm64-v8a/libonnxruntime.so') } finally { Pop-Location }
Run "$bt\zipalign.exe" @('-f','4','probe/build/unsigned.apk','probe/build/aligned.apk')
if (!$Release -and !(Test-Path probe/build/debug.keystore)) {
    Run keytool @('-genkeypair','-keystore','probe/build/debug.keystore','-storepass','android','-keypass','android','-alias','androiddebugkey','-dname','CN=Eva Android Probe','-keyalg','RSA','-validity','3650')
}
if ($Release) {
    Run "$bt\apksigner.bat" @('sign','--ks',$env:EVA_RELEASE_KEYSTORE,'--ks-key-alias',$env:EVA_RELEASE_KEY_ALIAS,'--ks-pass','env:EVA_RELEASE_STORE_PASSWORD','--key-pass','env:EVA_RELEASE_KEY_PASSWORD','--out','probe/build/eva-probe.apk','probe/build/aligned.apk')
} else {
    Run "$bt\apksigner.bat" @('sign','--ks','probe/build/debug.keystore','--ks-pass','pass:android','--out','probe/build/eva-probe.apk','probe/build/aligned.apk')
}
Run "$bt\apksigner.bat" @('verify','probe/build/eva-probe.apk')





