"""Run the preserved package checks without writing into the package.

The source calculation script writes next to __file__. Execute its unchanged
source with an output-only __file__ under validation instead. The consistency
verifier is read-only and keeps its original __file__ for source resolution.
"""
from pathlib import Path
import contextlib
import hashlib
import io
import json

ROOT = Path(__file__).resolve().parent.parent
PACKAGE = ROOT / "FINAL_EV_EMS_ENGINEERING_PACKAGE"
OUTPUT = ROOT / "validation" / "advanced-circuit-audit"
OUTPUT.mkdir(parents=True, exist_ok=True)

def hashes():
    return {str(path.relative_to(PACKAGE)).replace("\\", "/"): hashlib.sha256(path.read_bytes()).hexdigest()
            for path in sorted(PACKAGE.rglob("*")) if path.is_file()}

before = hashes()
calculation = PACKAGE / "06_Validation" / "calculation_checks.py"
consistency = PACKAGE / "06_Validation" / "package_consistency_verifier.py"
log = io.StringIO()
with contextlib.redirect_stdout(log):
    exec(compile(calculation.read_text(encoding="utf-8"), str(calculation), "exec"),
         {"__file__": str(OUTPUT / "calculation_checks.py"), "__name__": "__main__"})
    exec(compile(consistency.read_text(encoding="utf-8"), str(consistency), "exec"),
         {"__file__": str(consistency), "__name__": "__main__"})
after = hashes()
assert before == after, "Authoritative engineering package changed during audit"
generated = json.loads((OUTPUT / "calculation_results.json").read_text(encoding="utf-8"))
stored = json.loads((PACKAGE / "06_Validation" / "calculation_results.json").read_text(encoding="utf-8"))
report = {
    "date": "2026-11-03",
    "packageFilesUnchanged": len(before),
    "calculationScriptRan": True,
    "consistencyScriptRan": True,
    "recalculatedJsonMatchesStoredJson": generated == stored,
    "sourceSha256": before,
    "output": log.getvalue().strip().splitlines(),
    "scope": "Documentary arithmetic and source-reference checks only; no hardware test, construction approval, calibration or protection qualification.",
    "consistencyLimit": "The package checker verifies BOM foreign keys, SVG text tokens and two stored arithmetic values. Its '0 unresolved endpoints' means zero unknown BOM IDs, not physically verified pins or a complete protection design.",
}
(OUTPUT / "source-check-report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(json.dumps({key: value for key, value in report.items() if key != "sourceSha256"}, indent=2))
