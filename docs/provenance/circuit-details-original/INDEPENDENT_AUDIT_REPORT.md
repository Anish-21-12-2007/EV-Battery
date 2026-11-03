# Independent Engineering Audit Report

**Audit date:** 2026-11-02  
**Project reviewed:** ECS-Battery-Monitoring workspace  
**Review type:** source inspection, cross-checked arithmetic, and comparison of project documentation, wiring tables, schematics and code.  
**Physical testing:** none. No hardware inspection, energization, calibration, range test, or new Wokwi execution is claimed.

## Executive finding

The project’s newest 12 V ECS reference is a conditional single-sensor proposal. Its passive-divider arithmetic is internally consistent for an assumed maximum of 18 V DC and specified components. The current sensor sits before the load bus, so its current is aggregate switched discharge current, including the electronics branch. It cannot resolve a Light load and Motor load separately. A new conditional two-load architecture is included in this folder only to make the measurement requirement explicit; it does not replace or silently edit the project originals.

No fuse value, wire gauge, connector, switch, motor, lamp, battery charge limit, transient suppressor, or exact board/module can be approved from the evidence supplied. The 12 V circuit is not an automotive circuit. Keep it electrically and conceptually separate from the project’s illustrative 96 V EV simulator.

The EV source contains one illustrative vehicle and an aggregate auxiliary slider. No five separately modeled devices or range estimator were found. Some bookkeeping equations are dimensionally valid, but the speed-cap/full-throttle behavior, battery parameters and fuel factors do not support a physical range or cost claim.

## Classification summary

### Confirmed correct

**C1 — Current handoff divider arithmetic.** For 68 kΩ over 10 kΩ, the nominal divider ratio is 10/78 = 0.128205. At the assumed 18.0 V DC input the ADC node is 2.3077 V. With independent 1% corners chosen to maximize the output (top 67.32 kΩ, bottom 10.10 kΩ), it is 2.3482 V. The 2.45 V characterized upper range is reached at about 18.780 V at that corner. This leaves only a small margin above the assumed 18 V DC ceiling and says nothing about transients.

For a direct ACS712 output scaled by 27 kΩ / 20 kΩ, the ratio is 20/47 = 0.425532. With 5.00 V sensor supply and nominal 2.50 V zero output, the ADC node is 1.0638 V at zero current. With the ±30 A IC variant’s nominal 66 mV/A sensitivity, nominal endpoints are 0.2213 V at −30 A and 1.9064 V at +30 A. ADC sensitivity is 28.085 mV/A. If the sensor output is bounded by 5.5 V, the 1% worst resistor corner produces 2.3674 V. This assumes direct, correctly identified sensor output and excludes faults and transients. See Allegro and Espressif in the [source register](07_References/source_register.md).

**C2 — Basic power, energy and coulomb-counting identities.** P = V·I, E(Wh) = sum(P(W)·Δt(s))/3600, and ΔSOC = −sum(I(A)·Δt(s))/(3600·capacity(Ah)) are dimensionally correct for a defined current sign and integration boundary. Correct identities do not validate the input sensors, sampling, calibration, battery model or resulting range.

**C3 — Nominal capacity multiplication.** 12 V × 7.6 Ah = 91.2 Wh and 96 V × 150 Ah = 14,400 Wh = 14.4 kWh. These are nominal products only. Neither establishes usable energy or range.

**C4 — Source-backed IC limits.** Allegro’s ACS712 IC documentation supports a 4.5–5.5 V supply, variant-dependent sensitivity, increasing output for current from IP+ to IP−, and explicitly says the part is not intended for automotive applications. TI specifies the LM2596 IC input range as 4.5–40 V and a 3 A regulator under its design/thermal conditions. Neither source establishes a generic breakout board’s ratings. Littelfuse explains fuse selection depends on time-current behavior, current and voltage ratings, interrupting capacity and the prospective fault. Omron identifies motors and lamps as inrush loads; its generic example ratios are not a rating for this unknown device.

**C5 — Existing documentation boundary.** The current handoff marks F1/F2 and exact boards unresolved, leaves the relay unwired, calls the 3D ports logical, and does not claim physical proof. The dashboard’s battery percentage and cost N/A states are appropriate while estimator and tariff inputs are absent.

### Incorrect — correction and evidence

**I1 — Legacy voltage divider exceeds the stated ADC characterization target.** The old 120 kΩ / 22 kΩ ratio is 0.154930. At 18 V it produces 2.7887 V nominal and 2.8362 V at 1% worst corner. The 2.45 V suggested upper accuracy range is reached at about 15.814 V nominal or 15.549 V at the worst corner. Retire or label that circuit as superseded. The current 68 kΩ / 10 kΩ pair is the numerically suitable proposal only within its 18 V DC assumption and is not transient protection.

