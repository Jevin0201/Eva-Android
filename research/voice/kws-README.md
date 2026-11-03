---
license: apache-2.0
language:
- zh
- en
tags:
- keyword-spotting
- sherpa-onnx
- sherpaw
- onnx
- webassembly
---

# sherpa-onnx-kws-zipformer-zh-en-3M-2025-12-20

Unmodified upstream fp32 chunk-16, left-context-64 KWS model, packaged for [Sherpaw](https://github.com/moeru-ai/sherpaw). Weights and tokens come from the [official sherpa-onnx release](https://github.com/k2-fsa/sherpa-onnx/releases/download/kws-models/sherpa-onnx-kws-zipformer-zh-en-3M-2025-12-20.tar.bz2); the [original model by pkufool](https://modelscope.cn/models/pkufool/icefall-kws-zipformer-zh-en-3M-2025-12-20) declares Apache-2.0.

## Files and usage

`install/bin/wasm/` contains `preload.data`, `preload.js`, and `preload.js.metadata`. The pack has four virtual files: `/encoder.onnx`, `/decoder.onnx`, `/joiner.onnx`, and `/tokens.txt`. Download the data and metadata, then call `loadData({ module, data, metadata })` from `@sherpaw/preloader` before creating `@sherpaw/kws`'s keyword spotter with those file names. Use the separately built KWS WASM runtime. No audio recordings or keyword vocabulary are included.

The pack contains 13,076,183 bytes. `manifest.json` records artifact hashes. Pin the Hugging Face commit when deploying.

## Reproduce

Run `./build.sh` with Docker available. It calls `download.sh` (verifies each source file's SHA-256) and `pack.sh` (Emscripten 4.0.23 file packager). No model conversion, quantization, training or keyword compilation is performed. This matches Sherpaw's other standalone runtime and preload model packages.

## Limitations

Callers provide encoded model tokens and mono PCM. Pronunciation, noise, vocabulary and thresholds affect misses and false triggers; upstream sample detections do not establish accuracy for arbitrary wake words. See [upstream KWS documentation](https://k2-fsa.github.io/sherpa/onnx/kws/pretrained_models/index.html). Japanese is unverified.
