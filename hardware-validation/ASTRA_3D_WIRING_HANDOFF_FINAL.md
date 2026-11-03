# ASTRA final 3D wiring handoff — 13 October 2026

The existing ECS website and hardware model have been corrected in place. This package supersedes the earlier illustrative wiring and the supplied audit where corrections are listed below. **It is a conditional educational circuit reference, not a build-ready or hardware-verified assembly.**

## Authority and status

`corrected-wiring-table.csv` is the conductive-edge authority. It drives the GLB wires and inspector through `assembly-reference.json`. `wire-routes.json` contains the exact source/destination coordinates and sampled 3D paths. `corrected-schematic.png` includes the complete terminal schedule. `remaining-verification.md` provides source citations, status definitions and a physical verification sequence.

- VERIFIED: the particular documented fact or performed check is directly supported. No physical connection receives this status.
- CALCULATED: explicit arithmetic supports the passive circuit topology; does not establish installed hardware.
- SIMULATED: reserved for actually executed simulations with specified coverage. No new electrical simulation was performed here.
- CONDITIONAL: valid only under the stated component/implementation assumptions.
- UNVERIFIED: not enough evidence to establish the component/connection.

Solid wires show the calculated passive network. Dashed wires show CONDITIONAL or UNVERIFIED proposals. **All ports on reference plaques are logical net names, not physical header positions or a verified connector pin order.** The exact board pinout is unknown; no wire is claimed to terminate on an identified physical GPIO header contact. Battery posts use existing represented locations, with actual terminal geometry still unverified. Component dimensions are illustrative and not suitable for fabrication.

## Corrected architecture

BAT+ → F1 → SW1 → ACS IP+ → IP− → J1 load bus. J1 feeds the motor and F2. Motor negative returns separately to BAT− star. F2, at the branch takeoff, feeds both LM2596 IN+ and R3 voltage-divider top. Buck IN− returns to BAT−. Buck OUT− feeds J2 logic ground; the module must be verified non-isolated/common-ground. Buck OUT+ is set and measured at 5.00V and supplies the documented ESP32 5V input and ACS VCC. Do not connect USB simultaneously.

ACS OUT → R1 27k → JA → GPIO34, with R2 20k and C1 100nF from JA to J2. F2 OUT → R3 68k → JB → GPIO35, with R4 10k and C2 100nF from JB to J2. R1–R4 are 1%; use suitable rated components (0.25W is ample for nominal divider dissipation, not proof of fault safety). R5 is the proposed 4.7k pullup from 3V3 to DS18B20 DQ. OLED is supplied only from 3V3 and only if its exact module supports that rail. I²C pullups must be to 3V3. GPIO21/22 are configured SDA/SCL; GPIO4 is the proposed 1-Wire pin.

C3 100nF is a proposed motor brush-noise capacitor, not an inductive energy clamp. D1 is a provisional flyback diode for a simple unidirectional brushed motor: K → motor+, A → motor−. The specific diode, current/energy rating and switching transient behavior remain unresolved. Do not substitute an arbitrary diode, reverse the motor supply, or infer adequacy from the picture. Keep suppression leads short at the actual motor; the display spacing is enlarged to identify parts.

F1 and F2 both have **rating TBD**. There is no 30A approval or calculated approval of a 1–2A fuse. Relay supply, input and COM/NO/NC remain completely unwired; GPIO25 is reserved and absent from the conductive CSV. No remote shutdown is implemented. TVS/clamp and reverse-polarity protection details remain open and no unsupported parts are drawn as installed. The DS18B20 is proposed, not known present; its case placement is a mechanical relation, not an electrical wire.

## Calculation results and practical limits

`calculations.py` reproduces all values in `calculations.json`. At 18V assumed maximum DC sense voltage, the 68k/10k node is at most 2.34823V with 1% resistor corners. This is not an Amptek charge or transient rating. The 27k/20k current attenuator bounds a 5.5V output at 2.36736V at resistor corners. Nominal zero is 1.06383V; nominal sensitivity is 28.0851mV/A; nominal ±30A endpoints are 0.22128V and 1.90638V. The resistor networks with 100nF have nominal poles of 182.56Hz and 138.52Hz respectively.

