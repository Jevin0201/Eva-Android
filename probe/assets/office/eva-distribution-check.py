"""Compile, execute and decompile a task-owned ARM64 fixture after first-run setup."""
import runpy
import hashlib
import json
import os
from pathlib import Path
import subprocess
import signal
import tempfile
import time

BASE = Path('/root/eva-workspace/eva-setup-checks')
JAVA = Path('/root/.eva-runtime/java21/current')
GHIDRA = Path('/root/.eva-runtime/ghidra/ghidra_12.1.4_PUBLIC')
REA = Path('/root/.eva-runtime/distribution/rea/node_modules/.bin/rea')
BASE.mkdir(parents=True, exist_ok=True)
folder = Path(tempfile.mkdtemp(prefix='run-', dir=BASE))
report = {'folder': str(folder), 'selinuxDomain': Path('/proc/self/attr/current').read_text().strip('\0\n')}
env = {**os.environ, 'JAVA_HOME': str(JAVA), 'PATH': str(JAVA / 'bin') + ':' + os.environ['PATH'],
       'GHIDRA_INSTALL_DIR': str(GHIDRA), 'GHIDRA_HEADLESS_MAXMEM': '768M',
       'REA_GHIDRA_STARTUP_TIMEOUT_MS': '180000', 'REA_GHIDRA_DECOMPILE_TIMEOUT_SECONDS': '60',
       'EVA_JAVA21_COMPAT': '1', 'LD_PRELOAD': str(JAVA / 'libeva-java21-memory.so')}


def run(name, args, timeout=240):
    started = time.monotonic()
    process = subprocess.Popen(list(map(str, args)), stdout=subprocess.PIPE,
                               stderr=subprocess.PIPE, text=True, env=env,
                               start_new_session=True)
    try:
        stdout, stderr = process.communicate(timeout=timeout)
    except BaseException:
        os.killpg(process.pid, signal.SIGTERM)
        try:
            stdout, stderr = process.communicate(timeout=5)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            stdout, stderr = process.communicate()
        (folder / (name + '.log')).write_text(stdout + '\n' + stderr)
        raise
    (folder / (name + '.log')).write_text(stdout + '\n' + stderr)
    report[name] = {'exitCode': process.returncode, 'seconds': round(time.monotonic() - started, 2)}
    if process.returncode:
        raise RuntimeError(name + ': ' + (stdout + stderr)[-7000:])
    return stdout


try:
    java = json.loads(run('java', ['python3', '/root/.eva-runtime/eva-java21.py', 'selftest']))
    assert java['ready']
    report['javaChecks'] = java['checks']
    with tempfile.TemporaryDirectory(prefix='.eva-initial-apk-', dir='/root/eva-workspace') as temporary:
        project = Path(temporary) / 'source'
        (project / 'src/ai/eva/setupcheck').mkdir(parents=True)
        (project / 'eva-android.json').write_text(json.dumps({'minSdk': 28}))
        (project / 'AndroidManifest.xml').write_text('<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="ai.eva.setupcheck"><application android:label="Eva Setup Check"><activity android:name=".MainActivity" android:exported="true"/></application></manifest>')
        (project / 'src/ai/eva/setupcheck/MainActivity.java').write_text('package ai.eva.setupcheck; public class MainActivity extends android.app.Activity {}')
        builder = runpy.run_path('/root/.eva-runtime/eva-android-build.py')
        built = builder['build'](str(project), str(Path(temporary) / 'apk'), 'assembleDebug')
        assert built['passed'] and all(Path(p).is_file() for p in built['apks'])
        report['androidApkBuilt'] = True
    source = folder / 'sample.c'
    source.write_text('''__attribute__((noinline)) int eva_transform(int a, int b) {
 return (a * 7 + b) ^ 0x1357;
}
int main(void) { return eva_transform(3, 4) == (25 ^ 0x1357) ? 0 : 1; }
''')
    binary = folder / 'sample-arm64'
    run('compile-native', ['gcc', '-O1', '-g', '-fno-inline', '-o', binary, source])
    run('execute-native', [binary])
    script = folder / 'EvaExport.java'
    script.write_text('''import ghidra.app.script.GhidraScript;
import ghidra.app.decompiler.DecompInterface;
import ghidra.program.model.listing.Function;
import java.nio.file.Files;
import java.nio.file.Path;
public class EvaExport extends GhidraScript {
 public void run() throws Exception {
  DecompInterface decompiler = new DecompInterface();
  try {
   if (!decompiler.openProgram(currentProgram)) throw new Exception("openProgram failed");
   for (Function function : currentProgram.getFunctionManager().getFunctions(true)) {
    if (!function.getName().equals("eva_transform")) continue;
    var result = decompiler.decompileFunction(function, 60, monitor);
    if (!result.decompileCompleted() || result.getDecompiledFunction() == null)
     throw new Exception(result.getErrorMessage());
    Files.writeString(Path.of(getScriptArgs()[0]), result.getDecompiledFunction().getC());
    println("EVA_DECOMPILE_PASS " + currentProgram.getLanguageID());
    return;
   }
   throw new Exception("eva_transform not found");
  } finally { decompiler.dispose(); }
 }
}
''')
    projects = folder / 'projects'
    projects.mkdir()
    output = folder / 'eva_transform.c'
    headless = run('ghidra-headless', [GHIDRA / 'support/analyzeHeadless', projects, 'EvaFixture',
                   '-import', binary, '-scriptPath', folder, '-postScript', 'EvaExport.java', output,
                   '-analysisTimeoutPerFile', '120', '-max-cpu', '2', '-deleteProject'])
    code = output.read_text()
    assert 'eva_transform' in code and ('0x1357' in code or '4951' in code)
    assert 'EVA_DECOMPILE_PASS AARCH64' in headless
    report['pseudocode'] = code
    report['binarySha256'] = hashlib.file_digest(binary.open('rb'), 'sha256').hexdigest()
    rea = run('rea-decompile', [REA, 'decompile', binary, 'eva_transform', '--provider', 'ghidra', '--format', 'json'])
    evidence = json.loads(rea)
    assert 'eva_transform' in rea and ('0x1357' in rea or '4951' in rea)
    report['reaEvidenceReturned'] = True
    report['passed'] = True
except Exception as error:
    report['passed'] = False
    report['error'] = str(error)
finally:
    (folder / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(report, ensure_ascii=False), flush=True)
raise SystemExit(0 if report['passed'] else 1)

