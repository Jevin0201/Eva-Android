# Legacy entry point; preparation and import are now unified.
import runpy
from pathlib import Path
runpy.run_path(str(Path(__file__).with_name('prepare-alpine.py')), run_name='__main__')
