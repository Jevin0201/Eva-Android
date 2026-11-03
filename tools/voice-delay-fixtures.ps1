Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoice('Microsoft Huihui Desktop')
$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000,[System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,[System.Speech.AudioFormat.AudioChannel]::Mono)
$synth.SetOutputToWaveFile((Join-Path $PSScriptRoot '../artifacts/voice-wake.wav'),$fmt)
$synth.Speak('你好艾瓦。')
$synth.SetOutputToNull()
$synth.SetOutputToWaveFile((Join-Path $PSScriptRoot '../artifacts/voice-command.wav'),$fmt)
$synth.Speak('打开相册。')
$synth.SetOutputToNull()
$synth.SetOutputToWaveFile((Join-Path $PSScriptRoot '../artifacts/voice-fragment.wav'),$fmt)
$synth.Speak('我想让你。')
$synth.Dispose()
