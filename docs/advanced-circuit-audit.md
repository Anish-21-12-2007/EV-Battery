# Electrical audit — 3 November 2026

**Disposition: the preserved 12 V design is an incomplete educational proposal (`UNVERIFIED`), not a construction-ready or safety-qualified circuit.** Its ordinary divider and energy arithmetic checks out under its stated assumptions. This review documents the source contradictions, missing hardware specifications, and startup/shutdown/abnormal fault modes that must be resolved before any physical build. The 96 V vehicle remains a separate software model.

## What was checked

The unchanged package's `calculation_checks.py` and `package_consistency_verifier.py` both ran. The recalculated JSON matches its stored JSON, and SHA-256 checks confirm that all 36 package files stayed unchanged. Run `python3 scripts/audit-circuit-electrical.py` to reproduce this; outputs are in `validation/advanced-circuit-audit/`.

The package verifier's message **“0 unresolved endpoints” means zero missing BOM identifiers**. It checks foreign keys, selected SVG text and two stored numerical results. It does not establish physical pin positions, protection completeness, current ratings or correct return-current routing. `tests/circuit-electrical.test.mjs` adds independent tolerance corners, KCL, unit conversion, measurement-boundary, startup/shutdown/fault-mode and unresolved-topology assertions. Passing those assertions records the issues below; it does not approve the circuit.

## Material findings & UNVERIFIED specifications

| Finding / Component | Status | Missing information | Engineering consequence & required correction |
|---|---|---|---|
| **Single Kelvin tie not established** (`JGND`, `W053`, `U_BUCK_BOARD`) | `UNVERIFIED` | Isolated DC/DC topology or complete physical return-impedance network | With non-isolated buck continuity, `LOGIC_GND → W016 → OUT− → internal common → IN− → W014 → BAT− → W052 → STAR_RETURN` forms a parallel loop with `W053`. Load return current divides by impedance. |
| **Reverse-polarity protection absent** (`RP1`, `W002`) | `UNVERIFIED` | Selected series P-MOSFET / ideal-diode part, voltage/current rating, and netlist endpoints | Prose claims `W002` passes through `RP1`, but `W002` connects `F1.OUT` directly to `SW1.IN`. `RP1` has zero scheduled wires and provides no reverse-battery protection. |
| **Transient suppressor incomplete** (`TVS1`, `W060`, `D1`) | `UNVERIFIED` | Standoff/clamping voltage, peak pulse power, scheduled anode return wire, and motor driver topology | `W060` terminates only at `TVS1.CATHODE` with no scheduled return row. Freewheel diode `D1` cannot be placed across a reversing H-bridge without shorting reverse polarity. |
| **Light sensor rail/interface contradiction** (`S_L`, `U_I_L`, `W020`–`W023`) | `UNVERIFIED` | Exact low-current transducer part number, supply rail (`3.3 V` vs `5 V`), and output interface (analog vs $\text{I}^2\text{C}$) | `W020` supplies `5 V` from the buck converter while notes allow a `3.3 V` sensor, and `W022`/`W023` assume an analog conditioner into `GPIO32`. An `INA219` requires $\text{I}^2\text{C}$ (`SDA`/`SCL`), not an analog `OUT` pin. |
| **Optional DS18B20 & OLED pinouts** (`T1_PROBE`, `U_OLED_BOARD`) | `UNVERIFIED` | Scheduled `4.7 kΩ` pull-up resistor BOM item/endpoints, probe lead color verification, and 4-pin OLED header order (`GND-VCC` vs `VCC-GND`) | Missing `4.7 kΩ` pull-up prevents 1-Wire communication; reversed OLED `VCC`/`GND` header order destroys the display module on power-up. |
| **Fuses, switch, conductors & battery** (`BAT1`, `F1`, `FL`, `FM`, `F2`, `SW1`) | `UNVERIFIED` | Battery datasheet/short-circuit current, motor stall current, fuse DC voltage & interrupt ratings ($I^2t$), switch DC inductive rating, and wire AWG | Fuses cannot be sized from nominal load current alone; unrated DC switching or uncoordinated wire gauges risk sustained arcing or conductor overheating under fault. |

## Startup, shutdown, abnormal and fault-mode analysis

