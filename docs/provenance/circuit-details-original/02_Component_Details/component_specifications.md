# Component Specifications and Evidence

Every item below is a documentary candidate or unresolved selection; no package entry proves that the part is installed.

## Manufacturer-supported facts

- **ACS712 IC (candidate for motor channel only):** Allegro’s Rev. 22 datasheet specifies 5 V single-supply operation (4.5–5.5 V), with sensitivity depending on suffix. The x30A version’s optimized range is ±30 A and its typical sensitivity is 66 mV/A at 25 °C. Increasing primary current from IP+ toward IP− raises VOUT. The zero-current output is near VCC/2 and is ratiometric. Allegro explicitly says this IC is not intended for automotive applications. Its typical application shows a 0.1 µF VCC bypass and a FILTER-pin capacitor; verify the breakout’s onboard components before adding or omitting them. The IC’s low-resistance copper path and isolation ratings do not establish the ampacity, creepage, terminal, PCB trace, thermal or fault ratings of a clone module. A ±30 A variant may be poorly resolved at a small lamp current.
- **LM2596 regulator IC candidate:** TI specifies a 4.5–40 V input range and a 3 A regulator, subject to the datasheet’s component, layout, output, thermal and electrical conditions. This is an IC rating, not the rating of an unidentified adjustable board.
- **Classic ESP32 ADC:** Espressif lists ADC1 on GPIO32–39 for the classic ESP32. At 11 dB attenuation, the documented suggested accuracy range is approximately 150–2450 mV. This is not a GPIO absolute-maximum rating. Calibration is needed, and the exact SoC/revision and board wiring must be identified.
- **Amptek battery model listing:** the manufacturer product table lists a 12 V, 7.6 Ah, 2050 g battery model. The physical unit is not confirmed. The linked detail PDF could not be read in this review, so charging, discharge, cutoff, rate, internal resistance and usable capacity remain unresolved.

## Proposed passives

Two 68 kΩ / 10 kΩ, 1% divider pairs are design assumptions for one voltage channel per load. At 18 V DC maximum they give 2.3077 V nominal and 2.3482 V at the worst 1% corner. Each consumes about 0.231 mA and 4.15 mW total nominally at 18 V. These numbers do not select resistor voltage rating or fault protection.

The 27 kΩ / 20 kΩ, 1% pair is a candidate scaler only for the motor-channel ACS712 direct output. With 5.00 V supply, the assumed zero-current output is 2.50 V, and ADC sensitivity is about 28.09 mV/A. A conservative 5.5 V output bound gives 2.3674 V at the resistor corner. Verify the exact module output circuit first.

100 nF capacitors are measurement filters: 68 kΩ || 10 kΩ gives an approximate pole of 182.6 Hz; 27 kΩ || 20 kΩ gives approximately 138.5 Hz. These filters do not measure fast motor switching or provide overcurrent protection.

## IC, module and assembly distinctions

ACS712 is an IC. The screw-terminal sensor breakout and any included resistors/capacitors are separate, unidentified hardware. LM2596 is a regulator IC; an adjustable converter board adds inductor, diode, capacitors, potentiometer, PCB, heatsinking and connector limits. ESP32 silicon/module is distinct from a DevKit carrier board and its header positions/power paths. SSD1306 is a display-driver IC, not proof of a particular OLED module. DS18B20 is a sensor IC; a waterproof probe is an assembly whose wires and sealing are separately specified.

The complete component-by-component status is in component_list.csv and unresolved_component_identification.md.
