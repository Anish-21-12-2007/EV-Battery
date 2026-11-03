# Astra handoff — ECS battery-monitoring wiring reference (audited revision)

Self-contained. Supersedes the previous handoff, which put the ACS712 in the motor branch only, powered the OLED from 5 V as an option, had no temperature sensor and used out-of-range dividers.

**Honesty rules for the 3D model**
- **Nothing in this package is VERIFIED on physical hardware.** Status words below: CALCULATED, CONDITIONAL, UNVERIFIED. Component connector positions/orientations are **unknown**; do not invent them. Place terminals where the existing GLB already has them and label only what the CSV names.
- The 3D model **must follow `battery-monitoring-pinout_CORRECTED.csv` row by row**, not visual guesswork or the old 3D wiring.
- Do not edit website telemetry, Firebase settings, dashboard or viewer controls. Do not add simulated or fabricated readings.
- Keep this visible caveat in the scene/UI: "Conditional educational visualization; not electrically verified; see audit report."

## Files
- Wiring table (authoritative): `audit/battery-monitoring-pinout_CORRECTED.csv`
- Schematic: `audit/ECS_corrected_schematic.svg` (block-level; not render-tested here)
- Audit report: `audit/ECS_INDEPENDENT_AUDIT_REPORT.md`; calculations: `audit/audit_calcs.py`, `audit/audit_calcs_output.txt`
- Original files untouched.

## Final component list (for modelling)
1. 12 V VRLA battery, Amptek AT12-7.6 (BAT+, BAT−)
2. F1 main fuse + holder (rating TBD; **do not label 30 A as approved**)
3. SW1 rocker switch (DC rating TBD)
4. ACS712-30A breakout (IP+, IP−, VCC, GND, OUT)
5. Load bus / terminal block (+)
6. DC motor (12 V-class, ratings TBD)
7. F2 small inline fuse, 1–2 A (**new**)
8. LM2596 buck module (IN+, IN−, OUT+, OUT−), output set to 5.00 V
9. ESP32 30-pin dev board (VIN/5V, 3V3, GND, GPIO34, GPIO35, GPIO21, GPIO22, GPIO4, GPIO25 reserved)
10. 0.96-in SSD1306 OLED (VCC, GND, SDA, SCL)
11. DS18B20 temperature probe on the battery case wall (**new**, UNVERIFIED module) + 4.7 kΩ pull-up
12. Resistors: R1 15 kΩ, R2 20 kΩ, R3 **62 kΩ**, R4 10 kΩ (all 1 %); C1, C2 100 nF; 100 nF across motor terminals
13. Relay module: **show as "NOT CONNECTED — TBD"**; no wires

## Terminal-to-terminal netlist (matches CSV W01–W36)
**High-current (red, thick):**
1. BAT+ → F1 IN; F1 OUT → SW1 IN; SW1 OUT → ACS IP+; ACS IP− → LOAD BUS +
2. LOAD BUS + → Motor +
**High-current return (black, thick):** 3. Motor − → BAT− star post (separate conductor)
**Low-current power:** 4. LOAD BUS + → F2 → LM2596 IN+; BAT− star post → LM2596 IN−
**5 V (orange):** 5. LM2596 OUT+ → ESP32 VIN/5V (exact label TBD); LM2596 OUT+ → ACS VCC
**Logic ground (green):** 6. LM2596 OUT− → ESP32 GND, ACS GND; ESP32 GND → OLED GND, DS18B20 GND, R2 bottom, R4 bottom, C1 bottom, C2 bottom
**3.3 V (pink):** 7. ESP32 3V3 → OLED VCC, DS18B20 VDD, 4.7 kΩ to DQ
**Analog (purple):**
8. ACS OUT → R1 15 kΩ → node A → GPIO34; node A → R2 20 kΩ → GND; node A → C1 100 nF → GND
9. LOAD BUS + → R3 62 kΩ → node B → GPIO35; node B → R4 10 kΩ → GND; node B → C2 100 nF → GND
**I²C (blue):** 10. GPIO21 ↔ OLED SDA; GPIO22 ↔ OLED SCL
**1-Wire (yellow):** 11. GPIO4 ↔ DS18B20 DQ
**Not connected (dashed grey, "TBD / NOT CONNECTED"):** GPIO25, relay VCC/GND/IN/COM/NO/NC.

## Routing groups
- **Group A (heavy):** W01–W06 and motor bus; keep short, thick, no breadboard.
- **Group B (low-current power):** W08–W14; thin, separated from Group A.
- **Group C (signals):** W15–W24, W26–W27, W31; keep away from Group A; twisted/short.
- Draw wires as continuous curves with both ends seated on named terminals. No floating ends.

## Verification classes for labels
- CALCULATED: dividers, ACS scaling, F2 current budget (rows W08, W16–W24).
- CONDITIONAL: anything depending on module silkscreen/pinout (ACS, LM2596, ESP32 header, OLED).
- UNVERIFIED: motor, F1 value, SW1 rating, DS18B20 module/probe wire colours (chip specs datasheet-confirmed), relay, TVS (optional, may be omitted).

## Hard prohibitions
- Never draw 12 V to any ESP32 GPIO/ADC/3V3, OLED or DS18B20 pin.
- Never draw the OLED powered from 5 V (former option deleted).
- Never draw the relay in the motor path.
- Never present the 30 A fuse as approved.
- Do not show the old 120 kΩ/22 kΩ divider; use 62 kΩ/10 kΩ.

## Unresolved items (must be resolved before final model labels change to VERIFIED)
Motor nameplate/start/stall current; ACS712 module PCB rating and terminal map; LM2596 board pin labels and IN−/OUT− continuity; ESP32 board exact model and 5V/VIN pin; OLED supply range, address and pull-up rail; DS18B20 module/probe pinout; F1 value and wire gauge; Amptek battery sheet (charge limits, discharge curve for Peukert exponent).

## Data semantics the dashboard should reflect (for future wiring of telemetry, not for this task)
`voltage`, `current` (measured); `power` (calculated, battery-side input); `temperature` (measured, battery case surface); `stateOfCharge`, `remainingCapacityAh`, `remainingEnergyWh` (**estimates**); `motorRunning` (inferred from current); `timestamp`; `sensorStatus`. Missing → null / "--", never zero.
