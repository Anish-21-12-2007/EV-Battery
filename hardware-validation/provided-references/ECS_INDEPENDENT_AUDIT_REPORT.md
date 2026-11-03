# Independent Electrical Audit — ECS Battery Monitoring (12 V VRLA + ESP32)

**Audit date:** 2026-10-12 **Scope:** the proposal pasted in this chat (wiring guide, connection CSV, validation report, Astra handoff, two schematic PNGs, simulation note).
**Not available to me:** the website/Firebase code, the physical boards, the motor, the Wokwi project files. Nothing here was powered or measured on hardware.

Status vocabulary used throughout: **VERIFIED** (read in a primary source *and* tied to an inspected physical part), **CALCULATED** (arithmetic I re-ran, see `audit_calcs.py`), **SIMULATED**, **CONDITIONAL** (depends on a physical part I have not seen), **UNVERIFIED**.
**No row in this package is VERIFIED**, because no physical part has been inspected by anyone. Datasheet facts are labelled "datasheet-confirmed" instead.

---

## Section A — Verdict

**INCOMPLETE for energizing the power path. PASS WITH CORRECTIONS for the low-voltage measurement architecture once the corrections in Section B are applied.**

The previous AI's conservatism is mostly justified: it correctly refused to approve the 30 A fuse, refused to put the relay in the motor path, avoided ADC2, kept 12 V away from every GPIO/OLED pin, and was honest about the simulation. Its basic topology (fuse → switch → sensor → motor, buck for logic, dividers into ADC1) is sound.

It does **not** meet the project goals, and it contains one real range error:

