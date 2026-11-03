const fs=require('fs');(async()=>{for(const [url,name]of [
['https://raw.githubusercontent.com/microsoft/onnxruntime/v1.28.2/ThirdPartyNotices.txt','onnxruntime-ThirdPartyNotices.txt'],
['https://raw.githubusercontent.com/csukuangfj/kaldi-native-fbank/v1.22.4/LICENSE','kaldi-native-fbank-Apache-2.0.txt'],
['https://raw.githubusercontent.com/k2-fsa/kaldi-decoder/v0.3.0/LICENSE','kaldi-decoder-Apache-2.0.txt'],
['https://raw.githubusercontent.com/pkufool/simple-sentencepiece/v0.7/LICENSE','simple-sentencepiece-Apache-2.0.txt'],
['https://raw.githubusercontent.com/JuliaStrings/utf8proc/v2.12.0/LICENSE.md','utf8proc-MIT.txt']]){let r=await fetch(url);console.log(name,r.status);if(r.ok)fs.writeFileSync('probe/assets/voice/licenses/'+name,await r.text())}})()
