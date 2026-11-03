"""Create a verified, self-contained source/runtime archive without dev caches."""
import hashlib
import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT.parent / "EV_EMS_AAA_FINAL_PROJECT.zip"
EXCLUDED_DIRS = {"node_modules", ".git", "__pycache__", "test-results", "playwright-report", "phase2-regression"}
EXCLUDED_FILES = {"package-manifest.json", "package-receipt.json", "EV_EMS_AAA_FINAL_PROJECT.zip"}

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def retained(path):
    rel = path.relative_to(ROOT)
    return not any(p in EXCLUDED_DIRS for p in rel.parts) and path.name not in EXCLUDED_FILES and not path.name.endswith((".blend1", ".pyc", ".log"))

for required in ["index.html", "app.js", "README.md", "FINAL_REPORT.md", "FINAL_ENGINEERING_AND_QUALITY_REPORT.md", "CIRCUIT_LAB.md", "SIMULATION_MODEL.md", "circuit-lab.js", "circuit-lab.css", "circuit-schematic.js", "assets/circuit/circuit-lab.blend", "assets/circuit/circuit-lab.glb", "assets/circuit/circuit-manifest.json", "assets/vehicle/ev-ems-gt.blend", "assets/vehicle/ev-ems-gt-phase2.blend", "assets/vehicle/ev-ems-gt-phase2.glb", "assets/vehicle/poster-phase2.png", "vehicle-assembly.js", "vehicle-displays.js", "wiring-layout.js", "vendor/three/build/three.module.js", "vendor/three/examples/jsm/controls/TransformControls.js", "assets/fonts/fonts.css"]:
    if not (ROOT / required).is_file():
        raise RuntimeError("Required file missing: " + required)

for receipt in ["unit-validation.json", "browser-validation.json", "phase2-browser-validation.json"]:
    data = json.loads((ROOT / "validation" / receipt).read_text(encoding="utf-8-sig"))
    if data.get("failed") != 0 or data.get("passed", 0) < 1:
        raise RuntimeError("Validation must pass before packaging: " + receipt)

for required in ["hardware/revision-b.json", "hardware/revision-b-schematic.svg", "docs/hardware-build-proposal.md", "docs/advanced-circuit-audit.md", "docs/advanced-simulation-audit.md", "docs/manufacturer-cross-check.md", "circuit-review.js", "validation/driving-scenarios-validation.json"]:
    if not (ROOT / required).is_file():
        raise RuntimeError("Required reviewed design file missing: " + required)

model_check = json.loads((ROOT / "assets/vehicle/model-validation-phase2.json").read_text(encoding="utf-8-sig"))
if model_check.get("all_passed") is not True:
    raise RuntimeError("Phase 2 Blender validation must pass before packaging")
acceptance = json.loads((ROOT / "validation/advanced-acceptance-manifest.json").read_text(encoding="utf-8-sig"))
for entry in acceptance["testedSources"]:
    if digest(ROOT / entry["path"]).lower() != entry["sha256"].lower():
        raise RuntimeError("Source changed since advanced acceptance: " + entry["path"])

for entry in acceptance["testedReceipts"]:
    if digest(ROOT / entry["path"]).lower() != entry["sha256"].lower():
        raise RuntimeError("Receipt changed since advanced acceptance: " + entry["path"])
if not acceptance.get("allChecksPassed"):
    raise RuntimeError("Advanced acceptance must pass before packaging")

engineering = json.loads((ROOT / "validation/engineering-package-sha256.json").read_text(encoding="utf-8-sig"))
for entry in engineering:
    if digest(ROOT / entry["Path"].replace("\\", "/")).lower() != entry["SHA256"].lower():
        raise RuntimeError("Authoritative engineering file changed: " + entry["Path"])

files = sorted((p for p in ROOT.rglob("*") if p.is_file() and retained(p)), key=lambda p: str(p.relative_to(ROOT)))
manifest = {"project": "EV EMS / Aeris GT", "date": "2026-11-03", "engineeringFilesPreserved": len(engineering),
            "files": [{"path": p.relative_to(ROOT).as_posix(), "bytes": p.stat().st_size, "sha256": digest(p)} for p in files]}
manifest_path = ROOT / "validation/package-manifest.json"
manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
files.append(manifest_path)
with zipfile.ZipFile(TARGET, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for path in files:
        archive.write(path, ROOT.name + "/" + path.relative_to(ROOT).as_posix())

with zipfile.ZipFile(TARGET) as archive:
    if archive.testzip() is not None:
        raise RuntimeError("Archive CRC verification failed")
    for path in files:
        name = ROOT.name + "/" + path.relative_to(ROOT).as_posix()
        if hashlib.sha256(archive.read(name)).hexdigest() != digest(path):
            raise RuntimeError("Archived content mismatch: " + name)
receipt = {"date": "2026-11-03", "archive": str(TARGET), "bytes": TARGET.stat().st_size, "sha256": digest(TARGET),
           "archivedFiles": len(files), "allFileHashesMatch": True, "crcVerified": True, "engineeringFilesUnchanged": len(engineering),
           "excluded": sorted(EXCLUDED_DIRS), "sourceManifest": "validation/package-manifest.json"}
(ROOT / "validation/package-receipt.json").write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
print(json.dumps(receipt, indent=2))