1. **No temperature sensor exists in the design**, yet temperature is a required reading.
2. **No state-of-charge / Ah / Wh method exists**, only voltage and a motor-branch current.
3. **The ACS712 is placed in the motor branch only**, so "battery current", battery power and coulomb counting are not measured.
4. **Both analog dividers are sized to ESP32 pin limits (3.3 V) instead of the ADC's documented measurable range (150–2450 mV at the highest attenuation).** At the 18 V design ceiling the battery node is 2.79 V, outside that range.
5. **OLED row P21 powers the OLED from 5 V**, which with typical modules also pulls I²C up to 5 V on a 3.3 V ESP32.
6. The logic/buck branch has **no fuse of its own** (the guide's prose says "fused branch"; the CSV has none).

What blocks energizing: motor nameplate/stall current, ACS712 module PCB rating, switch DC rating, wire gauge, and the physical board labels are all unknown. Those are legitimately open and I cannot close them either.

---

## Section B — Error-by-error audit

| # | Original claim / connection | What's wrong or uncertain | Why it matters | Correction | Evidence | Severity |
|---|---|---|---|---|---|---|
| E01 | Dashboard goals include temperature; design has no temperature part | Nothing in CSV/guide/schematic measures temperature | Required reading cannot exist; website would have nothing real to show | Add DS18B20 on 1-Wire: VDD→ESP32 3V3, GND→GND, DQ→GPIO4, 4.7 kΩ DQ→3V3; probe taped to battery case side wall | Design gap (all 5 documents). DS18B20 3.0–5.5 V and ±0.5 °C (−10…+85 °C) now confirmed against datasheet copies (Rev 2 addendum); your probe's wire colours still need checking | **High** |
| E02 | Only V and motor-branch I; no SoC/Ah/Wh | No estimator, no initial condition, no capacity model | Goals 5, 6 unsatisfied; voltage-only SoC is wrong under load | Hybrid: rest-voltage lookup at boot + Peukert-adjusted coulomb counting; see D5/E | Method, Section D/E | **High** |
| E03 | ACS712 in series with motor only ("measures that motor alone") | Battery current = motor + buck/ESP32/OLED/ACS (≈0.1–0.3 A at 12 V). Integrating motor-only current under-counts drain; P = V·I is motor-branch power only | Wrong Ah/Wh; ambiguous power definition | Move ACS712 to **after the rocker switch, before the load bus**, so it sees all battery current. Divider taps the load bus after the ACS | Datasheet: current flows IP+→IP− gives output above VCC/2; primary 1.2 mΩ typ (Allegro ACS712 rev 22) | **High** |
| E04 | Battery divider 120k/22k "18 V → 2.79 V, safe" | 2.79 V exceeds the ESP32 ADC documented measurable range at the highest attenuation (150–2450 mV). Above ~2.45 V readings are outside the characterised range. Pin survival ≠ measurement validity | Readings near and above 15.8 V would saturate/compress, exactly when charging | Use **62 kΩ / 10 kΩ, 1 %**: ratio 0.13889; node ≤2.45 V up to 17.6 V (17.3 V at 1 % worst case); 12.6 V → 1.75 V | ESP-IDF ADC docs (ranges 100–950, 100–1250, 150–1750, **150–2450 mV**), CALCULATED | **High** |
| E05 | ACS scale 15k/20k "4.5 V → 2.57 V" | Math is right (ratio 0.5714), but 2.56 V at +30 A is above 2.45 V. In-range only to ≈27.1 A. Practically harmless (fuse/module limit lower) but the stated "safe margin" is wrong at full scale | Misleading range claim | Keep 15k/20k, but document valid range **−30 … +27 A**; or use 10k/22k with ≈16 A range for more resolution if the motor is small | CALCULATED | **Medium** |
| E06 | 100 nF "optional" at both ADC nodes | Source impedance 18.6 kΩ (battery) and 8.6 kΩ (ACS) is high for the ESP32 SAR input; brush-motor noise is present | Noisy/biased readings | Make 100 nF **required** on both nodes (fc ≈ 185 Hz). Oversample ≥64 samples | CALCULATED; ESP-IDF docs warn the ADC is noise-sensitive | **Medium** |
| E07 | P21: LM2596 OUT+ 5 V → OLED VCC "only if module accepts 5 V" | Typical 4-pin SSD1306 modules tie SDA/SCL pull-ups to their VCC. At 5 V those pull I²C lines above ESP32 3.3 V I/O. Doc elsewhere says pull-ups must be 3.3 V, so P21 contradicts it | Possible stress on GPIO21/22 | **Delete P21.** OLED VCC only from ESP32 3V3 (module current ≈ 20–30 mA, within a typical DevKit regulator) | Pull-up behaviour is **UNVERIFIED** for your exact module (inspect it); logic-level rule from ESP32 datasheet cited by prior AI | **High** |
| E08 | "A switched, fused branch feeds LM2596" | Only a 30 A fuse exists. The thin conductors to buck/divider are protected by nothing close to their ampacity | Fault in the small wiring is not cleared | Add **F2, 1–2 A** inline fuse at the load bus before buck IN+ | Engineering practice; fuse sizing CALCULATED: Iin ≈ 0.29 A worst case (ESP32 Wi-Fi peak 0.5 A + ACS 13 mA + OLED) | **High** |
| E09 | 30 A fuse "not approved" | **Correct, keep it.** Add the rule: F1 must be ≤ the lowest of {wire ampacity, ACS module PCB/terminal rating, switch DC rating, connector rating} and above motor running current with margin | Prevents a fuse that protects nothing | See Section C rule box | ACS712 IC conductor survives overcurrent 100 A for 100 ms (datasheet); that is the IC only, not the breakout | **Medium (already handled; refined)** |
| E10 | Relay not in motor path; SRD-05VDC-SL-C 28 VDC/10 A ≠ motor rating | **Correct.** Further: the relay is not needed for any measurement goal. Motor on/off is the rocker switch; "running" is derived from current | Removes a failure point | Phase 1: omit relay entirely. If remote cut-off is wanted later, use a DC-rated automotive relay/contactor driven by a logic MOSFET with coil flyback diode, or a motor-rated MOSFET stage | Relay datasheet not re-fetched by me → **UNVERIFIED** | **Low (agree)** |
| E11 | One supply source, ESP32 5V/VIN from verified 5.00 V buck | **Correct.** No USB while buck-powered unless the board documents it | Back-feeding USB/regulator | Keep; add: never connect USB to a PC while the ACS/buck rail is energized unless the board has a back-feed diode (inspect) | ESP32-DevKitC guide cited by prior AI (not re-fetched) → UNVERIFIED for your clone | **Low** |
| E12 | GPIO34/35 ADC1 input-only, GPIO21/22 I²C, GPIO25 reserved | **Correct for classic ESP32.** None are strapping pins (0, 2, 5, 12, 15 are), none are flash pins (6–11), ADC1 avoids ADC2/Wi-Fi conflict. GPIO4 (new, 1-Wire) is not a strapping pin | Valid pin map | Keep; add GPIO4 | ESP32 datasheet (prior AI cite; not re-fetched). Physical board labelling **CONDITIONAL** | **Low (agree)** |
| E13 | ACS712 zero = VCC/2, 66 mV/A (63–69), 5 V supply | **Correct.** Output and zero are *ratiometric to VCC*, so a buck set to 5.00 V that wanders ±2 % shifts the zero by ±50 mV at the ACS output (≈ ±0.76 A equivalent at 66 mV/A) | Bad current offset | **Auto-zero at boot** with motor off, store offset; reject if zero outside 2.5 V ±0.15 V (at ACS output) | Allegro ACS712 rev 22: VCC 4.5–5.5 V, VIOUT(Q)=VCC×0.5, ratiometric, 63–69 mV/A | **Medium** |
| E14 | ACS712 resolution adequate for the motor | Datasheet noise (30 A part) is 7 mV p-p at 2 kHz bandwidth ≈ **106 mA p-p**. With ESP32 ADC (≈0.8 mV/LSB, practical ENOB ~9–10 bits) expect ±0.2–0.3 A. Good for a motor (amps), poor for the ≈0.1–0.3 A electronics load | Idle current readings are noise-level | Say so on the dashboard; use deadband (e.g. <0.3 A shown as "~0"); optional ADS1115 upgrade | Allegro datasheet noise figure; CALCULATED | **Medium** |
| E15 | Ground plan (star at battery−, motor return separate) | **Correct.** Add: divider bottom legs and ACS GND return to the **ESP32/buck-OUT− ground**, which meets motor return only at the battery negative post. Verify buck IN−/OUT− are common with a continuity check (typical non-isolated LM2596 modules are, but **UNVERIFIED** for yours) | Prevents I·R error on measurements | Keep; add continuity step to checklist | Prior doc; CONDITIONAL | **Low** |
| E16 | No reverse-polarity consideration | ACS712 absolute max reverse supply is −0.1 V; ESP32 and buck also unprotected | One swapped wire destroys parts | Polarized connectors (e.g. keyed, one-way) on battery and buck input; F1 near battery. Optional series Schottky/ideal-diode only on logic branch | Allegro absolute maximum ratings (reverse VCC −0.1 V) | **Medium** |
| E17 | No motor noise suppression | Brush motors inject spikes into the ACS output and the 12 V bus | Noisy ADC, resets | 100 nF ceramic across motor terminals, leads ≤ 2 cm; flyback diode only if later switched by MOSFET/relay (unidirectional only) | Practice; CONDITIONAL on motor type | **Low** |
| E18 | Voltage/current "measured at different points" not discussed | Current at ACS, voltage at load bus after ACS: separated by ≈1.2 mΩ + wire; e.g. 10 A × 3 mΩ ≈ 30 mV | Negligible, but must be stated | Define: **P = V_bus × I_batt = battery-side input power (includes electronics)**; not motor shaft power | CALCULATED | **Low** |
| E19 | Wokwi result "partially verified" | **Honest and accurate.** Slider arithmetic checks out (500/1023 → 1.613 V → 4.89 A; 700/1023 → 2.258 V → 14.57 V). But Wokwi's ADC is ideal 0–3.3 V, so it *cannot* expose E04; the display never rendered correctly | Sim passed a design that has a documented ADC range problem | Reclassify as: compiles; raw I²C stream no error; ADC arithmetic only; OLED rendering UNVERIFIED | Section F | **Medium** |
| E20 | Small numeric inconsistencies | Worst-case battery node quoted 2.84 V (report) vs 2.85 V (guide); recalculated **2.836 V**. ACS full-scale 2.56 V vs 2.57 V; recalculated 2.560 V (nominal 4.5 V ×0.5714 = 2.571) | Documentation hygiene only | Use the values in Section D | CALCULATED | **Low** |
| E21 | CSV status uses CONDITIONAL for everything | No CALCULATED rows even where math is the evidence; "SIMULATED" never used | Reader cannot see what is evidenced | Corrected CSV adds an *Evidence basis* column | — | **Low** |

Items I checked and found **correct** (no change): fuse near battery positive before branches; switch after fuse; divider top after switch (no 90–190 µA drain when off); ACS output not connected straight to GPIO; no battery voltage to any 3.3 V part; no motor current through GPIO; separate high-current and logic grounds; relay left open.

---

## Section C — Corrected circuit

Full machine-readable table: `battery-monitoring-pinout_CORRECTED.csv` (36 rows). Summary architecture:

```text
BAT+ ─ F1 (rating = see rule) ─ SW1 (DC-rated) ─ ACS712 IP+ ─ IP− ─┬─ LOAD BUS (+)
                                                                   ├─ Motor +      (Motor − → BAT− star post)
                                                                   ├─ F2 (1–2 A) ─ LM2596 IN+      (IN− → BAT− star post)
                                                                   └─ R3 62k ─ node B ─ R4 10k ─ GND ; node B ─ C2 100 nF ─ GND ; node B → GPIO35

LM2596 OUT+ (meter-set 5.00 V, ESP32 unplugged) ─┬─ ESP32 VIN/5V (confirm label)
                                                 └─ ACS712 VCC       (OUT− → ESP32 GND, ACS GND)
ACS VIOUT ─ 15k ─ node A ─ 20k ─ GND ; node A ─ 100 nF ─ GND ; node A → GPIO34
ESP32 3V3 → OLED VCC, DS18B20 VDD, 4.7k pull-up on DQ
GPIO21 SDA, GPIO22 SCL → OLED ; GPIO4 → DS18B20 DQ ; GPIO25 reserved (relay, not connected)
```

**Fuse/wire rule box (F1).** Choose F1 so that:
`I_motor_running_max × ~1.25–1.5  ≤  F1  ≤  min(wire ampacity, ACS712 module rating, switch DC rating, connector rating)`.
Check the fuse time-current curve against the **measured** start/stall current. If no F1 satisfies both sides, the weakest element must be upgraded (e.g. thicker wire, different current sensor), not the fuse enlarged. Wire guidance in chassis wiring: roughly 14 AWG ≈ 15 A, 12 AWG ≈ 20 A (rule-of-thumb, **UNVERIFIED** against your insulation/length). Many ACS712 breakouts have thin traces; thermal test with a known load before relying on 30 A (**UNVERIFIED** for your module).

Motor voltage: confirm the nameplate says 12 V (or a range containing 10.5–14.8 V). A 6 V motor will be destroyed; this is not checkable from here.

---

## Section D — Corrected calculations (`audit_calcs.py`, output in `audit_calcs_output.txt`)

**D1. Battery divider** (62 kΩ top, 10 kΩ bottom, both 1 %)
- Ratio = 10/(62+10) = 0.13889. At 12.6 V → 1.750 V; 14.8 V → 2.056 V; 16 V → 2.222 V.
- Maximum valid reading (node 2.45 V): 2.45/0.13889 = **17.64 V** (worst-case 1 % ratio 0.14129 → 17.34 V).
- Divider current at 12.6 V: 12.6/72 kΩ = 175 µA. Top resistor dissipation at 16 V: (16−2.22)²/62k ≈ 3.1 mW (use ¼ W).
- Source impedance 62k‖10k = 8.61 kΩ; with 100 nF: fc = 1/(2π·8.61k·100 nF) ≈ 185 Hz.
- Reading: `V_bat = V_node / 0.13889` where V_node comes from a **calibrated** conversion (eFuse Vref/two-point calibration), averaged over ≥64 samples; trim with a multimeter reading at two voltages (e.g. 11.5 V, 13.5 V).
- Fault current if the node were forced to 3.3 V at 18 V: (18−3.3)/62k ≈ 0.24 mA. Optional clamp: BAT54S to 3V3/GND at the node.
- Original 120k/22k for comparison: ratio 0.15493, valid reading ends at **15.81 V**, 18 V → 2.789 V nominal / 2.836 V worst case (outside range).

**D2. ACS712-30A output** (5.00 V supply, 63–69 mV/A, zero VCC/2)
- Raw: V_ACS = 2.5 V + 0.066 V/A × I.
- Scaled with 15k/20k: ratio 0.5714 → zero 1.429 V; sensitivity **37.7 mV/A**; −30 A → 0.297 V; +30 A → 2.560 V; ADC range limit 2.45 V reached at **+27.1 A**.
- Conversion: `I = (V_node/0.5714 − V_zero_ACS) / 0.066`, with V_zero_ACS measured at boot (motor off, accounting for the ≈0.1–0.3 A electronics load) and sensitivity trimmed against a reference ammeter. Sensitivity tolerance alone is ±4.5 % (63–69 mV/A); total output error 1.5 % typ at full scale.
- Noise: 7 mV p-p (datasheet, 2 kHz BW) → ≈106 mA p-p at the ACS output; expect ±0.2–0.3 A on the ESP32 ADC.
- Datasheet loading limits satisfied: R_load ≥ 4.7 kΩ (we present 35 kΩ), C_load ≤ 10 nF at VIOUT (our 100 nF sits behind 15 kΩ).

**D3. Power, charge, energy**
- `P = V_bus × I_batt` [W], battery-side input power including electronics. Example: 12.2 V × 5 A = 61 W.
- `E_used += P·Δt/3600` [Wh]. This is an integral of measured quantities (derived), not an independent measurement.
- Peukert-adjusted equivalent current (reference I_ref = C20/20 = 0.38 A, exponent k):
  `Ah_eq += I·(I/I_ref)^(k−1)·Δt/3600`, `SoC = SoC0 − Ah_eq / 7.6`.
  Illustration with **assumed** k = 1.2 (not an Amptek value; take from the discharge table when available): capacity ≈ 6.26 Ah at 1 A, 4.54 Ah at 5 A, 3.95 Ah at 10 A (60 %/52 % of 7.6 Ah). Constant 5 A gives ≈ 0.91 h runtime.
- Remaining capacity `Ah_rem = SoC × C_eff(I_recent)`; remaining energy `Wh_rem ≈ Ah_rem × V_open_circuit_nominal (≈12 V)`. **Estimate**, not measurement.

**D4. Regulator**
- Required: 5.00 V ± 0.05 V meter-verified at OUT with the ESP32 disconnected, then re-check with load. Input budget: 5 V × 0.55 A ≈ 2.75 W → ≈0.29 A at 12 V at 80 % efficiency (efficiency assumed). ACS712 draws 10 typ/13 max mA (datasheet). Any LM2596 module is adequate for current; the concern is only identity/polarity/trimmer settling.

**D5. Low-voltage and temperature thresholds (demonstration defaults, tune on your battery)**
- Low-voltage **warning**: V_bus < 11.5 V for >5 s continuous *and* I > 0.3 A; **cut-off advice**: < 10.5 V (1.75 V/cell) ; clear with hysteresis +0.3 V. Under 10 A load a 7 Ah VRLA may sag several tenths of a volt, so raw voltage thresholds are load-dependent; do not equate them with SoC.
- Temperature warning at ≥ 45 °C, alarm ≥ 50 °C, clear 3 °C lower. These are generic lead-acid-style defaults, **UNVERIFIED** against Amptek's sheet (which was not retrievable).

---

## Section E — Measurement capability matrix

| Desired reading | Required method | In proposal? | Can it be measured? | Accuracy / limits | Required correction | Final status |
|---|---|---|---|---|---|---|
| Battery voltage | 62k/10k divider → GPIO35, 100 nF, calibrated ADC | Partly (120k/22k, out-of-range top) | Yes | ≈ ±1–2 % after two-point trim; ESP32 ADC nonlinear | Replace divider; calibrate; average | **CALCULATED, CONDITIONAL** |
| Current | ACS712 in main battery path → GPIO34 | Yes, motor-branch only | Yes (motor-scale) | ±0.2–0.3 A noise; ±4.5 % sensitivity before trim; idle load ≈ noise | Move to main path; auto-zero; trim | **CONDITIONAL** |
| Power | V_bus × I_batt | Not defined | Derived | Inherits both errors; battery-side input power | Define as above | **CALCULATED** |
| Temperature | DS18B20 on battery wall | **Absent** | Yes with added sensor | ±0.5 °C sensor; reading is case-surface, lags cell | Add DS18B20 + 4.7 kΩ | **UNVERIFIED until added** |
| Remaining charge (%) | OCV at rest + Peukert coulomb counting | **Absent** | Estimate only | ±10–20 % typical for this method on a student rig; drifts, fails after external charging | Implement estimator; store SoC in NVS; resync on rest | **ESTIMATE** |
| Remaining capacity (Ah) | SoC × effective capacity | Absent | Estimate | Depends on k, C, temperature | Fit k from datasheet/test | **ESTIMATE** |
| Remaining energy (Wh) | Ah_rem × V_nom, or ∫P | Absent | Estimate | ±20 % | State assumption on screen | **ESTIMATE** |
| Motor/load status | I_batt above threshold (e.g. >0.8 A on, <0.5 A off) | Absent | **Inferred**, not commanded | Cannot separate motor from electronics at low load; stall looks "running" | Label "inferred from current" | **DERIVED** |
| Low-battery warning | Filtered V + hysteresis + current gating | Absent | Yes | Load sag causes false alarms | Thresholds in D5; 5 s persistence | **CONDITIONAL** |
| Temperature warning | DS18B20 + hysteresis | Absent | Yes after E01 | As sensor | Add sensor | **UNVERIFIED** |
| Live website readings | ESP32 Wi-Fi → Firebase, 1 Hz | Not designed | Possible; code not provided | Wi-Fi/ID dependent | Schema below | **UNVERIFIED** |

**Recommended student SoC method.** (1) Boot with the load off: if I_batt < 0.3 A and ≥ 30 min since last motor run (timestamp in flash), set `SoC0` from a resting open-circuit voltage table. Typical generic lead-acid values (not Amptek-specific, **UNVERIFIED**): ≈12.7–12.9 V ≈ 100 %, 12.5 V ≈ 75–80 %, 12.2 V ≈ 50 %, 11.9 V ≈ 25 %, ≤11.6 V ≈ 0–10 %. (2) While running, subtract Peukert-adjusted coulombs. (3) Show the value as "EST" and never from the loaded voltage alone: terminal voltage under load equals OCV minus I·R_internal and polarisation, so the same SoC shows different voltages at different currents. Limits: no tracking of external charging, unknown aging, temperature effects; full calibration needs a discharge test on your battery.

Optional accuracy upgrade (recommended if readings must be defendable): ADS1115 on the shared I²C bus (default address 0x48, OLED 0x3C/0x3D), 3.3 V supply, ±4.096 V range, for both analog nodes. Keep nodes ≤ 3.3 V. **UNVERIFIED** here: pin-level specifics should be read from its datasheet.

**OLED layout (128×64, 3-second rotating pages, 1 Hz data refresh, header line shows `OK`/`STALE`/`CAL`).**
```
PAGE 1  LIVE POWER                 PAGE 2  BATTERY                  PAGE 3  TEMP
 V  12.34 V    (big, 16 px)         SoC  ~64 %  EST                 Batt case 31.2 C
 I   4.82 A    (big)                Ah   ~3.1 Ah EST                 Sensor: case wall
 P   59.5 W    (8 px)               Cond: OK | LOW V                 Warn: none
 Motor: RUN (inferred)              Data: valid                      (or "-- no sensor")
```
Unavailable values print `--`, never 0. Source tags: `V I T` measured, `P` calculated, `SoC Ah Wh` estimated, `Motor` inferred. A 128×64 SSD1306 can refresh faster, but 1 Hz is enough for this data.

---

## Telemetry schema recommendation (existing field names not provided; keep yours if different)

| Field | Unit | Class | Notes |
|---|---|---|---|
| `voltage` | V | measured | `null` if ADC invalid |
| `current` | A | measured | signed; negative = charging; `null` if uncalibrated |
| `power` | W | calculated | battery-side input power |
| `temperature` | °C | measured | `null` if sensor missing (never −127/85 literal values) |
| `stateOfCharge` | % | estimated | plus `stateOfChargeMethod` string |
| `remainingCapacityAh` | Ah | estimated | |
| `remainingEnergyWh` | Wh | estimated | |
| `motorRunning` | bool | inferred | from current threshold |
| `timestamp` | ms epoch | device | use Firebase server timestamp as authoritative |
| `sensorStatus` | object | status | `{voltage,current,temperature}: "ok" \| "uncalibrated" \| "out_of_range" \| "missing"` |

Sample ADC at ≥1 kHz, average per 100 ms, filter, publish **1 Hz**. Dashboard: stale when server age > 5 s (grey out, label "last known"); offline > 15 s; show `--` for `null`; never substitute zero or simulated numbers. Do not hard-code Wi-Fi/Firebase credentials in a public repo. I did not change any Firebase or website file.

---

## Section F — Simulation status and corrected schematic

| Category | Items |
|---|---|
| 1. Confirmed by datasheet (re-read by me) | ACS712-30A: 5 V supply 4.5–5.5 V, zero = VCC/2, 63–66–69 mV/A, noise 7 mV p-p @2 kHz, current IP+→IP− raises output, 1.2 mΩ, 100 A/100 ms overcurrent, reverse VCC −0.1 V, R_load ≥ 4.7 kΩ. ESP32 ADC measurable ranges (ESP-IDF docs). |
| 2. Checked by calculation | Both dividers, filter corner, power/energy, Peukert example, buck input budget (`audit_calcs.py`). |
| 3. Tested in a simulator | **Only** the previous AI's Wokwi run: compile OK, raw I²C stream no error, ADC arithmetic correct. ADC is ideal in Wokwi; OLED never rendered correctly. I re-ran nothing in Wokwi (no access). |
| 4. Tested on hardware | **None.** |
| 5. Unverified | LM2596/ESP32 board/relay/OLED/DS18B20 module-level data (sources not re-fetched), Amptek battery limits, motor ratings, module current rating, wiring ratings, firmware, telemetry path. |

Corrected schematic: `ECS_corrected_schematic.svg` (block-level). It replaces `battery-monitoring-schematic.svg/.png`; originals are untouched.

Proposed test ladder: (0) inspect/photograph every board; (1) set buck to 5.00 V unloaded then loaded; (2) USB-only firmware bring-up with buck output disconnected; (3) bench 12 V supply, 0.5 A limit, check both nodes with a meter before connecting GPIOs; (4) ACS712 calibration against a clamp/series meter with a resistive load at 1, 3, 5 A; (5) motor: measure no-load/loaded/stall with a *clamp* meter before choosing F1; (6) full run with F1/F2 fitted, supervised, stopping on heat/odour/reset.

Sources I actually opened: [ESP-IDF ADC documentation v4.4.2](https://docs.espressif.com/projects/esp-idf/en/v4.4.2/esp32/api-reference/peripherals/adc.html) · [Allegro ACS712 datasheet rev 22](https://www.allegromicro.com/~/media/Files/Datasheets/ACS712-Datasheet.ashx). See the Rev 2 addendum for the sources opened in the follow-up check.

---

## Rev 2 addendum — follow-up verification (same day)

Done after you asked whether this can be trusted. Original findings stand; nothing needed reversing.

**Newly confirmed against primary sources**
- **LM2596** ([TI datasheet SNVS124G](https://www.ti.com/lit/ds/symlink/lm2596.pdf)): input 4.5–40 V operating (45 V absolute max); adjustable output ±4 % over line/load, so a meter-set output is required (agrees with the guide); feedback reference 1.23 V; 3 A rating is under TI's test circuit with heat sink/layout, efficiency 73–80 % at 3 A, quiescent 5–10 mA. Consequence: the 10.5–14.8 V battery range is inside the IC's limits; the "does your *module* match the IC" question stays open (cheap boards differ).
- **DS18B20** (datasheet copies, e.g. the Maxim/ADI PDF hosted [here](https://user-web.icecube.wisc.edu/~kitamura/NK/Datasheets/Dallas_1Wire/DS18B20.pdf)): supply 3.0–5.5 V, ±0.5 °C over −10…+85 °C, 4.7 kΩ pull-up on DQ, power-on reset value of the temperature register is **+85 °C**.
- **Schematic render check:** rendered and fixed overflowing text in the ESP32 box; the corrected SVG now displays cleanly.

**New firmware/design notes from this check**
1. DS18B20: treat a reading of exactly **85.0 °C right after power-up** as invalid (reset value), and −127 °C as "sensor/pull-up missing". Report `temperature: null` in both cases.
2. Input dips: stalling or starting the motor can pull the 12 V bus down. The LM2596 keeps regulating down to roughly 7 V for a fixed 5 V part (datasheet test condition), but a dip below that may reset the ESP32. Many modules already carry an input electrolytic; if resets occur, add ~470 µF, ≥25 V low-ESR across the buck input (TI's reference uses 470 µF/50 V).
3. Ceramic-only input bypass on an LM2596 can ring (TI warns about this); do not replace the module's electrolytic with ceramics.

**Still not checked by me**
- ESP32-DevKitC power-pin guide and your actual board (clones differ), Songle relay datasheet (relay is out of the design anyway), the Amptek battery sheet, the OLED/ACS/LM2596 *physical* modules, motor ratings, the website code, and the Wokwi project. These need your photos/measurements.
- Generic lead-acid OCV and SoC thresholds, Peukert exponent 1.2, and fuse/wire rules of thumb are engineering defaults, not facts about your parts.
