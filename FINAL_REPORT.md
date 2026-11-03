# EV-EMS implementation report — advanced circuit and energy lab

**Current revision:** 2026-11-03, Asia/Calcutta (IST). The previous completed vehicle, monitor and engineering functions remain in place. The phase 2 record below is retained as historical context; the additions described here are current.

## New 3D circuit assembly

The Engineering lab now opens with a Blender-built 3D physical assembly. The source includes 36 component groups (33 connected and three unwired audit items), 87 modeled logical contacts and 60 curved wire paths. Detailed candidate models include ESP32, ACS712, converter, resistor bands, capacitors, terminals, fuse holders, switch, battery, light, motor, OLED and probe. Source assets are `assets/circuit/circuit-lab.blend`, `circuit-lab.glb` and `circuit-manifest.json`; current export size and optimized geometry counts are recorded in the manifest.

The browser compares the manifest and exported contacts with the original CSV. Component and wire selection show original source conditions, endpoint names and specifications. Orbit/zoom/pan, endpoint markers, complete path highlighting, component hide/reveal, move/rotate, numeric offsets, assembled/exploded views and resets work in the physical assembly. Cables remain attached to transformed contacts. The 2D wiring planner and all earlier engineering views remain available.

`circuit-schematic.js` generates a distinct conventional electrical schematic from the same CSV. It uses passive/source/load symbols, module pins, junctions, ground symbols and electrically equivalent net labels. Every source wire is listed in the net index. BUS+ is internally continuous and quiet/star grounds join through W053. A non-isolated buck creates a parallel return path, so W053 is not a verified unique Kelvin tie. Zoomable original engineering artwork remains available separately.

Exact installed board variants, header locations, module dimensions, fuse ratings, wire gauges and protection parts are not identified by the authoritative package. The geometry is therefore a detailed candidate illustration, with physical positions and sizes labeled unresolved. RLY1 is quantity zero and unwired. No RP1 insertion, TVS return, optional probe pullup or motor-suppression connection was invented. All 36 authoritative package files remain byte-identical.

## In-car energy screen

The actual `Screen_Infotainment` mesh uses a dynamic texture showing five device rows and TOTAL: electricity used (kWh), battery used (%) and cost (₹). It contains no voltage, current, wattage, RPM or frequency columns. External switches, lights, airflow effects, device ledgers and screen use the same simulation snapshot. The **Energy screen** camera frames the modeled display; the existing **Interior** view shows it in the cabin.

OFF devices stop accumulating while keeping historical energy. The display stays visible as a retained educational energy readout when the infotainment load is OFF. The entered **Electricity cost per kWh (₹/kWh)** recalculates each cost immediately. **Reset trip energy** clears the ledgers without resetting battery charge, motion, device switches or simulation time. Whole-scenario Reset remains separate.

Each energy ledger is the integral of device pack-side input (including modeled auxiliary converter losses), converted from Wh to kWh. Battery used is device kWh divided by assumed usable kWh times 100; cost is device kWh times tariff. TOTAL sums all five retained device ledgers. Regeneration remains separately accounted in the existing net-energy diagnostics and does not erase device consumption history.

The 96 V × 150 Ah software scenario gives 14.4 kWh nominal. Its default 10% reserve gives **12.96 kWh assumed usable**, explicitly unverified and independently editable through scenario assumptions. The 12 V circuit battery is separate and is not used as the car's denominator.

**Open energy screen** and **Look inside** expand the actual 3D canvas, with native fullscreen and an expanded fallback. Pan/orbit/reset and a 0.015 scene-metre minimum distance allow detailed inspection. The energy preset frames the screen from 0.32 scene metres with an aspect-aware field of view. It reveals hidden screens, preserves inspection offsets/trip state and clears selection lines that could obscure text. Desktop, portrait and landscape checks trace the screen centre and four corners to verify that vehicle geometry does not block them.

## Electrical and numerical review

The preserved source design is explicitly marked as requiring revision. `docs/advanced-circuit-audit.md` identifies the converter return loop, missing RP1/TVS/probe connections, incompatible light-sensor interfaces and unresolved power sequencing/protection. `circuit-review.js` puts the affected findings into component/wire inspectors. `docs/manufacturer-cross-check.md` records corrected IC operating limits and arithmetic with manufacturer links. Documentary source checks passing do not establish build readiness.

