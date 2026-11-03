# ECS Battery Monitoring System — project audit, 14 October 2026

## 1. Baseline findings

The existing application was inspected and repaired in place. It was not rewritten. The workspace is not a Git checkout. A recovery copy of all root application files and the original smoke test was saved before edits under `backups/audit-20261014/`, with a SHA-256 manifest. Earlier backups remain intact.

The application has one HTML document and five views:

| View / hash | Current implementation |
| --- | --- |
| `#view-dashboard` | `app.js`: validator, measurements, Chart.js, eight recent readings, theme |
| `#view-connect` | `firebase-config.js`: Email/Password auth, read-only telemetry listener |
| `#view-model` | `model-viewer.js`: Three.js ECS scene, inspector and logical wire operations |
| `#view-ev-model` | `ev-viewer.js`: separate illustrative EV scene and component controls |
| `#view-ev-sim` | Same EV module binds `ev-simulation-engine.js` and `ev-vehicle-data.js` |

Navigation uses `app.js` to toggle existing panels, with hash restoration. Both 3D modules retain their renderer and scene across navigation and skip rendering hidden views. Three.js 0.180.0 and Firebase SDK 10.11.0 are CDN imports; Chart.js and fonts also require internet access.

Before edits, the existing smoke script loaded both GLBs, displayed a battery hover tooltip, selected parts from lists, exercised simulation and recorded zero console errors. **Hover visibility and removal of body dots had already been repaired in the current files.** These fixes were preserved. The initial dashboard contained no telemetry. The smoke test was insufficient evidence for all features: many checks only printed values with a pass marker and its exception handler did not set a failing exit status.

Asset inventory from the actual binary GLBs:

| Asset | Size | Meshes / nodes | Routes |
| --- | ---: | ---: | ---: |
| `ecs-battery-assembly.glb` | 2,853,084 bytes | 350 / 350 | 41 conductive-reference wires, 24 components |
| `ev-vehicle-assembly.glb` | 514,792 bytes | 169 / 169 | 11 illustrative routes, 14 selectable groups including wheels |

The ECS CSV, JSON reference, model wire IDs and embedded CSV revision hashes agree. `corrected-wiring-table.csv` remains the conductive-edge authority. The final handoff, calculations, remaining-verification register, original references, generation scripts, model metadata and archived Wokwi sources were reviewed. No Blender regeneration or physical testing was performed.

## 2. Root causes

**Historical hover regression:** the earlier `backup-20261014-hover-fix/style.css` sets the tooltip to `opacity: 0` and `visibility: hidden` but lacks `.model-hover-tooltip.is-visible`. The current stylesheet already includes that visible-state rule. This establishes the CSS mismatch in that backup; it is not a claim that hover remained universally broken at the start of this audit.

**Historical dots:** that same backup gives `body` a radial gradient of 0.85px dots repeated every 20px, plus a dark-theme variant. Those declarations were already absent from the current stylesheet. A separate decorative 32px CSS grid remained on `.model-stage::before`; this audit removed it. Actual Three.js reference grids and chart gridlines remain functional visualization elements.

**Remaining interaction defects:** hover checked components before wires while clicks checked wires first. Three.js raycasting does not honor ancestor visibility automatically, so a hidden wire group could still intercept picking. Hover material state could overlap selection when using list controls. Tooltips did not consistently clear during navigation. Wire clicks from an empty inspector did not reveal useful details. These paths are now consistent.

## 3. Changes made

