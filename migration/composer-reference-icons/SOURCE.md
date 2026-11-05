# Capability chooser artwork

Desktop sources were inspected before adapting the Android chooser on 2026-11-05.

- `/Users/jevin/Documents/Codex/Eva-Source/src/renderer/customize.js`, `customizeIcon` at line 88. SHA-256 `d925f91f221fe0f6d6bc2aa783aa9e3a9bbabd97332002a2709938161acee3bd`.
- `/Users/jevin/Documents/Codex/Eva-Source/src/renderer/render.js`, reference icon selection at line 654. SHA-256 `606eacdbeeddb3dcadd332e675a02944c359d483704d304cad0057f3683fc579`.

The adaptation retains the desktop interface-field lookup, local artwork preference, decorative fallback and image-load visibility pattern. The Android chooser uses composer artwork first for plugins and small artwork first for skills. It tries all supported local candidates before remote candidates. Remote HTTPS artwork uses `/extension-icon` with an encoded URL and plugin localVersion/version revision. The native host owns durable cache storage. Local artwork uses `/extension-media`.

Skill relative artwork is resolved beneath the directory containing SKILL.md. A relative candidate that traverses outside that directory is ignored. Plugin artwork can resolve beneath an explicit absolute plugin path when the response supplies one. The captured installed-plugin responses have no installation-path field, so relative plugin artwork without a supplied root is ignored. No cache path is guessed from plugin IDs or marketplace names. Current installed-plugin remote artwork and absolute skill artwork are supported.

Theme-specific candidates are tried ahead of their corresponding defaults. A failed image tries the next candidate, then leaves its generic fallback visible. Reopening or refreshing creates a new attempt, without persistent negative caching. Theme changes update artwork without reloading the capability catalog. Selecting a capability preserves the existing skill/mention dispatch protocol.

This is a source adaptation within the existing project. It adds no third-party package or new vendor license obligation.