1. **Unpowered MCU startup / shutdown backfeed (`VDD = 0 V` while 12–18 V bus or 5 V sensor is live):**
   - Espressif's ESP32 datasheet specifies maximum input voltage on any GPIO as $\text{VDD} + 0.3\text{ V}$, which is $0.3\text{ V}$ when the MCU rail is unpowered (e.g., if `F2` opens or `U_BUCK_BOARD` powers up after the main bus).
   - At the assumed $18\text{ V}$ ceiling, the $68\text{ k}\Omega / 10\text{ k}\Omega$ dividers (`NODE_VL`, `NODE_VM`) rise to $2.3077\text{ V}$ nominal ($2.3482\text{ V}$ at 1% worst corner) or inject $I_{\text{KCL}} = (18 - 0.3)/68\text{k} - 0.3/10\text{k} = 230.29\text{ }\mu\text{A}$ into a hypothetical $0.3\text{ V}$ pin clamp on `GPIO33`/`GPIO35`.
   - If `S_M` (`ACS712`) is powered at $5\text{ V}$ while `U_ESP` `3.3 V` is down, `NODE_IM` ($1.0638\text{ V}$ at $0\text{ A}$, $1.9064\text{ V}$ at $+30\text{ A}$) injects $66.48\text{ }\mu\text{A}$ ($0\text{ A}$) to $139.81\text{ }\mu\text{A}$ ($+30\text{ A}$) via KCL into `GPIO34`.
2. **Open-circuit bottom divider resistor fault (`R_LL`, `R_VL`, or `R_ML` disconnected):**
   - If `R_LL` or `R_VL` ($10\text{ k}\Omega$) opens, voltage attenuation is lost and `NODE_VL`/`NODE_VM` is pulled toward the full $12\text{–}18\text{ V}$ supply through $68\text{ k}\Omega$, exceeding the $3.6\text{ V}$ powered GPIO absolute maximum.
   - If `R_ML` ($20\text{ k}\Omega$) opens, `NODE_IM` rises to the unscaled $5\text{ V}$ sensor output ($4.48\text{ V}$ at $+30\text{ A}$), also exceeding $3.6\text{ V}$.
3. **Sensor signal disconnection fault (`W022`, `W031`, `W037` open):**
   - If `S_M.OUT` (`W031`) disconnects while `R_ML` ($20\text{ k}\Omega$) remains intact to ground, `NODE_IM` is pulled to $0.000\text{ V}$. Naive linear transfer conversion maps $0.000\text{ V}$ to $(0 / 0.425532 - 2.50)/0.066 = -37.88\text{ A}$ instead of reporting an open-sensor fault unless firmware enforces window bounds ($[0.22\text{ V}, 1.91\text{ V}]$).
4. **Primary battery return open-circuit fault (`W052` open under load):**
   - If `W052` (`JGND.STAR_RETURN` to `BAT1.BAT-`) opens while `L1` and `MDRV` are energized, full load return current diverts through `W053` $\rightarrow$ `JGND.LOGIC_GND` $\rightarrow$ `W016` $\rightarrow$ non-isolated `U_BUCK_BOARD` internal common $\rightarrow$ `W014` $\rightarrow$ `BAT1.BAT-`, elevating logic ground and destroying the MCU and sensors.
5. **Inductive motor turn-off transient (`SW1` or `FM` opening under stall/load):**
   - Opening `SW1` or `FM` while `M1` is drawing running or stall current generates an inductive voltage spike ($V = L\,dI/dt$) on `BUS+` and `MDRV.INPUT+`. Because `TVS1` has no scheduled anode return and `D1` is unscheduled, the spike is unclamped.

## Numerical corrections and limits

- The 68 kΩ/10 kΩ divider gives **2.307692 V nominal** at 18 V; the 1% worst corner gives **2.348231 V**. The worst-corner input reaching 2.45 V is **18.780099 V**.
- The conditional 27 kΩ/20 kΩ ACS712-30A scaler gives **1.063830 V at 0 A**, **0.221277–1.906383 V at ±30 A**, and **28.085106 mV/A** nominal sensitivity. The ±60 mV ADC example corresponds to approximately **±2.136 A** (`±427.3%` of a `0.5 A` signal).
- LM2596 **4.5–40 V is the recommended operating input range; 45 V is the IC absolute maximum** ([TI LM2596](https://www.ti.com/lit/ds/symlink/lm2596.pdf)).
- INA219 has a **26 V operating bus limit**, selectable **±40/80/160/320 mV** shunt ranges and **10 µV** shunt LSB ([TI INA219](https://www.ti.com/lit/ds/symlink/ina219.pdf)); INA226 has a **36 V bus limit**, **±81.92 mV** shunt full scale and **2.5 µV** LSB ([TI INA226](https://www.ti.com/lit/ds/symlink/ina226.pdf)).
- Espressif explicitly permits **only one** of USB, 5 V header or 3V3 header power at a time on the reference DevKitC ([DevKitC V4 guide](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32/esp32-devkitc/user_guide.html)).

No hardware was energized, inspected, calibrated or fault-tested during this audit.