`hardware/revision-b.json` and `docs/hardware-build-proposal.md` provide a separate exact-component proposal with 28 B-prefixed connections, ESP32-DevKitC-32E, two Adafruit 904 INA219 boards, OLED 4440, two 5648 MOSFET drivers, a Pololu 3041 motor and a selected 175 mm Adafruit 5864 strip. USB logic is separate from the proposed current-limited bench load supply. Physical supply/wiring/protection, calibration, firmware and motor transients remain unresolved; no battery connection schedule is approved. The original 60-wire 3D model is not this new proposal.

`docs/advanced-simulation-audit.md` records independent load-duration and chemical-energy checks. Control changes now settle elapsed fractional steps under the preceding state, long calls avoid repeated-subtraction drift, and cost overflow reports unavailable rather than Infinity or zero. In the documented 1200 s test, the default 20 ms interval has a 0.000006076 Wh chemical-energy residual over 208.333333333 Wh terminal draw, with first-order convergence. This is a specific software result, not a physical accuracy bound.

## Current verification evidence

- `validation/unit-validation.json` and `unit-tests.tap`: complete numerical, asset, connectivity and rendering-contract unit suite.
- `validation/browser-validation.json`: 18 existing application acceptance groups, including telemetry fixtures, lighting, simulation, offline/fallback and responsive behavior.
- `validation/phase2-browser-validation.json`: 15 additional vehicle/assembly/wiring groups, including all 48 vehicle components and 60 source wires.
- `validation/energy-display-browser.json`: five checks for real screen texture, totals, tariff, OFF retention, reset and 320/390px layouts.
- `validation/vehicle-camera-browser.json`: seven checks for close zoom, unobstructed screen framing, pan/reset, native fullscreen/fallback, cabin action and phone orientations.
- `validation/advanced-circuit-audit/source-check-report.json`: unchanged original calculation and consistency scripts, with their limited documentary scope stated.
- `validation/hardware-schematic-browser.json`: all 28 revision B records, eight module symbols, zero text overlap/clipping; proposed pins are checked against the separate schedule.
- `validation/circuit-3d-browser-validation.json`: 3D contacts, selection, wire paths, movement/rotation, visibility, explode/reset, camera controls, schematic and responsive behavior.
- `validation/schematic-layout-audit.json`: all 33 symbols checked with zero text overlaps.
- `assets/circuit/source-validation.json`: Blender source validation, with maximum contact/end-ring-centre error below 0.000001 presentation units.
- `validation/advanced-acceptance-manifest.json`: hashes of the final tested source files and evidence receipts.

No physical circuit testing, actual hardware identification, sensor calibration or authenticated Firebase validation is claimed. See `CIRCUIT_LAB.md`, `SIMULATION_MODEL.md` and the unchanged engineering package for the technical limits.

---

# Historical implementation report — phase 2

**Date:** 2026-11-03, Asia/Calcutta (IST)  
**Project:** `C:\Users\uppal\OneDrive\Desktop\ECS-Battery-Monitoring`  
**Scope:** Local engineering website, illustrative vehicle simulation, editable 3D assemblies and preserved educational circuit evidence.

## Current experience

The existing three-section application has been extended in place. It now combines a read-only device energy monitor, a source-derived wiring and engineering lab, and a vehicle studio with a revised interior, live in-car displays and independent assembly manipulation. The 12 V educational circuit remains separate from the illustrative 96 V EV model.

The workspace initially had no Git repository, so the reported earlier 17 edits could not be reconstructed as an exact Git diff. The existing source, tests, dated audit, retained Blender assets and external safety copy were inspected; useful work and original evidence were preserved. [validation/initial-state-audit.md](validation/initial-state-audit.md) records that review.

## Architecture and technologies

The application uses HTML, CSS and native JavaScript modules. `app.js` coordinates navigation, telemetry display, control state, graphs and export. `ev-simulation-engine.js` provides the fixed-step numerical model; `telemetry.js` validates physical-record shapes separately. `vehicle-studio.js`, `vehicle-assembly.js`, `vehicle-displays.js` and `drivetrain-kinematics.js` provide rendering, assembly transforms, screen textures and mechanical motion. `engineering-lab.js` and `wiring-layout.js` use the authoritative circuit files.

Three.js 0.180.0 supplies WebGL, glTF loading, orbit controls, transform gizmos and generated environment reflections. Its runtime and license are vendored locally; Manrope and DM Mono fonts are also local. Blender 5.2.3 LTS and Python create the editable vehicle and web export. Node serves the site and runs unit tests; Playwright drives Microsoft Edge acceptance checks. Studio and lab modules load on demand.