**I2 — Legacy current scaler exceeds the stated range at positive full scale.** The old 15 kΩ / 20 kΩ ratio is 0.571429. A nominal +30 A ACS712-30A output of 4.48 V yields 2.560 V at the ADC node; 2.45 V is crossed at about +27.08 A. Replace it consistently with the current 27 kΩ / 20 kΩ proposal only after verifying the sensor suffix and breakout conditioning. 2.56 V is above the cited accuracy range; this calculation alone does not establish immediate GPIO damage.

**I3 — The legacy “fused branch” description conflicts with its wiring.** The older guide calls the electronics branch fused, but the older drawing/table lacks F2 in the actual path. Its sensor is in the motor-only branch, so it cannot measure ESP32/buck current. Correct the text/netlist together, or mark that version historical. The current handoff places F2 on the electronics branch and the ACS sensor in the common switched path; that measures aggregate current, not separate branch currents.

**I4 — Two EV harness mappings are type-incompatible.** In ev-vehicle-data.js, EV_W10 routes DC-DC LV_OUT_PLUS to VCU CAN_H, and EV_W11 routes cooling OUT to battery HV_MINUS. Remove them or leave them disconnected until compatible endpoints are defined. A viewer warning is not a correction.

**I5 — EV full-throttle power at the imposed speed limit does not balance road load.** At the code defaults, 50% SOC, level road and 22 m/s: combined motor/inverter efficiency is 0.90×0.93 = 0.837; drag is 191.51 N; rolling resistance is 84.76 N; road load is 276.27 N; wheel power required to hold speed is 6.078 kW. The model’s steady battery demand at that speed is about 7.441 kW including 180 W auxiliary power, or 93.96 Wh/km.

At full throttle the engine still requests 18 kW mechanical power. At 22 m/s this is about 818.18 N, almost three times the modeled road load. It then clips vehicle speed to 22 m/s without reducing tractive power or accounting for excess power. The corresponding modeled battery demand is 21.685 kW or 273.81 Wh/km. Do not present either consumption or any resulting distance as a validated range. Correct the force/power behavior before treating outputs as engineering results.

Dividing 14.4 kWh nominal by those rates gives 153.3 km and 52.6 km; half nominal energy gives 76.6 km and 26.3 km. These deliberately show the model inconsistency and are arithmetic diagnostics only, not range estimates. They assume 100% nominal energy usable, no reserve and steady operation.

**I6 — “Deterministic” is overstated.** The frame loop clamps elapsed frame time to 0.1 s and drops time beyond that. Backgrounding or a delayed frame changes integrated distance/energy. Describe it as an interactive frame-stepped illustration or specify a fixed-step accumulator and gap policy.

**I7 — Regen fraction wording is wrong.** The model multiplies 0.90 motor efficiency × 0.93 inverter efficiency × 0.28 parameter = 0.23436, or 23.436%, before the 10 kW cap and SOC/speed/braking gates. The statement “up to 28% of braking power” does not match that formula. The 10 kW cap is not verified motor or pack charge acceptance.

**I8 — Petrol CO₂ factor does not match EPA’s US gasoline baseline.** The viewer uses 2.31 kg/L. EPA’s listed 8.887 kg CO₂/US gallon converts using 3.785411784 L/US gal to 2.34770 kg/L. At the code’s assumed 7.2 L/100 km, old value is 16.632 kg/100 km; EPA factor gives 16.903 kg/100 km. Use the cited basis or label and cite a different fuel/market basis. EPA’s value is not universal.

**I9 — No five-device calculation is present.** index.html has five website views; that is not five modeled devices. The EV source has one auxPowerW = 180, one aggregate 0–1500 W slider and no five device records or individual duty cycles. Do not claim five-device results. Obtain each device’s identity, bus, voltage, rated/peak power, duty cycle, simultaneous-use assumption and conversion boundary before modeling.

**I10 — Unused/ambiguous EV parameters undermine specific claims.** maxMotorTorqueNm = 180 is not used in the tractive-force calculation. dcdcEff = 0.88 is defined but not applied to the 180 W auxiliary-load term. If 180 W is a 12 V output load, idealized pack-side draw before other losses is 180/0.88 = 204.55 W; if it is already pack-side, document that. The +25% Charge control is an illustrative SOC jump, not an 11 kW charger model. The energyRemainingWh field assumes SOC × nominal capacity and does not represent validated usable energy.

