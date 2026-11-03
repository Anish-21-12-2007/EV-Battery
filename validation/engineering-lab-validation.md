# Engineering lab validation — 2026-11-03

Phase 2 adds a first **Wiring layout** tab while retaining every section documented below. Its exact 60-route/87-terminal source derivation, direct original-ZIP comparison, interaction details and physical-footprint limitations are recorded in [WIRING_LAYOUT.md](../WIRING_LAYOUT.md) and [wiring-source-verification.json](wiring-source-verification.json). Application-wide phase 2 regression results are maintained separately.

The module is `engineering-lab.js`, with scoped styles in `engineering-lab.css`. It exports `initEngineeringLab(target?)`, defaulting to `#engineering-lab`. The website loads it on first entry to the engineering section. It makes read-only same-origin requests for the actual final-package CSV registers. It never changes the engineering package, telemetry, simulation settings or hardware.

## Implemented

- Nine selectable architecture blocks with component descriptions, measurement boundaries, unresolved conditions and links to source documents.
- A source-trace action and searchable original 60-connection / 42-component registers, including full condition and audit notes. Loading failure, retry and empty-result states are implemented.
- Preserved original SVG schematic with zoom controls (100–400%) and scrollable inspection.
- Candidate ESP32 pin map, including conditional optional peripherals. The map does not claim physical header positions.
- Interactive voltage-divider tolerance calculations, signed ACS712 output-scaler arithmetic and separate branch energy/cost integration.
- A mobile component grid and a keyboard-operable tab interface. All inputs validate empty and out-of-range numbers.

## Checks performed

`node --test tests/engineering-lab.test.mjs` passed five tests. These use the actual 42-row BOM and 60-row wiring schedule, check CSV quoted-field handling, check that every wire endpoint resolves to a BOM item, reproduce audited divider tolerance corners, reproduce signed current-scaler endpoints and the small-current resolution example, and check the package's 24 Wh / ₹0.192 worked energy example.

`node tests/engineering-browser.mjs` passed using headless Microsoft Edge 156.0.4314.58. This serves an isolated module fixture, with no Firebase connection. It exercised every architecture selector, trace navigation, wiring search, empty search, clearing, both registers, all three calculators, invalid/empty inputs, the source SVG decode, zoom and fit. All four panels fit 390 px and 320 px page widths without page overflow. No JavaScript page errors occurred.

The retained `engineering-lab-desktop.png`, `engineering-lab-390.png` and `engineering-lab-320.png` images are isolated-module screenshots. They are not evidence of a physical circuit or a complete application test. Application-wide checks are recorded separately by the main validation workflow.

## Engineering limits retained

This is a conditional 12 V educational reference, separate from the 96 V EV software model. No hardware was inspected, powered, calibrated or tested. No fuse rating, wire gauge, battery limit or installed module identity was selected here. The 2.45 V ADC reference is described as a suggested measurement-range ceiling, not a pin absolute maximum or safety certification.

The source package still leaves RP1 insertion incompletely scheduled. W060 describes the TVS return in its note without a separate return row. The lab exposes this limitation beside the original schematic instead of silently editing the evidence.

The older `battery-monitoring-reference/` and `hardware-validation/` folders explicitly preserve superseded inputs cited by the dated independent audit and old Blender generator. A SHA-256 duplicate-file scan across those folders found no identical duplicate files. They are retained for traceability; they are not used as the active circuit design.
