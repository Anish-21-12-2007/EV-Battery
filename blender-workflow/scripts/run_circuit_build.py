"""Capture background Blender diagnostics (including Store launcher sessions)."""
from pathlib import Path
import contextlib, json, runpy, traceback
root=Path(__file__).resolve().parents[2]
log=root/'validation'/'circuit-build.log'
status=root/'validation'/'circuit-build-status.json'
status.write_text(json.dumps({'status':'running'}))
with log.open('w',encoding='utf-8') as output, contextlib.redirect_stdout(output), contextlib.redirect_stderr(output):
    try:
        runpy.run_path(str(Path(__file__).with_name('build_circuit_lab.py')),run_name='__main__')
    except Exception:
        traceback.print_exc()
        status.write_text(json.dumps({'status':'failed','traceback':traceback.format_exc()},indent=2))
        raise
    else:
        status.write_text(json.dumps({'status':'complete'}))
