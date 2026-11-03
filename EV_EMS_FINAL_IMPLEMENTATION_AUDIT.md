# EV EMS Final Implementation Audit

**Date:** 2026-11-02  
**Disposition:** Software integration is ready for a disconnected-mode demonstration. The proposed 12 V circuit is not approved for construction. No physical hardware or real Firebase account was tested.

This report records an independent review of the original website, Firebase adapter, EV simulator, inherited project evidence and all files in `FINAL_EV_EMS_ENGINEERING_PACKAGE/`. The final engineering package was preserved byte-for-byte; its conditional design claims were not promoted to physical facts. The package's own [independent audit](FINAL_EV_EMS_ENGINEERING_PACKAGE/INDEPENDENT_AUDIT_REPORT.md) and [source register](FINAL_EV_EMS_ENGINEERING_PACKAGE/07_References/source_register.md) remain available.

## Classification summary

| Classification | Finding |
| --- | --- |
| **Confirmed correct** | Separately metering Light and Motor load power requires distinct branch-current measurements and voltage measurements at the corresponding electrical boundaries. The final package defines this as a conditional reference architecture. |
| **Confirmed correct** | The 68 kΩ/10 kΩ divider and 27 kΩ/20 kΩ scaler arithmetic below agrees with independent calculation. Component, ADC, battery, fuse and wiring limits remain conditional. |
| **Incorrect — corrected in software** | Firebase authentication previously started synthetic 12 V data and displayed a connected state. The website now reads only `readings/latest`; it displays N/A/empty states until a valid record arrives. |
| **Incorrect — corrected in software** | The previous EV speed cap limited speed but allowed full motor power to continue at the cap. The revised force model caps tractive force to road load at full throttle. |
| **Incorrect — corrected in software** | The previous EV UI had one aggregate auxiliary slider, not five independent devices. The revised simulator has five controls with unset auxiliary watt assumptions. |
| **Requires additional information** | Battery identity and limits; actual board, motor and sensors; fuse interrupt/time-current ratings; conductor, switch and connector ratings; and calibration are not established by the package. |
| **Unverified — do not assume** | No physical publisher provenance, live ESP32 sample, Firebase permissions, build safety, component installation, or accuracy of the retained 3D model has been verified. |

## Confirmed calculations and source scope

### Divider and ADC

For the proposed 68 kΩ top / 10 kΩ bottom divider:

`k = Rbottom / (Rtop + Rbottom) = 10 / (68 + 10) = 0.1282051`

At the package's **assumed** 18 V DC input ceiling:

- Nominal ADC input: `18 × 0.1282051 = 2.3077 V`.
- With independent 1% resistor extremes, maximum ratio is `10.1 / (67.32 + 10.1) = 0.1304572`; maximum node voltage is `18 × 0.1304572 = 2.3482 V`.
- The worst-corner input at 2.45 V is `2.45 / 0.1304572 = 18.7801 V`.
- Divider current at 18 V is `18 / 78,000 = 0.23077 mA`; total resistor dissipation is `18² / 78,000 = 4.1538 mW`.