| File | Change |
| --- | --- |
| `viewer-interaction.js` (new) | Shared nearest-hit picking, ancestor visibility checks and ancestor metadata lookup |
| `model-viewer.js` | Consistent hover/click picking; mouse/touch/cancel handling; independent selection; tooltip cleanup; wire inspector from empty state; material restoration; reset controls; aspect-aware camera fitting; unsupported component/wire claims corrected |
| `ev-viewer.js` | Shared picking while retaining pin/terminal inspection; tooltip cleanup; wheel axle pivots; simulation-based spin/distance; complete reset control state; aspect-aware fitting; uncertain cable metrics marked unverified; legacy EV_W10/11 warnings |
| `ev-simulation-engine.js` | Solve terminal `P = V × I`; zero paused electrical draw; regen uses brake input once; no braking-induced reverse motion; gear changes limited to low speed; integrated wheel angle/distance; reset preserves external circuit fault |
| `style.css` | Remove decorative viewer grid; neutral viewer background; bounded tooltip width; stable desktop viewer height; scrolling inspector without overlapping children; stacked tablet/mobile layout; remove closed mobile sidebar shadow |
| `app.js` | Emit a view-change event for viewer cleanup; telemetry validator unchanged |
| `firebase-config.js` | Separate connection state from authentication/data; stale/invalid status; five-minute freshness policy; connectivity listener and timer cleanup; no-data clearing; auth error cleanup; robust initialization timing |
| `index.html` | Correct initial verification placeholder and inspection wording; describe pause/reset/low-speed reverse controls |
| `README.md`, `FIREBASE_SETUP.md` | Replace obsolete public-read/setup advice; describe actual schema, authentication, test scope and model limitations |
| `test_audit_browser.mjs`, `test_simulation.mjs`, `test_assets.py` (new, under this folder) | Strict browser interactions, deterministic simulator invariants, read-only model/reference consistency checks |
| `test_browser_e2e.mjs` | Add real assertions, fail on exceptions/console errors, shift into reverse from stopped state |

Screenshots, JSON results, logs and review diffs are in `audit-20261014/`. The existing smoke script also refreshed its original `screenshots/` outputs. Firebase project identifiers, authentication method, read path, no-write architecture, the telemetry schema, original GLBs, Blender assets and conductive reference files were retained.

## 4. Verified functionality

The strict suite completed **67 passing assertions**, plus an observed real signed-out Firebase UI and zero unexpected browser errors. Results are recorded individually in `audit-20261014/browser-results.json`. Chrome used an isolated temporary profile. Test hooks and mocked SDK code are served only by the test server; they are not included in the production application files.

- Native browser mouse input: hover ESP32; click ESP32; hover ACS712 while ESP32 details remain selected; leave to hide tooltip; click ACS712 to update details. No initial automatic selection. Native orbit drag moved the camera.
- Hidden wires cannot be picked; component isolation and full restore work; selection works after navigating away and returning; mobile touch tap selects ESP32 without a sticky hover tooltip.
- Both actual GLBs load. EV selection, isolation, explode/restore and restored control states pass. Wheel geometry has local axle pivots and uses integrated simulation angle.
- All five views pass overflow/background checks at 1600, 800 and 390 pixels, in both themes: 30 view/size/theme combinations. Mobile inspector stacks below a usable viewer. Screenshots were inspected; inspector overlap and the closed-sidebar shadow were repaired.
- Simulator drive, speed/RPM, terminal power, energy, stop/reset, charge bounds, braking/regen, reverse, fault persistence and frame-rate comparisons pass deterministic tests. The browser also confirms that simulator outputs leave live telemetry blank.
- Local mocked Firebase SDK: one telemetry and one connectivity listener per authenticated session; no duplicate listener on repeated observer notification; required schema acceptance/rejection; stale and invalid status; absent data; connection loss; permission errors; sign-out clearing; ignored late callbacks.
- The real Firebase SDK reached its signed-out UI. No real credentials were submitted and no authenticated database read was claimed.
- The updated legacy smoke test completed with zero console errors and an exit status of zero. JavaScript syntax checks passed. Asset tests confirmed the ECS CSV hash and all 41 wire IDs against the GLB.

Commands executed:

```powershell
node hardware-validation/test_simulation.mjs
node hardware-validation/test_audit_browser.mjs
node hardware-validation/test_browser_e2e.mjs
python hardware-validation/test_assets.py
```

The browser checks use local static HTTP servers compatible with the site's Live Server delivery model. The VS Code extension itself was not automated.

## 5. Regressions discovered

