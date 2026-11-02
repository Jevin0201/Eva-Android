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
$libraries = @(Get-ChildItem probe/libs -Filter *.jar | ForEach-Object FullName)
$compilePath = (@($platform) + $libraries) -join ';'
Run javac @('-encoding','UTF-8','--release','8','-classpath',$compilePath,'-d','probe/build/classes','probe/src/MainActivity.java','probe/src/EvaActivity.java','probe/src/LocalToolsActivity.java','probe/src/ToolPageActivity.java','probe/src/TerminalActivity.java','probe/src/FilesActivity.java','probe/src/BrowserActivity.java','probe/src/BrowserTools.java','probe/src/SettingsActivity.java','probe/src/SettingsCheck.java','probe/src/PageCheck.java','probe/src/EvaUi.java','probe/src/ShellActivity.java','probe/src/WorkspaceFiles.java','probe/src/WorkspaceCheck.java','probe/src/KernelHost.java','probe/src/PhoneAccessibility.java','probe/src/PhoneTools.java','probe/src/PhoneTaskReport.java','probe/src/PhoneFixtureActivity.java','probe/src/PhoneCheck.java','probe/src/PhoneSelfCheck.java','probe/src/PhoneShell.java','probe/src/PhoneShellService.java','probe/src/PhoneTaskService.java','probe/src/PhoneRecovery.java','probe/src/PhoneControlActivity.java','probe/src/KernelNetwork.java','probe/src/AccountCheck.java','probe/src/KernelCheck.java','probe/src/ModelCheck.java','probe/src/ModelStore.java','probe/src/ModelClient.java','probe/src/ModelsActivity.java','probe/src/AccountActivity.java','probe/src/LoginService.java','probe/src/AccountQuota.java','probe/src/QuotaCheck.java','probe/src/CredentialPasteCheck.java','probe/third_party/androidx/core/util/Pair.java','probe/third_party/androidx/core/util/ObjectsCompat.java')
$classes = @(Get-ChildItem probe/build/classes -Recurse -Filter *.class | ForEach-Object FullName)
Run "$bt\d8.bat" (@('--lib',$platform,'--min-api','28','--output','probe/build/dex') + $classes + $libraries)
Run "$bt\aapt2.exe" @('compile','--dir','probe/res','-o','probe/build/resources.zip')
Run "$bt\aapt2.exe" @('link','-I',$platform,'--manifest','probe/AndroidManifest.xml','probe/build/resources.zip','-A','probe/assets','-o','probe/build/base.apk')
Copy-Item probe/build/base.apk probe/build/unsigned.apk -Force
Push-Location probe/build/dex
try { Run "$bt\aapt.exe" @('add','../unsigned.apk','classes.dex') } finally { Pop-Location }
Push-Location probe/native
try { Run "$bt\aapt.exe" @('add','../build/unsigned.apk','lib/arm64-v8a/liboperit_proot.so','lib/arm64-v8a/liboperit_loader.so') } finally { Pop-Location }
Run "$bt\zipalign.exe" @('-f','4','probe/build/unsigned.apk','probe/build/aligned.apk')
if (!(Test-Path probe/build/debug.keystore)) {
    Run keytool @('-genkeypair','-keystore','probe/build/debug.keystore','-storepass','android','-keypass','android','-alias','androiddebugkey','-dname','CN=Eva Android Probe','-keyalg','RSA','-validity','3650')
}
Run "$bt\apksigner.bat" @('sign','--ks','probe/build/debug.keystore','--ks-pass','pass:android','--out','probe/build/eva-probe.apk','probe/build/aligned.apk')
Run "$bt\apksigner.bat" @('verify','probe/build/eva-probe.apk')





