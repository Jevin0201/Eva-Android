"""Windows aapt2 may emit backslashes for nested assets. Android requires '/'."""
import sys
import zipfile
from pathlib import Path

source = Path(sys.argv[1])
temporary = source.with_suffix('.normalized.apk')
seen = set()
with zipfile.ZipFile(source) as original, zipfile.ZipFile(temporary, 'w') as output:
    for entry in original.infolist():
        name = entry.filename.replace('\\', '/')
        if name in seen:
            raise ValueError(f'Duplicate APK member after normalization: {name}')
        seen.add(name)
        data = original.read(entry)
        entry.filename = name
        output.writestr(entry, data)
temporary.replace(source)