## Vehicle, interior and operation

The Aeris GT retains curved coachwork, wheel arches, glazing, mirrors, flush handles, lights, tyres/rims, brake assemblies and the rear e-axle. Phase 2 reworks the cabin into a compact 2+2 layout. Separate front and rear seats have shaped cushions, backrests, headrests, bolsters, bases/rails and upholstery details. Dashboard, steering wheel, console, door trim and screens are individually organized. The current model manifest describes the cabin positioning and screen surface contract; final visual verification belongs to the corresponding phase 2 renders and tests.

**Drive** explicitly enables traction, clears braking, applies 18% throttle and starts the model. **Start simulation** runs the currently selected settings and can operate stationary auxiliary loads without automatically engaging traction. Headlights, air conditioning, cabin lights and infotainment remain independently switchable with editable output-side watt assumptions. Lighting and airflow effects follow supplied simulated demand. Speed, SoC, power, per-device energy, gross/recovered/net energy, range, tariff cost, charts and exported samples use the same underlying model.

The instrument cluster and infotainment screen are modeled surfaces inside the car with live canvas textures, not floating HTML cards. They consume snapshots of the same simulation state, refreshed at up to 10 Hz. The cluster displays speed, battery state, voltage/current, pack power and auxiliary states. The infotainment display shows device power and pack-side energy when operating. OFF, PAUSED and NO POWER remain distinct; system status remains available on the cluster when infotainment is disabled. No cabin temperature or compressor-cycle model is invented.

Camera presets, orbit/zoom, paint finishes, studio/night lighting, quality settings and cutaway/exploded/mechanism/energy views remain available. Wheel, disc and driveline rotation represents simulation state even with reduced-motion preferences; optional cinematic movement respects the preference. Missing assets or unavailable WebGL produce a rendered fallback with usable simulation controls and retry.

## Assembly and mechanical behavior

The model exposes **48 independently selectable assemblies**. These include the battery, motor case/stator/rotor, reduction shaft, differential, halfshafts, inverter, converter, charger, cooling, individual wheels/discs/calipers/suspension groups, four seats, doors, bonnet, dashboard, console, steering wheel and displays.

Selection highlights the part and shows its description. Move and Rotate modes use 3D gizmos or numeric axis offsets. A selected part can be focused, hidden/revealed or reset. Exploded view separates components, and Restore complete assembly clears inspection offsets and hidden states. Assembly offsets are separate from operating rotation; moving a shaft does not change its energy model or erase its mechanical motion.

The default two-stage reduction uses `(41/15) × (60/20) = 8.2:1`. Wheels follow integrated distance divided by radius; rotor, intermediate shaft, differential and halfshafts follow their respective ratios and directions. Brake discs rotate with wheels; calipers, springs and dampers remain fixed. Scenario edits do not regenerate gear teeth or wheel geometry. Tooth profiles are visual approximations. Cornering differential behavior, suspension travel, tire slip, tooth-contact stress and manufacturing tolerances are not simulated.

| Current source or asset | Role |
| --- | --- |
| `assets/vehicle/ev-ems-gt-phase2.blend` | Active editable phase 2 cabin, components, materials and mechanism source |
| `assets/vehicle/ev-ems-gt-phase2.glb` | Active web export with independent assemblies and modeled screen surfaces |
| `assets/vehicle/poster-phase2.png` | Current rendered fallback |
| `assets/vehicle/model-manifest-phase2.json` | Current source/export counts, 48 groups, pivots, seat positions and screen UV contract |
| `assets/vehicle/model-validation-phase2.json` | 35 passing source checks for seat fit, screen eye rays/UVs, brake hierarchy and mechanical ratios |
| `assets/vehicle/interior-window-phase2.png`, `interior-seats-phase2.png`, `interior-rear-phase2.png` | Reviewed window, front cabin and rear cabin renders |
| `blender-workflow/scripts/build_ev_ems_phase2.py` | Phase 2 build workflow |
| `assets/vehicle/ev-ems-gt.blend` | Required base input to the phase 2 generator; retained source, not a backup |

Export counts and byte size are recorded in the current phase 2 manifest rather than copied from the older model. Phase 1 `.blend`/GLB files and model receipts are retained for generation and regression provenance. Earlier `blender-workflow/output/` assets remain distinct historical sources. No third-party vehicle mesh or texture assets were introduced.

