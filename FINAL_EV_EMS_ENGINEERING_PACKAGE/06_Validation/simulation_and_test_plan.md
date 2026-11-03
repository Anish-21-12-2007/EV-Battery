# Simulation and Test Plan — Planned, Not Executed

This file is a future validation plan. No items below were performed for this audit.

## Documentary and model checks

1. Obtain exact product manuals and reconcile the component list, schematic and CSV netlist.
2. Use an electrical simulator only after exact models and values are available; state model version, sources, tolerances, temperature, transient source impedance and boundaries.
3. Model sensor power-up/down, reversed input, open/shorted divider legs, maximum DC input, motor-driver switching transients and fuse time-current behavior. A slider-only ADC model is not proof of the analog front end.
4. For the EV simulator, correct or explicitly constrain tractive power at the speed limit, define auxiliary-load side and DC/DC conversion, validate pack/cell/BMS data, and compare against a stated drive cycle before reporting Wh/km or range.
5. For a five-device scenario, define every device separately, including supply bus, voltage, rated/peak power, startup, duty cycle, overlap, efficiency and whether its measured value is input or output power.

## Future hardware qualification gates

These are not instructions to energize the unidentified assembly. Work only after rated equipment and protection are selected by a qualified person for the actual system.

- Verify battery, load, switch, fuse, wire, connector and module identities; check unpowered continuity and polarity.
- Select fuse ratings against available fault current, conductor limits, DC interrupting capacity and load inrush.
- Confirm buck polarity/ground/output without attaching GPIO; check line/load behavior and thermal design against its datasheet.
- Verify ADC divider nodes with a calibrated meter/source while keeping unprotected motor transients away from the ESP32.
- Calibrate voltage channels at several points and current channels at zero, positive and negative known currents against a suitable reference; record uncertainty and temperature.
- Verify simultaneous voltage/current sampling, filter response, PWM behavior, integrated energy and sample-loss handling.
- Test motor turn-on/turn-off suppression with rated instruments and a protected source after selecting the motor/driver network.
- Validate OLED acknowledgments/full-frame pattern and DS18B20 identification/CRC only if those modules are installed.
- For battery SOC/range, use the exact battery manufacturer procedure, known capacity/rate/temperature and a documented drive/load cycle.

## Existing simulation evidence boundary

Existing Wokwi files contain ESP32, OLED and two sliders. The sketch labels slider values synthetic and uses legacy divider constants. The retained project reports a partial prior OLED result, but lacks an independently reproducible project URL or complete capture. This review did not run Wokwi. Its potentiometer documentation states that it does not provide full analog simulation and returns the same results when VCC/GND are omitted.