The 2.45V target is the classic ESP32 characterized accuracy upper range, not a hard universal clipping voltage. Adequate input range does not establish measurement accuracy. A ±60mV ADC error alone corresponds to about ±0.468V referred to the voltage input or ±2.136A with the proposed current scaling; these are arithmetic illustrations of a documented ADC error bound, not predicted typical performance or a complete error budget. Calibration is essential; averaging does not remove gain/nonlinearity errors. Sensor output must not energize an unpowered MCU. Dividers alone do not protect against faults, reverse polarity or motor surges.

The example buck input budget is 0.391A at 10.5V for assumed 5V/0.60A output, 75% efficiency plus 10mA allowance. It neither sizes F2 nor validates a specific module. The actual peak load, efficiency, startup and thermal behavior must be measured.

## Measurement meanings

- Voltage is the protected load-bus voltage relative to logic ground, downstream of F1, SW1, ACS, F2 and wiring drops. It is not a Kelvin measurement of the battery posts.
- Current is all current through the switched ACS discharge path, including electronics; it does not capture a charger connected directly to the battery.
- Vprotected × Ipath approximates downstream electrical power. It excludes upstream loss and is neither exact battery-terminal power nor motor shaft power.
- “Motor off” is not zero sensor current: electronics remain supplied through ACS. Calibrate true zero with the primary path open and an independent regulated sensor/logic supply, with normal buck output disconnected and no competing supplies. Never erase electronics consumption using a boot offset or deadband for coulomb counting.
- Temperature can be case-surface measurement only after a real sensor is installed and verified. Check conversion completion/CRC; 85C is a reset value before conversion but may also be a valid temperature. −127 is a library sentinel, not the DS18B20 raw output.
- SoC/Ah/Wh require a known initial state, battery-specific model and charge history. No accuracy percentages, Peukert exponent, loaded-voltage percentage or usable 91.2Wh claim is established. 91.2Wh is nominal multiplication only. Current-based motor status cannot distinguish rotation from stall.
- The website telemetry/estimator behavior is unchanged. The 3D module supplies no values to Firebase or the dashboard.

## Corrections to the supplied audit

1. Removed the legacy battery-negative-to-fuse wire and all invented relay wires.
2. Increased divider margins consistently across calculation, CSV, schematic, model and inspector. The supplied calculation script still used 56k while its text said 62k; even 62k/10k gives 2.5V at the original 18V ceiling.
3. Replaced nominal-only 15k/20k current range with 27k/20k rail/tolerance bounds.
4. Put the voltage sense takeoff after branch protection and named the measured point accurately.
5. Removed approval implications for F2 and “any LM2596 module is adequate.”
6. Corrected current auto-zero, system accuracy/SoC assertions, DS18B20 sentinel handling and motor-status semantics.
7. Recognized the rocker as an inductive-load switch requiring suppression review; added explicitly provisional D1.
8. Expanded omitted C1/C2 ground leads, both R5 leads, motor C3 and junctions to explicit endpoint pairs. Composite placement/optional/reserved rows are not conductive wires.
9. Distinguished historical reported Wokwi execution from new verification; discarded I²C return values cannot prove ACKs.

## Component interfaces