Open `ev-ems-gt-phase2.blend` and play its timeline with Space to see the mechanical demonstration. Frames 1–241 at 24 fps cover five wheel turns, 41 motor turns and 15 reverse intermediate turns. The browser instead drives rotation from actual simulated distance. Live app control was stopped with Escape before switching the user's open Blender window; the updated file is saved separately and ready to open.

## Wiring layout and engineering lab

The lab now opens on a physical-style wiring planner, with recognizable component illustrations, logical terminal rails and visible source-derived cables. It includes **60 exact wire records, 33 connected components and 87 logical terminals**. Selecting a wire highlights its complete route and endpoints. Selecting a pin highlights every incident source connection. Search, family filters, pan/zoom, Focus selection and a complete connection index support dense areas.

The original ZIP was read directly before drawing. All 36 extracted authoritative files matched its bytes. Each rendered wire retains the original source component/pin, destination component/pin, purpose, status and condition. [validation/wiring-source-verification.json](validation/wiring-source-verification.json) records the archive and file hashes.

The source does not identify actual ESP32 carrier, sensor breakout, converter, OLED connector order or probe lead positions. The bodies and layout positions are therefore illustrative, and their terminal anchors are explicitly **UNRESOLVED physical placements**. No similar-looking board was silently substituted as an identified variant. Proposed and unresolved routes are distinguished; no wire is physically verified or simulation-only. Colour is a display convention, not a conductor specification. Crossings are not electrical junctions.

RP1, D1 and the quantity-zero legacy relay remain disconnected where endpoints are unscheduled. W060 ends at its named TVS cathode; its prose-only return and incomplete RP1 insertion are not turned into invented cables. Optional OLED and temperature routes retain their conditions. [WIRING_LAYOUT.md](WIRING_LAYOUT.md) explains the interaction and technical boundary.

The original schematic remains a separate zoomable view. The earlier functional architecture, searchable 42-item BOM and wiring register, candidate ESP32 mapping, unresolved decisions and voltage-divider/current-scaler/branch-energy calculators remain available. None changes the original handoff or a physical device.

## Telemetry and simulation correctness

The Device Energy Monitor retains Firebase Email/Password authentication and read-only `readings/latest` / `.info/connected` subscriptions. Authentication, database connection and record freshness/validity are separate states. Aggregate readings and optional branch voltage/current pairs are supported; branch power is derived only when both inputs exist. Charts, recent records, supplied cumulative energy, optional temperature/motor state and entered-tariff cost are displayed. No hardware actuator or synthetic physical measurement source exists. An `esp32` record tag does not authenticate a publisher.

The maintained 0.02 s simulation step constrains motion by torque, motor power, available battery supply and the speed governor. The governor and mean-speed work calculation cover partial throttle and the step approaching the speed cap. At the default 22 m/s cap, level-road holding demand is approximately 276.265 N, 6,077.832 W mechanical and 7,261.448 W at the pack bus before auxiliaries.

Battery saturation/depletion constrain supplied load and motion consistently. Terminal power follows `P = V × I`; regeneration is bounded at stopping and full charge. DC/DC losses are included in auxiliary pack-side ledgers. Gross load, recovered bus energy, signed net terminal energy and internal battery loss are separated. Range is withheld until 500 m and positive net consumption; tariff cost excludes charging losses and billing rules. [SIMULATION_MODEL.md](SIMULATION_MODEL.md) records equations and assumptions.

## Verification and preserved evidence

Final phase 2 verification passed **36 unit tests, 18 application browser acceptance groups and 15 additional phase 2 acceptance groups**, plus the isolated engineering suite. The current receipts are `validation/unit-validation.json`, `validation/browser-validation.json` and `validation/phase2-browser-validation.json`. The phase 2 browser run exercised all 48 independent assemblies and compared all 60 wires and 87 terminals with source data; it reported no application errors or missing local assets. Browser checks covered 320, 390, 768 and 1440 pixel layouts. No physical hardware or authenticated Firebase account was tested.

| Current command or evidence | Scope |
| --- | --- |
| `npm test` | Numerical, telemetry, circuit arithmetic/source parsing, drivetrain, phase 2 asset hierarchy and live-display snapshot regression tests |
| `npm run test:browser` | Existing application behavior, controls, rendering, charts/export, local assets, fallback and responsive regression checks |
| `npm run test:engineering` | Lab selectors, source registers, calculators, invalid inputs, schematic and responsive checks |
| `npm run test:phase2` | Independent phase 2 acceptance; writes `validation/phase2-browser-validation.json` |
| `validation/wiring-source-verification.json` | Executed direct ZIP comparison: all 36 authoritative files matched |
| `validation/engineering-checks.json` | Earlier isolated calculation agreement, 42-item/60-wire referential consistency and original hash preservation |

