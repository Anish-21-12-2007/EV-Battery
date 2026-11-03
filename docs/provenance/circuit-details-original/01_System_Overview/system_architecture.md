# System Architecture

**Status:** proposed concept, not as-built. The existing single-sensor reference and the two-load proposal in this folder are deliberately separate.

## Existing project reference

The current handoff describes a nominal 12 V battery, main fuse F1, master switch, one ACS712 in the positive switched discharge path, a motor branch, an electronics branch with F2, and an LM2596-class regulator feeding ESP32/sensor electronics. Its sensor is upstream of the load bus, so it reads aggregate switched current through both motor and electronics branches. It cannot separate two device currents. The physical battery, motor, modules, ratings and wiring are not independently identified.

## New two-load concept in this package

This conditional arrangement measures two DC branch inputs independently:

1. Battery positive → F1 → SW1 → positive bus.
2. Positive bus → FL → current sensor S_L → assumed complete 12 V DC Light input.
3. Positive bus → FM → current sensor S_M → Motor controller/Motor input.
4. Positive bus → F2 → unidentified DC/DC module → ESP32 and low-voltage interfaces.
5. One voltage-divider channel senses each load/driver input positive relative to a quiet common reference. Each branch current channel and voltage channel must be paired at the same input boundary.
6. Load returns return to the battery negative star. Low-voltage analog grounds reference the named logic-ground junction. Common-ground behavior of the exact converter must be verified before connection.

S_L, lamp, motor, controller, fuses, switch, connector, wires and converter board are unidentified. The ACS712-30A is only a candidate for S_M if the actual motor branch range, module, current path and interface suit it. It is not a selected automotive component. A second identical ACS module for a small lamp is not assumed; a ±30 A variant can have poor useful resolution at small current.

## Measurement objective and limitations

Branch input electrical power can be estimated as P_L = V_L × I_L and P_M = V_M × I_M. Summed branch energy excludes controller/electronics consumption unless measured separately. Do not add a total battery sensor reading to the branch sum: that would double-count branch loads. Battery-post energy needs a sensor and voltage measurement at battery terminals, with the charger path and converter losses defined.

One-ended dividers to BAT− do not measure true differential load voltage if the negative return wire has a meaningful drop. Either use a qualified differential front end or characterize/accept that return-reference error. PWM motor drive requires a defined input boundary and sampling method; the schematic places measurements at the controller input, not directly across PWM motor terminals.

## Explicit separation from the EV model

The website’s illustrative 96 V, 150 Ah EV proxy and this low-voltage educational circuit are unrelated. The proposal is not rated for 96 V. The LM2596 regulator IC’s specified input range ends at 40 V. Do not join simulator values, a high-voltage battery or its traction components to this low-voltage design.
