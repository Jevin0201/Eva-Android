Add-Type -AssemblyName System.Speech
$folder=Join-Path $PSScriptRoot '../artifacts/voice-variants'
New-Item -ItemType Directory -Force $folder | Out-Null
$synth=New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoice('Microsoft Huihui Desktop')
$fmt=New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000,[System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,[System.Speech.AudioFormat.AudioChannel]::Mono)
$phrases=@('你好艾瓦','你好艾娃','你好爱娃','你好埃瓦','你好伊娃')
for($i=0;$i -lt $phrases.Count;$i++){foreach($rate in @(-1,1)){$synth.Rate=$rate;$synth.SetOutputToWaveFile((Join-Path $folder "yes-$i-$rate.wav"),$fmt);$synth.Speak($phrases[$i]);$synth.SetOutputToNull()}}
$phrases=@('你好小王','今天的天气怎么样','帮我打开相册','我爱我的家','你好大家好')
$synth.Rate=0
for($i=0;$i -lt $phrases.Count;$i++){$synth.SetOutputToWaveFile((Join-Path $folder "no-$i.wav"),$fmt);$synth.Speak($phrases[$i]);$synth.SetOutputToNull()}
$synth.Dispose()