Integrated wiring checks performed during phase 2 found all 60 rendered IDs, endpoints and source statuses equal to the CSV, zero JavaScript errors, correct GPIO34→W037 selection, working pan and no page overflow at 390/320 px. Independent phase 2 acceptance uses Python's CSV reader separately from the application parser. Screenshots show software states, not physical circuit testing. Fixture readings are isolated test data and are never published to Firebase.

The authoritative package remains unchanged. Forty-three unique earlier evidence/source files were recovered and hash checked during phase 1; their historical scope is documented in [docs/provenance/README.md](docs/provenance/README.md). The original dated `EV_EMS_FINAL_IMPLEMENTATION_AUDIT.md` is retained. The earlier external safety-copy deletion attempt was blocked by automatic approval review, so it remains outside the project and was available for direct phase 2 ZIP verification. The phase 1 cleanup receipt records that outcome.

Final cleanup removed the generated `.blend1` backup, superseded failure screenshots and duplicate intermediate test output. Required source inputs and unique engineering evidence remain. Automatic approval review also rejected deleting the duplicate `validation/phase2-regression` folder with the reason “blocked by policy.” That folder and the previously protected cache/safety-copy locations were left intact; all are excluded from the delivered ZIP. See `validation/phase2-cleanup-receipt.json`.

## Performance, limitations and delivery

Geometry is batched within semantic assemblies while preserving independent parts. The renderer limits pixel ratio, adapts shadows/resolution, and avoids rendering inactive views. Live screen textures are updated at a bounded rate. The wiring planner constructs source routes once when the lab loads. Runtime libraries and fonts are local. These optimizations do not establish a universal frame-rate guarantee; the more detailed phase 2 model and numerous movable assemblies have a meaningful mobile rendering cost.

Real Firebase account access, deployed RTDB rules, ESP32 publishing, sensor calibration and physical circuit validation remain unverified. No circuit was energized. Battery charge/fault limits, exact board identities, sensor selection, protection, fuse/conductor/switch ratings and power sequencing remain open.

The EV is an educational level-road point-mass scenario with simplified battery and constant-efficiency assumptions. There is no validated commercial vehicle model, charging session, thermal simulation, steering/handling, tire slip, suspension dynamics or BMS. Inspection transformations change presentation, not physical assembly constraints. The 96 V car is never a wiring guide for the 12 V monitor.

```text
ECS-Battery-Monitoring/
├── index.html, app.js, charts.js, style.css, studio.css
├── ev-simulation-engine.js, ev-vehicle-data.js, drivetrain-kinematics.js
├── vehicle-studio.js, vehicle-assembly.js, vehicle-displays.js
├── engineering-lab.js, engineering-lab.css, wiring-layout.js
├── firebase-config.js, telemetry.js, FIREBASE_SETUP.md
├── README.md, FINAL_REPORT.md, SIMULATION_MODEL.md, WIRING_LAYOUT.md
├── package.json, package-lock.json, .gitignore
├── assets/vehicle/                  active phase 2 assets and required source inputs
├── assets/fonts/                    local fonts and licenses
├── vendor/three/                    rendering and transform-control runtime
├── blender-workflow/                build scripts and preserved original models
├── FINAL_EV_EMS_ENGINEERING_PACKAGE/ current unchanged conditional authority
├── hardware-validation/             cited historical evidence
├── battery-monitoring-reference/    superseded reference and Wokwi source
├── docs/provenance/                 recovered original evidence
├── scripts/                        server, vendor and packaging tools
├── tests/                          unit and browser acceptance checks
└── validation/                     run-specific receipts, hashes and screenshots
```

[README.md](README.md) contains setup and execution instructions. `npm run package` targets `C:\Users\uppal\OneDrive\Desktop\EV_EMS_AAA_FINAL_PROJECT.zip`, excludes dependencies/caches/transient artifacts, verifies archived source hashes and checks ZIP CRCs. The included package manifest records source hashes; `validation/package-receipt.json` identifies the archive actually produced. An older archive or receipt must not be treated as proof of the later phase 2 contents.
