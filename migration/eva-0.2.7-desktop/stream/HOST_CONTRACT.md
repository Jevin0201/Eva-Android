# Desktop stream host contract

`desktop-stream-renderer.js` exports `window.EvaDesktopStream.create(host)`. Source closures include all of desktop util.js, i18n.js, icons.js, composer-input.js, conversation-failures.js, render.js and transcript-dom.js. The only runtime overrides are mediaUrl/transcriptLink supplied by Android. No eval or global render replacement is used.

Load order is desktop-stream/native-transcript/original-core.js, activity-core.js, statistics-core.js, disclosure-core.js, host.js; desktop-stream/native-steering/bootstrap.js then bundle.js; desktop-stream-renderer.js. Existing old native transcript globals are replaced by current desktop equivalents. Load the renderer factory only after these globals are ready.

Required host fields for per-turn rendering are state, els, api, workTimer and workDuration. State is a mutable desktop-shaped view whose thread and activeThreadId match the current Android chat. Initialize plans, diffs, turnConnections as Maps, expanded and viewedLinks as Sets, approvals as an array, productMode as `codex`, cwd and meta.codexHome from Android kernel data. Optional fields are composerMentions, ephemeral, sideChatEphemeral, settingsData and account quota state.

`host.els` contains transcript=the real flow element, threadScroll=flow, outputPane when rendering file sidebar. The full desktop renderTranscript additionally needs scroll/layout host methods. Android should use renderTurn/renderTurns and patchTranscriptDOM directly while retaining its paged history acquisition and touch scroll policy.

`host.api` supplies the desktop bridge methods used by native-steering. Missing methods should reject with an explicit unavailable error. It must implement local media/preview/open/copy services through Android, not desktop APIs. `host.mediaUrl(path)` should resolve Android's /generated-image endpoint. `host.transcriptLink` is the Android path/external URL resolver. WorkTimer supplies label/refresh, workDuration supplies format.

Additional host helpers are renderAgentActivity (Android subagent UI or migrated desktop renderer), transcriptBackgroundAgents (function returning current real agents), newChatProjectName, customizePlugins/customizeSkills, renderComposer/renderTabs/renderOverlay, renderSubagentLauncher/renderUnassignedBackgroundAgents, renderTranscriptNavigator/loadMoreThreads/refreshThreads. Per-turn ordinary text, commands, file changes, images, MCP and dynamic-tool rendering do not need navigation helpers. Omitted helpers must only be called by the feature whose actual host is wired.

Public API includes renderTurn(turn,false), renderTurns(turns), patchTranscriptDOM(flow,html,threadId,chunks), renderThinking, shouldShowThinking, activityDisposition, renderItem, renderTurnArtifacts, renderWorkActivity and setExpanded(id,expanded). Completed chunks may be cached with a version incorporating changes to state.expanded, plan/diff and native async presentation. Never cache by turn ID alone.

On enabling the mode, call evaCodexMessages.disable() followed by evaOriginalActivity.disable(). The first preserves composer icon painting but stops old message hydration. The second disconnects old body/theme observers and unmounts all owned React roots. Both methods gate already queued microtasks. Then mark flow `.desktop-stream-host`. All old mobileBlocks, EvaFlowProjection, mobileFlow rendering and old transcript patching must be bypassed for this root. The desktop patch owns keyed nodes and skips native-user-input/native-owned-light-dom subtrees, then centrally hydrates current native hosts.

`desktop-stream-layout.css` is desktop styles.css and codex-chat-layout.css scoped to .desktop-stream-host. Native-steering bundle owns its component CSS in ShadowRoots. Its app://bundle/native-steering/assets URLs are the sole bundle adaptation and map to https://eva.invalid/desktop-stream/native-steering/assets/. The same desktop asset files are copied beneath that prefix. Native white-list must serve font MIME types and allow font-src self.

## Original image component RPC

Upload thumbnails, Markdown local images and imageView tools retain their original local source paths. They do not all call the renderer's mediaUrl helper. Load desktop-stream-image-bridge.js before the steering component initializes. It listens only to same-window, same-origin `connect-app-host` messages carrying one MessagePort. The original CapnWeb codec connects `{workspaceFiles}` through that port. The client's `workspaceFiles.readBinary({path,hostId,conversationId,environmentId,maxBytes})` resolves to `{contentsBase64,mimeType}` or `{contentsBase64:null}`. No JSON message framing is invented.

The Android service allows validated /root/eva-workspace image paths and fetches the existing native /generated-image route. That route validates actual image bytes. Both the native route's 25MiB ceiling and the request's maxBytes ceiling apply. Browser CSP must allow connect-src self, img-src self data: blob: https:, and font-src self data:. The bridge never forwards arbitrary local paths or external URLs through this service.

