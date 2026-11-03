# Phase 2 acceptance — 2026-11-03

The current browser implementation passed 15 phase 2 acceptance groups, 18 regression groups, and 36 unit tests. The browser tests used Microsoft Edge headless against the local server, with an actual WebGL canvas and real pointer/keyboard controls.

| Evidence | Result |
| --- | --- |
| `phase2-browser-validation.json` | 15 passed, 0 failed |
| `browser-validation.json` | 18 passed, 0 failed |
| `unit-validation.json` and `unit-tests.tap` | 36 passed, 0 failed |

The phase 2 suite checks all 48 component assemblies individually for translation, rotation, hiding, revealing, and reset. Unselected transforms and the simulation state remain unchanged. A real pointer drag moved the selected battery by 0.464291 m on X while every other component remained stationary. Exploded view preserves manual edits, and complete restore clears edits and hidden state.

At reduced motion, all four wheels and four separately selectable brake discs visibly change between fixed-camera captures and match integrated distance divided by tire radius. Motor, reduction gear, differential, and half-shaft angles match their kinematic relationships; brake calipers and suspension remain fixed. Wheel editing preserves operating rotation. Pause freezes distance, operating angles, and energy state.

Both UV-mapped physical screens use live canvas textures. The final running interior image was visually reviewed: the infotainment screen displays the four auxiliary loads and energy, and the cluster displays speed, SOC, voltage, current, and pack power. External auxiliary switches change actual scene lighting/airflow and device demand. Screen readings match the simulation snapshot exactly after pause and texture refresh. The initial screen-bezel occlusion was corrected before the passing run. Tests wait for actual rendering progress because heavy concurrent rendering can delay a frame beyond a fixed wall-clock wait.

An independent Python standard-library CSV parser compared every rendered wiring route against the authoritative register. All 60 IDs, source/destination components, terminal names, and source statuses match; the 87 logical terminal keys match exactly. Every wire's full highlighted path equals its original rendered route. Pin selection, search, index, zoom, pan, focus, and filters work. RP1, D1, and RLY1 have no invented terminal mappings. Physical locations and footprints remain explicitly unresolved; every rendered route retains `UNVERIFIED` physical status.

The 320, 390, 768, and 1440 pixel layouts have no document overflow. The phase 2 run recorded no application console errors, page errors, or missing local assets. Regression checks cover monitor isolation, test-only telemetry fixtures, CSV export, calculations, navigation, fallback after aborted model loading, disabled WebGL, and unavailable external services.

No authenticated Firebase session, hardware measurement, actuator, real circuit wiring, electrical rating, battery pack, or thermal behavior was physically tested. Simulation results are illustrative and remain separate from unavailable hardware telemetry. This acceptance establishes software behavior and source fidelity, not a verified board pinout or production vehicle qualification.

Representative images: `phase2-gizmo-before.png`, `phase2-gizmo-after.png`, `phase2-wheel-fixed-camera-before.png`, `phase2-wheel-fixed-camera-after.png`, `phase2-interior-running-screens.png`, `phase2-interior-paused-screens.png`, and `phase2-wiring-overview.png`. Canonical regression images include `browser-studio-desktop.png`, `browser-monitor-desktop.png`, `browser-engineering-desktop.png`, and `browser-fallback.png`. The separately repeated regression run passed the same 18 groups. Its redundant generated copies remain in `phase2-regression/`: automatic approval review rejected the requested folder deletion with "blocked by policy" and no more specific reason. No alternate deletion method was attempted.
