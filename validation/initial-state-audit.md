# Initial-state and preservation audit — 2026-11-03

The workspace was inspected in place before the redesign. It was **not a Git repository** (`git status` returned “not a git repository”), so there is no reliable staged/unstaged diff or commit history. The user's reported 17 edits cannot be independently reconstructed as exactly 17 changes. The 2026-11-02 implementation audit and external pre-cleanup copy provide the available historical comparison; their earlier success claims were not substituted for fresh verification.

## Existing root implementation reviewed

| Initial file | Initial state and disposition |
| --- | --- |
| `index.html` | Three primary sections were present. The circuit section embedded the final diagram, but 3D integration was explicitly under construction. The simulator had device controls and telemetry output, but no active vehicle viewer. Preserve useful IDs and functionality while completing the experience. |
| `app.js` | Navigation, charts, five-device bindings, simulation timing, cost and hardware N/A states worked at the source level. Theme began light; device inputs were blank, reset/braking could leave throttle input stale, and numeric clamping was not fully reflected in controls. Preserve real-data separation and improve interaction/state synchronization. |
| `style.css` | Responsive dashboard layout and light/dark variables existed, without the requested premium vehicle presentation. Rework visual styling while retaining responsive behavior and visible states. |
| `ev-simulation-engine.js` | Fixed-step integration, torque limits, terminal P=VI and separate device ledgers existed. Remaining bugs affected partial-throttle speed caps, work discarded at the cap, battery-limited supply, depletion, stopping regen and paused device demand. Fixed with regression tests. |
| `ev-vehicle-data.js` | 96 V / 150 Ah illustrative assumptions were correctly labeled. No current vehicle asset contract or initial auxiliary ratings. Preserve the educational boundary; add explicitly illustrative editable default loads. |
| `telemetry.js` | Minimal required aggregate schema, optional branch readings, source-tag rejection and timestamp checks existed. Derived branch multiplication/sum could overflow despite finite inputs. Fixed without inventing measurements. |
| `firebase-config.js` | Existing Email/Password configuration and read-only `readings/latest` / `.info/connected` subscriptions were retained. No synthetic source existed. On reconnect, a previously cleared unchanged record might not return to the UI. Added accepted-record restoration with original freshness semantics. |
| `FIREBASE_SETUP.md` | Configuration, authentication, read-only boundary and unverified provenance were documented. Clarified malformed optional data and reconnect behavior. No deployed rule or credential was changed. |
| `README.md` | Correctly described a disconnected demo, retained models and outstanding physical/Firebase validation; it did not describe a completed 3D release. Update for delivered architecture and actual validation. |
| `package.json` | Dependency-free ESM package with `node --test tests/*.test.mjs`; retain meaningful tests and add only necessary serving/render dependencies. |
| `EV_EMS_FINAL_IMPLEMENTATION_AUDIT.md` | Preserved dated audit of the preceding implementation. Its 12-test/browser results are historical claims, distinct from this release's fresh tests. |

The two existing test files were read and executed. Their 12 tests passed after implementing compatible explicit scenario defaults; the expanded simulation/telemetry suite now has 22 tests. The additional tests catch issues absent from the initial suite, including force and energy consistency at partial throttle, saturation/depletion, lossless-road kinetic work, stopping limits and derived telemetry overflow.

## Existing folders, assets and engineering

- `FINAL_EV_EMS_ENGINEERING_PACKAGE/`: 36 authoritative files, including the corrected 42-item BOM, 60-connection schedule, original diagrams, calculations, independent audit, source register and unresolved engineering decisions. Starting SHA-256 hashes are in `engineering-package-sha256.json`; all 36 matched the original final-package archive and remained unchanged after calculation verification.
- `hardware-validation/`: retained earlier conditional one-sensor handoff, older wiring/calculation evidence and selected provided references. These are historical, not the current two-load schematic or physical results.
- `battery-monitoring-reference/`: older proposal and Wokwi potentiometer source are explicitly historical. Different divider values must not be mixed with the final package. They do not validate a physical power path.
- `blender-workflow/`: existing generator scripts, ECS assembly GLB, ECS GT vehicle GLB and complete-car `.blend` source were retained. The old model's 41-wire metadata is not the final 60-connection design. Vehicle creation and final visual verification are recorded separately.
- `tests/`: current simulation and telemetry tests are retained and expanded. Fresh browser verification is a separate deliverable; this audit does not claim it occurred.

## External safety-copy findings and evidence recovery

The copy was found at `C:\Users\uppal\AppData\Local\Temp\EV_EMS_precleanup_20261102`. It contained obsolete viewer code, multiple old application backups, repeated GLB export revisions, test screenshots/logs, the earlier `Circuit_Details`, and duplicate archives. It was inspected without deletion.

Forty-three selected original evidence/source files (5,484,552 bytes) were restored byte-for-byte and hash checked, as listed in `preservation-manifest.json`: all 32 earlier Circuit_Details files; selected historical audit/model evidence; one earlier corrected schematic PNG/SVG; and the unique inspected assembly `.blend`. The numbered SVG copy was identical and was not duplicated. The extracted earlier and final packages were both proven identical to the entries in their corresponding original ZIPs. `ecs.zip` contained older code, generated model revisions, browser artifacts and caches; no additional unique primary engineering handoff was identified there.

The original final package remains the sole current engineering authority. Recovered sources are labeled superseded under `docs/provenance/README.md`. Existing original sources are preserved; obsolete code and nested backups are not restored as another application.

## Engineering checks actually performed

The final package's calculation script writes beside itself, so it was copied into an isolated temporary directory before execution. Its generated JSON matched the authoritative results exactly. The read-only consistency verifier passed: **42 BOM items, 60 wires, zero unresolved netlist endpoints**. These checks establish documentary consistency, not resolution of TBD component identities or physical safety. Both commands exited 0 and package hashes still matched; see `engineering-checks.json`.

## Cleanup decisions

No external safety copy was deleted by this audit. Once the finished project, assets, browser interactions, final archive and evidence have been verified, the exact directory `C:\Users\uppal\AppData\Local\Temp\EV_EMS_precleanup_20261102` is the remaining obsolete safety-copy candidate. Its unique primary evidence and useful editable model source are now preserved. Verify the resolved path before any deletion.

Any current root `assets-vehicle-build.log` / `assets-vehicle-build-error.log` are active build diagnostics while modeling runs; keep useful final output under `validation/`, and remove only empty or redundant copies after the process ends. Likewise remove generated `.blend1`, cache files and intermediate renders only after the corresponding final model and render have been verified. Do not remove `FINAL_EV_EMS_ENGINEERING_PACKAGE`, the recovered provenance, original useful model sources, current tests or final validation evidence. No unrelated Desktop archive was approved for removal by this audit.

Physical circuit validation, sensor calibration, actual ESP32 data, real Firebase account access and deployed RTDB rules remain unverified. Software-only device control is isolated from the physical monitor; no hardware actuation is offered.
