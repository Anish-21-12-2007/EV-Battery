# Original engineering evidence

This folder preserves selected original evidence recovered from `EV_EMS_precleanup_20261102` on 2026-11-03. It is not a copy of the old application. The current engineering authority remains [`FINAL_EV_EMS_ENGINEERING_PACKAGE`](../../FINAL_EV_EMS_ENGINEERING_PACKAGE/README.md).

- `circuit-details-original/` contains the 32 original files in the earlier `Circuit_Details` handoff. The original ZIP and extracted files were compared byte-for-byte; one extracted source is retained. Its earlier diagrams, BOM and wiring schedule were superseded by the final package and must not be combined with it as a construction design.
- `historical-assembly/` contains the original 2026-10-14 audit, selected machine-readable results, original model inventory, Blender inspection image and source generation metadata. These describe the old software and geometry. They are **not current-release test results** and do not establish physical wiring, calibration or safety. References within the original report to old browser screenshots, scripts and backups document their historical location; obsolete runtime code and redundant screenshot sets were deliberately not restored.
- The missing earlier conditional `corrected-schematic.png` was restored to `hardware-validation/`, where its retained README already referenced it. One copy of the original `ECS_corrected_schematic.svg` is retained under `hardware-validation/provided-references/`; the numbered duplicate is omitted.
- The unique editable `inspected-assembly.blend` is retained under `blender-workflow/output/`. It depicts a historical single-sensor assembly, not the final two-load, 60-connection design. The existing ECS GT `.blend` and both existing GLBs remain preserved.

[`validation/preservation-manifest.json`](../../validation/preservation-manifest.json) records the source, destination, size and SHA-256 for each recovered file. All 36 files in the authoritative final package also matched the original final-package ZIP and the starting SHA-256 manifest. Duplicate archives therefore need not be kept inside the final project.

Current software verification belongs in `validation/`. No physical circuit or authenticated Firebase account was tested by this preservation work.
