param([string]$Serial)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$adb = (Get-Command adb -ErrorAction Stop).Source
$devices = @(& $adb devices)
if ($LASTEXITCODE -ne 0) { throw 'ADB devices failed.' }
$ready = @($devices | Where-Object { $_ -match '^\S+\s+device$' } | ForEach-Object { ($_ -split '\s+')[0] })
if (!$Serial) {
    if ($ready.Count -ne 1) { throw "Connect and authorize exactly one device, or pass -Serial. ADB output: $($devices -join '; ')" }
    $Serial = $ready[0]
}
if ($Serial -notin $ready) { throw 'Selected device is not connected and authorized.' }
function Read-Device([string[]]$Arguments) {
    $result = & $adb -s $Serial @Arguments
    if ($LASTEXITCODE -ne 0) { throw "ADB failed: $Arguments" }
    return ($result -join "`n").Trim()
}
$report = [ordered]@{
    checkedAt = (Get-Date).ToString('o')
    model = Read-Device @('shell', 'getprop', 'ro.product.model')
    android = Read-Device @('shell', 'getprop', 'ro.build.version.release')
    sdk = Read-Device @('shell', 'getprop', 'ro.build.version.sdk')
    abi = Read-Device @('shell', 'getprop', 'ro.product.cpu.abilist')
    kernel = Read-Device @('shell', 'uname', '-a')
    dataStorage = Read-Device @('shell', 'df', '-h', '/data')
    webview = Read-Device @('shell', 'dumpsys', 'webviewupdate')
    scope = 'Device inventory only; no Eva runtime or product acceptance performed.'
}
$out = Join-Path $root 'artifacts'
New-Item -ItemType Directory -Force $out | Out-Null
$report | ConvertTo-Json -Depth 4 | Set-Content -Encoding utf8 (Join-Path $out 'device-environment.json')
$report | ConvertTo-Json -Depth 4