**I11 — “Energy used” is a signed net accumulator.** The engine integrates signed net pack power; regenerative power subtracts from energyUsedWh. The displayed quantity can therefore decrease during regeneration and is net energy, not gross traction/auxiliary energy consumed. Label it net pack energy or track discharge and recovered energy separately.

### Requires additional information

**R1 — Protection and conductor ratings.** No battery prospective short-circuit current, fuse family/curve, fuse holder, wire size/length/insulation/installation, switch DC motor rating, connector rating, motor rated/start/stall current or load profile was provided. Therefore no fuse current rating can be selected. F1 should be near the source positive terminal; branch fuses should protect conductors at branch takeoff. Check time-current/I²t coordination, DC voltage and interrupting rating against prospective fault current, ambient derating, holder and weakest protected conductor. The example 0.391 A buck input is a load-budget illustration, not an F2 rating.

**R2 — Reverse polarity and transient protection.** Existing dividers do not protect GPIOs against reverse voltage, surges, shorted resistors, a sensor powered while the ESP32 is off, or motor transients. No rated TVS, reverse-polarity device, input clamps or coordinated protection exists in the reviewed circuit. Choose these only after battery and motor/driver data and measured/design transient limits exist.

**R3 — Modules and pinout.** Exact ACS712 suffix/breakout and its VCC bypass/FILTER capacitors, buck module, ESP32 board, OLED module, DS18B20 probe, sensor interfaces and connector header map are missing. GPIO34/35 are valid input-only ADC1 GPIOs on classic ESP32; GPIO32/33 are also ADC1 candidates. This does not prove the positions on the installed development board. A regulator IC datasheet cannot qualify an unknown module.

**R4 — Battery and range model.** Amptek’s current product table lists 12 V, 7.6 Ah and 2050 g for a model. The linked data sheet was not retrievable in the audit review, and the installed battery/revision is not confirmed. Charge voltage/current, discharge curve/rate, usable capacity, temperature/age behavior, short-circuit capability and cutoffs remain unknown. The EV proxy’s 0.035 Ω internal resistance, NMC proxy OCV curve, 150 Ah, and 10 kW regen limit lack a pack/cell/BMS basis. A label “24 prismatic cell modules” cannot be mapped to 96 V without cell/module series details. Do not use the simulated OCV endpoints as real cutoffs.

**R5 — Device model and boundaries.** The requested meaning of “five devices” is not evidenced. If 180 W auxiliary power is a 12 V output demand, the DC-DC efficiency affects pack draw; if it is pack-side, document that. No driving cycle, reserve, ambient, road, passenger/load, speed or validated Wh/km is specified. DOE states EV range depends on driving conditions, acceleration, temperature, speed and load. A range estimate requires defined usable energy/reserve and a validated consumption cycle.

**R6 — Cost basis.** No electricity tariff, charging efficiency, time-of-use period, demand charges, taxes, fuel price, or local-market gasoline basis is configured. Dashboard N/A is correct. The comparison’s 9.1 kWh/L gasoline factor lacks a declared LHV/HHV basis; DOE AFDC’s gasoline/E10 LHV range converts to about 8.680–8.988 kWh/L. Do not use that fuel factor to claim equivalent delivered traction energy without an efficiency boundary.

**R7 — Separately metering two loads.** Existing ACS712 is upstream of a common load bus. It measures sum current and cannot distinguish Light from Motor. A two-load measurement needs one suitable current transducer per branch and voltage measurement at each same branch input boundary. Sensor range and conditioner must fit each actual load. A third total-battery sensor is required if controller/DC-DC consumption is to be included separately; do not add branch currents again to a main sensor’s total.

### Unverified — do not assume correct

**U1 — The Light branch, its electrical type and five-device model are not in the project.** The current handoff shows one motor branch, not a light. The two-load schematic here assumes a complete 12 V DC lamp/load and makes no claim about actual hardware. It does not represent a bare LED without its required driver/current limiting.

**U2 — Physical installation and telemetry.** No photo, continuity trace, DMM result, current calibration, connector map, live firmware publisher or physical measurement was independently retained in this review. The dashboard accepts fields including voltage/current/power/energy but does not verify P = V·I or the energy integral. No physical test or verified live telemetry is asserted.

**U3 — Wokwi material.** Existing Wokwi code says its sliders synthesize ADC-node values; its old constants are 120 kΩ/22 kΩ and 15 kΩ/20 kΩ. Wokwi documentation says its potentiometer does not implement full analog simulation and returns the same result without VCC/GND. Existing README reports an earlier partial run, but no saved project URL or complete reproducibility record was found. This audit did not rerun it.