Load desktop-stream/native-image-preview/bootstrap.js before native-steering/bundle.js. The imported tool-adapter calls its ready method during bundle initialization. This enables original imageView activity roots and original preview lifecycle tracking. Uploaded galleries continue through mountOriginalUploadedImages, and use the same workspace RPC without a hand-written img substitute.

This initial service implements image reads. Desktop saveStream, clipboard image writes and remote cloud downloads require separate Android host actions. They must be reported as unavailable until wired and tested. The read-only bridge does not imply those actions are complete.

Browser regression `tools/test-desktop-image-bridge.cjs` exercises the real original CapnWeb client/server across transferred MessagePorts, verifies binary/MIME integrity, and checks maxBytes and traversal rejection. It uses a controlled local PNG fixture, independent of Android native route decoding already validated separately.

## ESM and highlighting dependencies

The steering bundle is an ES module and statically imports ../native-image-preview/tool.js. The host must await its ESM import before creating or painting the desktop renderer. tool.js has no static module dependency. common.js is the separate public common-preview module. Both original compiled files have been copied from the desktop source.

Fenced code triggers the original highlight-code dynamic dependency graph. The desktop's highlighter/core/runtime/shims/pierre/lodash/browser modules and CSS are now present beneath native-steering. KaTeX lazy modules and existing local assets are included. The source snapshot does not contain the requested highlight-code.worker-8b9c2c34b23e.js. The Android bundle therefore initializes the original highlighter queue's worker-disabled flag PGn=true and directly uses its existing asynchronous main-thread fallback. This is the single worker capability adaptation, not a replacement highlighting implementation. Worker execution remains a separate future integration.

`tools/test-desktop-image-ui.cjs` exercises the complete real index with ESM dependency loading, original uploaded gallery and imageView activity, command expansion, local PNG fetch via the original CapnWeb client, fenced JavaScript, math text and the original preview dialog. The fixture collects every 404 response path. Current result is no page errors and no missing resources. It supplies bootstrap/bridge/module attributes only when absent while the shared index is being integrated.

## Disclosure lifecycle

Load desktop-stream-disclosure.js before desktop-stream-host.js. Create the original lifecycle with `EvaDesktopDisclosure.create({state,els,renderTranscript})`, then assign that returned object to the current mode's window.activityDisclosure. `state.expanded` is the injected Set, and `els.threadScroll` is the real Android scroll container. `renderTranscript` repaints the current desktop flow through the host. The factory never writes window.state. The original toggle/hydrate/anchor/animation/summary functions stay intact, with only stateStore changed to use the injected state exclusively.

The original 180ms expansion animation, 1000ms active-summary throttling, 350ms resize anchor lifetime, closing content lifetime and disconnected-owner cleanup are retained. The dedicated browser regression verifies actual animation timing and state transitions, throttled summary text, content lifetime and isolation from a global-state sentinel. The complete image/command index test additionally verifies the factory is wired while opening real component details.

## Isolated Android renderer instrumentation

DesktopStreamCheck starts the non-exported DesktopStreamFixtureActivity and waits at most 120 seconds for an eva-stream-check/result report. The fixture constructs synthetic 24-turn history, loads the same packaged index and injects desktop-stream-check.js before app.js. Its EvaHost bridge discards saves, returns fixture metadata and synthetic empty read acknowledgements, and never constructs KernelHost or UiStateStore. Packaged eva.invalid resources are served through a dedicated WebViewClient. External resources and path escapes are rejected. The fixture finishes itself after reporting and destroys its WebView.

The test-only script is never loaded by the production index. It shares the pressure callback extracted from tools/test-desktop-streaming-ui.cjs, drives 540 text/code and tool deltas at 16ms intervals in 150ms batches, records actual rendering frames and update durations, and strongly checks flow/assistant/shadow identity, blank frames, fragment monotonicity, model contents, latest tool output, reading position and bottom-follow behavior. It adds p95/max frame intervals and a 100ms p95 frame-interval gate. Lazy nested details are opened with a bounded 5-second wait for the original components and animations to expose the latest output.

API36 Java compilation passed. tools/test-packaged-stream-fixture.cjs validates the same test-only asset's complete browser startup and returned report. The first browser report passed with zero blank/rebuilt/regressing frames, all 541 fragments, visible latest tool output, zero reading drift and zero bottom gap. These are browser results. Android instrumentation execution remains for the main agent's controlled device verification.

The temporary tmp/desktop-stream-check-classes directory contained only classes generated by the local javac verification, was checked at its absolute project path and removed. Java sources, the pressure asset, browser regression and source records remain for building and repeated verification.
