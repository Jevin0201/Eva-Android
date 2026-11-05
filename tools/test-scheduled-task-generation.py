"""Compile the real Android host and run its injected transport race fixture on JVM."""
from pathlib import Path
import os
import shutil
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
os.chdir(root)
jdk = Path('/Users/jevin/.local/share/rea/dependencies/zulu21.54.107-ca-jdk21.0.13-macosx_aarch64/Contents/Home')
platform = next(Path('downloads/android-sdk').glob('*/android.jar')).resolve()
json_jar = Path('artifacts/diagnosis-20261105/android-json-test.jar').resolve()
if not json_jar.is_file():
    raise SystemExit('Provide the project Android JSON fixture jar before running this host test')
libs = [p.resolve() for p in Path('probe/libs').glob('*.jar')]
folder = Path(tempfile.mkdtemp(prefix='scheduled-generation-', dir=root / 'tmp')).resolve()
try:
    sources = list(Path('probe/src').glob('*.java')) + list(Path('probe/third_party').rglob('*.java'))
    compile_cp = os.pathsep.join(str(p) for p in [platform, *libs])
    subprocess.run([str(jdk / 'bin/javac'), '-encoding', 'UTF-8', '--release', '8', '-classpath', compile_cp, '-d', str(folder), *(str(p) for p in sources), 'tools/ScheduledTaskGenerationTest.java'], check=True)
    runtime_cp = os.pathsep.join(str(p) for p in [folder, json_jar, platform, *libs])
    subprocess.run([str(jdk / 'bin/java'), '-classpath', runtime_cp, 'ai.eva.android.probe.ScheduledTaskGenerationTest'], check=True)
finally:
    assert folder.parent == root / 'tmp' and folder.name.startswith('scheduled-generation-')
    shutil.rmtree(folder)
