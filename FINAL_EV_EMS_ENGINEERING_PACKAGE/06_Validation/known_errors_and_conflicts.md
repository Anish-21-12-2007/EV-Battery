# Known Errors and Conflicts

## Legacy 12 V files

1. The old 120 kΩ / 22 kΩ voltage divider yields 2.789 V at 18 V nominal and exceeds the classic ESP32 11 dB suggested accuracy range. Current proposed value is 68 kΩ / 10 kΩ under the stated ceiling.
2. The old 15 kΩ / 20 kΩ current attenuation maps nominal +30 A ACS output to 2.56 V, beyond the 2.45 V characterized accuracy range. Current proposal 27 kΩ / 20 kΩ is conditional on direct ACS output and actual board inspection.
3. The older wiring prose calls the electronics supply branch fused while its table/schematic omits the branch fuse. Its ACS is motor-only and cannot include electronics current.
4. Prior references disagree on 56 kΩ, 62 kΩ and other divider values and suggest a 1–2 A F2 without enough evidence. Do not combine revision BOMs.
5. Existing simulation uses the older divider constants and synthetic slider ADC nodes; it does not simulate the analog component chain, real sensor or motor.
6. The current handoff’s one upstream sensor measures aggregate current, not separately identified Light and Motor currents.

## EV simulator

7. EV_W10 connects a DC/DC low-voltage output to CAN_H; EV_W11 connects coolant output to HV_MINUS. Both endpoint pairs are type-incompatible.
8. At 22 m/s full throttle, code force/power exceeds level-road load but the speed clamp prevents further acceleration without reducing power. Energy per distance therefore changes strongly with this implementation artifact.
9. Regen fraction wording says 28%; formula multiplies by motor/inverter efficiency and yields 23.436% before the cap/gates.
10. “Deterministic” ignores frame gaps: step clamps dt to 0.1 s and discards excess elapsed time.
11. maxMotorTorqueNm is defined but not used in tractive force; dcdcEff is defined but not applied to auxiliary draw. The +25% Charge action is an illustrative SOC increment rather than a charger model.
12. energyRemainingWh is SOC times nominal pack Wh, with no validated usable energy/reserve. The energyUsedWh accumulator integrates signed net power, so it can decrease under regeneration; label net energy or separate gross draw/recovery. No range estimator is implemented.
13. Petrol comparator fixes 7.2 L/100 km, 2.31 kg/L CO₂ and 9.1 kWh/L without fuel market or LHV/HHV basis; no fuel price is calculated. There is no electricity tariff or EV cost calculation.
14. Five website views do not constitute five EV devices. The code has one aggregate auxiliary slider from 0 to 1500 W and a fixed 180 W auxiliary term.
15. Dashboard field validation checks schema/ranges but does not enforce power=voltage×current or energy integration; the reviewed browser code contains no firmware publisher proof.

## Unverified hardware and claims

16. Component suffixes, breakout conditioning and ACS712 supply bypass/FILTER capacitors, fuses, motor/lamp, switch, wiring, physical pin header map, grounding and safety parts are unknown.
17. Divider math does not protect an ADC from transients, reverse voltage, module faults or a powered sensor driving an unpowered ESP32.
18. No physical tests or independent Wokwi run were performed for this package. No hardware accuracy or safety proof is implied.


---

## Package-Internal Discrepancies Resolved in `FINAL_EV_EMS_ENGINEERING_PACKAGE` (`Findings I10`–`I13`)

19. **Prior `2D_circuit_schematic.svg` Daisy-Chained Return Wire & Missing Buck Returns (`Finding I10`):** The prior schematic tied `L1`, `MDRV`, and `ESP32` returns to a single vertical wire (`x=1205`) and omitted `U_BUCK_BOARD` ground returns (`W014`, `W016`). Fixed in upgraded `2D_circuit_schematic.svg` and `.png`.
20. **Prior `2D_circuit_schematic.svg` Label Overlaps (`Finding I11`):** Fixed text collisions on `NODE_VL`, `NODE_IM`, `NODE_VM`, `BAT1`, and `V_M+ tap`, and added visual blocks for `M1` (`W054`, `W055`), `U_I_L`, `RP1`, `TVS1`, and `D1`.
21. **BOM vs. Netlist Foreign-Key Mismatches (`Finding I12`):** Unified `R_I_L` / `U_I_L` to `U_I_L` and added explicit BOM rows for `JGND`, `NODE_VL`, `NODE_IM`, and `NODE_VM`.
22. **Netlist Header Typo & Missing Downstream Wires (`Finding I13`):** Corrected `vidence_or_condition` → `evidence_or_condition` in `wiring_connections.csv` and added `W053`–`W060`.
