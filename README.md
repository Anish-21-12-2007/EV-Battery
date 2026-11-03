# EV-EMS — Electric, by design

A local EV engineering experience with three primary sections: a read-only energy monitor, an interactive 3D electrical lab, and the Aeris GT vehicle simulator. The advanced lab adds Blender-built circuit components, terminal-bound curved wires and a conventional schematic. The revised 2+2 cabin retains 48 independently selectable vehicle assemblies and now shows five-device trip energy on its actual infotainment screen.

The proposed **12 V educational monitoring circuit** and **96 V illustrative vehicle scenario** are separate systems. The vehicle geometry and conditional engineering handoff are not physical construction approval.

Security note: this repository intentionally does not ship production Firebase credentials. Copy `.env.example` to `.env` or update `firebase-config.js` with a real Firebase Web App configuration before enabling the live telemetry monitor. Never commit real API keys, service-account files, or `.env` values.

## Run locally

Use Node.js 20 or newer. From this folder:

```powershell
npm start
```

Open [http://127.0.0.1:5500](http://127.0.0.1:5500). The server binds to the local computer. Serve over HTTP rather than double-clicking `index.html`. Set `$env:PORT = 5501` before starting it to use another port.

Three.js, fonts, model assets and engineering files are local, so the studio and lab work without external services once served. Firebase and external reference websites require internet access. Missing Firebase access produces an unavailable state and N/A measurements.

## Drive and operate the vehicle

1. Press **Drive** to enable traction, release the brake, set 18% throttle and start the simulation. Wheels, brake discs, gears and shafts turn from integrated travel. **Start simulation** runs the existing control settings; it does not engage traction automatically and can be used for stationary auxiliary loads.
2. Use the five independent device controls: traction motor, headlights, air conditioning, cabin lights and infotainment. Auxiliary watt fields are editable scenario assumptions. **Pause** freezes simulation time and demand; **Reset** clears the run.
3. Choose **Open energy screen** for a viewport-filling close-up of the actual modeled infotainment display, or **Look inside** for the cabin. **Full screen**, **Pan**, **Orbit**, zoom and **Reset view** operate on the same 3D canvas. The energy view also reveals a hidden screen and stops automatic orbit. Its live texture shows only each device's electricity consumed in kWh, percentage of assumed usable battery capacity consumed, cost in rupees, and their combined total. Device OFF/PAUSED states remain visible. The driving instrument cluster remains separate.
4. Enter **Electricity cost per kWh (₹/kWh)** beside the device switches. Costs recalculate immediately. Switching OFF stops future accumulation and keeps the previous trip energy. **Reset trip energy** clears the ledgers while retaining battery charge, switches and motion; the existing **Reset** action resets the whole simulation. The retained energy page stays visible when the infotainment load is OFF.
5. Default battery arithmetic is 96 V × 150 Ah = 14.4 kWh nominal. The screen uses 12.96 kWh assumed usable, from the editable 10% reserve; this is explicitly unverified. Range remains N/A until at least 0.5 km and positive net energy use. Applying new vehicle assumptions resets the scenario. **Export run** saves actual simulated samples and their assumptions.

The studio retains orbit/zoom, camera presets, three paint finishes, studio/night lighting, rendering quality controls and exterior/cutaway/exploded/mechanism/energy views. Meaningful wheel and drivetrain rotation remains active under reduced-motion preferences; automatic orbit and cinematic camera motion respect that preference.

## Inspect and disassemble

The assembly workbench exposes 48 groups, including the battery, motor, inverter, rotor/gears/differential/shafts, individual wheels/discs/calipers/suspension units, four seats, doors, bonnet, dashboard and displays.

Select a part on the vehicle or from the component menu. **Move** and **Rotate** provide 3D axis gizmos plus numeric offsets in metres or degrees. **Focus part**, **Hide/Reveal part** and **Reset part** work independently. **Exploded** separates the assemblies; **Restore complete assembly** clears offsets and hidden states. These inspection edits do not change the physics or consumption model.

The default reduction is `(41/15) × (60/20) = 8.2:1`. Rotation follows traveled distance and wheel radius; calipers and suspension stay fixed. This is straight-line kinematics, without tire slip, cornering differential behavior or suspension dynamics. Editing scenario ratios or wheel radius does not rebuild the fixed geometry. See [SIMULATION_MODEL.md](SIMULATION_MODEL.md).

## Explore the circuit and monitor

**3D physical assembly** is the lab's first tab. Blender-built candidate components include recognizable PCBs, headers, USB connector, antenna, screw terminals, resistor bands, capacitors, inductor, battery, loads, switch, fuse holders, OLED and temperature probe. All 60 original wire rows connect 87 modeled logical contacts on 33 connected components. Select a wire to see its full path, endpoints and source condition. Orbit, zoom, pan, component selection, move/rotate gizmos and numeric offsets, hide/reveal, reset and assembled/exploded views are available. Wires follow the contacts after inspection edits.

**Electrical schematic** uses conventional battery, resistor, capacitor, fuse, switch, lamp and motor symbols, module pins, junctions, ground symbols and repeated electrical-net labels generated from the same CSV. A wire/net index preserves every source endpoint and condition. The supplied source drawing is retained in a separate disclosure. The existing 2D wiring planner, functional architecture, 42-item BOM and calculators remain available.

Exact board variants, physical header positions, dimensions, fuse ratings and conductor sizes are not established by the source package. Geometry and wire colours/thicknesses are illustrative. Contacts are explicitly **UNRESOLVED physical placements**. RLY1 is quantity zero; RP1 and D1 have no scheduled wires. W060's TVS return and the optional probe pullup are unresolved rather than invented. See [CIRCUIT_LAB.md](CIRCUIT_LAB.md) and [WIRING_LAYOUT.md](WIRING_LAYOUT.md).

The **Hardware proposal** tab provides a separate revision B using identified ESP32-DevKitC-32E, two Adafruit INA219 904 modules, OLED 4440, two MOSFET drivers 5648, a Pololu 3041 motor and a selected Adafruit 5864 lamp section. Its proposed connections, measurement boundaries and staged checks are in [hardware-build-proposal.md](docs/hardware-build-proposal.md). It is a USB-logic/current-limited-bench proposal; the existing battery, buck and fuse holder are unqualified. Do not mix this schedule with the inherited analog circuit. The [electrical audit](docs/advanced-circuit-audit.md) flags the original converter return loop, incompatible sensor alternatives and incomplete protection directly in the 3D inspector. [Manufacturer cross-checks](docs/manufacturer-cross-check.md) correct component limits and arithmetic without changing the historical package.

The **Energy monitor** retains read-only Firebase `readings/latest` integration, separate account/database/record states, aggregate and optional branch readings, graphs, recent records, energy and entered-tariff cost. It has no actuator and never substitutes simulator values for physical measurements. An `esp32` source tag alone does not prove origin. See [FIREBASE_SETUP.md](FIREBASE_SETUP.md).

## Current assets and preserved sources

- Active editable vehicle: [assets/vehicle/ev-ems-gt-phase2.blend](assets/vehicle/ev-ems-gt-phase2.blend).
- Active web vehicle: [assets/vehicle/ev-ems-gt-phase2.glb](assets/vehicle/ev-ems-gt-phase2.glb); current dimensions, groups, screen UV contract and export counts: [model-manifest-phase2.json](assets/vehicle/model-manifest-phase2.json).
- Editable circuit: [assets/circuit/circuit-lab.blend](assets/circuit/circuit-lab.blend); optimized web asset: [circuit-lab.glb](assets/circuit/circuit-lab.glb); terminal/source contract: [circuit-manifest.json](assets/circuit/circuit-manifest.json).
- `assets/vehicle/ev-ems-gt.blend` is the required base source for `blender-workflow/scripts/build_ev_ems_phase2.py`; it is not a disposable backup. Phase 1 assets and evidence are distinct from the current phase 2 export. Model workflow details are in [assets/vehicle/README.md](assets/vehicle/README.md).
- The [final engineering package](FINAL_EV_EMS_ENGINEERING_PACKAGE/README.md) is preserved unchanged. Phase 2 directly compared all 36 files with the original ZIP; all matched.
- Historical models, circuit inputs and recovered [provenance](docs/provenance/README.md) remain as cited source evidence. The [2026-11-02 implementation audit](EV_EMS_FINAL_IMPLEMENTATION_AUDIT.md) describes the earlier implementation.

## Test and package

Browser tests require an installed Microsoft Edge and the locked Playwright dependency. Phase 2 source validation and packaging also require Python 3 available as `py` on Windows.

```powershell
npm ci
npm test
npm start
```

Keep the server running, then use a second terminal:

```powershell
npm run test:browser
npm run test:engineering
npm run test:phase2
npm run test:circuit
npm run test:energy
npm run test:camera
```

Application browser tests default to port 5500; set `EV_EMS_TEST_URL` for another address. The isolated engineering test serves its own fixture. Phase 2 results are written to `validation/phase2-browser-validation.json`. Other reports and screenshots remain in `validation/`; use each receipt's scope and date to distinguish earlier results from the current release. Test fixtures never publish telemetry or operate hardware.

`npm run vendor` refreshes the checked-in Three.js runtime from the locked dependency. After all required receipts pass, `node scripts/verify_advanced.mjs` freezes the tested source and evidence hashes. `npm run package` writes `EV_EMS_AAA_FINAL_PROJECT.zip` beside this project directory, excluding dependencies, caches and transient artifacts. The package receipt records the completed archive's checksum and verification. Acceptance covers software behavior and specified documentary checks, not physical construction approval.

See [FINAL_REPORT.md](FINAL_REPORT.md) for the current architecture, implementation, evidence and limitations. Real Firebase account access, installed component identification, sensor calibration and physical circuit validation remain outstanding.
