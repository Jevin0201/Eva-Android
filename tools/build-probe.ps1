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
$javaSources = @(Get-ChildItem probe/src,probe/third_party -Recurse -Filter *.java | ForEach-Object FullName)
Run javac (@('-encoding','UTF-8','--release','8','-classpath',$compilePath,'-d','probe/build/classes') + $javaSources)
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