**U4 — Legacy/current documents are not one coherent revision.** Older pinout, wiring guide, schematic, correction references and current 13 October handoff contain different divider values and fuse wording. Until reconciled, mark the older set historical/superseded; do not combine its BOM with the latest handoff.

## Measurement boundary and interpretation

The existing handoff’s sensor is before its load bus and sees current through the switched path, including the buck/electronics branch. Its voltage tap is downstream; V×I estimates downstream DC electrical power at those measurement boundaries, not battery-post input, motor-terminal power or shaft output. A charger wired at battery posts may bypass the ACS sensor.

For the new proposed two-load drawing, each branch current is sensed in series and each branch voltage is sensed at that branch’s DC input. This can estimate branch input power if the voltage/current sampling, return reference, sensor calibration and measurement boundary are valid. Separate one-ended dividers referenced to BAT− are not a true differential measurement of load-terminal voltage when the return wire has material voltage drop. Use a suitable differential measurement front end or quantify/accept the error if true terminal power is required.

## Exact project files or sections that need revision

No changes were made to these originals. Use the new folder as an audit handoff.

1. **Legacy 12 V circuit**
   - battery-monitoring-reference/battery-monitoring-wiring-guide.md — architecture, motor/ACS path, divider section and connection table: single/motor-only sensor, missing electronics fuse in legacy drawing, and obsolete resistor values.
   - battery-monitoring-reference/battery-monitoring-pinout.csv — legacy sensor and divider rows, especially P04–P08 and P13–P20.
   - battery-monitoring-reference/battery-monitoring-schematic.svg and .png — old topology, no explicit electronics F2, motor-only ACS path, older dividers.
   - battery-monitoring-reference/battery-monitoring-validation-report.md — legacy calculations, protection and Wokwi evidence sections.
   - battery-monitoring-reference/battery-monitoring-simulation/sketch.ino — synthetic-slider description is correct, but old 120 kΩ/22 kΩ and 15 kΩ/20 kΩ arithmetic must be identified as legacy or updated.
   - battery-monitoring-reference/battery-monitoring-simulation/README.md — retain the reported-run qualification; do not represent as independent reproduction.

2. **Conflicting prior correction references**
   - hardware-validation/provided-references/ECS_INDEPENDENT_AUDIT_REPORT.md
   - hardware-validation/battery-monitoring-pinout_CORRECTED.csv
   - hardware-validation/ASTRA_3D_WIRING_HANDOFF_VERIFIED.md
   These contain conflicting 62 kΩ, 56 kΩ, 15 kΩ / 20 kΩ or provisional F2 language. Mark as superseded or align.

3. **Current 12 V hardware handoff**
   - hardware-validation/ASTRA_3D_WIRING_HANDOFF_FINAL.md
   - hardware-validation/corrected-wiring-table.csv
   - hardware-validation/calculations.py and .json
   These are the current one-sensor conditional reference, not a Light+Motor branch measurement system. Add separate branch current/voltage channels only after part identification and user decisions. Keep 18 V labelled as design assumption and both fuse ratings TBD.

4. **EV model, claims and simulator**
   - README.md — “EV Hardware Twin” (24 modules/96 V mapping), “EV Simulator” (deterministic, physically coherent, regen, OCV cutoffs and petrol factors), “Validation” (tests are instructions, not audit evidence), and “Model limits.”
   - ev-simulation-engine.js — OCV curve/cutoff comments, internal resistance, speed cap, motor torque, frame-step handling, regen wording/cap and energyRemainingWh semantics.
   - ev-vehicle-data.js — NMC/96 V/150 Ah defaults, 180 W auxiliary boundary, unused torque/efficiency settings, EV_W10 and EV_W11.
   - ev-viewer.js — fixed 7.2 L/100 km, 2.31 kg/L CO₂ and 9.1 kWh/L gasoline factors.
   - index.html — 0–1500 W single aggregate auxiliary slider and EV/petrol labels; the five website views are not five devices.

5. **Telemetry boundary**
   - app.js — accepted values validate shape/range, but power/current/voltage/energy relationships are not cross-checked and no device firmware is present to establish the claimed physical source.
   - README.md telemetry/authentication section — clarify accepted schema does not verify derivation, sensor accuracy or live hardware provenance.

## Evidence sources

Direct manufacturer and independent sources with scope/page detail are in [source_register.md](07_References/source_register.md). The source links support documentary claims; they do not prove a physical installation.
