# FINAL_EV_EMS_ENGINEERING_PACKAGE — Upgraded Circuit & Engineering Audit Package

**Release Date:** 2026-11-02  
**Package Scope:** Complete engineering audit, schematic/netlist correction, datasheet specification verification, and safety review of the 12 V Educational Battery & Two-Load (Light + Motor) Energy Monitoring Circuit and its strict separation from the illustrative 96 V EV simulator.  
**Disposition:** Documentary engineering design, audit, and safety package only. No physical hardware was energized or measured, no physical test results are fabricated, and no untested circuit is claimed to be build-ready.

---

## 1. Critical Safety & System Boundary Read-First

1. **Strict Separation of the 12 V Monitoring Circuit and 96 V Illustrative EV Simulator:**
   - The 12 V monitoring circuit (`BAT1` 12 V / 7.6 Ah candidate, 18.0 V DC sense ceiling design assumption, TI `LM2596` regulator IC rated 4.5–40 V maximum input, and non-automotive Allegro `ACS712ELCTR-30A-T` current sensor IC candidate) and the repository's standalone 96 V, 150 Ah (14.4 kWh) EV vehicle simulator are **two completely separate systems**.
   - **NEVER connect a 96 V battery pack or traction bus to the 12 V monitoring circuit, `LM2596` module, `ACS712` breakout, or `ESP32` ADC dividers.** Connecting 96 V exceeds the 40 V absolute maximum input rating of the `LM2596` IC ([TI LM2596 Datasheet, Rev. G](https://www.ti.com/lit/ds/symlink/lm2596.pdf)) and drives the `68 kΩ / 10 kΩ` divider nodes to `12.31 V` (exceeding the classic `ESP32` `3.6 V` powered GPIO absolute maximum limit).

2. **Why Single-Sensor Upstream Topologies Cannot Resolve Two Loads:**
   - The legacy/handoff circuit places a single `ACS712` upstream of a common switched positive bus (`BUS+`), reading the aggregate sum of motor current and electronics (`LM2596` + `ESP32`) current without a separate Light branch.
   - Resolving individual Light (`L1`) and Motor (`MDRV` / `M1`) branch power and energy (`P_L = V_L × I_L`, `P_M = V_M × I_M`) requires **one dedicated current transducer in series with each branch** (`S_L` and `S_M`) paired with **one voltage-sense channel at each corresponding branch DC input boundary** (`R_LH/R_LL` on `GPIO33` and `R_VH/R_VL` on `GPIO35`).
   - Do **not** add an upstream main-battery current sensor reading to the sum of branch energies (`E_L + E_M`), as that double-counts both load branches.

3. **Why This Package Flags Unknown Ratings (`TBD`) Instead of Guessing:**
   - Physical hardware photographs, manufacturer part numbers for breakout PCBs, motor nameplate ratings (rated/start/stall current, unidirectional vs. reversing H-bridge topology), lamp wattage/inrush, wire gauges (`AWG`/`mm²`), and battery short-circuit current (`I_sc`) were not present in the original files.
   - Because students may attempt to construct this circuit in a laboratory, **guessing fuse ratings, wire sizes, or transient diode polarities is unsafe**. Every unverified value is explicitly flagged `TBD` (`REQUIRES ADDITIONAL INFORMATION` or `REQUIRES COMPONENT IDENTIFICATION`), accompanied by the exact engineering equations and step-by-step selection procedures required before physical construction.

---

## 2. Summary of Upgrades & Corrections in `FINAL_EV_EMS_ENGINEERING_PACKAGE.zip`

All corrections are logged with full evidence traceability in [`CHANGELOG_AND_CORRECTION_REGISTER.md`](CHANGELOG_AND_CORRECTION_REGISTER.md) and [`INDEPENDENT_AUDIT_REPORT.md`](INDEPENDENT_AUDIT_REPORT.md):

1. **Corrected Schematic Return-Path Topology Bug (`Finding I10` / `SCH-01`):**
   - In the prior `03_Circuit_Design/2D_circuit_schematic.svg`, the negative returns from `L1 light`, `MDRV`, and `ESP32` were drawn tied to a single shared vertical wire on the right side (`x=1205`) before reaching `BAT−`, and the `DC/DC` converter (`U_BUCK_BOARD`) had **no ground connections drawn at all** (`W014` and `W016` were missing from the drawing).
   - **Upgraded Correction:** Redesigned `03_Circuit_Design/2D_circuit_schematic.svg` (and high-resolution `.png`) and `01_System_Overview/circuit_block_diagram.svg` (and `.png`) so that `L1` (`W007`), `MDRV` (`W011`), and `U_BUCK_BOARD.IN−` (`W014`) run via **separate dedicated home-run conductors** to the high-current `JGND.STAR_RETURN` busbar, while `U_BUCK_BOARD.OUT−` (`W016`), `U_ESP.GND` (`W017`), sensor grounds (`W019`, `W021`), and divider/filter grounds (`W027`–`W043`) connect to the quiet `JGND.LOGIC_GND` busbar linked by a single Kelvin star tie (`W053`).
2. **Eliminated Schematic Text Collisions & Added Missing Netlist Elements (`Finding I11` / `SCH-02`–`04`):**
   - Fixed overlapping labels in the prior schematic (`NODE_VL`, `NODE_IM`, `NODE_VM`, `BAT1`, and `V_M+ tap`), added the downstream DC motor `M1` (`W054`, `W055`), unified conditioner block `U_I_L` (`W022`, `W023`), added sensor `VCC`/`GND` ports (`W018`–`W021`), and added explicit conditional footprints for `RP1`, `TVS1` (`W060`), `D1`, `C_BYP_M` (`W056`–`W057`), and `C_FILTER_M` (`W058`–`W059`).
3. **Reconciled BOM (`component_list.csv`) and Wiring Netlist (`wiring_connections.csv`) to 100% Referential Integrity (`Findings I12` & `I13`):**
   - Fixed the column header typo `vidence_or_condition` → `evidence_or_condition` in `wiring_connections.csv`.
   - Unified the Light current-conditioner designator (`U_I_L`, noting legacy alias `R_I_L`) across BOM, netlist, and schematic.
   - Added missing BOM rows for `JGND`, `NODE_VL`, `NODE_IM`, and `NODE_VM` (Expanding BOM from 31 to 42 items) and expanded `wiring_connections.csv` from 52 to 60 connections (`W001`–`W060`), verified programmatically by `06_Validation/package_consistency_verifier.py`.
4. **Expanded Electrical & Safety Calculations (`06_Validation/calculation_checks.py` & `calculation_results.json`):**
   - Added quantitative proof of why an `ACS712ELCTR-30A-T` (`66 mV/A`, scaled to `28.085 mV/A`) cannot resolve a `0.5 A` Light branch (`14.04 mV` signal shift vs. Espressif's `±60 mV` calibrated ADC error = `±2.136 A` or `±427.3%` error), and evaluated `ACS712ELCTR-05B-T` (`185 mV/A`) and `INA219` digital $	ext{I}^2	ext{C}$ shunt alternatives.
   - Quantified unpowered-MCU GPIO backfeed/injection currents (`ESP32` absolute maximum pin rating is `0.3 V` when $V_{	ext{DD}} = 0	ext{ V}$, whereas an energized 5 V `ACS712` outputs `1.0638 V` scaled at `0 A` and `18 V` dividers output `2.3077 V`), open-bottom-resistor fault currents, `±2%` 5 V buck rail ratiometric zero-drift errors (`±0.758 A`), and single-ended return-wire voltage-drop errors.

---

## 3. Package Directory Map

- [`README.md`](README.md) — Package overview, safety boundaries, and directory index.
- [`INDEPENDENT_AUDIT_REPORT.md`](INDEPENDENT_AUDIT_REPORT.md) — Comprehensive engineering audit report covering `C1`–`C5`, `I1`–`I13`, `R1`–`R6`, `U1`–`U3`, and `A1`.
- [`CHANGELOG_AND_CORRECTION_REGISTER.md`](CHANGELOG_AND_CORRECTION_REGISTER.md) — Itemized log of every technical correction, schematic fix, netlist reconciliation, supporting evidence source, and open engineering gate.
- **`01_System_Overview/`**
  - [`system_architecture.md`](01_System_Overview/system_architecture.md) — Architectural comparison of single-sensor handoff vs. conditional two-load topology and 12 V vs. 96 V separation.
  - [`signal_and_power_flow.md`](01_System_Overview/signal_and_power_flow.md) — End-to-end DC power distribution, Kelvin star return routing, and ADC1 signal chain.
  - [`circuit_block_diagram.svg`](01_System_Overview/circuit_block_diagram.svg) & [`circuit_block_diagram.png`](01_System_Overview/circuit_block_diagram.png) — Upgraded high-resolution system block diagram.
- **`02_Component_Details/`**
  - [`component_list.csv`](02_Component_Details/component_list.csv) — Reconciled 42-item Bill of Materials with evidence sources and audit statuses.
  - [`component_specifications.md`](02_Component_Details/component_specifications.md) — Verified manufacturer IC specifications vs. unidentified breakout module boundaries.
  - [`datasheets_and_source_links.md`](02_Component_Details/datasheets_and_source_links.md) — Direct manufacturer datasheet and engineering standard links.
  - [`unresolved_component_identification.md`](02_Component_Details/unresolved_component_identification.md) — Physical inspection evidence required for all 14 hardware categories before construction.
- **`03_Circuit_Design/`**
  - [`2D_circuit_schematic.svg`](03_Circuit_Design/2D_circuit_schematic.svg) & [`2D_circuit_schematic.png`](03_Circuit_Design/2D_circuit_schematic.png) — Upgraded, collision-free 2D engineering schematic with separate star returns and complete netlist annotations.
  - [`complete_circuit_explanation.md`](03_Circuit_Design/complete_circuit_explanation.md) — Detailed branch-by-branch circuit explanation and fault-mode walkthrough.
  - [`pin_mapping.md`](03_Circuit_Design/pin_mapping.md) — Classic `ESP32` `ADC1` (`GPIO32`–`35`), `I²C` (`GPIO21`/`22`), and `1-Wire` (`GPIO4`) pin mapping and electrical limits.
  - [`polarity_and_grounding.md`](03_Circuit_Design/polarity_and_grounding.md) — Sensor polarity (`IP+` → `IP−`), Kelvin star-grounding (`JGND`), and differential vs. single-ended sensing rules.
  - [`wiring_connections.csv`](03_Circuit_Design/wiring_connections.csv) — Reconciled 60-connection (`W001`–`W060`) point-to-point wiring schedule.
- **`04_Measurement_and_Calculations/`**
  - [`voltage_measurement.md`](04_Measurement_and_Calculations/voltage_measurement.md) — Voltage divider transfer equations, 1% vs. 0.1% corners, power dissipation, RC filtering, and return-drop error analysis.
  - [`current_measurement.md`](04_Measurement_and_Calculations/current_measurement.md) — `ACS712` transfer function, `27 kΩ / 20 kΩ` scaler, ratiometric `V_CC` drift, and `S_L` low-current sensor comparison (`ACS712-30A` vs. `ACS712-05B` vs. `INA219`).
  - [`power_energy_and_cost.md`](04_Measurement_and_Calculations/power_energy_and_cost.md) — Instantaneous power sampling, discrete-time energy integration, coulomb-counting caveats, and grid tariff boundaries.
  - [`calibration_requirements.md`](04_Measurement_and_Calculations/calibration_requirements.md) — Mandatory two-point/multipoint voltage, current, zero-offset, and dynamic integration calibration protocol.
  - [`worked_calculation_examples.md`](04_Measurement_and_Calculations/worked_calculation_examples.md) — Step-by-step worked derivations for all 12 V circuit and 96 V EV diagnostic equations.
- **`05_Protection_and_Safety/`**
  - [`fuse_and_protection_requirements.md`](05_Protection_and_Safety/fuse_and_protection_requirements.md) — Fuse selection rules (`F1`, `FL`, `FM`, `F2`), `AWG` wire ampacity reference table, voltage-drop sizing, and `I²t` coordination.
  - [`motor_and_inductive_load_protection.md`](05_Protection_and_Safety/motor_and_inductive_load_protection.md) — Motor startup inrush, unidirectional flyback diode (`D1`) vs. bidirectional H-bridge conflict, and DC contact breaking limits.
  - [`reverse_polarity_and_transient_protection.md`](05_Protection_and_Safety/reverse_polarity_and_transient_protection.md) — Reverse-polarity (`RP1`), bus TVS (`TVS1`), open-resistor fault, and unpowered-MCU injection protection.
  - [`unresolved_safety_decisions.md`](05_Protection_and_Safety/unresolved_safety_decisions.md) — 12 mandatory safety sign-off gates required prior to hardware assembly.
  - [`student_lab_safety_checklist.md`](05_Protection_and_Safety/student_lab_safety_checklist.md) — Practical step-by-step bench inspection and pre-energization safety checklist for college students.
- **`06_Validation/`**
  - [`calculation_checks.py`](06_Validation/calculation_checks.py) & [`calculation_results.json`](06_Validation/calculation_results.json) — Self-verifying Python calculation suite and captured JSON outputs.
  - [`package_consistency_verifier.py`](06_Validation/package_consistency_verifier.py) — Automated cross-check script verifying BOM-to-netlist foreign keys, SVG label presence, and numerical consistency.
  - [`engineering_calculation_checks.md`](06_Validation/engineering_calculation_checks.md) — Tabular verification summary of all divider, sensor, filter, power, and EV diagnostic checks.
  - [`known_errors_and_conflicts.md`](06_Validation/known_errors_and_conflicts.md) — Complete catalog of legacy 12 V errors, 96 V EV simulator flaws, and resolved schematic/netlist bugs.
  - [`simulation_and_test_plan.md`](06_Validation/simulation_and_test_plan.md) — Documentary model verification and future hardware qualification test plan.
  - [`verification_status.csv`](06_Validation/verification_status.csv) — Structured 28-item verification register (`C1`–`C5`, `I1`–`I13`, `R1`–`R6`, `U1`–`U3`, `A1`).
- **`07_References/`**
  - [`source_register.md`](07_References/source_register.md) — Audited register of 17 primary manufacturer datasheets and independent agency standards (`S1`–`S17`).
  - [`reference_material.md`](07_References/reference_material.md) — Engineering scope notes on datasheet interpretation, battery labels, fuel factors, and Wokwi simulator limitations.
