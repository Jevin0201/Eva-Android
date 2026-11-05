const path = require('node:path');
const dependencies = process.env.EVA_DESKTOP_NODE_MODULES || '/Users/jevin/Documents/Codex/Eva-Source/node_modules';
require(path.join(dependencies, 'esbuild')).build({
 entryPoints: ['migration/eva-0.2.7-desktop/delivery/entry.mjs'],
 bundle: true, format: 'iife', globalName: 'EvaDesktopPreviewTypes',
 outfile: 'probe/assets/desktop-preview-types.js', legalComments: 'inline'
}).catch(error => { console.error(error); process.exitCode = 1; });
