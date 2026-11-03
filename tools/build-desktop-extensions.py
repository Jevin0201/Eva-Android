from pathlib import Path
root=Path(__file__).resolve().parent.parent
parts=[root/'migration/desktop-extensions'/n for n in ['android-head.js','adapted-renderer.js','android-tail.js']]
(root/'probe/assets/desktop-extensions.js').write_text(''.join(p.read_text(encoding='utf-8') for p in parts),encoding='utf-8')
