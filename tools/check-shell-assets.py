"""Verify that the Android host serves every local entry-point script and stylesheet."""

from html.parser import HTMLParser
from pathlib import Path


class Assets(HTMLParser):
    def __init__(self):
        super().__init__()
        self.paths = set()

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        path = attrs.get("src") if tag == "script" else None
        if tag == "link" and attrs.get("rel") == "stylesheet":
            path = attrs.get("href")
        if path and not path.startswith(("https:", "http:", "data:")):
            self.paths.add(path.split("?", 1)[0].lstrip("/"))


root = Path(__file__).resolve().parents[1]
parser = Assets()
parser.feed((root / "probe/assets/index.html").read_text(encoding="utf-8"))
host = (root / "probe/src/ShellActivity.java").read_text(encoding="utf-8")
errors = []
for path in sorted(parser.paths):
    if not (root / "probe/assets" / path).is_file():
        errors.append(f"Missing asset: {path}")
    if f'path.equals("/{path}")' not in host:
        errors.append(f"Android host does not serve: {path}")
if errors:
    raise SystemExit("\n".join(errors))
print(f"PASS {len(parser.paths)} Android entry-point assets")