| ID | Component | Logical terminals |
|---|---|---|
| battery | 12 V · 7.6 Ah VRLA battery | BAT+, BAT- |
| fuse | F1 · main fuse, rating TBD | IN, OUT |
| switch | SW1 · DC rocker, rating TBD | IN, OUT |
| acs712 | ACS712 · proposed 30 A variant | IP+, IP-, VCC, GND, OUT |
| bus | J1 · positive load distribution | + |
| motor | M1 · DC motor, ratings unknown | +, - |
| fuse2 | F2 · branch fuse, rating TBD | IN, OUT |
| lm2596 | LM2596 · set output to 5.00 V | IN+, IN-, OUT+, OUT- |
| esp32 | Classic ESP32 development board | 5V, GND, 3V3, GPIO34, GPIO35, GPIO21, GPIO22, GPIO4 |
| oled | 0.96-inch OLED · proposed I²C | VCC, GND, SDA, SCL |
| relay | Relay module · NOT CONNECTED | None routed; relay terminals TBD |
| temperature | DS18B20 · proposed case probe | VDD, GND, DQ |
| ground | J2 · logic ground junction | GND |
| r1 | R1 · 27k 1% | A, B |
| r2 | R2 · 20k 1% | A, B |
| c1 | C1 · 100nF | A, B |
| r3 | R3 · 68k 1% | A, B |
| r4 | R4 · 10k 1% | A, B |
| c2 | C2 · 100nF | A, B |
| r5 | R5 · 4.7k | A, B |
| c3 | C3 · 100nF ≥50V | A, B |
| d1 | D1 · diode TBD | K, A |
| nodea | JA · current ADC node | NODE |
| nodeb | JB · voltage ADC node | NODE |

## Complete conductive schedule

Each row corresponds to exactly one `Wire_<ID>` GLB mesh, including its dashed segments in one mesh. Internal component function (resistance, capacitance, fuse, switch, ACS primary, buck converter) is not drawn as a separate decorative wire. Multiple wires terminating on JA/JB/J1/J2 are intentional junctions. Wire crossings elsewhere do not indicate junctions.

| ID | Source | Destination | Group | Status | Depiction |
|---|---|---|---|---|---|
| W01 | battery.BAT+ | fuse.IN | battery | CONDITIONAL | dashed |
| W02 | fuse.OUT | switch.IN | battery | CONDITIONAL | dashed |
| W03 | switch.OUT | acs712.IP+ | battery | CONDITIONAL | dashed |
| W04 | acs712.IP- | bus.+ | battery | CONDITIONAL | dashed |
| W05 | bus.+ | motor.+ | motor | UNVERIFIED | dashed |
| W06 | motor.- | battery.BAT- | return | UNVERIFIED | dashed |
| W07a | motor.+ | c3.A | motor | CONDITIONAL | dashed |
| W07b | c3.B | motor.- | return | CONDITIONAL | dashed |
| W08 | bus.+ | fuse2.IN | branch | CONDITIONAL | dashed |
| W09 | fuse2.OUT | lm2596.IN+ | branch | CONDITIONAL | dashed |
| W10 | battery.BAT- | lm2596.IN- | ground | CONDITIONAL | dashed |
| W11 | lm2596.OUT+ | esp32.5V | 5v | CONDITIONAL | dashed |
| W12 | lm2596.OUT- | ground.GND | ground | CONDITIONAL | dashed |
| W12b | ground.GND | esp32.GND | ground | CONDITIONAL | dashed |
| W13 | lm2596.OUT+ | acs712.VCC | 5v | CONDITIONAL | dashed |
| W14 | ground.GND | acs712.GND | ground | CONDITIONAL | dashed |
| W15 | acs712.OUT | r1.A | analog | CONDITIONAL | dashed |
| W16a | r1.B | nodea.NODE | analog | CALCULATED | solid |
| W16b | nodea.NODE | esp32.GPIO34 | analog | CONDITIONAL | dashed |
| W17 | nodea.NODE | r2.A | analog | CALCULATED | solid |
| W18 | r2.B | ground.GND | ground | CALCULATED | solid |
| W19 | nodea.NODE | c1.A | analog | CALCULATED | solid |
| W19b | c1.B | ground.GND | ground | CALCULATED | solid |
| W20 | fuse2.OUT | r3.A | sense | CONDITIONAL | dashed |
| W21a | r3.B | nodeb.NODE | analog | CALCULATED | solid |
| W21b | nodeb.NODE | esp32.GPIO35 | analog | CONDITIONAL | dashed |
| W22 | nodeb.NODE | r4.A | analog | CALCULATED | solid |
| W23 | r4.B | ground.GND | ground | CALCULATED | solid |
| W24 | nodeb.NODE | c2.A | analog | CALCULATED | solid |
| W24b | c2.B | ground.GND | ground | CALCULATED | solid |
| W25 | esp32.3V3 | oled.VCC | 3v3 | CONDITIONAL | dashed |
| W26 | esp32.GPIO21 | oled.SDA | i2c | CONDITIONAL | dashed |
| W27 | esp32.GPIO22 | oled.SCL | i2c | CONDITIONAL | dashed |
| W28 | ground.GND | oled.GND | ground | CONDITIONAL | dashed |
| W29 | esp32.3V3 | temperature.VDD | 3v3 | UNVERIFIED | dashed |
| W30 | ground.GND | temperature.GND | ground | UNVERIFIED | dashed |
| W31 | esp32.GPIO4 | temperature.DQ | onewire | UNVERIFIED | dashed |
| W37 | esp32.3V3 | r5.A | 3v3 | CONDITIONAL | dashed |
| W38 | r5.B | temperature.DQ | onewire | UNVERIFIED | dashed |
| W39 | motor.+ | d1.K | motor | CONDITIONAL | dashed |
| W40 | d1.A | motor.- | return | CONDITIONAL | dashed |

