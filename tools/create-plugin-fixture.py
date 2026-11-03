"""Own minimal plugin fixture; run inside Eva via tools/device-python.py stdin.

No third-party code or external service; only writes the dedicated acceptance folder.
"""
from pathlib import Path
import json

root = Path('/root/eva-workspace/projects/plugin-acceptance')
(root / '.git').mkdir(parents=True, exist_ok=True)
catalog = root / '.agents/plugins/marketplace.json'
catalog.parent.mkdir(parents=True, exist_ok=True)
catalog.write_text(json.dumps({
    'name': 'eva-android-acceptance',
    'plugins': [{'name': 'eva-acceptance-plugin',
                 'source': {'source': 'local', 'path': './eva-acceptance-plugin'}}]
}, indent=2), encoding='utf-8')
plugin = root / 'eva-acceptance-plugin'
(plugin / '.codex-plugin').mkdir(parents=True, exist_ok=True)
(plugin / '.codex-plugin/plugin.json').write_text(json.dumps({
    'name': 'eva-acceptance-plugin',
    'version': '1.0.0',
    'description': 'Local Android plugin acceptance fixture'
}), encoding='utf-8')
skill = plugin / 'skills/eva-plugin-acceptance/SKILL.md'
skill.parent.mkdir(parents=True, exist_ok=True)
skill.write_text('''---
name: eva-plugin-acceptance
description: Use only when the user explicitly requests Eva Android plugin acceptance.
---
For the explicit acceptance request, reply exactly: EVA_PLUGIN_SKILL_7391
Do not invoke tools or modify files.
''', encoding='utf-8')
print(json.dumps({'cwd': str(root), 'marketplacePath': str(catalog), 'pluginName': 'eva-acceptance-plugin'}))
