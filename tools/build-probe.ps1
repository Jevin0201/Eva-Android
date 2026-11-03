param([string]$Sdk = "$env:LOCALAPPDATA\Android\Sdk")
$ErrorActionPreference = 'Stop'
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
Run javac @('-encoding','UTF-8','--release','8','-classpath',$compilePath,'-d','probe/build/classes','probe/src/VoiceModels.java','probe/src/VoiceCheck.java','probe/src/VoiceText.java','probe/src/VoiceCommandPolicy.java','probe/src/VoiceAudio.java','probe/src/VoiceAgent.java','probe/src/VoiceIsland.java','probe/src/VoiceService.java','probe/src/VoiceActivity.java','probe/src/MainActivity.java','probe/src/EvaActivity.java','probe/src/LocalToolsActivity.java','probe/src/ToolPageActivity.java','probe/src/TerminalActivity.java','probe/src/FilesActivity.java','probe/src/WorkspaceEditor.java','probe/src/WorkspaceEditingProbe.java','probe/src/WorkspaceEditorUiProbe.java','probe/src/OfficeRuntime.java','probe/src/OfficeActivity.java','probe/src/WorkspaceGit.java','probe/src/WorkspaceGitProbe.java','probe/src/GitActivity.java','probe/src/WorkspaceEditActivity.java','probe/src/WorkspacePreviewActivity.java','probe/src/BrowserActivity.java','probe/src/BrowserWindow.java','probe/src/BrowserTransfers.java','probe/src/BrowserTransfersProbe.java','probe/src/BrowserSitePermissions.java','probe/src/BrowserWindowCheck.java','probe/src/KeyboardCheck.java','probe/src/BrowserTools.java','probe/src/SettingsActivity.java','probe/src/SettingsCheck.java','probe/src/PageCheck.java','probe/src/EvaUi.java','probe/src/ShellActivity.java','probe/src/SkillStore.java','probe/src/SkillImportProbe.java','probe/src/McpSettings.java','probe/src/HookStore.java','probe/src/ExtensionCheck.java','probe/src/McpCredentialActivity.java','probe/src/MemoryStore.java','probe/src/DataBackupActivity.java','probe/src/DataBackupProbe.java','probe/src/DataBackupStore.java','probe/src/DataBackupArchive.java','probe/src/WorkspaceFiles.java','probe/src/WorkspaceCheck.java','probe/src/KernelHost.java','probe/src/KernelTrace.java','probe/src/KernelModelCatalog.java','probe/src/PhoneAccessibility.java','probe/src/PhoneTools.java','probe/src/PhoneAppActions.java','probe/src/PhonePerformanceCheck.java','probe/src/PhoneOwnershipCheck.java','probe/src/ProviderConnectionCheck.java','probe/src/PhoneTaskReport.java','probe/src/PhoneFixtureActivity.java','probe/src/PhoneCheck.java','probe/src/PhoneObservationCheck.java','probe/src/PhoneFocusedInputCheck.java','probe/src/PhoneSelfCheck.java','probe/src/PhoneShell.java','probe/src/PhoneShellService.java','probe/src/PhoneTaskService.java','probe/src/PhoneRecovery.java','probe/src/PhoneControlActivity.java','probe/src/KernelNetwork.java','probe/src/AccountCheck.java','probe/src/AccountState.java','probe/src/AccountStateCheck.java','probe/src/AccountReadCheck.java','probe/src/KernelCheck.java','probe/src/ModelCheck.java','probe/src/ModelStore.java','probe/src/ModelClient.java','probe/src/ModelsActivity.java','probe/src/AccountActivity.java','probe/src/LoginService.java','probe/src/AccountQuota.java','probe/src/QuotaCheck.java','probe/src/CredentialPasteCheck.java','probe/third_party/androidx/core/util/Pair.java','probe/third_party/androidx/core/util/ObjectsCompat.java')
Run jar @('--create','--file','probe/build/classes.jar','-C','probe/build/classes','.')
Run "$bt\d8.bat" (@('--lib',$platform,'--min-api','28','--output','probe/build/dex','probe/build/classes.jar') + $libraries)
Run "$bt\aapt2.exe" @('compile','--dir','probe/res','-o','probe/build/resources.zip')
Run "$bt\aapt2.exe" @('link','-0','onnx','-I',$platform,'--manifest','probe/AndroidManifest.xml','probe/build/resources.zip','-A','probe/assets','-o','probe/build/base.apk')
Run python @('tools/normalize-apk-assets.py','probe/build/base.apk')
Copy-Item probe/build/base.apk probe/build/unsigned.apk -Force
Push-Location probe/build/dex
try { Run "$bt\aapt.exe" @('add','../unsigned.apk','classes.dex') } finally { Pop-Location }
Push-Location probe/native
try { Run "$bt\aapt.exe" @('add','../build/unsigned.apk','lib/arm64-v8a/liboperit_proot.so','lib/arm64-v8a/liboperit_loader.so','lib/arm64-v8a/libsherpa-onnx-jni.so','lib/arm64-v8a/libonnxruntime.so') } finally { Pop-Location }
Run "$bt\zipalign.exe" @('-f','4','probe/build/unsigned.apk','probe/build/aligned.apk')
if (!(Test-Path probe/build/debug.keystore)) {
    Run keytool @('-genkeypair','-keystore','probe/build/debug.keystore','-storepass','android','-keypass','android','-alias','androiddebugkey','-dname','CN=Eva Android Probe','-keyalg','RSA','-validity','3650')
}
Run "$bt\apksigner.bat" @('sign','--ks','probe/build/debug.keystore','--ks-pass','pass:android','--out','probe/build/eva-probe.apk','probe/build/aligned.apk')
Run "$bt\apksigner.bat" @('verify','probe/build/eva-probe.apk')