Espressif's classic ESP32 ADC guide gives an approximate **suggested accuracy range** of 150–2450 mV for 11 dB attenuation. This is not a pin absolute-maximum rating and does not prove the unknown board's configuration or accuracy. [Espressif ESP-IDF v4.2 ADC guide](https://docs.espressif.com/projects/esp-idf/en/v4.2/esp32/api-reference/peripherals/adc.html)

The divider is **not demonstrated safe for the installed battery**: 18 V is an assumption, not the battery maximum charging voltage or transient ceiling. At 1% worst case it reaches the cited 2.45 V suggested ADC ceiling at about 18.78 V. Protection, ADC calibration, fault behavior and unpowered-MCU backfeed remain unresolved.

### ACS712 conditional output scaler

For 27 kΩ series / 20 kΩ shunt:

`kI = 20 / (27 + 20) = 0.425532`

Using the Allegro ACS712-30A IC's 5 V typical zero output (2.50 V) and 66 mV/A typical sensitivity at 25 °C:

- Zero-current ADC node: `2.50 × 0.425532 = 1.0638 V`.
- +30 A nominal raw output: `2.50 + 30 × 0.066 = 4.48 V`; scaled node: `4.48 × 0.425532 = 1.9064 V`.
- ADC-side sensitivity: `66 mV/A × 0.425532 = 28.085 mV/A`.
- A ±60 mV ADC error budget corresponds to `60 / 28.085 = 2.136 A`; at 0.5 A, the intended signal shift is only about `14.04 mV` (about 427% of that error magnitude).

The arithmetic is correct for the **bare IC output and stated conditions**, but it does not establish an installed module's ratings or suitability. Allegro lists the ACS712 supply and sensitivity conditions and explicitly says the device is not intended for automotive applications. [Allegro ACS712 datasheet](https://www.allegromicro.com/-/media/files/datasheets/acs712-datasheet.ashx). The 0.5 A comparison is a resolution warning; it is not a complete system error model. A Light branch sensor (`S_L`) remains unselected.

### Power, energy, cost and capacity arithmetic

- Electrical power: `P = V × I`.
- Discrete energy integration: `E(Wh) = Σ[P(W) × Δt(s)] / 3600`.
- Tariff cost: `₹ = E(Wh) / 1000 × tariff(₹/kWh)`.
- Package example (assumptions only): Light `12 V × 0.5 A × 2 h = 12 Wh`; Motor `12 V × 4 A × 0.25 h = 12 Wh`; total `24 Wh = 0.024 kWh`; at assumed ₹8/kWh, cost is `₹0.192`.
- The Amptek product table candidate's nominal arithmetic is `12 V × 7.6 Ah = 91.2 Wh`. The physical battery model/revision, chemistry and charge/discharge/short-circuit limits are not confirmed. [Amptek product table](https://amptek.aukark.co.in/electric-toy-ride-ons/)

### EV speed-cap force and power recalculation

The inherited scenario defaults are assumptions: mass 720 kg, `Cd = 0.34`, frontal area 1.9 m², `Crr = 0.012`, speed cap 22 m/s, motor efficiency 0.90, inverter efficiency 0.93, nominal pack 96 V / 150 Ah and internal resistance 35 mΩ. They do not describe a commercially available EV.

At 22 m/s on level ground with air density 1.225 kg/m³:

- `Fdrag = 0.5 × 1.225 × 0.34 × 1.9 × 22² = 191.5067 N`.
- `Froll = 0.012 × 720 × 9.81 = 84.7584 N`.
- `Froad = 191.5067 + 84.7584 = 276.2651 N`.
- Holding mechanical wheel power: `Pwheel = 276.2651 × 22 = 6077.8322 W`.
- With the inherited motor/inverter efficiencies and no auxiliary devices entered: `Ppack ≈ 6077.8322 / (0.90 × 0.93) = 7261.45 W`.

The earlier implementation could continue to request 18 kW mechanical output at the cap, which implied roughly 818 N at 22 m/s and substantially more force than the road load. The new model limits full-throttle tractive force at the cap to the road-load force, so holding-speed force and power agree. This software correction does not validate the assumed vehicle, efficiency, battery or road model.

The nominal EV pack arithmetic is `96 × 150 = 14,400 Wh`. The OCV curve, NMC label, 150 Ah capacity, 35 mΩ resistance, 10% range reserve, 18 kW motor, torque, efficiencies, regen fraction and 10 kW regen ceiling are **model assumptions**, not verified battery data. Range is deliberately N/A until the model accumulates at least 500 m and positive net pack energy use. The resulting distance is a scenario extrapolation, not a range claim. DOE notes real EV range varies with temperature, speed, acceleration, cargo and grade. [U.S. DOE AFDC EV basics](https://afdc.energy.gov/vehicles/electric-basics-ev)

## Incorrect findings corrected in the website

1. **Synthetic hardware telemetry after sign-in.** Previous `firebase-config.js` switched to `simulated-connected` and called the demo generator in `app.js`. Both paths are removed. The revised Firebase integration reads only the configured Realtime Database `readings/latest` path, separates authentication and database connectivity, rejects invalid records, clears absent/invalid data and labels stale records. `source: "esp32"` is shown as a tag, not physical provenance.
2. **Required optional fields.** The prior validator required temperature and motor state even when no such device was identified. The revised schema keeps aggregate voltage/current/power/energy and timestamp/source required while optional temperature, motor state and branch values stay N/A when absent.
3. **No individual branch evidence.** The old schema had only aggregate values, so it could not substantiate separate Light and Motor current/power. The page now computes each branch's power only from its own supplied voltage/current pair, and sums branch powers only when both pairs exist. The firmware and live record do not yet provide or verify those fields.
4. **One load control presented against five requested devices.** The old simulator offered one aggregate auxiliary slider. The revised model has independently switchable Traction motor, Headlights, Air conditioning, Cabin lights and Infotainment. Auxiliary watt fields begin empty; no vehicle appliance ratings are invented.
5. **Speed-cap force/power discontinuity.** At the 22 m/s cap, the old model still demanded motor maximum power. The new torque/power limited force model matches full-throttle tractive force to level-road drag plus rolling resistance at the cap.
6. **Ambiguous signed energy.** The former signed `energyUsedWh` could fall during regeneration without separating loads from recovered energy. The new bookkeeping tracks gross pack-side draw, recovered regenerative energy and net energy separately, computes device energy independently, updates SoC by coulomb counting, and preserves terminal `P = V × I`.
7. **Incompatible illustrative EV harness endpoints.** `EV_W10` joined a DC/DC output to CAN_H and `EV_W11` joined cooling output to HV− in the old viewer data. Those wires and the active viewer were removed from the website model. The page marks 3D integration under construction because retained 3D metadata describes a prior, mismatched design.

## Requires additional information before electrical construction

The final package is a conditional reference design, not construction approval. The following cannot be settled by software or by a nominal component value:

- Exact battery label/model/revision, chemistry, maximum charge voltage/current, discharge current, temperature limits, usable capacity, internal resistance and prospective short-circuit current.
- Exact ESP32 carrier board and schematic; physical header pin mapping; power sequencing and prevention of sensor backfeed while the MCU is unpowered.
- Exact ACS712 suffix/module, board trace copper, terminal/current rating, onboard output scaling, filter and bypass implementation. The candidate IC's automotive exclusion must be respected.
- A low-current Light sensor selected for the actual lamp current, with an error budget that supports the intended measurement resolution.
- Motor type, controller topology, rated/start/stall current, regenerative behavior, voltage, and whether the driver is a reversing H-bridge.
- F1, FL, FM and F2 DC voltage rating, interrupt rating above available fault current, time-current and I²t selection; fuse-holder compatibility; conductor ampacity and coordination.
- Switch DC/inductive interruption rating; wire gauge, insulation, length, voltage drop; terminal/lug and busbar ratings; reverse-polarity and transient suppression values.
- Actual measured channel boundaries, firmware calibration, sample timing, sensor accuracy and energy integration procedure.

Littelfuse's fuse guidance treats voltage, interrupt rating, time-current response and I²t as selection factors; no rating can be chosen from the load's nominal current alone. [Littelfuse Fuse Fundamentals](https://www.littelfuse.com/assetdocs/fuse-fundamentals-technical-paper?assetguid=82021200-8d3c-4449-843b-4959181a04af). TI's LM2596 IC data gives 4.5–40 V input and up to 3 A under its data-sheet conditions; it does not prove an unidentified assembled buck module's thermal/current capability. [TI LM2596 datasheet](https://www.ti.com/lit/ds/symlink/lm2596.pdf)

## Unverified — do not assume

- The physical low-voltage circuit has not been assembled, powered, calibrated or safety-tested.
- No real ESP32 sensor record was received; RTDB deployment, database rules, user account access and read permissions were not exercised.
- The Firebase record's `source` value is not authenticated device provenance. A browser-readable path cannot independently attest its publisher.
- The old Wokwi potentiometer run and old Blender/GLB images are not physical circuit proof and are not treated as current validation.
- Existing GLBs/Blend files are retained as future assets but their old 41-wire metadata is not aligned to the final 60-connection schedule. The site does not load or label them as the corrected engineering model.
- 96 V EV range, battery state, costs and regeneration are software calculations under editable assumptions only.

## Exact files and sections that still require revision or evidence

### Project implementation completed in this release

- `index.html` — exactly three sections; no fake telemetry state; conditional schematic and explicit 3D construction notice; five-device simulator controls.
- `app.js` and `telemetry.js` — optional branch/tachometer handling, N/A states, tariff estimate and branch boundary rules.
- `firebase-config.js` and `FIREBASE_SETUP.md` — authenticated read-only listener to `readings/latest`, clear auth/database/data states and current schema.
- `ev-simulation-engine.js`, `ev-vehicle-data.js`, `tests/ev-simulation.test.mjs` — fixed-step model, force/power speed-cap correction, five device energy ledgers, SoC, gated range, tariff cost and test coverage.
- `README.md` — corrected description and no hardware proof claims.

### Engineering items that remain unresolved in the preserved package

- `FINAL_EV_EMS_ENGINEERING_PACKAGE/02_Component_Details/component_list.csv` — BAT1, `S_L`, `S_M_BOARD`, `U_BUCK_BOARD`, `U_ESP`, F1/FL/FM/F2, RP1, TVS1, SW1, WIRE and J1 identities/ratings need actual part markings or manufacturer documents.
- `FINAL_EV_EMS_ENGINEERING_PACKAGE/02_Component_Details/unresolved_component_identification.md` — obtain physical identifiers, board photos and source documents before claiming specific installed hardware.
- `FINAL_EV_EMS_ENGINEERING_PACKAGE/03_Circuit_Design/wiring_connections.csv` and `pin_mapping.md` — conditional endpoints and logical GPIO candidates need confirmation against the actual board and exact sensor modules.
- `FINAL_EV_EMS_ENGINEERING_PACKAGE/03_Circuit_Design/2D_circuit_schematic.svg` and `.png` — retain as a conditional reference; revise only after exact parts, ratings, grounding, power sequencing and protection have been resolved.
- `FINAL_EV_EMS_ENGINEERING_PACKAGE/04_Measurement_and_Calculations/current_measurement.md`, `voltage_measurement.md` and `calibration_requirements.md` — branch sensor, channel transfer, errors, sampling and calibration need the real instruments and firmware.
- `FINAL_EV_EMS_ENGINEERING_PACKAGE/05_Protection_and_Safety/fuse_and_protection_requirements.md`, `motor_and_inductive_load_protection.md`, `reverse_polarity_and_transient_protection.md` and `unresolved_safety_decisions.md` — choose coordinated protection only after battery fault data and load/conductor ratings are known.
- `FINAL_EV_EMS_ENGINEERING_PACKAGE/06_Validation/simulation_and_test_plan.md` — physical acceptance tests remain future work; do not label software checks as hardware validation.
- `firebase-config.js` — live project configuration is preserved, but verify project ownership and deployed rules in the Firebase Console before exposing telemetry to users.

## Verification performed

- `npm test`: 12 tests passed, 0 failed. Covers telemetry schema and optional branch power, source labeling, device independence, P = V × I, force/power at the speed cap, fixed-step equivalence, energy/SOC and regen bookkeeping, range gating, tariff conversion and reset behavior.
- Browser opened the local site over HTTP. Initial state showed exactly one active primary section, no measurements, and a signed-out Firebase state; no browser errors or warnings were observed on initial load.
- Browser checks opened the circuit section and loaded the final PNG schematic. Simulator controls were exercised for all five devices; power, device Wh, SoC, tariff cost and simulated chart updated.
- Responsive checks at 390 px and 320 px showed no page-width overflow; mobile navigation switched between the sections and the schematic image remained loaded.
- Static package validation and final archive validation are recorded in the completion response after cleanup.

These checks are software/browser checks only. They do not establish physical circuit safety, Firebase account permissions or live ESP32 data.
