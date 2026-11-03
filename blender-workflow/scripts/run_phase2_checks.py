"""Run source validation with durable diagnostics for Windows Store Blender."""
import runpy,traceback
from pathlib import Path
root=Path(__file__).resolve().parents[2]
try:
    runpy.run_path(str(Path(__file__).with_name("check_ev_ems_phase2.py")),run_name="__main__")
except Exception:
    (root/"assets"/"vehicle"/"phase2-check-error.txt").write_text(traceback.format_exc())
    raise