Beyond picking, the review found unsupported wire gauges, ampacity, resistance and lengths presented as specifications; a component-wide VERIFIED label on the unconfirmed ESP32 board; stale data indefinitely marked fresh; authenticated state prematurely described as a database connection; simulation power inconsistent with terminal voltage/current; fixed-per-frame wheel/fuel accumulation; wheel groups rotating about the assembly origin; paused simulation still showing electrical load; reset clearing faults without reconnecting the twin; and stale explode/reset controls.

These were repaired without changing source geometry or inventing electrical connections. The test suite also exposed and caught an intermediate missing tracer-array declaration during editing; it was restored before the clean final runs. Temporary test failures are not reported as successful checks.

## 6. Remaining limitations

- **Hardware:** no ESP32, battery, sensor, fuse, motor, buck, relay or electrical continuity was physically tested. Exact board/header positions, installed temperature sensing, calibrated ADC behavior, protection ratings, suppression and safety remain unverified. The ECS assembly remains a conditional educational reference, not build-ready hardware.
- **Real Firebase:** real sign-in/sign-out, deployed rules, permission-protected reads, device writes, network reconnect with a real session and end-to-end telemetry remain pending. No database rule was modified. The browser never writes readings.
- **Schema integration:** the existing validator requires temperature and a boolean motor signal. Those fields must not be fabricated if the hardware is absent. A supported hardware/schema migration requires separate integration work. Battery percentage and tariff-based cost remain N/A.
- **Historical firmware:** the archived Wokwi sketch uses 120k/22k voltage and 15k/20k current scaling, rather than the corrected 68k/10k and 27k/20k reference. It is a synthetic ADC exercise with previously reported partial OLED visualization and no Firebase uploader. It was not recompiled or silently repurposed.
- **EV wiring:** EV_W10 routes auxiliary power to `CAN_H`; EV_W11 routes coolant to `HV_MINUS` in the legacy illustrative metadata. These endpoints are flagged in the UI and documentation. They cannot serve as construction instructions; no evidence supports substituting invented endpoints. The logical circuit-fault demo is not a complete electrical solver.
- **EV geometry:** the skateboard model does not implement a full vehicle body-panel subsystem. Generic component visibility/isolation/temporary transforms are available. Geometry is illustrative, not a validated production vehicle. The 12 V ECS battery does not power the full-size EV model.
- **Simulation/performance:** assumptions remain illustrative (96 V nominal, 150 Ah, 0.035 ohm internal resistance, simplified longitudinal motion). Charging is an immediate SoC adjustment. No tire slip, transient circuit solution, motor stall current, accurate thermal/coolant model or per-wire electrical loss model is claimed. Timesteps cap at 0.1s. Long-duration memory/FPS behavior on UHD 730 and real touch hardware were not benchmarked; touch was browser-emulated. No new framework, post-processing pass or asset reconstruction loop was added.
- **Environment:** existing CDN dependencies still require internet access. Only the available local Chrome was exercised; other browsers remain untested.

## 7. How to run

1. Open `C:\Users\uppal\OneDrive\Desktop\ECS-Battery-Monitoring` in VS Code.
2. Install **Live Server** if necessary.
3. Right-click `index.html` → **Open with Live Server**, or choose **Go Live**.
4. Use the URL shown by the extension, commonly `http://127.0.0.1:5500/index.html`. Hard-refresh with **Ctrl+F5** if cached files persist.
5. Choose **3D Engineering Model** for ECS inspection or the separate **EV Hardware Twin / EV Simulator** views. Use existing Firebase credentials only when performing an authorized real connection test.

A temporary local preview was also started at `http://127.0.0.1:5514/index.html#view-model`. It serves the same workspace with Python's static HTTP server; it is not a deployment or an extra application requirement.

## 8. Delivery state

All application files remain in the original root: **`C:\Users\uppal\OneDrive\Desktop\ECS-Battery-Monitoring`**. No ZIP, cloud publication, database change, package installation or source-model regeneration was performed. No credentials were added. Recovery files are under `hardware-validation/backups/audit-20261014/`; all pre-existing reference and backup folders remain in place.