## Color and route convention

| Group | Color | Width radius (visual units) |
|---|---|---|
| battery: Battery + | #dd5555 | 0.025 |
| motor: Motor + / suppression | #de9252 | 0.025 |
| return: Motor return | #6b7986 | 0.025 |
| branch: Protected branch | #d8a35b | 0.015 |
| 5v: 5 V | #f2b555 | 0.012 |
| 3v3: 3.3 V | #e48db3 | 0.01 |
| ground: Logic ground | #66a98c | 0.012 |
| analog: ADC / filter | #b49be5 | 0.01 |
| sense: Bus sense | #c598c7 | 0.01 |
| i2c: I²C | #6faef0 | 0.01 |
| onewire: 1-Wire | #ded176 | 0.01 |

High-current battery/motor paths are thicker; signal and low-power paths thinner. Colors are display conventions, not physical insulation instructions or probe colors. Curves use rounded obstacle-aware floor corridors and distinct heights at crossings. Reference port coordinates are in `assembly-reference.json`; complete control points and sampled routes are in `wire-routes.json`, using Blender Z-up visualization units. The glTF exporter converts axes for the website. Every wire includes ID, two logical endpoints, evidence status, style and CSV hash in its extras.

## Reproduction and viewer behavior

1. Run `python hardware-validation/build_reference.py`, then `python hardware-validation/calculations.py` after deliberate netlist changes. These regenerate the CSV, reference JSON, schematic and calculations.
2. Run `blender-workflow/scripts/generate_ecs_assembly.py` through the supported Blender launcher or Blender Text Editor. It reuses the original component builders, reads the CSV, backs up the existing GLB with a unique name and exports the reviewed assembly. It does not delete existing user scene objects.
3. Run `hardware-validation/validate_blender.py` in a separate background Blender process. It starts a fresh scene, imports the final GLB, checks its metadata/endpoints and renders/saves inspection artifacts. Do not run this factory-reset validation script inside an unsaved working scene.
4. Serve this existing project on localhost (the verification server uses `http://127.0.0.1:5500`). Choose the 3D Engineering Model view. Select a part, inspect its documented edges, isolate it, return to assembly, reset the camera and toggle wires. Isolation hides wires to avoid false floating endpoints. Selection/visibility has no electrical or telemetry effect.

`final-validation-report.md` is the authority for which checks were actually completed and which were blocked. Original reference documents are preserved in place and copied under `provided-references/`; original model/source backups are listed in `backup-manifest.json`.
